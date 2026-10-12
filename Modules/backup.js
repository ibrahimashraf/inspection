/* ==================================================================
   modules/backup.js — v2.1
   ==================================================================
   v2.1 changes (AIO pass):
     - _hydrateForExport uses a shallow clone. structuredClone deep-
       copied every multi-MB data URL on export — a 50-record backup
       spiked memory by hundreds of MB. Only photos[] elements and the
       five signature/stamp fields are ever replaced during hydration,
       so a shallow clone is safe.
     - exportBackup accepts opts.encrypt / opts.password. Envelope is
       IMSBAK2 (AES-GCM-256 + PBKDF2-SHA256) when a password is set.
     - importBackup sniffs IMSBAK2 before JSON.parse and prompts for
       the password. Plaintext .imsbak files still import.
     - Imported records are routed through _validateRecordInPlace so
       FIELD_RULES apply on the way in, not just on the next save.
     - Stale _sig is stripped on import so the next persist re-signs
       against the current device identity.
   ================================================================== */

function confirmDialog(message) {
    return new Promise(resolve => {
        if (typeof HTMLDialogElement === 'undefined' ||
            typeof HTMLDialogElement.prototype.showModal !== 'function') {
            resolve(window.confirm(message));
            return;
        }
        const dialog = document.createElement('dialog');
        dialog.style.cssText = 'background:var(--surface);color:var(--ink);border:1px solid var(--hairline);border-radius:8px;padding:20px;max-width:420px;font-family:inherit;';
        dialog.innerHTML =
            '<p style="margin-bottom:16px;line-height:1.5;">' +
            String(message).replace(/</g, '&lt;') +
            '</p>' +
            '<menu style="display:flex;gap:8px;justify-content:flex-end;margin:0;padding:0;">' +
            '<button value="cancel" class="btn">Cancel</button>' +
            '<button value="ok" class="btn btn-accent" autofocus>Continue</button>' +
            '</menu>';
        dialog.addEventListener('close', () => {
            resolve(dialog.returnValue === 'ok');
            dialog.remove();
        });
        document.body.appendChild(dialog);
        dialog.showModal();
    });
}

/* Hydrate blob: refs back into data URLs for a single record.
   Shallow clone: only photos[] elements and the five signature/stamp
   fields are ever replaced. Nested objects (stampPos, fieldToggles,
   etc.) are shared with the source record and read-only during
   hydration, so sharing is safe. */
async function _hydrateForExport(record) {
    const r = { ...record };
    const tasks = [];

    const hydrateOne = (field, index) => {
        const v = index === undefined ? r[field] : r[field]?.[index];
        if (typeof v === 'string' && v.startsWith(BLOB_PREFIX)) {
            const key = v.slice(BLOB_PREFIX.length);
            const p = BlobStore.get(key).then(blob => {
                if (blob) {
                    if (index === undefined) r[field] = blob;
                    else r[field][index] = blob;
                } else {
                    if (index === undefined) r[field] = null;
                    else r[field][index] = null;
                }
            });
            tasks.push(p);
        }
    };

    /* Photos live in PhotosIDB (ims_media_v1), not BlobStore. In-memory
       records always carry live data URLs (persist wrapper restores them),
       so we just shallow-copy. The backup wrapper in index.html inlines
       any markers that reach us. */
    if (Array.isArray(record.photos)) r.photos = record.photos.slice();
    window.BLOB_FIELDS.forEach(f => hydrateOne(f));

    await Promise.all(tasks);
    delete r._integrityWarning;
    return r;
}

/* ==============================================================
   EXPORT
   ==============================================================
   opts.password  — encrypt with this password (string)
   opts.encrypt   — prompt for a password before writing
   (no opts)      — plaintext .imsbak (legacy behaviour)
   ============================================================== */
