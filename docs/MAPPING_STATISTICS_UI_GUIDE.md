# Mapping Statistics UI Guide - What You See on Configuration Page

**How to read the mapping statistics displayed on the Configuration Page**

---

## 📍 Where Statistics Appear

### Location 1: Assignment Statistics Box (Top Right)

**On the Configuration Page**, right side of the screen:

```
┌───────────────────────────────────────────┐
│        ASSIGNMENT STATISTICS              │
├───────────────────────────────────────────┤
│                                           │
│  Total: 532  │  Assigned: 67             │
│              │  Left to Assign: 465 ▼    │
│              │  Progress: 12%            │
│                                           │
└───────────────────────────────────────────┘
```

### Location 2: "Left to Assign" Dropdown

Click the arrow (▼) to see unmapped columns:

```
Left to Assign ▼
465 unmatched columns

┌─────────────────────────────────┐
│ Custom_Parameter_001 (CSV)      │
│ Custom_Parameter_002 (CSV)      │
│ Equipment_ID (CSV)              │
│ Plant_Location (CSV)            │
│ Reserved_001 (CSV)              │
│ Reserved_002 (CSV)              │
│ Temp_Sensor (CSV)               │
│ ... (458 more)                  │
└─────────────────────────────────┘
```

### Location 3: Mapping Summary Section (Below Table)

Appears after you map at least one column:

```
┌──────────────────────────────────────────┐
│            MAPPING SUMMARY               │
├──────────────────────────────────────────┤
│                                          │
│  File Column │ Sheet │ Maps to │ Type   │
│  ─────────────────────────────────────  │
│  URMS_L1     │ CSV   │ voltage │ Data  │
│  URMS_L2     │ CSV   │ voltage │ Data  │
│  ... (18 more shown of 67 mapped)       │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ Columns in Output: 67              │ │
│  │ NA Columns: 300                    │ │
│  │ Skipped: 165                       │ │
│  │ Output Rows: Auto from file        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  📥 Normalized Excel Download           │
│  Shows what will be in your download    │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🔍 Understanding Each Value You See

### The Four Key Numbers

#### 1. **Total: 532**
```
┌─────────────────────┐
│  Total: 532         │
└─────────────────────┘

Means: 
└─ All columns in your uploaded file

Location: Top left of statistics box
Color: Neutral (informational)
Action: None - just reference
```

#### 2. **Assigned: 67**
```
┌─────────────────────┐
│  Assigned: 67       │
└─────────────────────┘

Means:
└─ Columns you've mapped to standard names

Location: Top right of statistics box
Color: Neutral (informational)
Action: This is your output Excel column count
Note: Includes both DATA and NA columns
```

#### 3. **Left to Assign: 465 ▼**
```
┌─────────────────────┐
│  Left to Assign: 465│
│  465 unmatched   ▼  │
└─────────────────────┘

Means:
├─ Columns not yet mapped
├─ These are AUTOMATICALLY EXCLUDED
└─ No action needed!

Location: Bottom right with dropdown arrow
Color: Warning yellow (needs attention)
Action: Click ▼ to see the list
Interactive: Dropdown shows all 465
```

#### 4. **Progress: 12%**
```
┌─────────────────────┐
│  Progress: 12%      │
└─────────────────────┘

Means:
└─ Percentage of columns you've assigned

Calculation:
= (Assigned / Total) × 100
= (67 / 532) × 100
= 12.6% ≈ 12%

Location: Below statistics
Color: Informational
Action: Track your progress
Note: 88% unmapped is OK - they auto-exclude!
```

---

## 📊 Visual Reading Guide

### What Each Section Tells You

```
ASSIGNMENT STATISTICS Box:
├─ Top Row:
│  ├─ Total: 532 → "I have 532 columns"
│  └─ Assigned: 67 → "I've processed 67"
│
├─ Second Row:
│  ├─ Left to Assign: 465 → "465 are unprocessed"
│  └─ Progress: 12% → "I'm 12% done"
│
└─ Interactive:
   └─ ▼ Arrow → Click to see unmatched list
