# Normalized Excel Download Guide

## Overview

After saving your column mappings, you can download a **Normalized Excel file** containing only the mapped columns with standardized names, ready for graphs and analysis.

---

## What is a Normalized Excel File?

A normalized Excel file is a cleaned, standardized version of your raw data:

### Before (Raw Data from Device)
```
File: data.csv (532 columns)
├─ URMS_L1     → voltage_phase_a (mapped)
├─ IRMS_L1     → current_phase_a (mapped)
├─ kW_3P       → kw (mapped)
├─ Equipment_ID → NA (metadata)
├─ Temp_Sensor → SKIPPED ✗
├─ Reserved_1  → SKIPPED ✗
├─ Reserved_2  → SKIPPED ✗
└─ ... 525 more columns

Output: 67 mapped + 465 unmapped
```

### After (Normalized Excel)
```
File: pq_data_normalized.xlsx (69 columns)
├─ voltage_phase_a    (real data)
├─ current_phase_a    (real data)
├─ kw                 (real data)
├─ Equipment_ID       (marker/NA)
└─ 65 more columns

Only useful data included
Standardized column names
Ready for graphs!
```

---

## Workflow: From Raw Data to Download

### Step 1: Create Configuration
```
1. Upload sample file (532 columns detected)
2. Configure mappings:
   - Auto-detect assigns 67 columns
   - Manually assign 300 more
   - Skip 165 not needed
   Total: 67 + 300 = 367 mapped
3. Save configuration
```

### Step 2: Upload Data File
```
1. Go to Upload page
2. Select same model
3. Upload measurement file
4. System processes:
   - Reads all 532 columns
   - Applies your mappings
   - Creates normalized version
5. See "Download Normalized Data" button
```

### Step 3: Download Excel
```
1. Click "Download Normalized Excel"
2. File downloads: pq_data_normalized.xlsx
3. Contains:
   - 367 columns (mapped only)
   - All rows from original file
   - Standardized names
   - Ready for graphs!
```

---

## Mapping Summary (Configuration Page)

### New Section Shows:

**1. Mapping Details Table**
```
File Column    | Sheet | Maps to (Standard)  | Type
────────────────────────────────────────────────────
URMS_L1        | CSV   | voltage_phase_a    | Data
IRMS_L1        | CSV   | current_phase_a    | Data
kW_3P          | CSV   | kw                 | Data
Equipment_ID   | CSV   | NA                 | Marker
Temperature    | CSV   | (not shown - skip)  | —
```

**2. Summary Statistics**
```
┌──────────────────────────────────────────────────┐
│ Columns in Output: 67  │ NA Columns: 2           │
│ with real data         │ markers/flags           │
├──────────────────────────────────────────────────┤
│ Skipped: 465           │ Output Rows: Auto       │
│ columns excluded       │ from file               │
└──────────────────────────────────────────────────┘
```

---

## Output Excel File Format

### File Name
```
pq_data_normalized_{timestamp}.xlsx
Example: pq_data_normalized_2026-05-20_143045.xlsx
```

### Column Names (Standardized)
```
Raw File Column    →    Normalized Excel Column
URMS_L1            →    voltage_phase_a
IRMS_L1            →    current_phase_a
kW_3P              →    kw
THDV_1             →    vthd_a
Temperature        →    (SKIPPED - not included)
Reserved_001       →    (SKIPPED - not included)
Equipment_ID       →    Equipment_ID (NA marker)
```

### Data Structure
```
Column A: voltage_phase_a | Column B: current_phase_a | Column C: kw | ...
──────────────────────────────────────────────────────────────────────
230.1                     | 10.2                      | 5.1         |
230.3                     | 10.4                      | 5.2         |
229.5                     | 10.1                      | 4.9         |
230.2                     | 10.5                      | 5.3         |
... (all rows from source file)
```

---

## Example: 532-Column File

