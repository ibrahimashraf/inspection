				/* UNIT CONVERTER */
				function renderToolsTab() {
					const container = document.getElementById('tab_tools');
					if (!container || container.dataset.rendered === 'true') return;
					container.innerHTML = 
						'<div class="card">' +
							'<h3><span>Inspection Tools (Inspector Aids)</span></h3>' +
							'<div class="card-note">Never printed or exported — offline helper calculations only.</div>' +
						'</div>' +
						'<div class="card">' +
							'<h3>1. Multi-Leg Rigging Geometry</h3>' +
							'<div class="row cols-3">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Load (t)</span></div><input type="number" id="calc_w" value="10" oninput="runSlingCalc()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Legs</span></div><input type="number" id="calc_n" value="2" oninput="runSlingCalc()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Angle °</span></div><input type="number" id="calc_deg" value="60" oninput="runSlingCalc()"></div>' +
							'</div>' +
							'<div class="tool-readout"><span>TENSION/LEG: <strong id="res_tension">5.77 T</strong></span><span>FACTOR: <strong id="res_mult">1.15x</strong></span></div>' +
							'<div id="res_angle_warn" role="alert" style="margin-top:8px;padding:6px 8px;background:var(--warn);color:#fff;font-weight:700;text-align:center;border-radius:var(--radius-sm);display:none;">WARNING: Angle &lt; 45° derates capacity!</div>' +
						'</div>' +
						'<div class="card">' +
							'<h3>2. ISO 4309 Rope Discard Engine</h3>' +
							'<div class="row cols-4">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Nominal mm</span></div><input type="number" id="calc_nom_rope" value="26.0" oninput="runRopeCalc()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Measured mm</span></div><input type="number" id="calc_meas_rope" value="24.1" oninput="runRopeCalc()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Broken Wires</span></div><input type="number" id="calc_bw_6d" value="2" oninput="runRopeCalc()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Limit %</span></div><select id="calc_rope_type" onchange="runRopeCalc()"><option value="6">Rot-Resistant 6%</option><option value="10">Standard 10%</option></select></div>' +
							'</div>' +
							'<div class="tool-readout"><span>REDUCTION: <strong id="res_reduction">-7.31%</strong></span><span id="res_rope_band" role="alert" style="padding:4px 8px;background:var(--fail);color:#fff;font-weight:700;border-radius:var(--radius-sm);"><strong id="res_rope_status" style="color:#fff;">DISCARD REQUIRED</strong></span></div>' +
						'</div>' +
						'<div class="card">' +
							'<h3>3. Offline Unit Converter (Imperial ⇄ Metric)</h3>' +
							'<div class="row cols-4">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Category</span></div><select id="conv_cat" onchange="populateConvUnits()"></select></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Value</span></div><input type="number" id="conv_val" value="1" oninput="runUnitConvert()"></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">From</span></div><select id="conv_from" onchange="runUnitConvert()"></select></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">To</span></div><select id="conv_to" onchange="runUnitConvert()"></select></div>' +
							'</div>' +
							'<div class="row cols-2">' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Result</span></div><input type="text" id="conv_out" class="mono" readonly></div>' +
								'<div class="fg"><div class="fg-hdr"><span class="fg-title">Factor</span></div><input type="text" id="conv_factor" class="mono" readonly></div>' +
							'</div>' +
							'<button class="btn" onclick="swapConv()">⇄ Swap From / To</button>' +
						'</div>';
					container.dataset.rendered = 'true';
				}
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
