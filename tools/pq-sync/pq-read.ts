// SHARED FILE, copied into each KISEM field app by ai-power-quality-analyzer/tools/pq-sync/sync.mjs.
// Edit it there (tools/pq-sync/pq-read.ts) and run the sync; an edit made inside an app is overwritten.
//
// Reads a power-quality analyser or clamp-meter export in the browser, offline, the same way the
// AI Power Quality Analyzer's backend does:
//   1. every sheet: find the header row (preamble rows skipped), drop the unit row under it;
//   2. map vendor headers to the standard columns (the model's mapping first, then the generic
//      synonym table, the same as the analyzer's parsers/base.py BASE_SYNONYMS);
//   3. merge sheets on the Date+Time / Timestamp key;
//   4. scale W → kW, kA → A, and KM 2400's VLN → VLL (× √3);
//   5. fill kW / kVA / PF from each other where one is missing.
// The instrument models come from ./pq-mappings/index.ts, which the sync writes from the
// analyzer's backend/config/mappings. Nothing here is specific to one app.
import * as XLSX from "xlsx";
import { PQ_MODELS, type PqMapping } from "./pq-mappings";

export type PqInstrument = { id: string; label: string; kind: "PQ" | "Clamp" | "Auto"; mapping: PqMapping | null };

/** Every model the analyzer knows, plus Auto-detect first and a generic reader last. */
export const PQ_INSTRUMENTS: PqInstrument[] = [
  { id: "auto", label: "Auto-detect", kind: "Auto", mapping: null },
  ...PQ_MODELS.map((m) => ({ id: m.id, label: m.label, kind: m.kind, mapping: m.mapping })),
  { id: "Generic", label: "Generic CSV / Excel (Hioki, Fluke …)", kind: "PQ", mapping: null },
];

const CORE = [
  "timestamp", "date", "time",
  "voltage_phase_a", "voltage_phase_b", "voltage_phase_c",
  "current_phase_a", "current_phase_b", "current_phase_c",
  "kw", "kva", "kvar", "pf", "frequency",
  "vthd_a", "vthd_b", "vthd_c", "ithd_a", "ithd_b", "ithd_c",
] as const;
type Core = (typeof CORE)[number];

