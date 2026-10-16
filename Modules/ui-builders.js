				/* UTILITIES */
				function activeRec() { return currentEngine === 'LIFTING' ? (liftingBatch[activeIdx] || {}) : (ndtBatch[activeIdx] || {}); }

				function showPreviewError(e) {
					const c = document.getElementById('enginePreviewContainer');
					if (c) c.innerHTML = '<div style="width:100%;max-width:794px;background:var(--surface);border:1px solid var(--fail);padding:10px;font-family:var(--font-data);">PREVIEW ERROR: ' + ((e && e.message) || e) + '</div>';
				}

				function showToast(m, t) {
					t = t || 'info';
					try {
						let c = document.getElementById('toastContainer');
						if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; c.className = 'toast-container'; document.body.appendChild(c); }
						const d = document.createElement('div');
						d.className = 'toast-item toast-' + t;
						d.setAttribute('role', 'status');
						d.innerHTML = '<span>' + m + '</span>';
						c.appendChild(d);
						requestAnimationFrame(() => d.classList.add('show'));
						setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 150); }, 2600);
					} catch (e) {}
				}

				function setSaveIndicator(s) {
					const i = document.getElementById('saveIndicator');
					if (!i) return;
					if (s === 'dirty') i.textContent = '● UNSAVED';
					else {
						const t = new Date();
						i.textContent = 'SAVED ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
					}
				}

				function sanitizeForReport(t) {
					if (t === null || t === undefined) return '';
					return String(t)
						.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
						.replace(/\+\+/g, '<br>').replace(/\r?\n/g, '<br>');
				}
				// HTML-attribute escaper. Escapes every character that can break
				// out of a quoted attribute value. Order matters: `&` first.
				function attrEsc(t) {
					if (t === null || t === undefined) return '';
					return String(t)
						.replace(/&/g, '&amp;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#39;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;');
				}

				function buildColspanRow(cells, total) {
					if (!cells || !cells.length) return '';
					const clean = cells.filter(c => c !== '' && c !== null && c !== undefined);
					if (!clean.length) return '';
					const base = Math.floor(total / clean.length);
					let rem = total - (base * clean.length), out = '<tr>';
					for (let i = 0; i < clean.length; i++) out += '<td colspan="' + (base + (i < rem ? 1 : 0)) + '">' + clean[i] + '</td>';
					return out + '</tr>';
				}

				function normRow(cells, total) {
					if (!cells || !cells.length) return '';
					let sum = 0; cells.forEach(c => sum += c.s);
					if (sum < total) cells[cells.length - 1].s += total - sum;
					else if (sum > total) { let over = sum - total; for (let i = cells.length - 1; i >= 0 && over > 0; i--) { const t = Math.min(cells[i].s - 1, over); cells[i].s -= t; over -= t; } cells = cells.filter(c => c.s > 0); }
					if (!cells.length) return '';
					return '<tr>' + cells.map(c => '<td colspan="' + c.s + '">' + c.h + '</td>').join('') + '</tr>';
				}

				// Escapes, to match valSpan. It used to concatenate raw, so any
				// caller passing user data got script execution in the preview —
				// extraCells[].label was the live path. Escape here so the 67
				// literal call sites keep working and no future one can be a hole.
				function lblSpan(t, s) { return '<span class="lbl"' + (s ? ' style="' + attrEsc(s) + '"' : '') + '>' + sanitizeForReport(t) + '</span>'; }
				function valRaw(k,h,s,m){return '<span class="val'+(m?' mono':'')+'" data-bind="'+k+'" contenteditable="true" onblur="handleLiveInlineEdit(\''+k+'\', this.innerText)"'+(s?' style="'+s+'"':'')+'>'+h+'</span>'}
				function valSpan(k, v, s, m) { return valRaw(k, sanitizeForReport(v || ''), s, m); }

				/* FEATURE PILLS */
				const FEATURE_PILLS = { qr: ['pill_qrEngine', 'QR'], corp: ['pill_corpBanners', 'BANNERS'], overlays: ['pill_overlays', 'OVERLAYS'] };

				function toggleFeature(k) {
					featureToggles[k] = !featureToggles[k];
					updateFeaturePills();
					debouncedSync();
					showToast(FEATURE_PILLS[k][1] + ' ' + (featureToggles[k] ? 'ON' : 'OFF'), 'info');
				}
				/* KEYBOARD SHORTCUTS HELP */
				function showHotkeys() { showAppGuidance(); }
				function showAppGuidance() {
					const dialog = document.createElement('dialog');
					dialog.style.cssText =
						'background:var(--surface);color:var(--ink);border:1px solid var(--hairline);' +
						'border-radius:10px;padding:0;max-width:min(94vw,680px);width:100%;' +
						'font-family:var(--app-font-family);max-height:90vh;display:flex;flex-direction:column;' +
						'z-index:200001;position:fixed;top:30px;left:50%;transform:translateX(-50%);box-shadow:var(--shadow-3);';
					const sec = (t, icon) =>
						'<div style="padding:14px 0 6px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:var(--ui-font-xs);color:var(--accent);display:flex;align-items:center;gap:6px;">' +
						(icon || '📌') + ' ' + t + '</div>';
					const p = t => '<p style="margin:0 0 8px;line-height:1.45;font-size:var(--ui-font-sm);color:var(--ink);">' + t + '</p>';
					const row = (k, d) =>
						'<tr><td style="font-family:var(--font-data);font-weight:700;padding:5px 8px;background:var(--cell);border:1px solid var(--hairline);border-radius:4px;white-space:nowrap;width:1%;font-size:11px;">' + k + '</td><td style="padding:5px 8px;vertical-align:middle;font-size:12px;">' + d + '</td></tr>';

					dialog.innerHTML =
						'<div style="padding:14px 18px;border-bottom:1px solid var(--hairline);display:flex;justify-content:space-between;align-items:center;background:var(--panel);border-radius:10px 10px 0 0;">' +
							'<div style="font-weight:800;font-size:var(--ui-font-md);display:flex;align-items:center;gap:8px;">📘 App Guidance, Hotkeys & User Manual</div>' +
							'<button class="btn btn-accent" id="hkClose" style="padding:4px 12px;font-size:12px;">✕ Close</button>' +
						'</div>' +
						'<div style="padding:16px 20px;overflow-y:auto;flex:1;">' +
							sec('Text Field Power Formatting (++ Hotkey)', '⚡') +
							p('<strong>Multiline Split:</strong> Type <code>++</code> anywhere in a text field (such as Client, Premises, Description, or Defects) to force a clean <strong>line break</strong> on the generated A4 certificate.') +
							p('<em>Example:</em> Typing <code>Belayim Petroleum Co.++Cairo, Egypt</code> prints as:<br>' +
							  '<div style="margin:4px 0 8px 12px;padding:6px 10px;background:var(--cell);border-left:3px solid var(--accent);font-size:12px;border-radius:2px;">Belayim Petroleum Co.<br>Cairo, Egypt</div>') +

							sec('Keyboard Shortcuts (Hotkeys)', '⌨') +
							'<table style="width:100%;border-collapse:separate;border-spacing:0 4px;margin-bottom:12px;">' +
								row('++', 'Insert line break in report text fields (splits into multiple lines on certificate)') +
								row('Ctrl + B', 'Save an encrypted safety backup (.imsbak file)') +
								row('Ctrl + S', 'Force save changes right now') +
								row('Ctrl + P', 'Print or Export A4 certificate to PDF immediately') +
								row('Alt + ← / →', 'Navigate to Previous / Next inspection record in batch') +
								row('Esc', 'Close any open modal dialog or full-screen photo viewer') +
							'</table>' +

							sec('How Report Number Sequence Works (Industry Standard)', '🔢') +
							p('In leading global inspection bodies (<strong>LEEA</strong>, <strong>Bureau Veritas</strong>, <strong>DNV</strong>, <strong>SGS</strong>):') +
							'<ul style="margin:0 0 10px 18px;padding:0;font-size:var(--ui-font-sm);line-height:1.45;">' +
								'<li><strong>Default Structure:</strong> <code>[PREFIX]-[YYYYMMDD]-0[SEQ]</code> (e.g. <code>LFT-20261012-01</code> for Lifting, <code>NDT-20261012-01</code> for NDT).</li>' +
								'<li><strong>Custom Pattern Setup:</strong> In <em>Settings / ISO Document Control</em>, customize the <strong>No. Format</strong> cell with tokens: <code>{PREFIX}</code>, <code>{DATE}</code>, <code>{YEAR}</code>, <code>{SEQ}</code>.</li>' +
								'<li><strong>Per-Record Override:</strong> Editing the Report Number in the active record form overrides only that designated record without altering the sequence or other records in your batch.</li>' +
								'<li><strong>Auto-Increment:</strong> Adding or cloning records automatically increments the numeric sequence (+1) from the highest existing record.</li>' +
							'</ul>' +

							sec('Key Controls & ON / OFF Toggles', '🎛') +
							p('Every form box has a compact <span style="display:inline-block;padding:1px 5px;background:var(--accent);color:#fff;border-radius:10px;font-size:9px;font-weight:bold;">● ON</span> toggle. Click it anytime to hide or show that section in the final printable report without losing your input.') +

							sec('Designer Asset Dimensions & Guidelines', '🎨') +
							p('Detailed physical and pixel dimensions for design teams preparing custom institutional overlays:') +
							'<table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px;border:1px solid var(--hairline);">' +
								'<tr style="background:var(--panel);font-weight:700;"><th style="padding:6px;border:1px solid var(--hairline);text-align:left;">Asset</th><th style="padding:6px;border:1px solid var(--hairline);text-align:left;">Aspect Ratio</th><th style="padding:6px;border:1px solid var(--hairline);text-align:left;">Recommended (300 DPI)</th><th style="padding:6px;border:1px solid var(--hairline);text-align:left;">Physical A4 Size</th><th style="padding:6px;border:1px solid var(--hairline);text-align:left;">Format</th></tr>' +
								'<tr><td style="padding:6px;border:1px solid var(--hairline);font-weight:700;">Header Banner</td><td style="padding:6px;border:1px solid var(--hairline);">~11:1 (wide band)</td><td style="padding:6px;border:1px solid var(--hairline);"><strong>1500 &times; 140 px</strong></td><td style="padding:6px;border:1px solid var(--hairline);">194 &times; 18 mm (max height 70px)</td><td style="padding:6px;border:1px solid var(--hairline);">PNG / SVG / JPEG</td></tr>' +
								'<tr><td style="padding:6px;border:1px solid var(--hairline);font-weight:700;">Footer Band</td><td style="padding:6px;border:1px solid var(--hairline);">~17:1 (slim band)</td><td style="padding:6px;border:1px solid var(--hairline);"><strong>1500 &times; 90 px</strong></td><td style="padding:6px;border:1px solid var(--hairline);">194 &times; 12 mm (max height 46px)</td><td style="padding:6px;border:1px solid var(--hairline);">PNG / SVG / JPEG</td></tr>' +
								'<tr><td style="padding:6px;border:1px solid var(--hairline);font-weight:700;">Company Logo</td><td style="padding:6px;border:1px solid var(--hairline);">~2.7:1 to 1:1</td><td style="padding:6px;border:1px solid var(--hairline);"><strong>500 &times; 180 px</strong></td><td style="padding:6px;border:1px solid var(--hairline);">Movable & Resizable (Free or Locked)</td><td style="padding:6px;border:1px solid var(--hairline);">Transparent PNG / SVG</td></tr>' +
								'<tr><td style="padding:6px;border:1px solid var(--hairline);font-weight:700;">Official Stamp / Seal</td><td style="padding:6px;border:1px solid var(--hairline);">1:1 (square/circle)</td><td style="padding:6px;border:1px solid var(--hairline);"><strong>400 &times; 400 px</strong></td><td style="padding:6px;border:1px solid var(--hairline);">Movable & Resizable (75&times;75 px default)</td><td style="padding:6px;border:1px solid var(--hairline);">Transparent PNG / SVG</td></tr>' +
								'<tr><td style="padding:6px;border:1px solid var(--hairline);font-weight:700;">Accreditation Badges</td><td style="padding:6px;border:1px solid var(--hairline);">1.5:1 to 1:1</td><td style="padding:6px;border:1px solid var(--hairline);"><strong>300 &times; 200 px</strong></td><td style="padding:6px;border:1px solid var(--hairline);">Movable & Resizable (55&times;36 px default)</td><td style="padding:6px;border:1px solid var(--hairline);">Transparent PNG / SVG</td></tr>' +
							'</table>' +
							p('<em>Tip:</em> Use high-contrast transparent PNGs with no solid outer margins for crisp rendering on statutory white paper.') +

							sec('What is this app? (Simple Overview)', '🚀') +
							p('A standalone, offline-first digital inspection clipboard. Create LOLER & NDT certificates, capture live signatures, attach proof photos, generate instant QR verification links, and export pristine A4 reports.') +
						'</div>';

					document.body.appendChild(dialog);
					dialog.querySelector('#hkClose').onclick = () => { dialog.close(); dialog.remove(); };
					dialog.addEventListener('close', () => dialog.remove());
					dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
					dialog.showModal();
				}

				function updateFeaturePills() {
					Object.keys(FEATURE_PILLS).forEach(k => {
						const p = document.getElementById(FEATURE_PILLS[k][0]);
						if (!p) return;
						const on = featureToggles[k] !== false;
						p.className = 'micro-toggle ' + (on ? 'on' : 'off');
						p.innerHTML = '<span class="toggle-dot"></span>' + FEATURE_PILLS[k][1] + ': ' + (on ? 'ON' : 'OFF');
						p.setAttribute('aria-checked', on ? 'true' : 'false');
					});
				}

				/* DOC CONTROL */
				function readDocControl() {
					const g = id => document.getElementById(id);
					const v = (id1, id2, fallback) => {
						const e1 = g(id1), e2 = g(id2);
						if (e1 && document.activeElement === e1) return e1.value;
						if (e2 && document.activeElement === e2) return e2.value;
						if (e1 && e1.value) return e1.value;
						if (e2 && e2.value) return e2.value;
						return fallback;
					};
					docControl.docNo = v('in_main_docNo', 'dc_docNo', docControl.docNo || 'QMS-CERT-LOLER-044');
					docControl.rev = v('in_main_docRev', 'dc_rev', docControl.rev || '03');
					docControl.revDate = v('in_main_docRevDate', 'dc_revDate', docControl.revDate || '2026-01-15');
					if (g('dc_reportNoPattern')) docControl.reportNoPattern = g('dc_reportNoPattern').value;

					// Mirror values to both inputs if not currently focused
					const syncPair = (id1, id2, val) => {
						const e1 = g(id1), e2 = g(id2);
						if (e1 && document.activeElement !== e1) e1.value = val || '';
						if (e2 && document.activeElement !== e2) e2.value = val || '';
					};
					syncPair('in_main_docNo', 'dc_docNo', docControl.docNo);
					syncPair('in_main_docRev', 'dc_rev', docControl.rev);
					syncPair('in_main_docRevDate', 'dc_revDate', docControl.revDate);

					return docControl;
				}
				function toggleDocControl() {
					docControl.on = !docControl.on;
					['pill_docControl', 'pill_main_docControl', 'pill_ndt_main_docControl'].forEach(id => {
						const p = document.getElementById(id);
						if (p) {
							p.className = 'micro-toggle ' + (docControl.on ? 'on' : 'off');
							p.innerHTML = '<span class="toggle-dot"></span>' + (docControl.on ? 'ON' : 'OFF');
						}
					});
					debouncedSync();
				}
				function handleDocControlLiveEdit(field, val) {
					const clean = (val || '');
					docControl[field] = clean;
					const g = id => document.getElementById(id);
					if (field === 'docNo') {
						if (g('in_main_docNo')) g('in_main_docNo').value = clean;
						if (g('dc_docNo')) g('dc_docNo').value = clean;
					} else if (field === 'rev') {
						if (g('in_main_docRev')) g('in_main_docRev').value = clean;
						if (g('dc_rev')) g('dc_rev').value = clean;
					} else if (field === 'revDate') {
						if (g('in_main_docRevDate')) g('in_main_docRevDate').value = clean;
						if (g('dc_revDate')) g('dc_revDate').value = clean;
					}
					if (typeof schedulePersist === 'function') schedulePersist();
					debouncedSync();
				}
				function docControlStrip(p, t) {
					const d = readDocControl();
					if (!d.on) return '';
					return '<table class="ctbl dc-strip"><colgroup><col style="width:64%"><col style="width:36%"></colgroup><tr><td>' +
						'<span class="dc-l">File:</span> <span class="val mono" contenteditable="true" onblur="handleDocControlLiveEdit(\'docNo\', this.innerText)" title="Click to edit Document No">' + sanitizeForReport(d.docNo) + '</span> ' +
						'<span class="dc-l">Rev:</span> <span class="val mono" contenteditable="true" onblur="handleDocControlLiveEdit(\'rev\', this.innerText)" title="Click to edit Revision">' + sanitizeForReport(d.rev) + '</span> ' +
						'<span class="dc-l">Date:</span> <span class="val mono" contenteditable="true" onblur="handleDocControlLiveEdit(\'revDate\', this.innerText)" title="Click to edit Rev Date">' + sanitizeForReport(d.revDate) + '</span> ' +
						'<span class="dc-l">Status:</span> Controlled</td><td style="text-align:right;"><span class="dc-l">Page</span> ' + p + ' of ' + t + '</td></tr></table>';
				}

				/* CORP INFO */
				function readCorpInfo() {
					const g = id => document.getElementById(id);
					const v = (id1, id2, fallback) => {
						const e1 = g(id1), e2 = g(id2);
						if (e1 && document.activeElement === e1) return e1.value;
						if (e2 && document.activeElement === e2) return e2.value;
						if (e1 && e1.value) return e1.value;
						if (e2 && e2.value) return e2.value;
						return fallback;
					};
					if (g('ci_body')) corpInfo.body = g('ci_body').value;
					if (g('ci_accred')) corpInfo.accred = g('ci_accred').value;
					if (g('ci_addr')) corpInfo.addr = g('ci_addr').value;
					if (g('ci_phone')) corpInfo.phone = g('ci_phone').value;
					if (g('ci_email')) corpInfo.email = g('ci_email').value;
					if (g('ci_web')) corpInfo.web = g('ci_web').value;
					corpInfo.footnote = v('in_main_footnote', 'ci_footnote', corpInfo.footnote || '');

					const syncPair = (id1, id2, val) => {
						const e1 = g(id1), e2 = g(id2);
						if (e1 && document.activeElement !== e1) e1.value = val || '';
						if (e2 && document.activeElement !== e2) e2.value = val || '';
					};
					syncPair('in_main_footnote', 'ci_footnote', corpInfo.footnote);

					return corpInfo;
				}
				function handleFootnoteLiveEdit(val) {
					const clean = (val || '');
					corpInfo.footnote = clean;
					const g = id => document.getElementById(id);
					if (g('in_main_footnote')) g('in_main_footnote').value = clean;
					if (g('ci_footnote')) g('ci_footnote').value = clean;
					if (typeof schedulePersist === 'function') schedulePersist();
					debouncedSync();
				}
				function composedHeader() {
					const c = readCorpInfo();
					return '<div class="corp-header"><div><div class="ch-name">' + sanitizeForReport(c.body) + '</div><div class="ch-accred">' + sanitizeForReport(c.accred) + '</div></div><div class="ch-right">' + sanitizeForReport(c.addr) + '<br>Tel ' + sanitizeForReport(c.phone) + ' · ' + sanitizeForReport(c.email) + '<br>' + sanitizeForReport(c.web) + '</div></div>';
				}
				function composedFooter() {
					const c = readCorpInfo();
					return '<div class="corp-footer"><span class="val" contenteditable="true" onblur="handleFootnoteLiveEdit(this.innerText)" title="Click to edit accreditation conditions disclaimer">' + sanitizeForReport(c.footnote) + '</span><br><strong>' + sanitizeForReport(c.body) + '</strong> · ' + sanitizeForReport(c.accred) + '</div>';
				}
				function resolveHeader() {
					if (featureToggles.overlays !== false && assets.headerBanner && assets.headerBannerEnabled !== false) {
						let hStyle = assets.headerBannerHeight ? ('height:' + assets.headerBannerHeight + 'px;max-height:none;') : '';
						if (assets.headerBannerBleed) {
							hStyle += 'margin-left:-8mm;margin-right:-8mm;margin-top:-6mm;width:calc(100% + 16mm);max-width:none;border-radius:0;';
						}
						return '<div class="reserved-header-banner" style="border:none;' + hStyle + '"><img src="' + assets.headerBanner + '"></div>';
					}
					if (featureToggles.corp !== false) return composedHeader();
					return '';
				}
				function resolveFooter() {
					if (featureToggles.overlays !== false && assets.footerBanner && assets.footerBannerEnabled !== false) {
						let fStyle = assets.footerBannerHeight ? ('height:' + assets.footerBannerHeight + 'px;max-height:none;') : '';
						if (assets.footerBannerBleed) {
							fStyle += 'margin-left:-8mm;margin-right:-8mm;margin-bottom:-6mm;width:calc(100% + 16mm);max-width:none;border-radius:0;';
						}
						return '<div class="reserved-footer-banner" style="border:none;' + fStyle + '"><img src="' + assets.footerBanner + '"></div>';
					}
					if (featureToggles.corp !== false) return composedFooter();
					return '';
				}


				/* DYNAMIC CELL BUILDERS */
				function renderExtraCellBuilder() {
					const b = document.getElementById('extraCellList'); if (!b) return;
					const r = liftingBatch[activeIdx]; const l = (r && r.extraCells) || [];
					b.innerHTML = l.map((c, i) =>
						'<div style="display:flex;gap:4px;margin-bottom:4px;">' +
						'<input name="extraCellLabel_' + i + '" value="' + attrEsc(c.label) + '" style="flex:1;" oninput="liftingBatch[activeIdx].extraCells[' + i + '].label=this.value;debouncedSync();">' +
						'<input name="extraCellValue_' + i + '" value="' + attrEsc(c.value) + '" style="flex:2;" oninput="liftingBatch[activeIdx].extraCells[' + i + '].value=this.value;debouncedSync();">' +
						'<button class="btn btn-danger" style="padding:3px 6px;" onclick="liftingBatch[activeIdx].extraCells.splice(' + i + ',1);renderExtraCellBuilder();debouncedSync();">&times;</button>' +
						'</div>'
					).join('');
				}
				function addExtraCell() { const r = liftingBatch[activeIdx]; if (!r) return; if (!r.extraCells) r.extraCells = []; r.extraCells.push({ label: 'NOTE ' + (r.extraCells.length + 1), value: '' }); renderExtraCellBuilder(); debouncedSync(); }
				function handleExtraCellEdit(i, v) { const r = liftingBatch[activeIdx]; if (r && r.extraCells && r.extraCells[i]) { r.extraCells[i].value = v.trim(); renderExtraCellBuilder(); schedulePersist(); } }

				function renderNdtExtraCellBuilder() {
					const b = document.getElementById('ndtExtraCellList'); if (!b) return;
					const r = ndtBatch[activeIdx]; const l = (r && r.extraCells) || [];
					b.innerHTML = l.map((c, i) =>
						'<div style="display:flex;gap:4px;margin-bottom:4px;">' +
						'<input name="ndtExtraCellLabel_' + i + '" value="' + attrEsc(c.label) + '" style="flex:1;" oninput="ndtBatch[activeIdx].extraCells[' + i + '].label=this.value;debouncedSync();">' +
						'<input name="ndtExtraCellValue_' + i + '" value="' + attrEsc(c.value) + '" style="flex:2;" oninput="ndtBatch[activeIdx].extraCells[' + i + '].value=this.value;debouncedSync();">' +
						'<button class="btn btn-danger" style="padding:3px 6px;" onclick="ndtBatch[activeIdx].extraCells.splice(' + i + ',1);renderNdtExtraCellBuilder();debouncedSync();">&times;</button>' +
						'</div>'
					).join('');
				}
				function addNdtExtraCell() { const r = ndtBatch[activeIdx]; if (!r) return; if (!r.extraCells) r.extraCells = []; r.extraCells.push({ label: 'NDT NOTE ' + (r.extraCells.length + 1), value: '' }); renderNdtExtraCellBuilder(); debouncedSync(); }
				function handleNdtExtraCellEdit(i, v) { const r = ndtBatch[activeIdx]; if (r && r.extraCells && r.extraCells[i]) { r.extraCells[i].value = v.trim(); renderNdtExtraCellBuilder(); schedulePersist(); } }

				/* PUWER BUILDER */
				function renderPuwerBuilder() {
					const b = document.getElementById('puwerRowList'); if (!b) return;
					const r = liftingBatch[activeIdx]; if (!r) return;
					if (!r.puwerRows) r.puwerRows = defaultPuwerRows();
					b.innerHTML = r.puwerRows.map((row, i) =>
						'<div class="puwer-row-edit">' +
						'<input class="mono" name="puwerRef_' + i + '" value="' + attrEsc(row.ref) + '" oninput="liftingBatch[activeIdx].puwerRows[' + i + '].ref=this.value;debouncedSync();">' +
						'<input name="puwerItem_' + i + '" value="' + attrEsc(row.item) + '" oninput="liftingBatch[activeIdx].puwerRows[' + i + '].item=this.value;debouncedSync();">' +
						'<select name="puwerResult_' + i + '" onchange="liftingBatch[activeIdx].puwerRows[' + i + '].result=this.value;debouncedSync();">' +
						'<option value="PASS"' + (row.result === 'PASS' ? ' selected' : '') + '>PASS</option>' +
						'<option value="FAIL"' + (row.result === 'FAIL' ? ' selected' : '') + '>FAIL</option>' +
						'<option value="N/A"' + (row.result === 'N/A' ? ' selected' : '') + '>N/A</option>' +
						'</select>' +
						'<input class="pwe-note" name="puwerNote_' + i + '" placeholder="Findings" value="' + attrEsc(row.note) + '" oninput="liftingBatch[activeIdx].puwerRows[' + i + '].note=this.value;debouncedSync();">' +
						'<button class="btn btn-danger pwe-del" onclick="removePuwerRow(' + i + ')">&times;</button>' +
						'</div>'
					).join('');
				}
				function addPuwerRow() { const r = liftingBatch[activeIdx]; if (!r) return; if (!r.puwerRows) r.puwerRows = defaultPuwerRows(); r.puwerRows.push({ ref: 'Reg —', item: 'New requirement', result: 'PASS', note: '' }); renderPuwerBuilder(); debouncedSync(); }
				function removePuwerRow(i) { const r = liftingBatch[activeIdx]; if (!r || !r.puwerRows) return; r.puwerRows.splice(i, 1); renderPuwerBuilder(); debouncedSync(); }

				/* PERSISTENCE */
				function schedulePersist() {
					if (saveTimer) clearTimeout(saveTimer);
					saveTimer = setTimeout(() => {
						persistStateV2().catch(err => {
							console.error('[autosave]', err);
							if (typeof showToast === 'function') showToast('Autosave failed: ' + err.message, 'error');
						});
					}, 600);
				}

				/* WORKFLOW CHECKS */
				function runWorkflowChecks() {
					const box = document.getElementById('workflowAlerts'); if (!box) return;
					const m = [], today = todayISO();
					if (currentEngine === 'LIFTING') {
						const r = liftingBatch[activeIdx] || {};
						if (r.dangerImm === 'YES' && r.isSafe === 'YES') m.push({ c: 1, t: 'CONFLICT: danger YES but safe YES.' });
						if (r.q_int6m === 'YES' && r.q_int12m === 'YES') m.push({ c: 1, t: 'CONFLICT: 6m and 12m both YES.' });
						if (r.examDate && r.nextExamDate && r.nextExamDate <= r.examDate) m.push({ c: 1, t: 'DATE ERROR: next due <= exam date.' });
						if (!r.reportNo) m.push({ c: 0, t: 'MISSING report number.' });
						if (!r.examinerName) m.push({ c: 0, t: 'MISSING competent person.' });
						if (r.includePuwer === true && (!r.puwerRows || !r.puwerRows.length)) m.push({ c: 0, t: 'PUWER annexure ON but empty.' });
					} else {
						const r = ndtBatch[activeIdx] || {}, tg = r.fieldToggles || {};
						if (!r.reportNo) m.push({ c: 0, t: 'MISSING NDT report number.' });
						if (tg.certExpiry !== false && r.certExpiry && r.certExpiry < today) m.push({ c: 1, t: 'CERTIFICATION EXPIRED.' });
						if (tg.calDue !== false && r.calDue && r.calDue < today) m.push({ c: 1, t: 'CALIBRATION OVERDUE.' });
						const st = parseFloat(r.surfaceTemp);
						if (tg.surfaceTemp !== false && !isNaN(st) && (st < 10 || st > 50)) m.push({ c: 0, t: 'Surface temp outside 10–50°C window.' });
						if (tg.acceptCriteria !== false && !r.acceptCriteria) m.push({ c: 0, t: 'MISSING acceptance criteria.' });
					}
					box.innerHTML = m.map(x => '<div class="workflow-alert' + (x.c ? ' crit' : '') + '" role="status">' + (x.c ? '⛔ ' : '⚠ ') + x.t + '</div>').join('');
					box.style.display = m.length ? 'flex' : 'none';
				}

				/* ACCESSIBILITY */
				function enhanceAccessibility() {
					document.querySelectorAll('.micro-toggle').forEach(p => {
						p.setAttribute('role', 'switch');
						p.setAttribute('tabindex', '0');
						if (!p.hasAttribute('aria-checked')) p.setAttribute('aria-checked', p.classList.contains('on') ? 'true' : 'false');
					});
					document.addEventListener('pointerdown', e => {
						if (!e.target.closest('.overlay-box')) {
							document.querySelectorAll('.overlay-box.is-selected').forEach(x => x.classList.remove('is-selected'));
						}
					});
					document.addEventListener('keydown', e => {
						if (e.key === 'Escape') {
							if (viewerOpen()) { closePhotoViewer(); return; }
							const sel = document.querySelectorAll('.overlay-box.is-selected');
							if (sel.length) {
								sel.forEach(x => x.classList.remove('is-selected'));
								return;
							}
						}
						if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
							e.preventDefault();
							persistStateV2().then(() => showToast('Saved.', 'success'));
							return;
						}
						if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); printSelectedBatch(); return; }
						const el = document.activeElement;
						const tag = el ? el.tagName : '';
						const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
						if (el && el.classList && el.classList.contains('micro-toggle') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); return; }
						if (e.altKey && !editing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); stepBatch(e.key === 'ArrowLeft' ? -1 : 1); }
					});
				}

				/* IMAGE COMPRESSION & VIEWER */
				function compressImageUpload(file, mw, mh, q) {
					mw = mw || 1000; mh = mh || 1000; q = q || 0.75;
					return new Promise((res, rej) => {
						const rd = new FileReader();
						rd.onload = e => {
							const img = new Image();
							img.onload = () => {
								let w = img.width, h = img.height;
								if (w > mw || h > mh) {
									if (w > h) { h = Math.round(h * mw / w); w = mw; }
									else { w = Math.round(w * mh / h); h = mh; }
								}
								const c = document.createElement('canvas');
								c.width = w; c.height = h;
								c.getContext('2d').drawImage(img, 0, 0, w, h);
								res(c.toDataURL('image/jpeg', q));
							};
							img.onerror = rej;
							img.src = e.target.result;
						};
						rd.onerror = rej;
						rd.readAsDataURL(file);
					});
				}
				function dataUrlKB(d) { return d ? Math.max(1, Math.round(d.length * 3 / 4 / 1024)) : 0; }
				function viewerOpen() { return viewerState.type !== 'none'; }
				function showViewer(src, cap) {
					const dlg = document.getElementById('photoViewer');
					const img = document.getElementById('pvImg');
					const c = document.getElementById('pvCap');
					img.src = src;
					c.textContent = cap;
					img.onload = () => { c.textContent = cap + ' · ' + img.naturalWidth + '×' + img.naturalHeight + ' px'; };
					dlg.classList.add('open');
					if (typeof installFocusTrap === 'function' && !window._photoTrapCleanup) {
						window._photoTrapCleanup = installFocusTrap(dlg, { onEscape: closePhotoViewer });
					}
					const b = document.getElementById('pvClose');
					if (b) b.focus();
				}
				function openPhotoViewer(i) { const r = activeRec(); if (!r.photos || !r.photos[i]) return; viewerState = { type: 'photo', photoIndex: i, sigTarget: '', assetKey: '' }; showViewer(r.photos[i], 'Evidence #' + (i + 1) + ' ≈' + dataUrlKB(r.photos[i]) + 'KB'); }
				function openSigViewer(t) { const r = liftingBatch[activeIdx]; const s = t === 'inspector' ? r.inspectorSigUpload : r.authSigUpload; if (!s) return; viewerState = { type: 'sig', photoIndex: -1, sigTarget: t, assetKey: '' }; showViewer(s, 'Signature ≈' + dataUrlKB(s) + 'KB'); }
				function openNdtSigViewer(t) { const r = ndtBatch[activeIdx]; const s = t === 'insp' ? r.inspSigUpload : r.witSigUpload; if (!s) return; viewerState = { type: 'ndtsig', photoIndex: -1, sigTarget: t, assetKey: '' }; showViewer(s, 'NDT signature ≈' + dataUrlKB(s) + 'KB'); }
				function openAssetViewer(k) { const s = getAssetSource(k); if (!s) return; viewerState = { type: 'asset', photoIndex: -1, sigTarget: '', assetKey: k }; showViewer(s, assetLabel(k) + ' ≈' + dataUrlKB(s) + 'KB'); }
				function assetLabel(k) {
					if (k === 'headerBanner') return 'Header banner';
					if (k === 'footerBanner') return 'Footer band';
					if (k === 'logo') return 'Company logo';
					if (typeof k === 'string' && k.indexOf('accred_') === 0) {
						const idx = parseInt(k.replace('accred_', ''), 10);
						const a = (assets.accreds || [])[idx];
						return (a && a.name) ? (a.name + ' logo') : 'Accreditation logo';
					}
					return 'Stamp';
				}
				function getAssetSource(k) {
					if (k === 'stamp') { const r = activeRec(); return r ? r.stampUpload : null; }
					if (typeof k === 'string' && k.indexOf('accred_') === 0) {
						const idx = parseInt(k.replace('accred_', ''), 10);
						const a = (assets.accreds || [])[idx];
						return a ? a.img : null;
					}
					return assets[k];
				}
				function closePhotoViewer() {
					if (window._photoTrapCleanup) {
						try { window._photoTrapCleanup(); } catch (e) {}
						window._photoTrapCleanup = null;
					}
					document.getElementById('photoViewer').classList.remove('open');
					const st = viewerState;
					viewerState = { type: 'none', photoIndex: -1, sigTarget: '', assetKey: '' };
					let b = null;
					if (st.type === 'photo') b = document.getElementById('photoThumb_' + st.photoIndex);
					else if (st.type === 'sig') b = document.getElementById(st.sigTarget === 'inspector' ? 'sigBtn_insp' : 'sigBtn_auth');
					else if (st.type === 'ndtsig') b = document.getElementById(st.sigTarget === 'insp' ? 'sigBtn_ndtInsp' : 'sigBtn_ndtWit');
					else if (st.type === 'asset') b = document.getElementById('assetBtn_' + st.assetKey);
					if (b) b.focus();
				}
				function replaceFromViewer() {
					const st = viewerState; closePhotoViewer();
					if (st.type === 'photo') { const f = document.getElementById('photoFile_' + st.photoIndex); if (f) f.click(); }
					else if (st.type === 'sig') { const f = document.getElementById(st.sigTarget === 'inspector' ? 'sigFileInsp' : 'sigFileAuth'); if (f) f.click(); }
					else if (st.type === 'ndtsig') { const f = document.getElementById(st.sigTarget === 'insp' ? 'sigFile_ndtInsp' : 'sigFile_ndtWit'); if (f) f.click(); }
					else if (st.type === 'asset') { const f = document.getElementById('assetFile_' + st.assetKey); if (f) f.click(); }
				}
				function deleteFromViewer() {
					const st = viewerState; closePhotoViewer();
					if (st.type === 'photo') deletePhoto(st.photoIndex);
					else if (st.type === 'sig') deleteSigUpload(st.sigTarget);
					else if (st.type === 'ndtsig') deleteNdtSigUpload(st.sigTarget);
					else if (st.type === 'asset') deleteAssetThumb(st.assetKey);
				}

				/* ASSET THUMBNAILS & CONTROLS */
				function isAssetEnabled(k) {
					if (featureToggles.overlays === false) return false;
					if (k === 'stamp') { const r = activeRec(); return r.stampEnabled !== false; }
					if (typeof k === 'string' && k.indexOf('accred_') === 0) {
						const idx = parseInt(k.replace('accred_', ''), 10);
						const a = (assets.accreds || [])[idx];
						return a ? a.enabled !== false : true;
					}
					return assets[k + 'Enabled'] !== false;
				}
				function isAssetBleed(k) {
					if (k === 'stamp') { const r = activeRec(); return r.stampBleed !== false; } // Stamp defaults to bleed
					if (typeof k === 'string' && k.indexOf('accred_') === 0) {
						const idx = parseInt(k.replace('accred_', ''), 10);
						const a = (assets.accreds || [])[idx];
						return a ? !!a.bleed : false;
					}
					return !!assets[k + 'Bleed'];
				}
				function toggleAssetEnable(k) {
					if (k === 'stamp') {
						const r = activeRec();
						if (r) r.stampEnabled = (r.stampEnabled === false);
					} else if (typeof k === 'string' && k.indexOf('accred_') === 0) {
						const idx = parseInt(k.replace('accred_', ''), 10);
						if (assets.accreds && assets.accreds[idx]) {
							assets.accreds[idx].enabled = (assets.accreds[idx].enabled === false);
						}
					} else {
						assets[k + 'Enabled'] = (assets[k + 'Enabled'] === false);
					}
					renderAssetThumbs();
					if (typeof schedulePersist === 'function') schedulePersist();
					debouncedSync();
				}
				function toggleAssetBleed(k) {
					if (k === 'stamp') {
						const r = activeRec();
						if (r) r.stampBleed = (r.stampBleed === false);
					} else if (typeof k === 'string' && k.indexOf('accred_') === 0) {
						const idx = parseInt(k.replace('accred_', ''), 10);
						if (assets.accreds && assets.accreds[idx]) {
							assets.accreds[idx].bleed = !assets.accreds[idx].bleed;
						}
					} else {
						assets[k + 'Bleed'] = !assets[k + 'Bleed'];
					}
					renderAssetThumbs();
					if (typeof schedulePersist === 'function') schedulePersist();
					debouncedSync();
				}
				function renderAssetThumbs() {
					['headerBanner', 'footerBanner', 'logo', 'stamp'].forEach(k => {
						const w = document.getElementById('assetWrap_' + k), b = document.getElementById('assetBtn_' + k), d = document.getElementById('assetDel_' + k);
						if (!w || !b || !d) return;
						const s = getAssetSource(k);
						if (s) { w.classList.add('has-img'); b.innerHTML = '<img src="' + s + '" alt="' + assetLabel(k) + '">'; d.hidden = false; }
						else { w.classList.remove('has-img'); b.innerHTML = '<span class="sig-empty">+ ADD IMAGE</span>'; d.hidden = true; }

						const ep = document.getElementById('pill_asset_' + k);
						if (ep) {
							const en = isAssetEnabled(k);
							ep.className = 'micro-toggle' + (en ? ' on' : '');
							ep.innerHTML = '<span class="toggle-dot"></span>' + (en ? 'ON' : 'OFF');
						}
						const bp = document.getElementById('pill_bleed_' + k);
						if (bp) {
							const bl = isAssetBleed(k);
							bp.className = 'micro-toggle' + (bl ? ' on' : '');
						}
					});
					renderAccreditationTiles();
				}
				function renderAccreditationTiles() {
					const c = document.getElementById('accredLogosContainer');
					if (!c) return;
					if (!assets.accreds) assets.accreds = [];
					if (assets.accreds.length === 0) {
						c.innerHTML = '<div style="font-size:var(--ui-font-xs);color:var(--ink-muted);font-style:italic;padding:4px 0;">No additional accreditation logos uploaded yet. Click below to add one (e.g. LEEA, DNV, ISO, ABS).</div>';
						return;
					}
					c.innerHTML = assets.accreds.map((a, i) => {
						const has = !!a.img;
						const k = 'accred_' + i;
						const en = a.enabled !== false;
						const bl = !!a.bleed;
						return '<div class="fg" style="border:1px solid var(--hairline);border-radius:var(--radius-2);padding:6px;background:var(--surface);">' +
							'<div class="fg-hdr" style="margin-bottom:4px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
								'<input type="text" value="' + attrEsc(a.name || ('Accreditation #' + (i + 1))) + '" style="font-size:11px;padding:2px 4px;min-height:22px;font-weight:700;flex:1;min-width:70px;" onchange="updateAccredName(' + i + ', this.value)" placeholder="Badge name">' +
								'<div style="display:flex;gap:3px;align-items:center;margin-left:auto;">' +
									'<button type="button" class="btn btn-accent" style="padding:1px 5px;font-size:9px;min-height:auto;" onclick="openApplyToAllDialog(\'' + k + '\')" title="Apply this badge to all batch records">⚡</button>' +
									'<span class="micro-toggle' + (bl ? ' on' : '') + '" onclick="toggleAssetBleed(\'' + k + '\')" title="Allow badge to overlap paper margins"><span class="toggle-dot"></span>BLEED</span>' +
									'<span class="micro-toggle' + (en ? ' on' : '') + '" onclick="toggleAssetEnable(\'' + k + '\')"><span class="toggle-dot"></span>' + (en ? 'ON' : 'OFF') + '</span>' +
									'<button type="button" class="thumb-del" style="position:static;display:inline-flex;padding:1px 4px;" onclick="deleteAccredTile(' + i + ')" title="Remove this badge">✕</button>' +
								'</div>' +
							'</div>' +
							'<div class="sig-upload' + (has ? ' has-img' : '') + '" id="assetWrap_' + k + '">' +
								'<input type="file" id="assetFile_' + k + '" accept="image/*" style="display:none;" tabindex="-1" onchange="uploadAssetFrom(event,\'' + k + '\')">' +
								'<button type="button" class="sig-upload-btn" id="assetBtn_' + k + '" onclick="assetTileClick(\'' + k + '\')">' +
								(has ? '<img src="' + a.img + '" alt="' + attrEsc(a.name || 'Accred') + '">' : '<span class="sig-empty">+ ADD BADGE</span>') +
								'</button>' +
								'<button type="button" class="thumb-del" id="assetDel_' + k + '" onclick="deleteAssetThumb(\'' + k + '\')"' + (has ? '' : ' hidden') + '>✕</button>' +
							'</div>' +
						'</div>';
					}).join('');
				}
				function addAccreditationLogo() {
					if (!assets.accreds) assets.accreds = [];
					const id = 'acc_' + Date.now();
					assets.accreds.push({ id, name: 'Accreditation #' + (assets.accreds.length + 1), img: null });
					renderAssetThumbs();
					if (typeof schedulePersist === 'function') schedulePersist();
					debouncedSync();
				}
				function updateAccredName(i, name) {
					if (assets.accreds && assets.accreds[i]) {
						assets.accreds[i].name = (name || '').trim();
						if (typeof schedulePersist === 'function') schedulePersist();
						debouncedSync();
					}
				}
				function deleteAccredTile(i) {
					if (assets.accreds && assets.accreds[i]) {
						assets.accreds.splice(i, 1);
						renderAssetThumbs();
						if (typeof schedulePersist === 'function') schedulePersist();
						debouncedSync();
						showToast('Accreditation tile removed.', 'info');
					}
				}
				function assetTileClick(k) { if (getAssetSource(k)) openAssetViewer(k); else { const f = document.getElementById('assetFile_' + k); if (f) f.click(); } }
				async function uploadAssetFrom(evt, type) {
					const f = evt.target.files[0]; if (!f) return;
					try {
						const d = await compressImageUpload(f, 1200, 800, .85);
						if (type === 'stamp') {
							activeRec().stampUpload = d;
						} else if (typeof type === 'string' && type.indexOf('accred_') === 0) {
							const idx = parseInt(type.replace('accred_', ''), 10);
							if (!assets.accreds) assets.accreds = [];
							if (assets.accreds[idx]) assets.accreds[idx].img = d;
						} else {
							assets[type] = d;
						}
						renderAssetThumbs(); debouncedSync(); showToast(assetLabel(type) + ' loaded.', 'success');
					} catch (e) { showToast('Image error.', 'error'); }
					evt.target.value = '';
				}
				function deleteAssetThumb(k) {
					if (k === 'stamp') {
						const r = activeRec(); if (r) r.stampUpload = null;
					} else if (typeof k === 'string' && k.indexOf('accred_') === 0) {
						const idx = parseInt(k.replace('accred_', ''), 10);
						if (assets.accreds && assets.accreds[idx]) assets.accreds[idx].img = null;
					} else {
						assets[k] = null;
					}
					renderAssetThumbs(); debouncedSync(); showToast(assetLabel(k) + ' removed.', 'info');
				}

				/* SIGNATURE THUMBNAILS */
				function renderSigThumbs() {
					const r = liftingBatch[activeIdx] || {};
					[['inspector', r.inspectorSigUpload, 'insp'], ['authenticator', r.authSigUpload, 'auth']].forEach(p => {
						const w = document.getElementById('sigWrap_' + p[2]), b = document.getElementById('sigBtn_' + p[2]), d = document.getElementById('sigDel_' + p[2]);
						if (!w || !b || !d) return;
						if (p[1]) { w.classList.add('has-img'); b.innerHTML = '<img src="' + p[1] + '" alt="' + p[0] + '">'; d.hidden = false; }
						else { w.classList.remove('has-img'); b.innerHTML = '<span class="sig-empty">+ ADD SIGNATURE</span>'; d.hidden = true; }
					});
				}
				function sigUploadClick(t) { const r = liftingBatch[activeIdx]; const s = t === 'inspector' ? r.inspectorSigUpload : r.authSigUpload; if (s) openSigViewer(t); else { const f = document.getElementById(t === 'inspector' ? 'sigFileInsp' : 'sigFileAuth'); if (f) f.click(); } }
				function deleteSigUpload(t) { const r = liftingBatch[activeIdx]; if (!r) return; if (t === 'inspector') { r.inspectorSigUpload = null; r.inspectorSigMode = 'LIVE'; } else { r.authSigUpload = null; r.authSigMode = 'LIVE'; } renderSigThumbs(); debouncedSync(); }
				async function handleSignatureUpload(evt, t) {
					const f = evt.target.files[0]; if (!f) return;
					try {
						const d = await compressImageUpload(f, 600, 300, .9);
						if (t === 'inspector') { liftingBatch[activeIdx].inspectorSigUpload = d; liftingBatch[activeIdx].inspectorSigMode = 'UPLOAD'; }
						else { liftingBatch[activeIdx].authSigUpload = d; liftingBatch[activeIdx].authSigMode = 'UPLOAD'; }
						renderSigThumbs(); debouncedSync(); showToast('Signature uploaded.', 'success');
					} catch (e) { showToast('Signature error.', 'error'); }
					evt.target.value = '';
				}

				function ndtSigIds(t) { return t === 'insp' ? ['sigWrap_ndtInsp', 'sigBtn_ndtInsp', 'sigDel_ndtInsp', 'sigFile_ndtInsp'] : ['sigWrap_ndtWit', 'sigBtn_ndtWit', 'sigDel_ndtWit', 'sigFile_ndtWit']; }
				function renderNdtSigThumbs() {
					const r = ndtBatch[activeIdx] || {};
					[['insp', r.inspSigUpload], ['wit', r.witSigUpload]].forEach(p => {
						const ids = ndtSigIds(p[0]);
						const w = document.getElementById(ids[0]), b = document.getElementById(ids[1]), d = document.getElementById(ids[2]);
						if (!w || !b || !d) return;
						if (p[1]) { w.classList.add('has-img'); b.innerHTML = '<img src="' + p[1] + '" alt="sig">'; d.hidden = false; }
						else { w.classList.remove('has-img'); b.innerHTML = '<span class="sig-empty">+ ADD SIGNATURE</span>'; d.hidden = true; }
					});
				}
				function ndtSigUploadClick(t) { const r = ndtBatch[activeIdx]; const s = t === 'insp' ? r.inspSigUpload : r.witSigUpload; if (s) openNdtSigViewer(t); else { const f = document.getElementById(ndtSigIds(t)[3]); if (f) f.click(); } }
				function deleteNdtSigUpload(t) { const r = ndtBatch[activeIdx]; if (!r) return; if (t === 'insp') { r.inspSigUpload = null; r.inspSigMode = 'LIVE'; } else { r.witSigUpload = null; r.witSigMode = 'LIVE'; } renderNdtSigThumbs(); debouncedSync(); }
				async function handleNdtSignatureUpload(evt, t) {
					const f = evt.target.files[0]; if (!f) return;
					try {
						const d = await compressImageUpload(f, 600, 300, .9);
						if (t === 'insp') { ndtBatch[activeIdx].inspSigUpload = d; ndtBatch[activeIdx].inspSigMode = 'UPLOAD'; }
						else { ndtBatch[activeIdx].witSigUpload = d; ndtBatch[activeIdx].witSigMode = 'UPLOAD'; }
						renderNdtSigThumbs(); debouncedSync(); showToast('NDT signature uploaded.', 'success');
					} catch (e) { showToast('Signature error.', 'error'); }
					evt.target.value = '';
				}

				/* PHOTO GRID */
				function renderPhotoTiles() {
					const c = document.getElementById('photo_slots_container'); if (!c) return;
					const r = activeRec();
					if (!Array.isArray(r.photos)) r.photos = [];
					const count = r.photos.length;
					const titleEl = document.getElementById('evidenceHeaderTitle');
					if (titleEl) titleEl.textContent = 'Evidence Engine (' + count + ' Photo' + (count === 1 ? '' : 's') + ')';
					// A photo slot can still hold an "@idb:" marker (persist stripped
					// it mid-flight, or a restored snapshot carried one back).
					// Rendering that as an <img src> fires ERR_FILE_NOT_FOUND.
					const shown = r.photos.map(v => typeof v === 'string' && v.indexOf('@idb:') === 0 ? null : v);
					let h = '';
					for (let i = 0; i < count; i++) {
						const has = !!shown[i];
						h += '<div class="fg photo-tile' + (has ? ' has-photo' : '') + '">' +
							'<div class="fg-hdr"><span class="fg-title">Photo #' + (i + 1) + '</span><span class="photo-state">' + (has ? dataUrlKB(shown[i]) + 'KB' : 'EMPTY') + '</span></div>' +
							'<div class="photo-wrap">' +
							'<button type="button" class="photo-thumb" id="photoThumb_' + i + '" onclick="photoTileClick(' + i + ')">' + (has ? '<img src="' + shown[i] + '" alt="ev">' : '<span class="photo-empty">+ ADD</span>') + '</button>' +
							'<button type="button" class="photo-del" onclick="deletePhoto(' + i + ')" title="Clear photo"' + (has ? '' : ' hidden') + '>✕</button>' +
							'</div>' +
							'<div style="display:flex;justify-content:flex-end;align-items:center;margin-top:4px;">' +
							'<button type="button" class="btn btn-danger" style="padding:2px 8px;font-size:10px;width:100%;" onclick="removePhotoSlot(' + i + ')" title="Delete this photo slot">&times; Remove</button>' +
							'</div>' +
							'<input type="file" id="photoFile_' + i + '" accept="image/*" style="display:none;" tabindex="-1" onchange="handlePhotoUpload(event,' + i + ')">' +
							'</div>';
					}
					if (!count) {
						h = '<div style="grid-column:1/-1;text-align:center;padding:24px 12px;color:var(--ink-muted);font-style:italic;">No photo fields added yet. Click "+ Add Photo Field" above to add upload fields to this certificate.</div>';
					}
					c.innerHTML = h;
				}
				function addPhotoSlot() {
					const r = activeRec();
					if (!Array.isArray(r.photos)) r.photos = [];
					r.photos.push(null);
					renderPhotoTiles();
					debouncedSync();
				}
				async function removePhotoSlot(i) {
					const r = activeRec();
					if (!Array.isArray(r.photos) || i < 0 || i >= r.photos.length) return;
					const engine = currentEngine === 'LIFTING' ? 'lifting' : 'ndt';
					await PhotosIDB.deleteKeyForRecord(engine, r, i).catch(() => {});
					r.photos.splice(i, 1);
					if (Array.isArray(r._photoMarkers)) r._photoMarkers.splice(i, 1);
					renderPhotoTiles();
					debouncedSync();
				}
				function photoTileClick(i) { const r = activeRec(); if (r.photos && r.photos[i]) openPhotoViewer(i); else { const f = document.getElementById('photoFile_' + i); if (f) f.click(); } }
				function deletePhoto(i) {
					const r = activeRec(); if (!r.photos) return;
					const engine = currentEngine === 'LIFTING' ? 'lifting' : 'ndt';
					r.photos[i] = null;
					PhotosIDB.deleteKeyForRecord(engine, r, i).catch(() => {});
					renderPhotoTiles(); debouncedSync();
				}
				async function handlePhotoUpload(evt, i) {
					const f = evt.target.files[0]; if (!f) return;
					try {
						const d = await compressImageUpload(f, 800, 800, .72);
						const r = activeRec(); if (!r.photos) r.photos = [];
						while (r.photos.length <= i) r.photos.push(null);
						r.photos[i] = d;
						const engine = currentEngine === 'LIFTING' ? 'lifting' : 'ndt';
						await PhotosIDB.stageRecordPhotos(engine, r);
						renderPhotoTiles(); debouncedSync();
						showToast('Photo #' + (i + 1) + ' ≈' + dataUrlKB(d) + 'KB.', 'success');
					} catch (e) {
						console.error('[photos]', e);
						showToast('Photo save failed. Try again, or free up device storage.', 'error');
					}
					evt.target.value = '';
				}


				/* BATCH DATE PATCH */
				function applyBatchExamDate() {
					const nd = document.getElementById('batchExamDatePicker').value;
					if (!nd) { showToast('Pick a date first.', 'error'); return; }
					const rule = document.getElementById('batchIntervalSelect').value;
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					let sel = list.filter(r => r.selected === true);
					const fb = !sel.length; if (fb) sel = [list[activeIdx]];
					sel.forEach(r => {
						r.examDate = nd;
						if (currentEngine === 'LIFTING') {
							if (rule === '6') { r.q_int6m = 'YES'; r.q_int12m = 'NO'; }
							else if (rule === '12') { r.q_int6m = 'NO'; r.q_int12m = 'YES'; }
							if (r.q_int6m === 'YES') r.nextExamDate = calculateNextDate(nd, 6);
							else if (r.q_int12m === 'YES') r.nextExamDate = calculateNextDate(nd, 12);
						}
					});
					loadActiveRecord(); renderSheet(); debouncedSync(); showToast('Dates applied.', 'success');
				}

				/* STYLE UPDATERS */
				function updateAppFont(v) {
					if (!v) v = "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif";
					document.documentElement.style.setProperty('--app-font-family', v);
					document.body.style.fontFamily = v;
					store.set('ims_ui_font', v);
				}
				function updateAppSize(v) { document.documentElement.style.setProperty('--app-font-size', v); store.set('ims_ui_size', v); }
				function updateReportFont(v) {
					if (!v || v === 'theme-default') {
						document.documentElement.removeAttribute('data-report-font-custom');
						document.documentElement.style.removeProperty('--report-font-family');
						store.set('ims_rf', '');
					} else {
						document.documentElement.setAttribute('data-report-font-custom', 'true');
						document.documentElement.style.setProperty('--report-font-family', v);
						store.set('ims_rf', v);
					}
					debouncedSync();
				}
				function updateReportSize(v) { document.documentElement.style.setProperty('--report-font-size', v); store.set('ims_rs', v); debouncedSync(); }
				function updateReportDensity(v) {
					if (v === 'compact') { document.documentElement.style.setProperty('--report-cell-padding', '1.6px 3px'); document.documentElement.style.setProperty('--report-line-height', '1.1'); }
					else if (v === 'comfortable') { document.documentElement.style.setProperty('--report-cell-padding', '3.2px 4.5px'); document.documentElement.style.setProperty('--report-line-height', '1.25'); }
					else { document.documentElement.style.setProperty('--report-cell-padding', '2.2px 4px'); document.documentElement.style.setProperty('--report-line-height', '1.18'); }
					store.set('ims_rd', v); debouncedSync();
				}
				async function resetApplication() {
					if (!confirm('Erase ALL saved records, photos, signatures and settings?\n\nThis cannot be undone.')) return;
					if (!confirm('Last chance. Reset the application now?')) return;

					try {
						const drop = [];
						for (let i = 0; i < localStorage.length; i++) {
							const k = localStorage.key(i);
							if (k && k.indexOf('ims_') === 0) drop.push(k);
						}
						drop.forEach(k => localStorage.removeItem(k));
					} catch (e) { console.error('[reset] localStorage', e); }

					try { await PhotosIDB.clear(); } catch (e) { console.error('[reset] idb clear', e); }
					try { if (window.indexedDB) indexedDB.deleteDatabase('ims_media_v1'); } catch (e) {}

					try {
						if (window.caches) {
							const names = await caches.keys();
							await Promise.all(names.map(n => caches.delete(n)));
						}
					} catch (e) { console.error('[reset] caches', e); }

					location.reload();
				}
				function resetAppStyling() {
					['--app-font-family', '--app-font-size', '--report-font-family', '--report-font-size', '--report-cell-padding', '--report-line-height'].forEach(p => document.documentElement.style.removeProperty(p));
					['ims_ui_font', 'ims_ui_size', 'ims_rf', 'ims_rs', 'ims_rd', 'ims_report_theme'].forEach(k => store.del(k));
					setReportTheme('swiss');
					setTheme('dark');
					debouncedSync(); showToast('Styles reset.', 'info');
				}


				/* FIELD PILLS */
				function toggleFieldPill(k) {
					const r = liftingBatch[activeIdx];
					if (!r.fieldToggles) r.fieldToggles = {};
					r.fieldToggles[k] = r.fieldToggles[k] === false;
					updateFieldStates(); debouncedSync();
				}
				function toggleNdtFieldPill(k) {
					const r = ndtBatch[activeIdx]; if (!r) return;
					if (!r.fieldToggles) r.fieldToggles = {};
					r.fieldToggles[k] = r.fieldToggles[k] === false;
					updateNdtFieldStates(); debouncedSync();
				}
				function updateNdtFieldStates() {
					const r = ndtBatch[activeIdx]; if (!r) return;
					if (!r.fieldToggles) r.fieldToggles = {};
					ALL_NDT_TOGGLES.forEach(k => {
						const on = r.fieldToggles[k] !== false;
						const p = document.getElementById('pill_ndt_' + k);
						const inpNd = document.getElementById('ndt_in_' + k);
						const fg = inpNd ? inpNd.closest('.fg') : document.getElementById('fg_ndt_' + k);
						if (p) { p.className = 'micro-toggle ' + (on ? 'on' : 'off'); p.innerHTML = '<span class="toggle-dot"></span>' + (on ? 'ON' : 'OFF'); p.setAttribute('aria-checked', on ? 'true' : 'false'); }
						if (fg) { const input = fg.querySelector('input, select, textarea'); if (input) input.disabled = !on; }
					});
				}
				function togglePuwerPage() { const r = liftingBatch[activeIdx]; r.includePuwer = !r.includePuwer; updateFieldStates(); debouncedSync(); }
				function toggleChecklistPage() { const r = activeRec(); r.includeChecklist = !r.includeChecklist; updateFieldStates(); debouncedSync(); }
				function toggleEvidencePage() { const r = activeRec(); r.includePhotos = !r.includePhotos; updateFieldStates(); debouncedSync(); }

				function updateFieldStates() {
					const r = liftingBatch[activeIdx]; if (!r) return;
					if (!r.fieldToggles) r.fieldToggles = {};
					ALL_LIFTING_TOGGLES.forEach(k => {
						const on = r.fieldToggles[k] !== false;
						const p = document.getElementById('pill_' + k);
						const inp = document.getElementById('in_' + k);
						const fg = inp ? inp.closest('.fg') : document.getElementById('fg_' + k);
						if (p) { p.className = 'micro-toggle ' + (on ? 'on' : 'off'); p.innerHTML = '<span class="toggle-dot"></span>' + (on ? 'ON' : 'OFF'); p.setAttribute('aria-checked', on ? 'true' : 'false'); }
						if (fg) { const input = fg.querySelector('input, select, textarea'); if (input) input.disabled = !on; }
					});
					if (currentEngine === 'LIFTING') {
						const pp = document.getElementById('pill_puwerPage');
						if (pp) { const on = r.includePuwer === true; pp.className = 'micro-toggle ' + (on ? 'on' : 'off'); pp.innerHTML = '<span class="toggle-dot"></span>ANNEXURE: ' + (on ? 'ON' : 'OFF'); }
					}
					if (currentEngine === 'NDT') updateNdtFieldStates();
					const rec = activeRec();
					const cp = document.getElementById('pill_checklistToggle');
					if (cp) { const on = rec.includeChecklist === true; cp.className = 'micro-toggle ' + (on ? 'on' : 'off'); cp.innerHTML = '<span class="toggle-dot"></span>CHECKLIST: ' + (on ? 'ON' : 'OFF'); }
					const ep = document.getElementById('pill_evidencePhotos');
					if (ep) { const on = rec.includePhotos === true; ep.className = 'micro-toggle ' + (on ? 'on' : 'off'); ep.innerHTML = '<span class="toggle-dot"></span>IN REPORT: ' + (on ? 'ON' : 'OFF'); }
				}

				/* ============================================================
				   PREVIEW LAYOUT ENGINE
				   ============================================================ */
				const MQ_BESIDE_OK = window.matchMedia('(min-width: 700px)');

				

				function effectiveLayoutFor(idx) {
					const intent = layoutModes[idx];
					if (intent === 'layout-beside' && !MQ_BESIDE_OK.matches) return 'layout-below';
					return intent;
				}
				function getEffectiveLayout() { return effectiveLayoutFor(currentLayoutIdx); }

				function applyLayout() {
					const effective = getEffectiveLayout();
					const ws = document.getElementById('workspaceContainer');
					// Rewriting className wholesale used to silently drop .peek-open.
				// Any applyLayout() caller -- fullscreen exit, resize, layout
				// cycle, boot -- would slam the peek shut behind the user.
				// Preserve it here, in the one place the class is written, so no
				// caller can lose it. Only kept while still folded, so switching
				// to beside/below genuinely closes the peek.
				if (ws) {
					const wasPeek = ws.classList.contains('peek-open');
					ws.className = 'workspace ' + effective;
					if (wasPeek && effective === 'layout-folded') ws.classList.add('peek-open');
				}
								const btn = document.getElementById('btnLayoutToggle');
				if (btn) {
					btn.title = effective === 'layout-folded' ? 'Layout: Folded'
							  : effective === 'layout-below'  ? 'Layout: Below'
							  :                                 'Layout: Beside';
					btn.classList.toggle('active', effective !== 'layout-beside');
				}

					const rp = document.getElementById('previewPane');
					if (rp) rp.scrollLeft = 0;
					const note = document.getElementById('previewScaleNote');
					if (note) {
					note.textContent =
						effective === 'layout-folded' ? (ws && ws.classList.contains('peek-open') ? 'Peeking · Print: 100% A4' : 'Preview docked · Print: 100% A4') :
						effective === 'layout-below'  ? 'Screen: true A4 · Print: 100%' :
															'Screen: scaled · Print: 100% A4';
					}
					applyZoom();
				updatePeekHandle();
				if (open) updatePeekOffset();
				}

				function getFitZoom() {
			const pane = document.getElementById('previewPane');
			if (!pane) return 0.65;
			const avail = pane.clientWidth - 48;
			if (avail <= 0) return 0.65;
				return Math.max(0.25, Math.min(1.0, avail / 794));

		}

		function getCurrentZoom() {
			return manualZoom !== null ? manualZoom : getFitZoom();
		}

				function applyZoom() {
					const z = getCurrentZoom();
					document.documentElement.style.setProperty('--preview-zoom', z);
					updateZoomDisplay();
					// On mobile, only make the pane a scroll viewport when the
					// user has zoomed past fit. At fit, the pane grows with its
					// content and the page owns every gesture.
					const pane = document.getElementById('previewPane');
					if (pane) {
						const fit = getFitZoom();
						if (z > fit + 0.01) pane.classList.add('pane-pannable');
						else pane.classList.remove('pane-pannable');
					}
				}

				function zoomInPreview() {
					const cur = getCurrentZoom();
					const next = cur < 1.0 ? cur + 0.05 : cur + 0.1;
					manualZoom = Math.min(3.0, next);
					applyZoom();
				}

				function zoomOutPreview() {
					const cur = getCurrentZoom();
					const next = cur <= 1.0 ? cur - 0.05 : cur - 0.1;
					manualZoom = Math.max(0.1, next);
					applyZoom();
				}
			
				function resetPreviewZoom() { manualZoom = null; applyZoom(); }

				function installTrackpadZoom() {
					let pendingDelta = 0;
					let rafId = null;

					const onWheelZoom = function(e) {
						if (!e.ctrlKey) return;
						e.preventDefault();
						pendingDelta += e.deltaY;

						if (!rafId) {
							rafId = requestAnimationFrame(() => {
								const cur = getCurrentZoom();
								// Smooth dampening factor
								const factor = Math.exp(-pendingDelta * 0.005);
								let next = cur * factor;
								next = Math.max(0.1, Math.min(3.0, Math.round(next * 100) / 100));
								manualZoom = next;
								applyZoom();
								pendingDelta = 0;
								rafId = null;
							});
						}
					};

					// Single listener on window capturing Ctrl+wheel over preview elements
					window.addEventListener('wheel', function(e) {
						if (e.ctrlKey && e.target && e.target.closest && (e.target.closest('#previewPane') || e.target.closest('#enginePreviewContainer') || e.target.closest('.a4-page-frame'))) {
							onWheelZoom(e);
						}
					}, { passive: false });
				}

				window.currentReportTheme = localStorage.getItem('ims_report_theme') || 'swiss';
				const REPORT_THEME_CLASS_MAP = {
					'amber': 'offshore',
					'obsidian': 'obsidian-rep',
					'holographic': 'laser-ndt',
					'brutalist': 'monolith',
					'linear': 'cert-linear',
					'bloomberg': 'cert-bloomberg',
					'neumorphic': 'cert-neumorphic',
					'visionos': 'cert-visionos',
					'aurora': 'cert-aurora',
					'neubrutalist': 'cert-neubrutalist',
					'bento': 'cert-bento',
					'luxury': 'cert-luxury'
				};

				function getCanonicalReportTheme(name) {
					if (!name) return 'swiss';
					return REPORT_THEME_CLASS_MAP[name] || name;
				}

				function setReportTheme(themeName) {
					window.currentReportTheme = themeName || 'swiss';
					try { localStorage.setItem('ims_report_theme', window.currentReportTheme); } catch (e) {}
					const select1 = document.getElementById('reportThemeSelect');
					if (select1 && select1.value !== window.currentReportTheme) select1.value = window.currentReportTheme;
					const select2 = document.getElementById('reportThemeSelectToolbar');
					if (select2 && select2.value !== window.currentReportTheme) select2.value = window.currentReportTheme;

					const canonicalClass = 'theme-report-' + getCanonicalReportTheme(window.currentReportTheme);

					document.querySelectorAll('.a4-page-frame').forEach(f => {
						const toRemove = [];
						f.classList.forEach(c => {
							if (c.startsWith('theme-report-')) toRemove.push(c);
						});
						toRemove.forEach(c => f.classList.remove(c));
						f.classList.add(canonicalClass);
					});
					if (typeof renderPreview === 'function') renderPreview();
				}

				// The app bar overlays the top of the peek pane, so the pane has to
			// begin below it or the zoom bar is hidden behind it. Measured with a
			// ResizeObserver because the bar changes height with the responsive
			// breakpoints and with the header drawer, not just on window resize.
			function updatePeekOffset() {
				const bar = document.querySelector('.master-switch-bar');
				const bottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
				document.documentElement.style.setProperty('--peek-top', bottom + 'px');
			}
			if (typeof ResizeObserver === 'function') {
				try {
					const _bar = document.querySelector('.master-switch-bar');
					if (_bar) new ResizeObserver(updatePeekOffset).observe(_bar);
				} catch (e) {}
			}
			window.addEventListener('resize', updatePeekOffset, { passive: true });
			function togglePreviewPeek() {
				const ws = document.getElementById('workspaceContainer');
				if (!ws) return;
				const open = !ws.classList.contains('peek-open');
				// applyLayout rewrites ws.className wholesale, so call it first or
				// it would wipe the class we are about to set. It also re-fits the
				// zoom against a display:none pane, which reads 0 width, so the
				// second applyZoom below is the one that matters when opening.
				try { applyLayout(); } catch (e) {}
				ws.classList.toggle('peek-open', open);
				// The preview renders lazily, so a peek opened before anything
				// has been drawn would slide in an empty pane. Fill it if so.
				if (open) {
					const c = document.getElementById('enginePreviewContainer');
					if (c && !c.querySelector('.a4-page-frame')) renderPreview();
				}
				try { applyZoom(); } catch (e) {}
				// The handle is the docked control in BOTH folded states -- closed it
				// invites you in, open it is the way back out. Only the glyph and
				// label change, so never clear .on here; updatePeekHandle owns it.
				paintPeekHandle(open);
				// Re-run it now that .peek-open is on the workspace: the applyLayout
				// call above ran before the class was set, so this is the pass that
				// applies the background scroll lock.
				updatePeekHandle();
				const note = document.getElementById('previewScaleNote');
				if (note && getEffectiveLayout() === 'layout-folded') {
					note.textContent = open ? 'Peeking · Print: 100% A4' : 'Preview docked · Print: 100% A4';
				}
			}
			// The handle belongs to folded mode only, and only on a screen wide
			// enough for the folded rules to apply at all (below 700px the preview
			// already sits under the form).
			// Closed, the handle reads "pull the preview in" (chevron left). Open, it
			// sits on top of the 100vw pane and becomes the only visible way out, so
			// it flips to "push it away" (chevron right) and gets the accent fill.
			const SVG_PEEK_OPEN  = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
			const SVG_PEEK_CLOSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
			function updatePeekHandle() {
				const h = document.getElementById('btnPeekHandle');
				const ws = document.getElementById('workspaceContainer');
				const open = !!(ws && ws.classList.contains('peek-open'));
				// The background lock lives on <html>, not on .workspace -- nothing
				// rewrites documentElement's class list, and .workspace gets rebuilt
				// by applyLayout, which would drop the lock and leave the form
				// scrollable behind an open peek.
				document.documentElement.classList.toggle('peek-locked', open);
				if (!h) return;
				const on = getEffectiveLayout() === 'layout-folded' && window.matchMedia('(min-width: 700px)').matches;
				h.classList.toggle('on', on);
				if (!on) {
					h.setAttribute('aria-expanded', 'false');
					// Repaint to the closed state, or the handle still reads
					// "Close" the next time folded is selected and it reappears
					// lying about a peek that is not open.
					paintPeekHandle(false);
				}
			}
			function paintPeekHandle(open) {
				const h = document.getElementById('btnPeekHandle');
				if (!h) return;
				const lbl = h.querySelector('.peek-handle-label');
				if (lbl) lbl.textContent = open ? 'Close' : 'Preview';
				const svg = h.querySelector('svg');
				if (svg) svg.outerHTML = open ? SVG_PEEK_CLOSE : SVG_PEEK_OPEN;
				h.setAttribute('aria-expanded', open ? 'true' : 'false');
				h.setAttribute('aria-label', open ? 'Close preview' : 'Peek at the live preview');
				h.title = open ? 'Close preview (Esc)' : 'Peek at the live preview';
			}
			document.addEventListener('keydown', function (e) {
				if (e.key !== 'Escape') return;
				const ws = document.getElementById('workspaceContainer');
				if (ws && ws.classList.contains('peek-open')) togglePreviewPeek();
			});

			function togglePreviewFullscreen() {
					const rp = document.getElementById('previewPane');
					if (!rp) return;
					const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
					const entering = !fsEl;
					try {
						if (entering) {
							// Ask for fullscreen on the right pane itself so the
							// zoom controls and gauge banner come along.
							const req = rp.requestFullscreen || rp.webkitRequestFullscreen;
							if (req) {
								Promise.resolve(req.call(rp)).catch(err => {
									console.error('[fullscreen]', err);
									if (typeof showToast === 'function') {
										showToast('Fullscreen blocked by browser.', 'error');
									}
								});
							}
						} else {
							const exit = document.exitFullscreen || document.webkitExitFullscreen;
							if (exit) Promise.resolve(exit.call(document)).catch(() => {});
						}
					} catch (e) {
						console.error('[fullscreen]', e);
						if (typeof showToast === 'function') showToast('Fullscreen failed.', 'error');
					}
				}

				// Update the button glyph when the user presses Esc or F11 to leave
				// fullscreen. Fire applyLayout so the pane re-measures after the
				// viewport resizes.
				document.addEventListener('fullscreenchange', _onFullscreenChange);
				document.addEventListener('webkitfullscreenchange', _onFullscreenChange);
								const SVG_FS_ENTER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
				const SVG_FS_EXIT  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';
				function _onFullscreenChange() {
					const btn = document.getElementById('btnFullscreen');
					if (btn) {
						const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
						btn.innerHTML = isFs ? SVG_FS_EXIT : SVG_FS_ENTER;
						btn.title = isFs ? 'Exit Fullscreen' : 'Toggle Fullscreen';
					}
					try { applyLayout(); } catch (e) {}
				}
								function updateZoomDisplay() {
				const display = document.getElementById('zoomLevelDisplay');
				if (!display) return;
				const pct = Math.round(getCurrentZoom() * 100);
				if (manualZoom === null) {
					display.textContent = 'Fit';
					display.title = 'Auto-fit to this screen. Click + or − to override.';
					display.style.color = 'var(--ink-muted)';
				} else {
					display.textContent = pct + '%';
					display.title = 'Manual zoom. Click ↺ to return to auto-fit.';
					display.style.color = 'var(--accent)';
				}
			}
				function cyclePreviewLayout() {
					const startEffective = getEffectiveLayout();
					for (let step = 1; step <= layoutModes.length; step++) {
						const candidate = (currentLayoutIdx + step) % layoutModes.length;
						if (effectiveLayoutFor(candidate) !== startEffective) {
							currentLayoutIdx = candidate;
							break;
						}
					}
					store.set('ims_layout', String(currentLayoutIdx));
					applyLayout();
					const ws = document.getElementById('workspaceContainer');
					if (ws) ws.scrollTo({ top: 0, behavior: 'smooth' });
				}
						const SVG_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
				const SVG_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

				function toggleHeaderDrawer() {
					const open = document.body.classList.toggle('header-drawer-open');
					const btn = document.getElementById('btnHeaderDrawer');
					if (btn) {
						btn.innerHTML = open ? SVG_CLOSE : SVG_GEAR;
						btn.title = open ? 'Hide settings' : 'Settings';
						btn.classList.toggle('active', open);
					}
					store.set('ims_header_drawer', open ? '1' : '0');
				}

				(function restoreHeaderDrawer() {
					try {
						if (store.get('ims_header_drawer') === '1') {
							document.body.classList.add('header-drawer-open');
							const btn = document.getElementById('btnHeaderDrawer');
							if (btn) {
								btn.innerHTML = SVG_CLOSE;
								btn.title = 'Hide settings';
								btn.classList.add('active');
							}
						}
					} catch (e) {}
				})();
				const THEMES = [
					'dark', 'light', 'sunlight', 'night', 'cbsafe', 'hc',
					'bloomberg', 'blueprint', 'metric', 'clay', 'avionics', 'linen', 'eink',
					'visionos', 'terminal', 'cyberdeck', 'aurora', 'neubrutalist', 'bauhaus',
					'monolith', 'y2k', 'statutory', 'crimson', 'offshore', 'osha', 'luxury'
				];
				function setTheme(name) {
					if (THEMES.indexOf(name) === -1) name = 'dark';
					const apply = () => {
						// <html> carries the class too: the <head> script sets it before
						// first paint, so it has to be cleared here or a theme switch
						// would leave the old one winning on :root.
						const toRemoveBody = [];
						document.body.classList.forEach(c => { if (c.startsWith('theme-')) toRemoveBody.push(c); });
						toRemoveBody.forEach(c => document.body.classList.remove(c));

						const toRemoveHtml = [];
						document.documentElement.classList.forEach(c => { if (c.startsWith('theme-')) toRemoveHtml.push(c); });
						toRemoveHtml.forEach(c => document.documentElement.classList.remove(c));

						if (name !== 'dark') {
							document.body.classList.add('theme-' + name);
							document.documentElement.classList.add('theme-' + name);
						}
						store.set('ims_theme', name);
						const sel = document.getElementById('themeSelect');
						if (sel && sel.value !== name) sel.value = name;
					};
					// A view transition is skipped (and its promise rejected) when the
					// document is hidden or another transition is already running.
					// Apply immediately in those cases so the theme always lands.
					if (document.startViewTransition && document.visibilityState === 'visible') {
						const t = document.startViewTransition(apply);
						t.ready.catch(function () {});
						t.finished.catch(function () { apply(); });
					} else apply();
				}

				const FORM_STYLES = [
					'linear', 'floating', 'bento', 'material', 'rugged', 'neumorphic',
					'meter', 'compact-hud', 'cyberdeck', 'glassmorphic', 'synthwave', 'wireframe',
					'swiss', 'zen', 'brutalist', 'stealth', 'metric', 'linen',
					'eink', 'terminal-green', 'bauhaus', 'y2k', 'crimson', 'osha'
				];
				function setFormStyle(name) {
					if (!name || FORM_STYLES.indexOf(name) === -1) name = 'linear';
					const apply = () => {
						const toRemoveBody = [];
						document.body.classList.forEach(c => { if (c.startsWith('form-style-')) toRemoveBody.push(c); });
						toRemoveBody.forEach(c => document.body.classList.remove(c));

						const toRemoveHtml = [];
						document.documentElement.classList.forEach(c => { if (c.startsWith('form-style-')) toRemoveHtml.push(c); });
						toRemoveHtml.forEach(c => document.documentElement.classList.remove(c));

						document.body.classList.add('form-style-' + name);
						document.documentElement.classList.add('form-style-' + name);

						store.set('ims_form_style', name);
						const sel = document.getElementById('formStyleSelect');
						if (sel && sel.value !== name) sel.value = name;
					};
					if (document.startViewTransition && document.visibilityState === 'visible') {
						const t = document.startViewTransition(apply);
						t.ready.catch(function () {});
						t.finished.catch(function () { apply(); });
					} else apply();
				}

				/* SYNC */
				function debouncedSync() {
					if (typeof markDirty === 'function') markDirty();
					if (syncTimer) clearTimeout(syncTimer);
					syncTimer = setTimeout(() => {
						requestAnimationFrame(() => {
							try {
								syncCurrentData();
								renderPreview();
								runWorkflowChecks();
								if (typeof renderRequiredFields === 'function') renderRequiredFields();
								schedulePersist();
								if (document.getElementById('tab_batch').classList.contains('active')) renderSheet();
							} catch (e) { showPreviewError(e); }
						});
					}, 35);
				}

				/* VOICE INPUT */
				function startVoice(btn, id) {
					if (window.location.protocol === 'file:') { showToast('Speech needs HTTPS/localhost.', 'error'); return; }
					const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
					if (!SR) { showToast('Speech unsupported.', 'error'); return; }
					try {
						btn.classList.add('recording');
						activeSpeechRec = new SR();
						activeSpeechRec.continuous = true;
						activeSpeechRec.onresult = e => {
							const t = document.getElementById(id);
							if (t) { t.value = (t.value ? t.value + ' ' : '') + e.results[e.results.length - 1][0].transcript; debouncedSync(); }
						};
						activeSpeechRec.onerror = () => stopVoice(btn);
						activeSpeechRec.onend = () => btn.classList.remove('recording');
						activeSpeechRec.start();
					} catch (e) { stopVoice(btn); }
				}
				function stopVoice(btn) { if (activeSpeechRec) { btn.classList.remove('recording'); try { activeSpeechRec.stop(); } catch (e) {} activeSpeechRec = null; } }


				/* NDT METHOD */
				function setNdtMethod(m) {
					if (ndtBatch[activeIdx]) ndtBatch[activeIdx].method = m;
					['m_mpi', 'm_pt', 'm_vt', 'm_rt', 'm_ut'].forEach(id => { const b = document.getElementById(id); if (b) { b.classList.remove('btn-accent'); b.setAttribute('aria-pressed', 'false'); } });
					const a = document.getElementById('m_' + String(m).toLowerCase());
					if (a) { a.classList.add('btn-accent'); a.setAttribute('aria-pressed', 'true'); }
					renderNdtDynamicFields();
					debouncedSync();
				}
				function renderNdtDynamicFields() {
					const m = ndtBatch[activeIdx].method;
					const c = document.getElementById('ndt_dynamic_fields');
					if (!c) return;
					document.getElementById('lbl_method_param').textContent = m + ' Parameters';
					if (m === 'MPI') c.innerHTML =
						'<div class="row cols-3">' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Yoke Serial</span></div><input value="' + attrEsc(ndtBatch[activeIdx].yokeSerial) + '" oninput="ndtBatch[activeIdx].yokeSerial=this.value;debouncedSync();"></div>' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Current</span></div><input value="' + attrEsc(ndtBatch[activeIdx].magCurrent) + '" oninput="ndtBatch[activeIdx].magCurrent=this.value;debouncedSync();"></div>' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Media</span></div><input value="' + attrEsc(ndtBatch[activeIdx].inkType) + '" oninput="ndtBatch[activeIdx].inkType=this.value;debouncedSync();"></div>' +
						'</div>';
					else if (m === 'PT') c.innerHTML =
						'<div class="row cols-3">' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Penetrant</span></div><input value="' + attrEsc(ndtBatch[activeIdx].penetrantType) + '" oninput="ndtBatch[activeIdx].penetrantType=this.value;debouncedSync();"></div>' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Brand</span></div><input value="' + attrEsc(ndtBatch[activeIdx].penetrantBrand) + '" oninput="ndtBatch[activeIdx].penetrantBrand=this.value;debouncedSync();"></div>' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Dwell</span></div><input value="' + attrEsc(ndtBatch[activeIdx].dwellTime) + '" oninput="ndtBatch[activeIdx].dwellTime=this.value;debouncedSync();"></div>' +
						'</div>';
					else c.innerHTML =
						'<div class="row cols-2">' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Machine</span></div><input value="' + attrEsc(ndtBatch[activeIdx].utUnit || '') + '" oninput="ndtBatch[activeIdx].utUnit=this.value;debouncedSync();"></div>' +
						'<div class="fg"><div class="fg-hdr"><span class="fg-title">Probe</span></div><input value="' + attrEsc(ndtBatch[activeIdx].probeFreq || '') + '" oninput="ndtBatch[activeIdx].probeFreq=this.value;debouncedSync();"></div>' +
						'</div>';
				}

				/* NDT INDICATIONS */
				function renderNdtIndications() {
					const l = document.getElementById('ndt_indication_list'); if (!l) return;
					const rows = ndtBatch[activeIdx].indications || [];
					l.innerHTML = rows.map((ind, i) =>
						'<div class="ind-edit">' +
						'<input name="indJoint_' + i + '" value="' + attrEsc(ind.joint) + '" oninput="ndtBatch[activeIdx].indications[' + i + '].joint=this.value;debouncedSync();">' +
						'<input name="indArea_' + i + '" value="' + attrEsc(ind.area) + '" oninput="ndtBatch[activeIdx].indications[' + i + '].area=this.value;debouncedSync();">' +
						'<input class="inde-find" name="indFinding_' + i + '" value="' + attrEsc(ind.finding) + '" oninput="ndtBatch[activeIdx].indications[' + i + '].finding=this.value;debouncedSync();">' +
						'<select name="indResult_' + i + '" onchange="ndtBatch[activeIdx].indications[' + i + '].result=this.value;debouncedSync();">' +
						'<option value="PASS"' + (ind.result === 'PASS' ? ' selected' : '') + '>PASS</option>' +
						'<option value="FAIL"' + (ind.result === 'FAIL' ? ' selected' : '') + '>FAIL</option>' +
						'</select>' +
						'<button class="btn btn-danger inde-del" onclick="removeNdtIndication(' + i + ')">&times;</button>' +
						'</div>'
					).join('');
				}
				function addNdtIndication() { const r = ndtBatch[activeIdx]; if (!r.indications) r.indications = []; r.indications.push({ joint: 'Joint C-' + (1000 + Math.floor(Math.random() * 900)), area: 'Weld Zone', finding: 'No indications', result: 'PASS' }); renderNdtIndications(); debouncedSync(); }
				function removeNdtIndication(i) { const r = ndtBatch[activeIdx]; if (!r.indications) return; r.indications.splice(i, 1); renderNdtIndications(); debouncedSync(); }

				/* CHECKLIST */
				function renderChecklistBuilder() {
					const c = document.getElementById('checklistItemList'); if (!c) return;
					const ref = currentEngine === 'LIFTING' ? 'liftingBatch[activeIdx]' : 'ndtBatch[activeIdx]';
					const l = activeRec().checklist || [];
					c.innerHTML = l.map((x, i) =>
						'<div style="display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap;">' +
						'<input name="chkItem_' + i + '" value="' + attrEsc(x.item) + '" style="flex:2;min-width:140px;" oninput="' + ref + '.checklist[' + i + '].item=this.value;debouncedSync();">' +
						'<select name="chkStatus_' + i + '" style="width:80px;" onchange="' + ref + '.checklist[' + i + '].status=this.value;debouncedSync();">' +
						'<option value="PASS"' + (x.status === 'PASS' ? ' selected' : '') + '>PASS</option>' +
						'<option value="FAIL"' + (x.status === 'FAIL' ? ' selected' : '') + '>FAIL</option>' +
						'<option value="N/A"' + (x.status === 'N/A' ? ' selected' : '') + '>N/A</option>' +
						'</select>' +
						'<input name="chkNote_' + i + '" value="' + attrEsc(x.note) + '" style="flex:1;min-width:90px;" oninput="' + ref + '.checklist[' + i + '].note=this.value;debouncedSync();">' +
						'<button class="btn btn-danger" style="padding:3px 6px;" onclick="' + ref + '.checklist.splice(' + i + ',1);renderChecklistBuilder();debouncedSync();">&times;</button>' +
						'</div>'
					).join('');
				}
				function addChecklistItem() { const r = activeRec(); if (!r.checklist) r.checklist = []; r.checklist.push({ item: 'New Check Point', status: 'PASS', note: '' }); renderChecklistBuilder(); debouncedSync(); }


				/* DRAGGABLE & RESIZABLE OVERLAYS */
				function makeDraggable(el, onMove, onResize, isLocked, allowBleed) {
					if (!el) return;
					let sx = 0, sy = 0, il = 0, it = 0;
					let sw = 0, sh = 0;

					// If locked, disable movement and resizing cursors
					if (isLocked) {
						el.style.cursor = 'default';
						el.classList.add('is-locked');
						return;
					} else {
						el.style.cursor = 'move';
						el.classList.remove('is-locked');
					}

					function getParentBounds(p) {
						if (!p) return { minX: 0, minY: 0, maxX: 0, maxY: 0, padL: 0, padT: 0, padR: 0, padB: 0 };
						let padL = 0, padT = 0, padR = 0, padB = 0;
						if (!allowBleed) {
							const cs = window.getComputedStyle ? window.getComputedStyle(p) : null;
							if (cs) {
								padL = parseFloat(cs.paddingLeft) || 0;
								padT = parseFloat(cs.paddingTop) || 0;
								padR = parseFloat(cs.paddingRight) || 0;
								padB = parseFloat(cs.paddingBottom) || 0;
							}
						}
						const minX = padL;
						const minY = padT;
						const maxX = Math.max(minX, p.clientWidth - padR - el.offsetWidth);
						const maxY = Math.max(minY, p.clientHeight - padB - el.offsetHeight);
						return { minX, minY, maxX, maxY, padL, padT, padR, padB };
					}

					// Click to select, stays active until click away or Escape
					el.addEventListener('click', function(ev) {
						if (isLocked) return;
						document.querySelectorAll('.overlay-box.is-selected').forEach(x => {
							if (x !== el) x.classList.remove('is-selected');
						});
						el.classList.add('is-selected');
					});

					el.onpointerdown = function (e) {
						// Don't drag if clicking controls or resize handle
						if (e.target.closest('.overlay-handle') || e.target.closest('.overlay-lock-btn') || e.target.closest('.overlay-del-btn')) return;
						if (!isLocked) {
							document.querySelectorAll('.overlay-box.is-selected').forEach(x => {
								if (x !== el) x.classList.remove('is-selected');
							});
							el.classList.add('is-selected');
						}
						e.preventDefault();
						sx = e.clientX; sy = e.clientY; il = el.offsetLeft; it = el.offsetTop;
						el.setPointerCapture(e.pointerId);
						el.onpointermove = function (ev) {
							let nx = il + ev.clientX - sx;
							let ny = it + ev.clientY - sy;
							const p = el.offsetParent;
							if (p) {
								if (!allowBleed) {
									const b = getParentBounds(p);
									nx = Math.max(b.minX, Math.min(b.maxX, nx));
									ny = Math.max(b.minY, Math.min(b.maxY, ny));
								} else {
									const maxX = p.clientWidth - el.offsetWidth;
									const maxY = p.clientHeight - el.offsetHeight;
									nx = Math.max(0, Math.min(maxX, nx));
									ny = Math.max(0, Math.min(maxY, ny));
								}
							}
							el.style.left = nx + 'px';
							el.style.top = ny + 'px';
						};
						el.onpointerup = function (ev) {
							el.onpointermove = null; el.onpointerup = null;
							try { el.releasePointerCapture(ev.pointerId); } catch (err) {}
							const p = el.offsetParent;
							if (onMove && p) {
								let pctX = (el.offsetLeft / p.offsetWidth * 100);
								let pctY = (el.offsetTop / p.offsetHeight * 100);
								if (!allowBleed) {
									const b = getParentBounds(p);
									const minPctX = (b.minX / p.offsetWidth * 100);
									const minPctY = (b.minY / p.offsetHeight * 100);
									const maxPctX = Math.max(minPctX, (b.maxX / p.offsetWidth * 100));
									const maxPctY = Math.max(minPctY, (b.maxY / p.offsetHeight * 100));
									pctX = Math.max(minPctX, Math.min(maxPctX, pctX));
									pctY = Math.max(minPctY, Math.min(maxPctY, pctY));
								} else {
									pctX = Math.max(0, Math.min(95, pctX));
									pctY = Math.max(0, Math.min(95, pctY));
								}
								onMove(Math.round(pctX * 10) / 10, Math.round(pctY * 10) / 10);
							}
						};
					};

					const handles = el.querySelectorAll('.overlay-resize-handle');
					handles.forEach(handle => {
						handle.onpointerdown = function (e) {
							e.preventDefault();
							e.stopPropagation();
							sx = e.clientX; sy = e.clientY;
							sw = el.offsetWidth; sh = el.offsetHeight;
							il = el.offsetLeft; it = el.offsetTop;
							const dir = handle.getAttribute('data-dir') || 'se';
							const img = el.querySelector('img');
							let ratio = 1;
							if (img && img.naturalWidth && img.naturalHeight) {
								ratio = img.naturalWidth / img.naturalHeight;
							} else if (sw && sh) {
								ratio = sw / sh;
							}
							handle.setPointerCapture(e.pointerId);
							handle.onpointermove = function (ev) {
								const dx = ev.clientX - sx;
								const dy = ev.clientY - sy;
								let nw = sw, nh = sh, nx = il, ny = it;
								const isEdge = (dir === 'e' || dir === 'w' || dir === 's' || dir === 'n');

								if (dir === 'e') {
									nw = Math.max(24, Math.round(sw + dx));
								} else if (dir === 'w') {
									nw = Math.max(24, Math.round(sw - dx));
									nx = il + (sw - nw);
								} else if (dir === 's') {
									nh = Math.max(24, Math.round(sh + dy));
								} else if (dir === 'n') {
									nh = Math.max(24, Math.round(sh - dy));
									ny = it + (sh - nh);
								} else if (dir === 'se') {
									let targetW = Math.abs(dx) > Math.abs(dy) ? (sw + dx) : ((sh + dy) * ratio);
									nw = Math.max(24, Math.round(targetW));
									nh = Math.max(24, Math.round(nw / ratio));
								} else if (dir === 'sw') {
									let targetW = Math.abs(dx) > Math.abs(dy) ? (sw - dx) : ((sh + dy) * ratio);
									nw = Math.max(24, Math.round(targetW));
									nh = Math.max(24, Math.round(nw / ratio));
									nx = il + (sw - nw);
								} else if (dir === 'ne') {
									let targetW = Math.abs(dx) > Math.abs(dy) ? (sw + dx) : ((sh - dy) * ratio);
									nw = Math.max(24, Math.round(targetW));
									nh = Math.max(24, Math.round(nw / ratio));
									ny = it + (sh - nh);
								} else if (dir === 'nw') {
									let targetW = Math.abs(dx) > Math.abs(dy) ? (sw - dx) : ((sh - dy) * ratio);
									nw = Math.max(24, Math.round(targetW));
									nh = Math.max(24, Math.round(nw / ratio));
									nx = il + (sw - nw);
									ny = it + (sh - nh);
								}

								const p = el.offsetParent;
								if (p) {
									let padL = 0, padT = 0, padR = 0, padB = 0;
									if (!allowBleed) {
										const cs = window.getComputedStyle ? window.getComputedStyle(p) : null;
										if (cs) {
											padL = parseFloat(cs.paddingLeft) || 0;
											padT = parseFloat(cs.paddingTop) || 0;
											padR = parseFloat(cs.paddingRight) || 0;
											padB = parseFloat(cs.paddingBottom) || 0;
										}
									}
									const boundMinX = padL;
									const boundMinY = padT;
									const boundMaxX = p.clientWidth - padR;
									const boundMaxY = p.clientHeight - padB;

									// Boundary clamping
									if (isEdge) {
										if (nx < boundMinX) {
											const diff = boundMinX - nx;
											nx = boundMinX;
											nw = Math.max(24, nw - diff);
										}
										if (ny < boundMinY) {
											const diff = boundMinY - ny;
											ny = boundMinY;
											nh = Math.max(24, nh - diff);
										}
										if (nx + nw > boundMaxX) {
											nw = Math.max(24, boundMaxX - nx);
										}
										if (ny + nh > boundMaxY) {
											nh = Math.max(24, boundMaxY - ny);
										}
									} else {
										// Corner clamping while strictly preserving aspect ratio
										if (nx < boundMinX) {
											const overflow = boundMinX - nx;
											nx = boundMinX;
											nw = Math.max(24, nw - overflow);
											nh = Math.max(24, Math.round(nw / ratio));
										}
										if (ny < boundMinY) {
											const overflow = boundMinY - ny;
											ny = boundMinY;
											nh = Math.max(24, nh - overflow);
											nw = Math.max(24, Math.round(nh * ratio));
										}
										if (nx + nw > boundMaxX) {
											nw = Math.max(24, boundMaxX - nx);
											nh = Math.max(24, Math.round(nw / ratio));
										}
										if (ny + nh > boundMaxY) {
											nh = Math.max(24, boundMaxY - ny);
											nw = Math.max(24, Math.round(nh * ratio));
										}
									}
								}

								el.style.left = nx + 'px';
								el.style.top = ny + 'px';
								el.style.width = nw + 'px';
								el.style.height = nh + 'px';
							};
							handle.onpointerup = function (ev) {
								handle.onpointermove = null; handle.onpointerup = null;
								try { handle.releasePointerCapture(ev.pointerId); } catch (err) {}
								const p = el.offsetParent;
								if (onMove && p) {
									let pctX = (el.offsetLeft / p.offsetWidth * 100);
									let pctY = (el.offsetTop / p.offsetHeight * 100);
									onMove(Math.round(pctX * 10) / 10, Math.round(pctY * 10) / 10);
								}
								if (onResize) onResize(Math.round(el.offsetWidth), Math.round(el.offsetHeight));
							};
						};
					});
				}
				/* ==============================================================
				   A4 PAGINATION
				   Measures each content block at true A4 content width, packs
				   them greedily into pages, then emits one .a4-page-frame per
				   page. Header, doc-control strip, and footer repeat on every
				   page. The title block shows only on page 1. The signature
				   block lands on the last page; if it doesn't fit there, it
				   gets its own page.
				   ============================================================== */
								function paginateReport(opts) {
					const blocks      = (opts.blocks || []).filter(Boolean);
					const headerHTML  = opts.headerHTML  || '';
					const footerHTML  = opts.footerHTML  || '';
					const titleHTML   = opts.titleHTML   || '';
					const sigHTML     = opts.sigHTML     || '';
					const overlayHTML = opts.overlayHTML || '';
					// ── Annexure support ──────────────────────────────────
					// firstFrameId: null/'' disables the id attribute, so the
					//   annexure does not collide with the main report's
					//   #a4TargetSheet.
					// frameClass: allows a distinguishing class on annexure
					//   frames (e.g. .a4-annexure-frame).
					const firstFrameId = opts.firstFrameId === undefined ? 'a4TargetSheet' : opts.firstFrameId;
					const activeReportTheme = 'theme-report-' + getCanonicalReportTheme(window.currentReportTheme);
					const frameClass   = (opts.frameClass || 'a4-page-frame') + ' ' + activeReportTheme;
					const pageOffset   = opts.pageOffset || 0;

					if (blocks.length === 0 && !sigHTML) {
						return { html: '', pageCount: 0 };
					}

// A4 at 96dpi. The frame is box-sizing:border-box with a 1.5px border, so the
				// usable box is PAGE minus padding AND border (3px), or every page
				// measures ~3px optimistic and print clips the last row.
				const BORDER = 3;
				const PAD_V = 2 * (6 * 96 / 25.4);
				const PAD_H = 2 * (8 * 96 / 25.4);
				const CONTENT_W = 794 - PAD_H - BORDER;
				const CONTENT_H = 1123 - PAD_V - BORDER;

					// Hidden measurement container matching the report font.
					const meas = document.createElement('div');
					meas.style.cssText =
						'position:absolute;left:-99999px;top:0;visibility:hidden;' +
						'width:' + CONTENT_W + 'px;padding:0;margin:0;border:0;' +
						'font-family:var(--report-font-family);' +
						'font-size:var(--report-font-size);' +
						'line-height:var(--report-line-height);background:#fff;';
					document.body.appendChild(meas);
					const measure = (html) => {
						meas.innerHTML = html || '';
						return meas.getBoundingClientRect().height;
					};

					const headerH = measure(headerHTML);
					const stripH  = measure(docControlStrip(1, 99));
					const titleH  = titleHTML ? measure(titleHTML) : 0;
					const footerH = measure(footerHTML);
					const sigH    = sigHTML ? measure(sigHTML) : 0;

					const SLACK = 4;
					const middleBudget = CONTENT_H - headerH - stripH - footerH - SLACK;
					const firstBudget  = middleBudget - titleH;

					const pages = [];
					let currentBlocks = [];
					let currentHeight = 0;
					let budget = firstBudget;
					let isFirst = true;

					for (let i = 0; i < blocks.length; i++) {
						const h = measure(blocks[i]);

						if (currentHeight + h > budget) {
							if (currentBlocks.length > 0) {
								pages.push({ blocks: currentBlocks, isFirst: isFirst });
								currentBlocks = [];
								currentHeight = 0;
								isFirst = false;
								budget = middleBudget;
							}
							// Block taller than a full page: give it its own page.
							if (h > middleBudget) {
								pages.push({ blocks: [blocks[i]], isFirst: isFirst });
								isFirst = false;
								budget = middleBudget;
								continue;
							}
						}
						currentBlocks.push(blocks[i]);
						currentHeight += h;
					}

					if (sigHTML) {
						if (currentHeight + sigH <= budget) {
							currentBlocks.push(sigHTML);
						} else {
							if (currentBlocks.length > 0) {
								pages.push({ blocks: currentBlocks, isFirst: isFirst });
							}
							currentBlocks = [sigHTML];
							isFirst = false;
						}
					}
					if (currentBlocks.length > 0) {
						pages.push({ blocks: currentBlocks, isFirst: isFirst });
					}
					if (pages.length === 0) {
						pages.push({ blocks: [], isFirst: true });
					}

					document.body.removeChild(meas);

					const total = pages.length;
					const totalDisplay = pageOffset + total;
					let out = '';
					for (let p = 0; p < total; p++) {
						const idAttr = (p === 0 && firstFrameId) ? (' id="' + firstFrameId + '"') : '';
						out += '<div class="' + frameClass + '"' + idAttr + '>' +
							(p === 0 ? overlayHTML : '') +
							'<div class="sheet-body">' +
								headerHTML +
								docControlStrip(pageOffset + p + 1, totalDisplay) +
								(pages[p].isFirst ? titleHTML : '') +
								pages[p].blocks.join('') +
								footerHTML +
							'</div>' +
						'</div>';
					}
					return { html: out, pageCount: total };
				}

				/* DATA SYNC */
				function syncCurrentData() {
					const g = id => document.getElementById(id);
					if (currentEngine === 'LIFTING') {
						const r = liftingBatch[activeIdx]; if (!r) return;
						r.reportNo       = g('in_reportNo').value;
						r.reportDate     = g('in_reportDate').value;
						r.jobRef         = g('in_jobRef').value;
						r.poRef          = g('in_poRef').value;
						r.companyAccred  = g('in_companyAccred').value;
						r.employer       = g('in_employer').value;
						r.premises       = g('in_premises').value;
						r.colourCode     = g('in_colourCode').value;
						r.standards      = g('in_standards').value;
						r.sopRef         = g('in_sopRef').value;
						r.description    = g('in_description').value;
						r.swl            = g('in_swl').value;
						r.quantity       = g('in_quantity').value;
						r.manufacturer   = g('in_manufacturer').value;
						r.model          = g('in_model').value;
						r.serial         = g('in_serial').value;
						r.plantId        = g('in_plantId').value;
						r.mfgYear        = g('in_mfgYear').value;
						r.lastExamDate   = g('in_lastExamDate').value;
						r.markingsLegible= g('in_markingsLegible').value;
						r.q_firstExam           = g('in_q_firstExam').value;
						r.q_installedCorrectly  = g('in_q_installedCorrectly').value;
						r.q_int6m               = g('in_q_int6m').value;
						r.q_int12m              = g('in_q_int12m').value;
						r.q_scheme              = g('in_q_scheme').value;
						r.q_exceptional         = g('in_q_exceptional').value;
						r.examParticulars          = g('in_examParticulars').value;
						r.additionalTesting        = g('in_additionalTesting').value;
						r.additionalTestingDetails = g('in_additionalTestingDetails').value;
						r.defectDesc               = g('in_defectDesc').value;
						r.dangerImm                = g('in_dangerImm').value;
						r.dangerTimeText           = g('in_dangerTimeText').value;
						r.isSafe                   = g('in_isSafe').value;
						r.remedies                 = g('in_remedies').value;
						r.examDate                 = g('in_examDate').value;
						r.nextExamDate             = g('in_nextExamDate').value;
						r.examinerName = g('in_examinerName').value;
						r.authName     = g('in_authName').value;
						if (r.examDate && !r.nextExamDate) {
							r.nextExamDate = r.q_int6m === 'YES'
								? calculateNextDate(r.examDate, 6)
								: (r.q_int12m === 'YES' ? calculateNextDate(r.examDate, 12) : '');
						}
					} else {
						const r = ndtBatch[activeIdx]; if (!r) return;
						r.reportNo   = g('ndt_in_reportNo').value;
						r.client     = g('ndt_in_client').value;
						r.location   = g('ndt_in_location').value;
						r.poRef      = g('ndt_in_poRef').value;
						r.testSpec   = g('ndt_in_testSpec').value;
						r.result     = g('ndt_in_result').value;
						r.itemDesc   = g('ndt_in_itemDesc').value;
						r.material   = g('ndt_in_material').value;
						r.remarks    = g('ndt_in_remarks').value;
						r.certLevel      = g('ndt_in_certLevel').value;
						r.certNo         = g('ndt_in_certNo').value;
						r.certExpiry     = g('ndt_in_certExpiry').value;
						r.visionTest     = g('ndt_in_visionTest').value;
						r.procedureNo    = g('ndt_in_procedureNo').value;
						r.acceptCriteria = g('ndt_in_acceptCriteria').value;
						r.calDue         = g('ndt_in_calDue').value;
						r.refBlock       = g('ndt_in_refBlock').value;
						r.surfaceCond    = g('ndt_in_surfaceCond').value;
						r.surfaceTemp    = g('ndt_in_surfaceTemp').value;
						r.lightIntensity = g('ndt_in_lightIntensity').value;
						r.couplant       = g('ndt_in_couplant').value;
						r.coverage       = g('ndt_in_coverage').value;
						r.inspectorName = g('ndt_in_inspectorName').value;
						r.witnessName   = g('ndt_in_witnessName').value;
					}
					readDocControl();
					readCorpInfo();

					// ── Validate only the record the user is currently editing.
					//    Running it on the *other* engine's active record was
					//    silently clamping fields the user never touched this
					//    turn — e.g. coercing an empty quantity to 0 on a
					//    background record whose index happened to be in range.
					if (currentEngine === 'LIFTING') {
						_validateRecordInPlace(liftingBatch[activeIdx]);
					} else {
						_validateRecordInPlace(ndtBatch[activeIdx]);
					}

					const curRec = currentEngine === 'LIFTING' ? liftingBatch[activeIdx] : ndtBatch[activeIdx];
					const activeLbl = g('lblActiveSerial');
					if (activeLbl && curRec) {
						activeLbl.textContent = curRec.reportNo || curRec.serial || '—';
					}
				}



				function renderBrandTab() {
					const container = document.getElementById('tab_brand');
					if (!container || container.dataset.rendered === 'true') return;
					container.innerHTML = 
						'<div class="card">' +
							'<h3><span>Institutional Overlays</span><span class="micro-toggle on" id="pill_overlays" onclick="toggleFeature(\'overlays\')"><span class="toggle-dot"></span>OVERLAYS: ON</span></h3>' +
							'<div class="row cols-2">' +
								'<div class="fg">' +
									'<div class="fg-hdr" style="display:flex;align-items:center;gap:4px;">' +
										'<span class="fg-title" style="flex:0 0 auto;">Header Banner</span>' +
										'<button type="button" class="btn btn-accent" style="padding:1px 5px;font-size:9px;min-height:auto;flex-shrink:0;" onclick="openApplyToAllDialog(\'headerBanner\')" title="Apply header banner to all batch records">⚡</button>' +
										'<div style="display:flex;gap:3px;margin-left:auto;align-items:center;flex-shrink:0;">' +
											'<span class="micro-toggle" id="pill_bleed_headerBanner" onclick="toggleAssetBleed(\'headerBanner\')" title="Allow header banner to bleed across margins"><span class="toggle-dot"></span>BLEED</span>' +
											'<span class="micro-toggle on" id="pill_asset_headerBanner" onclick="toggleAssetEnable(\'headerBanner\')"><span class="toggle-dot"></span>ON</span>' +
										'</div>' +
									'</div>' +
									'<div class="sig-upload" id="assetWrap_headerBanner">' +
										'<input type="file" id="assetFile_headerBanner" accept="image/*" style="display:none;" tabindex="-1" onchange="uploadAssetFrom(event,\'headerBanner\')">' +
										'<button type="button" class="sig-upload-btn" id="assetBtn_headerBanner" onclick="assetTileClick(\'headerBanner\')"><span class="sig-empty">+ ADD IMAGE</span></button>' +
										'<button type="button" class="thumb-del" id="assetDel_headerBanner" onclick="deleteAssetThumb(\'headerBanner\')" hidden>✕</button>' +
									'</div>' +
								'</div>' +
								'<div class="fg">' +
									'<div class="fg-hdr" style="display:flex;align-items:center;gap:4px;">' +
										'<span class="fg-title" style="flex:0 0 auto;">Footer Band</span>' +
										'<button type="button" class="btn btn-accent" style="padding:1px 5px;font-size:9px;min-height:auto;flex-shrink:0;" onclick="openApplyToAllDialog(\'footerBanner\')" title="Apply footer band to all batch records">⚡</button>' +
										'<div style="display:flex;gap:3px;margin-left:auto;align-items:center;flex-shrink:0;">' +
											'<span class="micro-toggle" id="pill_bleed_footerBanner" onclick="toggleAssetBleed(\'footerBanner\')" title="Allow footer band to bleed across margins"><span class="toggle-dot"></span>BLEED</span>' +
											'<span class="micro-toggle on" id="pill_asset_footerBanner" onclick="toggleAssetEnable(\'footerBanner\')"><span class="toggle-dot"></span>ON</span>' +
										'</div>' +
									'</div>' +
									'<div class="sig-upload" id="assetWrap_footerBanner">' +
										'<input type="file" id="assetFile_footerBanner" accept="image/*" style="display:none;" tabindex="-1" onchange="uploadAssetFrom(event,\'footerBanner\')">' +
										'<button type="button" class="sig-upload-btn" id="assetBtn_footerBanner" onclick="assetTileClick(\'footerBanner\')"><span class="sig-empty">+ ADD IMAGE</span></button>' +
										'<button type="button" class="thumb-del" id="assetDel_footerBanner" onclick="deleteAssetThumb(\'footerBanner\')" hidden>✕</button>' +
									'</div>' +
								'</div>' +
								'<div class="fg">' +
									'<div class="fg-hdr" style="display:flex;align-items:center;gap:4px;">' +
										'<span class="fg-title" style="flex:0 0 auto;">Company Logo</span>' +
										'<button type="button" class="btn btn-accent" style="padding:1px 5px;font-size:9px;min-height:auto;flex-shrink:0;" onclick="openApplyToAllDialog(\'logo\')" title="Apply logo to all batch records">⚡</button>' +
										'<div style="display:flex;gap:3px;margin-left:auto;align-items:center;flex-shrink:0;">' +
											'<span class="micro-toggle" id="pill_bleed_logo" onclick="toggleAssetBleed(\'logo\')" title="Allow logo to overlap paper margins"><span class="toggle-dot"></span>BLEED</span>' +
											'<span class="micro-toggle on" id="pill_asset_logo" onclick="toggleAssetEnable(\'logo\')"><span class="toggle-dot"></span>ON</span>' +
										'</div>' +
									'</div>' +
									'<div class="sig-upload" id="assetWrap_logo">' +
										'<input type="file" id="assetFile_logo" accept="image/*" style="display:none;" tabindex="-1" onchange="uploadAssetFrom(event,\'logo\')">' +
										'<button type="button" class="sig-upload-btn" id="assetBtn_logo" onclick="assetTileClick(\'logo\')"><span class="sig-empty">+ ADD LOGO</span></button>' +
										'<button type="button" class="thumb-del" id="assetDel_logo" onclick="deleteAssetThumb(\'logo\')" hidden>✕</button>' +
									'</div>' +
								'</div>' +
								'<div class="fg">' +
									'<div class="fg-hdr" style="display:flex;align-items:center;gap:4px;">' +
										'<span class="fg-title" style="flex:0 0 auto;">Stamp</span>' +
										'<button type="button" class="btn btn-accent" style="padding:1px 5px;font-size:9px;min-height:auto;flex-shrink:0;" onclick="openApplyToAllDialog(\'stamp\')" title="Apply active record stamp to all batch records">⚡</button>' +
										'<div style="display:flex;gap:3px;margin-left:auto;align-items:center;flex-shrink:0;">' +
											'<span class="micro-toggle on" id="pill_bleed_stamp" onclick="toggleAssetBleed(\'stamp\')" title="Allow stamp to bleed over report edges"><span class="toggle-dot"></span>BLEED</span>' +
											'<span class="micro-toggle on" id="pill_asset_stamp" onclick="toggleAssetEnable(\'stamp\')"><span class="toggle-dot"></span>ON</span>' +
										'</div>' +
									'</div>' +
									'<div class="sig-upload" id="assetWrap_stamp">' +
										'<input type="file" id="assetFile_stamp" accept="image/*" style="display:none;" tabindex="-1" onchange="uploadAssetFrom(event,\'stamp\')">' +
										'<button type="button" class="sig-upload-btn" id="assetBtn_stamp" onclick="assetTileClick(\'stamp\')"><span class="sig-empty">+ ADD IMAGE</span></button>' +
										'<button type="button" class="thumb-del" id="assetDel_stamp" onclick="deleteAssetThumb(\'stamp\')" hidden>✕</button>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>' +
						'<div class="card">' +
							'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);flex-wrap:wrap;gap:6px;">' +
								'<h3 style="margin:0;"><span>Accreditation Badges & Logos</span></h3>' +
								'<div style="display:inline-flex;gap:6px;align-items:center;">' +
									'<button type="button" class="btn btn-accent" style="font-size:var(--ui-font-xs);padding:3px 8px;" onclick="openApplyToAllDialog(\'accreds\')" title="Apply current accreditation logos to all batch records">⚡ Apply to All</button>' +
									'<button type="button" class="btn btn-accent" style="font-size:var(--ui-font-xs);padding:3px 10px;" onclick="addAccreditationLogo()">+ Add Accreditation Logo</button>' +
								'</div>' +
							'</div>' +
							'<div class="row cols-3" id="accredLogosContainer"></div>' +
						'</div>' +
						'<div class="card">' +
							'<h3><span>Corporate Banner Content</span><span class="micro-toggle on" id="pill_corpBanners" onclick="toggleFeature(\'corp\')"><span class="toggle-dot"></span>BANNERS: ON</span></h3>' +
							'<div class="row cols-2">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Body Name</span></div><input type="text" id="ci_body" oninput="debouncedSync()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Accreditation</span></div><input type="text" id="ci_accred" oninput="debouncedSync()"></div>' +
							'</div>' +
							'<div class="row cols-3">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Phone</span></div><input type="text" id="ci_phone" class="mono" oninput="debouncedSync()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Email</span></div><input type="email" id="ci_email" class="mono" oninput="debouncedSync()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Web</span></div><input type="text" id="ci_web" class="mono" oninput="debouncedSync()"></div>' +
							'</div>' +
							'<div class="row">' +
								'<div class="fg" style="grid-column:span 12;">' +
									'<div class="fg-hdr"><span class="fg-title">Address</span></div>' +
									'<textarea id="ci_addr" rows="2" oninput="debouncedSync()"></textarea>' +
								'</div>' +
							'</div>' +
							'<div class="row">' +
								'<div class="fg" style="grid-column:span 12;">' +
									'<div class="fg-hdr"><span class="fg-title">Footer Disclaimer</span></div>' +
									'<textarea id="ci_footnote" rows="2" oninput="debouncedSync()"></textarea>' +
								'</div>' +
							'</div>' +
						'</div>' +
						'<div class="card">' +
							'<h3><span>ISO Document Control</span><span class="micro-toggle on" id="pill_docControl" onclick="toggleDocControl()"><span class="toggle-dot"></span>ON</span></h3>' +
							'<div class="row cols-4">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Doc No</span></div><input type="text" id="dc_docNo" class="mono" value="QMS-CERT-LOLER-044" oninput="debouncedSync()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Rev</span></div><input type="text" id="dc_rev" class="mono" value="03" oninput="debouncedSync()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Rev Date</span></div><input type="date" id="dc_revDate" value="2026-01-15" oninput="debouncedSync()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">No. Format</span></div><input type="text" id="dc_reportNoPattern" class="mono" value="{PREFIX}-{DATE}-0{SEQ}" title="Pattern tokens: {PREFIX}, {DATE} (YYYYMMDD), {YEAR}, {SEQ}" oninput="debouncedSync()"></div>' +
							'</div>' +
						'</div>' +
						'<div class="card">' +
							'<h3><span>QR Dispatch Engine</span><span class="micro-toggle on" id="pill_qrEngine" onclick="toggleFeature(\'qr\')"><span class="toggle-dot"></span>QR: ON</span></h3>' +
							'<div class="row">' +
								'<div class="fg" style="grid-column:span 12;">' +
									'<div class="fg-hdr"><span class="fg-title">Channel</span></div>' +
									'<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
										'<button type="button" class="btn btn-accent" id="qr_ch_whatsapp" onclick="setQrChannel(\'WHATSAPP\')">📱 WhatsApp</button>' +
										'<button type="button" class="btn" id="qr_ch_email" onclick="setQrChannel(\'EMAIL\')">✉ Email</button>' +
									'</div>' +
								'</div>' +
							'</div>' +
							'<div class="row cols-3">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Phone</span></div><input type="text" id="waPhone" value="+201000000000" oninput="debouncedSync();updateQrBudget()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Email</span></div><input type="email" id="waEmail" value="verify@vanguard-inspection.com" oninput="debouncedSync();updateQrBudget()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Prefix</span></div><input type="text" id="waMsg" value="Verification Inquiry for Report No:" oninput="debouncedSync();updateQrBudget()"></div>' +
							'</div>' +
							'<div class="row">' +
								'<div class="fg" style="grid-column:span 12;">' +
									'<div class="fg-hdr"><span class="fg-title">Dispatch Link</span></div>' +
									'<input type="text" id="qrLinkPreview" class="mono" readonly>' +
									'<div id="qrBudget" style="margin-top:4px;font-family:var(--font-data);font-size:var(--ui-font-xs);color:var(--ink-muted);" aria-live="polite"></div>' +
								'</div>' +
							'</div>' +
							'<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
								'<button class="btn btn-accent" style="width:100%;font-weight:700;" onclick="dispatchVerification()">▶ Test QR</button>' +
							'</div>' +
						'</div>';
					container.dataset.rendered = 'true';
					if (typeof restorePreferences === 'function') {
						const g = id => document.getElementById(id);
						if (g('ci_body')) g('ci_body').value = corpInfo.body || '';
						if (g('ci_accred')) g('ci_accred').value = corpInfo.accred || '';
						if (g('ci_addr')) g('ci_addr').value = corpInfo.addr || '';
						if (g('ci_phone')) g('ci_phone').value = corpInfo.phone || '';
						if (g('ci_email')) g('ci_email').value = corpInfo.email || '';
						if (g('ci_web')) g('ci_web').value = corpInfo.web || '';
						if (g('ci_footnote')) g('ci_footnote').value = corpInfo.footnote || '';
						if (g('dc_docNo')) g('dc_docNo').value = docControl.docNo || 'QMS-CERT-LOLER-044';
						if (g('dc_rev')) g('dc_rev').value = docControl.rev || '03';
						if (g('dc_revDate')) g('dc_revDate').value = docControl.revDate || '2026-01-15';
						if (g('dc_reportNoPattern')) g('dc_reportNoPattern').value = docControl.reportNoPattern || '{PREFIX}-{DATE}-0{SEQ}';
					}
					if (typeof renderAssetThumbs === 'function') renderAssetThumbs();
				}

				function renderChecklistTab() {
					const container = document.getElementById('tab_checklist');
					if (!container || container.dataset.rendered === 'true') return;
					container.innerHTML =
						'<div class="card">' +
							'<h3><span>Verification Checklist</span><span class="micro-toggle off" id="pill_checklistToggle" onclick="toggleChecklistPage()"><span class="toggle-dot"></span>CHECKLIST: OFF</span></h3>' +
							'<div id="checklistItemList" style="margin-bottom:8px;"></div>' +
							'<button class="btn btn-accent" onclick="addChecklistItem()">+ Add Row</button>' +
						'</div>';
					container.dataset.rendered = 'true';
					if (typeof renderChecklistBuilder === 'function') renderChecklistBuilder();
					if (typeof updateFeaturePills === 'function') updateFeaturePills();
				}

				function renderEvidenceTab() {
					const container = document.getElementById('tab_evidence');
					if (!container || container.dataset.rendered === 'true') return;
					container.innerHTML =
						'<div class="card">' +
							'<h3><span id="evidenceHeaderTitle">Evidence Engine (Photos)</span><div style="display:flex;gap:8px;align-items:center;"><button type="button" class="btn btn-accent" style="padding:2px 10px;font-size:var(--ui-font-xs);min-height:auto;" onclick="addPhotoSlot()">+ Add Photo Field</button><span class="micro-toggle off" id="pill_evidencePhotos" onclick="toggleEvidencePage()"><span class="toggle-dot"></span>IN REPORT: OFF</span></div></h3>' +
							'<div class="photo-grid" id="photo_slots_container"></div>' +
						'</div>';
					container.dataset.rendered = 'true';
					if (typeof renderPhotoTiles === 'function') renderPhotoTiles();
					if (typeof updateFieldStates === 'function') updateFieldStates();
				}

