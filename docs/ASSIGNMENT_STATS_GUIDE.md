# Assignment Statistics & Column Filtering Guide

## New Features Added

### 1. 📊 Assignment Statistics Box (Sticky Header)
A new summary box appears at the top of the configuration page showing real-time assignment progress.

**What It Shows:**
```
┌─────────────────────────────────────────────────────────────────┐
│                  ASSIGNMENT STATISTICS (STICKY)                  │
├─────────────────────────────────────────────────────────────────┤
│  Total Columns  │  Assigned      │  Left to Assign  │ Progress   │
│  ════════════  │  ═══════════   │  ═════════════   │ ════════   │
│      532       │  45 columns    │   465 unmatched  │  8% ███    │
│                │    mapped      │    columns       │  complete  │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Shows automatically when file is uploaded
- ✅ Updates in real-time as you make assignments
- ✅ Stays at top of page while scrolling (sticky)
- ✅ Visual progress bar with percentage
- ✅ Color-coded: Green for progress, Orange for remaining
- ✅ Responsive design - adapts to mobile/tablet

---

## 2. 🚫 Prevent Duplicate Column Assignments
Once a standard column is mapped, it's automatically removed from the "Maps to" dropdown for other file columns.

### How It Works

**Example Scenario:**
```
File Columns                    Standard Columns (Available)
────────────────              ─────────────────────────
URMS_L1  ────────────────→    timestamp
URMS_L2                       date
URMS_L3  ────────────────→    time
IRMS_L1                       voltage_phase_a  ← Already used, removed
IRMS_L2                       voltage_phase_b  ← Already used, removed
IRMS_L3  ────────────────→    voltage_phase_c  ← Already used, removed
kW_3P    ────────────────→    current_phase_a
kVA_3P                        current_phase_b
                              current_phase_c
                              (and 101 more...)
```

### Benefits
- ✅ **Prevents Errors:** Can't accidentally assign same standard column twice
- ✅ **Easier Selection:** Fewer options = faster decision-making
- ✅ **Smart Filtering:** Automatically filters based on current assignments
- ✅ **Works Everywhere:** Both main table and custom column mapping

### Example Usage

**Step 1: Assign voltage_phase_a**
```
Column: URMS_L1
Maps to: [voltage_phase_a ✓]
```
**Available options in next dropdown now:**
```
— skip —
NA (not available)
timestamp
date
time
voltage_phase_b          ← voltage_phase_a is GONE
voltage_phase_c          ← voltage_phase_a is GONE
current_phase_a
... (rest of columns)
```

**Step 2: Try to assign voltage_phase_b to a different column**
```
Column: URMS_L2
Maps to: [voltage_phase_b ✓]
```
**Next available options:**
```
— skip —
NA (not available)
timestamp
date
time
voltage_phase_c          ← voltage_phase_a AND voltage_phase_b are GONE
current_phase_a
... (rest of columns)
```

---

## 3. 📋 Understanding "Skip" vs "NA"

### Skip (— skip —)
```
✓ Use when: Column is not important for analysis
✓ Result: Column is IGNORED in the dataset
✓ In output: Column will NOT appear in normalized data
✓ For graphs: This data will NOT be available for visualization
```

### NA (Not Available)
```
✓ Use when: Column exists but represents missing/null data
✓ Result: Column is INCLUDED as "NA" marker
✓ In output: Column appears with "NA" values
✓ For graphs: Can be useful to identify missing data periods
```

### Example

**File has 532 columns:**
```
Input File (532 columns)
  ├─ 45 columns → Mapped to standard columns ✓
  ├─ 465 columns → Not mapped (unmatched)
  │   ├─ 300 columns → Set to "— skip —" (ignored)
  │   └─ 165 columns → Set to "NA" (included as markers)
  
Output Dataset:
  ├─ 45 mapped columns (real data)
  ├─ 165 NA columns (markers)
  └─ 300 skipped columns (NOT included) ✗
  
Total in output: 45 + 165 = 210 columns
(Not 45 + 165 + 300 = 510)
```

---

## 4. 📊 Assignment Statistics Explained

### Total Columns
**Definition:** All columns detected in the uploaded file
```
Example: 532 total columns detected
```

### Assigned
**Definition:** Columns that have been mapped to standard columns
```
Examples of "assigned":
- URMS_L1 → voltage_phase_a ✓
- IRMS_L1 → current_phase_a ✓
- kW_3P → kw ✓
- Temperature → NA ✓ (still "assigned" even if NA)

Count: 45 assigned (out of 532)
```

### Left to Assign
**Definition:** Unmatched columns that still need a decision
```
Examples that need assignment:
- Custom_Parameter1 (no auto-match)
- Equipment_ID (no auto-match)
- Reserved_Field_01 (no auto-match)

Unmatched count: 465 columns
These must be set to either:
  1. A standard column (Maps to: [column name])
  2. "NA" (include as marker)
  3. "— skip —" (ignore completely)