```

### How to Interpret the Numbers

```
When you see:        What it means:         Action:
─────────────────────────────────────────────────
Total: 532          Your file is large       Reference
Assigned: 67        You've done enough      ✅ Ready
Left: 465           High number unmatched    ✅ OK
Progress: 12%       Low percentage done      ✅ OK

All unmapped (Left to Assign) 
are automatically excluded from your 
output Excel file!

You DON'T need to process all of them!
```

---

## 🎯 What Happens When You Click ▼

### The Dropdown List

When you click "Left to Assign ▼":

```
┌─────────────────────────────────────────────────┐
│ Left to Assign ▼ (toggle to collapse)           │
│ 465 unmatched columns                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Scrollable list below]                        │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │ 1. Custom_Parameter_001 (CSV)            │   │
│  │ 2. Custom_Parameter_002 (CSV)            │   │
│  │ 3. Custom_Parameter_003 (CSV)            │   │
│  │ 4. Equipment_ID (CSV)                    │   │
│  │ 5. Plant_Info (CSV)                      │   │
│  │ 6. Plant_Location (CSV)                  │   │
│  │ 7. Reserved_001 (CSV)                    │   │
│  │ 8. Reserved_002 (CSV)                    │   │
│  │ 9. Temp_Sensor (CSV)                     │   │
│  │ ... (456 more)                           │   │
│  │                                          │   │
│  │ Showing 9 of 465                         │   │
│  │ (Scrollable - shows ~8-10 at a time)    │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  How to use:                                    │
│  1. Scroll through the list                    │
│  2. Click on a column name                     │
│  3. Page scrolls to that column in the table   │
│  4. You can now map it                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### What Each Column Shows

```
Format: COLUMN_NAME (SHEET_NAME)

Examples:
├─ Custom_Parameter_001 (CSV)
│  └─ Column name: Custom_Parameter_001
│  └─ From sheet: CSV (or "Sheet1" for Excel)
│
├─ Equipment_ID (CSV)
│  └─ Column name: Equipment_ID
│  └─ From sheet: CSV
│
└─ Reserved_001 (CSV)
   └─ Column name: Reserved_001
   └─ From sheet: CSV
```

---

## 📈 The Mapping Summary Section (Below)

### Summary Statistics Grid

After mapping columns, you see:

```
┌────────────────────────────────────────────┐
│ MAPPING SUMMARY (appears when columns      │
│ assigned)                                   │
├────────────────────────────────────────────┤
│                                            │
│ ┌──────────────────────────────────────┐  │
│ │ File Column │ Sheet │ Maps to │ Type │  │
│ │ ──────────────────────────────────── │  │
│ │ URMS_L1     │ CSV   │ voltage │ Data │  │
│ │ URMS_L2     │ CSV   │ voltage │ Data │  │
│ │ URMS_L3     │ CSV   │ voltage │ Data │  │
│ │ IRMS_L1     │ CSV   │ current │ Data │  │
│ │ IRMS_L2     │ CSV   │ current │ Data │  │
│ │ IRMS_L3     │ CSV   │ current │ Data │  │
│ │ kW_3P       │ CSV   │ kw      │ Data │  │
│ │ kVA_3P      │ CSV   │ kva     │ Data │  │
│ │ PF_3P       │ CSV   │ pf      │ Data │  │
│ │ Freq_Avg    │ CSV   │ freq    │ Data │  │
│ │ ... (20 of 67 shown)                │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ ┌──────────────────────────────────────┐  │
│ │ Columns in Output: 67                │  │
│ │ NA Columns: 300                      │  │
│ │ Skipped: 165                         │  │
│ │ Output Rows: Auto from file          │  │
│ └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

### Understanding the Summary Stats

```
Columns in Output: 67
└─ Columns with actual measurement data
└─ These will appear in your Excel
└─ Have real values (voltage, current, etc.)

NA Columns: 300
└─ Metadata/identifier columns
└─ These will also appear in Excel
└─ But will have NA/empty values
└─ For tracking/identifying data source

Skipped: 165
└─ Columns you explicitly marked "— skip —"
└─ These will NOT appear in Excel
└─ Permanently excluded

