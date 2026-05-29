# Mapping Summary Section - Configuration Page

## New Section Added

After you assign columns, a new **"Mapping Summary"** section appears showing exactly what will be in your normalized Excel download.

---

## Visual Layout

### Before (No Summary)
```
[Mapping Table with all columns]
...
...
[Save Button]
```

### After (With Summary)
```
[Mapping Table with all columns]
...
...

╔════════════════════════════════════════════════════╗
║            MAPPING SUMMARY                         ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  [Mapping Details Table - Shows mapped columns]   ║
║                                                    ║
║  File Column | Sheet | Maps to | Type             ║
║  ─────────────────────────────────────────────    ║
║  URMS_L1     | CSV   | voltage_phase_a | Data    ║
║  URMS_L2     | CSV   | voltage_phase_b | Data    ║
║  IRMS_L1     | CSV   | current_phase_a | Data    ║
║  Equipment_ID | CSV  | NA              | Marker  ║
║  ... (20 shown of 67 mapped)                      ║
║                                                    ║
║  [Summary Statistics]                              ║
║  Columns: 67  │  NA: 300  │  Skipped: 165         ║
║                                                    ║
║  [Download Info Box]                               ║
║  📥 Normalized Excel Download info                 ║
║                                                    ║
╚════════════════════════════════════════════════════╝

[Save Button] [Cancel Button]
```

---

## Section Components

### 1. Mapping Details Table

**Shows:** First 20 of your mapped columns

```
File Column    | Sheet  | Maps to (Standard)   | Type
────────────────────────────────────────────────────────
URMS_L1        | CSV    | voltage_phase_a      | Data
URMS_L2        | CSV    | voltage_phase_b      | Data
URMS_L3        | CSV    | voltage_phase_c      | Data
IRMS_L1        | CSV    | current_phase_a      | Data
IRMS_L2        | CSV    | current_phase_b      | Data
IRMS_L3        | CSV    | current_phase_c      | Data
kW_3P          | CSV    | kw                   | Data
kVA_3P         | CSV    | kva                  | Data
PF_3P          | CSV    | pf                   | Data
Freq_Avg       | CSV    | frequency            | Data
THDV_1         | CSV    | vthd_a               | Data
THDV_2         | CSV    | vthd_b               | Data
THDV_3         | CSV    | vthd_c               | Data
THDI_1         | CSV    | ithd_a               | Data
THDI_2         | CSV    | ithd_b               | Data
THDI_3         | CSV    | ithd_c               | Data
Equipment_ID   | CSV    | NA                   | Marker
Plant_Location | CSV    | NA                   | Marker
... (2 more)

Showing 20 of 67 mapped columns
```

**Column Meanings:**
```
File Column:         Name from your original file
Sheet:               Which sheet it comes from
Maps to (Standard):  Standard column name it will use in output
Type:                "Data" (measurement) or "Marker" (metadata/NA)
```

---

### 2. Summary Statistics Grid

**Shows:** What will be in your download

```
┌──────────────────────────────────────────────────┐
│  Columns in Output  │  NA Columns              │
│  ════════════════  │  ═══════════            │
│        67          │       300                │
│  with real data    │  markers/flags          │
├──────────────────────────────────────────────────┤
│  Skipped           │  Output Rows             │
│  ════════════════  │  ═══════════            │
│       465          │      Auto                │
│  columns excluded  │  from file              │
└──────────────────────────────────────────────────┘
```

**Each Stat Explained:**

```
Columns in Output
├─ Definition: Columns with real measurement data
├─ Count: 67 (example)
├─ Includes: voltage, current, power, THD, harmonics
├─ Will be in Excel: YES
└─ For graphs: YES

NA Columns
├─ Definition: Metadata / identifier columns
├─ Count: 300 (example)
├─ Includes: Equipment_ID, Plant_Location, etc.
├─ Will be in Excel: YES
└─ For graphs: NO (but useful for tracking)

Skipped Columns
├─ Definition: Columns you don't need
├─ Count: 465 (example)
├─ Includes: Reserved fields, temporary data
├─ Will be in Excel: NO
└─ Intentionally excluded

Output Rows
├─ Definition: How many rows in Excel file
├─ Count: Auto (same as source file)
├─ Example: 10,000 rows source → 10,000 rows output
└─ Includes: All rows from original file
```

---

### 3. Download Information Box

**Appears when columns are assigned**

```
┌────────────────────────────────────────────────┐
│ 📥 Normalized Excel Download                   │
├────────────────────────────────────────────────┤
│ When you save this configuration and upload    │
│ data, you'll be able to download a normalized  │
│ Excel file with standardized column names      │
│ and only the mapped data - ready for graphs    │
│ and analysis.                                  │
│                                                │
│ • Only includes assigned columns              │
│   (skipped columns excluded)                   │
│ • Column names standardized                    │
│   (e.g., "voltage_phase_a")                    │
│ • Data transformed according to your mappings  │
│ • Ready for visualization and graphs           │
│                                                │
└────────────────────────────────────────────────┘
```

---

## When Does It Appear?

### Yes - Show Mapping Summary When:
```
✓ File is uploaded
✓ At least 1 column is assigned
✓ User has made some mappings
```

### No - Hide When:
```
✗ No file uploaded
✗ No columns assigned
✗ Still in initial state
```

---

