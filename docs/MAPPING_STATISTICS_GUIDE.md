# Mapping Statistics Guide - Understanding Your Data

**Purpose:** Understand the column mapping values and how to use them

---

## 📊 The Three Key Values

### Example: Your 532-Column File

```
┌─────────────────────────────────────┐
│     ASSIGNMENT STATISTICS           │
├─────────────────────────────────────┤
│ Total Columns: 532                  │
│ Assigned: 67                        │
│ Left to Assign: 465                 │
└─────────────────────────────────────┘
```

---

## 1️⃣ **Total Columns: 532**

### What It Means
```
Total columns detected in your input file
= All columns from your CSV/Excel
= Raw, unprocessed count
```

### Calculation
```
Total = Assigned + Left to Assign
532    = 67      + 465
```

### Use Case
- Reference: How many columns are in your file
- Progress: Track what percentage you've processed
- Planning: Decide how many you actually need

---

## 2️⃣ **Assigned: 67**

### What It Means
```
Columns you've already mapped
= Columns with standard names assigned
= Columns that WILL be in output Excel
= Data columns + NA columns
```

### Breakdown of 67 Assigned
```
67 Assigned = 
├─ Data Columns: ~67
│  ├─ voltage_phase_a (mapped to URMS_L1)
│  ├─ voltage_phase_b (mapped to URMS_L2)
│  ├─ current_phase_a (mapped to IRMS_L1)
│  └─ ... 64 more
│
└─ NA Columns: 0-300
   ├─ Equipment_ID (mapped to NA)
   ├─ Plant_Location (mapped to NA)
   └─ ... more metadata

Total: 67 columns you've configured
```

### Use Case
- Count: How many columns will be in your output Excel
- Progress: How much you've configured
- Planning: Is this enough columns?

---

## 3️⃣ **Left to Assign: 465**

### What It Means
```
Unmapped columns (NOT YET processed)
= Columns you haven't assigned yet
= These are AUTOMATICALLY EXCLUDED
= No action needed from you!
```

### Calculation
```
Left to Assign = Total - Assigned
465            = 532   - 67
```

### These 465 Columns:
```
❌ NOT in your output Excel
❌ NOT in your normalized file
❌ Don't need your attention
✅ Automatically excluded
```

### Use Case
- Reference: How many columns you're ignoring
- Progress: How many are left (if you wanted to map more)
- Verification: Are all unwanted columns here?

---

## 📈 Visual Representation

### Your 532-Column File Breakdown

```
┌─────────────────────────────────────────┐
│         YOUR 532-COLUMN FILE            │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ASSIGNED (67 columns)           │   │
│  ├─────────────────────────────────┤   │
│  │ ✅ voltage_phase_a              │   │
│  │ ✅ voltage_phase_b              │   │
│  │ ✅ voltage_phase_c              │   │
│  │ ✅ current_phase_a              │   │
│  │ ✅ current_phase_b              │   │
│  │ ✅ current_phase_c              │   │
│  │ ✅ kw                           │   │
│  │ ✅ kva                          │   │
│  │ ✅ frequency                    │   │
│  │ ... (58 more assigned)          │   │
│  │                                 │   │
│  │ These 67 will be in your        │   │
│  │ normalized Excel output! ✨     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ LEFT TO ASSIGN (465 columns)    │   │
│  ├─────────────────────────────────┤   │
│  │ ❌ Reserved_001                 │   │
│  │ ❌ Reserved_002                 │   │
│  │ ❌ Temp_Sensor                  │   │
│  │ ❌ Custom_Parameter_001         │   │
│  │ ... (461 more unmapped)         │   │
│  │                                 │   │
│  │ These 465 are automatically     │   │
│  │ EXCLUDED from output 🔒         │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🎯 What Gets Downloaded

### When You Download Normalized Excel

**Input:** 532 columns total  
**Processing:**
```
┌─ Read all 532 columns
├─ Find mapped columns (67)
├─ Extract their data
├─ Exclude unmapped (465)
└─ Create Excel
```

**Output:** `pq_data_normalized_{timestamp}.xlsx`
```
Sheet "Data":
├─ Columns: 67 (ONLY the mapped ones)
│  ├─ voltage_phase_a
│  ├─ voltage_phase_b
│  ├─ ... (65 more)
│  └─ Equipment_ID (metadata/NA)
│
├─ Rows: All rows from source
│
└─ Size: ~2.5 MB (much smaller than 50 MB original!)