async function exportBackup(opts) {
    opts = opts || {};
    try {
        if (typeof showToast === 'function') showToast('Preparing backup…', 'info');

        const lifting = await Promise.all((window.liftingBatch || []).map(_hydrateForExport));
        const ndt     = await Promise.all((window.ndtBatch     || []).map(_hydrateForExport));

        const payload = JSON.stringify({
            header: {
                schemaVersion: SCHEMA_VERSION,
                appVersion: '2.1.0',
                createdAt: new Date().toISOString(),
                recordCount: { lifting: lifting.length, ndt: ndt.length },
                signed: !!(window.AIO && window.AIO.ready)
            },
            liftingBatch: lifting,
            ndtBatch: ndt,
            corpInfo: window.corpInfo,
            docControl: window.docControl,
            featureToggles: window.featureToggles
        });

        let body = payload;
        let encrypted = false;

        if (window.AIO && window.AIO.ready) {
            if (opts.password) {
                body = await window.AIO.encryptBackup(payload, opts.password);
                encrypted = true;
            } else if (opts.encrypt) {
                const pw = window.prompt('Set a password for this encrypted backup:');
                if (pw === null) return;               // user cancelled
                if (pw.length < 8) {
                    if (typeof showToast === 'function') {
                        showToast('Password must be at least 8 characters.', 'error');
                    }
                    return;
                }
                body = await window.AIO.encryptBackup(payload, pw);
                encrypted = true;
            }
        } else if (opts.encrypt || opts.password) {
            if (typeof showToast === 'function') {
                showToast('AIO not ready — writing plaintext backup.', 'warn');
            }
        }

        const blob = new Blob([body], { type: 'application/json' });
        const filename = 'ims-backup-' + new Date().toISOString().slice(0, 10) + '.imsbak';

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'IMS Backup',
                              accept: { 'application/json': ['.imsbak'] } }]
                });
                const w = await handle.createWritable();
                await w.write(blob);
                await w.close();

                if (window.AIO && window.AIO.ready) {
                    try {
                        await window.AIO.appendAudit('BACKUP_EXPORT', {
                            encrypted: encrypted,
                            records: lifting.length + ndt.length
                        });
                    } catch (e) { console.warn('[backup] audit failed', e); }
                }
                if (typeof showToast === 'function') {
                    showToast(encrypted ? 'Encrypted backup saved' : 'Backup saved', 'success');
                }
                return;
            } catch (e) { /* cancelled or unsupported — fall through to <a download> */ }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);

        if (window.AIO && window.AIO.ready) {
            try {
                await window.AIO.appendAudit('BACKUP_EXPORT', {
                    encrypted: encrypted,
                    records: lifting.length + ndt.length
                });
            } catch (e) { console.warn('[backup] audit failed', e); }
        }
        if (typeof showToast === 'function') {
            showToast(encrypted ? 'Encrypted backup downloaded' : 'Backup downloaded', 'success');
        }
    } catch (e) {
        console.error('[backup] export failed', e);
        if (typeof showToast === 'function') showToast('Backup failed: ' + e.message, 'error');
    }
}

/* ==============================================================
   IMPORT
   ============================================================== */

async function importBackup(file) {
    if (!file) return;
    try {
        const text = await file.text();

        // ── IMSBAK2 envelope? Prompt for password before parsing JSON.
        let payload;
        if (/^\s*\{\s*"magic"\s*:\s*"IMSBAK2"/.test(text)) {
            if (!window.AIO || !window.AIO.ready) {
                throw new Error('This backup is encrypted but AIO is not available.');
            }
            const pw = window.prompt('This backup is encrypted. Enter password:');
            if (!pw) return;
            let plain;
            try { plain = await window.AIO.decryptBackup(text, pw); }
            catch (e) { throw new Error('Wrong password or corrupted backup'); }
            payload = JSON.parse(plain);
        } else {
            payload = JSON.parse(text);
        }

        if (!payload.header || !payload.header.schemaVersion) {
            throw new Error('Invalid backup file');
        }
        if (payload.header.schemaVersion > SCHEMA_VERSION) {
            throw new Error('Backup is from a newer version (v' +
                payload.header.schemaVersion + '). Update the app first.');
        }

        const ok = await confirmDialog(
            'Restore ' + payload.header.recordCount.lifting + ' lifting + ' +
            payload.header.recordCount.ndt + ' NDT records? ' +
            'This replaces all current data.'
        );
        if (!ok) return;

        // ── Strip stale signatures and integrity warnings, then apply
        //    FIELD_RULES. Next persist re-signs against this device.
        const clean = (rec) => {
            if (!rec || typeof rec !== 'object') return rec;
            delete rec._integrityWarning;
            delete rec._sig;
            delete rec._sigEngine;
            delete rec._sigIdx;
            if (typeof _validateRecordInPlace === 'function') _validateRecordInPlace(rec);
            return rec;
        };

        if (Array.isArray(payload.liftingBatch)) {
            window.liftingBatch = payload.liftingBatch.map(clean);
        }
        if (Array.isArray(payload.ndtBatch)) {
            window.ndtBatch = payload.ndtBatch.map(clean);
        }
await PhotosIDB.migrateAll();     // inline data URLs → IDB, record markers
const hyd = await PhotosIDB.hydrateAll();  // resolve any markers that came in
if (hyd.missing > 0) {
    showToast(hyd.missing + ' photo(s) could not be restored from this backup.', 'warn');
}

        if (payload.corpInfo)      Object.assign(window.corpInfo,      payload.corpInfo);
        if (payload.docControl)    Object.assign(window.docControl,    payload.docControl);
        if (payload.featureToggles) Object.assign(window.featureToggles, payload.featureToggles);

        window.activeIdx = 0;
        if (typeof markDirty === 'function') markDirty();
        await persistStateV2();

        if (typeof loadActiveRecord === 'function') loadActiveRecord();
        if (typeof renderPreview === 'function')    renderPreview();

        if (window.AIO && window.AIO.ready) {
            try {
                await window.AIO.appendAudit('BACKUP_IMPORT', {
                    schemaVersion: payload.header.schemaVersion,
                    encrypted: false,
                    records: (payload.liftingBatch || []).length +
                             (payload.ndtBatch     || []).length
                });
            } catch (e) { console.warn('[backup] audit failed', e); }
        }

        if (typeof showToast === 'function') showToast('Backup restored', 'success');
    } catch (e) {
        console.error('[backup] import failed', e);
        if (typeof showToast === 'function') showToast('Restore failed: ' + e.message, 'error');
    }
}