## Example: Your 532-Column File

### What You See in Mapping Summary

**Mapping Table (Top 20):**
```
File Column    | Sheet | Maps to        | Type
───────────────────────────────────────────────
URMS_L1        | CSV   | voltage_phase_a| Data
URMS_L2        | CSV   | voltage_phase_b| Data
URMS_L3        | CSV   | voltage_phase_c| Data
IRMS_L1        | CSV   | current_phase_a| Data
IRMS_L2        | CSV   | current_phase_b| Data
IRMS_L3        | CSV   | current_phase_c| Data
kW_3P          | CSV   | kw             | Data
kVA_3P         | CSV   | kva            | Data
PF_3P          | CSV   | pf             | Data
Freq_Avg       | CSV   | frequency      | Data
THDV_1         | CSV   | vthd_a         | Data
THDV_2         | CSV   | vthd_b         | Data
THDV_3         | CSV   | vthd_c         | Data
THDI_1         | CSV   | ithd_a         | Data
THDI_2         | CSV   | ithd_b         | Data
THDI_3         | CSV   | ithd_c         | Data
Equipment_ID   | CSV   | NA             | Marker
Plant_Info     | CSV   | NA             | Marker
... (2 more)

Showing 20 of 67 mapped columns
```

**Summary Stats:**
```
┌────────────────────────────────────────┐
│ Columns in Output: 67                  │
│ with real data                         │
├────────────────────────────────────────┤
│ NA Columns: 300                        │
│ markers/flags                          │
├────────────────────────────────────────┤
│ Skipped: 465                           │
│ columns excluded                       │
├────────────────────────────────────────┤
│ Output Rows: Auto (from file)          │
└────────────────────────────────────────┘
```

**Info Box:**
```
📥 Normalized Excel Download
When you save this configuration and upload data,
you'll be able to download a normalized Excel file
with:
• 367 columns total (67 data + 300 NA)
• Standardized names
• Only mapped data
• Ready for graphs!
```

---

## How to Read It

### Understanding the Type Column

```
Type: "Data"
├─ Real measurement column
├─ Will have numeric values
├─ Use for graphs and calculations
└─ Example: voltage_phase_a, kw, frequency

Type: "Marker"
├─ Metadata / identifier column
├─ Will have NA values
├─ Use for tracking and identification
└─ Example: Equipment_ID, Plant_Location
```

### What Gets Downloaded

**Data Columns (67):**
```
In normalized Excel: YES
With values: YES (real measurements)
For graphs: YES
Examples: voltage_phase_a, current_phase_a, kw
```

**NA/Marker Columns (300):**
```
In normalized Excel: YES
With values: NA (empty/marker)
For graphs: NO
Examples: Equipment_ID, Plant_Location
```

**Skipped Columns (465):**
```
In normalized Excel: NO
Completely excluded: YES
For graphs: N/A (not included)
Examples: Reserved fields, temporary data
```

---

## Next Steps After Seeing Summary

### If Summary Looks Good:
```
1. Click "Save configuration"
2. Go to upload page
3. Upload measurement file
4. See "Download Normalized Excel" button
5. Download Excel file
6. Use for graphs and analysis!
```

### If You Want to Change:
```
1. Modify mappings in table above
2. Add more columns
3. Change skip/NA assignments
4. Scroll back to mapping table
5. Make changes
6. Summary updates automatically!
7. Save when ready
```

---

## Format Specifications

### Data Types Preserved
```
Numeric:  230.1, 10.2, 5.1 → 230.1, 10.2, 5.1
Text:     "Plant_A" → "Plant_A"
Date:     2026-01-20 → 2026-01-20
Time:     14:30:45 → 14:30:45
Missing:  NA → blank or NA
```

### Excel File Details
```
Format:        .xlsx (Excel 2007+)
Sheet Name:    "Data" or "Normalized"
Header Row:    Yes (column names)
Data Rows:     All from source file
Columns:       Only assigned + NA
```

---

## Responsive Design

### Desktop (1200px+)
```
Full summary with:
- Full mapping table
- 4-column statistics grid
- Info box
- All clearly visible
```

### Tablet (768px-1199px)
```
Summary with:
- Scrollable mapping table
- 2-column statistics grid
- Info box wraps nicely
- Touch-friendly
```

### Mobile (< 768px)
```
Stacked summary:
- Mapping table scrolls horizontally
- Statistics stack vertically
- Info box full width
- All readable on small screen
```

---

## Benefits of Mapping Summary

### For You (User)
```
✓ See exactly what will be downloaded
✓ Verify mappings before saving
✓ Understand output structure
✓ Make confident decisions
✓ No surprises when downloading
```

### For Data Quality
```
✓ Confirms correct mappings
✓ Shows NA and skipped columns
✓ Verifies row count
✓ Ensures consistency
```

### For Transparency
```
✓ Clear what's included
✓ Clear what's excluded
✓ Professional documentation
✓ Audit trail of mappings
```

---

## Summary

| Item | Purpose |
|------|---------|
| **Mapping Table** | Show what columns are mapped where |
| **Summary Stats** | Show structure of output Excel |
| **Info Box** | Explain download availability |
| **Real-Time** | Updates as you make changes |
| **Visual Feedback** | Confirm before saving |

---

**The Mapping Summary ensures you know exactly what data will be in your normalized Excel!** ✅