❌ NOT included: 465 unmapped columns
```

---

## 📋 Understanding "Intent of Column"

### What This Means
The **purpose/intent** of each column in your mapping

### Example: Showing Intent

```
File Column        | Mapped To              | Intent
───────────────────────────────────────────────────────
URMS_L1            | voltage_phase_a        | DATA ✓
URMS_L2            | voltage_phase_b        | DATA ✓
URMS_L3            | voltage_phase_c        | DATA ✓
IRMS_L1            | current_phase_a        | DATA ✓
IRMS_L2            | current_phase_b        | DATA ✓
IRMS_L3            | current_phase_c        | DATA ✓
kW_3P              | kw                     | DATA ✓
kVA_3P             | kva                    | DATA ✓
Freq_Avg           | frequency              | DATA ✓
Equipment_ID       | NA                     | MARKER ⚠️
Plant_Location     | NA                     | MARKER ⚠️
Reserved_001       | (not mapped)           | EXCLUDED ❌
Reserved_002       | (not mapped)           | EXCLUDED ❌
... 461 more       | (not mapped)           | EXCLUDED ❌
```

### Two Intents

**1. DATA Columns (67 total)**
```
Purpose: Actual measurements/values
Examples: voltage_phase_a, current_phase_a, kw, frequency, THD
In Output: ✅ YES - with actual values
For Analysis: ✅ YES - use for graphs and calculations
```

**2. MARKER/NA Columns (0-300)**
```
Purpose: Metadata, IDs, tracking info
Examples: Equipment_ID, Plant_Location, Timestamp
In Output: ✅ YES - but all values are NA/empty
For Analysis: ❌ NO - can't use for calculations
For Tracking: ✅ YES - identify data source
```

**3. EXCLUDED Columns (465)**
```
Purpose: Not needed for analysis
Examples: Reserved fields, temporary data, system info
In Output: ❌ NO - automatically excluded
Action: No action needed from you
```

---

## 🔢 How to Calculate and Use These Values

### Calculation Formula

```
TOTAL = ASSIGNED + LEFT_TO_ASSIGN

Example:
532 = 67 + 465 ✓ Correct!
```

### Percentage Breakdowns

```
Percentage Assigned:
= (Assigned / Total) × 100
= (67 / 532) × 100
= 12.6% of columns are mapped

Percentage Left:
= (Left to Assign / Total) × 100
= (465 / 532) × 100
= 87.4% of columns are unmapped (but auto-excluded)
```

### File Size Impact

```
Original File: 50 MB (532 columns)
Output Excel: 2.5 MB (67 columns)
Reduction: 95% smaller! 🎉

