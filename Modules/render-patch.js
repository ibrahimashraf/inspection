/* ==================================================================
   modules/render-patch.js — v2.1
   Preview DOM diffing. Uses window.* bindings (var-declared in
   index.html).

   v2.1: structure hash now includes CONTENT of arrays + docControl
   + corpInfo, so editing a PUWER note, checklist row, indication,
   extra cell, verdict text, or any Banners-tab field correctly
   triggers a full re-render (previously produced hash collision →
   stale preview). See audit C1/C5.
   ================================================================== */
let _previewMounted = false;
let _previewStructureHash = '';
let _lastLinkHash = '';

function computeStructureHash(record, engine) {
    const ft = window.featureToggles || {};
    return [
        engine,
        record.method || '',
        record.includePuwer ? 'p' : '',
        record.includeChecklist ? 'c' : '',
        record.stampUpload ? 's' : '',
        ft.qr ? 'q' : '',
        ft.overlays ? 'o' : '',
        ft.corp ? 'b' : '',
        // Content digests — length alone is not enough; editing an
        // existing row must invalidate the cache.
        JSON.stringify((record.puwerRows   || []).map(r => [r.ref, r.item, r.result, r.note])),
        JSON.stringify((record.checklist   || []).map(c => [c.item, c.status, c.note])),
        JSON.stringify((record.indications || []).map(i => [i.joint, i.area, i.finding, i.result])),
        JSON.stringify((record.extraCells  || []).map(c => [c.label, c.value])),
        (record.verdictLabel || '') + '\u0000' + (record.verdictText || ''),
        // Signature data URLs — length is enough. Cheap, and changes
        // whenever a new stroke is captured or a signature is replaced.
        (record.inspectorSigLive  || '').length + ':' +
        (record.inspectorSigUpload|| '').length + ':' +
        (record.authSigLive       || '').length + ':' +
        (record.authSigUpload     || '').length + ':' +
        (record.inspSigLive       || '').length + ':' +
        (record.inspSigUpload     || '').length + ':' +
        (record.witSigLive        || '').length + ':' +
        (record.witSigUpload      || '').length,
        (window.docControl ? JSON.stringify(window.docControl) : ''),
        (window.corpInfo   ? JSON.stringify(window.corpInfo)   : '')
    ].join('|');
}

function linkFieldsChanged(record) {
    const h = `${record.reportNo || ''}|${record.serial || ''}`;
    if (h !== _lastLinkHash) { _lastLinkHash = h; return true; }
    return false;
}

function renderPreviewPatch(container, record) {
    const bindings = container.querySelectorAll('[data-bind]');
    let dirty = 0;
    for (const el of bindings) {
        const key = el.dataset.bind;
        let nv;
        if (key.includes('.')) {
            const [p, c] = key.split('.');
            nv = record[p]?.[c];
        } else {
            nv = record[key];
        }
        const s = sanitizeForReport(nv || '');
        if (el.innerHTML !== s) { el.innerHTML = s; dirty++; }
    }
    if (dirty > 0 && linkFieldsChanged(record)) {
        const qr = container.querySelector('#waQrSvg');
        if (qr && typeof paintQr === 'function') paintQr(qr, record);
    }
    return dirty;
}

function renderPreview() {
    const container = document.getElementById('enginePreviewContainer');
    if (!container) return;
    const lp = document.getElementById('qrLinkPreview');
    if (lp && typeof buildVerificationLink === 'function') lp.value = buildVerificationLink(activeRec());
    const record = activeRec();
    const newHash = computeStructureHash(record, window.currentEngine);
    if (!_previewMounted || newHash !== _previewStructureHash) {
        renderPreviewFull(container, record);
        _previewMounted = true;
        _previewStructureHash = newHash;
        return;
    }
    renderPreviewPatch(container, record);
}

function resetPreviewCache() {
    _previewMounted = false;
    _previewStructureHash = '';
    _lastLinkHash = '';
}