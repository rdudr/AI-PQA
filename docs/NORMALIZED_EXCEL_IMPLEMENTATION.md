# Normalized Excel Download Implementation

## Overview

Implemented a complete backend-to-frontend feature allowing users to download normalized Excel files with only mapped columns, using standardized column names.

---

## What Was Implemented

### Backend Changes

#### 1. New API Endpoint: `/api/upload/models/{model_name}/normalized-excel`

**Location:** `backend/routes/upload.py`

**Method:** POST

**Parameters:**
- `model_name` (path parameter): Name of the configured PQ model
- `file` (form data): The data file to process

**Returns:** Excel file (.xlsx) download

**Error Handling:**
- 400 Bad Request: If no mappings exist for the model
- 400 Bad Request: If file is empty
- 400 Bad Request: If no readable data found
- 500 Internal Server Error: If Excel generation fails

#### 2. Helper Functions

**`_read_all_pages_for_mapping(filename: str, raw: bytes) -> list[dict]`**

Reads CSV and Excel files, returning a list of dicts with:
- `sheet_name`: Name of the sheet or "CSV"
- `df`: Processed pandas DataFrame

Supports:
- CSV files (single sheet)
- Excel files (.xlsx, .xls) with multiple sheets
- Automatic header detection via `prepare_tabular_export()`

**`_apply_mappings_to_dataframe(pages: list[dict], mappings: dict[str, str]) -> pd.DataFrame`**

Applies saved mappings to create normalized DataFrame:

1. Creates lookup of raw_column -> (standard_name, sheet_name)
2. Extracts data from correct sheets
3. Renames columns to standard names
4. Pads all columns to same length
5. Attempts numeric conversion where possible
6. Returns clean DataFrame ready for Excel

**Key Features:**
- Only includes mapped columns
- Excludes unmapped and skipped columns
- Handles multi-sheet files correctly
- Preserves data types (numeric conversion)
- Handles NA values gracefully

---

### Frontend Changes

#### 1. Updated UploadPage.tsx

**New Imports:**
```typescript
import { Download } from 'lucide-react'  // Download icon
```

**New State:**
```typescript
const [downloadingExcel, setDownloadingExcel] = useState(false)
```

**New Function: `downloadNormalizedExcel()`**

Handles:
- File validation (must have file selected)
- Model validation (must have model selected)
- API call to normalized-excel endpoint
- Response handling with filename extraction
- Blob download via temporary link creation
- Error notifications
- Success notifications

**New UI Section:**
```
┌────────────────────────────────────┐
│ 📥 Download Normalized Excel       │
├────────────────────────────────────┤
│ Export only mapped columns with    │
│ standardized names, ready for      │
│ graphs and analysis.               │
│                                    │
│ [Download Normalized Excel] ▼      │
└────────────────────────────────────┘
```

**Visibility:**
- Shows only when:
  - File is selected
  - Selected model has configuration
  - Not currently processing upload

**Appearance:**
- Green themed card (emerald-50 background)
- Appears with fade-in animation
- Disabled while downloading
- Shows "Generating..." text while loading

---

## How It Works: Step-by-Step

### 1. Configuration Phase (ConfigPage)
```
User maps columns: URMS_L1 → voltage_phase_a, etc.
↓
Mappings saved to: backend/config/mappings/{model_name}.json
↓
Example mapping file:
{
  "URMS_L1": "voltage_phase_a",
  "URMS_L2": "voltage_phase_b",
  "Equipment_ID": "NA",
  "Reserved_001": "— skip —"
}
```

### 2. Upload Phase (UploadPage)
```
User selects file and model
↓
If model has mappings:
  → Green "Download Normalized Excel" section appears
↓
User clicks download button
```

### 3. Backend Processing
```
POST /api/upload/models/{model_name}/normalized-excel

1. Get mappings for model_name
   ↓ (Error if no mappings)

2. Read uploaded file
   ↓ (Handle CSV and Excel)

3. Parse all sheets/pages
   ↓ (Use prepare_tabular_export for header detection)

4. Apply mappings
   - Find each mapped column in source
   - Rename to standard name
   - Exclude unmapped columns
   - Exclude skipped columns ("— skip —")
   - Include NA columns with empty values
   ↓

5. Create Excel file in memory
   - Single "Data" sheet
   - Headers with standard names
   - All data rows
   ↓

6. Return as download
   - Filename: pq_data_normalized_{timestamp}.xlsx
   - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

### 4. Frontend Download
```
Browser receives Excel file
↓
Extract filename from Content-Disposition header
↓
Create blob from response
↓
Generate temporary download link
↓
Trigger download
↓
Cleanup resources
↓
Show success notification
```

---

## File Format

### Excel Output Structure

**File Name:** `pq_data_normalized_{YYYYMMDD_HHMMSS}.xlsx`

**Sheet Name:** "Data"

**Columns:**
- Header row with standardized column names
- One column per mapped assignment
- Columns in order: Data columns first, then NA columns

**Data:**
- All rows from source file
- Preserved data types (numeric, text, etc.)
- NA values handled gracefully
- No index column

### Example Output

```
voltage_phase_a | voltage_phase_b | current_phase_a | kw | Equipment_ID
────────────────────────────────────────────────────────────────────
230.1           | 231.2           | 10.2            | 5.1 | UNIT_001
230.3           | 231.5           | 10.4            | 5.2 | UNIT_001
229.5           | 230.8           | 10.1            | 4.9 | UNIT_001
... (all rows)
```

---

## Column Categories in Output

### 1. Data Columns (Assigned)
- Columns mapped to standard names
- Example: URMS_L1 → voltage_phase_a
- Contains: Real measurements
- Count: ~67 (user's assignment count)

### 2. NA Columns (Metadata)
- Columns set to "NA" in mappings
- Example: Equipment_ID → NA
- Contains: NA/marker values (blank)
- Count: Variable (user-configured)
- Use: Identification and tracking

### 3. Skipped Columns
- Columns set to "— skip —"
- **NOT included in output**
- Completely excluded from Excel
- Count: Variable (excluded columns)

---

## API Usage Example

### Request
```bash
curl -X POST \
  "http://localhost:8000/api/upload/models/Hioki/normalized-excel" \
  -F "file=@data.csv"
