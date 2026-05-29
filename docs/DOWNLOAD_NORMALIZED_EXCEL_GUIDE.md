# How to Download Normalized Excel Files

## Quick Start (3 Steps)

### Step 1: Configure Your Model
```
Go to: Configuration Page
├─ Select or create a PQ model
├─ Upload your sample file (CSV/Excel)
├─ Map columns you need to standard names
└─ Save configuration
```

### Step 2: Go to Upload Page
```
Navigate to: Upload Page
├─ Select the same PQ model
├─ Ensure it shows green indicator (configured)
└─ Continue to Step 3
```

### Step 3: Download Normalized Excel
```
On Upload Page:
├─ Select your data file
├─ Model has mappings?
│  └─ Green box appears: "📥 Download Normalized Excel"
├─ Click [Download Normalized Excel]
└─ File downloads: pq_data_normalized_YYYYMMDD_HHMMSS.xlsx
```

---

## Detailed Walkthrough

### Scenario: Download Clean Data from 532-Column File

#### Before Configuration
```
Raw Data File:
├─ Format: CSV with 532 columns
├─ Columns needed: 67 (voltage, current, power, etc.)
├─ Columns ignored: 465 (reserved, metadata, temp data)
└─ Size: 50 MB
```

#### Step 1: Map Columns (Configuration Page)

**Access Configuration:**
```
1. Go to Home → Configuration
2. Click on model "Hioki" (built-in)
3. Upload your sample file
   └─ System detects all 532 columns
```

**Map Columns You Need:**
```
Click "Left to Assign ▼" dropdown

Find and click:
├─ URMS_L1 → Select "voltage_phase_a"
├─ URMS_L2 → Select "voltage_phase_b"
├─ IRMS_L1 → Select "current_phase_a"
├─ kW_3P → Select "kw"
└─ ... (60+ more columns)

Ignore unmapped columns:
└─ They're automatically excluded!
```

**See Mapping Summary:**
```
Columns in Output: 67
│
├─ These 67 will be in your Excel
├─ Standardized names used
└─ Ready for graphs!

NA Columns: 300 (metadata)
└─ Equipment_ID, Plant_Location, etc.

Skipped: 165
└─ Temp fields, reserved columns
└─ NOT in output
```

**Save Configuration:**
```
Click [Save Configuration]
↓
Mappings stored for this model
↓
Ready to use!
```

#### Step 2: Go to Upload Page

**Navigate:**
```
Home → Upload → PQ Analyzer Export
```

**Select Model:**
```
PQ Analyzer Model dropdown
├─ Click to open
├─ Select "Hioki"
│  └─ Green dot = configured ✓
└─ Close dropdown
```

**What You See:**
```
File Upload Section:
├─ Drag & drop your data file
├─ Shows file name and size
│
Normalized Excel Download Section:
├─ Green box appears! 📥
├─ Title: "Download Normalized Excel"
├─ Info: "Export only mapped columns..."
├─ Button: [Download Normalized Excel] ▼
│
Metadata Section:
├─ Company Name
├─ Plant Name
├─ Address
└─ ... (optional for analysis download)
```

#### Step 3: Download Normalized Excel

**Two Options:**

**Option A: Download Normalized Excel Only**
```
1. Select your data file
2. Click [Download Normalized Excel]
3. Wait for "Generating..." to complete
4. File downloads:
   └─ pq_data_normalized_20260520_143045.xlsx
5. ✅ Success notification: "Excel downloaded"
```

**Option B: Download + Analyze Dashboard**
```
1. Select your data file
2. Fill in metadata (Company, Plant, etc.)
3. Click [Process & launch dashboard]
4. Wait for processing
5. Dashboard launches with graphs
6. (Excel download still works separately)
```

---

## What's in Your Downloaded Excel?

### File Details
```
Name: pq_data_normalized_20260520_143045.xlsx
└─ Timestamp shows when generated

Sheet Name: "Data"

Size: Typically 2-5 MB for 10,000 rows × 367 columns
```

### Columns (Example)
```
voltage_phase_a    | voltage_phase_b    | voltage_phase_c    | ...
current_phase_a    | current_phase_b    | current_phase_c    | ...
kw                 | kva                | pf                 | ...
frequency          | vthd_a             | vthd_b             | ...
Equipment_ID       | Plant_Location     | ... (365 total)
```

### Data Structure
```
Row 1:  Column Headers (standard names)
Row 2:  First measurement
Row 3:  Second measurement
...
Row N:  Last measurement

All rows from source file preserved
Data types: Numeric for measurements, Text for IDs
```

### What's NOT Included
```
❌ Unmapped columns
❌ Skipped columns ("— skip —")
❌ Original column names (renamed to standards)
❌ Configuration information
```

---

## Using Your Downloaded Excel

### In Excel
```
1. Open pq_data_normalized_20260520_143045.xlsx
2. Data → Create PivotTable
3. Data → Charts
4. Visualize voltage, current, frequency, etc.
```

### In Google Sheets
```
1. Upload file to Google Drive
2. Open with Google Sheets
3. Insert → Chart
4. Create interactive dashboards
```

### In Python
```python
import pandas as pd

df = pd.read_excel('pq_data_normalized_20260520_143045.xlsx')

# Quick stats
print(df.describe())

# Filter and plot
voltage = df[['voltage_phase_a', 'voltage_phase_b', 'voltage_phase_c']]
voltage.plot()

# Export for machine learning
df.to_csv('clean_data.csv', index=False)
```

