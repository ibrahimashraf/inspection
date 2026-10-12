				/* BATCH GRID */

				function applyRangeSelection(s) {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const f = Math.max(1, parseInt(document.getElementById('rangeFrom').value, 10) || 1);
					const t = Math.min(list.length, parseInt(document.getElementById('rangeTo').value, 10) || list.length);
					list.forEach((r, i) => { if (i + 1 >= f && i + 1 <= t) r.selected = s; });
					renderSheet(); showToast('Range updated.', 'info');
				}
				function toggleColumnLock(k) { columnLocks[k] = !columnLocks[k]; renderSheet(); }
				function toggleAllLocks(s) { Object.keys(columnLocks).forEach(k => columnLocks[k] = s); renderSheet(); }
				function changeBatchPage(d) { const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch; const mx = Math.ceil(list.length / batchPageSize) - 1; if (batchPage + d >= 0 && batchPage + d <= mx) { batchPage += d; renderSheet(); } }
						function updateSelectionCounter() {
				const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
				const n = list.filter(r => r.selected === true).length;
				// Export buttons are icons now — update their tooltips instead
				// of text content. There is no XLSX export: the vendored rule is
				// no CDN, and the xlsx script tag is commented out, so the old
				// Excel path could only ever fall through to CSV.
				const c = document.getElementById('btnExportCsv');
				if (c) c.title = n > 0 ? 'Export ' + n + ' selected rows (CSV)'  : 'Export all ' + list.length + ' rows (CSV)';
			}

				/* BATCH SEARCH & FILTER */
				var _batchFilterText = '';
				var _batchFilterField = 'all';
				var _batchFilteredIndices = null;
				var _batchFilterTimer = null;

				function filterBatchDebounced() {
					if (_batchFilterTimer) clearTimeout(_batchFilterTimer);
					_batchFilterTimer = setTimeout(filterBatch, 150);
				}

				function filterBatch() {
					const input = document.getElementById('batchSearchInput');
					const select = document.getElementById('batchSearchField');
					_batchFilterText = (input ? input.value : '').toLowerCase().trim();
					_batchFilterField = select ? select.value : 'all';
					batchPage = 0;
					applyBatchFilter();
					renderSheet();
				}

				function applyBatchFilter() {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					if (!_batchFilterText) {
						_batchFilteredIndices = null;
						return;
					}
					const q = _batchFilterText;
					const indices = [];
					for (let i = 0; i < list.length; i++) {
						const r = list[i] || {};
						let matched = false;
						if (_batchFilterField === 'all') {
							matched = Object.values(r).some(v =>
								typeof v === 'string' && v.toLowerCase().includes(q)
							);
						} else {
							const v = r[_batchFilterField];
							matched = typeof v === 'string' && v.toLowerCase().includes(q);
						}
						if (matched) indices.push(i);
					}
					_batchFilteredIndices = indices;
				}

				function updateBatchSearchCount() {
					const el = document.getElementById('batchSearchCount');
					if (!el) return;
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					if (!_batchFilterText || !_batchFilteredIndices) {
						el.textContent = '';
						return;
					}
					el.textContent = _batchFilteredIndices.length + ' of ' + list.length;
				}

				function clearBatchFilter() {
					const inp = document.getElementById('batchSearchInput');
					const sel = document.getElementById('batchSearchField');
					if (inp) inp.value = '';
					if (sel) sel.value = 'all';
					_batchFilterText = '';
					_batchFilterField = 'all';
					_batchFilteredIndices = null;
					_batchFilterTimer && clearTimeout(_batchFilterTimer);
					batchPage = 0;
				}
				function buildGridHeader(cols) {
					let h = '<tr><th style="width:35px;text-align:center;">Sel</th><th style="width:35px;">#</th>';
					cols.forEach(c => {
						const lock = c.key !== 'reportNo' && !!columnLocks[c.key];
						h += '<th>' + c.label + (c.key === 'reportNo' ? '' : ' <span class="lock-btn" role="button" tabindex="0" onclick="event.stopPropagation();toggleColumnLock(\'' + c.key + '\')">' + (lock ? '🔒' : '🔓') + '</span>') + '</th>';
					});
					return h + '</tr>';
				}

				function renderSheet() {
					const th = document.getElementById('sheetHead'), tb = document.getElementById('sheetBody');
					if (!th || !tb) return;
					const isL = currentEngine === 'LIFTING';
					const list = isL ? liftingBatch : ndtBatch;
					const cols = isL ? LIFTING_COLUMNS : NDT_COLUMNS;

					if (_batchFilterText) applyBatchFilter();

					const visibleIdx = (_batchFilteredIndices !== null)
						? _batchFilteredIndices
						: Array.from({ length: list.length }, (_, i) => i);

					// ── FIX H1: if the active row is filtered out, snap to the
					// first visible row (or row 0 if empty). Without this, the
					// left form kept showing a record that wasn't in the grid.
					if (visibleIdx.length > 0 && visibleIdx.indexOf(activeIdx) === -1) {
						// Flush any pending form edits before we switch records,
						// otherwise the user's last keystrokes are silently dropped.
						try { syncCurrentData(); } catch (e) {}
						activeIdx = visibleIdx[0];
						if (typeof loadActiveRecord === 'function') loadActiveRecord();
					} else if (visibleIdx.length === 0 && _batchFilterText) {
						// Nothing matches: leave activeIdx alone (form still editable)
						// but the "of N" counter below already reflects the filtered count.
					}

					const mx = Math.max(0, Math.ceil(visibleIdx.length / batchPageSize) - 1);
					if (batchPage > mx) batchPage = mx;
					const s = batchPage * batchPageSize;
					const e = Math.min(visibleIdx.length, s + batchPageSize);

					th.innerHTML = buildGridHeader(cols);
					tb.innerHTML = '';

					if (visibleIdx.length === 0 && _batchFilterText) {
						const colspan = cols.length + 2;
						tb.innerHTML = '<tr><td colspan="' + colspan + '" ' +
							'style="text-align:center;padding:24px;color:var(--ink-muted);font-style:italic;">' +
							'No records match &ldquo;' + sanitizeForReport(_batchFilterText) + '&rdquo;' +
							'</td></tr>';
						document.getElementById('lblActiveItem').textContent = '0 of ' + list.length;
						document.getElementById('batchPaginationInfo').textContent = 'No matches';
						document.getElementById('batchPageIndicator').textContent = 'Page 1 of 1';
						updateSelectionCounter();
						updateBatchSearchCount();
						return;
					}

					for (let p = s; p < e; p++) {
						const i = visibleIdx[p];
						const r = list[i];
						const tr = document.createElement('tr');
						if (i === activeIdx) tr.className = 'selected';
						let rh = '<td style="text-align:center;"><input type="checkbox" name="rowSelect_' + i + '" ' +
							(r.selected ? 'checked' : '') +
							' onclick="event.stopPropagation();' +
							(isL ? 'liftingBatch' : 'ndtBatch') + '[' + i + '].selected=this.checked;updateSelectionCounter();">' +
							'</td><td>' + (i + 1) + '</td>';
						cols.forEach(c => {
							rh += '<td' + (MONO_GRID_KEYS[c.key] ? ' class="mono"' : '') +
								' contenteditable="true" onblur="handleCellEdit(' + i + ',\'' + c.key + '\',this.innerText)">' +
								sanitizeForReport(r[c.key] || '') + '</td>';
						});
						tr.innerHTML = rh;
						tr.onclick = function (ev) {
							if (ev.target.tagName !== 'INPUT' && ev.target.getAttribute('contenteditable') !== 'true') {
								syncCurrentData();
								activeIdx = i;
								loadActiveRecord();
							}
						};
						tb.appendChild(tr);
					}

					document.getElementById('lblActiveItem').textContent = (activeIdx + 1) + ' of ' + list.length;
					// ── FIX M5: only prefill rangeTo on first render, so the user
					// can narrow the range without the next keystroke stomping it.
					if (!_rangeToUserEdited) document.getElementById('rangeTo').value = list.length;

					if (_batchFilterText) {
						document.getElementById('batchPaginationInfo').textContent =
							'Showing ' + (s + 1) + ' - ' + e + ' of ' + visibleIdx.length + ' filtered';
					} else {
						document.getElementById('batchPaginationInfo').textContent =
							'Showing ' + (s + 1) + ' - ' + e + ' of ' + list.length;
					}
					document.getElementById('batchPageIndicator').textContent =
						'Page ' + (batchPage + 1) + ' of ' + (mx + 1);
					updateSelectionCounter();
					updateBatchSearchCount();
				}
				function handleCellEdit(i, k, v) {
					const r = currentEngine === 'LIFTING' ? liftingBatch[i] : ndtBatch[i];
					// ── FIX H2: route through validation rules.
					r[k] = (typeof window._validateField === 'function') ? window._validateField(k, v) : v.trim();
					if (i === activeIdx) loadActiveRecord();
					debouncedSync();
				}
				function toggleAllRows(s) { (currentEngine === 'LIFTING' ? liftingBatch : ndtBatch).forEach(r => r.selected = s); renderSheet(); }
				function cloneSelectedRows() {
					syncCurrentData();
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const sel = list.filter(r => r.selected);
					if (!sel.length) { showToast('Nothing selected.', 'error'); return; }
					sel.forEach(s0 => {
					const c = JSON.parse(JSON.stringify(s0));
					c.reportNo = getNextReportNumber(currentEngine === 'LIFTING' ? 'LFT' : 'NDT');
					c.selected = false;
					// New identity. Photos in c.photos are live data URLs (from the
					// in-memory source record), so re-staging under the fresh uid is safe.
					delete c.uid;
					c._photoMarkers = null;
					// Re-stage under new uid so the clone owns its own IDB keys.
					const engine = currentEngine === 'LIFTING' ? 'lifting' : 'ndt';
					PhotosIDB.stageRecordPhotos(engine, c).catch(e => console.error('[clone] stage', e));
					list.splice(list.indexOf(s0) + 1, 0, c);
				});
				renderSheet(); showToast('Cloned ' + sel.length + '.', 'success');
				}
				function deleteSelectedRows() {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const sel = list.filter(r => r.selected);
					if (!sel.length) { showToast('Nothing selected.', 'error'); return; }
					const rem = list.filter(r => !r.selected);
					if (currentEngine === 'LIFTING') liftingBatch = rem.length ? rem : [{ reportNo: getNextReportNumber(), reportDate: todayISO(), quantity: '1', examParticulars: DEFAULT_EXAM_PARTICULARS, additionalTesting: 'NO', fieldToggles: {}, puwerRows: defaultPuwerRows(), photos: Array(12).fill(null), checklist: [], extraCells: [], selected: false }];
					else ndtBatch = rem.length ? rem : [defaultNdtRecord(null)];
					activeIdx = 0; loadActiveRecord(); renderSheet(); showToast('Deleted ' + sel.length + '.', 'info');
				}
				function copySelectedRows() { clipboardBuffer = (currentEngine === 'LIFTING' ? liftingBatch : ndtBatch).filter(r => r.selected); showToast('Copied ' + clipboardBuffer.length + '.', 'info'); }

				/* APPLY TO ALL (ENGINE ISOLATED) */
				var _applyToAllContext = { targetKey: null };

				function openApplyToAllDialog(targetKey) {
					syncCurrentData();
					_applyToAllContext.targetKey = targetKey || 'stamp';
					const dlg = document.getElementById('applyToAllDialog');
					if (!dlg) return;

					const titleEl = document.getElementById('applyToAllTitle');
					const descEl = document.getElementById('applyToAllDesc');
					const chooserEl = document.getElementById('applyBatchFieldChooser');
					const selEl = document.getElementById('applyFieldSelect');
					const prevEl = document.getElementById('applyToAllPreview');
					const isL = currentEngine === 'LIFTING';
					const curRec = isL ? (liftingBatch[activeIdx] || {}) : (ndtBatch[activeIdx] || {});

					if (chooserEl) chooserEl.style.display = 'none';

					let title = 'Apply to All Records';
					let desc = 'Copy value from current record to all ' + (isL ? 'Lifting' : 'NDT') + ' records:';
					let previewText = '';

					if (targetKey === 'stamp') {
						title = 'Apply Stamp to All';
						previewText = curRec.stampUpload ? ('Stamp Image: ' + dataUrlKB(curRec.stampUpload) + ' KB') : '(No stamp uploaded on current record)';
					} else if (targetKey === 'inspector') {
						title = 'Apply Inspector Signature to All';
						previewText = 'Name: ' + (curRec.examinerName || '—') + '\nSignature: ' + (curRec.inspectorSigUpload ? 'Uploaded (' + dataUrlKB(curRec.inspectorSigUpload) + 'KB)' : (curRec.inspectorSigLive ? 'Drawn signature' : 'None'));
					} else if (targetKey === 'authenticator') {
						title = 'Apply Authenticator Signature to All';
						previewText = 'Name: ' + (curRec.authName || '—') + '\nSignature: ' + (curRec.authSigUpload ? 'Uploaded (' + dataUrlKB(curRec.authSigUpload) + 'KB)' : (curRec.authSigLive ? 'Drawn signature' : 'None'));
					} else if (targetKey === 'signatures') {
						title = 'Apply All Signatures to Batch';
						previewText = 'Inspector: ' + (curRec.examinerName || '—') + '\nAuthenticator: ' + (curRec.authName || '—');
					} else if (targetKey === 'ndt_insp') {
						title = 'Apply NDT Inspector to All';
						previewText = 'Tested By: ' + (curRec.inspectorName || '—') + '\nSignature: ' + (curRec.inspSigUpload ? 'Uploaded (' + dataUrlKB(curRec.inspSigUpload) + 'KB)' : (curRec.inspSigLive ? 'Drawn signature' : 'None'));
					} else if (targetKey === 'ndt_wit') {
						title = 'Apply NDT Witness to All';
						previewText = 'Witnessed By: ' + (curRec.witnessName || '—') + '\nSignature: ' + (curRec.witSigUpload ? 'Uploaded (' + dataUrlKB(curRec.witSigUpload) + 'KB)' : (curRec.witSigLive ? 'Drawn signature' : 'None'));
					} else if (targetKey === 'ndt_signatures') {
						title = 'Apply NDT Signatures to Batch';
						previewText = 'Tested By: ' + (curRec.inspectorName || '—') + '\nWitnessed By: ' + (curRec.witnessName || '—');
					} else if (targetKey === 'batch_field') {
						title = 'Propagate Field to All';
						desc = 'Select a common header field from the active record to copy across all records in the active batch:';
						if (chooserEl && selEl) {
							chooserEl.style.display = 'block';
							const cols = (isL ? LIFTING_COLUMNS : NDT_COLUMNS).filter(c => c.key !== 'reportNo' && c.key !== 'serial');
							selEl.innerHTML = cols.map(c => '<option value="' + c.key + '">' + c.label + ' (' + (curRec[c.key] || 'empty') + ')</option>').join('');
							selEl.onchange = () => {
								prevEl.textContent = 'Value: ' + (curRec[selEl.value] || '—');
							};
							previewText = 'Value: ' + (curRec[cols[0] ? cols[0].key : ''] || '—');
						}
					} else {
						// arbitrary field key passed directly
						title = 'Apply Field to All';
						previewText = targetKey + ': ' + (curRec[targetKey] || '—');
					}

					if (titleEl) titleEl.textContent = title;
					if (descEl) descEl.textContent = desc;
					if (prevEl) prevEl.textContent = previewText;

					try { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.open = true; } catch (e) { dlg.open = true; }
				}

				function confirmApplyToAll() {
					const targetKey = _applyToAllContext.targetKey || 'stamp';
					const isL = currentEngine === 'LIFTING';
					const batch = isL ? liftingBatch : ndtBatch;
					const curRec = batch[activeIdx];
					if (!curRec) return;

					if (targetKey === 'stamp') {
						batch.forEach(r => {
							r.stampUpload = curRec.stampUpload;
							if (curRec.stampPos) r.stampPos = { x: curRec.stampPos.x, y: curRec.stampPos.y };
						});
					} else if (targetKey === 'inspector') {
						batch.forEach(r => {
							r.examinerName = curRec.examinerName;
							r.inspectorSigUpload = curRec.inspectorSigUpload;
							r.inspectorSigLive = curRec.inspectorSigLive;
							r.inspectorSigMode = curRec.inspectorSigMode;
						});
					} else if (targetKey === 'authenticator') {
						batch.forEach(r => {
							r.authName = curRec.authName;
							r.authSigUpload = curRec.authSigUpload;
							r.authSigLive = curRec.authSigLive;
							r.authSigMode = curRec.authSigMode;
						});
					} else if (targetKey === 'signatures') {
						batch.forEach(r => {
							r.examinerName = curRec.examinerName;
							r.inspectorSigUpload = curRec.inspectorSigUpload;
							r.inspectorSigLive = curRec.inspectorSigLive;
							r.inspectorSigMode = curRec.inspectorSigMode;
							r.authName = curRec.authName;
							r.authSigUpload = curRec.authSigUpload;
							r.authSigLive = curRec.authSigLive;
							r.authSigMode = curRec.authSigMode;
						});
					} else if (targetKey === 'ndt_insp') {
						batch.forEach(r => {
							r.inspectorName = curRec.inspectorName;
							r.inspSigUpload = curRec.inspSigUpload;
							r.inspSigLive = curRec.inspSigLive;
							r.inspSigMode = curRec.inspSigMode;
						});
					} else if (targetKey === 'ndt_wit') {
						batch.forEach(r => {
							r.witnessName = curRec.witnessName;
							r.witSigUpload = curRec.witSigUpload;
							r.witSigLive = curRec.witSigLive;
							r.witSigMode = curRec.witSigMode;
						});
					} else if (targetKey === 'ndt_signatures') {
						batch.forEach(r => {
							r.inspectorName = curRec.inspectorName;
							r.inspSigUpload = curRec.inspSigUpload;
							r.inspSigLive = curRec.inspSigLive;
							r.inspSigMode = curRec.inspSigMode;
							r.witnessName = curRec.witnessName;
							r.witSigUpload = curRec.witSigUpload;
							r.witSigLive = curRec.witSigLive;
							r.witSigMode = curRec.witSigMode;
						});
					} else if (targetKey === 'batch_field') {
						const selEl = document.getElementById('applyFieldSelect');
						const k = selEl ? selEl.value : null;
						if (k && k !== 'reportNo') {
							const val = curRec[k];
							batch.forEach(r => { r[k] = val; });
						}
					} else {
						// Direct field key
						if (targetKey !== 'reportNo') {
							const val = curRec[targetKey];
							batch.forEach(r => { r[targetKey] = val; });
						}
					}

					const dlg = document.getElementById('applyToAllDialog');
					if (dlg && dlg.open) dlg.close();

					loadActiveRecord();
					renderSheet();
					debouncedSync();
					showToast('Applied to all ' + batch.length + ' records.', 'success');
				}
				function scrollFormToTop() { const l = document.getElementById('leftPane'); if (l) l.scrollTo({ top: 0, behavior: 'smooth' }); }
				function stepBatch(d) { syncCurrentData(); const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch; if (activeIdx + d >= 0 && activeIdx + d < list.length) { activeIdx += d; loadActiveRecord(); scrollFormToTop(); } }
				function addBatchRecord() {
					syncCurrentData();
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const a = list[activeIdx] || {};
					if (currentEngine === 'LIFTING') {
						list.splice(activeIdx + 1, 0, {
							reportNo: getNextReportNumber(), reportDate: todayISO(), jobRef: '', poRef: '',
							companyAccred: a.companyAccred || '', standards: a.standards || '', sopRef: a.sopRef || '',
							fieldToggles: { dangerTimeText: false }, includePuwer: false, includeChecklist: false, includePhotos: false, puwerRows: defaultPuwerRows(),
							employer: a.employer || '', premises: a.premises || '', subLocation: '', colourCode: '',
							description: '', swl: '', quantity: '1', identification: '', manufacturer: '', model: '', serial: '', plantId: '', mfgYear: '',
							lastExamDate: '', markingsLegible: 'YES',
							q_firstExam: 'NO', q_installedCorrectly: 'N/A', q_int6m: 'YES', q_int12m: 'NO', q_scheme: 'NO', q_exceptional: 'NO',
							examParticulars: DEFAULT_EXAM_PARTICULARS, additionalTesting: 'NO', additionalTestingDetails: '',
							proofLoadApplied: '', lastProofDetails: '', nextProofDate: '',
							defectDesc: 'NONE.', dangerImm: 'NO', dangerTimeText: 'N/A', remedies: 'None', isSafe: 'YES',
							examDate: todayISO(), nextExamDate: calculateNextDate(todayISO(), 6),
							verdictLabel: '', verdictText: '', extraCells: [],
							examinerName: a.examinerName || '', authName: a.authName || '',
							checklist: [], photos: Array(12).fill(null),
							inspectorSigLive: null, inspectorSigUpload: null, inspectorSigMode: 'LIVE',
							authSigLive: null, authSigUpload: null, authSigMode: 'LIVE',
							stampUpload: a.stampUpload || null, stampPos: { x: 70, y: 76 }, selected: false
						});
						activeIdx++;
					} else { list.splice(activeIdx + 1, 0, defaultNdtRecord(a)); activeIdx++; }
					loadActiveRecord(); showToast('Record added.', 'info'); scrollFormToTop();
				}

				function loadActiveRecord() {
			// ── FIX: defensive DOM writes. If any expected input element is
			//    missing from the DOM (renamed, deleted, mis-pasted, or
			//    toggled away by a pill), skip it silently rather than
			//    throwing on null.value. Previously one missing element
			//    halted the entire load, leaving the form and preview blank.
			const g = id => document.getElementById(id);
			const setVal = (id, v) => { const el = g(id); if (el) el.value = (v == null ? '' : v); };
			const setTxt = (id, v) => { const el = g(id); if (el) el.textContent = (v == null ? '' : v); };

			if (currentEngine === 'LIFTING') {
				const r = liftingBatch[activeIdx]; if (!r) return;
				if (!r.puwerRows) r.puwerRows = defaultPuwerRows();
				if (!r.examParticulars) r.examParticulars = DEFAULT_EXAM_PARTICULARS;
				if (!r.quantity) r.quantity = '1';

				setVal('in_reportNo', r.reportNo);
				setVal('in_reportDate', r.reportDate);
				setVal('in_jobRef', r.jobRef);
				setVal('in_poRef', r.poRef);
				setVal('in_standards', r.standards);
				setVal('in_sopRef', r.sopRef);
				setVal('in_companyAccred', r.companyAccred);
				setVal('in_employer', r.employer);
				setVal('in_premises', r.premises);
				setVal('in_subLocation', r.subLocation);
				setVal('in_colourCode', r.colourCode);
				setVal('in_description', r.description);
				setVal('in_swl', r.swl);
				setVal('in_quantity', r.quantity || '1');
				setVal('in_identification', r.identification);
				setVal('in_manufacturer', r.manufacturer);
				setVal('in_model', r.model);
				setVal('in_serial', r.serial);
				setVal('in_plantId', r.plantId);
				setVal('in_mfgYear', r.mfgYear);
				setVal('in_lastExamDate', r.lastExamDate);
				setVal('in_markingsLegible', r.markingsLegible || 'YES');
				setVal('in_q_firstExam', r.q_firstExam || 'NO');
				setVal('in_q_installedCorrectly', r.q_installedCorrectly || 'N/A');
				setVal('in_q_int6m', r.q_int6m || 'YES');
				setVal('in_q_int12m', r.q_int12m || 'NO');
				setVal('in_q_scheme', r.q_scheme || 'NO');
				setVal('in_q_exceptional', r.q_exceptional || 'NO');
				setVal('in_examParticulars', r.examParticulars || DEFAULT_EXAM_PARTICULARS);
				setVal('in_additionalTesting', r.additionalTesting || 'NO');
				setVal('in_additionalTestingDetails', r.additionalTestingDetails);
				setVal('in_defectDesc', r.defectDesc);
				setVal('in_dangerImm', r.dangerImm || 'NO');
				setVal('in_dangerTimeText', r.dangerTimeText || 'N/A');
				setVal('in_isSafe', r.isSafe || 'YES');
				setVal('in_remedies', r.remedies || 'None');
				setVal('in_examDate', r.examDate);
				if (r.examDate && !r.nextExamDate) {
					r.nextExamDate = r.q_int6m === 'YES'
						? calculateNextDate(r.examDate, 6)
						: (r.q_int12m === 'YES' ? calculateNextDate(r.examDate, 12) : '');
				}
				setVal('in_nextExamDate', r.nextExamDate);
				setVal('in_verdictLabel', r.verdictLabel || 'STATUTORY FITNESS DETERMINATION');
				setVal('in_verdictText', r.verdictText);
				setVal('in_examinerName', r.examinerName);
				setVal('in_authName', r.authName);
				setTxt('lblActiveSerial', r.serial);

				updateFieldStates();
				renderExtraCellBuilder();
				renderPuwerBuilder();
				renderPhotoTiles();
				renderAssetThumbs();
				renderSigThumbs();
				redrawPadFromRecord('pad1', r.inspectorSigLive);
				redrawPadFromRecord('pad2', r.authSigLive);
			} else {
				const r = ndtBatch[activeIdx]; if (!r) return;
				if (!r.photos) r.photos = Array(12).fill(null);
				if (!r.checklist) r.checklist = [];
				if (!r.extraCells) r.extraCells = [];
				if (!r.fieldToggles) r.fieldToggles = {};

				setVal('ndt_in_reportNo', r.reportNo);
				setVal('ndt_in_client', r.client);
				setVal('ndt_in_location', r.location);
				setVal('ndt_in_poRef', r.poRef);
				setVal('ndt_in_itemDesc', r.itemDesc);
				setVal('ndt_in_material', r.material);
				setVal('ndt_in_testSpec', r.testSpec);
				setVal('ndt_in_result', r.result || 'PASSED / ACCEPTABLE');
				setVal('ndt_in_remarks', r.remarks);
				setVal('ndt_in_certLevel', r.certLevel || 'ISO 9712 Level 2');
				setVal('ndt_in_certNo', r.certNo);
				setVal('ndt_in_certExpiry', r.certExpiry);
				setVal('ndt_in_visionTest', r.visionTest);
				setVal('ndt_in_procedureNo', r.procedureNo);
				setVal('ndt_in_acceptCriteria', r.acceptCriteria);
				setVal('ndt_in_calDue', r.calDue);
				setVal('ndt_in_refBlock', r.refBlock);
				setVal('ndt_in_surfaceCond', r.surfaceCond);
				setVal('ndt_in_surfaceTemp', r.surfaceTemp || '24');
				setVal('ndt_in_lightIntensity', r.lightIntensity);
				setVal('ndt_in_couplant', r.couplant);
				setVal('ndt_in_coverage', r.coverage);
				setVal('ndt_in_verdictLabel', r.verdictLabel || 'TEST DETERMINATION');
				setVal('ndt_in_verdictText', r.verdictText);
				setVal('ndt_in_inspectorName', r.inspectorName);
				setVal('ndt_in_witnessName', r.witnessName);
				setTxt('lblActiveSerial', r.reportNo);

				setNdtMethod(r.method || 'MPI');
				renderNdtDynamicFields();
				renderNdtIndications();
				renderNdtSigThumbs();
				renderNdtExtraCellBuilder();
				renderPhotoTiles();
				renderAssetThumbs();
				redrawPadFromRecord('pad3', r.inspSigLive);
				redrawPadFromRecord('pad4', r.witSigLive);
			}

			updateFieldStates();
			renderChecklistBuilder();
			runSlingCalc();
			runRopeCalc();
			initConv();
			runUnitConvert();
			renderPreview();
			runWorkflowChecks();
			renderSheet();
		}
