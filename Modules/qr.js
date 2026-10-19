				/* QR CODE ENGINE */
				var QREngine = (function () {
					var EXP = new Array(512), LOG = new Array(256);
					(function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
					function gm(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }
					function rsGen(d) { var g = [1]; for (var i = 0; i < d; i++) { var n = new Array(g.length + 1).fill(0); for (var j = 0; j < g.length; j++) { n[j] ^= gm(g[j], EXP[i]); n[j + 1] ^= g[j]; } g = n; } return g.reverse(); }
					function rsEnc(data, ec) { var g = rsGen(ec); var res = data.concat(new Array(ec).fill(0)); for (var i = 0; i < data.length; i++) { var c = res[i]; if (c) for (var j = 0; j < g.length; j++) res[i + j] ^= gm(g[j], c); } return res.slice(data.length); }
				// ISO/IEC 18004 tables, indexed [level][version]; index 0 is unused
				// padding. Taken from Project Nayuki's MIT-licensed reference
				// implementation, which is the canonical published form of these.
				var ECC_PER_BLOCK = {
					L: [0,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
					M: [0,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
					Q: [0,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
					H: [0,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
				};
				var EC_BLOCKS = {
					L: [0,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
					M: [0,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
					Q: [0,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
					H: [0,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
				};
				// 2-bit format-info field per level. Only L and M existed before, and
				// anything that was not 'L' was silently encoded as M.
				var ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
				// Modules available for data + ECC, after removing every function
				// pattern. Computed from the spec, not tabulated.
				function rawDataModules(v) {
					var size = v * 4 + 17, result = size * size;
					result -= 8 * 8 * 3;            // three finders with separators
					result -= 15 * 2 + 1;           // format info (2 copies) + dark module
					result -= (size - 16) * 2;      // timing patterns
					if (v >= 2) {
						var n = Math.floor(v / 7) + 2;
						result -= (n - 1) * (n - 1) * 25;   // alignment patterns off the timing lines
						result -= (n - 2) * 2 * 20;         // alignment patterns on the timing lines
						if (v >= 7) result -= 6 * 3 * 2;   // version information
					}
					return result;
				}
				function rawCodewords(v) { return Math.floor(rawDataModules(v) / 8); }
				// Alignment pattern centres, computed per the spec rather than tabled.
				function alignPositions(v) {
					if (v === 1) return [];
					var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
					var step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
					var res = new Array(n);
					res[0] = 6;
					for (var i = n - 1, pos = size - 7; i >= 1; i--, pos -= step) res[i] = pos;
					return res;
				}
				function blocks(v, l) {
					var ecLen = ECC_PER_BLOCK[l][v], num = EC_BLOCKS[l][v], raw = rawCodewords(v);
					// Blocks are as equal as possible: the first `numShort` are one
					// codeword shorter than the rest.
					var numShort = num - raw % num, shortLen = Math.floor(raw / num), o = [];
					for (var i = 0; i < num; i++) o.push({ data: shortLen - ecLen + (i < numShort ? 0 : 1), ec: ecLen });
					return o;
				}
				function dataBytes(v, l) { var s = 0; blocks(v, l).forEach(function (b) { s += b.data; }); return s; }
					function utf8(s) { if (window.TextEncoder) return Array.from(new TextEncoder().encode(s)); var o = []; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 128) o.push(c); else if (c < 2048) o.push(192 | (c >> 6), 128 | (c & 63)); else o.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); } return o; }
					function push(a, v, l) { for (var i = l - 1; i >= 0; i--) a.push((v >> i) & 1); }
					function encode(text, level) {
						if (!ECC_PER_BLOCK[level]) level = 'M';
						var bytes = utf8(text);
						for (var v = 1; v <= 40; v++) {
							var cap = dataBytes(v, level) * 8;
							var bits = [];
							push(bits, 4, 4);
							push(bits, bytes.length, v < 10 ? 8 : 16);
							for (var i = 0; i < bytes.length; i++) push(bits, bytes[i], 8);
							if (bits.length > cap) continue;
							var term = Math.min(4, cap - bits.length);
							for (var t = 0; t < term; t++) bits.push(0);
							while (bits.length % 8) bits.push(0);
							var pad = [0xEC, 0x11], pi = 0;
							while (bits.length < cap) push(bits, pad[pi++ % 2], 8);
							var cw = [];
							for (var i2 = 0; i2 < bits.length; i2 += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i2 + j]; cw.push(b); }
							return finish(cw, v, level);
						}
						return null;
					}
					function finish(cw, v, level) {
						var bl = blocks(v, level); var dB = [], eB = [], idx = 0;
						bl.forEach(function (b) { var d = cw.slice(idx, idx + b.data); idx += b.data; dB.push(d); eB.push(rsEnc(d, b.ec)); });
						var inter = []; var mx = 0;
						dB.forEach(function (b) { mx = Math.max(mx, b.length); });
						for (var i = 0; i < mx; i++) dB.forEach(function (b) { if (i < b.length) inter.push(b[i]); });
						for (var i2 = 0; i2 < bl[0].ec; i2++) eB.forEach(function (b) { if (i2 < b.length) inter.push(b[i2]); });
						var bits = []; inter.forEach(function (b) { push(bits, b, 8); });
						// Remainder bits are whatever the module grid has left over:
						// 0 for v1 and v7-13, 7 for v2-6, 3 for v14-20 and v28-34,
						// 4 for v21-27. Derived, so no version ranges to keep in sync.
						var rem = rawDataModules(v) % 8;
						for (var r = 0; r < rem; r++) bits.push(0);
						return place(bits, v, level);
					}
					function bch15(d) { var g = 0x537, rem = d << 10; for (var i = 14; i >= 10; i--) { if ((rem >> i) & 1) rem ^= g << (i - 10); } return rem; }
					function bch18(d) { var g = 0x1F25, rem = d << 12; for (var i = 17; i >= 12; i--) { if ((rem >> i) & 1) rem ^= g << (i - 12); } return rem; }
					function formatBits(mask, level) { var data = (ECC_FORMAT_BITS[level] << 3) | mask; return ((data << 10) | bch15(data)) ^ 0x5412; }
					function versionBits(v) { return (v << 12) | bch18(v); }
					function maskFn(id, y, x) {
						switch (id) {
							case 0: return (y + x) % 2 === 0;
							case 1: return y % 2 === 0;
							case 2: return x % 3 === 0;
							case 3: return (y + x) % 3 === 0;
							case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
							case 5: return ((y * x) % 2 + (y * x) % 3) === 0;
							case 6: return (((y * x) % 2 + (y * x) % 3) % 2) === 0;
							default: return (((y + x) % 2 + (y * x) % 3) % 2) === 0;
						}
					}
					function penalty(m) {
						var p = 0, n = m.length, i, j;
						for (i = 0; i < n; i++) {
							var rR = 1, rC = 1;
							for (j = 1; j < n; j++) {
								if (m[i][j] === m[i][j - 1]) rR++; else { if (rR >= 5) p += 3 + (rR - 5); rR = 1; }
								if (m[j][i] === m[j - 1][i]) rC++; else { if (rC >= 5) p += 3 + (rC - 5); rC = 1; }
							}
							if (rR >= 5) p += 3 + (rR - 5);
							if (rC >= 5) p += 3 + (rC - 5);
						}
						for (i = 0; i < n - 1; i++) for (j = 0; j < n - 1; j++) { var v = m[i][j]; if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) p += 3; }
						var p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
						function has(i2, j2, h, pat) { for (var k = 0; k < 11; k++) { var val = h ? m[i2][j2 + k] : m[j2 + k][i2]; if (val !== pat[k]) return false; } return true; }
						for (i = 0; i < n; i++) for (j = 0; j + 11 <= n; j++) {
							if (has(i, j, true, p1)) p += 40; if (has(i, j, true, p2)) p += 40;
							if (has(i, j, false, p1)) p += 40; if (has(i, j, false, p2)) p += 40;
						}
						var dark = 0; for (i = 0; i < n; i++) for (j = 0; j < n; j++) dark += m[i][j];
						p += 10 * Math.floor(Math.abs((dark * 100 / (n * n)) - 50) / 5);
						return p;
					}
					function place(bits, v, level) {
						var n = 17 + 4 * v;
						var m = [], res = [];
						for (var i = 0; i < n; i++) { m.push(new Array(n).fill(0)); res.push(new Array(n).fill(false)); }
						function setF(x, y, val) { m[y][x] = val; res[y][x] = true; }
						function finder(cx, cy) { for (var dy = -1; dy <= 7; dy++) for (var dx = -1; dx <= 7; dx++) { var x = cx + dx, y = cy + dy; if (x < 0 || x >= n || y < 0 || y >= n) continue; var on = (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6) && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)); setF(x, y, on ? 1 : 0); } }
						finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
						for (var t = 8; t < n - 8; t++) { var tv = (t % 2 === 0) ? 1 : 0; if (!res[6][t]) setF(t, 6, tv); if (!res[t][6]) setF(6, t, tv); }
						var ap = alignPositions(v);
						for (var a = 0; a < ap.length; a++) for (var b = 0; b < ap.length; b++) {
							var cx = ap[a], cy = ap[b];
							if ((cx === 6 && cy === 6) || (cx === 6 && cy === n - 7) || (cx === n - 7 && cy === 6)) continue;
							for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(cx + dx, cy + dy, (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) ? 1 : 0);
						}
						setF(8, n - 8, 1);
						for (var f = 0; f <= 8; f++) { if (!res[8][f]) setF(f, 8, 0); if (!res[f][8]) setF(8, f, 0); }
						for (var f2 = n - 8; f2 < n; f2++) { if (!res[8][f2]) setF(f2, 8, 0); if (!res[f2][8]) setF(8, f2, 0); }
						if (v >= 7) for (var vi = 0; vi < 6; vi++) for (var vj = 0; vj < 3; vj++) { setF(n - 11 + vj, vi, 0); setF(vi, n - 11 + vj, 0); }
						var bi = 0, up = true;
						for (var col = n - 1; col > 0; col -= 2) {
							if (col === 6) col--;
							for (var row = 0; row < n; row++) {
								var y = up ? n - 1 - row : row;
								for (var k = 0; k < 2; k++) { var x = col - k; if (!res[y][x]) m[y][x] = (bi < bits.length) ? bits[bi++] : 0; }
							}
							up = !up;
						}
					function applyFormat(mat, mask) {
						var fb = formatBits(mask, level);
						// Positions below are [x, y] pairs, and mat is indexed [y][x],
						// so the column index is written first. They used to be applied
						// the other way round, which mirrored the whole format pattern:
						// the data area was correct but the ECC/mask bits a scanner
						// reads back were not, so codes failed to decode.
						var pos = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
						for (var i = 0; i < 15; i++) mat[pos[i][1]][pos[i][0]] = (fb >> i) & 1;
						for (var i2 = 0; i2 < 8; i2++) mat[8][n - 1 - i2] = (fb >> i2) & 1;
						for (var i3 = 8; i3 < 15; i3++) mat[n - 15 + i3][8] = (fb >> i3) & 1;
					}
						function applyVersion(mat) { var vb = versionBits(v); for (var i = 0; i < 18; i++) { var bit = (vb >> i) & 1, r = Math.floor(i / 3), c = i % 3; mat[r][n - 11 + c] = bit; mat[n - 11 + c][r] = bit; } }
						var best = null, bestScore = Infinity;
						for (var mask = 0; mask < 8; mask++) {
							var cand = m.map(function (r) { return r.slice(); });
							for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { if (!res[y][x] && maskFn(mask, y, x)) cand[y][x] ^= 1; }
							applyFormat(cand, mask); if (v >= 7) applyVersion(cand);
							var sc = penalty(cand);
							if (sc < bestScore) { bestScore = sc; best = cand; }
						}
						return best;
					}
					return { encode: encode };
				})();

				function generateTrueQrSvg(text, el) {
					if (!el) return false;
				// The encoder reaches QR version 40 (2331 bytes at ECC-M, 2953 at
				// ECC-L), so the ceiling only bites on an absurdly long message.
				// The second candidate is the same link with the pre-filled message
				// dropped. The destination is byte-identical, so the scan is still
				// the right link -- only the WhatsApp prefill is lost, and that is
				// logged rather than done silently. Never a truncated message: a
					var s = String(text);
					var base = s.startsWith('mailto:') ? s.split('?')[0] : s.split('?text=')[0];
					var urls = base !== s ? [s, base] : [s];
					var mx = null;
					for (var u = 0; u < urls.length && !mx; u++) {
						if (!urls[u]) continue;
						try { mx = QREngine.encode(urls[u], 'M') || QREngine.encode(urls[u], 'L'); } catch (e) { mx = null; }
						if (mx && u > 0) console.info('[QR] ' + new TextEncoder().encode(s).length + ' bytes exceeds the v40 ceiling; encoding the bare link without the pre-filled message.');
					}
					if (!mx) return false;
					var n = mx.length, r = '';
					for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (mx[y][x]) r += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
					el.setAttribute('viewBox', '-4 -4 ' + (n + 8) + ' ' + (n + 8));
					el.setAttribute('shape-rendering', 'crispEdges');
					el.innerHTML = '<rect x="-4" y="-4" width="' + (n + 8) + '" height="' + (n + 8) + '" fill="#ffffff"/><g fill="#000000">' + r + '</g>';
					return true;
				}

				/* ============================================================
				   GLOBAL STATE (var — shared with modules via window.*)
				   ============================================================ */
				var currentEngine = 'LIFTING';
				var layoutModes = ['layout-beside', 'layout-below', 'layout-folded'];
				var currentLayoutIdx = 0;
				var clipboardBuffer = [];
				var batchPage = 0;
				var qrChannel = 'WHATSAPP';
				var qrConfig = {
					phone: '+441224598800',
					email: 'verify@integin-inspection.com',
					msg: 'Official Verification Request for Certificate:',
					customUrl: 'https://verify.integin-inspection.com/{REPORT_NO}'
				};
				function readQrConfig() {
					const el = id => document.getElementById(id);
					const p = el('waPhone'), e = el('waEmail'), m = el('waMsg'), u = el('qrCustomUrl');
					if (p && p.value) qrConfig.phone = p.value;
					if (e && e.value) qrConfig.email = e.value;
					if (m && m.value) qrConfig.msg = m.value;
					if (u && u.value) qrConfig.customUrl = u.value;
					return qrConfig;
				}
				var docControl = { on: true, docNo: 'QMS-CERT-LOLER-044', rev: '03', revDate: '2026-01-15', reportNoPattern: '{PREFIX}-{DATE}-0{SEQ}' };
				var featureToggles = { qr: true, corp: true, overlays: true };
				var corpInfo = {
					body: 'Integin Global Inspection Services Ltd.',
					accred: 'LEEA Member No. 0842 · ISO/IEC 17020 Type-A Accredited Inspection Body',
					addr: 'Techniplex Business Centre, Quay West, Aberdeen AB11 5PQ, United Kingdom',
					phone: '+44 (0) 1224 598800',
					email: 'operations@integin-inspection.com',
					web: 'www.integin-inspection.com',
					footnote: 'This certificate of thorough examination complies with LOLER 1998 Regulation 10 & PUWER 1998 Regulation 6. Issued under the authority of our UKAS / LEEA accreditation.'
				};
				var viewerState = { type: 'none', photoIndex: -1, sigTarget: '', assetKey: '' };
				var activeIdx = 0;
				// Cursor position per engine. Saved on the way out of an engine
				// (in switchEngine) and restored with a clamp on the way in, so
				// a shrinking record list can never leave us pointing past the
				// end. Never written anywhere else — the live activeIdx is the
				// source of truth while an engine is focused.
				var activeIdxByEngine = { LIFTING: 0, NDT: 0 };
				if (!window.assets) window.assets = { headerBanner: null, footerBanner: null, logo: null, accreds: [] };
				if (!window.assets.accreds) window.assets.accreds = [];
				var assets = window.assets;
				var syncTimer = null, saveTimer = null;
				var manualZoom = null;
				var activeSpeechRec = null;
				// ── FIX M5: track whether the user has ever touched the range "To"
				// input so renderSheet() doesn't overwrite it on every keystroke.
				var _rangeToUserEdited = false;

				var batchPageSize = 100, MAX_PRINT_SPOOL_LIMIT = 100;
				function setBatchPageSize(sz) {
					const n = parseInt(sz, 10);
					if (!isNaN(n) && n > 0) {
						batchPageSize = n;
						batchPage = 0;
						if (typeof renderSheet === 'function') renderSheet();
						if (typeof store !== 'undefined' && store.set) store.set('ims_batch_pagesize', String(n));
					}
				}

				const ALL_LIFTING_TOGGLES = ['reportNo', 'jobRef', 'companyAccred', 'standards', 'sopRef', 'employer', 'premises', 'poRef', 'subLocation', 'colourCode', 'reportDate', 'description', 'swl', 'quantity', 'manufacturer', 'model', 'serial', 'plantId', 'mfgYear', 'lastExamDate', 'markingsLegible', 'q_firstExam', 'q_installedCorrectly', 'q_int6m', 'q_int12m', 'q_scheme', 'q_exceptional', 'examParticulars', 'additionalTesting', 'additionalTestingDetails', 'defectDesc', 'dangerImm', 'dangerTimeText', 'isSafe', 'remedies', 'examDate', 'nextExamDate', 'examinerName', 'authName'];
				const ALL_NDT_TOGGLES = ['reportNo', 'client', 'location', 'poRef', 'testSpec', 'result', 'itemDesc', 'material', 'remarks', 'certLevel', 'certNo', 'certExpiry', 'visionTest', 'procedureNo', 'acceptCriteria', 'calDue', 'refBlock', 'surfaceCond', 'surfaceTemp', 'lightIntensity', 'couplant', 'coverage', 'inspectorName', 'witnessName'];

				var columnLocks = { jobRef: true, poRef: true, companyAccred: true, standards: true, sopRef: true, employer: true, premises: true, subLocation: true, colourCode: true, reportDate: true, description: false, swl: false, quantity: false, manufacturer: true, model: false, serial: false, plantId: false, mfgYear: true, lastExamDate: false, markingsLegible: true, q_firstExam: true, q_installedCorrectly: true, q_int6m: true, q_int12m: true, q_scheme: true, q_exceptional: true, proofLoadApplied: true, examParticulars: true, additionalTesting: true, defectDesc: false, dangerImm: false, isSafe: true, remedies: false, examDate: true, nextExamDate: true, examinerName: true, authName: true, extraCells: false, puwerRows: false, checklist: false, verdictText: false, method: true, client: true, location: true, itemDesc: false, material: false, testSpec: true, procedureNo: true, acceptCriteria: true, certLevel: true, certNo: true, certExpiry: true, visionTest: true, calDue: true, refBlock: true, surfaceCond: false, surfaceTemp: false, lightIntensity: false, couplant: false, coverage: false, result: true, remarks: false, indications: false, inspectorName: true, witnessName: true };

				const LIFTING_COLUMNS = [
					{ key: "reportNo", label: "Report No" }, { key: "reportDate", label: "Report Date" }, { key: "jobRef", label: "Job Ref" },
					{ key: "poRef", label: "P.O. Ref" }, { key: "companyAccred", label: "Insp Body" }, { key: "employer", label: "Employer" },
					{ key: "premises", label: "Premises" }, { key: "subLocation", label: "Sub-Location" }, { key: "colourCode", label: "Colour" },
					{ key: "description", label: "Description" }, { key: "quantity", label: "Qty" }, { key: "swl", label: "SWL" },
					{ key: "serial", label: "Serial" }, { key: "plantId", label: "Asset ID" },
					{ key: "manufacturer", label: "Maker" }, { key: "model", label: "Model" }, { key: "mfgYear", label: "Year" },
					{ key: "lastExamDate", label: "Last Exam" }, { key: "markingsLegible", label: "Markings" }, { key: "standards", label: "Standards" },
					{ key: "sopRef", label: "SOP" }, { key: "q_firstExam", label: "First?" }, { key: "q_installedCorrectly", label: "Inst OK?" },
					{ key: "q_int6m", label: "6M?" }, { key: "q_int12m", label: "12M?" }, { key: "q_scheme", label: "Scheme?" },
					{ key: "q_exceptional", label: "Except?" }, { key: "examParticulars", label: "Exam Particulars" }, { key: "additionalTesting", label: "AddTest?" },
					{ key: "additionalTestingDetails", label: "AddTest Details" }, { key: "defectDesc", label: "Defects" },
					{ key: "dangerImm", label: "Danger?" }, { key: "dangerTimeText", label: "Danger Date" }, { key: "isSafe", label: "Safe?" },
					{ key: "remedies", label: "Remedy" }, { key: "examDate", label: "Exam Date" }, { key: "nextExamDate", label: "Next Due" },
					{ key: "verdictText", label: "Verdict" }, { key: "extraCells", label: "Verdict Cells" },
					{ key: "puwerRows", label: "PUWER Items" }, { key: "checklist", label: "Checklist" },
					{ key: "examinerName", label: "Inspector" }, { key: "authName", label: "Authority" }
				];

				const NDT_COLUMNS = [
					{ key: "reportNo", label: "Report No" }, { key: "method", label: "Method" }, { key: "client", label: "Client" },
					{ key: "location", label: "Location" }, { key: "poRef", label: "P.O." }, { key: "itemDesc", label: "Item" },
					{ key: "material", label: "Material" }, { key: "testSpec", label: "Spec" }, { key: "procedureNo", label: "Procedure" },
					{ key: "acceptCriteria", label: "Acceptance" }, { key: "certLevel", label: "Cert Level" }, { key: "certNo", label: "Cert No" },
					{ key: "certExpiry", label: "Cert Expiry" }, { key: "visionTest", label: "Vision" }, { key: "calDue", label: "Cal Due" },
					{ key: "refBlock", label: "Ref/IQI" }, { key: "surfaceCond", label: "Surface" }, { key: "surfaceTemp", label: "Temp°C" },
					{ key: "lightIntensity", label: "Light" }, { key: "couplant", label: "Couplant" }, { key: "coverage", label: "Coverage" },
					{ key: "result", label: "Result" }, { key: "verdictText", label: "Verdict" }, { key: "remarks", label: "Remarks" },
					{ key: "indications", label: "Item Matrix" }, { key: "extraCells", label: "Verdict Cells" }, { key: "checklist", label: "Checklist" },
					{ key: "yokeSerial", label: "Yoke Serial" }, { key: "magCurrent", label: "Mag Current" }, { key: "inkType", label: "Ink/Media" },
					{ key: "penetrantType", label: "Penetrant Type" }, { key: "penetrantBrand", label: "Penetrant Brand" }, { key: "dwellTime", label: "Dwell Time" },
					{ key: "utUnit", label: "UT Machine" }, { key: "probeFreq", label: "Probe Freq" },
					{ key: "inspectorName", label: "Inspector" }, { key: "witnessName", label: "Witness" }
				];

				const MONO_GRID_KEYS = { reportNo: true, reportDate: true, serial: true, plantId: true, lastExamDate: true, examDate: true, nextExamDate: true, method: true, certNo: true, certExpiry: true, visionTest: true, calDue: true };


				/* QR CHANNEL */
				function setQrChannel(c) {
					qrChannel = (c === 'EMAIL' ? 'EMAIL' : (c === 'CUSTOM' ? 'CUSTOM' : 'WHATSAPP'));
					refreshQrUI();
					updateQrBudget();
					debouncedSync();
				}
				function refreshQrUI() {
					const w = document.getElementById('qr_ch_whatsapp'),
					      e = document.getElementById('qr_ch_email'),
					      u = document.getElementById('qr_ch_custom'),
					      customFg = document.getElementById('fg_qr_customUrl'),
					      phoneFg = document.getElementById('fg_qr_phone'),
					      emailFg = document.getElementById('fg_qr_email'),
					      msgFg = document.getElementById('fg_qr_msg');

					if (w) { w.classList.toggle('btn-accent', qrChannel === 'WHATSAPP'); w.setAttribute('aria-pressed', qrChannel === 'WHATSAPP'); }
					if (e) { e.classList.toggle('btn-accent', qrChannel === 'EMAIL'); e.setAttribute('aria-pressed', qrChannel === 'EMAIL'); }
					if (u) { u.classList.toggle('btn-accent', qrChannel === 'CUSTOM'); u.setAttribute('aria-pressed', qrChannel === 'CUSTOM'); }

					if (customFg) customFg.style.display = (qrChannel === 'CUSTOM') ? 'block' : 'none';
					if (phoneFg) phoneFg.style.display = (qrChannel === 'WHATSAPP') ? 'block' : 'none';
					if (emailFg) emailFg.style.display = (qrChannel === 'EMAIL') ? 'block' : 'none';
					if (msgFg) msgFg.style.display = (qrChannel === 'CUSTOM') ? 'none' : 'block';
				}
				// The encoder reaches QR version 40: 2331 bytes at ECC-M, 2953 at ECC-L.
			// Past 2953 the pre-filled message is dropped, which is reported rather
			// than done silently.
			const QR_CEIL_M = 2331, QR_CEIL_L = 2953;
			function qrPayloadBytes(url) {
				return new TextEncoder().encode(url).length;
			}
			function updateQrBudget() {
				const rec = (typeof activeRec === 'function') ? activeRec() : {};
				const link = buildVerificationLink(rec);
				const lp = document.getElementById('qrLinkPreview');
				if (lp) lp.value = link;

				const el = document.getElementById('qrBudget');
				if (!el) return;
				let bytes = 0, msg = '', color = 'var(--pass)';
				try {
					bytes = qrPayloadBytes(link);
					if (bytes <= QR_CEIL_M)      { msg = 'QR payload ' + bytes + ' B — fits at ECC-M.'; color = 'var(--pass)'; }
					else if (bytes <= QR_CEIL_L) { msg = 'QR payload ' + bytes + ' B — over ECC-M, falls back to ECC-L.'; color = 'var(--warn)'; }
					else { msg = 'QR payload ' + bytes + ' B — too long for this encoder; the message will be dropped and only the bare link encoded. Shorten the prefix.'; color = 'var(--fail)'; }
				} catch (e) { msg = 'QR payload unavailable.'; color = 'var(--fail)'; }
				el.textContent = msg;
				el.style.color = color;
			}
			function buildVerificationLink(r) {
					const el = id => document.getElementById(id);
					const cfg = (typeof readQrConfig === 'function') ? readQrConfig() : (window.qrConfig || {});
					const no = (r && r.reportNo) || '';
					const serial = (r && (r.serial || r.plantId)) || '';

					if (qrChannel === 'CUSTOM') {
						const customTpl = (el('qrCustomUrl') && el('qrCustomUrl').value) || cfg.customUrl || 'https://verify.integin-inspection.com/{REPORT_NO}';
						return customTpl
							.replace(/{REPORT_NO}/g, encodeURIComponent(no))
							.replace(/{SERIAL}/g, encodeURIComponent(serial))
							.replace(/{DATE}/g, encodeURIComponent((r && r.reportDate) || ''));
					}

					const msg = (el('waMsg') && el('waMsg').value) || cfg.msg || 'Official Verification Request for Certificate:';
					// Only append the report no when the operator has not already
					// typed it into the message prefix. The doubled field was
					// padding the payload and pushing it past the QR ceiling.
					const body = (no && msg.indexOf(no) === -1) ? msg + ' ' + no : msg;
					if (qrChannel === 'EMAIL') {
						const email = (el('waEmail') && el('waEmail').value) || cfg.email || (window.corpInfo && window.corpInfo.email) || 'verify@integin-inspection.com';
						return 'mailto:' + email + '?subject=' + encodeURIComponent('Verification ' + no) + '&body=' + encodeURIComponent(body);
					}
					const rawPhone = (el('waPhone') && el('waPhone').value) || cfg.phone || (window.corpInfo && window.corpInfo.phone) || '+441224598800';
					const phone = String(rawPhone).replace(/[^0-9]/g, '');
					return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(body);
				}
				function paintQr(el, r) {
					if (!el) return;
					const link = buildVerificationLink(r);
					if (generateTrueQrSvg(link, el)) return;
					// Encoding failed — the link is likely too long, or contains
					// a character the encoder rejected. Do NOT silently fall back
					// to a QR that scans to a different payload. Show a visible
					// failure notice so the inspector knows to shorten the link.
					console.warn('[QR] encode failed. Link length =', link.length, 'Link =', link);
					el.setAttribute('viewBox', '0 0 100 100');
					el.setAttribute('shape-rendering', 'auto');
					el.innerHTML =
						'<rect x="1" y="1" width="98" height="98" fill="#fff" stroke="#dc2626" stroke-width="2" stroke-dasharray="5 3"/>' +
						'<text x="50" y="46" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#dc2626">QR</text>' +
						'<text x="50" y="60" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="700" fill="#dc2626">UNAVAILABLE</text>';
					if (typeof showToast === 'function') {
						showToast('Verification QR could not be encoded — the dispatch link may be too long. Shorten the Prefix or Serial field.', 'warn');
					}
				}
				function showEmailVerificationDialog(details) {
					let dlg = document.getElementById('emailVerificationModal');
					if (!dlg) {
						dlg = document.createElement('dialog');
						dlg.id = 'emailVerificationModal';
						dlg.style.cssText = 'border:1px solid var(--hairline);border-radius:var(--radius-3);background:var(--surface);color:var(--ink);padding:0;max-width:540px;width:92%;box-shadow:var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.5));';
						document.body.appendChild(dlg);
					}
					const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
					const to = details.to || '';
					const subject = details.subject || '';
					const body = details.body || '';
					const mailtoUri = details.mailto || ('mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body));
					const gmailUri = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
					const outlookUri = 'https://outlook.office.com/mail/deeplink/compose?to=' + encodeURIComponent(to) + '&subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

					dlg.innerHTML =
						'<div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--hairline);display:flex;justify-content:space-between;align-items:center;">' +
							'<h3 style="margin:0;font-size:var(--ui-font-base);font-weight:700;display:flex;align-items:center;gap:6px;">✉ Email Verification Dispatch</h3>' +
							'<button type="button" class="btn" style="padding:2px 8px;min-height:auto;" onclick="document.getElementById(\'emailVerificationModal\').close()">✕</button>' +
						'</div>' +
						'<div style="padding:var(--space-5);">' +
							'<div style="margin-bottom:var(--space-4);font-size:var(--ui-font-sm);color:var(--ink-muted);line-height:1.4;">' +
								'Verify inspection record directly via your installed email client or webmail service:' +
							'</div>' +
							'<div style="background:var(--panel);border:1px solid var(--hairline);border-radius:var(--radius-2);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);font-size:var(--ui-font-sm);">' +
								'<div style="margin-bottom:4px;"><strong>To:</strong> <span class="mono">' + esc(to) + '</span></div>' +
								'<div style="margin-bottom:4px;"><strong>Subject:</strong> <span>' + esc(subject) + '</span></div>' +
								'<div><strong>Message:</strong> <div style="margin-top:2px;padding:6px;background:var(--surface);border-radius:var(--radius-1);white-space:pre-wrap;font-family:var(--font-data);">' + esc(body) + '</div></div>' +
							'</div>' +
							'<div style="display:flex;flex-direction:column;gap:8px;">' +
								'<a href="' + esc(mailtoUri) + '" class="btn btn-accent" style="text-align:center;text-decoration:none;font-weight:700;padding:8px 12px;" onclick="document.getElementById(\'emailVerificationModal\').close()">🚀 Open Default Mail App (Outlook / Thunderbird / Mail)</a>' +
								'<div style="display:flex;gap:8px;">' +
									'<a href="' + esc(gmailUri) + '" target="_blank" rel="noopener noreferrer" class="btn" style="flex:1;text-align:center;text-decoration:none;padding:8px;" onclick="document.getElementById(\'emailVerificationModal\').close()">🌐 Open in Gmail Web</a>' +
									'<a href="' + esc(outlookUri) + '" target="_blank" rel="noopener noreferrer" class="btn" style="flex:1;text-align:center;text-decoration:none;padding:8px;" onclick="document.getElementById(\'emailVerificationModal\').close()">🌐 Open in Outlook Web</a>' +
								'</div>' +
								'<button type="button" class="btn" style="padding:8px;" onclick="copyVerificationLink();document.getElementById(\'emailVerificationModal\').close()">📋 Copy Verification Link / Body</button>' +
							'</div>' +
						'</div>' +
						'<div style="padding:var(--space-3) var(--space-5);border-top:1px solid var(--hairline);display:flex;justify-content:flex-end;">' +
							'<button type="button" class="btn" onclick="document.getElementById(\'emailVerificationModal\').close()">Close</button>' +
						'</div>';

					if (typeof dlg.showModal === 'function') {
						dlg.showModal();
					} else {
						dlg.setAttribute('open', '');
					}
				}

				function showQrScanModal(details) {
					let dlg = document.getElementById('qrScanModal');
					if (!dlg) {
						dlg = document.createElement('dialog');
						dlg.id = 'qrScanModal';
						dlg.style.cssText = 'border:1px solid var(--hairline);border-radius:var(--radius-3);background:var(--surface);color:var(--ink);padding:0;max-width:480px;width:92%;box-shadow:var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.5));';
						document.body.appendChild(dlg);
					}
					const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
					const isEmail = details.channel === 'EMAIL';
					const isCustom = details.channel === 'CUSTOM';
					const channelName = isEmail ? '✉ Email Dispatch' : (isCustom ? '🔗 Custom Link Dispatch' : '📱 WhatsApp Dispatch');
					const link = details.link || '';

					dlg.innerHTML =
						'<div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--hairline);display:flex;justify-content:space-between;align-items:center;">' +
							'<h3 style="margin:0;font-size:var(--ui-font-base);font-weight:700;display:flex;align-items:center;gap:6px;">' + channelName + ' — Live QR Scanner</h3>' +
							'<button type="button" class="btn" style="padding:2px 8px;min-height:auto;" onclick="document.getElementById(\'qrScanModal\').close()">✕</button>' +
						'</div>' +
						'<div style="padding:var(--space-5);display:flex;flex-direction:column;align-items:center;text-align:center;">' +
							'<div style="margin-bottom:12px;font-size:var(--ui-font-sm);color:var(--ink-muted);">' +
								'Scan this live QR code directly with your phone camera or barcode scanner app:' +
							'</div>' +
							'<div style="background:#ffffff;padding:12px;border-radius:var(--radius-2);border:2px solid var(--hairline);display:inline-flex;justify-content:center;align-items:center;margin-bottom:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">' +
								'<svg id="modalTestQrSvg" width="220" height="220" style="display:block;fill:#000000;"></svg>' +
							'</div>' +
							'<div style="width:100%;background:var(--panel);border:1px solid var(--hairline);border-radius:var(--radius-2);padding:var(--space-3) var(--space-4);margin-bottom:14px;text-align:left;font-size:var(--ui-font-sm);word-break:break-all;">' +
								'<div style="margin-bottom:4px;font-size:11px;font-weight:700;color:var(--ink-muted);">ENCODED DISPATCH LINK:</div>' +
								'<div class="mono" style="font-size:11px;color:var(--accent);">' + esc(link) + '</div>' +
							'</div>' +
							'<div style="display:flex;gap:8px;width:100%;flex-wrap:wrap;">' +
								'<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer" class="btn btn-accent" style="flex:1;min-width:140px;text-align:center;text-decoration:none;font-weight:700;padding:8px 12px;">' + (isEmail ? '✉ Open Email Client' : (isCustom ? '🔗 Open Custom Link' : '📱 Open WhatsApp')) + '</a>' +
								'<button type="button" class="btn" style="padding:8px 12px;" onclick="copyVerificationLink()">📋 Copy Link</button>' +
							'</div>' +
						'</div>' +
						'<div style="padding:var(--space-3) var(--space-5);border-top:1px solid var(--hairline);display:flex;justify-content:flex-end;">' +
							'<button type="button" class="btn" onclick="document.getElementById(\'qrScanModal\').close()">Close</button>' +
						'</div>';

					if (typeof dlg.showModal === 'function') {
						dlg.showModal();
					} else {
						dlg.setAttribute('open', '');
					}

					// Render the SVG into the modal
					const svgEl = document.getElementById('modalTestQrSvg');
					if (svgEl) generateTrueQrSvg(link, svgEl);
				}

				function dispatchVerification() {
					try {
						const r = activeRec();
						const l = buildVerificationLink(r);
						showQrScanModal({ channel: qrChannel, link: l, reportNo: r.reportNo || '' });
						showToast('Test QR opened: Scan with phone or barcode reader.', 'info');
					} catch (e) { showToast('Dispatch failed.', 'error'); }
				}
				function copyVerificationLink() {
					const l = buildVerificationLink(activeRec());
					if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(l).then(() => showToast('Link copied.', 'success'));
					else showToast('Copy unsupported.', 'error');
				}

