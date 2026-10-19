				/* PREVIEW RENDERER */
				function estimateRecordPages(r, engine) {
					if (!r) return 1;
					const eng = engine || currentEngine;
					if (eng === 'LIFTING') {
						const ann = !!(r.includePuwer === true && r.puwerRows && r.puwerRows.length)
							|| !!(r.includeChecklist === true && r.checklist && r.checklist.length)
							|| !!(r.includePhotos === true && (r.photos || []).some(p => p));
						return ann ? 2 : 1;
					} else {
						const ann = !!(r.includeChecklist === true && r.checklist && r.checklist.length > 0)
							|| !!(r.includePhotos === true && (r.photos || []).some(p => p));
						return ann ? 2 : 1;
					}
				}
				window.estimateRecordPages = estimateRecordPages;

				function buildInstitutionalOverlays(r) {
					if (featureToggles.overlays === false) return '';
					let ov = '';
					const handlesHTML = 
						'<div class="overlay-resize-handle handle-nw no-print" data-dir="nw" title="Resize top-left"></div>' +
						'<div class="overlay-resize-handle handle-n no-print" data-dir="n" title="Resize top"></div>' +
						'<div class="overlay-resize-handle handle-ne no-print" data-dir="ne" title="Resize top-right"></div>' +
						'<div class="overlay-resize-handle handle-e no-print" data-dir="e" title="Resize right"></div>' +
						'<div class="overlay-resize-handle handle-se no-print" data-dir="se" title="Resize bottom-right"></div>' +
						'<div class="overlay-resize-handle handle-s no-print" data-dir="s" title="Resize bottom"></div>' +
						'<div class="overlay-resize-handle handle-sw no-print" data-dir="sw" title="Resize bottom-left"></div>' +
						'<div class="overlay-resize-handle handle-w no-print" data-dir="w" title="Resize left"></div>';
					// 1. Official Stamp
					if (r.stampUpload && r.stampEnabled !== false) {
						const s = r.stampPos || { x: 70, y: 76 };
						const sw = (r.stampSize && r.stampSize.w) ? r.stampSize.w : 75;
						const sh = (r.stampSize && r.stampSize.h) ? r.stampSize.h : 75;
						ov += '<div id="dragStamp" class="draggable-item overlay-box" style="left:' + s.x + '%;top:' + s.y + '%;width:' + sw + 'px;height:' + sh + 'px;">' +
							'<img src="' + r.stampUpload + '" style="width:100%;height:100%;object-fit:contain;pointer-events:none;">' +
							handlesHTML +
						'</div>';
					}
					// 2. Company Logo
					if (assets.logo && assets.logoEnabled !== false) {
						const lp = assets.logoPos || { x: 4, y: 3 };
						const lw = (assets.logoSize && assets.logoSize.w) ? assets.logoSize.w : 120;
						const lh = (assets.logoSize && assets.logoSize.h) ? assets.logoSize.h : 48;
						ov += '<div id="dragLogo" class="draggable-item overlay-box" style="left:' + lp.x + '%;top:' + lp.y + '%;width:' + lw + 'px;height:' + lh + 'px;">' +
							'<img src="' + assets.logo + '" style="width:100%;height:100%;object-fit:contain;pointer-events:none;">' +
							handlesHTML +
						'</div>';
					}
					// 3. Accreditation Badges
					if (Array.isArray(assets.accreds)) {
						assets.accreds.forEach((acc, i) => {
							if (!acc.img || acc.enabled === false) return;
							const ap = acc.pos || { x: (72 + i * 8), y: 3 };
							const aw = (acc.size && acc.size.w) ? acc.size.w : 55;
							const ah = (acc.size && acc.size.h) ? acc.size.h : 36;
							const elId = 'dragAccred_' + i;
							ov += '<div id="' + elId + '" class="draggable-item overlay-box" style="left:' + ap.x + '%;top:' + ap.y + '%;width:' + aw + 'px;height:' + ah + 'px;">' +
								'<img src="' + acc.img + '" alt="' + sanitizeForReport(acc.name || 'Accreditation') + '" style="width:100%;height:100%;object-fit:contain;pointer-events:none;">' +
								handlesHTML +
							'</div>';
						});
					}
					return ov;
				}

				function bindInstitutionalOverlays(r) {
					const ds = document.getElementById('dragStamp');
					if (ds) {
						const allowBleed = r.stampBleed !== false; // defaults to true
						makeDraggable(ds,
							(x, y) => { r.stampPos = { x, y }; if (typeof schedulePersist === 'function') schedulePersist(); },
							(w, h) => { r.stampSize = { w, h }; if (typeof schedulePersist === 'function') schedulePersist(); },
							!!r.stampLocked,
							allowBleed
						);
					}
					const dl = document.getElementById('dragLogo');
					if (dl) {
						const allowBleed = !!assets.logoBleed; // defaults to false
						makeDraggable(dl,
							(x, y) => { assets.logoPos = { x, y }; if (typeof schedulePersist === 'function') schedulePersist(); },
							(w, h) => { assets.logoSize = { w, h }; if (typeof schedulePersist === 'function') schedulePersist(); },
							!!assets.logoLocked,
							allowBleed
						);
					}
					if (Array.isArray(assets.accreds)) {
						assets.accreds.forEach((acc, i) => {
							const el = document.getElementById('dragAccred_' + i);
							if (el) {
								const allowBleed = !!acc.bleed; // defaults to false
								makeDraggable(el,
									(x, y) => { acc.pos = { x, y }; if (typeof schedulePersist === 'function') schedulePersist(); },
									(w, h) => { acc.size = { w, h }; if (typeof schedulePersist === 'function') schedulePersist(); },
									!!acc.locked,
									allowBleed
								);
							}
						});
					}
				}

				function toggleOverlayLock(target) {
					const r = activeRec();
					if (target === 'stamp') {
						if (r) r.stampLocked = !r.stampLocked;
					} else if (target === 'logo') {
						assets.logoLocked = !assets.logoLocked;
					} else if (typeof target === 'string' && target.indexOf('accred_') === 0) {
						const idx = parseInt(target.replace('accred_', ''), 10);
						if (assets.accreds && assets.accreds[idx]) {
							assets.accreds[idx].locked = !assets.accreds[idx].locked;
						}
					}
					renderPreview();
					if (typeof schedulePersist === 'function') schedulePersist();
				}

				/* Annexure blocks, shared by both engines.
				   renderPreviewFull() had a byte-identical copy of the photo grid
				   and of the whole annexure pagination in the LIFTING and NDT
				   branches, so a change to either had to be made twice and the two
				   copies could drift. These two helpers are the single source. */
				function buildPhotoBlock(r) {
					if (r.includePhotos !== true) return '';
					// Never emit an '@idb:' marker as an <img src> - ERR_FILE_NOT_FOUND.
					const present = (r.photos || []).map((p, i) => ({ p, i })).filter(x => x.p && x.p.indexOf('@idb:') !== 0);
					if (!present.length) return '';
					let rows = '';
					for (let k = 0; k < present.length; k += 3) {
						const slice = present.slice(k, k + 3);
						const cells = slice.map(x => '<td style="text-align:center;vertical-align:top;padding:3px;"><img src="' + x.p + '" style="max-width:100%;max-height:80px;object-fit:contain;display:block;margin:0 auto;"><div class="report-caption">PHOTO #' + (x.i + 1) + '</div></td>');
						while (cells.length < 3) cells.push('<td></td>');
						rows += '<tr>' + cells.join('') + '</tr>';
					}
					return '<table class="ctbl" style="margin-top:6px;"><colgroup><col style="width:33.33%"><col style="width:33.33%"><col style="width:33.34%"></colgroup><tr><td colspan="3" class="csec">Photographic Evidence</td></tr>' + rows + '</table>';
				}
				// Paginates the annexure blocks, then appends them after the main
				// report and repoints the main report's "of N" at the grand total.
				// The main report is paginated first with its own count, so its
				// counter is patched afterwards -- a single-pass regex on stable
				// markup.
				function paginateAnnexure(o) {
					const pages = paginateReport({
						blocks: (o.blocks || []).filter(Boolean),
						headerHTML: o.headerHTML || '',
						footerHTML: o.footerHTML || '',
						titleHTML: o.titleHTML || '',
						sigHTML: '',
						overlayHTML: '',
						firstFrameId: null,
						pageOffset: o.pageOffset || 0,
						frameClass: 'a4-page-frame a4-annexure-frame',
						allowEmpty: false
					});
					const grand = (o.pageOffset || 0) + pages.pageCount;
					return o.mainHtml.replace(
						/(<span class="dc-l">Page<\/span>\s*\d+\s+of\s+)\d+/g,
						'$1' + grand
					) + pages.html;
				}
				function renderPreviewFull(container, record){
					const lp=document.getElementById('qrLinkPreview');if(lp)lp.value=buildVerificationLink(record || activeRec());
					updateQrBudget();
					const HB = resolveHeader(), FB = resolveFooter(), showQr = featureToggles.qr !== false;
					const tick = c => c ? '<span class="tick-box">&#10003;</span>' : '<span class="tick-box">&nbsp;</span>';
					// Hoisted to function scope: the LIFTING branch shadows it,
					// the NDT branch reads the outer binding for its annexure.
					let photoBlk = '';

					if (currentEngine === 'LIFTING') {
						const r=record||liftingBatch[activeIdx]||{};
						if (!r.puwerRows) r.puwerRows = defaultPuwerRows();
						if (!r.examParticulars) r.examParticulars = DEFAULT_EXAM_PARTICULARS;
						const tg = r.fieldToggles || {}, isOn = k => tg[k] !== false;
						const secTg = r.sectionToggles || {}, isSecOn = k => secTg[k] !== false;
						const isImm = r.dangerImm === 'YES', isSafe = r.isSafe === 'YES' && !isImm;
						const annPage = !!(r.includePuwer === true && r.puwerRows && r.puwerRows.length)
             || !!(r.includeChecklist === true && r.checklist && r.checklist.length)
             || !!(r.includePhotos === true && (r.photos || []).some(p => p));
						const totalPages = annPage ? 2 : 1;
						const ft = totalPages;

						let t1 = '';
						if (isSecOn('sec_loler_1')) {
							const rows = [];
							const r0 = [];
							if (isOn('employer') && r.employer) {
								r0.push(lblSpan('Employer / Client') + valRaw('employer', sanitizeForReport(r.employer)));
							}
							if (isOn('premises') && r.premises) {
								r0.push(lblSpan('Premises Where Examination Made') + valRaw('premises', sanitizeForReport(r.premises)));
							}
							if (r0.length) rows.push(buildColspanRow(r0, 4));

							const r1 = [];
							if (isOn('companyAccred')) r1.push({ html: lblSpan('Inspection Body') + valSpan('companyAccred', r.companyAccred), span: (isOn('reportNo') || isOn('reportDate')) ? 2 : 4 });
							if (isOn('reportNo')) r1.push({ html: lblSpan('Report No') + valSpan('reportNo', r.reportNo, '', true), span: 1 });
							if (isOn('reportDate')) r1.push({ html: lblSpan('Date of Report') + valSpan('reportDate', r.reportDate, '', true), span: 1 });
							if (r1.length) {
								rows.push('<tr>' + r1.map(c => '<td' + (c.span > 1 ? ' colspan="' + c.span + '"' : '') + '>' + c.html + '</td>').join('') + '</tr>');
							}

							const r2 = [];
							if (isOn('jobRef')) r2.push(lblSpan('Job Reference') + valRaw('jobRef', sanitizeForReport(r.jobRef || ''), '', true));
							if (isOn('poRef')) r2.push(lblSpan('P.O. Reference') + valRaw('poRef', sanitizeForReport(r.poRef || ''), '', true));
							if (r2.length) rows.push(buildColspanRow(r2, 4));

							if (rows.length) t1 = '<table class="ctbl"><colgroup><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup>' + rows.join('') + '</table>';
						}
						let t2 = '';
						if (isSecOn('sec_loler_2')) {
							const rows = [];
							const hasDesc = isOn('description');
							const hasSwl = isOn('swl');
							const hasQty = isOn('quantity');

							if (hasDesc && hasSwl && hasQty) {
								rows.push('<tr><td colspan="2">' + lblSpan('Description') + valRaw('description', sanitizeForReport(r.description)) + '</td>'
									+ '<td>' + lblSpan('Safe Working Load(s)') + valSpan('swl', r.swl, 'font-size:8.5pt;font-weight:900;color:var(--report-accent);', true) + '</td>'
									+ '<td>' + lblSpan('Quantity') + valSpan('quantity', r.quantity || '1') + '</td></tr>');
							} else {
								const ds = [];
								if (hasDesc) ds.push(lblSpan('Description') + valRaw('description', sanitizeForReport(r.description)));
								if (hasSwl) ds.push(lblSpan('Safe Working Load(s)') + valSpan('swl', r.swl, 'font-size:8.5pt;font-weight:900;color:var(--report-accent);', true));
								if (ds.length === 2) rows.push('<tr><td colspan="3">' + ds[0] + '</td><td>' + ds[1] + '</td></tr>');
								else if (ds.length) rows.push(buildColspanRow(ds, 4));

								if (hasQty) {
									rows.push(buildColspanRow([lblSpan('Quantity') + valSpan('quantity', r.quantity || '1')], 4));
								}
							}

							const i1 = [];
							if (isOn('manufacturer')) i1.push(lblSpan('Manufacturer') + valSpan('manufacturer', r.manufacturer));
							if (isOn('model')) i1.push(lblSpan('Model') + valSpan('model', r.model));
							if (isOn('serial')) i1.push(lblSpan('Serial No') + valSpan('serial', r.serial, '', true));
							if (isOn('plantId')) i1.push(lblSpan('Asset ID') + valSpan('plantId', r.plantId, '', true));
							if (i1.length) rows.push(buildColspanRow(i1, 4));

							const i2 = [];
							if (isOn('mfgYear')) i2.push(lblSpan('Year of Mfg') + valSpan('mfgYear', r.mfgYear));
							if (isOn('lastExamDate')) i2.push(lblSpan('Date of Last Thorough Examination') + valSpan('lastExamDate', r.lastExamDate || 'Unknown'));
							if (isOn('colourCode')) i2.push(lblSpan('Colour Code') + valSpan('colourCode', r.colourCode));
							if (isOn('markingsLegible')) i2.push(lblSpan('Marking Status') + valSpan('markingsLegible', r.markingsLegible || 'YES'));
							if (i2.length) rows.push(buildColspanRow(i2, 4));

							const st = [];
							if (isOn('standards')) st.push(lblSpan('Applicable Technical Standards') + valSpan('standards', r.standards));
							if (isOn('sopRef')) st.push(lblSpan('Inspection SOP Reference') + valSpan('sopRef', r.sopRef));
							if (st.length) rows.push(buildColspanRow(st, 4));

							if (rows.length) t2 = '<table class="ctbl"><colgroup><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup><tr><td colspan="4" class="csec">Equipment Specification &amp; Governing Standards</td></tr>' + rows.join('') + '</table>';
						}
						let t3 = '';
						if (isSecOn('sec_loler_3')) {
							const line = (l, y) => '<div class="qline"><span class="ql">' + l + '</span><span class="qt">YES' + tick(y) + 'NO' + tick(!y) + '</span></div>';
							const init = [], int = [];
							if (isOn('q_firstExam')) init.push(line('First examination after installation?', r.q_firstExam === 'YES'));
							if (isOn('q_installedCorrectly')) init.push(line('If new installation, installed correctly?', r.q_installedCorrectly === 'YES'));
							if (isOn('q_int6m')) int.push(line('Within an interval of 6 months?', r.q_int6m === 'YES'));
							if (isOn('q_int12m')) int.push(line('Within an interval of 12 months?', r.q_int12m === 'YES'));
							if (isOn('q_scheme')) int.push(line('In accordance with examination scheme?', r.q_scheme === 'YES'));
							if (isOn('q_exceptional')) int.push(line('After exceptional circumstances?', r.q_exceptional === 'YES'));
							const cells = [];
							if (init.length) cells.push('<div class="qcol-head">Initial Installation:</div>' + init.join(''));
							if (int.length) cells.push('<div class="qcol-head">Correct Examination Schedule:</div>' + int.join(''));
							const rh = buildColspanRow(cells, 2);
							if (rh) t3 = '<table class="ctbl"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tr><td colspan="2" class="csec">Reason for Thorough Examination</td></tr>' + rh + '</table>';
						}
						let t4 = '';
						if (isSecOn('sec_loler_4')) {
							const rows = [];
							if (isOn('examParticulars')) rows.push('<tr><td colspan="2">' + lblSpan('Particulars of Examination Carried Out') + valRaw('examParticulars', sanitizeForReport(r.examParticulars)) + '</td></tr>');
							if (isOn('additionalTesting')) {
								const ay = r.additionalTesting === 'YES';
								const hasDetails = (r.additionalTestingDetails && r.additionalTestingDetails.trim().length > 0);
								rows.push('<tr><td colspan="2">' + lblSpan('Has Any Additional Testing Been Carried Out?') +
									'<div><strong>YES ' + tick(ay) + ' &nbsp; NO ' + tick(!ay) + '</strong></div>' +
									((ay || hasDetails) && isOn('additionalTestingDetails') ? '<div style="margin-top:2px;">' + lblSpan('Particulars of Additional Testing') + valSpan('additionalTestingDetails', r.additionalTestingDetails) + '</div>' : '') +
									'</td></tr>');
							} else if (isOn('additionalTestingDetails') && r.additionalTestingDetails && r.additionalTestingDetails.trim().length > 0) {
								rows.push('<tr><td colspan="2">' + lblSpan('Particulars of Additional Testing') + valSpan('additionalTestingDetails', r.additionalTestingDetails) + '</td></tr>');
							}
							if (rows.length) t4 = '<table class="ctbl"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tr><td colspan="2" class="csec">Particulars of Examination &amp; Additional Testing</td></tr>' + rows.join('') + '</table>';
						}
						// Only render the proof/calibration block when the record
						// actually contains proof traceability. Blank N/A rows on
						// a routine LOLER exam are misleading to a reader.
						const _hasProofData = isSecOn('sec_loler_4') && !!(
							(r.proofLoadApplied && r.proofLoadApplied.trim() && r.proofLoadApplied !== 'Visual & Dimensional') ||
							(r.lastProofDetails && r.lastProofDetails.trim() && r.lastProofDetails !== 'N/A') ||
							(r.nextProofDate && r.nextProofDate.trim())
						);
						const t5 = _hasProofData
							? '<table class="ctbl"><colgroup><col style="width:40%"><col style="width:30%"><col style="width:30%"></colgroup><tr><td colspan="3" class="csec">Proof Testing &amp; Calibration Traceability</td></tr><tr><td>' + lblSpan('Tests Applied') + valSpan('proofLoadApplied', r.proofLoadApplied || 'Visual & Dimensional') + '</td><td>' + lblSpan('Last Proof') + valSpan('lastProofDetails', r.lastProofDetails || 'N/A') + '</td><td>' + lblSpan('Next Proof Due') + valSpan('nextProofDate', r.nextProofDate || 'N/A') + '</td></tr></table>'
							: '';

						let t6 = '';
						if (isSecOn('sec_loler_4')) {
							const rows = [];
							if (isOn('defectDesc')) rows.push('<tr><td colspan="3">' + lblSpan('Identification of Any Part Found Defective (state NONE)') + valRaw('defectDesc', sanitizeForReport(r.defectDesc)) + '</td></tr>');
							const risk = [];
							if (isOn('dangerImm')) risk.push(lblSpan('Existing or imminent danger to persons? (reportable)') + '<div><strong>YES ' + tick(isImm) + ' &nbsp; NO ' + tick(!isImm) + '</strong></div>');
							if (isOn('dangerTimeText')) risk.push(lblSpan('Defect not yet dangerous but could become — date by when') + valSpan('dangerTimeText', r.dangerTimeText || 'N/A'));
							if (isOn('remedies')) risk.push(lblSpan('Particulars of repair / renewal / alteration to remedy') + valSpan('remedies', r.remedies || 'None'));
							if (risk.length) rows.push(buildColspanRow(risk, 3));
							if (isOn('isSafe')) {
								const hd = (r.verdictLabel && r.verdictLabel.trim()) ? r.verdictLabel.trim() : 'IS THIS EQUIPMENT SAFE TO OPERATE';
								const cp = isSafe ? 'YES — WOULD BE SAFE' : 'NO — UNSAFE';
								const dp = (r.verdictText && r.verdictText.trim()) ? r.verdictText.trim() : cp;
								const cls = (r.verdictText && r.verdictText.trim()) ? (/NO|UNSAFE|FAIL/.test(dp) ? 'fail-text' : 'pass-text') : (isSafe ? 'pass-text' : 'fail-text');
								rows.push('<tr><td colspan="3" class="verdict-box"><span class="lbl" contenteditable="true" onblur="handleLiveInlineEdit(\'verdictLabel\',this.innerText)">' + sanitizeForReport(hd) + '</span><div class="verdict-big ' + cls + '" contenteditable="true" onblur="handleLiveInlineEdit(\'verdictText\',this.innerText)">' + sanitizeForReport(dp) + '</div></td></tr>');
							}
							const dc = [];
							if (isOn('examDate')) dc.push(lblSpan('Date of Thorough Examination') + valSpan('examDate', r.examDate, 'font-weight:700;'));
							if (isOn('nextExamDate')) dc.push(lblSpan('Latest Date for Next Thorough Examination') + valSpan('nextExamDate', r.nextExamDate, 'font-size:7.5pt;font-weight:900;color:var(--report-accent);'));
							if (dc.length) rows.push(buildColspanRow(dc, 3));
							const ex = r.extraCells || [];
							for (let i = 0; i < ex.length; i += 3) {
								const cs = [];
								for (let k = i; k < Math.min(i + 3, ex.length); k++) cs.push(lblSpan(ex[k].label || 'FIELD') + '<span class="val" contenteditable="true" onblur="handleExtraCellEdit(' + k + ',this.innerText)">' + sanitizeForReport(ex[k].value || '') + '</span>');
								rows.push(buildColspanRow(cs, 3));
							}
							if (rows.length) t6 = '<table class="ctbl"><colgroup><col style="width:33.34%"><col style="width:33.33%"><col style="width:33.33%"></colgroup><tr><td colspan="3" class="csec">Defect Particulars &amp; Operability Verdict</td></tr>' + rows.join('') + '</table>';
						}
						const ql = qrChannel === 'EMAIL' ? 'Email Verify' : 'WhatsApp Verify';
						const qrLink = typeof buildVerificationLink === 'function' ? buildVerificationLink(r) : '#';
						const iS = (r.inspectorSigMode === 'UPLOAD' && r.inspectorSigUpload) ? r.inspectorSigUpload : r.inspectorSigLive;
						const aS = (r.authSigMode === 'UPLOAD' && r.authSigUpload) ? r.authSigUpload : r.authSigLive;
						const qC = '<td class="qr-cell" style="text-align:center;vertical-align:middle;padding:3px;" title="Scan QR or click link to verify">' +
							'<div style="cursor:pointer;" onclick="dispatchVerification()" title="Click QR to test / dispatch verification"><svg id="waQrSvg" width="90" height="90" role="img" aria-label="QR"></svg></div>' +
							'<a href="' + sanitizeForReport(qrLink) + '" target="_blank" rel="noopener noreferrer" class="report-caption qr-link-btn" onclick="event.stopPropagation();" title="Open verification link in browser / app">' + ql + ' ↗</a>' +
							'</td>';
						let sig = '';
						if (isSecOn('sec_loler_5')) {
							sig = showQr ?
								'<table class="ctbl sig-block"><colgroup><col style="width:38%"><col style="width:38%"><col style="width:24%"></colgroup><tr><td>' + lblSpan('Person Making this Report') + valSpan('examinerName', r.examinerName) + '<div style="height:70px;display:flex;align-items:center;justify-content:flex-start;padding:2px 0;">' + (iS ? '<img src="' + iS + '" style="max-height:66px;max-width:100%;object-fit:contain;display:block;">' : '<i>Signature on File</i>') + '</div></td><td>' + lblSpan('Person Authenticating') + valSpan('authName', r.authName) + '<div style="height:70px;display:flex;align-items:center;justify-content:flex-start;padding:2px 0;">' + (aS ? '<img src="' + aS + '" style="max-height:66px;max-width:100%;object-fit:contain;display:block;">' : '<i>Signature on File</i>') + '</div></td>' + qC + '</tr></table>' :
								'<table class="ctbl sig-block"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tr><td>' + lblSpan('Person Making this Report') + valSpan('examinerName', r.examinerName) + '<div style="height:70px;display:flex;align-items:center;justify-content:flex-start;padding:2px 0;">' + (iS ? '<img src="' + iS + '" style="max-height:66px;max-width:100%;object-fit:contain;display:block;">' : '') + '</div></td><td>' + lblSpan('Person Authenticating') + valSpan('authName', r.authName) + '<div style="height:70px;display:flex;align-items:center;justify-content:flex-start;padding:2px 0;">' + (aS ? '<img src="' + aS + '" style="max-height:66px;max-width:100%;object-fit:contain;display:block;">' : '') + '</div></td></tr></table>';
						}
						let puwer = '';
						if (r.includePuwer === true && r.puwerRows && r.puwerRows.length) {
							puwer = '<table class="ctbl" style="margin-top:4px;"><colgroup><col style="width:11%"><col style="width:49%"><col style="width:12%"><col style="width:28%"></colgroup><tr><td colspan="4" class="csec">PUWER 1998 — Work Equipment Compliance Audit</td></tr><tr class="report-tbl-head"><td>Ref</td><td>Requirement</td><td>Result</td><td>Findings</td></tr>' + r.puwerRows.map(x => '<tr><td class="mono">' + sanitizeForReport(x.ref) + '</td><td>' + sanitizeForReport(x.item) + '</td><td style="font-weight:bold;color:' + (x.result === 'PASS' ? '#16a34a' : (x.result === 'FAIL' ? '#dc2626' : '#334155')) + ';">' + sanitizeForReport(x.result) + '</td><td>' + sanitizeForReport(x.note || '') + '</td></tr>').join('') + '</table>';
						}
						let chk = '';
						if (r.includeChecklist === true && r.checklist && r.checklist.length) {
							chk = '<table class="ctbl" style="margin-top:6px;"><colgroup><col style="width:60%"><col style="width:15%"><col style="width:25%"></colgroup><tr><td colspan="3" class="csec">Verification Checklist</td></tr>' + r.checklist.map(x => '<tr><td>' + sanitizeForReport(x.item) + '</td><td style="font-weight:bold;color:' + (x.status === 'PASS' ? '#16a34a' : '#dc2626') + ';">' + sanitizeForReport(x.status) + '</td><td>' + sanitizeForReport(x.note || '') + '</td></tr>').join('') + '</table>';
						}
						photoBlk = buildPhotoBlock(r);
						const ov = buildInstitutionalOverlays(r);
									   const _liftTitle = '<table class="ctbl"><colgroup><col style="width:100%"></colgroup><tr><td style="text-align:center;padding:4px;"><div class="report-main-title">Report of Thorough Examination</div><div class="report-main-subtitle">Lifting Operations — Lifting Equipment Regulations 1998 (LOLER)</div></td></tr></table>';
						const _liftPages = paginateReport({
							blocks: [t1, t2, t3, t4, t5, t6],
							headerHTML: HB,
							footerHTML: FB,
							titleHTML: _liftTitle,
							sigHTML: sig,
							overlayHTML: ov
						});
												let out = _liftPages.html;
						if (annPage) {
							// Route the annexure through paginateReport so PUWER,
							// checklist and photos split across as many A4 pages
							// as they need. A fixed-height frame clipped the
							// photo grid in print whenever PUWER was also on.
							const _annTitle = '<table class="ctbl"><colgroup><col style="width:70%"><col style="width:30%"></colgroup><tr><td><div class="report-annex-title">ANNEXURE: TECHNICAL AUDIT</div><div class="report-annex-sub">Report: <span data-bind="reportNo">' + sanitizeForReport(r.reportNo || '') + '</span></div></td><td style="text-align:right;"><span class="lbl">Serial</span><span class="val mono" data-bind="serial">' + sanitizeForReport(r.serial || '') + '</span></td></tr></table>';
						out = paginateAnnexure({ blocks: [puwer, chk, photoBlk], titleHTML: _annTitle, headerHTML: HB, footerHTML: FB, pageOffset: _liftPages.pageCount, mainHtml: _liftPages.html });
						}
					container.innerHTML=out;
						// Apply active report theme classes
						if (typeof window.currentReportTheme === 'string') {
							const sel = document.getElementById('reportThemeSelect');
							if (sel && sel.value !== window.currentReportTheme) sel.value = window.currentReportTheme;
							const selTb = document.getElementById('reportThemeSelectToolbar');
							if (selTb && selTb.value !== window.currentReportTheme) selTb.value = window.currentReportTheme;
						}
						// FIX M7: update page indicator based on actual rendered frames.
						updateGaugePageStatus(container);
						if (showQr) paintQr(document.getElementById('waQrSvg'), r);
						bindInstitutionalOverlays(r);
					} else {
						const r=record||ndtBatch[activeIdx]||{};
						if (!Array.isArray(r.photos)) r.photos = [];
						if (!r.fieldToggles) r.fieldToggles = {};
						if (!r.sectionToggles) r.sectionToggles = {};
						const isOn = k => r.fieldToggles[k] !== false;
						const isSecOn = k => r.sectionToggles[k] !== false;
						const annex = (r.includeChecklist === true && r.checklist && r.checklist.length > 0)
           || (r.includePhotos === true && (r.photos || []).some(p => p));
						const ft = annex ? 2 : 1;
						const ov = buildInstitutionalOverlays(r);
						const C4 = '<colgroup><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup>';
						const C2 = '<colgroup><col style="width:50%"><col style="width:50%"></colgroup>';

						let hRows = '';
						if (isSecOn('sec_ndt_1')) {
							const r1 = [];
							if (isOn('client')) r1.push({ s: 2, h: lblSpan('Client / Operator') + valSpan('client', r.client) });
							if (isOn('reportNo')) r1.push({ s: 1, h: lblSpan('Report No') + valSpan('reportNo', r.reportNo, '', true) });
							r1.push({ s: 1, h: lblSpan('Method') + valSpan('method', r.method, 'font-weight:900;color:var(--report-accent);') });
							hRows += normRow(r1, 4);
							const r2 = [];
							if (isOn('itemDesc')) r2.push({ s: 2, h: lblSpan('Item Description') + valSpan('itemDesc', r.itemDesc) });
							if (isOn('material')) r2.push({ s: 1, h: lblSpan('Material Grade / Type') + valSpan('material', r.material) });
							if (isOn('poRef')) r2.push({ s: 1, h: lblSpan('P.O. Reference') + valSpan('poRef', r.poRef, '', true) });
							if (r2.length) hRows += normRow(r2, 4);
							const r3 = [];
							if (isOn('testSpec')) r3.push({ s: 2, h: lblSpan('Test Specification') + valSpan('testSpec', r.testSpec) });
							if (isOn('location')) r3.push({ s: 2, h: lblSpan('Location / Rig') + valSpan('location', r.location) });
							if (r3.length) hRows += normRow(r3, 4);
						}
						const headT = (isSecOn('sec_ndt_1') && hRows) ? '<table class="ctbl">' + C4 + '<tr><td colspan="4" class="csec">Inspection Identification &amp; Test Particulars</td></tr>' + hRows + '</table>' : '';

						let pRows = '';
						if (isSecOn('sec_ndt_2')) {
							const r1 = [];
							if (isOn('certLevel')) r1.push({ s: 1, h: lblSpan('Certification Level') + valSpan('certLevel', r.certLevel) });
							if (isOn('certNo')) r1.push({ s: 1, h: lblSpan('Certificate No') + valSpan('certNo', r.certNo, '', true) });
							if (isOn('certExpiry')) r1.push({ s: 1, h: lblSpan('Cert Expiry') + valSpan('certExpiry', r.certExpiry) });
							if (isOn('visionTest')) r1.push({ s: 1, h: lblSpan('Vision Test') + valSpan('visionTest', r.visionTest) });
							if (r1.length) pRows += normRow(r1, 4);
							const r2 = [];
							if (isOn('procedureNo')) r2.push({ s: 2, h: lblSpan('Procedure / Technique No') + valSpan('procedureNo', r.procedureNo) });
							if (isOn('acceptCriteria')) r2.push({ s: 2, h: lblSpan('Acceptance Criteria') + valSpan('acceptCriteria', r.acceptCriteria) });
							if (r2.length) pRows += normRow(r2, 4);
						}
						const perT = (isSecOn('sec_ndt_2') && pRows) ? '<table class="ctbl">' + C4 + '<tr><td colspan="4" class="csec">Personnel Qualification &amp; Procedure Control (ISO 9712 / SNT-TC-1A)</td></tr>' + pRows + '</table>' : '';

						let cRows = '';
						if (isSecOn('sec_ndt_3')) {
							const r1 = [];
							if (isOn('calDue')) r1.push({ s: 1, h: lblSpan('Equipment Cal Due') + valSpan('calDue', r.calDue) });
							if (isOn('refBlock')) r1.push({ s: 1, h: lblSpan('Reference Block / IQI') + valSpan('refBlock', r.refBlock) });
							if (isOn('surfaceCond')) r1.push({ s: 1, h: lblSpan('Surface Condition') + valSpan('surfaceCond', r.surfaceCond) });
							if (isOn('surfaceTemp')) r1.push({ s: 1, h: lblSpan('Surface Temp') + valSpan('surfaceTemp', (r.surfaceTemp || '') + ' °C') });
							if (r1.length) cRows += normRow(r1, 4);
							const r2 = [];
							if (isOn('lightIntensity')) r2.push({ s: 1, h: lblSpan('Light Intensity') + valSpan('lightIntensity', r.lightIntensity) });
							if (isOn('couplant')) r2.push({ s: 1, h: lblSpan('Couplant / Developer') + valSpan('couplant', r.couplant) });
							if (isOn('coverage')) r2.push({ s: 2, h: lblSpan('Examination Coverage') + valSpan('coverage', r.coverage) });
							if (r2.length) cRows += normRow(r2, 4);
						}
						if (isSecOn('sec_ndt_4')) {
							const mp = [];
							const mth = r.method || 'MPI';
							if (mth === 'MPI') {
								mp.push({ s: 2, h: lblSpan('Magnetic Yoke Serial') + valSpan('yokeSerial', r.yokeSerial) });
								mp.push({ s: 1, h: lblSpan('Current Type') + valSpan('magCurrent', r.magCurrent) });
								mp.push({ s: 1, h: lblSpan('Particle Media') + valSpan('inkType', r.inkType) });
							} else if (mth === 'PT') {
								mp.push({ s: 2, h: lblSpan('Penetrant Class') + valSpan('penetrantType', r.penetrantType) });
								mp.push({ s: 1, h: lblSpan('Brand / Batch') + valSpan('penetrantBrand', r.penetrantBrand) });
								mp.push({ s: 1, h: lblSpan('Dwell Time') + valSpan('dwellTime', r.dwellTime) });
							} else {
								mp.push({ s: 2, h: lblSpan('Test Machine / Gauge') + valSpan('utUnit', r.utUnit) });
								mp.push({ s: 2, h: lblSpan('Probe Specification') + valSpan('probeFreq', r.probeFreq) });
							}
							cRows += normRow(mp, 4);
						}
						const calT = cRows ? '<table class="ctbl">' + C4 + '<tr><td colspan="4" class="csec">Equipment, Calibration &amp; Environmental Controls</td></tr>' + cRows + '</table>' : '';

						const findT = isSecOn('sec_ndt_5') ? ('<table class="ctbl">' + C4 + '<tr><td colspan="4" class="csec">Discontinuity / Item Examination Findings</td></tr><tr class="report-tbl-head"><td>Item #</td><td>Area</td><td>Findings</td><td>Result</td></tr>' + (r.indications || []).map(x => '<tr><td>' + sanitizeForReport(x.item) + '</td><td>' + sanitizeForReport(x.area) + '</td><td>' + sanitizeForReport(x.finding) + '</td><td style="font-weight:bold;color:' + (x.result === 'PASS' ? '#16a34a' : '#dc2626') + ';">' + sanitizeForReport(x.result) + '</td></tr>').join('') + '</table>') : '';

						let eRows = '';
						if (isSecOn('sec_ndt_6')) {
							const cs = [];
							if (isOn('result')) {
								const hd = (r.verdictLabel && r.verdictLabel.trim()) ? r.verdictLabel.trim() : 'TEST DETERMINATION';
								const dp = (r.verdictText && r.verdictText.trim()) ? r.verdictText.trim() : (r.result || 'PASSED / ACCEPTABLE');
								const cls = /REJECT|FAIL|UNACCEPT/i.test(dp) ? 'fail-text' : 'pass-text';
								cs.push({ s: 1, h: '<div class="verdict-box"><span class="lbl" contenteditable="true" onblur="handleLiveInlineEdit(\'verdictLabel\',this.innerText)">' + sanitizeForReport(hd) + '</span><div class="verdict-big ' + cls + '" contenteditable="true" onblur="handleLiveInlineEdit(\'verdictText\',this.innerText)">' + sanitizeForReport(dp) + '</div></div>' });
							}
							if (isOn('remarks')) cs.push({ s: 1, h: lblSpan('Remarks / Findings Summary') + valSpan('remarks', r.remarks) });
							if (cs.length) eRows = normRow(cs, 2);
						}
						const evalT = (isSecOn('sec_ndt_6') && eRows) ? '<table class="ctbl">' + C2 + '<tr><td colspan="2" class="csec">Evaluation &amp; Disposition</td></tr>' + eRows + '</table>' : '';

						let exT = ''; const ex = r.extraCells || [];
						if (isSecOn('sec_ndt_6') && ex.length) {
							let rw = '';
							for (let i = 0; i < ex.length; i += 2) {
								const cs = [];
								for (let k = i; k < Math.min(i + 2, ex.length); k++) cs.push({ s: 1, h: lblSpan(ex[k].label || 'FIELD') + '<span class="val" contenteditable="true" onblur="handleNdtExtraCellEdit(' + k + ',this.innerText)">' + sanitizeForReport(ex[k].value || '') + '</span>' });
								rw += normRow(cs, 2);
							}
							exT = '<table class="ctbl">' + C2 + rw + '</table>';
						}

						const iS = (r.inspSigMode === 'UPLOAD' && r.inspSigUpload) ? r.inspSigUpload : r.inspSigLive;
						const wS = (r.witSigMode === 'UPLOAD' && r.witSigUpload) ? r.witSigUpload : r.witSigLive;
						const ql = qrChannel === 'EMAIL' ? 'Email Verify' : 'WhatsApp Verify';
						let sigT = '';
						if (isSecOn('sec_ndt_6')) {
							const cs = [];
							if (isOn('inspectorName')) cs.push({ s: 1, h: lblSpan('Tested By (Inspector)') + valSpan('inspectorName', r.inspectorName) + '<div style="height:70px;display:flex;align-items:center;justify-content:flex-start;padding:2px 0;margin-top:2px;">' + (iS ? '<img src="' + iS + '" style="max-height:66px;max-width:100%;object-fit:contain;display:block;">' : '<span style="font-style:italic;color:#64748b;font-size:6pt;">Signature on File</span>') + '</div>' });
							if (isOn('witnessName')) cs.push({ s: 1, h: lblSpan('Witnessed By') + valSpan('witnessName', r.witnessName) + '<div style="height:70px;display:flex;align-items:center;justify-content:flex-start;padding:2px 0;margin-top:2px;">' + (wS ? '<img src="' + wS + '" style="max-height:66px;max-width:100%;object-fit:contain;display:block;">' : '<span style="font-style:italic;color:#64748b;font-size:6pt;">Signature on File</span>') + '</div>' });
							if (showQr) {
								const qrLink = typeof buildVerificationLink === 'function' ? buildVerificationLink(r) : '#';
								cs.push({ s: 1, h: '<div class="qr-cell" style="text-align:center;vertical-align:middle;padding:3px;" title="Scan QR or click link to verify">' +
									'<div style="cursor:pointer;" onclick="dispatchVerification()" title="Click QR to test / dispatch verification"><svg id="waQrSvg" width="90" height="90" role="img" aria-label="QR"></svg></div>' +
									'<a href="' + sanitizeForReport(qrLink) + '" target="_blank" rel="noopener noreferrer" class="report-caption qr-link-btn" onclick="event.stopPropagation();" title="Open verification link in browser / app">' + ql + ' ↗</a>' +
									'</div>' });
							}
							if (cs.length) {
								const tot = cs.length;
								const cg = tot === 3 ? '<colgroup><col style="width:38%"><col style="width:38%"><col style="width:24%"></colgroup>' : (tot === 2 ? '<colgroup><col style="width:50%"><col style="width:50%"></colgroup>' : '<colgroup><col style="width:100%"></colgroup>');
								sigT = '<table class="ctbl sig-block">' + cg + '<tr>' + cs.map(c => '<td colspan="' + c.s + '">' + c.h + '</td>').join('') + '</tr></table>';
							}
						}
									   const _ndtTitle = '<table class="ctbl"><colgroup><col style="width:100%"></colgroup><tr><td style="text-align:center;padding:4px;"><div class="report-main-title">Non-Destructive Testing Report</div><div class="report-main-subtitle">' + sanitizeForReport(r.method || '') + ' Examination — ASME Sec V / ISO 9712 / ISO 17640 Framework</div></td></tr></table>';
						const _ndtPages = paginateReport({
							blocks: [headT, perT, calT, findT, evalT, exT],
							headerHTML: HB,
							footerHTML: FB,
							titleHTML: _ndtTitle,
							sigHTML: sigT,
							overlayHTML: ov
						});
						let out = _ndtPages.html;
							photoBlk = buildPhotoBlock(r);
						if (annex) {
							// Same pagination treatment as the LIFTING annexure:
							// checklist and photo grid each become their own
							// measured block, and paginateReport handles any
							// overflow cleanly.
							let chkBlk = '';
							if (r.includeChecklist === true && r.checklist && r.checklist.length) {
								chkBlk = '<table class="ctbl" style="margin-top:6px;"><colgroup><col style="width:60%"><col style="width:15%"><col style="width:25%"></colgroup><tr class="report-tbl-head"><td>Item</td><td>Status</td><td>Notes</td></tr>' + r.checklist.map(x => '<tr><td>' + sanitizeForReport(x.item) + '</td><td style="font-weight:bold;color:' + (x.status === 'PASS' ? '#16a34a' : '#dc2626') + ';">' + sanitizeForReport(x.status) + '</td><td>' + sanitizeForReport(x.note || '') + '</td></tr>').join('') + '</table>';
							}
							const _annTitle = '<table class="ctbl"><colgroup><col style="width:70%"><col style="width:30%"></colgroup><tr><td><div class="report-annex-title">ANNEXURE: NDT TECHNICAL VERIFICATION</div><div class="report-annex-sub">Report: <span data-bind="reportNo">' + sanitizeForReport(r.reportNo || '') + '</span></div></td><td style="text-align:right;"><span class="lbl">Method</span><span class="val mono" data-bind="method">' + sanitizeForReport(r.method || '') + '</span></td></tr></table>';
							out = paginateAnnexure({ blocks: [chkBlk, photoBlk], titleHTML: _annTitle, headerHTML: HB, footerHTML: FB, pageOffset: _ndtPages.pageCount, mainHtml: _ndtPages.html });
						}
					container.innerHTML=out;
						// Apply active report theme classes
						if (typeof window.currentReportTheme === 'string') {
							const sel = document.getElementById('reportThemeSelect');
							if (sel && sel.value !== window.currentReportTheme) sel.value = window.currentReportTheme;
							const selTb = document.getElementById('reportThemeSelectToolbar');
							if (selTb && selTb.value !== window.currentReportTheme) selTb.value = window.currentReportTheme;
						}
						// FIX M7: update page indicator based on actual rendered frames.
						updateGaugePageStatus(container);
						if (showQr) paintQr(document.getElementById('waQrSvg'), r);
						bindInstitutionalOverlays(r);
					}
				}

				// ── FIX M7: reflect the actual number of rendered A4 frames.
				function updateGaugePageStatus(container) {
					const el = document.getElementById('gaugeHeightStatus');
					if (!el) return;
					const frames = container.querySelectorAll('.a4-page-frame');
					const n = frames.length;
					let hasOverflow = false;
					frames.forEach(f => {
						// 295mm ISO A4 height threshold is ~1123px (at 96 DPI)
						if (f.scrollHeight > 1130) hasOverflow = true;
					});
					if (hasOverflow) {
						el.innerHTML = 'Status: <strong style="color:var(--fail);" title="Content exceeds 295mm single-page height. Review custom rows.">⚠️ OVERFLOW (>295mm)</strong>';
					} else {
						const color = n <= 1 ? 'var(--pass)' : 'var(--warn)';
						el.innerHTML = 'Status: <strong style="color:' + color + ';">' + n + ' PAGE' + (n === 1 ? '' : 'S') + '</strong>';
					}
				}

				// ── FIX C2: redraw a signature pad from a stored data URL.
				// Without this, switching records left the previous record's ink
				// on the canvas, and the next stroke captured a composite.
				function redrawPadFromRecord(padId, dataUrl) {
					const c = document.getElementById(padId);
					if (!c) return;
					const ctx = c.getContext('2d');
					ctx.setTransform(1, 0, 0, 1, 0, 0);
					ctx.clearRect(0, 0, c.width, c.height);
					if (!dataUrl) return;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.strokeStyle = '#0f172a';
					const img = new Image();
					img.onload = () => {
						ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, c.width, c.height);
					};
					img.src = dataUrl;
				}

				function handleLiveInlineEdit(k, v) {
					const r = activeRec();
					if (r) {
						// ── FIX H2: route through validation rules.
						const validated = (typeof window._validateField === 'function') ? window._validateField(k, v) : v.trim();
						r[k] = validated;
						if (typeof markDirty === 'function') markDirty();
						loadActiveRecord();
						schedulePersist();
					}
				}