const BASE_SYNONYMS: Record<Core, string[]> = {
  timestamp: ["timestamp", "datetime", "date_time"],
  date: ["date", "day", "date_only", "recorddate", "date_"],
  time: ["time", "time_only", "recordtime", "hms", "time_"],
  voltage_phase_a: ["voltage_phase_a", "va", "v_a", "phase_a_voltage", "u_a", "van", "urms_a", "v_rms_a", "rms_voltage_a", "v1_n_1_min", "u12_rms", "v1_2_rms", "v1_2", "v1_n", "u12", "v1rms", "u12rms", "v1", "u1", "urms_l1", "v_l1", "vrms_l1"],
  voltage_phase_b: ["voltage_phase_b", "vb", "v_b", "phase_b_voltage", "u_b", "vbn", "urms_b", "v_rms_b", "rms_voltage_b", "v2_n_1_min", "u23_rms", "v2_3_rms", "v2_3", "v2_n", "u23", "v2rms", "u23rms", "v2", "u2", "urms_l2", "v_l2", "vrms_l2"],
  voltage_phase_c: ["voltage_phase_c", "vc", "v_c", "phase_c_voltage", "u_c", "vcn", "urms_c", "v_rms_c", "rms_voltage_c", "v3_n_1_min", "u31_rms", "v3_1_rms", "v3_1", "v3_n", "u31", "v3rms", "u31rms", "v3", "u3", "urms_l3", "v_l3", "vrms_l3"],
  current_phase_a: ["current_phase_a", "ia", "i_a", "phase_a_current", "irms_a", "i_rms_a", "rms_current_a", "a1_rms", "a1", "i1_rms", "i1", "i1_1_min", "a1rms", "irms_l1", "i_l1"],
  current_phase_b: ["current_phase_b", "ib", "i_b", "phase_b_current", "irms_b", "i_rms_b", "rms_current_b", "a2_rms", "a2", "i2_rms", "i2", "i2_1_min", "a2rms", "irms_l2", "i_l2"],
  current_phase_c: ["current_phase_c", "ic", "i_c", "phase_c_current", "irms_c", "i_rms_c", "rms_current_c", "a3_rms", "a3", "i3_rms", "i3", "i3_1_min", "a3rms", "irms_l3", "i_l3"],
  kw: ["kw", "p_kw", "active_power", "power_kw", "p_t_w", "pt_w", "p_w", "p_sum", "p_sum_avg", "pt", "p_total", "active_power_kw"],
  kva: ["kva", "s_kva", "apparent_power", "skva", "s_t_va", "st_va", "s_va", "s_sum", "s_sum_avg", "st", "apparent_power_kva"],
  kvar: ["kvar", "q_kvar", "reactive_power", "total_reactive_power", "q_t_var", "qt_var", "q_sum", "q_sum_avg", "qt"],
  pf: ["pf", "power_factor", "cos_phi", "cosphi", "pft", "pf_sum", "pf_sum_avg", "pf_total"],
  frequency: ["frequency", "freq", "hz", "f_hz", "f", "freq_avg", "freq_hz"],
  // Voltage and current THD in % of the fundamental (the analyzer's parsers/base.py synonyms).
  vthd_a: ["vthd_a", "uthd_a", "thd_v_a", "thdv_a", "v_thd_a", "u12_thdf", "v1_thdf", "u1_thdf", "vthd_l1", "thd_u_l1"],
  vthd_b: ["vthd_b", "uthd_b", "thd_v_b", "thdv_b", "v_thd_b", "u23_thdf", "v2_thdf", "u2_thdf", "vthd_l2", "thd_u_l2"],
  vthd_c: ["vthd_c", "uthd_c", "thd_v_c", "thdv_c", "v_thd_c", "u31_thdf", "v3_thdf", "u3_thdf", "vthd_l3", "thd_u_l3"],
  ithd_a: ["ithd_a", "thd_i_a", "thdi_a", "i_thd_a", "a1_thdf", "i1_thdf", "ithd_l1", "thd_i_l1"],
  ithd_b: ["ithd_b", "thd_i_b", "thdi_b", "i_thd_b", "a2_thdf", "i2_thdf", "ithd_l2", "thd_i_l2"],
  ithd_c: ["ithd_c", "thd_i_c", "thdi_c", "i_thd_c", "a3_thdf", "i3_thdf", "ithd_l3", "thd_i_l3"],
};

const UNIT_SUFFIXES = ["_kvarh", "_kvar", "_kvah", "_kva", "_kwh", "_kw", "_varh", "_var", "_vah", "_va", "_wh", "_hz", "_ka", "_w", "_v", "_a"];

// Chauvin Arnoux / ALM exports write THD, RMS, CF in Unicode small capitals.
const SMALL_CAPS: Record<string, string> = {
  "ᴀ": "a", "ʙ": "b", "ᴄ": "c", "ᴅ": "d", "ᴇ": "e", "ꜰ": "f", "ɢ": "g", "ʜ": "h", "ɪ": "i", "ᴊ": "j", "ᴋ": "k",
  "ʟ": "l", "ᴍ": "m", "ɴ": "n", "ᴏ": "o", "ᴘ": "p", "ʀ": "r", "ꜱ": "s", "ᴛ": "t", "ᴜ": "u", "ᴠ": "v", "ᴡ": "w", "ʏ": "y", "ᴢ": "z",
};
const foldSmallCaps = (s: string) => s.replace(/[ɐ-ʯᴀ-ᵿ꜀-ꟿ]/g, (ch) => SMALL_CAPS[ch] ?? ch);

