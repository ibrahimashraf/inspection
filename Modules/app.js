								/* ENGINE SWITCHING */
				// Remember the last cursor position for each engine so the
				// user's place is preserved across tab switches.
				var activeIdxByEngine = { LIFTING: 0, NDT: 0 };

										/* ENGINE SWITCHING */
						function switchEngine(id) {
					// Save the outgoing engine's cursor before we forget it.
					// On the very first call (boot), currentEngine === id, so this
					// is a harmless no-op write of the initial 0.
					activeIdxByEngine[currentEngine] = activeIdx;

					currentEngine = id;
					const list = id === 'LIFTING' ? liftingBatch : ndtBatch;

					// Restore with clamp. Three cases:
					//   - remembered index in range → restore it
					//   - list shrank since last visit → clamp to last valid row
					//   - list is empty → 0 (guards the -1 arithmetic below)
					const remembered = activeIdxByEngine[id] || 0;
					activeIdx = (list.length === 0)
						? 0
						: Math.min(Math.max(0, remembered), list.length - 1);

					// The range toolbar's To field is length-dependent, so the
					// user's prior narrowing is no longer meaningful on a new
					// engine. Clearing the guard lets renderSheet() re-seed it
					// from the incoming record count.
					_rangeToUserEdited = false;

					document.getElementById('btnEngLifting').classList.toggle('active', id === 'LIFTING');
					document.getElementById('btnEngNdt').classList.toggle('active', id === 'NDT');
					document.getElementById('btnEngLifting').setAttribute('aria-selected', id === 'LIFTING');
					document.getElementById('btnEngNdt').setAttribute('aria-selected', id === 'NDT');

					const nav = document.getElementById('navTabsContainer');

					if (id === 'LIFTING') {
						document.title = 'LOLER · Inspection Management Suite';
						nav.innerHTML =
							'<button class="nav-btn active" role="tab" onclick="switchTab(\'tab_loler\',this)">Examination</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_puwer\',this)">PUWER</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_checklist\',this)">Checklist</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_brand\',this)">Branding</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_evidence\',this)">Evidence</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_batch\',this)">Batch Inspection</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_tools\',this)">Tools</button>';
						switchTab('tab_loler', nav.firstElementChild);
					} else {
						document.title = 'NDT · Inspection Management Suite';
						nav.innerHTML =
							'<button class="nav-btn active" role="tab" onclick="switchTab(\'tab_ndt\',this)">Suite</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_checklist\',this)">Checklist</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_brand\',this)">Branding</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_evidence\',this)">Evidence</button>' +
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_batch\',this)">Batch Inspection</button>'+
							'<button class="nav-btn" role="tab" onclick="switchTab(\'tab_tools\',this)">Tools</button>';
						switchTab('tab_ndt', nav.firstElementChild);
						renderNdtDynamicFields();
						renderNdtIndications();
					}

					clearBatchFilter();
					loadActiveRecord();
				}
				 
					

				function switchTab(tabId, btn) {
					const t = document.getElementById(tabId); if (!t) return;
					document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
					t.classList.add('active');
					document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
					if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
					if (tabId === 'tab_checklist') { if (typeof renderChecklistTab === 'function') renderChecklistTab(); renderChecklistBuilder(); }
					if (tabId === 'tab_batch') renderSheet();
					if (tabId === 'tab_evidence') { if (typeof renderEvidenceTab === 'function') renderEvidenceTab(); renderPhotoTiles(); }
					if (tabId === 'tab_brand') { if (typeof renderBrandTab === 'function') renderBrandTab(); renderAssetThumbs(); }
					if (tabId === 'tab_loler') { renderSigThumbs(); renderExtraCellBuilder(); }
					if (tabId === 'tab_puwer') renderPuwerBuilder();
					if (tabId === 'tab_tools') { if (typeof renderToolsTab === 'function') renderToolsTab(); initConv(); runSlingCalc(); runRopeCalc(); runUnitConvert(); }
					            if (tabId === 'tab_ndt') { renderNdtSigThumbs(); renderNdtExtraCellBuilder(); renderNdtIndications(); updateNdtFieldStates(); }
            // The signature pads may have been off-screen when they were
            // first set up. Any time a tab becomes visible, re-size every
            // pad to its real dimensions. Preserves ink via snapshot.
            sizeAllSigPads();
        }


			/* PRINT / EXPORT */
			// Renders the selected records (or the active one) into
			// #printContainer. Split out of printSelectedBatch so that Ctrl+P and
			// File > Print get the same content as the in-app button: the print
			// stylesheet hides .workspace and shows only #printContainer, so
			// without this a browser-initiated print produced a blank page.
			function fillPrintContainer() {
				syncCurrentData();
				const list = currentEngine === 'LIFTING' ? liftingBatch : ndtBatch;
				const chk = list.filter(r => r.selected === true);
				const tg = chk.length ? chk : [list[activeIdx]];
				if (!tg.length || !tg[0]) { showToast('Nothing to print.', 'error'); return false; }
				if (tg.length > MAX_PRINT_SPOOL_LIMIT) { showToast('Spool limit.', 'error'); return false; }

				document.body.classList.add('printing-lock');
				const pc = document.getElementById('printContainer');
					const oi = activeIdx;
					try {
						let comb = '';
					tg.forEach(rec => {
						activeIdx = list.indexOf(rec);
						renderPreview();
						comb += document.getElementById('enginePreviewContainer').innerHTML;
					});
					pc.innerHTML = comb;
					return true;
				} catch (e) {
					console.error('[print]', e);
					showToast('Print spool failed: ' + e.message, 'error');
					return false;
				} finally {
					// Always restore, even if a record failed to render.
					activeIdx = oi;
					try { loadActiveRecord(); } catch (e) {}
					document.body.classList.remove('printing-lock');
				}
			}
			// Ctrl+P and File > Print land here. fillPrintContainer() keeps the
			// content in place (it must survive until the dialog closes) and is
			// cleared on afterprint.
			window.addEventListener('beforeprint', function () {
				try { fillPrintContainer(); } catch (e) { console.error('[print]', e); }
			});
			window.addEventListener('afterprint', function () {
				const pc = document.getElementById('printContainer');
				if (pc) pc.innerHTML = '';
				document.body.classList.remove('printing-lock');
			});

			function printSelectedBatch() {
				document.body.classList.add('printing-lock');
				const pc = document.getElementById('printContainer');
				try {
					if (!fillPrintContainer()) return;
					// beforeprint fires around this call and would refill the
					// container, which is what we want, but guard anyway.
					window.print();
				} finally {
					pc.innerHTML = '';
					document.body.classList.remove('printing-lock');
				}
			}
				/* LIFECYCLE */
				window.addEventListener('pagehide', () => {
					if (typeof isDirty === 'function' && isDirty()) persistStateV2().catch(() => {});
				});

				document.addEventListener('visibilitychange', () => {
					if (document.visibilityState === 'hidden') {
						if (typeof isDirty === 'function' && isDirty()) persistStateV2().catch(() => {});
					}
				});

				window.addEventListener('beforeunload', e => {
					if (typeof isDirty === 'function' && isDirty()) {
						e.preventDefault();
						e.returnValue = '';
					}
				});

				function restorePreferences() {
					const g = id => document.getElementById(id);
					const d = window.APP_DEFAULTS || {};
					setTheme(store.get('ims_theme') || d.appTheme || 'dark');
					const uf = store.get('ims_ui_font') || d.appFont;
					if (uf) { updateAppFont(uf); if (g('globalFontSelect')) g('globalFontSelect').value = uf; }
					const us = store.get('ims_ui_size') || d.appSize;
					if (us) { g('globalSizeSelect').value = us; document.documentElement.style.setProperty('--app-font-size', us); }
					const rf = store.get('ims_rf') || d.reportFont;
					if (rf) { updateReportFont(rf); const rfel = g('reportFontSelect'); if (rfel) rfel.value = rf; }
					const rs = store.get('ims_rs') || d.reportSize;
					if (rs) { document.documentElement.style.setProperty('--report-font-size', rs); g('reportSizeSelect').value = rs; }
					const dn = store.get('ims_rd') || d.reportDensity;
					if (dn) { updateReportDensity(dn); g('reportDensitySelect').value = dn; }
					const rhf = store.get('ims_rhf') || d.reportHeaderFill;
					if (rhf && typeof setReportHeaderFill === 'function') setReportHeaderFill(rhf);
					const ch = store.get('ims_qr') || d.qrChannel;
					if (ch === 'EMAIL' || ch === 'WHATSAPP') qrChannel = ch;
					try {
						const dc = JSON.parse(store.get('ims_dc') || 'null');
						if (dc) {
							if (typeof dc.on === 'boolean') docControl.on = dc.on;
							if (dc.docNo) docControl.docNo = dc.docNo;
							if (dc.rev) docControl.rev = dc.rev;
							if (dc.revDate) docControl.revDate = dc.revDate;
							if (dc.reportNoPattern) docControl.reportNoPattern = dc.reportNoPattern;
						} else if (d.docControl) {
							Object.assign(docControl, d.docControl);
						}
					} catch (e) {}
					try {
						const ci = JSON.parse(store.get('ims_ci') || 'null');
						if (ci) {
							Object.keys(corpInfo).forEach(k => {
								if (ci[k] !== undefined && !/^x+([ ,x]+)?$/i.test(ci[k])) {
									corpInfo[k] = ci[k];
								}
							});
						}
					} catch (e) {}
					try {
						const ft = JSON.parse(store.get('ims_ft') || 'null');
						if (ft) Object.keys(featureToggles).forEach(k => { if (typeof ft[k] === 'boolean') featureToggles[k] = ft[k]; });
						else if (d.featureToggles) Object.assign(featureToggles, d.featureToggles);
					} catch (e) {}
					['dc_docNo', 'in_main_docNo', 'ndt_main_docNo'].forEach(id => { if (g(id)) g(id).value = docControl.docNo; });
					['dc_rev', 'in_main_docRev', 'ndt_main_docRev'].forEach(id => { if (g(id)) g(id).value = docControl.rev; });
					['dc_revDate', 'in_main_docRevDate', 'ndt_main_docRevDate'].forEach(id => { if (g(id)) g(id).value = docControl.revDate; });
					if (g('dc_reportNoPattern')) g('dc_reportNoPattern').value = docControl.reportNoPattern || '{PREFIX}-{DATE}-0{SEQ}';
					if (g('ci_body')) g('ci_body').value = corpInfo.body;
					if (g('ci_accred')) g('ci_accred').value = corpInfo.accred;
					if (g('ci_addr')) g('ci_addr').value = corpInfo.addr;
					if (g('ci_phone')) g('ci_phone').value = corpInfo.phone;
					if (g('ci_email')) g('ci_email').value = corpInfo.email;
					if (g('ci_web')) g('ci_web').value = corpInfo.web;
					['ci_footnote', 'in_main_footnote', 'ndt_main_footnote'].forEach(id => { if (g(id)) g(id).value = corpInfo.footnote; });
					['pill_docControl', 'pill_main_docControl', 'pill_ndt_main_docControl'].forEach(id => {
						const dp = g(id);
						if (dp) { dp.className = 'micro-toggle ' + (docControl.on ? 'on' : 'off'); dp.innerHTML = '<span class="toggle-dot"></span>' + (docControl.on ? 'ON' : 'OFF'); }
					});
					const ly = parseInt(store.get('ims_layout') || '0', 10);
					if (!isNaN(ly) && ly >= 0 && ly < layoutModes.length) currentLayoutIdx = ly;
					const rTheme = store.get('ims_report_theme') || d.reportTheme;
					if (rTheme && typeof setReportTheme === 'function') setReportTheme(rTheme);
					const fStyle = store.get('ims_form_style');
					if (fStyle && typeof setFormStyle === 'function') setFormStyle(fStyle);
					if (typeof restoreCustomColorsUI === 'function') restoreCustomColorsUI();
					applyLayout();
					updateFeaturePills();
					refreshQrUI();
					// The preview renders lazily, so renderPreviewFull has not run
					// yet at this point and the QR budget readout would sit empty.
					updateQrBudget();
				}
					function _validateRecordInPlace(r) {
			if (!r || typeof window._validateField !== 'function') return r;
			const keys = Object.keys(r);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				if (k.charCodeAt(0) === 95) continue;
				const v = r[k];
				const t = typeof v;
				if (t === 'string' || t === 'number') {
					r[k] = window._validateField(k, v);
				}
			}
			return r;
		}

				/* ── PREVIEW RENDER ENTRY POINT ─────────────────────────────────
		   The module `render-patch.js` defines its own renderPreview which
		   may cache output or run a shadow copy of the renderer. Redefining
		   it here — in the inline script that runs AFTER all modules — makes
		   the inline renderPreviewFull the single source of truth. This is
		   what makes the Evidence / Checklist / PUWER pills visible
		   immediately in the preview.                              ── */
		function renderPreview() {
			const c = document.getElementById('enginePreviewContainer');
			if (!c) return;
			try {
				renderPreviewFull(c, activeRec());
			} catch (e) {
				showPreviewError(e);
			}
		}

		let _ioChain = Promise.resolve();
		function _serialiseIO(fn) {
			const next = _ioChain.then(fn, fn);
			_ioChain = next.catch(() => {});
			return next;
		}


		async function _prepareBackupSubstitution() {
			const liveL = window.liftingBatch;
			const liveN = window.ndtBatch;

			let inlinedL = liveL, inlinedN = liveN;
			try {
				inlinedL = await PhotosIDB.inlineMarkersDeep(liveL);
				inlinedN = await PhotosIDB.inlineMarkersDeep(liveN);
			} catch (e) {
				console.error('[backup] inline globals', e);
			}

			const cache = Object.create(null);
			try {
				for (let i = 0; i < localStorage.length; i++) {
					const k = localStorage.key(i);
					if (!k || k.indexOf('ims_') !== 0) continue;
					const v = localStorage.getItem(k);
					if (!v || v.indexOf(PhotosIDB.MARKER) === -1) continue;
					try {
						const parsed = JSON.parse(v);
						cache[k] = JSON.stringify(await PhotosIDB.inlineMarkersDeep(parsed));
					} catch (e) {
						if (v.indexOf(PhotosIDB.MARKER) === 0) {
							const dataUrl = await PhotosIDB.get(v.slice(PhotosIDB.MARKER.length));
							cache[k] = dataUrl || '';
						} else {
							cache[k] = v;
						}
					}
				}
			} catch (e) {
				console.error('[backup] inline storage', e);
			}

			const leaks = [];
			if (PhotosIDB.containsMarker(inlinedL)) leaks.push('liftingBatch');
			if (PhotosIDB.containsMarker(inlinedN)) leaks.push('ndtBatch');
			for (const k in cache) {
				if (PhotosIDB.containsMarker(cache[k])) leaks.push(k);
			}
			if (leaks.length) {
				console.error('[backup] markers leaked:', leaks);
				showToast('Backup aborted: ' + leaks.length + ' photo reference(s) could not be resolved. Try again after reloading.', 'error');
				return null;
			}

			const realGetItem = localStorage.getItem.bind(localStorage);

			return {
				beforeCall() {
					window.liftingBatch = inlinedL;
					window.ndtBatch     = inlinedN;
					Object.defineProperty(localStorage, 'getItem', {
						configurable: true, writable: true,
						value: function (k) {
							return (k in cache) ? cache[k] : realGetItem(k);
						}
					});
				},
				afterCall() {
					window.liftingBatch = liveL;
					window.ndtBatch     = liveN;
					Object.defineProperty(localStorage, 'getItem', {
						configurable: true, writable: true, value: realGetItem
					});
				}
			};
		}

		function _installBackupInlineWrapper() {
			if (!window.exportBackup || window._backupInlineWrapped) return;
			const orig = window.exportBackup;

			window.exportBackup = function () {
				const self = this;
				const args = Array.prototype.slice.call(arguments);
				return _serialiseIO(async function () {
					const restore = await _prepareBackupSubstitution();
					if (!restore) return;
					restore.beforeCall();
					try { return await orig.apply(self, args); }
					finally { restore.afterCall(); }
				});
			};

			window._backupInlineWrapped = true;
		}

		function _installPhotoPersistWrapper() {
			if (!window.persistStateV2 || window._photoPersistWrapped) return;
			const orig = window.persistStateV2;
			window.persistStateV2 = function () {
				const self = this;
				const args = Array.prototype.slice.call(arguments);
				return _serialiseIO(async function () {
					const stash = PhotosIDB.stripPhotosForPersist();
					try { return await orig.apply(self, args); }
					finally { PhotosIDB.restorePhotosAfterPersist(stash); }
				});
			};
			window._photoPersistWrapped = true;
		}

		   async function bootApp() {
			// The AIO self-test costs ~0.9-1.4s on every boot (ECDSA keygen, a
			// sign/verify round trip, an AES round trip and a full audit-chain
			// verify) and it does not get cheaper on later boots. Awaiting it
			// here blocked the first render, which is why a cold start took 5s
			// and every warm start over 2s. Start it now and render immediately;
			// the first save awaits it (see storage.js) so nothing is persisted
			// with the audit chain silently skipped.
			window._aioReady = (window.AIO ? window.AIO.init() : Promise.resolve())
				.catch(e => { console.error('[aio] self-test failed', e); });
			try { await restoreStateV2(); } catch (e) { console.error('[boot] restore failed', e); }
			try { await PhotosIDB.init(); }        catch (e) { console.error('[photos-idb] init',    e); }
			try { await PhotosIDB.migrateAll(); }  catch (e) { console.error('[photos-idb] migrate', e); }
			try { await PhotosIDB.hydrateAll(); }  catch (e) { console.error('[photos-idb] hydrate', e); }
			try { _installPhotoPersistWrapper(); } catch (e) { console.error('[photos-idb] persist wrap', e); }
			try { _installBackupInlineWrapper(); } catch (e) { console.error('[photos-idb] backup wrap', e); }
			try { renderPhotoTiles(); renderAssetThumbs(); renderSigThumbs(); renderNdtSigThumbs(); renderPuwerBuilder(); updateFeaturePills(); initConv(); } catch (e) {}
					try {
						setupPointerPad(document.getElementById('pad1'), u => { liftingBatch[activeIdx].inspectorSigLive = u; renderPreview(); }, () => { liftingBatch[activeIdx].inspectorSigMode = 'LIVE'; });
						setupPointerPad(document.getElementById('pad2'), u => { liftingBatch[activeIdx].authSigLive = u; renderPreview(); }, () => { liftingBatch[activeIdx].authSigMode = 'LIVE'; });
						setupPointerPad(document.getElementById('pad3'), u => { const r = ndtBatch[activeIdx]; if (r) { r.inspSigLive = u; renderPreview(); } }, () => { const r = ndtBatch[activeIdx]; if (r) r.inspSigMode = 'LIVE'; });
						setupPointerPad(document.getElementById('pad4'), u => { const r = ndtBatch[activeIdx]; if (r) { r.witSigLive = u; renderPreview(); } }, () => { const r = ndtBatch[activeIdx]; if (r) r.witSigMode = 'LIVE'; });
					} catch (e) {}
					// ── FIX M5: mark rangeTo as user-edited when they type into it.
					try {
						const rt = document.getElementById('rangeTo');
						if (rt) rt.addEventListener('input', () => { _rangeToUserEdited = true; });
						const rf = document.getElementById('rangeFrom');
						if (rf) rf.addEventListener('input', () => { /* From is not pre-filled, nothing to guard */ });
					} catch (e) {}
					try { restorePreferences(); } catch (e) {}
					try { enhanceAccessibility(); } catch (e) {}
					try { if (typeof installOnlineListeners === 'function') installOnlineListeners(); } catch (e) {}
					try { if (typeof installStickyBanner === 'function') installStickyBanner(); } catch (e) {}
					try { if (typeof installKeyboardShortcuts === 'function') installKeyboardShortcuts(); } catch (e) {}
					try { if (typeof installTrackpadZoom === 'function') installTrackpadZoom(); } catch (e) {}
					try { if (typeof installMobileSelectInterceptors === 'function') installMobileSelectInterceptors(); } catch (e) {}
					try { MQ_BESIDE_OK.addEventListener('change', applyLayout); } catch (e) {}
					try { window.addEventListener('resize', applyZoom, { passive: true }); } catch (e) {}
					try { applyLayout(); } catch (e) {}
					try { switchEngine('LIFTING'); } catch (e) {}
					try { loadActiveRecord(); } catch (e) { showPreviewError(e); }
					try { sizeAllSigPads(); } catch (e) {}
					try {
						if (!document.querySelector('.tab-view.active')) {
							const fb = document.getElementById(currentEngine === 'LIFTING' ? 'tab_loler' : 'tab_ndt');
							if (fb) fb.classList.add('active');
						}
					renderPreview(); runWorkflowChecks(); runUnitConvert(); setSaveIndicator('saved');
				} catch (e) { showPreviewError(e); }
				// Outside the block above on purpose: if the preview throws on a
				// cold boot the QR budget readout would never be filled in.
				try { updateQrBudget(); } catch (e) {}
			}
if (document.readyState === 'complete') { bootApp(); } else { window.addEventListener('load', bootApp); }
