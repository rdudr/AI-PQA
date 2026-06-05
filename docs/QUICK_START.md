# Quick Start Guide - Power Quality Analyzer

## System Overview

The Power Quality Analyzer is a web-based platform for analyzing electrical power quality measurements from various devices (Hioki, Fluke, Schneider, etc.).

**Architecture:**
- **Frontend:** React + TypeScript + Vite (Port 5173)
- **Backend:** FastAPI + Python (Port 8000)
- **Data Flow:** Raw Device Export → Column Mapping → Normalization → Analysis → Visualization

---

## Setup Instructions

### Backend Setup (offline / local)

```bash
# Navigate to backend directory
cd backend

# Install dependencies (includes xlrd for legacy .xls, calamine for
# fast .xlsx reads, openpyxl as a fallback)
pip install -r requirements.txt

# Verify every Excel engine + every parser loaded cleanly.
# Prints a per-dependency report and exits non-zero if anything
# is missing — run this BEFORE the first server start.
python check_install.py

# Run the server
python main.py
# or use uvicorn directly:
uvicorn main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`

**API Documentation:** `http://localhost:8000/docs` (Swagger UI)

On startup the server logs which Excel engines were found, e.g.:

    [PQ] Excel engines: xlrd=OK, openpyxl=OK, calamine=OK, pyxlsb=MISSING

`pyxlsb` is optional (only needed for the rare `.xlsb` format). The
other three must all be `OK` for full upload support.

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# or
npm run serve

# Build for production
npm run build
```

The frontend will be available at `http://localhost:5173`

---

## Quick Test: End-to-End Flow

### 1. Create a Model

```bash
curl -X POST http://localhost:8000/api/config/models \
  -H "Content-Type: application/json" \
  -d '{"name": "Test_Hioki"}'
```

### 2. Inspect a Sample File

Upload `backend/fixtures/hioki_sample.csv`:

```bash
curl -X POST http://localhost:8000/api/config/models/Test_Hioki/inspect \
  -F "file=@backend/fixtures/hioki_sample.csv"
```

Expected response: File structure with detected columns and auto-mappings

### 3. Save Column Mappings

```bash
curl -X POST http://localhost:8000/api/config/models/Test_Hioki/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "Date": "timestamp",
      "URMS_L1": "voltage_phase_a",
      "IRMS_L1": "current_phase_a",
      "kW_3P": "kw",
      "PF_3P": "pf"
    }
  }'
```

### 4. Process a Data File

```bash
curl -X POST http://localhost:8000/api/upload/process \
  -F "file=@backend/fixtures/hioki_sample.csv" \
  -F "metadata={\"pq_analyzer_type\": \"hioki\", \"model_name\": \"Test_Hioki\"}"
```

Expected response: Processed data with session ID

### 5. Retrieve Normalized Data

```bash
curl http://localhost:8000/api/upload/session/{SESSION_ID}/table?page=1&page_size=50
```

---

## Project Structure

```
ai-power-quality-analyzer/
├── frontend/                          # React application
│   ├── src/
│   │   ├── pages/
│   │   │   └── ConfigPage.tsx        # Configuration & mapping page
│   │   ├── components/
│   │   │   ├── Loading3D.tsx         # Loading animation
│   │   │   ├── BlurText.tsx          # Blur text animation
│   │   │   └── FallingText.tsx       # Physics-based text animation
│   │   └── services/
│   │       └── configApi.ts          # API client for config
│   └── package.json
│
├── backend/                           # FastAPI application
│   ├── main.py                       # Application entry
│   ├── routes/
│   │   ├── config.py                 # Configuration API routes
│   │   ├── upload.py                 # File upload & processing
│   │   └── analytics.py              # Analytics routes
│   ├── parsers/
│   │   ├── hioki.py                  # Hioki device parser
│   │   ├── fluke.py                  # Fluke device parser
│   │   ├── alm.py                    # Schneider ALM parser
│   │   └── base.py                   # Base parser + standard columns
│   ├── ml/
│   │   └── normalizer.py             # ML-based normalization
│   ├── services/
│   │   ├── processing.py             # Main processing pipeline
│   │   ├── config_store.py           # Configuration persistence
│   │   └── session_store.py          # Session management
│   └── requirements.txt
│
├── sample file/                       # Sample data files
│   ├── sample_hioki_p3198.csv
│   ├── sample_alm_36.csv
│   └── ...
│
├── README_STANDARD_COLUMNS.md        # Standard columns reference
├── SYSTEM_INTEGRATION.md             # System architecture
├── VERIFICATION_CHECKLIST.md         # Verification guide
└── QUICK_START.md                    # This file
```

---

## Key Features

### ✅ Configuration Page Features

1. **Model Management**
   - Create new analyzer models
   - Save column mappings
   - Load previous configurations

2. **Column Mapping**
   - Auto-detection of 60+ standard columns
   - Manual mapping via dropdowns
   - Smart suggestions based on device type

3. **Custom Columns**
   - Add non-standard columns
   - Specify source sheet (multi-sheet files)
   - Map to custom names

4. **Harmonics Support**
   - 78 harmonic parameters (odd harmonics only)
   - Voltage harmonics: U12, U23, U31
   - Current harmonics: A1, A2, A3
   - Format: {PHASE}_%FH{ODD_NUMBER} (e.g., U12_%FH01, U12_%FH03...U12_%FH25)

### ✅ Data Processing

1. **Multi-Device Support**
   - Hioki PW3198, PW6001
   - Fluke 1735, 435-II
   - Schneider ALM-20, ALM-31, ALM-36, ALM-45
   - Generic CSV files