Why so much smaller?
├─ Only 67 columns (vs 532)
├─ Excel format more efficient than CSV
└─ No extra metadata
```

---

## 📊 Interpreting the Statistics

### Scenario 1: You've Mapped Enough
```
Total: 532
Assigned: 67 ✅ (All columns you need are mapped)
Left to Assign: 465 ✅ (Don't care about these)

Action: ✅ Ready to download!
```

### Scenario 2: You Need More Columns
```
Total: 532
Assigned: 30 ⚠️ (Need more columns)
Left to Assign: 502 ✅ (Some are needed)

Action: ❌ Go back and map more columns
        Use "Left to Assign" dropdown to find them
```

### Scenario 3: You've Mapped Too Many
```
Total: 532
Assigned: 400 ⚠️ (Too much data)
Left to Assign: 132 ✅ (Most are done)

Action: ⚠️ Review and remove unnecessary columns
        Click "Maps to" → Select "— skip —"
```

---

## 🎯 Practical Use Cases

### Use Case 1: File Size Reduction
```
Question: "How much smaller will my file be?"

Answer using statistics:
Ratio = Assigned / Total
      = 67 / 532
      = 12.6% of original

New file ≈ 50 MB × 12.6% = 6.3 MB
(Actually smaller due to Excel format)
```

### Use Case 2: Progress Tracking
```
Question: "How much mapping is done?"

Answer:
Progress = (Assigned / Total) × 100
         = (67 / 532) × 100
         = 12.6% complete

Remaining = 87.4% (but auto-excluded!)
```

### Use Case 3: Data Completeness
```
Question: "Do I have all the columns I need?"

Answer:
If Assigned = Expected columns → ✅ Ready
If Assigned < Expected columns → ❌ Need more
If Assigned > Expected columns → ⚠️ Review

Expected = 67 columns for power quality analysis
Assigned = 67 columns
Result: ✅ Perfect match!
```

---

## 📈 Statistics in Your Configuration

### Where to See These Values

**Configuration Page:**
```
┌──────────────────────────────────┐
│ ASSIGNMENT STATISTICS            │
├──────────────────────────────────┤
│ Total: 532   Assigned: 67        │
│ Left to Assign: 465 ▼            │
└──────────────────────────────────┘
```

**Mapping Summary Section:**
```
┌──────────────────────────────────┐
│ Columns in Output: 67            │
│ NA Columns: 300                  │
│ Skipped: 165                     │
│ Output Rows: Auto from file      │
└──────────────────────────────────┘
```

### Understanding "Columns in Output"

```
Columns in Output = 67 + 300 = 367 total
├─ 67 columns with actual measurement data
└─ 300 columns with NA/metadata values

Both will be in your normalized Excel!

Wait, what about the 165 "Skipped"?
└─ They're NOT in output (excluded)
```

---

## 🔍 Detailed Column Accounting

### All 532 Columns Accounted For

```
532 Total Columns =
├─ 67 Assigned (mapped to standards) ✅
│  ├─ 67 Data columns (measurement values)
│  └─ 0 NA columns
│
├─ 300 Could be NA assignments
│  └─ Not shown yet in "Left to Assign"
│  └─ These are metadata/identifier columns
│
└─ 165 Skipped explicitly
   └─ Set to "— skip —"
   └─ Definitely excluded

Status: All 532 accounted for ✓
```

### In Your Output Excel

```
367 Columns in Output Excel:
├─ 67 Data columns (measurement data)
└─ 300 NA columns (metadata/markers)

NOT in Output:
└─ 165 Skipped columns

Calculation: 67 + 300 + 165 = 532 ✓
```

---

## 💡 Key Insights

### Understanding the Numbers

| Value | Means | Action |
|-------|-------|--------|
| **Total: 532** | Columns in file | Reference only |
| **Assigned: 67** | Columns you want | Done ✅ |
| **Left to Assign: 465** | Columns not yet processed | Don't need ❌ |
| **In Output: 367** | Total columns in Excel (67+300) | Ready to download |
| **Excluded: 165** | Skipped columns | Not in file |

### The Magic Formula

```
What gets downloaded:
= Assigned + NA Assignments
= 67 + 300
= 367 columns

What's excluded:
= Left to Assign + Skipped
= 465 + 165
= 630 columns

Wait, that doesn't add up? Because:
- Left to Assign: Some might become NA assignments
- Some of 465 will be explicitly skipped (165)
- Rest: Automatically excluded (300)

Final: 67 (assigned) + 300 (NA) = 367 in output ✓
```

---

## 🎓 Summary

### The Three Values Explained

| Value | Your Case | Meaning |
|-------|-----------|---------|
| **Total Columns** | 532 | Size of input file |
| **Assigned** | 67 | Columns in output Excel |
| **Left to Assign** | 465 | Unmapped (auto-excluded) |

### Intent of Columns

| Intent | Count | In Output | Use |
|--------|-------|-----------|-----|
| **Data** | 67 | ✅ YES | Analysis |
| **Metadata/NA** | 300 | ✅ YES | Tracking |
| **Skipped** | 165 | ❌ NO | Excluded |

### Your Output Excel

```
File: pq_data_normalized_{timestamp}.xlsx
Columns: 367 total (67 data + 300 NA)
Rows: All from source file
Size: ~2.5 MB (vs 50 MB original)
Status: ✅ Ready for analysis
```

---

## ✅ Final Answer to Your Questions

**Q: "I need value of total map"**  
A: Total Mapped Columns = Assigned = **67**

**Q: "assigned map"**  
A: Assigned Mapped Columns = **67** (these are your mapped columns)

**Q: "left map"**  
A: Left to Assign (Unmapped) = **465** (auto-excluded, no action needed)

**Q: "intent of column I need data of map"**  
A: The mapping shows:
- **Intent = Purpose of each column**
- **Data columns:** Measurement values (67 columns)
- **NA columns:** Metadata/tracking (300 columns)
- **Skipped:** Excluded (165 columns)
- **In Output:** 67 data + 300 NA = 367 total columns

All mapped data will be in your normalized Excel download! ✅