### In Power BI
```
1. Get Data → Excel
2. Select your normalized Excel file
3. Load data
4. All columns ready to visualize
5. No transformation needed!
```

### In Tableau
```
1. Data → New Data Source
2. Select your Excel file
3. All columns auto-detected
4. Drag to create visualizations
```

---

## Troubleshooting

### Green Download Box Not Showing?
```
❌ Problem: Model shows red/orange dot
   └─ Solution: Go to Configuration, map columns, save

❌ Problem: No file selected
   └─ Solution: Drag file into upload area first

❌ Problem: Different model selected
   └─ Solution: Make sure you selected the configured model
```

### Download Fails with Error?

**"No mappings found for model"**
```
Problem: Model not configured
Solution:
  1. Go to Configuration
  2. Upload sample file
  3. Map at least 5 columns
  4. Save configuration
  5. Return to Upload page
```

**"Empty upload"**
```
Problem: File is 0 bytes
Solution:
  1. Check file is valid
  2. File exists and opens normally
  3. Try uploading fresh copy
```

**"No readable data found in file"**
```
Problem: File format not recognized or corrupted
Solution:
  1. Verify file is CSV or Excel
  2. Try opening file normally first
  3. If corrupted, export fresh copy from device
  4. Try again
```

**"Failed to generate normalized Excel"**
```
Problem: Server error during processing
Solution:
  1. Check file size (if very large, may timeout)
  2. Try with smaller file first
  3. Check browser console for details
  4. Contact administrator if persists
```

### File Downloads But Appears Empty?
```
Problem: Excel file opens but has no data
Cause: No columns were actually mapped
Solution:
  1. Go back to Configuration
  2. Verify mappings saved
  3. Check that columns appear in "Mapping Summary"
  4. Make sure to click "Save configuration"
  5. Return to Upload and try again
```

---

## Comparison: Before & After

### Before (Raw Data)
```
File: hioki_data.csv
├─ Columns: 532
├─ Format: Device-specific names
│  └─ URMS_L1, IRMS_L1, kW_3P, etc.
├─ Includes: Unwanted columns
│  └─ Reserved fields, metadata
├─ Size: 50 MB
└─ Ready for: Device vendor only
```

### After (Normalized Excel)
```
File: pq_data_normalized_20260520_143045.xlsx
├─ Columns: 67 (mapped data only)
├─ Format: Standardized names
│  └─ voltage_phase_a, current_phase_a, kw, etc.
├─ Includes: Only what you need
│  └─ Measurement data + metadata markers
├─ Size: 2.5 MB
└─ Ready for: Excel, Python, Tableau, Power BI
```

---

## Pro Tips

### 💡 Tip 1: Batch Downloads
```
Need multiple normalized files from same model?
1. Configure once
2. Upload different files
3. Download each → faster workflow!
```

### 💡 Tip 2: Compare Devices
```
Download from multiple devices:
1. Create separate models (ALM, Fluke, etc.)
2. Configure each
3. Download from each
4. Compare in Excel with VLOOKUP or pivot tables
```

### 💡 Tip 3: Archive Normalized Data
```
Keep a copy of normalized files:
├─ Organized by date
├─ Organized by location
├─ Search-friendly names
└─ Backup before analysis
```

### 💡 Tip 4: Combine Multiple Files
```
In Python:
import pandas as pd
import glob

files = glob.glob('pq_data_normalized_*.xlsx')
dfs = [pd.read_excel(f) for f in files]
combined = pd.concat(dfs, ignore_index=True)
combined.to_excel('combined_analysis.xlsx')
```

### 💡 Tip 5: Schedule Downloads
```
For repeated downloads:
├─ Use configuration API endpoint
├─ Automate with Python scripts
├─ Schedule with cron jobs
└─ Build data pipeline!
```

---

## FAQ

**Q: Can I modify mappings after downloading?**
```
A: Yes! Go back to Configuration, update mappings, save,
   then download a new Excel file with updated columns.
```

**Q: Do I need to fill Company Name to download?**
```
A: No! Company Name is only required for the Dashboard.
   Download works independently.
```

**Q: Will the download work with very large files?**
```
A: Yes, but may take longer (1-2 minutes for 1GB).
   Monitor the "Generating..." indicator.
```

**Q: Can I download without uploading to Dashboard?**
```
A: Yes! You can download normalized Excel without
   filling metadata or processing dashboard.
```

**Q: What if a column appears in multiple sheets?**
```
A: System handles it automatically - uses data from
   first matching sheet with that column.
```

**Q: Can I change the output filename?**
```
A: Filename is auto-generated with timestamp.
   You can rename the file after download.
```

---

## Next Steps After Download

### For Quick Review
```
1. Open Excel file
2. Scroll through data
3. Check column names are correct
4. Verify data looks good
```

### For Analysis
```
1. Open in Python/R
2. Load data: pd.read_excel('file.xlsx')
3. Analyze: df.describe(), correlations, etc.
4. Visualize: Graphs, plots, charts
```

### For Reports
```
1. Use normalized data in Power BI
2. Create dashboards
3. Share with stakeholders
4. Ready for presentation!
```

### For Archival
```
1. Store in backup location
2. Add metadata: Date, Location, Device
3. Index by date range
4. Build time-series analysis
```

---

**Your normalized Excel file is ready to use immediately - no cleaning needed!** ✨

