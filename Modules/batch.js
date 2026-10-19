				/* BATCH GRID */

				function applyRangeSelection(s, clearOthers) {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const f = Math.max(1, parseInt(document.getElementById('rangeFrom').value, 10) || 1);
					const t = Math.min(list.length, parseInt(document.getElementById('rangeTo').value, 10) || list.length);
					let affected = 0;
					list.forEach((r, i) => {
						const inRange = (i + 1 >= f && i + 1 <= t);
						if (inRange) {
							r.selected = s;
							affected++;
						} else if (s && clearOthers !== false) {
							// When user selects a range (e.g. 1 to 499), deselect everything outside that range
							r.selected = false;
						}
					});
					renderSheet();
					showToast((s ? 'Selected ' : 'Deselected ') + affected + ' records (Range ' + f + '-' + t + ').', 'info');
				}
				function toggleColumnLock(k) { columnLocks[k] = !columnLocks[k]; renderSheet(); }
				function toggleAllLocks(s) { Object.keys(columnLocks).forEach(k => columnLocks[k] = s); renderSheet(); }
				function changeBatchPage(d) {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const visibleCount = Array.isArray(_batchFilteredIndices) ? _batchFilteredIndices.length : list.length;
					const mx = Math.max(0, Math.ceil(visibleCount / batchPageSize) - 1);
					const target = batchPage + d;
					if (target >= 0 && target <= mx) {
						batchPage = target;
						renderSheet();
					}
				}
				function setBatchPage(targetPage) {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const visibleCount = Array.isArray(_batchFilteredIndices) ? _batchFilteredIndices.length : list.length;
					const mx = Math.max(0, Math.ceil(visibleCount / batchPageSize) - 1);
					let p = targetPage === 'first' ? 0 : (targetPage === 'last' ? mx : parseInt(targetPage, 10));
					if (isNaN(p)) p = 0;
					p = Math.max(0, Math.min(mx, p));
					if (batchPage !== p) {
						batchPage = p;
						renderSheet();
					}
				}
				function submitBatchGoToPage() {
					const inp = document.getElementById('batchGoToPageInput');
					if (!inp) return;
					const targetNum = parseInt(inp.value, 10);
					if (isNaN(targetNum)) return;
					setBatchPage(targetNum - 1); // 1-indexed to 0-indexed
				}
				function updateSelectionCounter() {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const sel = list.filter(r => r.selected === true);
					const n = sel.length;
					const estFn = (typeof estimateRecordPages === 'function') ? estimateRecordPages : () => 1;
					const totalPages = sel.reduce((sum, r) => sum + estFn(r, currentEngine), 0);

					const statusEl = document.getElementById('rangeSelectionStatus');
					if (statusEl) {
						if (n > 0) {
							statusEl.textContent = 'Selected: ' + n + ' records (~' + totalPages + ' pages)';
							statusEl.style.color = n > 100 ? 'var(--danger, #ff4d4f)' : 'var(--accent, #1677ff)';
						} else {
							statusEl.textContent = 'Selected: 0 records';
							statusEl.style.color = 'var(--ink-muted)';
						}
					}

					// Export buttons are icons now — update their tooltips instead
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
								(typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(q)
							);
						} else {
							const v = r[_batchFilterField];
							matched = (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(q);
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
						if (typeof loadActiveRecord === 'function') loadActiveRecord(true);
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
						const btnFirst = document.getElementById('btnBatchFirst');
						const btnPrev = document.getElementById('btnBatchPrev');
						const btnNext = document.getElementById('btnBatchNext');
						const btnLast = document.getElementById('btnBatchLast');
						if (btnFirst) btnFirst.disabled = true;
						if (btnPrev) btnPrev.disabled = true;
						if (btnNext) btnNext.disabled = true;
						if (btnLast) btnLast.disabled = true;
						const goToInput = document.getElementById('batchGoToPageInput');
						if (goToInput) { goToInput.value = '1'; goToInput.max = '1'; goToInput.disabled = true; }
						updateSelectionCounter();
						updateBatchSearchCount();
						return;
					}

					const frag = document.createDocumentFragment();
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
							if (c.key === 'extraCells' || c.key === 'puwerRows' || c.key === 'indications' || c.key === 'checklist') {
								const val = getRecordCellValue(r, c.key);
								const count = (c.key === 'extraCells' ? (r.extraCells || []).length : (c.key === 'puwerRows' ? (r.puwerRows || []).length : (c.key === 'indications' ? (r.indications || []).length : (r.checklist || []).length)));
								const badge = count > 0 ? '<span contenteditable="false" style="display:inline-block;padding:1px 5px;font-size:10px;font-weight:bold;background:var(--panel);border:1px solid var(--hairline);border-radius:3px;margin-right:4px;user-select:none;">' + count + '</span>' : '';
								rh += '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" contenteditable="true" title="' + attrEsc(val) + '" onblur="handleCellEdit(' + i + ',\'' + c.key + '\',this.innerText,this)">' +
									badge + '<span class="cell-val-text">' + sanitizeForReport(val || '') + '</span></td>';
							} else {
								rh += '<td' + (MONO_GRID_KEYS[c.key] ? ' class="mono"' : '') +
									' contenteditable="true" onblur="handleCellEdit(' + i + ',\'' + c.key + '\',this.innerText)">' +
									sanitizeForReport(r[c.key] || '') + '</td>';
							}
						});
						tr.innerHTML = rh;
						tr.onclick = function (ev) {
							if (ev.target.tagName !== 'INPUT' && ev.target.getAttribute('contenteditable') !== 'true') {
								syncCurrentData();
								activeIdx = i;
								loadActiveRecord();
							}
						};
						frag.appendChild(tr);
					}
					tb.appendChild(frag);

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
					const btnFirst = document.getElementById('btnBatchFirst');
					const btnPrev = document.getElementById('btnBatchPrev');
					const btnNext = document.getElementById('btnBatchNext');
					const btnLast = document.getElementById('btnBatchLast');
					if (btnFirst) btnFirst.disabled = (batchPage <= 0);
					if (btnPrev) btnPrev.disabled = (batchPage <= 0);
					if (btnNext) btnNext.disabled = (batchPage >= mx);
					if (btnLast) btnLast.disabled = (batchPage >= mx);
					const goToInput = document.getElementById('batchGoToPageInput');
					if (goToInput) {
						goToInput.value = batchPage + 1;
						goToInput.max = mx + 1;
						goToInput.disabled = (mx <= 0);
					}
					updateSelectionCounter();
					updateBatchSearchCount();
				}
				function handleCellEdit(i, k, v, el) {
					const r = currentEngine === 'LIFTING' ? liftingBatch[i] : ndtBatch[i];
					let cleanVal = v;
					if (el && el.querySelector) {
						const spanVal = el.querySelector('.cell-val-text');
						if (spanVal) cleanVal = spanVal.innerText || spanVal.textContent || '';
					}
					if (k === 'extraCells') {
						r.extraCells = parseExtraCells(cleanVal);
					} else if (k === 'puwerRows') {
						r.puwerRows = parsePuwerRows(cleanVal);
					} else if (k === 'indications') {
						r.indications = parseIndications(cleanVal);
					} else if (k === 'checklist') {
						r.checklist = parseChecklist(cleanVal);
					} else {
						// ── FIX H2: route through validation rules.
						r[k] = (typeof window._validateField === 'function') ? window._validateField(k, v) : v.trim();
						if (currentEngine === 'LIFTING') {
							if (k === 'dangerImm') {
								r.isSafe = (r.dangerImm === 'YES') ? 'NO' : 'YES';
							} else if (k === 'isSafe') {
								r.dangerImm = (r.isSafe === 'YES') ? 'NO' : 'YES';
							}
						}
					}
					if (i === activeIdx) {
						loadActiveRecord();
					} else if (k === 'extraCells' || k === 'puwerRows' || k === 'indications' || k === 'checklist') {
						renderSheet();
					}
					debouncedSync();
				}
				function toggleAllRows(s) { (currentEngine === 'LIFTING' ? liftingBatch : ndtBatch).forEach(r => r.selected = s); renderSheet(); }
				function cloneSelectedRows() {
					syncCurrentData();
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const sel = list.filter(r => r.selected);
					if (!sel.length) { showToast('Nothing selected.', 'error'); return; }
					// Find the index of the last selected row to insert the clone block immediately after it
					let lastSelIdx = -1;
					list.forEach((r, idx) => {
						if (r.selected) lastSelIdx = idx;
					});
					const engine = currentEngine === 'LIFTING' ? 'lifting' : 'ndt';
					const newClones = [];
					sel.forEach(s0 => {
						const c = JSON.parse(JSON.stringify(s0));
						c.reportNo = getNextReportNumber(currentEngine === 'LIFTING' ? 'LFT' : 'NDT');
						s0.selected = false;
						c.selected = true;
						delete c.uid;
						c._photoMarkers = null;
						PhotosIDB.stageRecordPhotos(engine, c).catch(e => console.error('[clone] stage', e));
						list.splice(lastSelIdx + 1 + newClones.length, 0, c);
						newClones.push(c);
					});
					window.liftingBatch = liftingBatch;
					window.ndtBatch = ndtBatch;
					renderSheet();
					debouncedSync();
					showToast('Cloned ' + sel.length + '.', 'success');
				}
				function deleteSelectedRows() {
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const sel = list.filter(r => r.selected);
					if (!sel.length) { showToast('Nothing selected.', 'error'); return; }
					const rem = list.filter(r => !r.selected);
					if (currentEngine === 'LIFTING') {
						liftingBatch = rem.length ? rem : [{ reportNo: getNextReportNumber(), reportDate: todayISO(), quantity: '1', examParticulars: DEFAULT_EXAM_PARTICULARS, additionalTesting: 'NO', fieldToggles: {}, sectionToggles: {}, puwerRows: defaultPuwerRows(), photos: Array(12).fill(null), checklist: [], extraCells: [], selected: false }];
						window.liftingBatch = liftingBatch;
					} else {
						ndtBatch = rem.length ? rem : [defaultNdtRecord(null)];
						window.ndtBatch = ndtBatch;
					}
					activeIdx = 0;
					window.activeIdx = 0;
					loadActiveRecord();
					renderSheet();
					debouncedSync();
					showToast('Deleted ' + sel.length + '.', 'info');
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
					} else if (targetKey === 'logo') {
						title = 'Apply Company Logo to Batch';
						previewText = assets.logo ? ('Company Logo: ' + dataUrlKB(assets.logo) + ' KB') : '(No logo uploaded)';
					} else if (targetKey === 'headerBanner') {
						title = 'Apply Header Banner to Batch';
						previewText = assets.headerBanner ? ('Header Banner: ' + dataUrlKB(assets.headerBanner) + ' KB') : '(No header banner uploaded)';
					} else if (targetKey === 'footerBanner') {
						title = 'Apply Footer Band to Batch';
						previewText = assets.footerBanner ? ('Footer Band: ' + dataUrlKB(assets.footerBanner) + ' KB') : '(No footer band uploaded)';
					} else if (targetKey === 'accreds') {
						title = 'Apply Accreditation Badges to Batch';
						const num = (assets.accreds || []).filter(a => !!a.img).length;
						previewText = num + ' Accreditation badge' + (num === 1 ? '' : 's') + ' uploaded';
					} else if (typeof targetKey === 'string' && targetKey.indexOf('accred_') === 0) {
						const idx = parseInt(targetKey.replace('accred_', ''), 10);
						const a = (assets.accreds || [])[idx];
						title = 'Apply ' + (a && a.name ? a.name : 'Badge') + ' to Batch';
						previewText = (a && a.img) ? ('Badge Image: ' + dataUrlKB(a.img) + ' KB') : '(No image uploaded)';
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
							r.stampEnabled = curRec.stampEnabled !== false;
							r.stampBleed = curRec.stampBleed !== false;
							if (curRec.stampPos) r.stampPos = { x: curRec.stampPos.x, y: curRec.stampPos.y };
							if (curRec.stampSize) r.stampSize = { w: curRec.stampSize.w, h: curRec.stampSize.h };
							r.stampLocked = !!curRec.stampLocked;
						});
					} else if (targetKey === 'logo' || targetKey === 'headerBanner' || targetKey === 'footerBanner' || targetKey === 'accreds' || (typeof targetKey === 'string' && targetKey.indexOf('accred_') === 0)) {
						// Global branding assets apply uniformly across all records and engines
						if (typeof schedulePersist === 'function') schedulePersist();
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

				function jumpToRecordIndex(idx) {
					syncCurrentData();
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					if (idx >= 0 && idx < list.length) {
						activeIdx = idx;
						loadActiveRecord();
						scrollFormToTop();
						renderSheet();
						debouncedSync();
						showToast('Switched to record ' + (idx + 1) + ' of ' + list.length + (list[idx].reportNo ? ' (' + list[idx].reportNo + ')' : ''), 'info');
						return true;
					}
					return false;
				}

				function openGoToRecordDialog() {
					const dlg = document.getElementById('goToRecordDialog');
					if (!dlg) return;
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const modeSel = document.getElementById('goToModeSelect');
					if (modeSel) modeSel.value = 'record';
					onGoToModeChange();

					// Populate quick report dropdown
					const quickSel = document.getElementById('goToQuickReportSelect');
					if (quickSel) {
						let opts = '<option value="">-- Quick select report in current batch --</option>';
						const maxPreview = Math.min(list.length, 300);
						for (let i = 0; i < maxPreview; i++) {
							const r = list[i];
							const repNo = r.reportNo || ('#' + (i + 1));
							const desc = r.description || r.component || r.serial || '';
							const label = (i + 1) + '. ' + repNo + (desc ? ' - ' + desc.substring(0, 30) : '');
							opts += '<option value="' + i + '"' + (i === activeIdx ? ' selected' : '') + '>' + sanitizeForReport(label) + '</option>';
						}
						quickSel.innerHTML = opts;
					}

					dlg.showModal();
					const inp = document.getElementById('goToInputValue');
					if (inp) {
						inp.value = (activeIdx + 1);
						inp.focus();
						inp.select();
					}
				}

				function onGoToModeChange() {
					const modeSel = document.getElementById('goToModeSelect');
					const lbl = document.getElementById('goToInputLabel');
					const inp = document.getElementById('goToInputValue');
					const recBlock = document.getElementById('goToRecentReportsBlock');
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const mode = modeSel ? modeSel.value : 'record';

					if (mode === 'report') {
						if (lbl) lbl.textContent = 'Enter Report Number:';
						if (inp) {
							inp.placeholder = 'e.g. LFT-20261018-01';
							inp.value = list[activeIdx]?.reportNo || '';
							inp.focus();
							inp.select();
						}
						if (recBlock) recBlock.style.display = 'block';
					} else {
						if (lbl) lbl.textContent = 'Enter Record Number (1 to ' + list.length + '):';
						if (inp) {
							inp.placeholder = 'e.g. ' + (activeIdx + 1);
							inp.value = (activeIdx + 1);
							inp.focus();
							inp.select();
						}
						if (recBlock) recBlock.style.display = 'none';
					}
				}

				function onQuickReportSelect(val) {
					if (val === '' || val === null || val === undefined) return;
					const targetIdx = parseInt(val, 10);
					if (!isNaN(targetIdx)) {
						jumpToRecordIndex(targetIdx);
						const dlg = document.getElementById('goToRecordDialog');
						if (dlg && dlg.open) dlg.close();
					}
				}

				function submitGoToRecord() {
					const dlg = document.getElementById('goToRecordDialog');
					const modeSel = document.getElementById('goToModeSelect');
					const inp = document.getElementById('goToInputValue');
					if (!inp) return;
					const rawVal = (inp.value || '').trim();
					if (!rawVal) {
						showToast('Please provide a record number or report number.', 'warn');
						return;
					}

					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const mode = modeSel ? modeSel.value : 'record';
					let foundIdx = -1;

					if (mode === 'record') {
						const num = parseInt(rawVal, 10);
						if (isNaN(num) || num < 1 || num > list.length) {
							showToast('Invalid record number. Please enter 1 to ' + list.length + '.', 'error');
							return;
						}
						foundIdx = num - 1;
					} else {
						// Look up by report number (exact, case-insensitive, or prefix)
						const term = rawVal.toLowerCase();
						foundIdx = list.findIndex(r => (r.reportNo || '').toLowerCase() === term);
						if (foundIdx === -1) {
							// Partial match if exact match not found
							foundIdx = list.findIndex(r => (r.reportNo || '').toLowerCase().includes(term) || (r.serial || '').toLowerCase().includes(term));
						}
						if (foundIdx === -1) {
							showToast('Report "' + rawVal + '" not found in current batch.', 'error');
							return;
						}
					}

					if (jumpToRecordIndex(foundIdx)) {
						if (dlg && dlg.open) dlg.close();
					}
				}
				function addBatchRecord() {
					syncCurrentData();
					const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
					const a = list[activeIdx] || {};
					const inheritLocked = (key, fallback) => (columnLocks && columnLocks[key] && a[key] !== undefined && a[key] !== '') ? a[key] : fallback;

					if (currentEngine === 'LIFTING') {
						list.splice(activeIdx + 1, 0, {
							reportNo: getNextReportNumber(),
							reportDate: inheritLocked('reportDate', todayISO()),
							jobRef: inheritLocked('jobRef', ''),
							poRef: inheritLocked('poRef', ''),
							companyAccred: inheritLocked('companyAccred', a.companyAccred || ''),
							standards: inheritLocked('standards', a.standards || ''),
							sopRef: inheritLocked('sopRef', a.sopRef || ''),
							fieldToggles: JSON.parse(JSON.stringify(a.fieldToggles || {})),
							includePuwer: a.includePuwer || false,
							includeChecklist: false,
							includePhotos: false,
							puwerRows: defaultPuwerRows(),
							employer: inheritLocked('employer', a.employer || ''),
							premises: inheritLocked('premises', a.premises || ''),
							subLocation: inheritLocked('subLocation', ''),
							colourCode: inheritLocked('colourCode', ''),
							description: inheritLocked('description', ''),
							swl: inheritLocked('swl', ''),
							quantity: inheritLocked('quantity', '1'),
							manufacturer: inheritLocked('manufacturer', ''),
							model: inheritLocked('model', ''),
							serial: inheritLocked('serial', ''),
							plantId: inheritLocked('plantId', ''),
							mfgYear: inheritLocked('mfgYear', ''),
							lastExamDate: inheritLocked('lastExamDate', ''),
							markingsLegible: inheritLocked('markingsLegible', 'YES'),
							q_firstExam: inheritLocked('q_firstExam', 'NO'),
							q_installedCorrectly: inheritLocked('q_installedCorrectly', 'N/A'),
							q_int6m: inheritLocked('q_int6m', 'YES'),
							q_int12m: inheritLocked('q_int12m', 'NO'),
							q_scheme: inheritLocked('q_scheme', 'NO'),
							q_exceptional: inheritLocked('q_exceptional', 'NO'),
							examParticulars: inheritLocked('examParticulars', DEFAULT_EXAM_PARTICULARS),
							additionalTesting: inheritLocked('additionalTesting', 'NO'),
							additionalTestingDetails: inheritLocked('additionalTestingDetails', ''),
							proofLoadApplied: inheritLocked('proofLoadApplied', ''),
							lastProofDetails: inheritLocked('lastProofDetails', ''),
							nextProofDate: inheritLocked('nextProofDate', ''),
							defectDesc: inheritLocked('defectDesc', 'NONE.'),
							dangerImm: inheritLocked('dangerImm', 'NO'),
							dangerTimeText: inheritLocked('dangerTimeText', 'N/A'),
							remedies: inheritLocked('remedies', 'None'),
							isSafe: inheritLocked('isSafe', 'YES'),
							examDate: inheritLocked('examDate', todayISO()),
							nextExamDate: inheritLocked('nextExamDate', calculateNextDate(todayISO(), 6)),
							verdictLabel: '', verdictText: '', extraCells: [],
							examinerName: inheritLocked('examinerName', a.examinerName || ''),
							authName: inheritLocked('authName', a.authName || ''),
							checklist: [], photos: Array(12).fill(null),
							inspectorSigLive: null, inspectorSigUpload: null, inspectorSigMode: 'LIVE',
							authSigLive: null, authSigUpload: null, authSigMode: 'LIVE',
							stampUpload: a.stampUpload || null, stampPos: { x: 70, y: 76 }, selected: false
						});
						activeIdx++;
					} else {
						const rec = defaultNdtRecord(a);
						Object.keys(columnLocks).forEach(k => {
							if (columnLocks[k] && a[k] !== undefined && a[k] !== '') rec[k] = a[k];
						});
						list.splice(activeIdx + 1, 0, rec);
						activeIdx++;
					}
					window.liftingBatch = liftingBatch;
					window.ndtBatch = ndtBatch;
					window.activeIdx = activeIdx;
					loadActiveRecord();
					renderSheet();
					debouncedSync();
					showToast('Record added.', 'info');
					scrollFormToTop();
				}

				function loadActiveRecord(skipSheetRender) {
			// ── FIX: defensive DOM writes. If any expected input element is
			//    missing from the DOM (renamed, deleted, mis-pasted, or
			//    toggled away by a pill), skip it silently rather than
			//    throwing on null.value. Previously one missing element
			//    halted the entire load, leaving the form and preview blank.
			const g = id => document.getElementById(id);
			const setVal = (id, v) => { const el = g(id); if (el) el.value = (v == null ? '' : v); };
			const setTxt = (id, v) => { const el = g(id); if (el) el.textContent = (v == null ? '' : v); };

			if (currentEngine === 'LIFTING') {
				if (!liftingBatch || !liftingBatch.length) {
					if (typeof defaultLiftingRecord === 'function') liftingBatch = [defaultLiftingRecord()];
				}
				if (activeIdx < 0 || activeIdx >= liftingBatch.length) activeIdx = 0;
				const r = liftingBatch[activeIdx]; 
				if (!r) return;
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
				setVal('in_examinerName', r.examinerName);
				setVal('in_authName', r.authName);
				setTxt('lblActiveSerial', r.reportNo || r.serial || '—');

				updateFieldStates();
				renderExtraCellBuilder();
				renderPuwerBuilder();
				renderPhotoTiles();
				renderAssetThumbs();
				renderSigThumbs();
				redrawPadFromRecord('pad1', r.inspectorSigLive);
				redrawPadFromRecord('pad2', r.authSigLive);
				} else {
				if (!ndtBatch || !ndtBatch.length) {
					if (typeof defaultNdtRecord === 'function') ndtBatch = [defaultNdtRecord()];
				}
				if (activeIdx < 0 || activeIdx >= ndtBatch.length) activeIdx = 0;
				const r = ndtBatch[activeIdx]; 
				if (!r) return;
				if (!Array.isArray(r.photos)) r.photos = [];
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
			if (typeof autoExpandAllTextareas === 'function') autoExpandAllTextareas();
			runSlingCalc();
			runRopeCalc();
			initConv();
			runUnitConvert();
			renderPreview();
			runWorkflowChecks();
			if (!skipSheetRender) renderSheet();
		}

		/* CHILD TABLES SERIALIZATION (Indications, PUWER, Extra Cells) */
		function serializeExtraCells(arr) {
			if (!Array.isArray(arr) || !arr.length) return '';
			return arr.map(c => (c.label || '') + ': ' + (c.value || '')).join(' ++ ');
		}
		function parseExtraCells(str) {
			if (!str || typeof str !== 'string') return [];
			// Clean any prepended badge number if user edited content with badge inside
			let clean = str.replace(/^\s*\d+\s*/, '');
			const parts = clean.split(/\s*(?:\+\+|\r?\n|;)\s*/);
			const res = [];
			parts.forEach(p => {
				const trim = p.trim();
				if (!trim) return;
				const idx = trim.indexOf(':');
				if (idx !== -1) {
					res.push({ label: trim.slice(0, idx).trim(), value: trim.slice(idx + 1).trim() });
				} else {
					res.push({ label: 'NOTE', value: trim });
				}
			});
			return res;
		}

		function serializePuwerRows(arr) {
			if (!Array.isArray(arr) || !arr.length) return '';
			return arr.map(r => [r.ref || '', r.item || '', r.result || 'PASS', r.note || ''].join(' | ')).join(' ++ ');
		}
		function parsePuwerRows(str) {
			if (!str || typeof str !== 'string') return defaultPuwerRows();
			let clean = str.replace(/^\s*\d+\s*/, '');
			const parts = clean.split(/\s*(?:\+\+|\r?\n)\s*/);
			const res = [];
			parts.forEach(p => {
				const trim = p.trim();
				if (!trim) return;
				const cols = trim.split('|').map(s => s.trim());
				res.push({
					ref: cols[0] || 'Reg —',
					item: cols[1] || '',
					result: cols[2] || 'PASS',
					note: cols[3] || ''
				});
			});
			return res.length ? res : defaultPuwerRows();
		}

		function serializeIndications(arr) {
			if (!Array.isArray(arr) || !arr.length) return '';
			return arr.map(r => [r.item || '', r.area || '', r.finding || '', r.result || 'PASS'].join(' | ')).join(' ++ ');
		}
		function parseIndications(str) {
			if (!str || typeof str !== 'string') return [];
			let clean = str.replace(/^\s*\d+\s*/, '');
			const parts = clean.split(/\s*(?:\+\+|\r?\n)\s*/);
			const res = [];
			parts.forEach(p => {
				const trim = p.trim();
				if (!trim) return;
				const cols = trim.split('|').map(s => s.trim());
				res.push({
					item: cols[0] || '',
					area: cols[1] || '',
					finding: cols[2] || '',
					result: cols[3] || 'PASS'
				});
			});
			return res;
		}

		function serializeChecklist(arr) {
			if (!Array.isArray(arr) || !arr.length) return '';
			return arr.map(r => [r.item || '', r.status || 'PASS', r.note || ''].join(' | ')).join(' ++ ');
		}
		function parseChecklist(str) {
			if (!str || typeof str !== 'string') return [];
			let clean = str.replace(/^\s*\d+\s*/, '');
			const parts = clean.split(/\s*(?:\+\+|\r?\n)\s*/);
			const res = [];
			parts.forEach(p => {
				const trim = p.trim();
				if (!trim) return;
				const cols = trim.split('|').map(s => s.trim());
				res.push({
					item: cols[0] || '',
					status: cols[1] || 'PASS',
					note: cols[2] || ''
				});
			});
			return res;
		}

		function getRecordCellValue(r, key) {
			if (key === 'extraCells') return serializeExtraCells(r.extraCells);
			if (key === 'puwerRows') return serializePuwerRows(r.puwerRows);
			if (key === 'indications') return serializeIndications(r.indications);
			if (key === 'checklist') return serializeChecklist(r.checklist);
			return r[key] || '';
		}

		/* CSV IMPORT / EXPORT */
		function exportSelectedCsv() {
			syncCurrentData();
			const isL = currentEngine === 'LIFTING';
			const list = isL ? liftingBatch : ndtBatch;
			let it = list.filter(r => r.selected === true);
			if (!it.length) it = list;
			const cols = isL ? LIFTING_COLUMNS : NDT_COLUMNS;
			const headerLine = cols.map(c => '"' + c.label + '"').join(',');
			const lines = [headerLine];
			it.forEach(x => {
				lines.push(cols.map(c => {
					const val = getRecordCellValue(x, c.key);
					return '"' + String(val).replace(/\+\+/g, '\n').replace(/"/g, '""') + '"';
				}).join(','));
			});
			const b = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
			const u = URL.createObjectURL(b);
			const a = document.createElement('a');
			a.href = u; a.download = 'Export_' + Date.now() + '.csv'; a.click();
			URL.revokeObjectURL(u);
			showToast('Exported ' + it.length + '.', 'success');
		}

		function importMasterCsv(evt) {
			const f = evt.target.files[0]; if (!f) return;
			const engineAtImport = currentEngine;
			const rd = new FileReader();
			rd.onload = e => {
				const text = e.target.result;
				const d = text.includes('\t') ? '\t' : (text.includes(';') ? ';' : ',');
				const rows = [];
				let row = [], q = false, cur = '';
				for (let i = 0; i < text.length; i++) {
					const c = text[i], nx = text[i + 1];
					if (c === '"') { if (q && nx === '"') { cur += '"'; i++; } else q = !q; }
					else if (c === d && !q) { row.push(cur.trim()); cur = ''; }
					else if ((c === '\r' || c === '\n') && !q) { if (c === '\r' && nx === '\n') i++; row.push(cur.trim()); if (row.length > 1 || row[0] !== '') rows.push(row); row = []; cur = ''; }
					else cur += c;
				}
				if (cur) row.push(cur.trim());
				if (row.length) rows.push(row);
				if (rows.length < 2) { showToast('No data rows.', 'error'); return; }
				const heads = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
				const findColIdx = (col) => {
					const lNorm = (col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
					const kNorm = (col.key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
					// 1. Exact match against normalized label or key
					let idx = heads.findIndex(h => h === lNorm || h === kNorm);
					if (idx !== -1) return idx;
					// 2. Substring match fallback
					return heads.findIndex(h => (lNorm && h.includes(lNorm)) || (kNorm && h.includes(kNorm)));
				};

				if (engineAtImport === 'LIFTING') {
					const nb = [];
					for (let i = 1; i < rows.length; i++) {
						const rec = { selected: false, puwerRows: defaultPuwerRows(), photos: Array(12).fill(null), checklist: [], extraCells: [], fieldToggles: {}, examParticulars: DEFAULT_EXAM_PARTICULARS, additionalTesting: 'NO', quantity: '1', reportDate: '' };
						LIFTING_COLUMNS.forEach(c => {
							const mi = findColIdx(c);
							if (mi !== -1 && rows[i][mi] !== undefined) {
								const raw = rows[i][mi].replace(/\r?\n/g, '++');
								if (c.key === 'extraCells') rec.extraCells = parseExtraCells(raw);
								else if (c.key === 'puwerRows') rec.puwerRows = parsePuwerRows(raw);
								else if (c.key === 'checklist') rec.checklist = parseChecklist(raw);
								else rec[c.key] = raw;
							}
						});
						if (!rec.reportNo) rec.reportNo = getNextReportNumber();
						if (!rec.reportDate) rec.reportDate = rec.examDate || todayISO();
						_validateRecordInPlace(rec);                       
						nb.push(rec);
					}
					if (nb.length) {
						liftingBatch = nb;
						window.liftingBatch = nb;
						activeIdx = 0;
						window.activeIdx = 0;
						_rangeToUserEdited = false;
						batchPage = 0;
						if (typeof markDirty === 'function') markDirty();
						if (typeof loadActiveRecord === 'function') loadActiveRecord();
						if (typeof renderSheet === 'function') renderSheet();
						if (typeof renderPreview === 'function') renderPreview();
						if (typeof persistStateV2 === 'function') persistStateV2().catch(e => console.error('[csv-save]', e));
						showToast('Imported and saved ' + nb.length + ' records (LIFTING).', 'success');
					}
				} else {
					const nb = [];
					for (let i = 1; i < rows.length; i++) {
						const rec = defaultNdtRecord(null);
						NDT_COLUMNS.forEach(c => {
							const mi = findColIdx(c);
							if (mi !== -1 && rows[i][mi] !== undefined) {
								const raw = rows[i][mi].replace(/\r?\n/g, '++');
								if (c.key === 'indications') rec.indications = parseIndications(raw);
								else if (c.key === 'extraCells') rec.extraCells = parseExtraCells(raw);
								else if (c.key === 'checklist') rec.checklist = parseChecklist(raw);
								else rec[c.key] = raw;
							}
						});
						if (!rec.reportNo) rec.reportNo = getNextReportNumber('NDT');
						_validateRecordInPlace(rec);
						nb.push(rec);
					}
					if (nb.length) {
						ndtBatch = nb;
						window.ndtBatch = nb;
						activeIdx = 0;
						window.activeIdx = 0;
						_rangeToUserEdited = false;
						batchPage = 0;
						if (typeof markDirty === 'function') markDirty();
						if (typeof loadActiveRecord === 'function') loadActiveRecord();
						if (typeof renderSheet === 'function') renderSheet();
						if (typeof renderPreview === 'function') renderPreview();
						if (typeof persistStateV2 === 'function') persistStateV2().catch(e => console.error('[csv-save]', e));
						showToast('Imported and saved ' + nb.length + ' records (NDT).', 'success');
					}
				}
			};
			rd.readAsText(f);
			evt.target.value = '';
		}

		/* DEMO SAMPLE GENERATOR */
		function addSampleRecord(type) {
			const today = todayISO();
			if (currentEngine === 'LIFTING' || type === 'crane' || type === 'sling') {
				const isCrane = type !== 'sling';
				const sample = {
					reportNo: getNextReportNumber('LFT'),
					reportDate: today,
					jobRef: isCrane ? 'JOB-CR-904' : 'JOB-SL-402',
					poRef: 'PO-2026-ENG',
					companyAccred: 'Vanguard Inspection Services Ltd.',
					standards: isCrane ? 'BS 7121-2, LOLER Reg 9, ISO 4309' : 'BS EN 1492-2, LOLER Reg 9, ASME B30.9',
					sopRef: isCrane ? 'SOP-CRANE-01' : 'SOP-RIG-03',
					fieldToggles: {},
					sectionToggles: {},
					includePuwer: isCrane,
					includeChecklist: true,
					includePhotos: false,
					puwerRows: defaultPuwerRows(),
					employer: 'North Sea Drilling Offshore Co.++Aberdeen, UK',
					premises: isCrane ? 'Quayside Offshore Terminal 4' : 'Warehouse Rigging Store #2',
					subLocation: isCrane ? 'Berth 12 Heavy Lift Area' : 'Rack A-14',
					colourCode: 'BLUE',
					description: isCrane ? 'Tadano GR-700EX 70-Tonne Rough Terrain Mobile Crane' : '4-Leg Grade 80 Steel Chain Sling Assembly with Clevis Hooks (10mm)',
					swl: isCrane ? '70.0 Tonnes @ 3.0m Radius' : '6.7 Tonnes (0°-45°) / 4.75 Tonnes (45°-60°)',
					quantity: '1',
					identification: isCrane ? 'Fleet #TC-704 / Tag: CR-2026' : 'ID Tag #SL-04-981 / SN-CH-441',
					manufacturer: isCrane ? 'Tadano Faun GmbH' : 'Gunnebo Industries',
					model: isCrane ? 'GR-700EX' : 'Classic G80 GrabiQ',
					serial: isCrane ? 'SN-TD-881940' : 'SN-GN-22019',
					plantId: isCrane ? 'PLANT-CRN-08' : 'PLANT-SLG-19',
					mfgYear: '2023',
					lastExamDate: calculateNextDate(today, -6),
					markingsLegible: 'YES',
					q_firstExam: 'NO',
					q_installedCorrectly: 'YES',
					q_int6m: isCrane ? 'NO' : 'YES',
					q_int12m: isCrane ? 'YES' : 'NO',
					q_scheme: 'NO',
					q_exceptional: 'NO',
					examParticulars: isCrane ? 'Visual examination, operational overload test, slew bearing backlash, and boom telemetry limit calibration by Competent Person.' : '100% visual, dimensional, elongation check, and link wear gauge inspection carried out by Competent Person.',
					additionalTesting: isCrane ? 'YES' : 'NO',
					additionalTestingDetails: isCrane ? 'Functional test of load moment indicator (LMI) and boom angle sensor limits.' : '',
					proofLoadApplied: isCrane ? 'Static Proof Load Test 87.5 Tonnes (125% SWL) held for 10 minutes' : 'Visual & dimensional link caliper check',
					lastProofDetails: '2023-08-15 | Cert #PLT-9921',
					nextProofDate: calculateNextDate(today, 24),
					defectDesc: 'NONE. Work equipment is in sound condition and free from patent structural or mechanical defect.',
					dangerImm: 'NO',
					dangerTimeText: 'N/A',
					remedies: 'Routine scheduled lubrication as per manufacturer O&M manual.',
					isSafe: 'YES',
					examDate: today,
					nextExamDate: calculateNextDate(today, isCrane ? 12 : 6),
					verdictLabel: 'FIT FOR CONTINUED SERVICE',
					verdictText: 'Complies with LOLER 1998 Regulation 9(3) statutory requirements.',
					extraCells: [],
					examinerName: 'Marcus Vance | Senior LEEA Inspector',
					authName: 'David H. Miller | Technical Director',
					checklist: [
						{ item: 'Structural welds & boom boom integrity', status: 'PASS', note: 'No deformation' },
						{ item: 'Safety latches and clevis pins', status: 'PASS', note: 'Positive locking' },
						{ item: 'Wire rope / chain wear gauge', status: 'PASS', note: 'Within 2% wear limit' }
					],
					photos: Array(12).fill(null),
					inspectorSigLive: null, inspectorSigUpload: null, inspectorSigMode: 'LIVE',
					authSigLive: null, authSigUpload: null, authSigMode: 'LIVE',
					stampUpload: null, stampPos: { x: 70, y: 76 },
					selected: false
				};
				liftingBatch.push(sample);
				activeIdx = liftingBatch.length - 1;
				showToast('Sample LOLER Record added (' + (isCrane ? 'Crane' : 'Sling') + ').', 'success');
			} else {
				const isUT = type === 'ut';
				const sample = Object.assign(defaultNdtRecord(null), {
					reportNo: getNextReportNumber('NDT'),
					method: isUT ? 'UT' : 'MPI',
					client: 'Apex Engineering & Energy Corp.',
					location: 'Offshore Platform Wellhead Module B',
					poRef: 'PO-2026-NDT-08',
					itemDesc: isUT ? 'Butt Weld Item W-104 (12" Sch 80 Super Duplex Pipe)' : 'High-Pressure Manifold Flange Weld Neck Item F-02',
					material: isUT ? 'UNS S32750 Super Duplex' : 'ASTM A105 / A350 LF2 Carbon Steel',
					testSpec: isUT ? 'ASME Sec V Art. 4 & ASME Sec VIII Div 1' : 'ASME Sec V Art. 7 & ASTM E 709',
					result: 'PASSED / ACCEPTABLE',
					remarks: 'No planar or volumetric indications detected exceeding statutory acceptance thresholds.',
					inspectorName: 'Marcus Vance',
					witnessName: 'David H. Miller',
					certLevel: 'ISO 9712 Level II',
					certNo: 'NDT-CERT-2026-99',
					certExpiry: calculateNextDate(today, 36),
					visionTest: calculateNextDate(today, -2),
					procedureNo: isUT ? 'SOP-NDT-UT-008 Rev 2' : 'SOP-NDT-MPI-004 Rev 3',
					acceptCriteria: 'ASME B31.3 Severe Cyclic / ISO 5817 Level B',
					calDue: calculateNextDate(today, 10),
					refBlock: isUT ? 'IIW V1, V2 & DAC 12mm Block' : 'Parker Cast Steel Pie Gauge',
					surfaceCond: 'Smooth, ground flush, wire brushed',
					surfaceTemp: '26',
					lightIntensity: isUT ? '650 lux ambient' : '1100 lux visible white light',
					couplant: isUT ? 'Ultrasound Gel Sonotech' : 'N/A',
					coverage: '100% full volumetric and heat affected zone (HAZ) scan',
					yokeSerial: isUT ? 'N/A' : 'Parker Contour B-300 AC',
					magCurrent: isUT ? 'N/A' : 'AC Continuous 110V 4.5kg lift certified',
					inkType: isUT ? 'N/A' : 'Ardrox 800/3 Black Ink with WCP-2 Contrast',
					utUnit: isUT ? 'Krautkramer USM 36 Digital Flaw Detector' : 'N/A',
					probeFreq: isUT ? '4.0 MHz Dual Element Angle 45°/60°/70°' : 'N/A',
					indications: [
						{ item: isUT ? 'Weld W-104 Root' : 'Flange Toe Weld', area: '12 to 3 o\'clock position', finding: 'Clean, no root lack of penetration', result: 'PASS' },
						{ item: isUT ? 'Weld W-104 Cap' : 'Flange Neck Haz', area: '3 to 6 o\'clock position', finding: 'Clean profile, no undercut', result: 'PASS' }
					],
					selected: false
				});
				ndtBatch.push(sample);
				activeIdx = ndtBatch.length - 1;
				showToast('Sample NDT Record added (' + (isUT ? 'Ultrasonic UT' : 'Magnetic MPI') + ').', 'success');
			}
			window.liftingBatch = liftingBatch;
			window.ndtBatch = ndtBatch;
			window.activeIdx = activeIdx;
			loadActiveRecord();
			renderSheet();
			debouncedSync();
		}

