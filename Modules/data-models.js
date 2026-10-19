function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function getNextReportNumber(p) {
    const defPrefix = (typeof currentEngine !== 'undefined' && currentEngine === 'LIFTING' ? 'LFT' : 'NDT');
    const prefix = p ? p.replace(/[-_]$/, '') : defPrefix;
    const list = (typeof currentEngine !== 'undefined' && currentEngine === 'LIFTING' ? (typeof liftingBatch !== 'undefined' ? liftingBatch : []) : (typeof ndtBatch !== 'undefined' ? ndtBatch : []));
    const dt = todayISO().replace(/-/g, '');
    const yr = dt.slice(0, 4);
    let mx = 0;
    list.forEach(r => {
        if (!r || !r.reportNo) return;
        // Match either trailing digits or digits after the last delimiter
        const m = String(r.reportNo).match(/(\d+)(?!.*\d)/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n > mx) mx = n;
        }
    });
    const seq = mx > 0 ? (mx + 1) : 1;
    const pat = (typeof docControl !== 'undefined' && docControl && docControl.reportNoPattern) ? docControl.reportNoPattern : '{PREFIX}-{DATE}-0{SEQ}';
    let res = pat
        .replace(/{PREFIX}/g, prefix)
        .replace(/{DATE}/g, dt)
        .replace(/{YEAR}/g, yr);

    // If pattern contains 0{SEQ} and seq >= 10, replace 0{SEQ} directly with seq (e.g. 09 -> 10)
    if (res.includes('0{SEQ}')) {
        res = res.replace(/0{SEQ}/g, seq < 10 ? ('0' + seq) : String(seq));
    } else {
        res = res.replace(/{SEQ}/g, String(seq));
    }
    return res;
}


				/* STORAGE HELPER */
				var store = {
					get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
					set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} },
					del: function (k) { try { window.localStorage.removeItem(k); } catch (e) {} }
				};

				/* CONSTANTS */
				var DEFAULT_EXAM_PARTICULARS = window.DEFAULT_EXAM_PARTICULARS || 'Visual examination and functional test (if applicable) carried out as part of thorough examination by Competent Person';

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
						{ ref: 'Reg 10', item: 'Conformity with Community requirements (CE/UKCA)', result: 'PASS', note: '' },
						{ ref: 'Reg 11', item: 'Dangerous parts guarded', result: 'PASS', note: '' },
						{ ref: 'Reg 12', item: 'Protection against specific hazards & falling objects', result: 'PASS', note: '' },
						{ ref: 'Reg 14', item: 'Controls marked & safe', result: 'PASS', note: '' },
						{ ref: 'Reg 15', item: 'Stopping & emergency stop functional', result: 'PASS', note: '' },
						{ ref: 'Reg 16', item: 'Isolation from energy sources', result: 'PASS', note: '' },
						{ ref: 'Reg 17', item: 'Stability & support verified', result: 'PASS', note: '' },
						{ ref: 'Reg 18', item: 'Lighting suitable', result: 'PASS', note: '' },
						{ ref: 'Reg 19', item: 'Maintenance operations safe & segregated', result: 'PASS', note: '' },
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
						sectionToggles: {},
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

				function defaultLiftingRecord(base) {
					const a = base || {};
					return {
						reportNo: getNextReportNumber('LFT'),
						reportDate: a.reportDate || todayISO(),
						jobRef: a.jobRef || "WO-0954",
						poRef: a.poRef || "PO-2026-8812",
						companyAccred: a.companyAccred || "Integin Global Inspection Services Ltd.",
						standards: a.standards || "BS EN 13889, ISO 4309, ASME B30.26",
						sopRef: a.sopRef || "SOP-LIFT-044 Rev 4",
						fieldToggles: {},
						sectionToggles: {},
						includePuwer: false,
						includeChecklist: false,
						includePhotos: false,
						puwerRows: defaultPuwerRows(),
						employer: a.employer || "Global Marine Logistics Ltd.++London, UK",
						premises: a.premises || "North Sea Marine Terminal - Rigging Yard B",
						subLocation: a.subLocation || "Heavy Lift Rigging Loft / Bay 4",
						colourCode: a.colourCode || "GREEN",
						description: a.description || "Grade 80 High-Tensile Bolt Type Anchor Safety Bow Shackle",
						swl: a.swl || "17.0 Tonnes",
						quantity: a.quantity || "1",
						identification: a.identification || "Stamp: Crosby G-2130 / EQ-SHK-009",
						manufacturer: a.manufacturer || "Crosby Group",
						model: a.model || "G-2130",
						serial: a.serial || "SN-CR-88401",
						plantId: a.plantId || "EQ-SHK-009",
						mfgYear: a.mfgYear || "2023",
						lastExamDate: a.lastExamDate || "2026-04-15",
						markingsLegible: a.markingsLegible || "YES",
						q_firstExam: a.q_firstExam || "NO",
						q_installedCorrectly: a.q_installedCorrectly || "N/A",
						q_int6m: a.q_int6m || "YES",
						q_int12m: a.q_int12m || "NO",
						q_scheme: a.q_scheme || "NO",
						q_exceptional: a.q_exceptional || "NO",
						examParticulars: a.examParticulars || DEFAULT_EXAM_PARTICULARS,
						additionalTesting: a.additionalTesting || "NO",
						additionalTestingDetails: a.additionalTestingDetails || "",
						proofLoadApplied: a.proofLoadApplied || "Visual and Dimensional Examination Only",
						lastProofDetails: a.lastProofDetails || "2024-05-12 | Cert #PLT-44018",
						nextProofDate: a.nextProofDate || "2028-05-11",
						defectDesc: a.defectDesc || "NONE. No cracks, visible deformation, galling, or thread wear detected. Verified safe for lifting operations.",
						dangerImm: a.dangerImm || "NO",
						dangerTimeText: a.dangerTimeText || "N/A",
						remedies: a.remedies || "None required.",
						isSafe: a.isSafe || "YES",
						examDate: a.examDate || todayISO(),
						nextExamDate: a.nextExamDate || calculateNextDate(todayISO(), 6),
						verdictLabel: "",
						verdictText: "",
						extraCells: [],
						examinerName: a.examinerName || "Marcus Vance | Senior LEEA Inspector",
						authName: a.authName || "David H. Miller | Technical Director",
						checklist: [
							{ item: "Visual check for corrosion, distortion & wear", status: "PASS", note: "Clean, zero defects" },
							{ item: "Bow diameter and pin alignment verification", status: "PASS", note: "Within OEM tolerances" },
							{ item: "Identification stamp legibility and WLL rating", status: "PASS", note: "Clear & embossed" }
						],
						photos: Array(12).fill(null),
						inspectorSigLive: null,
						inspectorSigUpload: null,
						inspectorSigMode: 'LIVE',
						authSigLive: null,
						authSigUpload: null,
						authSigMode: 'LIVE',
						stampUpload: null,
						stampPos: { x: 70, y: 76 },
						selected: false
					};
				}

				/* INITIAL DATA */
				var liftingBatch = [defaultLiftingRecord({
					reportNo: "LFT-20261017-01", reportDate: "2026-10-17", examDate: "2026-10-17", nextExamDate: "2027-04-16"
				})];

				var ndtBatch = [Object.assign(defaultNdtRecord(null), {
					reportNo: "NDT-20261017-01", client: "Apex Engineering & Energy Corp.", location: "Bravo Platform - Wellhead Manifold Deck",
					poRef: "PO-2026-8812", itemDesc: "High-Pressure Drill Collar Handling Sub (NC50)", material: "AISI 4145H Mod High-Strength Alloy",
					remarks: "Complete 100% surface scan conducted. Zero relevant crack indications observed. Verified acceptable per ASME Sec VIII Div 1.",
					inspectorName: "Marcus Vance", witnessName: "David H. Miller",
					certNo: "NDT-CERT-2026-88", certExpiry: "2027-05-30", visionTest: "2026-01-10",
					procedureNo: "NDT-PROC-07 Rev 4", acceptCriteria: "ISO 5817 Level B / ASME Sec VIII Div 1",
					calDue: "2026-12-01", refBlock: "IIW V1 / ISO 19232-1 W6", surfaceCond: "As-welded, wire brushed, clean",
					indications: [
						{ item: "Item C-1010", area: "Threads & Pin Radius", finding: "No cracks / No indications", result: "PASS" },
						{ item: "Item C-1011", area: "Stress Relief Groove", finding: "Clean profile, no discontinuity", result: "PASS" }
					]
				})];

				window.defaultLiftingRecord = defaultLiftingRecord;
				window.defaultNdtRecord = defaultNdtRecord;
				window.defaultLiftingBatch = liftingBatch;
				window.defaultNdtBatch = ndtBatch;
				window.liftingBatch = liftingBatch;
				window.ndtBatch = ndtBatch;