### Configuration (You Did This)
```
Total columns: 532
Assigned: 67 (to standard columns)
NA: 300 (metadata/markers)
Skipped: 165 (not needed)

Mapping Summary shows:
┌────────────────────────────────────────────┐
│ Columns in Output: 67                      │
│ NA Columns: 300                            │
│ Skipped: 165                               │
│ Output Rows: Auto from file                │
└────────────────────────────────────────────┘
```

### Download (What You Get)
```
File: pq_data_normalized.xlsx

Contains:
├─ 367 columns total (67 data + 300 NA)
├─ All rows from original file
├─ Standardized names
└─ Ready for graphs

Example columns:
  voltage_phase_a
  current_phase_a
  kw
  vthd_a
  Equipment_ID (NA values)
  Plant_Location (NA values)
  ... (361 more)

Does NOT include:
  ✗ The 165 skipped columns
  ✗ Original raw names
  ✗ Non-standard columns
```

---

## Use Cases

### For Data Analysis
```
1. Download normalized Excel
2. Open in Python/R:
   import pandas as pd
   df = pd.read_excel('pq_data_normalized.xlsx')
   df.describe()
3. Only useful columns loaded
4. Standard names make scripting easy
```

### For Visualization
```
1. Download normalized Excel
2. Open in:
   - Power BI
   - Tableau
   - Google Sheets
   - Excel Charts
3. All columns ready to plot
4. No need to rename or transform
```

### For Reporting
```
1. Download normalized Excel
2. Include in reports as-is
3. Professional format
4. Stakeholders understand standard names
5. No need for data cleaning
```

---

## Column Categories in Output

### Type 1: Real Data Columns
```
Examples: voltage_phase_a, current_phase_a, kw
Contains: Actual measurements from equipment
Use for: Graphs, calculations, analysis
Count: ~67 columns (your "Assigned" count)
```

### Type 2: NA Marker Columns
```
Examples: Equipment_ID, Plant_Location, Error_Flag
Contains: NA/marker values
Use for: Identification, tracking
Count: ~300 columns (your "NA" count)
Status: All values are "NA"
```

### Type 3: Skipped (NOT included)
```
Examples: Reserved fields, temporary data
Count: ~165 columns (your "Skipped" count)
Status: Completely excluded from output
Why: You selected "— skip —" for them
```

---

## Data Quality

### What's Preserved
```
✓ All rows from original file
✓ All data values
✓ Original data types (numeric, text, etc.)
✓ Timestamp precision
✓ NA values in NA columns
```

### What's Transformed
```
→ Column names (URMS_L1 → voltage_phase_a)
→ Column order (standardized)
→ Data filtering (skipped columns removed)
→ Format (Excel .xlsx)
```

### What's NOT Changed
```
✓ Data values themselves
✓ Row order (same as source)
✓ Calculation results
✓ Accuracy/precision
```

---

## Understanding the Mapping Summary

### Columns in Output
```
Definition: Columns with real measurement data
Count: 67 (your "Assigned" count)
These are columns you explicitly mapped to standard columns
Example: URMS_L1 → voltage_phase_a
Included in download: YES
Used for graphs: YES
```

### NA Columns
```
Definition: Columns marked as "Not Available"
Count: 300 (your "NA" count)
These are metadata, identifiers, or markers
Example: Equipment_ID → NA
Included in download: YES (with all NA values)
Used for graphs: NO (but useful for tracking)
```

### Skipped Columns
```
Definition: Columns set to "— skip —"
Count: 165 (not mapped)
These are columns you didn't need
Example: Reserved_001 → (skipped)
Included in download: NO
Used for graphs: NO (intentionally excluded)
```

### Output Rows
```
Definition: Number of rows in normalized file
Count: Same as source file
Examples:
  If source has 10,000 rows → Output has 10,000 rows
  If source has 1 hour data at 1-min intervals → Output has 60 rows
  If source has 1 day data at 5-min intervals → Output has 288 rows
```

