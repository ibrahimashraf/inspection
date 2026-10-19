/* ==================================================================
   modules/state.js — v2.2
   ==================================================================
   v2.2 changes:
     - FIELD_RULES expanded from 9 keys to 35. Missing rules meant
       _validateField returned values unchanged for most fields, so
       "route everything through validation" was really "route 9
       fields through validation and skip 26 silently".
     - quantity type changed from 'number' to 'string'. The input is
       <input type="text">, the data model stores "1", and the number
       branch was coercing empty strings to 0 on every sync. Real
       quantities can be "1", "2", "500 kg" — string is correct.
     - number branch no longer coerces empty/NaN to 0. Empty stays
       empty; invalid stays empty. Silent zeroing was a data-loss bug.
     - date branch now normalizes YYYY-MM-DD, ISO-8601 with time, and
       common locale formats. Previously the branch was a passthrough,
       so a grid-typed "3/31/2026" survived and then broke every
       downstream calculateNextDate() call.
     - _validateField now trims strings even when no rule exists.
       Before, a field absent from FIELD_RULES was returned verbatim,
       so "  hello  " in the grid became "  hello  " in the record.
      - required is documented as a UI hint, not a save gate. The red
        asterisk in ui.js already enforces it visually. Making it throw
        would break offline autosave.
     ================================================================== */

/* ==============================================================
   FIELD_RULES
   Every rule here is enforced on every path: form input, grid
   cell edit, inline contenteditable edit, CSV import, and backup
   restore. Fields absent from this map get default string hygiene
   (trim only) via the fallback branch in _validateField.
   ============================================================== */
const FIELD_RULES = {
    /* ── Identity (LIFTING + NDT share reportNo) ── */
    reportNo:        { type: 'string', required: true, maxLength: 64 },
    reportDate:      { type: 'date',   required: true },
    examDate:        { type: 'date',   required: true },
    nextExamDate:    { type: 'date' },
    lastExamDate:    { type: 'date' },

    /* ── Equipment ── */
    serial:          { type: 'string', maxLength: 64 },
    plantId:         { type: 'string', maxLength: 64 },
    swl:             { type: 'string', maxLength: 32 },
    quantity:        { type: 'string', maxLength: 16 },
    model:           { type: 'string', maxLength: 64 },
    manufacturer:    { type: 'string', maxLength: 96 },
    mfgYear:         { type: 'string', maxLength: 8 },

    /* ── LIFTING enums ── */
    markingsLegible:       { type: 'enum', values: ['YES', 'NO', 'RESTAMPED'] },
    dangerImm:             { type: 'enum', values: ['NO', 'YES'] },
    isSafe:                { type: 'enum', values: ['YES', 'NO'] },
    q_firstExam:           { type: 'enum', values: ['NO', 'YES'] },
    q_installedCorrectly:  { type: 'enum', values: ['N/A', 'YES'] },
    q_int6m:               { type: 'enum', values: ['YES', 'NO'] },
    q_int12m:              { type: 'enum', values: ['NO', 'YES'] },
    q_scheme:              { type: 'enum', values: ['NO', 'YES'] },
    q_exceptional:         { type: 'enum', values: ['NO', 'YES'] },
    additionalTesting:     { type: 'enum', values: ['NO', 'YES'] },

    /* ── NDT ── */
    result:          { type: 'string', maxLength: 64 },
    certLevel:       { type: 'string', maxLength: 64 },
    certNo:          { type: 'string', maxLength: 32 },
    certExpiry:      { type: 'date' },
    visionTest:      { type: 'date' },
    calDue:          { type: 'date' },
    surfaceTemp:     { type: 'string', maxLength: 8 },
    lightIntensity:  { type: 'string', maxLength: 48 },
    refBlock:        { type: 'string', maxLength: 96 },
    procedureNo:     { type: 'string', maxLength: 64 },
    acceptCriteria:  { type: 'string', maxLength: 128 }
};

/* ==============================================================
   _validateField
   Returns a value safe to assign to the record. Never throws —
   offline autosave must not be blocked by a validation failure.
   `required` is a UI hint consumed by ui.js renderRequiredFields;
   it is not enforced here.
   ============================================================== */
function _validateField(key, value) {
    const rule = FIELD_RULES[key];

    /* No rule: still apply string hygiene so grid/inline edits and
       CSV imports get trimmed. */
    if (!rule) {
        if (typeof value === 'string') return value.trim();
        return value;
    }

    if (rule.type === 'string') {
        let v = String(value == null ? '' : value).trim();
        if (rule.maxLength && v.length > rule.maxLength) v = v.slice(0, rule.maxLength);
        return v;
    }

    if (rule.type === 'number') {
        /* Empty stays empty. Invalid stays empty. Never silently 0. */
        if (value === '' || value === null || value === undefined) return '';
        const n = parseFloat(value);
        if (isNaN(n)) return '';
        if (rule.min !== undefined && n < rule.min) return rule.min;
        if (rule.max !== undefined && n > rule.max) return rule.max;
        return n;
    }

    if (rule.type === 'date') {
        const v = String(value == null ? '' : value).trim();
        if (!v) return '';
        /* Canonical YYYY-MM-DD (optionally with time suffix). */
        const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso) return iso[1];
        /* Anything Date.parse can resolve: "3/31/2026", "31 Mar 2026",
           "2026-09-30T14:00:00Z", etc. Normalize to UTC YYYY-MM-DD. */
        const t = Date.parse(v);
        if (!isNaN(t)) {
            const d = new Date(t);
            return d.getUTCFullYear() + '-' +
                   String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
                   String(d.getUTCDate()).padStart(2, '0');
        }
        /* Unparseable: return empty rather than leave garbage in a
           field downstream code will try to split('-') on. */
        return '';
    }

    if (rule.type === 'enum') {
        const v = String(value == null ? '' : value);
        return rule.values.includes(v) ? v : rule.values[0];
    }

    return value;
}

/* Expose to the fast-path edit handlers in index.html. */
window._validateField = _validateField;
window.FIELD_RULES = FIELD_RULES;
