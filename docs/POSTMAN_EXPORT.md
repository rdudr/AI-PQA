# Export for PostMan (KISEM report generator)

**Why this exists.** PostMan is the KISEM / IIT Gandhinagar energy-assessment
report builder. Its *Assessment of electrical distribution system* chapter
prints the plant single line diagram, then one section per **plant main
input** and one per **PCC panel**, each with a *Power quality analysis*
sub-section, and it puts every recording's measurement charts in
**Annexure A** at the back of the report. Those sections need the measured
data from this analyser. This export is how the data gets there — it was
added so PostMan can use AI-PQA's data directly, without retyping anything.

The rule of thumb: **one recording → one workbook → one panel in the report.**

## Where to find it

* **Dashboard → "Export for PostMan"** (next to *Download audit PDF*).
  A small form asks three things, then downloads the workbook:

  | Field | Meaning |
  |---|---|
  | Measured at | `Plant main input`, `PCC panel` or `MCC panel` — where the analyser was clamped in the plant's single line diagram. |
  | Panel name | The panel's name **exactly as entered in the FOX KISEM app** (defaults to the *machine name* from the audit metadata). |
  | Recording ID | The recording ID **written on the FOX KISEM panel sheet** (e.g. `REC-2026-0609-01`). PostMan joins the recording to the panel by this ID first and by panel name second. |

* **API** (both return the `.xlsx` as an attachment):

  ```
  POST /api/upload/session/{session_id}/postman-excel
  { "metadata": {...AuditMetadata...}, "role": "main|pcc|mcc",
    "panel_name": "Old Panel PCC", "recording_id": "REC-2026-0609-02" }

  GET  /api/upload/session/{session_id}/postman-excel?role=pcc&panel_name=...&recording_id=...
  ```
  The `GET` form takes the audit metadata from the persisted session summary
  (needs `DATABASE_URL`); the `POST` form carries it in the body and works
  without a database.

  Code: `backend/reports/postman_export.py` (workbook builder) and
  `backend/routes/upload.py` (routes); `frontend/src/services/api.ts`
  (`downloadPostmanExcel`) and `frontend/src/pages/DashboardPage.tsx`.

## The workbook — format `PostMan-PQ v1`

### Sheet `PostMan` — Field | Value

PostMan reads this sheet into a case- and space-insensitive map, so the row
order does not matter, but the **field names are the contract**.

| Field | Example | Used by PostMan for |
|---|---|---|
| Format | `PostMan-PQ v1` | version check |
| Panel | `Main Incomer 1600 kVA` | heading of the section; fallback join key |
| Role | `main` / `pcc` / `mcc` | which chapter section the recording goes under (a FOX panel match overrides this) |
| Recording ID | `REC-2026-0609-01` | primary join key to the FOX KISEM panel sheet |
| Instrument | `Fluke 435-II` | "Measured with …" line |
| Company / Plant / Address | | cross-check against the report's company |
| Engineer | | "Recorded by" |
| Audit date | | |
| Exported at / Exported by / Session ID / Source file | | provenance line printed under the table |
| Start / End | `2026-06-09 10:00:00` | recording period |
| Samples | `600` | |
| Interval s | `10` | sampling interval (median gap between timestamps) |

### Sheet `Data` — one row per sample

The normalized frame in the analyser's standard column names. PostMan needs
at least one voltage, one current and either `kw` or `pf`; everything else
is optional and simply enriches the section.

```
timestamp
voltage_phase_a  voltage_phase_b  voltage_phase_c
current_phase_a  current_phase_b  current_phase_c
kw  kva  kvar  pf  frequency
vthd_a  vthd_b  vthd_c   ithd_a  ithd_b  ithd_c
U12_%FH03 … U31_%FH49      (per-order voltage harmonics, % of fundamental)
A1_%FH03  … A3_%FH49       (per-order current harmonics)
```

PostMan computes min / average / max for every parameter, the IEEE-519 THD
verdict (voltage 5 %, current 8 %), the harmonic spectrum, and thins the time
series to ~240 points per chart for the annexure.

### Sheets `Summary` and `Harmonics`

For people opening the file in Excel: min / average / max per parameter and
the mean magnitude of every harmonic order. PostMan ignores them and
recomputes from `Data`, so they can never disagree with the report.

## How PostMan uses it

