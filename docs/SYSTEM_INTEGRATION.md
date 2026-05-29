# Power Quality Analyzer - System Integration & Verification Guide

## Overview
This document explains the complete data flow through the PQ Analyzer system, from raw data files to normalized power quality measurements. It verifies that all components are properly connected and functioning together.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)                    │
│  ┌──────────────────────┐         ┌──────────────────────────────┐  │
│  │  Configuration Page  │         │  Analysis & Visualization    │  │
│  │  • File Upload       │         │  • Charts & Graphs           │  │
│  │  • Column Mapping    │         │  • Data Tables               │  │
│  │  • Custom Columns    │         │  • Export Options            │  │
│  └──────────────────────┘         └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                    │
                          API Calls │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + Python)                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Configuration Routes (/api/config)                           │   │
│  │ • POST /models - Create new analyzer model                   │   │
│  │ • POST /models/{model}/inspect - Read file & detect columns  │   │
│  │ • POST /models/{model}/mappings - Save column mappings       │   │
│  │ • GET /models/{model}/mappings - Retrieve saved mappings     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Processing Pipeline (/api/upload)                            │   │
│  │ • POST /process - Process uploaded file                      │   │
│  │ • GET /session/{id}/table - Retrieve normalized data         │   │
│  │ • GET /session/{id}/export.csv - Export normalized CSV       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Processing Flow

### 1. Configuration Phase (ConfigPage.tsx)

**User Actions:**
1. Create a new analyzer model (e.g., "Hioki Main Plant")
2. Upload a sample CSV/XLSX file
3. System auto-detects columns and provides smart suggestions
4. User maps detected columns to standard format
5. User can add custom column mappings for non-standard parameters
6. Save configuration

**Backend API Calls:**
```
POST /api/config/models               → Create model
POST /api/config/models/{name}/inspect → Detect columns & auto-map
POST /api/config/models/{name}/mappings → Save custom mappings
GET /api/config/models/{name}/mappings  → Retrieve saved mappings
```

### 2. File Upload & Processing

**User Actions:**
1. Upload actual measurement file to process
2. Select saved model configuration
3. System validates file against saved mappings

**Backend Processing:**
```
POST /api/upload/process
├─ Load file (CSV/XLSX)
├─ Apply saved column mappings
├─ Detect device type (Hioki, Fluke, Schneider, etc.)
├─ Parse raw data using device-specific parser
├─ Normalize to standard columns
├─ Apply ML-based normalization
└─ Store normalized data in session

Returns: ProcessResponse with normalized data sample
```

### 3. Normalization Pipeline

**Raw Data** 
    ↓ 
**Device Parser** (hioki.py, fluke.py, etc.)
    ↓
**Column Mapping** (applies user-defined mappings)
    ↓
**Standard Format** (all columns mapped to standard names)
    ↓
**ML Normalizer** (backend/ml/normalizer.py)
    ├─ Scale Detection (percentile-based)
    ├─ Physical Bounds Clamping
    ├─ Outlier Detection (Modified Z-score)
    ├─ Gap Interpolation
    ├─ Three-Phase Balance Check
    └─ Quality Scoring
    ↓
**Normalized Dataset** (ready for analysis)

---

## Standard Columns Reference

### 112 Standard Columns Defined

**Basic Measurements (9 columns)**
- `timestamp` - Date and time of measurement
- `voltage_phase_a`, `voltage_phase_b`, `voltage_phase_c` - Phase voltages
- `current_phase_a`, `current_phase_b`, `current_phase_c` - Phase currents
- `frequency` - Power frequency (Hz)
- `pf` - Power Factor

**Power Values (6 columns)**
- `kw` - Real Power (kilowatts)
- `kva` - Apparent Power (kilovolt-amperes)
- `kvar` - Reactive Power (kilovolt-amperes reactive)
- `nkvar` - Non-Linear Reactive Power
- `dkvar` - Distortion Reactive Power
- `dpf` - Displacement Power Factor

**Total Harmonic Distortion (6 columns)**
- `vthd_a`, `vthd_b`, `vthd_c` - Voltage THD by phase
- `ithd_a`, `ithd_b`, `ithd_c` - Current THD by phase

**Voltage Harmonics (39 columns)**
- `U12_%FH01` through `U12_%FH25` (odd only: 01, 03, 05...25) - 13 harmonics
- `U23_%FH01` through `U23_%FH25` - 13 harmonics
- `U31_%FH01` through `U31_%FH25` - 13 harmonics