```

### Progress Bar
**Calculation:** (Assigned / Total) × 100
```
45 assigned out of 532 = 8% complete
```

---

## 5. 📥 Download & Export (Future Feature)

When you save the configuration, the normalized data will include:

### What Gets Included in Export:
```
✓ Assigned columns (with real data)
✓ NA columns (with NA markers)
✗ Skipped columns (excluded)
✗ Unmapped columns (excluded)
```

### Export Options:
```
Available Formats (when implemented):
- CSV (.csv)
- Excel (.xlsx) ← Normalized Excel format
- JSON (.json)
- Parquet (.parquet)
```

### Example Export File Structure:
```
timestamp  | voltage_phase_a | current_phase_a | vthd_a | Custom_01
-----------|-----------------|-----------------|--------|----------
2026-01-20 | 230.1          | 10.2            | 2.1    | NA
08:00:00   |                |                 |        |
-----------|-----------------|-----------------|--------|----------
2026-01-20 | 230.3          | 10.4            | 2.2    | NA
08:01:00   |                |                 |        |
```

---

## 6. 🎯 Quick Reference: Assignment Workflow

### Complete Workflow for 532 Columns

**Phase 1: Upload & Auto-Detection**
```
1. Upload file
2. System detects 532 columns
3. Auto-maps ~67 columns (typical for known devices)
4. Leaves 465 unmatched
```

**Phase 2: Review Assignment Stats**
```
Box shows:
- Total: 532 columns
- Assigned: 67 (from auto-detection)
- Left to Assign: 465
- Progress: 13%
```

**Phase 3: Assign Unmatched Columns**

Option A - Manual Assignment:
```
For each unmatched column:
  Column Name → Click "Maps to" dropdown
              → Select standard column (only available ones shown)
              → Save assignment
```

Option B - Skip Not Needed:
```
For non-essential columns:
  Column Name → Click "Maps to" dropdown
              → Select "— skip —"
              → Column excluded from output
```

Option C - Mark as NA:
```
For metadata/markers:
  Column Name → Click "Maps to" dropdown
              → Select "NA (not available)"
              → Included with NA values
```

**Phase 4: Track Progress**
```
Stats box updates real-time:
- Total: 532 (unchanged)
- Assigned: 200 (as you assign more)
- Left: 332
- Progress: 38%
```

**Phase 5: Save Configuration**
```
Click "Save configuration"
- Mappings saved for future uploads
- Configuration persists
```

**Phase 6: Export Normalized Data**
```
Future: Click "Download as Excel"
- Only assigned + NA columns included
- Skipped columns excluded
- Ready for graphs and analysis
```

---

## 7. 📱 Responsive Design

### Desktop View (Sticky Header)
```
┌─────────────────────────────────────────────────────┐
│  ASSIGNMENT STATISTICS (stays at top while scroll)  │
│  Total: 532 | Assigned: 45 | Left: 465 | 8% done   │
└─────────────────────────────────────────────────────┘

[Mapping Table - Scrollable]
Column | Sheet | Sample | Maps to | Source | Status
─────────────────────────────────────────────────────
...
```

### Tablet View (4-Column Grid)
```
┌────────────────────────────────────┐
│ Total: 532  │ Assigned: 45        │
│ Left: 465   │ Progress: 8% ███    │
└────────────────────────────────────┘
```

### Mobile View (1-Column Stack)
```
┌──────────────────┐
│ Total Columns    │
│ 532              │
├──────────────────┤
│ Assigned         │
│ 45 columns       │
├──────────────────┤
│ Left to Assign   │
│ 465 unmatched    │
├──────────────────┤
│ Progress         │
│ 8% [███________] │
└──────────────────┘
```

---

## 8. ⚡ Performance Tips

### For Large Files (500+ columns):

1. **Use Auto-Detection First**
   - Saves time on common columns
   - Auto-assigns ~60% typically

2. **Filter by Status**
   - Focus on "unmatched" columns first
   - Skip obvious non-data columns

3. **Batch Similar Columns**
   - All temperature → skip
   - All IDs → NA
   - All measurements → assign to standards

4. **Use Custom Column Mapping**
   - Faster for non-standard columns
   - Dropdown filtering helps

---

## 9. 💡 Best Practices

### ✓ DO:
- Use "skip" for metadata that won't be analyzed
- Use "NA" for important identifiers/markers
- Map to standard columns for numerical measurements
- Check progress bar frequently
- Save configuration after each session

### ✗ DON'T:
- Skip columns you might need later
- Assign multiple file columns to same standard column
- Leave "unmatched" columns incomplete
- Forget to save configuration

---

## 10. 🔄 Updating Existing Configuration

### If You Need to Change Mappings:

1. Upload file again
2. Previous mappings auto-fill
3. Modify as needed:
   - Change "Maps to" assignment
   - Update custom column mapping
   - Re-assign skipped columns
4. Save configuration
5. All changes take effect

---

## Summary

| Feature | Purpose | Benefit |
|---------|---------|---------|
| **Statistics Box** | Show assignment progress | Track work and motivation |
| **Sticky Header** | Always visible | Know current stats while scrolling |
| **Column Filtering** | Remove assigned columns | Prevent duplicates, easier selection |
| **Skip Option** | Exclude columns | Cleaner output data |
| **NA Option** | Mark as not available | Track missing data |
| **Real-Time Updates** | Stats update as you work | See immediate progress |

---

**With these features, managing 532+ columns becomes simple and organized!** 📊✨