1. In PostMan, drop the workbook on **Import → "Drop any workbook here"**
   (or the *Electrical distribution* section's import box). It is recognised
   by its columns, not its file name.
2. If the FOX KISEM workbook has already been imported, the recording is
   joined to the panel whose *Recording ID* (or name) matches and takes that
   panel's role. Otherwise it is filed under the `Role` given here and can be
   re-matched later from the *Electrical distribution* section.
3. The report prints, per main input / PCC panel: *Measured at the panel*
   (rating, kW, kVA, PF, THD, verdict) and *Power quality analysis*
   (voltage / current / PF / THD tables and harmonic spectrum), and lists the
   full measurement charts under **Annexure A** with an entry in the
   Contents page.

Re-exporting the same recording ID replaces the earlier copy inside PostMan.

## Changing the contract

If a column or field is renamed here, change PostMan's `src/p19_pq.js`
(`PQ_COLS`, `pqMeta`, `importPq`) in the same commit and bump the `Format`
value (`PostMan-PQ v2`). PostMan tolerates a few common instrument aliases
(`U12`, `A1`, `P`, `S`, `Q`, `Hz` …) but the standard names above are the
ones to rely on.

## The bundle — format `PostMan-PQ-JSON v1` (preferred)

The workbook carries raw samples and leaves PostMan to redo the arithmetic
in the browser. The **bundle** moves all processing here, so a recording of
any length (a week at one second: ~8 s on the server, ~75 kB to PostMan)
prints the analyser's *own* findings, section by section:

| Bundle field | What PostMan prints, and where |
|---|---|
| `stats` (min / avg / max / rms per parameter, `v_imbalance_pct`, `i_imbalance_pct`) | *Power quality analysis* table under the panel; the imbalance line |
| `series` (every parameter thinned to 240 bucket means, `t` labels) | PF / THD curves under the panel; V, I, power and harmonic charts in **Annexure A** |
| `harmonics` (mean magnitude per order, V and I) | harmonic-order charts in the annexure |
| `compliance` (rules: standard, clause, measured, limit, verdict, remark; summary score) | *Standards compliance — REC* table and score under the panel; a **Compliance** column in the PCC load summary |
| `health` (five components, weighted overall) | *Equipment health — REC* KPIs, table and chart under the panel |
| `events` (counts by type and severity, the 40 worst, dip/swell summary) | *Events detected — REC* under the panel |
| `data_quality`, `observations` | data-quality line and the analyser's observations under the panel |

Endpoints:

```
POST /api/upload/session/{session_id}/postman.json   { metadata, role, panel_name, recording_id, data_quality?, nominal_voltage? }
GET  /api/upload/session/{session_id}/postman.json?role=pcc&panel_name=...&recording_id=...
GET  /api/upload/postman/sessions                     # what PostMan can pull: persisted history + in-memory sessions
```

Code: `backend/reports/postman_bundle.py`. The compliance and health rules
there are a **port of `frontend/src/utils/compliance.ts` and
`equipmentHealth.ts`** — the three must stay identical (same limits, same
verdict bands, same wording), or the dashboard and the report would
disagree.

Two ways into PostMan:

* **Pull** — on PostMan's *Electrical distribution* page, enter this
  server's address, *List recordings*, tick the sessions, pick the panel
  each was measured at (or choose it from the FOX panels, which fills the
  recording ID), *Import selected recordings*. Nothing is downloaded by
  hand. CORS is open on this API, so PostMan can call it from any origin.
* **File** — dashboard → *Export for PostMan* → *Download PostMan bundle
  (JSON)*, then drop the `.json` on any PostMan drop box (offline route).

The Excel export stays as the fallback for an analyser file that only
exists as a workbook.

## Keeping the two in step

The full contract for all the field apps — what each feeds, the formulas
that must stay identical, the checklist for a change — is
[`docs/INTEGRATIONS.md` in PostMan](https://github.com/rdudr/PostMAN/blob/main/docs/INTEGRATIONS.md).
The two rules from it:

1. **A change here is a change there.** A field added, renamed or
   re-unitised in `backend/reports/postman_bundle.py` or
   `postman_export.py`, a change to the IEEE-519 / EN 50160 limits, the
   health scoring or the event detectors, is matched in PostMan
   (`src/p19_pq.js` — `PQ_COLS`, `pqMeta`, `importPq`, `recSummaryBlocks`,
   `recCharts`; `src/p19b_pqlink.js` — `importPqBundle`, `pqPullCard`,
   `pqComplianceBlocks`, `pqHealthBlocks`, `pqEventBlocks`) in the same
   sitting, with the `Format` tag bumped when an old file would otherwise be
   misread. Likewise, a wording, unit or verdict PostMan improves in the
   report is carried back into this app's dashboard and audit PDF.
2. **Push every repository touched** (`rdudr/AI-PQA` and `rdudr/PostMAN`)
   before the work is called done, each commit naming the other.
