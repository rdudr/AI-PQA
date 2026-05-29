# System Verification Checklist

Complete this checklist to verify all components of the Power Quality Analyzer are working correctly and connected together.

---

## Prerequisites ✓

- [ ] Node.js and npm installed (frontend)
- [ ] Python 3.9+ installed (backend)
- [ ] Backend dependencies installed: `pip install -r requirements.txt`
- [ ] Frontend dependencies installed: `npm install` (in frontend directory)
- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:5173` (or configured port)

---

## Phase 1: Configuration Page Verification

### 1.1 Standard Columns Display
**Test:** Configuration page shows all standard columns
```
✓ Action: Go to http://localhost:5173/config
✓ Create a new model (e.g., "TEST_VERIFY_01")
✓ Verify page loads with description
✓ Verify "Maps to" dropdown is available
```

**Expected Results:**
- [ ] Configuration page loads without errors
- [ ] All 112 standard columns appear in "Maps to" dropdown
- [ ] Columns appear in alphabetical order
- [ ] Special "NA" option available for unmapped columns

### 1.2 File Upload & Detection
**Test:** File upload and column detection works
```
✓ Action: Upload a sample file (e.g., sample_hioki_p3198.csv)
✓ Browser shows file inspection progress
✓ File loads and shows detected columns
```

**Expected Results:**
- [ ] File accepted (CSV/XLSX)
- [ ] Shows "Analyzing file structure..." loading message
- [ ] Columns detected and displayed in table
- [ ] Sample values shown for each column
- [ ] Sheet names displayed correctly

### 1.3 Auto-Detection & Mapping
**Test:** System auto-detects and suggests mappings
```
✓ Verify "Match source" column shows:
   - "auto" for auto-detected columns
   - "unmatched" for columns that need manual mapping
   - "saved" for previously saved mappings
```

**Expected Results:**
- [ ] Most common columns are auto-mapped (timestamp, voltage, current, etc.)
- [ ] Columns show appropriate match badges
- [ ] Color-coded status (green=auto, orange=unmatched, emerald=saved)

### 1.4 Column Mapping - Text Input (Original)
**Test:** Manual mapping still works
```
✓ Find an "unmatched" column
✓ Click its "Maps to" dropdown
✓ Select a standard column (e.g., "voltage_phase_a")
✓ Verify status changes to "assigned"
```

**Expected Results:**
- [ ] Dropdown shows all 112 standard columns
- [ ] Selected mapping is applied
- [ ] Status badge updates to show "assigned"

### 1.5 Source Sheet Selection
**Test:** Source sheet dropdown appears when needed
```
✓ In the "Source Page" column, for a mapped column:
✓ Click the dropdown
✓ Verify it shows available sheets from the file
```

**Expected Results:**
- [ ] Dropdown appears for mapped columns
- [ ] Shows all sheets found in file
- [ ] Can be left as "— any page —"
- [ ] Each sheet is selectable

### 1.6 Custom Column Mapping - Part 1: Column Name Dropdown
**Test:** Custom column mapping section with column dropdown
```
✓ Scroll to "Custom Column Mapping" section (below mapping table)
✓ Click "Column name in file" field
✓ Verify it's a dropdown (NOT a text input)
```

**Expected Results:**
- [ ] Field shows "— select column —" placeholder
- [ ] Dropdown opens showing all detected columns
- [ ] All column names from file are listed

### 1.7 Custom Column Mapping - Part 2: Sheet Filtering
**Test:** Source sheet dropdown only shows relevant sheets
```
✓ Select a column from the "Column name in file" dropdown (e.g., "timestamp")
✓ Click "Source sheet" dropdown
✓ Verify it ONLY shows sheets containing that column
```

**Expected Results:**
- [ ] Sheet dropdown enables after column selection
- [ ] Only shows sheets where selected column exists
- [ ] If column is in all sheets, all sheets shown
- [ ] If column is in only 1 sheet, only that sheet shown
- [ ] Selecting different column updates sheet list dynamically

### 1.8 Custom Column Mapping - Part 3: Maps To Dropdown
**Test:** Maps to uses dropdown with standard columns
```
✓ Select a column name
✓ Select a source sheet
✓ Click "Maps to" field
✓ Verify it's a dropdown (NOT a text input)
```

**Expected Results:**
- [ ] Field shows "— select standard column —" placeholder
- [ ] Dropdown opens showing all 112 standard columns
- [ ] "NA (not available)" option appears first
- [ ] All standard columns listed alphabetically
- [ ] Including all 78 harmonic columns (U12, U23, U31, A1, A2, A3)

### 1.9 Custom Column Mapping - Part 4: Add Custom Column
**Test:** Add button works and custom column appears in list
```
✓ Fill all three fields:
   - Column name: "Plant_ID" (or any detected column)
   - Source sheet: Select a sheet
   - Maps to: Select "NA" or a standard column
