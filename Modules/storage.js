/* ==================================================================
   modules/storage.js — v2.5
   ==================================================================
   v2.5 changes (AIO hardening):
     - _serializeRecord signs the serialized form (blob refs, not
       data URLs) with AIO.signRecord. Signature lands on `_sig`.
     - _deserializeRecord verifies against the serialized form `s`
       (because that is what was signed) and reports "signature"
       through the existing _integrityWarning channel.
     - persistStateV2 appends a signed audit entry per generation
       after blobs are committed and generations reconciled.
     - All AIO hooks are guarded by window.AIO && window.AIO.ready,
       so the file degrades to v2.4 behaviour if AIO is absent.

   v2.4 changes (audit C4, H3, M4):
     - Shallow clone in serialize/deserialize — no more deep-cloning
       multi-MB data URLs on every autosave.
     - Quota toast throttled — no more stacking warnings every save
       once usage crosses 80%.
     - Single source of truth for dirty flag — isDirty() only.
       Removed _isDirty assignments; that variable is now write-only
       for backward compatibility but no longer read here.
   ================================================================== */
const DB_NAME = 'ims_blobs_v1';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;
const BLOB_PREFIX = 'ims-blob-v1::';

/* Record fields whose values are large data URLs and are therefore parked in
   IndexedDB instead of localStorage, keyed `<recordId>/<field>`.

   Single source of truth. This list was written out by hand in three places
   (storage serialize, storage deserialize, backup export), so adding a
   signature field and missing one copy meant that signature silently
   vanished from saves or from backups with no error anywhere. */
window.BLOB_FIELDS = Object.freeze([
    'inspectorSigUpload', 'authSigUpload', 'inspSigUpload', 'witSigUpload', 'stampUpload'
]);

let _dbPromise = null;
let _saveGeneration = 0;
let _savedGeneration = 0;
let _saveInFlight = null;
let _broadcastChannel = null;
let _bcInitialized = false;
let _lastQuotaWarnPct = 0;
let _lastQuotaWarnAt = 0;

/* ==============================================================
   MULTI-TAB BROADCAST
   ============================================================== */
function _getBroadcast() {
    if (_bcInitialized) return _broadcastChannel;
    _bcInitialized = true;
    try {
        _broadcastChannel = new BroadcastChannel('ims-broadcast');
        _broadcastChannel.addEventListener('message', (ev) => {
            const d = ev.data;
            if (!d || d.type !== 'saved') return;
            if (typeof isDirty === 'function' && isDirty()) {
                if (typeof showToast === 'function') {
                    showToast('Another tab saved changes. Reload to sync.', 'warn');
                }
            }
        });
    } catch (e) {
        _broadcastChannel = null;
    }
    return _broadcastChannel;
}

/* ==============================================================
   BLOB STORE (IndexedDB)
   ============================================================== */
function _getDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbPromise;
}

