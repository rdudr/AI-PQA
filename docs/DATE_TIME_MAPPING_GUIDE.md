# Date & Time Column Mapping Guide

## Overview

The Power Quality Analyzer now supports three separate date/time options in the "Maps to" dropdown:

1. **`timestamp`** - Combined date and time (YYYY-MM-DD HH:MM:SS)
2. **`date`** - Date only (YYYY-MM-DD)
3. **`time`** - Time only (HH:MM:SS)

---

## Use Cases

### Scenario 1: Combined Timestamp Column
**Raw File:**
```
Datetime,Voltage,Current
2026-01-20 08:00:00,230.1,10.2
2026-01-20 08:01:00,230.3,10.4
```

**Mapping:**
- Column `Datetime` → Maps to: `timestamp`

**Result:** Combined date and time preserved as-is

---

### Scenario 2: Separate Date & Time Columns
**Raw File:**
```
Date,Time,Voltage,Current
2026-01-20,08:00:00,230.1,10.2
2026-01-20,08:01:00,230.3,10.4
```

**Mapping:**
- Column `Date` → Maps to: `date`
- Column `Time` → Maps to: `time`

**Result:** Date and time processed separately

---

### Scenario 3: Only Date (No Time)
**Raw File:**
```
RecordDate,Voltage,Current
2026-01-20,230.1,10.2
2026-01-21,230.3,10.4
```

**Mapping:**
- Column `RecordDate` → Maps to: `date`

**Result:** Date stored, time defaults to 00:00:00

---

### Scenario 4: Only Time (No Date)
**Raw File:**
```
Time,Voltage,Current
08:00:00,230.1,10.2
08:01:00,230.3,10.4
```

**Mapping:**
- Column `Time` → Maps to: `time`

**Result:** Time stored, date defaults to today's date

---

## Configuration Page Workflow

### Step-by-Step: Map Timestamp Column

1. **Upload File**
   ```
   Click "Browse file" or drag & drop sample file
   ```

2. **Inspect Results**
   ```
   System auto-detects columns and sheets
   ```

3. **Map Date/Time Column**
   ```
   Find "Date" or "Time" or "Datetime" column in table
   Click "Maps to" dropdown
   
   Options available:
   - timestamp ← Select this for combined date+time
   - date      ← Select this for date only
   - time      ← Select this for time only
   ```

4. **If Multiple Date/Time Columns**
   ```
   Example: File has both "Date" and "Time" columns
   
   Step 1: Map "Date" column → "date"
   Step 2: Map "Time" column → "time"
   
   Both will be used in processing
   ```

5. **Save Configuration**
   ```
   Click "Save configuration"
   Mappings are stored for future uploads
   ```

---

## In "Maps to" Dropdown

When you click the "Maps to" dropdown, you'll now see:

```
— select standard column —
NA (not available)
timestamp                    ← Combined date+time
date                         ← Date only
time                         ← Time only
voltage_phase_a
voltage_phase_b
... (all other columns)
```

---

## Format Specifications

### timestamp Format
```
YYYY-MM-DD HH:MM:SS
Example: 2026-01-20 14:30:45
```

### date Format
```
YYYY-MM-DD
Example: 2026-01-20
```

### time Format
```
HH:MM:SS
Example: 14:30:45
```

---

## Advanced: Custom Column Mapping

You can also use the custom column mapping feature to handle non-standard date/time columns:

**Example: File has unusual column name "Record_DateTime"**

1. Go to "Custom Column Mapping" section
2. Column name in file: `Record_DateTime`
3. Source sheet: Select appropriate sheet
4. Maps to: `timestamp` (or `date` or `time`)
5. Click "Add"

---

## Processing & Storage

### Timestamp Processing Flow

```
Raw Data (any date/time format)
        ↓
Parser Detection (recognizes date/time patterns)
        ↓
Column Mapping (applies your "Maps to" selections)
        ↓
Standardization (converts to standard format)
        ↓
Normalized Output (timestamp, date, time columns)
```

### Unified Timestamp Creation

If you map both `date` and `time` columns:
- System automatically combines them into a unified `timestamp`
- Example: 
  - date: 2026-01-20
  - time: 14:30:45
  - Creates: 2026-01-20 14:30:45

---

## Examples by Device Type

### Hioki PW3198
**Raw Columns:** Date, Time
```
Mapping:
Date → date
Time → time
```

### Fluke 1735
**Raw Columns:** DateTime
```
Mapping:
DateTime → timestamp
```

### Schneider ALM-31
**Raw Columns:** Record Date, Record Time
```
Mapping:
Record Date → date
Record Time → time
```

### Generic CSV
**Raw Columns:** (varies)
```
If combined:
Datetime → timestamp

If separate:
DateColumn → date
TimeColumn → time
```

---

## Data Quality & Validation

The system validates date/time data:

✅ **Accepted Formats:**
- YYYY-MM-DD HH:MM:SS
- YYYY-MM-DD
- HH:MM:SS
- DD/MM/YYYY
- MM/DD/YYYY
- Common variations

❌ **Rejected Formats:**
- Text descriptions (e.g., "Monday, January 20")
- Invalid dates (e.g., 2026-13-45)
- Missing required components

### Quality Checks
- ✓ Dates are valid calendar dates
- ✓ Times are within 00:00:00 - 23:59:59
- ✓ Chronological order preserved
- ✓ No duplicate timestamps (within tolerance)

---

## Troubleshooting

### Issue: "Date column not detected"
**Solution:** 
- Try mapping it manually to `date` in the "Maps to" dropdown
- Or use custom column mapping

### Issue: "Time column shows as 'unmatched'"
**Solution:** 
- Click the "Maps to" dropdown
- Select `time` option
- Save configuration

### Issue: Date/time formats don't match
**Solution:** 
- The system attempts automatic format detection
- If fails, data is marked in quality report
- Check data quality metrics after processing

### Issue: Timezone differences
**Solution:** 
- System preserves the timestamp as-is
- No timezone conversion applied
- All times treated as local time in the file

---

## Summary: Updated Standard Columns (114 Total)

### Basic Measurements (11 columns - NEW: +2)
✅ timestamp
✅ date (NEW)
✅ time (NEW)
✅ voltage_phase_a
✅ voltage_phase_b
✅ voltage_phase_c
✅ current_phase_a
✅ current_phase_b
✅ current_phase_c
✅ frequency
✅ pf

### Others (103 columns unchanged)
- Power Values: 6
- THD Parameters: 6
- Voltage Harmonics: 39
- Current Harmonics: 39
- Voltage RMS: 6
- Current RMS: 6
- Special: 1

---

## What Changed

### Frontend
✅ ConfigPage.tsx - Added `date` and `time` to STANDARD_COLS

### Backend
✅ base.py STANDARD_COLUMNS - Added "date" and "time"
✅ base.py BASE_SYNONYMS - Added synonyms for date/time columns

### Documentation
✅ README_STANDARD_COLUMNS.md - Updated with new columns and count (114)

---

## Next Steps

1. **Upload your file** to the Configuration page
2. **Find date/time columns** in the detected columns table
3. **Select from dropdown** - timestamp, date, or time
4. **Save configuration**
5. **Process data** - system handles date/time processing automatically

**That's it!** ✅ Date and time are now properly mapped and handled.