export function slugColumn(name: unknown): string {
  let s = foldSmallCaps(String(name ?? "")).normalize("NFKC").trim().toLowerCase();
  s = s.replace(/[%\s]+/g, "_").replace(/[^a-z0-9_]+/g, "_");
  return s.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

const SYN_LOOKUP: Map<string, Core> = (() => {
  const m = new Map<string, Core>();
  for (const k of CORE) for (const a of BASE_SYNONYMS[k]) m.set(slugColumn(a), k);
  return m;
})();

/** Header slug → standard column; a header the model lists as "NA" (or as a column not read here) maps to null. */
function mappingLookup(mapping: PqMapping | null): Map<string, Core | null> {
  const m = new Map<string, Core | null>();
  if (!mapping) return m;
  for (const [raw, v] of Object.entries(mapping)) {
    const std = typeof v === "string" ? v : v?.standard_column;
    const slug = slugColumn(raw);
    const core = std && (CORE as readonly string[]).includes(std) ? (std as Core) : null;
    for (const key of [slug, stripInterval(slug)]) {
      if (!key) continue;
      if (!m.has(key) || (m.get(key) === null && core)) m.set(key, core);
    }
  }
  return m;
}

// The recording interval loggers append to every header: "PT (1 s)", "I1 (1 min)", "U12 (10 min)".
// Stripped, so one model file covers every interval the instrument was set to.
const INTERVAL_TAG = /_\d+_?(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)$/;
export const stripInterval = (slug: string) => slug.replace(INTERVAL_TAG, "");

function resolveSlug(slug: string, modelMap: Map<string, Core | null>): Core | null | undefined {
  if (modelMap.has(slug)) return modelMap.get(slug)!;
  if (SYN_LOOKUP.has(slug)) return SYN_LOOKUP.get(slug)!;
  for (const suf of UNIT_SUFFIXES) {
    if (slug.endsWith(suf) && slug.length > suf.length) {
      const base = slug.slice(0, -suf.length);
      if (modelMap.has(base)) return modelMap.get(base)!;
      if (SYN_LOOKUP.has(base)) return SYN_LOOKUP.get(base)!;
    }
  }
  return undefined;
}

function resolveHeader(header: string, modelMap: Map<string, Core | null>): Core | null {
  const slug = slugColumn(header);
  if (!slug) return null;
  const exact = resolveSlug(slug, modelMap);
  if (exact !== undefined) return exact;
  const bare = stripInterval(slug);
  if (bare && bare !== slug) {
    const r = resolveSlug(bare, modelMap);
    if (r !== undefined) return r;
  }
  return null;
}

const HEADER_HINTS = ["urms", "irms", "thd", "vrms", "kw", "kva", "pf", "freq", "date", "time", "phase", "voltage", "current", "harmonic", "rms", "u12", "a1"];

function headerScore(cells: unknown[], modelMap: Map<string, Core | null>): number {
  let score = 0;
  for (const c of cells) {
    if (c === null || c === undefined || String(c).trim() === "" || typeof c === "number") continue;
    const slug = slugColumn(c);
    if (resolveHeader(String(c), modelMap)) score += 2;
    else if (HEADER_HINTS.some((h) => slug.includes(h))) score += 1;
  }
  return score;
}

// ── time parsing ────────────────────────────────────────────────────────────
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const excelSerialToMs = (v: number) => EXCEL_EPOCH + v * 86400000;
/** Local wall-clock ms for a JS Date produced by SheetJS (it builds dates in local time). */
const dateToWallMs = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());

function parseDateString(s: string, dayFirst: boolean): number | null {
  const str = s.trim();
  if (!str) return null;
  let m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(am|pm)?)?/i);
  if (m) {
    let h = +(m[4] || 0);
    if (m[8]) { const pm = m[8].toLowerCase() === "pm"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return Date.UTC(+m[1], +m[2] - 1, +m[3], h, +(m[5] || 0), +(m[6] || 0), m[7] ? +(m[7] + "00").slice(0, 3) : 0);
  }
  m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(am|pm)?)?/i);
  if (m) {
    const a = +m[1], b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    let day = dayFirst ? a : b, mon = dayFirst ? b : a;
    if (mon > 12 && day <= 12) [day, mon] = [mon, day];
    let h = +(m[4] || 0);
    if (m[8]) { const pm = m[8].toLowerCase() === "pm"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return Date.UTC(y, mon - 1, day, h, +(m[5] || 0), +(m[6] || 0), m[7] ? +(m[7] + "00").slice(0, 3) : 0);
  }
  const t = Date.parse(str);
  return isNaN(t) ? null : t - new Date(t).getTimezoneOffset() * 60000;
}