const BlobStore = {
    async put(key, blob) {
        const db = await _getDB();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(blob, key);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    },
    async get(key) {
        const db = await _getDB();
        return new Promise((res, rej) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const r = tx.objectStore(STORE_NAME).get(key);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
    },
    async estimate() {
        if (!navigator.storage?.estimate) return null;
        try {
            const { usage, quota } = await navigator.storage.estimate();
            return { usage, quota, percent: (usage / quota * 100).toFixed(1) };
        } catch (e) { return null; }
    }
};

/* ==============================================================
   GENERATION TRACKING
   ============================================================== */
function markDirty() {
    _saveGeneration++;
    if (typeof setSaveIndicator === 'function') setSaveIndicator('dirty');
}
function isDirty() { return _saveGeneration !== _savedGeneration; }

/* ==============================================================
   SERIALIZE / DESERIALIZE
   Shallow clone: we only replace the fields we mutate. Photos and
   sig uploads are large data URLs — never structuredClone them.
   ============================================================== */
async function _serializeRecord(record, recordId) {
    const s = { ...record };
    const tasks = [];

        /* Photos are photos-idb.js's responsibility. Persist wrapper strips
       them to markers before we see them. We just shallow-copy. */
    if (Array.isArray(record.photos)) s.photos = record.photos.slice();


    window.BLOB_FIELDS.forEach(field => {
        if (typeof record[field] === 'string' && record[field].startsWith('data:')) {
            const key = `${recordId}/${field}`;
            tasks.push(BlobStore.put(key, record[field]).then(() => { s[field] = BLOB_PREFIX + key; }));
        }
    });

    await Promise.all(tasks);

    // ── AIO: sign the *serialized* form (blob refs, not data URLs).
    //    Verification on restore recomputes over the same form, so the
    //    signature is stable across blob rotation and never signs the
    //    multi-MB data URLs themselves. `_`-prefixed fields are stripped
    //    by AIO.canonical(), so the signature cannot sign itself, and
    //    `_integrityWarning` (set on the hydrate path) does not
    //    invalidate the signature either.
    if (window.AIO && window.AIO.ready) {
        try {
            s._sig = await window.AIO.signRecord(s);
        } catch (e) {
            console.warn('[aio] sign failed for', recordId, e);
        }
    }

    return s;
}
/* ==============================================================
   ASSETS SERIALIZE
   Header / footer banners are global (not per-record), so they
   cannot ride through _serializeRecord. Same blob-ref strategy:
   data URLs go to IndexedDB, localStorage keeps only the refs.
   ============================================================== */
async function _serializeAssets(assets) {
    const src = assets || {};
    const out = { headerBanner: src.headerBanner || null, footerBanner: src.footerBanner || null };
    const tasks = [];
    ['headerBanner', 'footerBanner'].forEach(k => {
        const v = src[k];
        if (typeof v === 'string' && v.startsWith('data:')) {
            const key = `assets/${k}`;
            tasks.push(BlobStore.put(key, v).then(() => { out[k] = BLOB_PREFIX + key; }));
        }
    });
    await Promise.all(tasks);
    return out;
}

async function _deserializeAssets(serialized) {
    const out = { headerBanner: null, footerBanner: null };
    if (!serialized || typeof serialized !== 'object') return out;
    await Promise.all(['headerBanner', 'footerBanner'].map(async k => {
        const v = serialized[k];
        if (typeof v === 'string' && v.startsWith(BLOB_PREFIX)) {
            const key = v.slice(BLOB_PREFIX.length);
            try {
                const blob = await BlobStore.get(key);
                out[k] = blob || null;
            } catch (e) {
                console.warn('[assets] hydrate failed for', k, e);
                out[k] = null;
            }
        } else if (typeof v === 'string' && v.startsWith('data:')) {
            // Legacy: if someone manually seeded localStorage with a data URL.
            out[k] = v;
        }
    }));
    return out;
}
async function _deserializeRecord(s, reportMissing) {
    const r = { ...s };
    const tasks = [];
    const missing = [];

    const hydrate = (field, index) => {
        const v = index === undefined ? r[field] : r[field]?.[index];
        if (typeof v === 'string' && v.startsWith(BLOB_PREFIX)) {
            const key = v.slice(BLOB_PREFIX.length);
            const p = BlobStore.get(key).then(blob => {
                if (blob) {
                    if (index === undefined) r[field] = blob;
                    else r[field][index] = blob;
                } else {
                    missing.push(index === undefined ? field : `${field}[${index}]`);
                    if (index === undefined) r[field] = null;
                    else r[field][index] = null;
                }
            });
            tasks.push(p);
        }
    };

    /* Photos-idb hydrates on boot. We shallow-copy only. */
    if (Array.isArray(r.photos)) r.photos = r.photos.slice();
    window.BLOB_FIELDS.forEach(f => hydrate(f));

    await Promise.all(tasks);

    // ── AIO: verify signature against the raw serialized form `s`,
    //    not the hydrated `r`. `s` still holds the blob-ref strings
    //    that were signed; `r` holds the hydrated data URLs, which
    //    would produce a different canonical form and a false negative.
    if (reportMissing && window.AIO && window.AIO.ready) {
        if (typeof s._sig !== 'string') {
            /* New record, or pre-AIO backup. Not an integrity failure. */
        } else {
            const ok = await window.AIO.verifyRecord(s);
            if (!ok) missing.push('signature');
        }
    }

    if (reportMissing && missing.length) r._integrityWarning = missing;
    return r;
}

/* ==============================================================
   PERSIST — writes BOTH engines every time
   ============================================================== */
async function persistStateV2() {
    if (_saveInFlight) {
        try { await _saveInFlight; } catch (e) {}
    }

    const myGen = _saveGeneration;

    const work = (async () => {
        for (const engine of ['LIFTING', 'NDT']) {
            const list = engine === 'LIFTING' ? window.liftingBatch : window.ndtBatch;
            if (!Array.isArray(list)) continue;
            const serialized = await Promise.all(
                list.map((rec, i) => _serializeRecord(rec, `${engine}/${i}`))
            );
            store.set(`ims_${engine}_meta_v2`, JSON.stringify(serialized));
        }

        store.set('ims_active', String(window.activeIdx));
        store.set('ims_version', String(SCHEMA_VERSION));
        store.set('ims_qr', window.qrChannel);
        store.set('ims_dc', JSON.stringify(window.docControl));
        store.set('ims_ci', JSON.stringify(window.corpInfo));
        store.set('ims_ft', JSON.stringify(window.featureToggles));

        // ── FIX: header/footer banners were memory-only. Now they ride
        //    through the same blob-ref mechanism as photos.
        try {
            const serializedAssets = await _serializeAssets(window.assets);
            store.set('ims_assets', JSON.stringify(serializedAssets));
        } catch (e) {
            console.warn('[persist] assets', e);
        }

        _savedGeneration = Math.max(_savedGeneration, myGen);
        if (typeof setSaveIndicator === 'function') {
            setSaveIndicator(_saveGeneration !== _savedGeneration ? 'dirty' : 'saved');
        }

        const bc = _getBroadcast();
        if (bc) {
            try { bc.postMessage({ type: 'saved', gen: myGen }); } catch (e) {}
        }

        // ── AIO: append a signed, hash-chained audit entry per persisted
        //    generation. Placed after all writes and after the generation
        //    counter has been reconciled, so a crash mid-write leaves no
        //    orphan audit entry claiming success.
        if (window.AIO && window.AIO.ready) {
            try {
                await window.AIO.appendAudit('PERSIST', {
                    gen: myGen,
                    lifting: (window.liftingBatch || []).length,
                    ndt: (window.ndtBatch || []).length
                });
            } catch (e) {
                console.warn('[aio] audit append failed', e);
            }
        }

        // Quota warning throttle: emit only when the percentage has
        // actually grown by ≥1 point OR ≥60s have elapsed. Previously
        // fired on every autosave once >80%.
        const q = await BlobStore.estimate();
        if (q) {
            const pct = parseFloat(q.percent);
            const now = Date.now();
            const grew = pct >= _lastQuotaWarnPct + 1;
            const expired = (now - _lastQuotaWarnAt) > 60000;
            if (pct > 80 && (grew || expired)) {
                _lastQuotaWarnPct = pct;
                _lastQuotaWarnAt = now;
                if (typeof showToast === 'function') showToast(`Storage: ${q.percent}% used`, 'warn');
            }
        }
    })();

    _saveInFlight = work.finally(() => { _saveInFlight = null; });
    return _saveInFlight;
}

/* ==============================================================
   RESTORE — with integrity verification
   ============================================================== */
async function restoreStateV2() {
    const version = parseInt(store.get('ims_version') || '1', 10);
    if (version < SCHEMA_VERSION && typeof migrateState === 'function') {
        await migrateState();
    }

    const integrityIssues = [];

    for (const engine of ['LIFTING', 'NDT']) {
        const raw = store.get(`ims_${engine}_meta_v2`) ||
                    store.get(`ims_${engine.toLowerCase()}`);
        if (!raw) continue;
        try {
            const list = JSON.parse(raw);
            const hydrated = await Promise.all(list.map(s => _deserializeRecord(s, true)));
            if (engine === 'LIFTING') window.liftingBatch = hydrated;
            else window.ndtBatch = hydrated;

            // ── AIO: split integrity reporting so signature failures are
            //    called out separately from missing media. A missing blob
            //    is recoverable (user re-uploads); a bad signature means
            //    the record has been edited outside the app.
            const badMedia = hydrated.filter(r =>
                r._integrityWarning && r._integrityWarning.some(w => w !== 'signature')
            );
            const badSig = hydrated.filter(r =>
                r._integrityWarning && r._integrityWarning.includes('signature')
            );
            if (badMedia.length) {
                integrityIssues.push(`${badMedia.length} ${engine} record(s) missing media`);
            }
            if (badSig.length) {
                integrityIssues.push(`⚠ ${badSig.length} ${engine} record(s) FAILED signature verification`);
            }
        } catch (e) {
            console.error('[restore]', engine, e);
            if (typeof showToast === 'function') {
                showToast(`Restore failed for ${engine}: ${e.message}`, 'error');
            }
        }
    }

    if (integrityIssues.length && typeof showToast === 'function') {
        setTimeout(() => showToast(`⚠ ${integrityIssues.join(' | ')}`, 'error'), 800);
    }

    const a = parseInt(store.get('ims_active') || '0', 10);
    window.activeIdx = isNaN(a) ? 0 : a;

        try {
        const dc = JSON.parse(store.get('ims_dc') || 'null');
        if (dc) Object.assign(window.docControl, dc);
        const ci = JSON.parse(store.get('ims_ci') || 'null');
        if (ci) Object.assign(window.corpInfo, ci);
        const ft = JSON.parse(store.get('ims_ft') || 'null');
        if (ft) Object.assign(window.featureToggles, ft);
    } catch (e) {}

    // ── FIX: hydrate global header/footer banners from IndexedDB.
    //    Same blob-ref pattern as photos. Silent on absence (fresh
    //    install has no ims_assets key yet).
    try {
        const raw = store.get('ims_assets');
        if (raw) {
            const parsed = JSON.parse(raw);
            const hydrated = await _deserializeAssets(parsed);
            if (!window.assets) window.assets = { headerBanner: null, footerBanner: null };
            Object.assign(window.assets, hydrated);
        }
    } catch (e) {
        console.warn('[restore] assets', e);
    }
}