Output Rows: Auto from file
└─ Number of rows from your data file
└─ Example: 10,000 rows → 10,000 rows in Excel
└─ All data preserved
```

---

## 🔢 The Data Breakdown Explained

### What the Numbers Mean

```
Your 532-Column File Breakdown:

┌──────────────────────────────┐
│ Total: 532                   │
└──────────────────────────────┘
         ↓ (splits into)
         
┌─────────────────────────────────────┐
│ ✅ Assigned: 67                     │
│    └─ Mapped columns (used)         │
│       └─ Data: 67                   │
│       └─ NA: 0 (initially)          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ❌ Left to Assign: 465              │
│    └─ Unmapped columns (not used)   │
│       └─ Auto-excluded              │
└─────────────────────────────────────┘

═════════════════════════════════════
Total: 67 + 465 = 532 ✓
═════════════════════════════════════
```

---

## 💡 Quick Reference: Reading the UI

### What You'll See & What It Means

| Element | Shows | Means |
|---------|-------|-------|
| **Total: 532** | All columns | File size |
| **Assigned: 67** | Mapped columns | Output size |
| **Left to Assign: 465** | Unmapped | Auto-excluded |
| **Progress: 12%** | Percentage done | Completion |
| **▼ Dropdown** | 465 columns list | Find columns |
| **Mapping Table** | Mapped columns | What's configured |
| **Columns in Output: 67** | Final column count | Excel columns |
| **NA Columns: 300** | Metadata columns | Tracking info |
| **Skipped: 165** | Excluded columns | Not in file |

---

## 🎯 Practical Steps: What to Do

### Step 1: Check the Statistics Box
```
On Configuration Page:
1. Look at top-right statistics box
2. See: Total: 532, Assigned: 67, Left: 465
3. Think: "I have 67 columns, 465 are auto-excluded"
4. Feel: ✅ Ready to continue
```

### Step 2: If You Need to Find a Column
```
1. Click "Left to Assign ▼" 
2. See dropdown list of 465 unmapped
3. Find the column you want
4. Click it → Page scrolls to it
5. Map it using the dropdown
```

### Step 3: Check Your Mapping Summary
```
1. Scroll down to "MAPPING SUMMARY"
2. See first 20 mapped columns
3. Verify: "Columns in Output: 67"
4. Think: "My Excel will have 67 columns"
5. Decide: "Is this enough?" 
   - YES → Ready to save
   - NO → Map more columns
```

### Step 4: Save and Download
```
1. Click "Save Configuration"
2. Go to Upload Page
3. See green "Download Normalized Excel" box
4. Click download
5. Get pq_data_normalized.xlsx (367 columns total)
```

---

## ✅ Summary: Reading the Statistics

### Three Numbers You Need to Know

```
Total Columns: 532
├─ What: All columns in your file
└─ Use: Reference/context

Assigned: 67
├─ What: Columns in your output Excel
└─ Use: Your actual deliverable

Left to Assign: 465
├─ What: Unmapped (auto-excluded)
└─ Use: Just informational
          You don't need to do anything!
```

### What Gets Downloaded

```
Your Normalized Excel =
├─ File: pq_data_normalized_{timestamp}.xlsx
├─ Columns: 67 data + 300 NA = 367 total
├─ Rows: All rows from source
├─ Size: ~2.5 MB
└─ Status: Ready for analysis ✅

NOT included:
└─ The 165 skipped columns
```

### The Key Insight

```
"Left to Assign: 465 unmatched columns"

This sounds like a problem!
But it's NOT a problem because:
├─ They're automatically excluded
├─ You don't need to do anything
├─ Your output Excel won't include them
└─ Perfect! ✨
```

---

## 🎓 Final Understanding

**The statistics show you:**
1. ✅ How many columns you have total (532)
2. ✅ How many you've processed (67)
3. ✅ How many are remaining (465 - but auto-excluded!)
4. ✅ What will be in your output (67 mapped + 300 NA = 367)

**Your output Excel will have:**
- ✅ 367 columns (67 data + 300 NA)
- ✅ All rows from source
- ✅ Standardized names
- ✅ Ready for analysis

**You don't need to:**
- ❌ Process all 465 unmapped
- ❌ Explicitly skip each one
- ❌ Do anything with them

They're automatically handled! 🎉

