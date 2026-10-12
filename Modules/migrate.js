/* ==================================================================
   modules/migrate.js — v2.0
   Schema versioning. Writes to window.* bindings created by var in
   index.html. No `let`/`const` for shared state — see state boundary
   fix in index.html.
   ================================================================== */
const SCHEMA_VERSION = 4;

const Migrations = {
    1: (s) => {
        s.liftingBatch = (s.liftingBatch || []).map(r => ({
            ...r,
            fieldToggles: r.fieldToggles || {},
            includeChecklist: r.includeChecklist || false
        }));
        return s;
    },
    2: (s) => {
        s.liftingBatch = (s.liftingBatch || []).map(r => {
            if (typeof r.swl === 'object' && r.swl !== null) {
                r.swl = `${r.swl.value || ''} ${r.swl.unit || ''}`.trim();
            }
            return r;
        });
        return s;
    },
    3: (s) => {
        s.ndtBatch = (s.ndtBatch || []).map(r => ({
            ...r,
            inspSigUpload: r.inspSigUpload || null,
            witSigUpload: r.witSigUpload || null,
            inspSigMode: r.inspSigMode || 'LIVE',
            witSigMode: r.witSigMode || 'LIVE'
        }));
        return s;
    }
};

async function migrateState() {
    const stored = parseInt(store.get('ims_version') || '1', 10);
    if (stored === SCHEMA_VERSION) return;
    if (stored > SCHEMA_VERSION) {
        if (typeof showToast === 'function') showToast('Data from a newer version.', 'error');
        return;
    }
    console.log(`[migration] v${stored} → v${SCHEMA_VERSION}`);

    let state = {
        liftingBatch: JSON.parse(store.get('ims_lifting') || '[]'),
        ndtBatch: JSON.parse(store.get('ims_ndt') || '[]')
    };

    for (let v = stored; v < SCHEMA_VERSION; v++) {
        if (Migrations[v]) {
            try {
                state = Migrations[v](state);
                console.log(`[migration] Applied v${v} → v${v + 1}`);
            } catch (e) {
                console.error(`[migration] Failed at v${v}`, e);
                if (typeof showToast === 'function') showToast(`Migration failed at v${v}`, 'error');
                return;
            }
        }
    }

    if (state.liftingBatch?.length) window.liftingBatch = state.liftingBatch;
    if (state.ndtBatch?.length) window.ndtBatch = state.ndtBatch;
    store.set('ims_version', String(SCHEMA_VERSION));
    await persistStateV2();
    if (typeof showToast === 'function') showToast(`Data upgraded to v${SCHEMA_VERSION}`, 'success');
}