```

### Response Headers
```
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="pq_data_normalized_20260520_143045.xlsx"
```

### Error Response (No Mappings)
```json
{
  "detail": "No mappings found for model 'Hioki'. Configure mappings first."
}
```

### Error Response (Empty File)
```json
{
  "detail": "Empty upload."
}
```

---

## Testing Checklist

### Unit Tests (Backend)

- [ ] `_read_all_pages_for_mapping()` with CSV file
- [ ] `_read_all_pages_for_mapping()` with Excel file
- [ ] `_read_all_pages_for_mapping()` with multiple sheets
- [ ] `_apply_mappings_to_dataframe()` with basic mappings
- [ ] `_apply_mappings_to_dataframe()` with NA columns
- [ ] `_apply_mappings_to_dataframe()` with skipped columns
- [ ] Endpoint with valid mappings
- [ ] Endpoint with no mappings (error)
- [ ] Endpoint with empty file (error)
- [ ] Endpoint with invalid model name
- [ ] Numeric column conversion
- [ ] Row count preservation

### Integration Tests (Frontend)

- [ ] Download button appears when model has config
- [ ] Download button hidden when model has no config
- [ ] Download button disabled while downloading
- [ ] Success notification on download
- [ ] Error notification on failure
- [ ] Filename matches expected pattern
- [ ] Excel file is readable in Excel/Google Sheets

### End-to-End Tests

- [ ] Configure mappings for Hioki model
- [ ] Upload 532-column CSV file
- [ ] Download normalized Excel
- [ ] Verify only 67+ mapped columns in output
- [ ] Verify unmapped columns excluded
- [ ] Verify standardized column names
- [ ] Open downloaded file in Excel
- [ ] Verify data integrity
- [ ] Test with different file formats (CSV, XLSX)
- [ ] Test with multi-sheet Excel file

---

## Known Limitations

1. **File Size:** Large files may take time to process
2. **Memory:** Very large files (1GB+) may cause memory issues
3. **Sheet Selection:** Always reads all sheets; users cannot cherry-pick sheets
4. **Column Order:** Output order is based on data discovery order
5. **Concurrent Downloads:** No rate limiting on API

---

## Future Enhancements

1. **Progress Indication:** Show progress for large file processing
2. **Scheduled Downloads:** Queue downloads for very large files
3. **Multiple Sheets:** Allow users to choose which sheets to include
4. **Data Filtering:** Pre-download filters (date range, value thresholds)
5. **Format Options:** Allow CSV, Parquet output in addition to Excel
6. **Compression:** Gzip compress large Excel files
7. **Validation Report:** Include data quality report in separate sheet
8. **Caching:** Cache downloaded files for quick re-downloads

---

## Technical Details

### Dependencies Used

- **pandas:** DataFrame operations, Excel writing
- **openpyxl:** Excel file generation
- **FastAPI:** HTTP endpoints
- **React:** UI components

### File Paths

**Backend:**
- Main endpoint: `backend/routes/upload.py`
- Config storage: `backend/config/mappings/{model_name}.json`
- Services: `backend/services/config_store.py`

**Frontend:**
- Upload page: `frontend/src/pages/UploadPage.tsx`
- No new components needed

### Data Flow

```
CSV/Excel File
    ↓
Frontend: UploadPage.tsx
    ↓
POST /api/upload/models/{model_name}/normalized-excel
    ↓
Backend: routes/upload.py
    ├─ Read file (_read_all_pages_for_mapping)
    ├─ Get mappings (config_store.get_mappings)
    ├─ Apply mappings (_apply_mappings_to_dataframe)
    └─ Generate Excel (pd.ExcelWriter)
    ↓
Excel File (.xlsx)
    ↓
Frontend: Download via browser
    ↓
User's Downloads folder
```

---

## Troubleshooting

### Issue: "No mappings found for model"
**Cause:** Model hasn't been configured yet
**Solution:** Go to ConfigPage and create mappings

### Issue: "No readable data found in file"
**Cause:** File format not recognized or corrupted
**Solution:** Verify file is valid CSV or Excel

### Issue: Download appears but file is empty
**Cause:** No columns were actually mapped
**Solution:** Check mappings - must have at least one column assigned

### Issue: Column names are wrong in output
**Cause:** Mappings not saved properly
**Solution:** Verify mappings on ConfigPage, save again

### Issue: Some data missing in Excel
**Cause:** Columns have different row counts
**Solution:** Padding handles this automatically, check source data

---

## Summary

The normalized Excel download feature provides users with a clean, processed data export containing only the columns they've configured, with standardized names ready for immediate use in graphs, analysis, and reporting tools.

**Key Benefits:**
- ✅ Only exports necessary columns
- ✅ Automatic standardization
- ✅ Preserves data integrity
- ✅ Easy integration with analysis tools
- ✅ No manual data cleaning needed
- ✅ Ready for Power BI, Python, Excel charts