✓ Click "Add" button
✓ Look for custom columns table below
```

**Expected Results:**
- [ ] Validates that all fields are filled (shows warning if not)
- [ ] Custom column appears in table below
- [ ] Table shows: Column Name | Sheet | Maps To | Remove
- [ ] "Remove" button deletes the mapping
- [ ] Success notification appears

### 1.10 Custom Column Mapping - Part 5: Multiple Custom Columns
**Test:** Can add multiple custom mappings
```
✓ Add another custom column
✓ Then another (minimum 3 total)
✓ Verify all appear in table
✓ Test removing one from the middle
```

**Expected Results:**
- [ ] Multiple custom columns can be added
- [ ] Each appears as a row in the table
- [ ] Can remove any individual row
- [ ] Remaining rows stay intact

---

## Phase 2: Data Processing Flow Verification

### 2.1 Configuration Save
**Test:** Saving configuration works
```
✓ In the mapping table, map at least these columns:
   - Any timestamp → "timestamp"
   - Any voltage → "voltage_phase_a"
   - Any current → "current_phase_a"
✓ Add 1-2 custom column mappings
✓ Scroll down and click "Save configuration"
✓ Wait for "Saved — redirecting…" message
```

**Expected Results:**
- [ ] Loading overlay appears ("Saving configuration...")
- [ ] Configuration saved successfully
- [ ] Redirects to Upload page after ~1.2 seconds
- [ ] Notification shows "Configuration saved"

### 2.2 Configuration Verification
**Test:** Saved configuration is retrievable
```
✓ Go back to Configuration page
✓ Select same model
✓ Upload same file again
✓ Verify previous mappings are pre-filled
```

**Expected Results:**
- [ ] Previously saved mappings appear in "Maps to" dropdowns
- [ ] Status shows "saved" instead of "auto"
- [ ] Custom mappings are preserved

### 2.3 Data Upload & Processing
**Test:** File processing pipeline works
```
✓ Go to Upload page
✓ Select same model
✓ Upload the sample file again
✓ System processes and normalizes data
```

**Expected Results:**
- [ ] File accepted and processing starts
- [ ] "Processing..." overlay appears
- [ ] Processing completes in reasonable time (2-5 seconds)
- [ ] Data appears in table view

### 2.4 Normalized Data Display
**Test:** Normalized data is properly formatted
```
✓ In table view, verify data:
   - Timestamp format: YYYY-MM-DD HH:MM:SS
   - Numeric values properly formatted
   - No broken columns
```

**Expected Results:**
- [ ] All mapped columns appear
- [ ] Data types are correct
- [ ] Numeric values display with reasonable precision
- [ ] Missing values shown as empty or "—"

### 2.5 Data Export
**Test:** Export normalized data as CSV
```
✓ Click export button
✓ CSV file downloads (pq_normalized_*.csv)
✓ Open CSV and verify contents
```

**Expected Results:**
- [ ] CSV downloads successfully
- [ ] Filename includes session ID
- [ ] File contains all normalized columns
- [ ] Data matches table display

---

## Phase 3: Harmonic Parameters Verification

### 3.1 Harmonic Column Count
**Test:** All 78 harmonic columns are available
```
✓ In custom column mapping "Maps to" dropdown
✓ Count harmonic columns:
   - U12_*: 13 columns (U12_%FH01, U12_%FH03...U12_%FH25)
   - U23_*: 13 columns
   - U31_*: 13 columns
   - A1_*: 13 columns
   - A2_*: 13 columns
   - A3_*: 13 columns
```

**Expected Results:**
- [ ] U12 harmonics: All 13 odd-numbered harmonics (01, 03, 05, 07, 09, 11, 13, 15, 17, 19, 21, 23, 25)
- [ ] U23 harmonics: All 13 odd-numbered harmonics
- [ ] U31 harmonics: All 13 odd-numbered harmonics
- [ ] A1 harmonics: All 13 odd-numbered harmonics
- [ ] A2 harmonics: All 13 odd-numbered harmonics
- [ ] A3 harmonics: All 13 odd-numbered harmonics
- [ ] Total harmonic columns: 78

### 3.2 Harmonic Naming Convention
**Test:** Harmonic names follow correct format
```
✓ Check a few harmonic column names:
   - Format: {PHASE}_{PERCENTAGE_OF_FUNDAMENTAL}{ODD_NUMBER}
   - Examples:
     - U12_%FH01 (fundamental)
     - U12_%FH03 (3rd harmonic)
     - U12_%FH25 (25th harmonic)
