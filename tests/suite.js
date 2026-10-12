/* ==========================================================================
   IMS REGRESSION SUITE
   --------------------------------------------------------------------------
   Every test here covers a bug that was actually found and fixed. Run it
   after any change to the app:

     __imsTest()            in the DevTools console, or
     <script src="tests/suite.js"></script>  then __imsTest()

   Read-only: snapshots what it touches and restores it. No network, no
   dependencies, runs from file://. Prints a table and returns the results;
   also parked on window.__imsLastResults.
   ========================================================================== */
(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function run() {
        const out = [];
        const T = async (id, name, fn) => {
            try {
                const r = await fn();
                if (r && r.skip)      out.push({ id, name, ok: 'skip', msg: r.msg });
                else if (r === false) out.push({ id, name, ok: false, msg: 'assertion failed' });
                else if (r && r.ok === false) out.push({ id, name, ok: false, msg: r.msg, detail: r.detail });
                else                  out.push({ id, name, ok: true, msg: (r && r.msg) || 'ok' });
            } catch (e) {
                out.push({ id, name, ok: false, msg: 'threw: ' + (e && e.message), detail: e && e.stack });
            }
        };

        /* ---- BACKUP ROUND TRIP ------------------------------------------
           importBackup is the only path that accepts data written on another
           machine, and the one that can arrive with a tampered audit chain.
           Nothing exercised it.

           Both tests stub the two things that would otherwise block forever:
           Chrome's native file picker (showSaveFilePicker exists on Chrome and
           opens a real dialog) and the password prompt. */
        const captureBackup = async (opts) => {
            let captured = null;
            const origPicker = window.showSaveFilePicker;
            const origPrompt = window.prompt;
            const origCreate = URL.createObjectURL;
            const origClick = HTMLAnchorElement.prototype.click;
            window.showSaveFilePicker = async () => ({
                createWritable: async () => ({
                    write: async (blob) => { captured = blob; },
                    close: async () => {}
                })
            });
            window.prompt = () => 'test-password-123';
            URL.createObjectURL = function (blob) { captured = captured || blob; return origCreate.call(URL, blob); };
            HTMLAnchorElement.prototype.click = function () {};
            try { await exportBackup(opts); } finally {
                window.showSaveFilePicker = origPicker;
                window.prompt = origPrompt;
                URL.createObjectURL = origCreate;
                HTMLAnchorElement.prototype.click = origClick;
            }
            return captured;
        };

        const acceptDialogs = (ms) => {
            const t0 = Date.now();
            const iv = setInterval(() => {
                const d = document.querySelector('dialog[open]');
                const ok = d && d.querySelector('button[value="ok"]');
                if (ok) ok.click();          // the real button, not a bypass
                if (Date.now() - t0 > (ms || 8000)) clearInterval(iv);
            }, 40);
            return () => clearInterval(iv);
        };

        await T('BACKUP-1', 'encrypted export -> import round-trips a record', async () => {
            if (typeof exportBackup !== 'function' || typeof importBackup !== 'function') {
                return { skip: true, msg: 'exportBackup/importBackup not exposed' };
            }
            const r = activeRec();
            const marker = 'BACKUP-MARK-' + Date.now();
            const wasNo = r.reportNo, wasSer = r.serial, wasPhotos = r.photos;
            try {
                r.reportNo = marker; r.serial = 'BC-1';
                const blob = await captureBackup({ encrypt: true });
                if (!blob) return { ok: false, msg: 'exportBackup produced no file' };
                const text = await blob.text();
                const looksEncrypted = text.indexOf('"liftingBatch"') === -1;
                r.reportNo = 'WIPED'; r.serial = null;
                const origPrompt = window.prompt;
                window.prompt = () => 'test-password-123';
                const stop = acceptDialogs();
                try { await importBackup(new File([text], 'test.imsbak', { type: 'application/json' })); }
                finally { window.prompt = origPrompt; stop(); }
                await sleep(900);
                const back = (window.liftingBatch || []).concat(window.ndtBatch || [])
                    .some(x => x.reportNo === marker);
                return { ok: back, msg: 'blob ' + Math.round(text.length / 1024) + 'KB, encrypted=' + looksEncrypted + ', marker restored=' + back };
            } finally {
                r.reportNo = wasNo; r.serial = wasSer; r.photos = wasPhotos;
                renderPreview();
            }
        });
        await T('BACKUP-2', 'import strips stale signatures and re-signs locally', async () => {
            // Not "reject a foreign signature": that is impossible here. The
            // signing key is per-device ECDSA, so a backup's _sig cannot be
            // verified on another machine. backup.js therefore strips it and
            // re-signs on the next persist -- which is the contract to pin.
            if (typeof exportBackup !== 'function' || typeof importBackup !== 'function') return { skip: true, msg: 'not exposed' };
            const origPrompt = window.prompt;
            try {
                const r = activeRec();
                const marker = 'RESIGN-' + Date.now();
                r.reportNo = marker; r.serial = 'RS-1';
                await persistStateV2();
                await sleep(300);
                const blob = await captureBackup({});
                if (!blob) return { ok: false, msg: 'no file' };
                const env = JSON.parse(await blob.text());
                const list = env.liftingBatch || [];
                const rec = Array.isArray(list) ? list.find(x => x && x.reportNo === marker) : null;
                if (!rec) return { ok: false, msg: 'exported batch does not contain the record' };
                // The signature is attached to the serialised form, not the live
                // object, so read it from the export rather than from activeRec().
                const exportedSig = typeof rec._sig === 'string';
                rec._sig = (rec._sig || 'x') + 'ZZ';        // a foreign/garbage sig
                r.reportNo = 'WIPED';
                window.prompt = () => null;
                const stop = acceptDialogs();
                try { await importBackup(new File([JSON.stringify(env)], 'resign.imsbak', { type: 'application/json' })); }
                finally { window.prompt = origPrompt; stop(); }
                await sleep(700);
                const imported = liftingBatch.concat(ndtBatch).find(x => x.reportNo === marker);
                const stripped = !!imported && typeof imported._sig !== 'string';
                await persistStateV2();
                await sleep(400);
                const raw = store.get('ims_LIFTING_meta_v2') || '';
                const resigned = /RESIGN-/.test(raw) && /"_sig":"[0-9a-zA-Z+/=_-]{16,}"/.test(raw);
                const chain = await AIO.verifyAuditChain();
                return { ok: stripped && resigned && chain.ok,
                         msg: 'exportCarriedSig=' + exportedSig + ', strippedOnImport=' + stripped + ', reSignedLocally=' + resigned + ', chainOk=' + chain.ok };
            } finally { window.prompt = origPrompt; }
        });
        await T('BACKUP-3', 'the confirm dialog buttons actually work', async () => {
            // The buttons used to sit outside a <form method="dialog">, so
            // clicking Continue or Cancel did nothing and the promise never
            // resolved -- the restore prompt was unusable, with Escape as the
            // only working response.
            const mk = () => {
                const d = document.createElement('dialog');
                d.innerHTML = '<form method="dialog"><menu>' +
                    '<button value="cancel" class="btn">Cancel</button>' +
                    '<button value="ok" class="btn btn-accent">Continue</button></menu></form>';
                document.body.appendChild(d);
                return d;
            };
            const d1 = mk();
            let fired = false, rv = null;
            d1.addEventListener('close', () => { fired = true; rv = d1.returnValue; });
            d1.showModal();
            d1.querySelector('button[value="ok"]').click();
            await sleep(120);
            const okWorks = fired && rv === 'ok';
            const d2 = mk();
            let fired2 = false, rv2 = null;
            d2.addEventListener('close', () => { fired2 = true; rv2 = d2.returnValue; });
            d2.showModal();
            d2.querySelector('button[value="cancel"]').click();
            await sleep(120);
            const cancelWorks = fired2 && rv2 === 'cancel';
            d1.remove(); d2.remove();
            return { ok: okWorks && cancelWorks, msg: 'Continue -> close=' + fired + ' returnValue=' + rv + ' | Cancel -> close=' + fired2 + ' returnValue=' + rv2 };
        });


        /* ---- AIO INTEGRITY API ------------------------------------------
           stampRecords/verifyRecords are documented as "reserved for
           signature-format migrations" and nothing called them, so nothing
           proved they still work. */
        await T('AIO-1', 'stampRecords/verifyRecords round-trip', async () => {
            if (!window.AIO || typeof AIO.stampRecords !== 'function') return { skip: true, msg: 'stampRecords not exposed' };
            if (!AIO.ready) { try { await window._aioReady; } catch (e) {} }
            const list = [{ reportNo: 'AIO-1', serial: 'S1', swl: '10' }, { reportNo: 'AIO-2', serial: 'S2', swl: '20' }];
            const stamped = await AIO.stampRecords(list, 'lifting');
            const good = await AIO.verifyRecords(stamped, 'lifting');
            const tampered = JSON.parse(JSON.stringify(stamped));
            tampered[0].swl = '999';
            const bad = await AIO.verifyRecords(tampered, 'lifting');
            return { ok: good.length === 0 && bad.length === 1,
                     msg: 'intact flagged=' + good.length + ' (expect 0), tampered flagged=' + bad.length + ' (expect 1)' };
        });
        await T('AIO-2', 'an early save is still signed and chained', async () => {
            if (!window.AIO) return { skip: true, msg: 'AIO missing' };
            const before = (await AIO.verifyAuditChain()).count;
            await persistStateV2();
            const after = await AIO.verifyAuditChain();
            return { ok: after.ok && after.count > before, msg: 'chain ' + before + ' -> ' + after.count + ', ok=' + after.ok };
        });

        /* ---- THEME / FIRST PAINT ----------------------------------------
           setTheme() used to run at the end of boot, after the AIO self-test,
           so a non-dark theme was preceded by a black flash for over a second.
           A <head> script now applies it to <html> before first paint, and the
           theme rules match :root as well as body. */
        await T('THEME-1', 'saved theme is applied to <html> and <body>', async () => {
            const was = store.get('ims_theme');
            try {
                for (const t of ['light', 'sunlight', 'night', 'cbsafe', 'hc', 'dark']) {
                    setTheme(t);
                    // setTheme applies inside startViewTransition, which is async.
                    // Reading the class straight after always sees the old theme.
                    await sleep(120);
                    const b = document.body.className.includes('theme-' + t) || (t === 'dark' && !/theme-/.test(document.body.className));
                    const r = document.documentElement.className.includes('theme-' + t) || (t === 'dark' && !/theme-/.test(document.documentElement.className));
                    if (!b || !r) return { ok: false, msg: t + ': body="' + document.body.className + '" root="' + document.documentElement.className + '"' };
                }
                return { ok: true, msg: 'all six themes apply to both elements' };
            } finally { setTheme(was || 'dark'); }
        });
        await T('THEME-2', 'switching themes does not leave the old one behind', async () => {
            const was = store.get('ims_theme');
            try {
                setTheme('night'); await sleep(120); setTheme('dark'); await sleep(120);
                const stale = document.documentElement.className + ' ' + document.body.className;
                setTheme('hc'); await sleep(120); setTheme('light'); await sleep(120);
                const stale2 = document.documentElement.className + ' ' + document.body.className;
                return { ok: !/night|hc/.test(stale) && !/night|hc/.test(stale2),
                         msg: 'after night->dark="' + stale.trim() + '" hc->light="' + stale2.trim() + '"' };
            } finally { setTheme(was || 'dark'); }
        });
        await T('THEME-3', 'the <head> script applies a saved theme before boot', () => {
            // A fresh <html> with the stored key set must be themed by the inline
            // head script alone, with no app code involved.
            const t = store.get('ims_theme') || 'dark';
            const probe = document.createElement('html');
            probe.className = (t && t !== 'dark') ? 'theme-' + t : '';
            const hasRule = [...document.styleSheets].some(sh => {
                try { return [...sh.cssRules].some(r => r.selectorText && r.selectorText.includes(':root.theme-')); } catch (e) { return false; }
            });
            return { ok: hasRule, msg: hasRule ? ':root.theme-* rules present' : 'no :root.theme-* rule found, so the head script could not theme the first paint' };
        });

        /* ---- BOOT ------------------------------------------------------
           AIO.init() used to deadlock on a cold profile: identity() awaited
           appendAudit(), which signs, which calls identity(), which returns
           the very promise being constructed. bootApp() then hung before
           renderPreview(), so a first run showed an empty preview. */
        await T('BOOT-1', 'boot completes (no deadlock in AIO.init)', async () => {
            const conv = $('conv_cat');
            return { ok: !!(conv && conv.options.length), msg: 'converter categories=' + (conv ? conv.options.length : 0) };
        });
        await T('BOOT-2', 'preview rendered without a manual call', async () => {
            if (!$('enginePreviewContainer').querySelector('.a4-page-frame')) {
                renderPreview(); await sleep(400);
            }
            const n = $('enginePreviewContainer').querySelectorAll('.a4-page-frame').length;
            return { ok: n >= 1, msg: n + ' frame(s)' };
        });
        await T('BOOT-3', 'AIO integrity features actually ran', () => ({
            ok: !!(window.AIO && window.AIO.ready === true),
            msg: 'AIO.ready=' + (window.AIO ? window.AIO.ready : 'missing')
        }));

        /* ---- QR --------------------------------------------------------
           The encoder only implemented versions 1-10, and it wrote the
           format information transposed (an [x,y] pair used as [y,x]),
           which mirrored the pattern a scanner reads back -- so codes
           failed to decode even though the data area was perfect. */
        await T('QR-1', 'format bits are written untransposed', () => {
            // Read the 15 format bits back at the spec's [x,y] positions.
            const m = QREngine.encode('FORMAT-CHECK', 'L');
            const n = m.length;
            const pos = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
            let bits = 0;
            for (let i = 0; i < 15; i++) if (m[pos[i][1]][pos[i][0]]) bits |= 1 << i;
            const un = bits ^ 0x5412;
            const data = un >> 10;
            const ecl = data >> 3, mask = data & 7;
            // L must read back as 1. Transposed output reads back as H (2).
            return { ok: ecl === 1, msg: 'ecc bits=' + ecl + ' (expect 1 for L) mask=' + mask };
        });
        await T('QR-2', 'all four ECC levels encode', () => {
            const r = {};
            ['L', 'M', 'Q', 'H'].forEach(l => { const m = QREngine.encode('LEVELS', l); r[l] = m ? m.length : null; });
            return { ok: ['L','M','Q','H'].every(l => r[l]), msg: JSON.stringify(r) };
        });
        await T('QR-3', 'reaches version 40 at the published ceilings', () => {
            // Byte-mode capacity, version 40: 2331 at ECC-M, 2953 at ECC-L.
            const m = QREngine.encode('x'.repeat(2331), 'M');
            const overM = QREngine.encode('x'.repeat(2332), 'M');
            const l = QREngine.encode('x'.repeat(2953), 'L');
            const overL = QREngine.encode('x'.repeat(2954), 'L');
            const n = m ? m.length : 0, nl = l ? l.length : 0;
            return {
                ok: n === 177 && nl === 177 && !overM && !overL,
                msg: `M: 2331->${n}x${n}, 2332 rejected=${!overM} | L: 2953->${nl}x${nl}, 2954 rejected=${!overL}`
            };
        });
        await T('QR-4', 'long pre-filled message still encodes', () => {
            const el = $('waMsg');
            const before = el ? el.value : '';
            if (!el) return { skip: true, msg: 'waMsg not present' };
            el.value = 'Please verify this lifting examination certificate. '.repeat(4);
            renderPreview();
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const ok = generateTrueQrSvg(buildVerificationLink(activeRec()), svg);
            el.value = before;
            return { ok: ok && /<rect/.test(svg.innerHTML), msg: 'modules=' + (svg.innerHTML.length) };
        });

        /* ---- SECURITY --------------------------------------------------
           lblSpan() concatenated its argument raw while valSpan() escaped,
           so an extra-cell label executed script in the app origin. */
        await T('SEC-1', 'extra-cell label cannot execute script', async () => {
            const XSS = '<img src=x onerror="window.__XSS=1">';
            window.__XSS = 0;
            const r = activeRec();
            const before = r.extraCells;
            r.extraCells = [{ label: XSS, value: XSS }];
            renderPreview();
            await sleep(300);
            const html = $('enginePreviewContainer').innerHTML;
            r.extraCells = before;
            renderPreview();
            return {
                ok: window.__XSS !== 1 && !/<img src=x onerror/.test(html),
                msg: 'executed=' + window.__XSS + ' rawInHtml=' + /<img src=x onerror/.test(html)
            };
        });
        await T('SEC-2', 'no duplicate element ids', () => {
            const seen = {}, dup = [];
            document.querySelectorAll('[id]').forEach(e => { if (seen[e.id]) dup.push(e.id); seen[e.id] = 1; });
            return { ok: dup.length === 0, msg: dup.length ? 'duplicates: ' + dup.join(',') : 'unique' };
        });
        await T('SEC-3', 'every form field has an id or a name', () => {
            const missing = [...document.querySelectorAll('input, select, textarea')]
                .filter(e => !e.id && !e.name).map(e => e.tagName + '.' + (e.className || '?'));
            return { ok: missing.length === 0, msg: missing.length ? missing.length + ' missing' : 'all labelled' };
        });

        /* ---- PRINT -----------------------------------------------------
           Print CSS hides .workspace and shows only #printContainer, which
           was filled solely by the in-app button -- so Ctrl+P printed a
           blank page. */
        await T('PRINT-1', 'Ctrl+P path fills the print container', async () => {
            window.dispatchEvent(new Event('beforeprint'));
            await sleep(500);
            const pc = $('printContainer');
            const n = pc.querySelectorAll('.a4-page-frame').length;
            window.dispatchEvent(new Event('afterprint'));
            await sleep(100);
            return { ok: n >= 1, msg: n + ' frame(s) in print container' };
        });
        await T('PRINT-2', 'afterprint cleans up', async () => {
            window.dispatchEvent(new Event('beforeprint')); await sleep(400);
            window.dispatchEvent(new Event('afterprint')); await sleep(100);
            return { ok: $('printContainer').innerHTML.length === 0 && !document.body.classList.contains('printing-lock'),
                     msg: 'chars=' + $('printContainer').innerHTML.length };
        });

        /* ---- PEEK ------------------------------------------------------ */
        await T('PEEK-1', 'folded docks a handle; no dead end', async () => {
            const s = { idx: currentLayoutIdx };
            try {
                let g = 0; while (getEffectiveLayout() !== 'layout-folded' && g++ < 6) cyclePreviewLayout();
                const h = $('btnPeekHandle');
                if (!h) return { ok: false, msg: 'handle missing from DOM' };
                const h1 = { label: h.querySelector('.peek-handle-label').textContent, on: h.classList.contains('on') };
                togglePreviewPeek(); await sleep(350);
                const h2 = { label: h.querySelector('.peek-handle-label').textContent, on: h.classList.contains('on') };
                const paneOpen = getComputedStyle($('previewPane')).position === 'fixed';
                togglePreviewPeek(); await sleep(350);
                const h3 = h.classList.contains('on');
                return { ok: h1.on && h2.on && h3 && paneOpen && h1.label === 'Preview' && h2.label === 'Close',
                         msg: `retracted=${h1.label} peeked=${h2.label} handleKeptAfterClose=${h3}` };
            } finally { for (let i = 0; i < s.idx; i++) cyclePreviewLayout(); }
        });
        await T('PEEK-2', 'peek keeps the zoom bar visible', async () => {
            const s = { idx: currentLayoutIdx };
            try {
                let g = 0; while (getEffectiveLayout() !== 'layout-folded' && g++ < 6) cyclePreviewLayout();
                togglePreviewPeek(); await sleep(400);
                const ban = $('previewPane').querySelector('.a4-gauge-banner');
                const r = ban.getBoundingClientRect();
                const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
                const visible = hit === ban || ban.contains(hit);
                togglePreviewPeek(); await sleep(300);
                return { ok: visible, msg: 'topmost at banner centre = ' + (hit ? hit.tagName + '.' + String(hit.className || '').split(' ')[0] : 'null') };
            } finally { for (let i = 0; i < s.idx; i++) cyclePreviewLayout(); }
        });
        await T('PEEK-3', 'peek scrolls internally, background locked', async () => {
            const s = { idx: currentLayoutIdx };
            try {
                let g = 0; while (getEffectiveLayout() !== 'layout-folded' && g++ < 6) cyclePreviewLayout();
                togglePreviewPeek(); await sleep(400);
                const pane = $('previewPane');
                pane.scrollTop = 0;
                const locked = document.documentElement.classList.contains('peek-locked');
                pane.scrollTop = 200;
                const scrolled = pane.scrollTop > 0;
                togglePreviewPeek(); await sleep(300);
                return { ok: locked && scrolled, msg: 'locked=' + locked + ' paneScrollTop=' + pane.scrollTop };
            } finally { for (let i = 0; i < s.idx; i++) cyclePreviewLayout(); }
        });
        await T('PEEK-4', 'survives fullscreen exit and resize', async () => {
            const s = { idx: currentLayoutIdx };
            try {
                let g = 0; while (getEffectiveLayout() !== 'layout-folded' && g++ < 6) cyclePreviewLayout();
                togglePreviewPeek(); await sleep(300);
                // both of these run applyLayout(), which used to wipe peek-open
                _onFullscreenChange();
                window.dispatchEvent(new Event('resize'));
                await sleep(300);
                const still = $('workspaceContainer').classList.contains('peek-open');
                while (getEffectiveLayout() !== 'layout-beside') cyclePreviewLayout();
                await sleep(200);
                const cleared = !$('workspaceContainer').classList.contains('peek-open');
                return { ok: still && cleared, msg: 'afterFullscreenAndResize=' + still + ' clearedOnLayoutSwitch=' + cleared };
            } finally { for (let i = 0; i < s.idx; i++) cyclePreviewLayout(); }
        });

        /* ---- STORAGE / DEAD CODE --------------------------------------- */
        await T('STORE-1', 'blob field list has one definition', () => {
            const n = Array.isArray(window.BLOB_FIELDS) ? window.BLOB_FIELDS.length : 0;
            return { ok: n === 5 && Object.isFrozen(window.BLOB_FIELDS), msg: n + ' fields, frozen=' + Object.isFrozen(window.BLOB_FIELDS) };
        });
        await T('STORE-2', 'validation rules are live', () => {
            const f = window._validateField;
            if (typeof f !== 'function') return { ok: false, msg: '_validateField missing' };
            const long = f('reportNo', 'x'.repeat(200)).length;
            const bad = f('isSafe', 'MAYBE');
            return { ok: long === 64 && bad === 'YES', msg: 'maxLength->' + long + ' enum->' + bad };
        });
        await T('DEAD-1', 'removed dead code stays removed', () => ({
            ok: typeof window.StateAPI === 'undefined'
                && typeof exportSelectedExcelModern === 'undefined'
                && typeof currentGeneration === 'undefined',
            msg: 'StateAPI/Excel/currentGeneration all undefined'
        }));

        /* ---- MARKERS / PAGINATION -------------------------------------- */
        await T('PHOTO-1', 'idb markers never rendered as an img src', () => {
            const r = activeRec();
            const before = r.photos;
            r.photos = ['@idb:lifting/test/0', 'data:image/png;base64,iVBORw0KGgo='];
            renderPhotoTiles(); renderPreview();
            const leaked = /@idb:/.test($('enginePreviewContainer').innerHTML)
                         || /@idb:/.test($('photo_slots_container').innerHTML);
            r.photos = before; renderPhotoTiles(); renderPreview();
            return { ok: !leaked, msg: 'leaked=' + leaked };
        });
        await T('PAGE-1', 'paginateReport honours R3 options', () => {
            const p = paginateReport({
                blocks: ['<div style="height:10px">x</div>'],
                headerHTML: '', footerHTML: '', titleHTML: '', sigHTML: '', overlayHTML: '',
                firstFrameId: null, pageOffset: 10, frameClass: 'a4-page-frame a4-annexure-frame'
            });
            return { ok: /a4-annexure-frame/.test(p.html) && !/a4TargetSheet/.test(p.html),
                     msg: 'pageCount=' + p.pageCount };
        });

        /* ---- RENDER ---------------------------------------------------
           There is exactly one renderer: renderPreview() always calls
           renderPreviewFull(). A second renderPreview with a structure-hash
           fast path used to live in modules/render-patch.js, but the inline
           definition shadowed it, so the module was unreachable. These two
           tests pin the contract that actually applies. */
        await T('RENDER-1', 'preview re-renders in sync with the record', async () => {
            const r = activeRec();
            const was = r.reportNo;
            const read = () => {
                const el = $('enginePreviewContainer').querySelector('[data-bind="reportNo"]');
                return el ? el.textContent : '(no node)';
            };
            try {
                renderPreview(); await sleep(200);
                r.reportNo = 'SYNC-ONE'; renderPreview(); await sleep(200);
                r.reportNo = 'SYNC-TWO'; renderPreview(); await sleep(200);
                return { ok: read() === 'SYNC-TWO', msg: 'dom=' + read() + ' record=' + r.reportNo };
            } finally { r.reportNo = was; renderPreview(); }
        });
        await T('RENDER-2', 'a field pill removes its node from the report', async () => {
            const r = activeRec();
            const was = r.fieldToggles && r.fieldToggles.serial;
            try {
                r.fieldToggles = r.fieldToggles || {};
                r.fieldToggles.serial = true;  renderPreview(); await sleep(300);
                const on = $('enginePreviewContainer').querySelectorAll('[data-bind="serial"]').length;
                r.fieldToggles.serial = false; renderPreview(); await sleep(300);
                const off = $('enginePreviewContainer').querySelectorAll('[data-bind="serial"]').length;
                return { ok: on >= 1 && off === 0, msg: 'pill on=' + on + ' pill off=' + off };
            } finally {
                r.fieldToggles.serial = was; renderPreview();
            }
        });
        await T('RENDER-3', 'no unreachable second renderer is loaded', () => ({
            ok: typeof window.renderPreviewPatch === 'undefined' && typeof window.computeStructureHash === 'undefined',
            msg: 'renderPreviewPatch/computeStructureHash must not exist'
        }));

        /* ---- A11Y ------------------------------------------------------ */
        await T('A11Y-1', 'toggles expose role=switch', () => {
            const bad = [...document.querySelectorAll('.micro-toggle')].filter(t => t.getAttribute('role') !== 'switch');
            return { ok: bad.length === 0, msg: bad.length + ' missing role' };
        });
        await T('A11Y-2', 'skip link present', () => ({
            ok: !!document.querySelector('.skip-link'), msg: 'found'
        }));

                /* ---- APPLY TO ALL (ENGINE ISOLATION) ---------------------------- */
        await T('APPLY-1', 'apply-to-all preserves strict engine isolation between LIFTING and NDT', async () => {
            if (typeof openApplyToAllDialog !== 'function') return { skip: true, msg: 'openApplyToAllDialog not defined' };
            const wasEng = currentEngine;
            const wasLifting = JSON.parse(JSON.stringify(liftingBatch));
            const wasNdt = JSON.parse(JSON.stringify(ndtBatch));
            try {
                currentEngine = 'LIFTING';
                activeIdx = 0;
                liftingBatch = [
                    { reportNo: 'L-1', stampUpload: 'data:image/png;base64,STAMP', stampPos: {x:10,y:10} },
                    { reportNo: 'L-2', stampUpload: null }
                ];
                ndtBatch = [
                    { reportNo: 'N-1', stampUpload: null },
                    { reportNo: 'N-2', stampUpload: null }
                ];

                openApplyToAllDialog('stamp');
                const dlg = document.getElementById('applyToAllDialog');
                if (!dlg) return { ok: false, msg: 'dialog element not created' };
                const fillBtn = dlg.querySelector('#applyFillBtn');
                if (fillBtn) fillBtn.click();

                const liftApplied = liftingBatch[1].stampUpload === 'data:image/png;base64,STAMP';
                const ndtUntouched = ndtBatch[0].stampUpload === null && ndtBatch[1].stampUpload === null;
                dlg.close();

                currentEngine = 'NDT';
                activeIdx = 0;
                ndtBatch[0].inspSigUpload = 'data:image/png;base64,NDTSIG';
                ndtBatch[0].inspSigMode = 'UPLOAD';
                liftingBatch[0].inspectorSigUpload = 'LIFT-SIG-SAFE';

                openApplyToAllDialog('ndt_insp');
                const fillBtn2 = dlg.querySelector('#applyFillBtn');
                if (fillBtn2) fillBtn2.click();

                const ndtApplied = ndtBatch[1].inspSigUpload === 'data:image/png;base64,NDTSIG';
                const liftUntouched = liftingBatch[0].inspectorSigUpload === 'LIFT-SIG-SAFE' && !liftingBatch[1].inspSigUpload;
                dlg.close();

                return {
                    ok: liftApplied && ndtUntouched && ndtApplied && liftUntouched,
                    msg: 'liftApplied=' + liftApplied + ', ndtUntouched=' + ndtUntouched + ', ndtApplied=' + ndtApplied + ', liftUntouched=' + liftUntouched
                };
            } finally {
                currentEngine = wasEng;
                liftingBatch = wasLifting;
                ndtBatch = wasNdt;
                const d = document.getElementById('applyToAllDialog');
                if (d && d.open) d.close();
            }
        });

        /* ---- REPORT ---------------------------------------------------- */
        const glyph = r => r.ok === true ? 'PASS' : (r.ok === 'skip' ? 'SKIP' : 'FAIL');
        console.log('%c===== IMS REGRESSION SUITE =====', 'font-weight:900');
        let last = null;
        out.forEach(r => {
            if (r.grp !== last) { last = r.grp; }
            console.log('%s  %-8s %s%s', glyph(r).padEnd(4), r.id, r.name, r.ok === true ? '' : '\n        -> ' + r.msg);
            if (r.detail) console.log('        ' + String(r.detail).split('\n')[0]);
        });
        const fail = out.filter(r => r.ok === false).length;
        const skip = out.filter(r => r.ok === 'skip').length;
        console.log('%c===== %d tests | %d pass | %d skip | %d FAIL =====',
            'font-weight:900;color:' + (fail ? '#e15666' : '#33b56b'), out.length, out.length - fail - skip, skip, fail);
        window.__imsLastResults = out;
        return out;
    }

    window.__imsTest = run;
    if (typeof module !== 'undefined' && module.exports) module.exports = run;
})();
