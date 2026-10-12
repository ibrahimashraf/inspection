/* ==================================================================
   modules/aio.js — v1.1
   All-In-One hardening layer. Zero external dependencies.

     1. Cryptographic identity  — ECDSA P-256, non-extractable, IndexedDB
     2. Record signing          — every persisted record carries a signature
                                   over its canonical serialized form
     3. Integrity verification  — signatures checked on restore; failures
                                   surface in the same channel as missing blobs
     4. Encrypted backup        — .imsbak v2 = AES-GCM-256 + PBKDF2-SHA256
     5. Append-only audit log   — hash-chained, signed, in IndexedDB
     6. Boot self-test          — every subsystem asserted before UI mounts
     7. Vendored runtime        — no fetch, no CDN, no external origins
   ================================================================== */
(function () {
    'use strict';

    const AIO_VERSION = '1.1';
    const IDB_NAME = 'ims_aio_v1';
    const IDB_VERSION = 1;
    const STORE_KEYS = 'keys';
    const STORE_AUDIT = 'audit';
    const PBKDF2_ITERS = 250000;

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    /* ---------------- tiny idb ---------------- */
    let _dbp = null;
    function db() {
        if (_dbp) return _dbp;
        _dbp = new Promise((res, rej) => {
            const r = indexedDB.open(IDB_NAME, IDB_VERSION);
            r.onupgradeneeded = e => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORE_KEYS)) d.createObjectStore(STORE_KEYS);
                if (!d.objectStoreNames.contains(STORE_AUDIT)) {
                    const s = d.createObjectStore(STORE_AUDIT, { keyPath: 'seq' });
                    s.createIndex('ts', 'ts');
                }
            };
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
        return _dbp;
    }
    function tx(store, mode, fn) {
        return db().then(d => new Promise((res, rej) => {
            const t = d.transaction(store, mode);
            const s = t.objectStore(store);
            let req;
            try { req = fn(s); } catch (e) { rej(e); return; }
            t.oncomplete = () => res(req ? req.result : undefined);
            t.onerror = () => rej(t.error);
            t.onabort = () => rej(t.error);
        }));
    }
    const idbGet = (store, key) => tx(store, 'readonly', s => s.get(key));
    const idbPut = (store, val, key) => tx(store, 'readwrite', s =>
        key === undefined ? s.put(val) : s.put(val, key));
    const idbAll = (store) => tx(store, 'readonly', s => s.getAll());

    /* ---------------- base64 ---------------- */
    function b64(u8) {
        let s = '';
        for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return btoa(s);
    }
    function unb64(s) {
        const bin = atob(s);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return u8;
    }

    /* ---------------- canonical serialization ----------------
       Deterministic: sorted keys, no whitespace, `_`-prefixed keys
       stripped so signatures never sign themselves. */
    function canonical(v) {
        if (v === null) return 'null';
        const t = typeof v;
        if (t === 'number') return Number.isFinite(v) ? String(v) : 'null';
        if (t === 'boolean') return v ? 'true' : 'false';
        if (t === 'string') return JSON.stringify(v);
        if (t === 'undefined') return 'null';
        if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
        if (t === 'object') {
            const keys = Object.keys(v).filter(k => k.charCodeAt(0) !== 95).sort();
            return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
        }
        return 'null';
    }

    async function sha256Hex(str) {
        const h = await crypto.subtle.digest('SHA-256', enc.encode(str));
        return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /* ---------------- identity ---------------- */
    let _idp = null;
    function identity() {
        if (_idp) return _idp;
        _idp = (async () => {
            let kp = await idbGet(STORE_KEYS, 'signing');
            if (kp && kp.privateKey && kp.publicKey) return kp;
            kp = await crypto.subtle.generateKey(
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['sign', 'verify']
            );
            const rec = { privateKey: kp.privateKey, publicKey: kp.publicKey, created: Date.now() };
            await idbPut(STORE_KEYS, rec, 'signing');
            // Deliberately NOT awaited. appendAudit signs the entry, signing
            // calls identity(), and identity() returns this very promise -- so
            // awaiting it here deadlocked the first run forever (the promise
            // could never resolve, so AIO.init hung and bootApp never got past
            // it). A warm profile returned early from idbGet above and never
            // hit the cycle, which is why it looked healthy. Fire and forget.
            Promise.resolve()
                .then(function () { return appendAudit('IDENTITY_CREATED', { alg: 'ECDSA-P256' }); })
                .catch(function () {});
            return rec;
        })();
        return _idp;
    }
    async function publicKeyJwk() {
        const kp = await identity();
        return crypto.subtle.exportKey('jwk', kp.publicKey);
    }
    async function fingerprint() {
        const jwk = await publicKeyJwk();
        const h = await sha256Hex(JSON.stringify({ x: jwk.x, y: jwk.y, crv: jwk.crv }));
        return h.slice(0, 16).match(/.{4}/g).join(' ').toUpperCase();
    }

    /* ---------------- sign / verify ---------------- */
    async function signCanonical(obj) {
        const kp = await identity();
        const bytes = enc.encode(canonical(obj));
        const sig = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, bytes
        );
        return b64(new Uint8Array(sig));
    }
    async function verifyCanonical(obj, sigB64) {
        try {
            const kp = await identity();
            const bytes = enc.encode(canonical(obj));
            const sig = unb64(sigB64);
            return await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, sig, bytes
            );
        } catch (e) { return false; }
    }
    const signRecord = (r) => signCanonical(r);
    const verifyRecord = (r) =>
        (r && typeof r._sig === 'string') ? verifyCanonical(r, r._sig) : Promise.resolve(false);

    /* ---------------- audit log ---------------- */
    let _auditTail = null;
    async function auditTail() {
        if (_auditTail !== null) return _auditTail;
        const all = await idbAll(STORE_AUDIT);
        if (!all.length) { _auditTail = { seq: 0, hash: 'GENESIS' }; return _auditTail; }
        all.sort((a, b) => a.seq - b.seq);
        const last = all[all.length - 1];
        _auditTail = { seq: last.seq, hash: last.hash };
        return _auditTail;
    }
    async function appendAudit(action, detail) {
        const tail = await auditTail();
        const payload = {
            seq: tail.seq + 1,
            ts: Date.now(),
            action: String(action || ''),
            detail: detail === undefined ? null : detail,
            prevHash: tail.hash
        };
        const hash = await sha256Hex(canonical(payload));
        let sig = null;
        try { sig = await signCanonical(payload); } catch (e) { sig = null; }
        const entry = { ...payload, hash, sig };
        await idbPut(STORE_AUDIT, entry);
        _auditTail = { seq: entry.seq, hash: entry.hash };
        return entry;
    }
    async function verifyAuditChain() {
        const all = await idbAll(STORE_AUDIT);
        all.sort((a, b) => a.seq - b.seq);
        let prev = 'GENESIS';
        const failures = [];
        for (let i = 0; i < all.length; i++) {
            const e = all[i];
            if (e.seq !== i + 1) failures.push({ seq: e.seq, reason: 'GAP' });
            if (e.prevHash !== prev) failures.push({ seq: e.seq, reason: 'PREV_MISMATCH' });
            const { hash, sig, ...rest } = e;
            const recomputed = await sha256Hex(canonical(rest));
            if (recomputed !== hash) failures.push({ seq: e.seq, reason: 'HASH_MISMATCH' });
            if (sig && !await verifyCanonical(rest, sig)) {
                failures.push({ seq: e.seq, reason: 'BAD_SIG' });
            }
            prev = e.hash;
        }
        return { count: all.length, ok: failures.length === 0, failures };
    }

    /* ---------------- encrypted backup ---------------- */
    async function deriveAesKey(password, salt, usage) {
        const base = await crypto.subtle.importKey(
            'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, [usage]
        );
    }
    async function encryptBackup(plaintext, password) {
        if (!password) throw new Error('Password required');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveAesKey(password, salt, 'encrypt');
        const ct = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
        );
        return JSON.stringify({
            magic: 'IMSBAK2', v: 2, alg: 'AES-GCM-256',
            kdf: 'PBKDF2-SHA256-' + PBKDF2_ITERS,
            salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)),
            fp: await fingerprint()
        });
    }
    async function decryptBackup(envelopeJson, password) {
        const env = JSON.parse(envelopeJson);
        if (env.magic !== 'IMSBAK2') throw new Error('Not an encrypted IMSBAK2 file');
        const salt = unb64(env.salt), iv = unb64(env.iv), ct = unb64(env.ct);
        const key = await deriveAesKey(password, salt, 'decrypt');
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        return dec.decode(pt);
    }

    /* ---------------- batch record integrity ----------------
       Reserved for signature-format migrations. Not called from the
       normal save/load path (which uses signRecord/verifyRecord per
       record). Kept as public API because re-signing an entire batch
       after a canonical-form change requires walking the list and
       calling these. */
    async function stampRecords(list, engine) {
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const r = list[i];
            const sig = await signRecord(r);
            out.push(Object.assign({}, r, { _sig: sig, _sigEngine: engine, _sigIdx: i }));
        }
        return out;
    }
    async function verifyRecords(list, engine) {
        const bad = [];
        for (let i = 0; i < list.length; i++) {
            if (!await verifyRecord(list[i])) {
                bad.push({ engine, idx: i, reportNo: list[i] && list[i].reportNo });
            }
        }
        return bad;
    }

    /* ---------------- boot self-test ---------------- */
    async function selfTest() {
        const checks = [
            ['crypto.subtle', () => { if (!crypto.subtle) throw new Error('absent'); }],
            ['indexedDB', () => { if (!indexedDB) throw new Error('absent'); }],
            ['identity.ensure', () => identity()],
            ['sign.verify.roundtrip', async () => {
                const o = { a: 1, b: 'x' };
                const s = await signCanonical(o);
                if (!await verifyCanonical(o, s)) throw new Error('roundtrip failed');
                if (await verifyCanonical(Object.assign({}, o, { a: 2 }), s)) {
                    throw new Error('tamper undetected');
                }
            }],
            ['canonical.determinism', () => {
                const a = canonical({ b: 1, a: [2, { d: 4, c: 3 }] });
                const b = canonical({ a: [2, { c: 3, d: 4 }], b: 1 });
                if (a !== b) throw new Error('nondeterministic');
            }],
            ['audit.append+verify', async () => {
                const entry = await appendAudit('SELFTEST', { v: AIO_VERSION });
                const { hash, sig, ...rest } = entry;
                const recomputed = await sha256Hex(canonical(rest));
                if (recomputed !== hash) throw new Error('fresh entry hash mismatch');
                if (!sig) throw new Error('fresh entry unsigned');
                if (!await verifyCanonical(rest, sig)) {
                    throw new Error('fresh entry signature failed');
                }
            }],
            ['backup.roundtrip', async () => {
                const pw = 'pw-' + Math.random();
                const env = await encryptBackup('{"hello":1}', pw);
                const pt = await decryptBackup(env, pw);
                if (pt !== '{"hello":1}') throw new Error('mismatch');
                let threw = false;
                try { await decryptBackup(env, 'wrong'); } catch (e) { threw = true; }
                if (!threw) throw new Error('wrong password accepted');
            }]
        ];
        const results = [];
        for (let i = 0; i < checks.length; i++) {
            const name = checks[i][0], fn = checks[i][1];
            try { await fn(); results.push({ name, ok: true }); }
            catch (e) { results.push({ name, ok: false, err: String((e && e.message) || e) }); }
        }
        const failed = results.filter(r => !r.ok);
        return { ok: failed.length === 0, results, failed };
    }

    /* ---------------- audit viewer modal ---------------- */
    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    async function showAudit() {
        const chain = await verifyAuditChain();
        const all = await idbAll(STORE_AUDIT);
        all.sort((a, b) => b.seq - a.seq);
        const recent = all.slice(0, 60);
        const fp = await fingerprint();

        const dialog = document.createElement('dialog');
                dialog.style.cssText =
            'background:var(--surface);color:var(--ink);border:1px solid var(--hairline);' +
            'border-radius:8px;padding:0;max-width:min(92vw,880px);width:100%;' +
            'font-family:var(--app-font-family);max-height:88vh;display:flex;flex-direction:column;' +
            'z-index:200001;position:fixed;top:40px;left:50%;transform:translateX(-50%);';
        const rowsHtml = recent.map(e =>
            '<tr>' +
            '<td style="font-family:var(--font-data);text-align:right;">' + e.seq + '</td>' +
            '<td style="font-family:var(--font-data);white-space:nowrap;">' +
                new Date(e.ts).toISOString().replace('T', ' ').slice(0, 19) + '</td>' +
            '<td style="font-weight:700;">' + _esc(e.action) + '</td>' +
            '<td style="font-family:var(--font-data);font-size:11px;color:var(--ink-muted);">' +
                _esc(JSON.stringify(e.detail)).slice(0, 90) + '</td>' +
            '<td style="font-family:var(--font-data);font-size:11px;color:var(--ink-muted);">' +
                _esc(e.hash.slice(0, 10)) + '…</td>' +
            '</tr>'
        ).join('');
        dialog.innerHTML =
            '<div style="padding:14px 16px;border-bottom:1px solid var(--hairline);display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
                '<div><div style="font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Audit Log</div>' +
                '<div style="font-family:var(--font-data);font-size:11px;color:var(--ink-muted);">' +
                    'Identity ' + _esc(fp) + ' · ' + chain.count + ' entries · ' +
                    (chain.ok
                        ? '<span style="color:var(--pass);font-weight:700;">CHAIN OK</span>'
                        : '<span style="color:var(--fail);font-weight:700;">' +
                          chain.failures.length + ' FAILURE(S)</span>') +
                '</div></div>' +
                '<button class="btn" id="aioClose">Close</button>' +
            '</div>' +
            '<div style="padding:12px 16px;border-bottom:1px solid var(--hairline);background:var(--panel);font-size:var(--ui-font-sm);line-height:1.55;">' +
                '<div style="font-weight:700;margin-bottom:4px;">What is this?</div>' +
                '<div>This is a signed logbook of everything the app has done to your records. ' +
                'Every save, backup, and restore is written here. Each entry is signed by this ' +
                'device\'s key, and every entry\'s hash depends on the one before it — so an edit ' +
                'to any old entry breaks the chain.</div>' +
                '<div style="margin-top:8px;">' +
                    '<span style="color:var(--pass);font-weight:700;">CHAIN OK</span> — nothing has been altered. ' +
                    '<span style="color:var(--fail);font-weight:700;">FAILURES</span> — an entry was ' +
                    'modified outside the app. Do not trust the records until this is investigated.' +
                '</div>' +
                '<div style="margin-top:8px;color:var(--ink-muted);">' +
                    'You do not need to do anything here during normal work. This screen is only ' +
                    'useful if a client or auditor questions whether a record was changed after the fact.' +
                '</div>' +
            '</div>' +
            '<div style="overflow:auto;padding:0 4px 12px;">' +
                '<table class="sheet" style="width:100%;">' +
                '<thead><tr>' +
                    '<th style="width:44px;">#</th>' +
                    '<th style="width:150px;">Time (UTC)</th>' +
                    '<th style="width:130px;">Action</th>' +
                    '<th>Detail</th>' +
                    '<th style="width:90px;">Hash</th>' +
                '</tr></thead>' +
                '<tbody>' + rowsHtml + '</tbody></table>' +
            '</div>';
                document.body.appendChild(dialog);
        dialog.querySelector('#aioClose').onclick = () => { dialog.close(); dialog.remove(); };
        dialog.addEventListener('close', () => dialog.remove());
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
        dialog.showModal();
    }

    /* ---------------- public ---------------- */
    const AIO = {
        version: AIO_VERSION,
        ready: false,
        canonical, sha256Hex,
        fingerprint, publicKeyJwk,
        signCanonical, verifyCanonical,
        signRecord, verifyRecord,
        stampRecords, verifyRecords,
        appendAudit, verifyAuditChain,
        encryptBackup, decryptBackup,
        selfTest, showAudit
    };

    AIO.init = async function () {
        const st = await selfTest();
        AIO.ready = st.ok;
        AIO._selfTest = st;
        if (!st.ok) {
            console.error('[AIO] self-test FAILED', st.failed);
            if (typeof showToast === 'function') {
                showToast('AIO self-test failed — integrity features disabled', 'error');
            }
        } else {
            console.log('[AIO] self-test passed:',
                st.results.map(r => r.name).join(', '));
        }
        return st;
    };

    window.AIO = AIO;
})();