```

**Expected Results:**
- [ ] All voltage harmonics: U12_, U23_, U31_ prefix
- [ ] All current harmonics: A1_, A2_, A3_ prefix
- [ ] All use _%FH format
- [ ] All use zero-padded two-digit numbers (01, 03, 05...25)
- [ ] Only odd harmonics present (no even harmonics)

### 3.3 Zero-Padding Verification
**Test:** Harmonic numbers are zero-padded
```
✓ Verify samples:
   - NOT "U12_%FH1" but "U12_%FH01" ✓
   - NOT "U12_%FH3" but "U12_%FH03" ✓
   - NOT "A1_%FH25" but "A1_%FH25" ✓ (already 2 digits)
```

**Expected Results:**
- [ ] All harmonic indices use exactly 2 digits
- [ ] Numbers 01-09 have leading zeros
- [ ] Numbers 10-25 are two digits naturally
- [ ] All harmonics follow same format consistently

---

## Phase 4: Component Integration Verification

### 4.1 BlurText Animation (Loading Screen)
**Test:** Blur text animation works during processing
```
✓ Trigger a file upload/processing
✓ Watch the "Processing..." overlay
✓ Observe text animation
```

**Expected Results:**
- [ ] Loading spinner with rotating rings appears
- [ ] Message shows "Processing..." or similar
- [ ] Energy-saving quote appears with blur-to-clear animation
- [ ] Quote changes on each page load
- [ ] Animation is smooth and not janky

### 4.2 Loading Screen Quote Rotation
**Test:** Different quotes appear each load
```
✓ Process a file multiple times
✓ Note the quote shown each time
✓ Process again
✓ Verify quote is different
```

**Expected Results:**
- [ ] Each processing shows a random quote
- [ ] At least 20+ different quotes available
- [ ] Quotes are energy-saving/power quality related
- [ ] No quote repeats unless loading many times

### 4.3 Error Handling
**Test:** Error messages display properly
```
✓ Try invalid actions:
   - Upload unsupported file type
   - Try to save without mapping
   - Upload empty file
```

**Expected Results:**
- [ ] Clear error messages appear
- [ ] Helpful guidance provided
- [ ] User can recover and retry
- [ ] No system crashes

### 4.4 Notification System
**Test:** Notifications work for different states
```
✓ Observe notifications for:
   - File upload success/failure
   - Configuration save success
   - Unmatched columns warnings
   - Data processing status
```

**Expected Results:**
- [ ] Success notifications (green) show for completed actions
- [ ] Warning notifications (yellow/orange) for unmatched columns
- [ ] Error notifications (red) for failures
- [ ] Auto-dismiss after reasonable time
- [ ] Multiple notifications can queue

---

## Phase 5: End-to-End Workflow Verification

### 5.1 Complete Workflow Test 1: Hioki File
**Test:** Full process with Hioki sample file
```
Steps:
1. Create model: "E2E_Test_Hioki"
2. Upload: sample_hioki_p3198.csv
3. Verify auto-detection works
4. Add 1 custom column mapping
5. Save configuration
6. Upload same file from Upload page
7. Verify data is normalized and displayed
8. Export as CSV
9. Verify exported file contains all columns
```

**Expected Results:**
- [ ] All steps complete without errors
- [ ] Data shows realistic power quality measurements
- [ ] Exported CSV matches display

### 5.2 Complete Workflow Test 2: Multi-Sheet Excel File
**Test:** Full process with Excel file
```
Steps:
1. Create model: "E2E_Test_Excel"
2. Upload: sample_alm_36.xlsx
3. Inspect all sheets
4. Map columns from multiple sheets
5. Use "Source Page" selection for sheet-specific columns
6. Add custom columns
7. Save configuration
8. Upload and verify processing
```

**Expected Results:**
- [ ] Multi-sheet detection works
- [ ] Can map columns from different sheets
- [ ] Source page selection shows correct sheets per column
- [ ] Data processes and displays correctly

### 5.3 Complete Workflow Test 3: Custom Columns Only
**Test:** File with all custom columns
```
Steps:
1. Create model: "E2E_Test_Custom"
2. Upload a file
3. For EACH detected column, add custom mapping:
   - Select column from dropdown
   - Select sheet from filtered dropdown
   - Select standard column from dropdown
   - Click Add
4. Verify all custom columns in table
5. Save configuration
6. Upload file again - verify mappings persisted
```

**Expected Results:**
- [ ] All columns properly mapped via custom mappings
- [ ] Configuration persists between sessions
- [ ] File processes correctly with custom mappings

---

## Phase 6: Data Quality Verification

### 6.1 Normalization Quality
**Test:** Normalized data has expected characteristics
```
✓ Check normalized data:
   - Voltages: 200-250V range (reasonable for 230V system)
   - Currents: Positive values, within equipment specs
   - Power Factor: -1 to +1 range
   - Frequency: 45-65 Hz range
   - THD: 0-100% range