---

## Download Process (Backend)

When you click "Download Normalized Excel":

```
1. Read uploaded file (original data)
2. Get saved mappings for this model
3. For each mapped column:
   a. Read data from source column
   b. Transform if needed
   c. Write to output with standard name
4. Create Excel file
5. Serve for download
6. Browser saves: pq_data_normalized.xlsx
```

---

## Example: Complete Workflow

### Start
```
Raw data: hioki_data.csv (532 columns)
Rows: 8,760 (hourly data for 1 year)
```

### Configure (You Did This)
```
Total: 532
Assigned: 67 (voltage, current, power, THD)
NA: 300 (metadata fields)
Skipped: 165 (unused fields)
```

### Mapping Summary Shows
```
┌──────────────────────────────────────────┐
│ Columns in Output: 67                    │
│ NA Columns: 300                          │
│ Skipped: 165                             │
│ Output Rows: 8,760 (auto from file)      │
└──────────────────────────────────────────┘

Mapping table shows:
  URMS_L1 → voltage_phase_a (Data)
  URMS_L2 → voltage_phase_b (Data)
  IRMS_L1 → current_phase_a (Data)
  Equipment_ID → NA (Marker)
  Plant_Location → NA (Marker)
  ... 362 more
```

### Download
```
File: pq_data_normalized_2026-05-20.xlsx

Contains:
├─ Columns: 367 (67 data + 300 NA)
├─ Rows: 8,760
├─ Names: Standardized
└─ Format: Excel (.xlsx)

Ready for:
  ✓ Power BI dashboards
  ✓ Python analysis
  ✓ Excel charts
  ✓ Tableau visualization
  ✓ Statistical reports
```

---

## FAQ

### Q: Will skipped columns be in the download?
```
A: No. Columns set to "— skip —" are completely excluded.
   If you later need them, upload the file again and map them.
```

### Q: Can I modify the mapping after downloading?
```
A: No. The download is a snapshot of current mappings.
   To change mappings:
   1. Edit configuration
   2. Save
   3. Upload file again
   4. Download new version
```

### Q: How large will the Excel file be?
```
A: Depends on:
  - Number of rows: More rows = larger file
  - Number of columns: 367 columns typical
  - Data type: Numeric data is smaller
  
  Example: 10,000 rows × 367 columns ≈ 2-5 MB
```

### Q: Can I use the downloaded file in Python?
```
A: Yes! Easy to read:
   import pandas as pd
   df = pd.read_excel('pq_data_normalized.xlsx')
   
   All column names are standardized and ready to use
```

### Q: What if I have NA values in data columns?
```
A: They're preserved as NaN in Excel.
   Most tools handle this automatically.
   You may need to clean them before analysis.
```

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **What It Is** | Cleaned data file with mapped columns only |
| **Format** | Excel (.xlsx) |
| **Columns** | Assigned + NA (Skipped excluded) |
| **Rows** | Same as source file |
| **Names** | Standardized (voltage_phase_a, etc.) |
| **Ready for** | Graphs, analysis, visualization |
| **Use** | Download after configuration & data upload |

---

## Getting Started

### To Get a Normalized Excel Download:

1. **Configure mappings** (you're here now)
   - Assign 67+ columns
   - Skip unwanted columns
   - Mark NA columns
   - See mapping summary

2. **Save configuration**
   - Click "Save configuration"
   - Redirect to upload page

3. **Upload data file**
   - Go to upload page
   - Select your model
   - Upload measurement file

4. **Download Excel**
   - See "Download Normalized Excel" button
   - Click to download
   - File: `pq_data_normalized.xlsx`

5. **Use for analysis**
   - Open in Excel, Python, Power BI, Tableau
   - All columns ready to use
   - No need for data cleaning!

---

**Your configuration determines what goes in the normalized Excel!** 🎯