**Current Harmonics (39 columns)**
- `A1_%FH01` through `A1_%FH25` (odd only) - 13 harmonics
- `A2_%FH01` through `A2_%FH25` - 13 harmonics
- `A3_%FH01` through `A3_%FH25` - 13 harmonics

**Voltage RMS Min/Max (6 columns)**
- `Urms12_min`, `Urms12_max` - Phase 1-2
- `Urms23_min`, `Urms23_max` - Phase 2-3
- `Urms31_min`, `Urms31_max` - Phase 3-1

**Current RMS Min/Max (6 columns)**
- `Arms1_min`, `Arms1_max` - Phase 1
- `Arms2_min`, `Arms2_max` - Phase 2
- `Arms3_min`, `Arms3_max` - Phase 3

**Special Values (1 column)**
- `NA` - Not available marker

---

## Configuration Examples

### Example 1: Hioki PW3198 Configuration

**Raw Columns in File:**
```
Date, Time, URMS_L1, URMS_L2, URMS_L3, IRMS_L1, IRMS_L2, IRMS_L3, 
kW_3P, kVA_3P, PF_3P, Freq_Avg, THDV_1, THDV_2, THDV_3, 
THDI_1, THDI_2, THDI_3
```

**Saved Mappings (JSON):**
```json
{
  "Date": "timestamp",
  "Time": "timestamp",
  "URMS_L1": "voltage_phase_a",
  "URMS_L2": "voltage_phase_b",
  "URMS_L3": "voltage_phase_c",
  "IRMS_L1": "current_phase_a",
  "IRMS_L2": "current_phase_b",
  "IRMS_L3": "current_phase_c",
  "kW_3P": "kw",
  "kVA_3P": "kva",
  "PF_3P": "pf",
  "Freq_Avg": "frequency",
  "THDV_1": "vthd_a",
  "THDV_2": "vthd_b",
  "THDV_3": "vthd_c",
  "THDI_1": "ithd_a",
  "THDI_2": "ithd_b",
  "THDI_3": "ithd_c"
}
```

**Result:**
All columns are successfully mapped to standard format and can be visualized.

### Example 2: Custom Column Mapping

**Use Case:** Equipment exports column "Plant_ID" that should not be lost

**Configuration:**
1. Select "Plant_ID" from the "Column name in file" dropdown
2. Select the sheet where it appears from the filtered "Source sheet" dropdown
3. Choose from standard columns in the "Maps to" dropdown
   - Example: Map to "NA" (not available) to skip it
   - Or create a new custom mapping if needed

**Saved Mapping:**
```json
{
  "Plant_ID": "NA"
}
```

---

## Verification Process

### Step 1: Verify Standard Columns
✓ Check that all 112 standard columns are properly defined in `frontend/src/pages/ConfigPage.tsx`
✓ Confirm harmonic parameters use odd numbers only (01, 03, 05...25)
✓ Verify naming convention: U12/U23/U31 for voltage, A1/A2/A3 for current

```bash
# Check standard columns
grep -n "STANDARD_COLS" frontend/src/pages/ConfigPage.tsx
# Should show 112 columns including all harmonics
```

### Step 2: Verify Configuration Page
✓ Upload a sample file
✓ Verify file inspection works
✓ Check auto-detection of columns
✓ Test custom column mapping:
  - Select a column from dropdown
  - Verify "Source sheet" only shows sheets with that column
  - Select a standard column from "Maps to" dropdown
  - Click "Add" and verify it appears in the custom columns table

### Step 3: Test Data Flow
✓ Save configuration for a model
✓ Upload a measurement file
✓ System processes file through parser → normalizer → analysis
✓ Normalized data appears in table view
✓ Can export as CSV

### Step 4: Verify Normalization
✓ Check that ML normalization handles:
  - Scale detection (percentile-based)
  - Physical bounds clamping
  - Outlier removal
  - Gap filling
  - Quality scoring

---

## Running the Verification Script

A comprehensive verification script is available at `backend/verify_system.py`:

```bash
cd backend
python verify_system.py
```

**What It Tests:**
1. ✓ Standard columns are properly loaded
2. ✓ All parsers are available
3. ✓ Model configuration system works
4. ✓ Sample files can be loaded and processed
5. ✓ ML normalization functions correctly