2. **Normalization Pipeline**
   - Scale detection (percentile-based)
   - Physical bounds clamping
   - Outlier detection (modified Z-score)
   - Gap interpolation (up to 5 consecutive NaNs)
   - Data quality scoring

3. **Session Management**
   - In-memory session storage
   - Data export to CSV
   - Pagination support (up to 500 rows/page)

---

## Standard Columns Reference

### 112 Total Columns

**Basic Measurements** (9)
- timestamp, voltage_phase_a/b/c, current_phase_a/b/c, frequency, pf

**Power Values** (6)
- kw, kva, kvar, nkvar, dkvar, dpf

**THD Parameters** (6)
- vthd_a/b/c, ithd_a/b/c

**Voltage Harmonics** (39)
- U12_%FH01-25 (odd), U23_%FH01-25 (odd), U31_%FH01-25 (odd)

**Current Harmonics** (39)
- A1_%FH01-25 (odd), A2_%FH01-25 (odd), A3_%FH01-25 (odd)

**Voltage RMS Min/Max** (6)
- Urms12_min/max, Urms23_min/max, Urms31_min/max

**Current RMS Min/Max** (6)
- Arms1_min/max, Arms2_min/max, Arms3_min/max

**Special** (1)
- NA (not available marker)

---

## Common Tasks

### Create a New Model and Save Configuration

1. **Frontend:** Click "Create Model" button
2. **Enter name:** e.g., "Plant_Main_Transformer"
3. **Upload sample file** from device
4. **Map columns:**
   - Auto-detection suggests mappings
   - Verify or adjust using dropdowns
   - Add custom columns if needed
5. **Save configuration**
   - Click "Save configuration" button
   - System stores mappings for future use

### Process a Data File

1. **Go to Upload page**
2. **Select model** with saved configuration
3. **Upload measurement file**
4. **System automatically:**
   - Detects device type
   - Applies saved column mappings
   - Normalizes data
   - Stores in session
5. **View and export:**
   - Browse table
   - Filter/sort data
   - Export to CSV

### Add Custom Column

1. **In Configuration page**
2. **Under "Custom Column Mapping":**
   - Select column from "Column name in file" dropdown
   - Select which sheet from "Source sheet" dropdown (auto-filtered)
   - Select standard column from "Maps to" dropdown
   - Click "Add"
3. **Custom column appears in table**
4. **Save configuration** - custom mappings persist

---

## API Quick Reference

### Configuration Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/config/models` | List all models |
| POST | `/api/config/models` | Create new model |
| DELETE | `/api/config/models/{name}` | Delete model |
| POST | `/api/config/models/{name}/inspect` | Inspect file & detect columns |
| GET | `/api/config/models/{name}/mappings` | Get saved mappings |
| POST | `/api/config/models/{name}/mappings` | Save column mappings |

### Processing Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/upload/process` | Process uploaded file |
| GET | `/api/upload/session/{id}/table` | Get normalized data |
| GET | `/api/upload/session/{id}/export.csv` | Export as CSV |

---

## Troubleshooting

### "No readable data found in file"
- File is empty or corrupted
- Format not recognized (use CSV, XLSX, XLS)
- No proper header row

**Solution:** Verify file is valid, try sample file first

### "Unmatched columns" warning
- Some columns couldn't be auto-detected
- Normal for custom or unusual column names

**Solution:** Manually map using dropdown or create custom mapping

### "Session expired"
- Data older than 24 hours
- Server restarted
- Session cleared

**Solution:** Re-upload file to create new session

### Frontend won't connect to backend
- Backend not running on port 8000
- CORS issue (check main.py middleware)
- Firewall blocking localhost

**Solution:** Start backend, check `localhost:8000/docs` directly

---

## Development Notes

### Adding Support for New Device Type

1. **Create parser:** `backend/parsers/new_device.py`
2. **Implement normalize()** method matching standard columns
3. **Update registry:** `backend/parsers/registry.py`
4. **Add detector logic:** `backend/parsers/detect.py`
5. **Test:** `backend/verify_system.py`

### Adding New Standard Column

1. **Update:** `backend/parsers/base.py` STANDARD_COLUMNS
2. **Update:** `frontend/src/pages/ConfigPage.tsx` STANDARD_COLS
3. **Update:** Physical bounds in `backend/ml/normalizer.py`
4. **Update:** Documentation in `README_STANDARD_COLUMNS.md`

### Modifying Column Mapping UI

1. **Edit:** `frontend/src/pages/ConfigPage.tsx`
2. **Update:** `frontend/src/services/configApi.ts` if API changes
3. **Test:** Configuration page with sample files
4. **Verify:** Mappings save and load correctly

---

## Performance Considerations

- **Max file size:** 500MB (system can handle 1M+ rows)
- **Normalization time:** ~2-5 seconds for 100k rows
- **Memory usage:** ~1GB for large files
- **Session storage:** In-memory (doesn't persist restart)
- **Max page size:** 500 rows per request

---

## Resources

- **API Docs:** http://localhost:8000/docs
- **Sample Files:** `backend/fixtures/` and `sample file/`
- **Configuration Examples:** `backend/config/models/`
- **Standard Columns:** `README_STANDARD_COLUMNS.md`
- **System Architecture:** `SYSTEM_INTEGRATION.md`
- **Verification Guide:** `VERIFICATION_CHECKLIST.md`

---

## Next Steps

1. ✅ Start backend: `python main.py`
2. ✅ Start frontend: `npm run dev`
3. ✅ Open browser: `http://localhost:5173`
4. ✅ Test with sample file: `backend/fixtures/hioki_sample.csv`
5. ✅ Follow verification checklist

**Happy analyzing! ⚡**

