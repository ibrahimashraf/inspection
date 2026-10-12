/* modules/photos-idb.js — v2.0
   IndexedDB-backed photo storage. Records keep r.photos[] as live data
   URLs in memory; localStorage sees compact "@idb:<key>" markers only.

   v2.0:
     - Removed duplicate putPhoto declaration (dead first copy).
     - Guarded Blob/File/Image references for worker contexts.
     - hydrateAll runs with a bounded concurrency cap (6 records at a
       time) so 20-record batches don't wedge mobile Safari's IDB queue.
     - hydrateRecordPhotos drops unresolvable markers rather than
       leaving the marker string in place and re-persisting corruption.
     - stageRecordPhotos sets the marker AFTER the IDB put resolves, so
       a crash mid-write leaves a null slot, not a dangling marker.
     - inlineMarkersDeep exported.
*/
(function () {
    'use strict';

    var DB_NAME = 'ims_media_v1';
    var DB_VERSION = 1;
    var STORE = 'photos';
    var MARKER = '@idb:';

    var _dbP = null;

    function openDB() {
        if (_dbP) return _dbP;
        _dbP = new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(new Error('IndexedDB unsupported')); return; }
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror  = function () { reject(req.error); };
        });
        return _dbP;
    }

    function tx(mode) {
        return openDB().then(function (db) {
            return db.transaction(STORE, mode).objectStore(STORE);
        });
    }
    function p(req) {
        return new Promise(function (res, rej) {
            req.onsuccess = function () { res(req.result); };
            req.onerror   = function () { rej(req.error); };
        });
    }

    var _quotaWarned = false;
    function putPhoto(id, dataUrl) {
        return tx('readwrite').then(function (s) {
            return p(s.put({
                id: id,
                dataUrl: dataUrl,
                bytes: dataUrl ? Math.round(dataUrl.length * 3 / 4) : 0,
                savedAt: Date.now()
            }));
        }).catch(function (err) {
            if (!_quotaWarned && err && (err.name === 'QuotaExceededError' || err.code === 22)) {
                _quotaWarned = true;
                if (typeof showToast === 'function') {
                    showToast('Photo storage is full. Old photos may not save.', 'warn');
                }
            }
            throw err;
        });
    }
    function getPhoto(id) {
        return tx('readonly').then(function (s) { return p(s.get(id)); })
                            .then(function (rec) { return rec ? rec.dataUrl : null; });
    }
    function deletePhoto(id) {
        return tx('readwrite').then(function (s) { return p(s.delete(id)); });
    }
    function clearAll() {
        return tx('readwrite').then(function (s) { return p(s.clear()); });
    }
    function countAll() {
        return tx('readonly').then(function (s) { return p(s.count()); });
    }
    function estimateBytes() {
        return tx('readonly').then(function (s) {
            return new Promise(function (res, rej) {
                var total = 0, cur = s.openCursor();
                cur.onsuccess = function (e) {
                    var c = e.target.result;
                    if (c) { total += c.value.bytes || 0; c.continue(); }
                    else res(total);
                };
                cur.onerror = function () { rej(cur.error); };
            });
        });
    }

    function isMarker(v) { return typeof v === 'string' && v.indexOf(MARKER) === 0; }
    function keyOf(m) { return m.slice(MARKER.length); }
    function genUid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    function ensureUid(r) { if (!r.uid) r.uid = genUid(); return r.uid; }
    function makeKey(engine, uid, idx) { return engine + '/' + uid + '/' + idx; }

    function isBlobLike(o) {
        if (typeof Blob  !== 'undefined' && o instanceof Blob)  return true;
        if (typeof File  !== 'undefined' && o instanceof File)  return true;
        if (typeof Image !== 'undefined' && o instanceof Image) return true;
        return false;
    }

    function containsMarker(obj) {
        if (obj === null || obj === undefined) return false;
        if (typeof obj === 'string') return obj.indexOf(MARKER) !== -1;
        if (Array.isArray(obj)) {
            for (var i = 0; i < obj.length; i++) if (containsMarker(obj[i])) return true;
            return false;
        }
        if (typeof obj === 'object') {
            if (isBlobLike(obj)) return false;
            var ks = Object.keys(obj);
            for (var j = 0; j < ks.length; j++) if (containsMarker(obj[ks[j]])) return true;
        }
        return false;
    }

    function inlineMarkersDeep(obj) {
        if (obj === null || obj === undefined) return Promise.resolve(obj);
        if (typeof obj === 'string') {
            if (!isMarker(obj)) return Promise.resolve(obj);
            return getPhoto(keyOf(obj)).then(function (d) { return d || null; });
        }
        if (Array.isArray(obj)) {
            var arr = new Array(obj.length);
            var chain = Promise.resolve();
            for (var i = 0; i < obj.length; i++) {
                (function (idx) {
                    chain = chain.then(function () {
                        return inlineMarkersDeep(obj[idx]).then(function (v) { arr[idx] = v; });
                    });
                })(i);
            }
            return chain.then(function () { return arr; });
        }
        if (typeof obj === 'object') {
            if (isBlobLike(obj)) return Promise.resolve(obj);
            var out = {}, keys = Object.keys(obj);
            var c2 = Promise.resolve();
            keys.forEach(function (k) {
                c2 = c2.then(function () {
                    return inlineMarkersDeep(obj[k]).then(function (v) { out[k] = v; });
                });
            });
            return c2.then(function () { return out; });
        }
        return Promise.resolve(obj);
    }

    function stageRecordPhotos(engine, r) {
        if (!r || !Array.isArray(r.photos)) return Promise.resolve();
        ensureUid(r);
        if (!r._photoMarkers || r._photoMarkers.length !== r.photos.length) {
            r._photoMarkers = new Array(r.photos.length).fill(null);
        }
        var tasks = [];
        for (var i = 0; i < r.photos.length; i++) {
            (function (idx) {
                var v = r.photos[idx];
                if (!v) { r._photoMarkers[idx] = null; return; }
                if (isMarker(v)) { r._photoMarkers[idx] = v; return; }
                var key = makeKey(engine, r.uid, idx);
                tasks.push(
                    putPhoto(key, v).then(
                        function () { r._photoMarkers[idx] = MARKER + key; },
                        function (err) { r._photoMarkers[idx] = null; throw err; }
                    )
                );
            })(i);
        }
        return Promise.all(tasks);
    }

    async function hydrateRecordPhotos(r) {
        if (!r || !Array.isArray(r.photos)) return { missing: 0 };
        if (!r._photoMarkers || r._photoMarkers.length !== r.photos.length) {
            r._photoMarkers = new Array(r.photos.length).fill(null);
        }
        let missing = 0;
        const tasks = [];
        for (let i = 0; i < r.photos.length; i++) {
            const v = r.photos[i];
            if (!isMarker(v)) { if (v) r._photoMarkers[i] = null; continue; }
            (function (idx, key) {
                tasks.push(getPhoto(key).then(function (d) {
                    if (d) { r.photos[idx] = d; r._photoMarkers[idx] = MARKER + key; }
                    else   { r.photos[idx] = null; r._photoMarkers[idx] = null; missing++; }
                }));
            })(i, keyOf(v));
        }
        await Promise.all(tasks);
        return { missing: missing };
    }

    function allRecords() {
        const seen = new Set(), out = [];
        (window.liftingBatch || []).concat(window.ndtBatch || []).forEach(function (r) {
            if (r && !seen.has(r)) { seen.add(r); out.push(r); }
        });
        return out;
    }

    async function hydrateAll() {
        const recs = allRecords();
        let missing = 0;
        const CONC = 6;
        for (let i = 0; i < recs.length; i += CONC) {
            const slice = recs.slice(i, i + CONC);
            const results = await Promise.all(slice.map(hydrateRecordPhotos));
            results.forEach(function (x) { missing += x.missing; });
        }
        return { missing: missing };
    }

    function migrateAll() {
        const recs = allRecords();
        let chain = Promise.resolve();
        recs.forEach(function (r) {
            const eng = (window.liftingBatch || []).indexOf(r) !== -1 ? 'lifting' : 'ndt';
            chain = chain.then(function () { return stageRecordPhotos(eng, r); });
        });
        return chain;
    }

    function stripPhotosForPersist() {
        const stash = [];
        allRecords().forEach(function (r) {
            if (!Array.isArray(r.photos)) return;
            stash.push({ rec: r, photos: r.photos.slice() });
            r.photos = r.photos.map(function (_, idx) {
                return (r._photoMarkers && r._photoMarkers[idx]) || null;
            });
        });
        return stash;
    }
    function restorePhotosAfterPersist(stash) {
        for (let i = 0; i < stash.length; i++) stash[i].rec.photos = stash[i].photos;
    }

    function deleteKeyForRecord(engine, r, idx) {
        if (!r || !r._photoMarkers) return Promise.resolve();
        const m = r._photoMarkers[idx];
        if (!m) return Promise.resolve();
        r._photoMarkers[idx] = null;
        return isMarker(m) ? deletePhoto(keyOf(m)) : Promise.resolve();
    }

    function deleteAllForRecord(engine, r) {
        if (!r || !r._photoMarkers) return Promise.resolve();
        const tasks = [];
        for (let i = 0; i < r._photoMarkers.length; i++) {
            const m = r._photoMarkers[i];
            if (m) { tasks.push(deletePhoto(keyOf(m))); r._photoMarkers[i] = null; }
        }
        return Promise.all(tasks);
    }

    async function reset() {
        try { await clearAll(); } catch (e) {}
        try { if (window.indexedDB) indexedDB.deleteDatabase(DB_NAME); } catch (e) {}
        return true;
    }

    window.PhotosIDB = {
        init: openDB,
        put: putPhoto,
        get: getPhoto,
        delete: deletePhoto,
        clear: clearAll,
        count: countAll,
        estimateBytes: estimateBytes,
        stageRecordPhotos: stageRecordPhotos,
        stripPhotosForPersist: stripPhotosForPersist,
        restorePhotosAfterPersist: restorePhotosAfterPersist,
        hydrateRecordPhotos: hydrateRecordPhotos,
        hydrateAll: hydrateAll,
        migrateAll: migrateAll,
        inlineMarkersDeep: inlineMarkersDeep,
        containsMarker: containsMarker,
        deleteKeyForRecord: deleteKeyForRecord,
        deleteAllForRecord: deleteAllForRecord,
        reset: reset,
        MARKER: MARKER
    };
})();