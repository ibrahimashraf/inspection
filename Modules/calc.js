				/* UNIT CONVERTER */
				function initConv() { const c = document.getElementById('conv_cat'); if (!c) return; if (!c.options.length) c.innerHTML = Object.keys(UNIT_DB).map(k => '<option value="' + k + '">' + UNIT_DB[k].label + '</option>').join(''); populateConvUnits(); }
				function populateConvUnits() {
					const c = document.getElementById('conv_cat'); if (!c) return; if (!c.options.length) initConv();
					const db = UNIT_DB[c.value || 'mass'];
					const f = document.getElementById('conv_from'), t = document.getElementById('conv_to');
					const pf = f.value, pt = t.value;
					const keys = Object.keys(db.units);
					const o = keys.map(k => '<option value="' + k + '">' + db.units[k][0] + '</option>').join('');
					f.innerHTML = o; t.innerHTML = o;
					f.value = keys.indexOf(pf) !== -1 ? pf : keys[0];
					t.value = keys.indexOf(pt) !== -1 ? pt : (keys[1] || keys[0]);
					runUnitConvert();
				}
				function runUnitConvert() {
					const c = document.getElementById('conv_cat'); if (!c) return;
					const f = document.getElementById('conv_from'), t = document.getElementById('conv_to');
					if (!f.options.length) { initConv(); return; }
					const db = UNIT_DB[c.value];
					const v = parseFloat(document.getElementById('conv_val').value);
					const a = f.value, b = t.value;
					const out = document.getElementById('conv_out'), fac = document.getElementById('conv_factor');
					if (isNaN(v)) { out.value = ''; fac.value = ''; return; }
					let res, factor;
					if (db.special) { res = tempFromC(tempToC(v, a), b); factor = null; }
					else { const fv = db.units[a][1], tv = db.units[b][1]; res = v * fv / tv; factor = fv / tv; }
					out.value = fmtNum(res) + ' ' + b;
					fac.value = db.special ? 'non-linear scale' : ('1 ' + a + ' = ' + fmtNum(factor) + ' ' + b);
				}
				function swapConv() { const a = document.getElementById('conv_from'), b = document.getElementById('conv_to'); const t = a.value; a.value = b.value; b.value = t; runUnitConvert(); }


				/* DATE HELPERS */
				function calculateNextDate(b, m) {
					if (!b) return '';
					const p = b.split('-'); if (p.length !== 3) return '';
					let y = parseInt(p[0], 10), mo = parseInt(p[1], 10) - 1, d = parseInt(p[2], 10);
					mo += m; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
					const mx = new Date(y, mo + 1, 0).getDate();
					const dt = new Date(y, mo, Math.min(d, mx));
					dt.setDate(dt.getDate() - 1);
					return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
				}
				function handleIntervalChange(t) {
					const i6 = document.getElementById('in_q_int6m');
					const i12 = document.getElementById('in_q_int12m');
					const ex = document.getElementById('in_examDate');
					const nx = document.getElementById('in_nextExamDate');
					const r = liftingBatch[activeIdx];
					const tg = (r && r.fieldToggles) || {};
					const pillOn = k => tg[k] !== false;
					// Only mutate the reciprocal field when its pill is ON.
					// Mutating a disabled field silently is a data-integrity
					// trap: the value reappears if the pill is later re-enabled.
					if (t === 6 && i6.value === 'YES') {
						if (pillOn('q_int12m')) i12.value = 'NO';
						if (ex.value) nx.value = calculateNextDate(ex.value, 6);
					} else if (t === 12 && i12.value === 'YES') {
						if (pillOn('q_int6m')) i6.value = 'NO';
						if (ex.value) nx.value = calculateNextDate(ex.value, 12);
					}
					debouncedSync();
				}
				function handleExamDateChange() {
					const i6 = document.getElementById('in_q_int6m'), i12 = document.getElementById('in_q_int12m'), ex = document.getElementById('in_examDate'), nx = document.getElementById('in_nextExamDate');
					if (i6.value === 'YES') nx.value = calculateNextDate(ex.value, 6);
					else if (i12.value === 'YES') nx.value = calculateNextDate(ex.value, 12);
					debouncedSync();
				}
				function handleQuestionnaireChange() { document.getElementById('in_q_installedCorrectly').value = document.getElementById('in_q_firstExam').value === 'YES' ? 'YES' : 'N/A'; debouncedSync(); }


				/* TOOL CALCULATORS */
				function runSlingCalc() {
					const w = parseFloat(document.getElementById('calc_w').value) || 0;
					const n = parseFloat(document.getElementById('calc_n').value) || 1;
					const deg = parseFloat(document.getElementById('calc_deg').value) || 90;
					const s = Math.sin(deg * Math.PI / 180);
					if (s > 0) {
						document.getElementById('res_tension').textContent = (w / (n * s)).toFixed(2) + ' T';
						document.getElementById('res_mult').textContent = (1 / s).toFixed(2) + 'x';
						document.getElementById('res_angle_warn').style.display = deg < 45 ? 'block' : 'none';
					}
				}
				function runRopeCalc() {
					const nom = parseFloat(document.getElementById('calc_nom_rope').value) || 1;
					const meas = parseFloat(document.getElementById('calc_meas_rope').value) || 1;
					const bw = parseInt(document.getElementById('calc_bw_6d').value, 10) || 0;
					const lim = parseFloat(document.getElementById('calc_rope_type').value) || 6;
					const red = ((nom - meas) / nom) * 100;
					document.getElementById('res_reduction').textContent = (red >= 0 ? '-' : '+') + Math.abs(red).toFixed(2) + '%';
					const d = (red >= lim || bw >= 4);
					document.getElementById('res_rope_status').textContent = d ? 'DISCARD REQUIRED' : 'SAFE';
					document.getElementById('res_rope_band').style.background = d ? 'var(--fail)' : 'var(--pass)';
				}
