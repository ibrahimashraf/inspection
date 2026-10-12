function todayISO() { return new Date().toISOString().slice(0, 10); }
function getNextReportNumber(p) {
    const defPrefix = (typeof currentEngine !== 'undefined' && currentEngine === 'LIFTING' ? 'LFT' : 'NDT');
    const prefix = p ? p.replace(/[-_]$/, '') : defPrefix;
    const list = (typeof currentEngine !== 'undefined' && currentEngine === 'LIFTING' ? (typeof liftingBatch !== 'undefined' ? liftingBatch : []) : (typeof ndtBatch !== 'undefined' ? ndtBatch : []));
    const dt = todayISO().replace(/-/g, '');
    const yr = dt.slice(0, 4);
    let mx = 0;
    list.forEach(r => {
        const m = (r.reportNo || '').match(/(d+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > mx) mx = n;
        }
    });
    const seq = mx > 0 ? (mx + 1) : 1;
    const seqStr = String(seq);
    const pat = (typeof docControl !== 'undefined' && docControl && docControl.reportNoPattern) ? docControl.reportNoPattern : '{PREFIX}-{DATE}-0{SEQ}';
    return pat
        .replace(/{PREFIX}/g, prefix)
        .replace(/{DATE}/g, dt)
        .replace(/{YEAR}/g, yr)
        .replace(/{SEQ}/g, seqStr);
}


				/* STORAGE HELPER */
				var store = {
					get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
					set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} },
					del: function (k) { try { window.localStorage.removeItem(k); } catch (e) {} }
				};

				/* CONSTANTS */
				const DEFAULT_EXAM_PARTICULARS = 'Visual examination and functional test (if applicable) carried out as part of thorough examination by Competent Person';

				const UNIT_DB = {
					mass: { label: 'Mass', units: { t: ['Tonne (t)', 1000], kg: ['Kilogram (kg)', 1], g: ['Gram (g)', .001], lb: ['Pound (lb)', .45359237], oz: ['Ounce (oz)', .028349523125], st: ['Stone (st)', 6.35029318], lt: ['Long Ton (Imperial)', 1016.0469088], ston: ['Short Ton (US)', 907.18474] } },
					length: { label: 'Length', units: { m: ['Metre (m)', 1], cm: ['Centimetre (cm)', .01], mm: ['Millimetre (mm)', .001], in: ['Inch (in)', .0254], ft: ['Foot (ft)', .3048], yd: ['Yard (yd)', .9144] } },
					area: { label: 'Area', units: { m2: ['m²', 1], cm2: ['cm²', .0001], mm2: ['mm²', .000001], in2: ['in²', .00064516], ft2: ['ft²', .09290304], yd2: ['yd²', .83612736] } },
					volume: { label: 'Volume', units: { L: ['Litre (L)', 1], mL: ['mL', .001], m3: ['m³', 1000], in3: ['in³', .016387064], ft3: ['ft³', 28.316846592], usgal: ['US gallon', 3.785411784], impgal: ['Imperial gallon', 4.54609] } },
					temperature: { label: 'Temperature', special: true, units: { C: ['Celsius °C', 1], F: ['Fahrenheit °F', 1], K: ['Kelvin K', 1] } },
					pressure: { label: 'Pressure', units: { Pa: ['Pascal (Pa)', 1], kPa: ['kPa', 1000], MPa: ['MPa', 1000000], bar: ['bar', 100000], psi: ['psi', 6894.757293168], kgcm2: ['kgf/cm²', 98066.5] } },
					force: { label: 'Force / Load', units: { N: ['Newton (N)', 1], kN: ['kN', 1000], lbf: ['lbf', 4.4482216152605], kgf: ['kgf', 9.80665], tf: ['Tonne-force (tf)', 9806.65] } }
				};

				function tempToC(v, u) { if (u === 'C') return v; if (u === 'F') return (v - 32) * 5 / 9; return v - 273.15; }
				function tempFromC(v, u) { if (u === 'C') return v; if (u === 'F') return v * 9 / 5 + 32; return v + 273.15; }
				function fmtNum(x) { if (!isFinite(x)) return '—'; const a = Math.abs(x); if (a !== 0 && (a >= 1e7 || a < 1e-5)) return x.toExponential(5); return String(Math.round(x * 1e6) / 1e6); }


				/* DATA FACTORIES */
				function defaultPuwerRows() {
					return [
						{ ref: 'Reg 4', item: 'Suitability of work equipment', result: 'PASS', note: '' },
						{ ref: 'Reg 5', item: 'Maintenance regime & records', result: 'PASS', note: '' },
						{ ref: 'Reg 6', item: 'Inspection by competent person', result: 'PASS', note: '' },
						{ ref: 'Reg 7', item: 'Specific risks restricted to trained persons', result: 'PASS', note: '' },
						{ ref: 'Reg 8', item: 'Information & instructions available', result: 'PASS', note: '' },
						{ ref: 'Reg 9', item: 'Training of operators & supervisors', result: 'PASS', note: '' },
						{ ref: 'Reg 11', item: 'Dangerous parts guarded', result: 'PASS', note: '' },
						{ ref: 'Reg 14', item: 'Controls marked & safe', result: 'PASS', note: '' },
						{ ref: 'Reg 15', item: 'Stopping & emergency stop functional', result: 'PASS', note: '' },
						{ ref: 'Reg 16', item: 'Isolation from energy sources', result: 'PASS', note: '' },
						{ ref: 'Reg 17', item: 'Stability & support verified', result: 'PASS', note: '' },
						{ ref: 'Reg 18', item: 'Lighting suitable', result: 'PASS', note: '' },
						{ ref: 'Reg 20', item: 'Markings & signs legible', result: 'PASS', note: '' },
						{ ref: 'Reg 21', item: 'Warning devices effective', result: 'PASS', note: '' },
						{ ref: 'Reg 22', item: 'Maintenance operations safe', result: 'PASS', note: '' }
					];
				}

				function defaultNdtRecord(base) {
					const a = base || {};
					return {
						method: "MPI",
						reportNo: getNextReportNumber('NDT'),
						client: a.client || "",
						location: a.location || "",
						poRef: "",
						itemDesc: "",
						material: "",
						testSpec: "ASME Sec V / ASTM E 709",
						result: "PASSED / ACCEPTABLE",
						remarks: "",
						fieldToggles: {},
						inspectorName: a.inspectorName || "",
						witnessName: a.witnessName || "",
						certLevel: a.certLevel || "ISO 9712 Level 2",
						certNo: a.certNo || "",
						certExpiry: a.certExpiry || "",
						visionTest: a.visionTest || "",
						procedureNo: a.procedureNo || "",
						acceptCriteria: a.acceptCriteria || "",
						calDue: a.calDue || "",
						refBlock: a.refBlock || "",
						surfaceCond: "",
						surfaceTemp: "24",
						lightIntensity: "620 lux visible",
						couplant: "",
						coverage: "100% surface scan",
						yokeSerial: "Parker B300",
						magCurrent: "AC Continuous",
						inkType: "Ardrox 800/3 Black Ink",
						penetrantType: "Visible Solvent Removable",
						penetrantBrand: "Magnaflux SKL-SP2",
						dwellTime: "15 mins",
						utUnit: "USM 35X",
						probeFreq: "5.0 MHz",
						verdictLabel: "",
						verdictText: "",
						extraCells: [],
						includeChecklist: false,
						includePhotos: false,
						checklist: [],
						photos: Array(12).fill(null),
						inspSigLive: null, inspSigUpload: null, inspSigMode: 'LIVE',
						witSigLive: null, witSigUpload: null, witSigMode: 'LIVE',
						stampUpload: a.stampUpload || null,
						stampPos: { x: 70, y: 76 },
						indications: [],
						selected: false
					};
				}

				/* INITIAL DATA */
				var liftingBatch = [{
					reportNo: "LFT-20261012-01", reportDate: "2026-09-30", jobRef: "WO-0842", poRef: "PO-99201-EGY",
					companyAccred: "Vanguard Inspection Ltd.", standards: "BS EN 13889, ISO 4309, ASME B30.26", sopRef: "SOP-LIFT-044 Rev 4",
					fieldToggles: { dangerTimeText: false }, includePuwer: false, includeChecklist: false, includePhotos: false, puwerRows: defaultPuwerRows(),
					employer: "Belayim Petroleum Co. (Petrobel)++Cairo, Egypt", premises: "El-Qaher II Jack-up Rig",
					subLocation: "Drill Floor / Bay 3", colourCode: "GREEN",
					description: "Grade 80 High-Tensile Bolt Type Anchor Bow Shackle",
					swl: "17.0 Tonnes", quantity: "1", identification: "Stamp: Crosby G-2130 / EQ-SHK-009",
					manufacturer: "Crosby Group", model: "G-2130", serial: "SN-CR-88401", plantId: "EQ-SHK-009", mfgYear: "2022",
					lastExamDate: "2026-03-31", markingsLegible: "YES",
					q_firstExam: "NO", q_installedCorrectly: "N/A", q_int6m: "YES", q_int12m: "NO", q_scheme: "NO", q_exceptional: "NO",
					examParticulars: DEFAULT_EXAM_PARTICULARS,
					additionalTesting: "NO", additionalTestingDetails: "",
					proofLoadApplied: "Visual and Dimensional Examination Only",
					lastProofDetails: "2024-05-12 | Cert #PLT-44018", nextProofDate: "2028-05-11",
					defectDesc: "NONE. No cracks, visible deformation, galling, or thread wear detected.",
					dangerImm: "NO", dangerTimeText: "N/A", remedies: "None", isSafe: "YES",
					examDate: "2026-09-30", nextExamDate: "2027-03-29",
					verdictLabel: "", verdictText: "", extraCells: [],
					examinerName: "Ibrahim Eldofy | LEEA Inspector",
					authName: "Reda El-Awady | Technical Manager",
					checklist: [{ item: "Visual check for corrosion / distortion", status: "PASS", note: "Clean" }],
					photos: Array(12).fill(null),
					inspectorSigLive: null, inspectorSigUpload: null, inspectorSigMode: 'LIVE',
					authSigLive: null, authSigUpload: null, authSigMode: 'LIVE',
					stampUpload: null, stampPos: { x: 70, y: 76 }, selected: false
				}];

				var ndtBatch = [Object.assign(defaultNdtRecord(null), {
					reportNo: "NDT-20261012-01", client: "Belayim Petroleum Co.", location: "El-Qaher II Rig",
					poRef: "PO-99201", itemDesc: "Drill Collar Handling Sub (NC50)", material: "AISI 4145H Mod Alloy",
					remarks: "No crack indications observed.",
					inspectorName: "Ibrahim Eldofy", witnessName: "Reda El-Awady",
					certNo: "EG-NDT-2214", certExpiry: "2027-05-30", visionTest: "2026-01-10",
					procedureNo: "NDT-PROC-07 Rev 3", acceptCriteria: "ISO 5817 Level B / ASME Sec VIII Div 1",
					calDue: "2026-12-01", refBlock: "IIW V1 / ISO 19232-1 W6", surfaceCond: "As-welded, wire brushed",
					indications: [{ joint: "Joint C-1010", area: "Threads", finding: "No cracks", result: "PASS" }]
				})];