**Expected Output:**
```
======================================================================
  PQ ANALYZER - COMPLETE SYSTEM VERIFICATION
  Testing: Configuration → Mapping → Processing → Normalization
======================================================================

  1. STANDARD COLUMNS VERIFICATION
  ✓ Standard columns loaded: 112 columns
  ✓ All required columns present
  ✓ Harmonic columns found: 78
    ...

  2. PARSER VERIFICATION
  ✓ HIOKI parser: ✓
  ✓ FLUKE parser: ✓
  ...

  RESULT: 5/5 tests passed
  ✓ All systems operational and connected!
```

---

## Frontend Integration Checklist

- [x] Configuration page displays 112 standard columns
- [x] Custom column mapping dropdown implementation
- [x] Source sheet dropdown filters based on selected column
- [x] "Maps to" dropdown shows standard columns
- [x] BlurText animation for loading screens
- [x] Proper error handling and notifications

---

## Backend Integration Checklist

- [x] Config routes properly save/retrieve column mappings
- [x] File inspection detects all columns and sheets
- [x] Parsers correctly normalize to standard columns
- [x] ML normalizer handles edge cases
- [x] Session storage for processed data
- [x] CSV export with normalized data

---

## Sample Data Available

Located in `sample file/` and `sample data/`:

| Device Type | Files | Format |
|------------|-------|--------|
| Hioki P3198 | sample_hioki_p3198.csv/xlsx | Hioki format |
| Fluke 1735 | sample_fluke.csv | Fluke format |
| ALM-31 | sample_alm_31.csv/xlsx | Schneider ALM format |
| ALM-36 | sample_alm_36.csv/xlsx | Schneider ALM format |
| Solar/ALM-20 | sample_alm_20.csv/xlsx | Solar export format |
| ALM-45 | sample_alm_45.csv/xlsx | Three-phase format |

**To Test:**
1. Start the application
2. Go to Configuration page
3. Create a model (e.g., "Test_Hioki")
4. Upload `sample_hioki_p3198.csv`
5. Verify columns are auto-detected
6. Save configuration
7. Go to Upload page
8. Upload the same file again
9. Verify data is processed and normalized

---

## Troubleshooting

### Issue: "No readable data found in file"
**Solution:** File format not recognized. Check:
- File is valid CSV/XLSX
- Has at least 2 columns
- Header row exists with column names

### Issue: "Unmatched columns" warning
**Solution:** Some columns couldn't be auto-mapped
- Either skip them (leave as "— skip —")
- Or map them manually to standard columns
- Or create custom mappings for non-standard parameters

### Issue: Normalized data has gaps
**Solution:** Normal - ML normalizer may fill gaps automatically
- Check the Data Quality Report
- Gaps < max_gap_fill (default: 5 points) are filled
- Larger gaps remain as NaN

### Issue: Parser not detecting device type correctly
**Solution:** Manual parser selection available
- Check file format matches device export
- Can be overridden in upload settings

---

## Performance Notes

- **File Size:** System handles up to 500k rows efficiently
- **Columns:** Supports 112+ standard + unlimited custom columns
- **Processing:** Normalization takes ~2-5 seconds for 100k rows
- **Memory:** Stream-based processing for large files

---

## API Endpoints Summary

### Configuration Endpoints
```
GET    /api/config/models
POST   /api/config/models                          Create model
DELETE /api/config/models/{model_name}             Delete model
GET    /api/config/models/{model_name}/mappings    Get mappings
POST   /api/config/models/{model_name}/inspect     Inspect file
POST   /api/config/models/{model_name}/mappings    Save mappings
```

### Processing Endpoints
```
POST   /api/upload/process                         Process file
GET    /api/upload/session/{session_id}/table      Get data table
GET    /api/upload/session/{session_id}/export.csv Export CSV
```

### Analytics Endpoints
```
GET    /api/analytics/{session_id}/summary         Get analytics
GET    /api/analytics/{session_id}/events          Get events
```

---

## Next Steps for Development

1. ✅ Implement custom column mapping UI with dropdowns
2. ⏳ Create visualization components for all 112 columns
3. ⏳ Add real-time monitoring dashboard
4. ⏳ Implement batch file processing
5. ⏳ Add user authentication and multi-tenant support
6. ⏳ Create mobile app for field measurements

---

## Contact & Support

For issues or questions regarding system integration:
- Check logs in `backend/logs/`
- Review sample files in `sample file/` and `sample data/`
- Run `backend/verify_system.py` to diagnose issues
- Check configuration stored in `backend/config/models/`