function parseTimeOfDay(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return ((v.getHours() * 60 + v.getMinutes()) * 60 + v.getSeconds()) * 1000 + v.getMilliseconds();
  if (typeof v === "number") return Math.round((v % 1) * 86400000);
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1];
  if (m[5]) { const pm = m[5].toLowerCase() === "pm"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  return ((h * 60 + +m[2]) * 60 + +(m[3] || 0)) * 1000 + (m[4] ? +(m[4] + "00").slice(0, 3) : 0);
}

function parseDateOnly(v: unknown, dayFirst: boolean): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === "number") return excelSerialToMs(Math.floor(v));
  const t = parseDateString(String(v), dayFirst);
  if (t === null) return null;
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseTimestamp(v: unknown, dayFirst: boolean): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return dateToWallMs(v);
  if (typeof v === "number") return v > 20000 && v < 80000 ? excelSerialToMs(v) : null;
  return parseDateString(String(v), dayFirst);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).trim().replace(/,/g, "");
  if (!s || /^(-+|nan|n\/a|na|null|--)$/i.test(s)) return null;
  const x = parseFloat(s);
  return isFinite(x) ? x : null;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
const avgOf = (...xs: Array<number | null | undefined>) => {
  const v = xs.filter((x): x is number => typeof x === "number" && isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const maxOf = (...xs: Array<number | null | undefined>) => {
  const v = xs.filter((x): x is number => typeof x === "number" && isFinite(x));
  return v.length ? Math.max(...v) : null;
};

type SheetCols = Partial<Record<Core, { idx: number; header: string }>>;

function readSheet(ws: XLSX.WorkSheet, modelMap: Map<string, Core | null>) {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
  if (!grid.length) return null;
  let best = -1, bestScore = 0;
  for (let i = 0; i < Math.min(40, grid.length); i++) {
    const s = headerScore(grid[i] || [], modelMap);
    if (s > bestScore && s >= 3) { bestScore = s; best = i; }
  }
  if (best < 0) return null;
  const header = (grid[best] || []).map((c, j) => (c === null || c === undefined ? `col_${j}` : String(c).trim()));
  const cols: SheetCols = {};
  const unmapped: string[] = [];
  const mapped: string[] = [];
  header.forEach((h, idx) => {
    if (h.startsWith("col_")) return;
    const std = resolveHeader(h, modelMap);
    if (std && !cols[std]) { cols[std] = { idx, header: h }; mapped.push(`${h} → ${std}`); }
    else if (!std) unmapped.push(h);
  });
  if (!cols.timestamp && !cols.date && !cols.time) return null;
  let body = grid.slice(best + 1);
  const units = new Set(["v", "a", "w", "var", "va", "hz", "%", "kw", "kva", "kvar", "ka", "pf", "s"]);
  if (body.length && (body[0] || []).some((c) => typeof c === "string" && units.has(c.trim().toLowerCase()))) body = body.slice(1);
  return { cols, body, unmapped, mapped };
}

/** One reading of the logger, in V (line-line), A, kW, kVA, kVAr; THD in % (average of the phases). */
export type PqPoint = { t: number; v: number | null; i: number | null; kw: number | null; kva: number | null; kvar: number | null; pf: number | null; vthd?: number | null; ithd?: number | null; iMax?: number | null };

export type PqReadResult = {
  instrument: string;
  kind: "PQ" | "Clamp";
  points: PqPoint[];
  /** Typical seconds between readings. */
  intervalS: number;
  /** Which logger header became which standard column, and the headers not used. */
  mapped: string[];
  unmapped: string[];
  hasKw: boolean;
  /** Voltage / current THD columns were found. */
  hasThd: boolean;
};

/**
 * Read a logger export. `instrumentId` is one of PQ_INSTRUMENTS (or "auto"); `threePhase` decides the
 * √3 used when kVA has to be worked out from V and A.
 */
// Sheets that never hold the time series of V, A, kW, PF. Harmonics sheets are by far the largest part
// of an analyser export (an ALM 20 1 s recording: ~45 MB, 3 GB of memory if read), so they are skipped.
const SKIP_SHEETS = /harmonic|event|config|session total|summary of|alarm|energy and cost|transient|inrush|photo/i;

/** Lets the page paint (a loading spinner) before a long synchronous step. */
const breathe = () => new Promise<void>((r) => setTimeout(r, 0));

export async function readPqFile(file: File, instrumentId: string, threePhase = true): Promise<PqReadResult> {
  await breathe();
  const buf = await file.arrayBuffer();
  const isText = /\.(csv|txt|tsv)$/i.test(file.name || "");
  let wantSheets: string[] | undefined;
  if (!isText) {
    try {
      const names = XLSX.read(buf, { type: "array", bookSheets: true }).SheetNames || [];
      const keep = names.filter((n) => !SKIP_SHEETS.test(n));
      if (keep.length && keep.length < names.length) wantSheets = keep;
    } catch { /* read everything below */ }
  }
  await breathe();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, dense: true, ...(wantSheets ? { sheets: wantSheets } : {}) });
  await breathe();

  let chosen = PQ_INSTRUMENTS.find((x) => x.id === instrumentId) ?? PQ_INSTRUMENTS[0];
  if (chosen.id === "auto") {
    let bestScore = -1;
    for (const inst of PQ_INSTRUMENTS.filter((x) => x.mapping)) {
      // Exact names only: the interval-free forms would let one model claim another's files.
      const mm = new Set(Object.keys(inst.mapping || {}).map(slugColumn));
      let score = 0;
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        if (!ws || !ws["!ref"]) continue;
        const r = XLSX.utils.decode_range(ws["!ref"]);
        r.e.r = Math.min(r.e.r, r.s.r + 39);
        const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false, range: r });
        for (const row of grid) for (const c of row || []) if (typeof c === "string" && mm.has(slugColumn(c))) score++;
      }
      if (score > bestScore) { bestScore = score; chosen = inst; }
    }
    if (bestScore <= 0) chosen = PQ_INSTRUMENTS.find((x) => x.id === "Generic")!;
  }
  const modelMap = mappingLookup(chosen.mapping);

  const merged = new Map<number, Partial<Record<Core, number>>>();
  const headers: Partial<Record<Core, string>> = {};
  const unmapped = new Set<string>(), mappedList = new Set<string>();
  for (const name of wb.SheetNames) {
    if (!wb.Sheets[name]) continue;
    await breathe();
    const sheet = readSheet(wb.Sheets[name], modelMap);
    if (!sheet) continue;
    sheet.unmapped.forEach((u) => unmapped.add(u));
    sheet.mapped.forEach((u) => mappedList.add(u));
    const { cols, body } = sheet;
    let dayFirst = true;
    const probeCol = cols.timestamp ?? cols.date;
    if (probeCol) {
      const first = body.find((r) => typeof r?.[probeCol.idx] === "string")?.[probeCol.idx];
      if (typeof first === "string" && /^\d{4}/.test(first.trim())) dayFirst = false;
    }
    for (const row of body) {
      if (!row) continue;
      let t: number | null = null;
      if (cols.timestamp) t = parseTimestamp(row[cols.timestamp.idx], dayFirst);
      if (t === null && cols.date) {
        const d = parseDateOnly(row[cols.date.idx], dayFirst);
        const tod = cols.time ? parseTimeOfDay(row[cols.time.idx]) : 0;
        if (d !== null) t = d + (tod ?? 0);
      }
      if (t === null && cols.time && !cols.date) {
        const tv = row[cols.time.idx];
        t = tv instanceof Date && tv.getFullYear() > 1900 ? dateToWallMs(tv) : parseTimestamp(tv, dayFirst);
      }
      if (t === null || !isFinite(t)) continue;
      const key = Math.round(t / 1000) * 1000;
      const rec = merged.get(key) ?? {};
      for (const k of CORE) {
        if (k === "timestamp" || k === "date" || k === "time") continue;
        const c = cols[k];
        if (!c || rec[k] !== undefined) continue;
        const v = toNum(row[c.idx]);
        if (v !== null) { rec[k] = v; if (!headers[k]) headers[k] = c.header; }
      }
      merged.set(key, rec);
    }
  }
  const keys = [...merged.keys()].sort((a, b) => a - b);
  if (keys.length < 2) throw new Error("No time-stamped readings were found. Check the instrument model and that the file is the instrument's own export.");

  // unit scaling, as the analyzer's _scale_power_columns
  const factor: Partial<Record<Core, number>> = {};
  for (const k of ["kw", "kva", "kvar"] as const) {
    const h = headers[k];
    if (!h) continue;
    const lower = h.toLowerCase();
    if (/(^|[^a-z])k(w|va|var)\b|\(k(w|va|var)\)|kw|kva|kvar/i.test(lower) && !/\(w\)|\(va\)|\(var\)/i.test(lower)) factor[k] = 1;
    else if (/\(w\)|\(va\)|\(var\)|_w\b|\bw\b/i.test(lower)) factor[k] = 1 / 1000;
    else {
      // no unit in the header: values in the thousands for a field motor are watts
      const med = median(keys.map((t) => merged.get(t)![k]).filter((x): x is number => typeof x === "number").map(Math.abs));
      factor[k] = med > 2000 ? 1 / 1000 : 1;
    }
  }
  for (const k of ["current_phase_a", "current_phase_b", "current_phase_c"] as const) {
    const h = headers[k];
    if (h && /\(ka\)|_ka\b|\bka\b/i.test(h)) {
      const med = median(keys.map((t) => merged.get(t)![k]).filter((x): x is number => typeof x === "number"));
      factor[k] = med < 10 ? 1000 : 1;
    }
  }
  const vlnToVll = chosen.id === "KM 2400" && threePhase ? Math.sqrt(3) : 1;

  const points: PqPoint[] = keys.map((t) => {
    const r = merged.get(t)!;
    const g = (k: Core) => (typeof r[k] === "number" ? (r[k] as number) * (factor[k] ?? 1) : null);
    const vAvg = avgOf(g("voltage_phase_a"), g("voltage_phase_b"), g("voltage_phase_c"));
    const p: PqPoint = {
      t, v: vAvg !== null ? vAvg * vlnToVll : null,
      i: avgOf(g("current_phase_a"), g("current_phase_b"), g("current_phase_c")),
      kw: g("kw"), kva: g("kva"), kvar: g("kvar"), pf: g("pf"),
      vthd: avgOf(g("vthd_a"), g("vthd_b"), g("vthd_c")),
      ithd: avgOf(g("ithd_a"), g("ithd_b"), g("ithd_c")),
      iMax: maxOf(g("current_phase_a"), g("current_phase_b"), g("current_phase_c")),
    };
    if (p.kw !== null) p.kw = Math.abs(p.kw);
    if (p.pf !== null) { let pf = Math.abs(p.pf); if (pf > 1.5) pf /= 100; p.pf = Math.min(1, pf); }
    if (p.kva === null && p.v && p.i) p.kva = (threePhase ? Math.sqrt(3) : 1) * p.v * p.i / 1000;
    if (p.kw === null && p.kva && p.pf) p.kw = p.kva * p.pf;
    if (p.pf === null && p.kw && p.kva) p.pf = Math.min(1, p.kw / p.kva);
    if (p.kvar === null && p.kva && p.kw !== null) p.kvar = Math.sqrt(Math.max(0, p.kva * p.kva - p.kw * p.kw));
    return p;
  });
  const diffs: number[] = [];
  for (let i = 1; i < keys.length; i++) diffs.push((keys[i] - keys[i - 1]) / 1000);
  return {
    instrument: chosen.id === "Generic" ? "Generic" : chosen.label,
    kind: chosen.kind === "Clamp" ? "Clamp" : "PQ",
    points,
    intervalS: Math.max(1, median(diffs.filter((d) => d > 0))),
    mapped: [...mappedList], unmapped: [...unmapped],
    hasKw: points.some((p) => p.kw !== null),
    hasThd: points.some((p) => p.vthd != null || p.ithd != null),
  };
}
