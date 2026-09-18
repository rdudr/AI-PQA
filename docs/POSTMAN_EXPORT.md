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