```

**Expected Results:**
- [ ] All values within physical bounds
- [ ] No extreme outliers
- [ ] Data makes physical sense

### 6.2 Missing Data Handling
**Test:** System handles missing/null values
```
✓ Check for:
   - Proper representation of missing values
   - No NaN or undefined in display
   - Graceful degradation if column missing
```

**Expected Results:**
- [ ] Missing values shown consistently
- [ ] No errors from null values
- [ ] Display doesn't break with sparse data

### 6.3 Data Consistency
**Test:** Three-phase data is balanced
```
✓ Check voltage phases:
   - Phase A, B, C should be similar (±5% or so)
✓ Check current phases:
   - Should be balanced unless load is unbalanced
```

**Expected Results:**
- [ ] Phase voltages within reasonable balance
- [ ] No obvious phase ordering errors
- [ ] Data patterns make physical sense

---

## Phase 7: System Connectivity Verification

### 7.1 Frontend ↔ Backend Communication
**Test:** API calls work correctly
```
✓ Open browser DevTools (F12)
✓ Go to Network tab
✓ Perform actions:
   - Create model → POST /api/config/models ✓
   - Upload file → POST /api/config/models/{name}/inspect ✓
   - Save config → POST /api/config/models/{name}/mappings ✓
   - Upload data → POST /api/upload/process ✓
   - Get table → GET /api/upload/session/{id}/table ✓
```

**Expected Results:**
- [ ] All API calls return 200 OK
- [ ] Response times reasonable (< 5 seconds)
- [ ] No CORS errors
- [ ] No 404 or 500 errors
- [ ] Request/response data matches contract

### 7.2 Session Persistence
**Test:** Session data persists across requests
```
✓ Process a file
✓ Get session ID from URL (session/{id}/table)
✓ Refresh page
✓ Session data still available
✓ Can scroll through table pages
```

**Expected Results:**
- [ ] Session data available after refresh
- [ ] Can retrieve multiple pages of data
- [ ] Session doesn't expire immediately
- [ ] Data consistent across requests

### 7.3 Configuration Persistence
**Test:** Saved configurations persist
```
✓ Create and save model configuration
✓ Restart frontend/backend (in development)
✓ Load same model again
✓ Verify mappings are still there
```

**Expected Results:**
- [ ] Configuration file saved to disk
- [ ] Persists across restarts
- [ ] Can load previous configurations

---

## Phase 8: Performance Verification

### 8.1 File Upload Performance
**Test:** Large file handling
```
✓ Upload small file (< 1MB): Should be instant
✓ Upload medium file (1-10MB): Should be < 2 seconds
✓ Upload large file (10-100MB): Should be < 10 seconds
```

**Expected Results:**
- [ ] Files upload and process efficiently
- [ ] No memory errors
- [ ] UI remains responsive
- [ ] Progress indicator works

### 8.2 Data Display Performance
**Test:** Table with many rows displays smoothly
```
✓ Process file with 5000+ rows
✓ Scroll through table
✓ Use search/filter
✓ Check responsiveness
```

**Expected Results:**
- [ ] Table renders quickly
- [ ] Scrolling is smooth (no lag)
- [ ] Filtering doesn't cause freezing
- [ ] Export completes in reasonable time

---

## Final Sign-Off

### Summary Results

| Component | Status | Notes |
|-----------|--------|-------|
| Standard Columns Display | ✓ / ✗ | 112 columns available |
| Column Auto-Detection | ✓ / ✗ | Parser detection works |
| Custom Column Mapping | ✓ / ✗ | Dropdowns and filtering working |
| Configuration Save/Load | ✓ / ✗ | Persistence verified |
| Data Processing | ✓ / ✗ | Normalization pipeline works |
| Harmonic Parameters | ✓ / ✗ | 78 harmonics available (odd only) |
| API Communication | ✓ / ✗ | Frontend ↔ Backend working |
| Data Quality | ✓ / ✗ | Realistic values within bounds |
| Performance | ✓ / ✗ | Responsive and fast |

### Overall System Status

**Total Tests: _____ / Passed: _____ / Failed: _____**

**System Ready for Production: ✓ / ✗**

---

## Issues Found & Resolution

| Issue | Severity | Resolution | Verified |
|-------|----------|-----------|----------|
| | | | |

---

## Sign-Off

- **Tested By:** ___________________
- **Date:** ___________________
- **Approved By:** ___________________
- **Notes:** ___________________

