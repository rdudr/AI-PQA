# Simplified Mapping Workflow

## Core Principle

**You ONLY need to map columns you want to use.**

Unmapped columns are automatically excluded from the output. No need to explicitly "skip" them.

---

## Workflow Comparison

### OLD Way (Complex)
```
File: 532 columns detected
├─ Map 67 columns ← You need these
├─ Skip 300 columns ← You don't need these
├─ Skip 165 columns ← You don't need these
└─ Total actions: 532 (tedious!)

Result: Only 67 columns in output
```

### NEW Way (Simple)
```
File: 532 columns detected
├─ Map 67 columns ← ONLY map what you need!
└─ Everything else: Automatically excluded

Result: Only 67 columns in output
(No need to skip anything!)
```

---

## Simplified Process: 3 Easy Steps

### Step 1: Upload File
```
Upload your 532-column file
System auto-detects and shows summary:
  ✓ Total columns found: 532
  ✓ Unmatched: 465 (not yet assigned)
  ✓ Left to assign: Use the dropdown to find what you need
```

### Step 2: Find & Map Columns You Need
```
Click "Left to Assign ▼" dropdown
Look for columns you need:
  ✓ voltage_phase_a, voltage_phase_b, voltage_phase_c
  ✓ current_phase_a, current_phase_b, current_phase_c
  ✓ kw, kva, frequency
  
Click on each column you need
→ It scrolls to that row in the table
→ Click "Maps to" dropdown
→ Select standard column
→ DONE! (Move to next column you need)

Ignore all other columns!
```

### Step 3: Save & Download
```
Once you've mapped all columns you need:
1. Click "Save configuration"
2. Go to Upload page
3. Upload measurement file
4. Click "Download Normalized Excel"
5. File contains ONLY the columns you mapped!
```

---

## What Gets Included/Excluded

### INCLUDED in Output
```
✅ Columns you explicitly mapped
   (e.g., voltage_phase_a, kw, frequency)
✅ Only these appear in normalized Excel
✅ Ready for graphs
```

### AUTOMATICALLY EXCLUDED
```
❌ Unmapped columns (you didn't map them)
❌ NOT in normalized Excel
❌ No need to do anything with them
```

### NO NEED TO SKIP
```
You DON'T need to explicitly set columns to "— skip —"
Just don't map them, and they're automatically excluded!
```

---

## Example: Your 532-Column File

### What You Need
```
Just these 67 columns for power quality analysis:
├─ voltage_phase_a/b/c (6 columns for 3 phases × min/max)
├─ current_phase_a/b/c (6 columns)
├─ kw, kva, kvar (3 columns)
├─ frequency (1 column)
├─ vthd_a/b/c, ithd_a/b/c (6 columns)
└─ Harmonics (U12, U23, U31, A1, A2, A3) (78 columns)
   Total: ~67 columns
```

### What You Ignore
```
Remaining 465 columns:
├─ Reserved fields (not useful)
├─ Equipment metadata (not needed)
├─ Temporary test data (ignore)
├─ System information (skip it)
└─ ... other columns you don't care about

Action: Do nothing! They're automatically excluded.
```

### Result
```
Normalized Excel Download:
├─ 67 columns you mapped ✓
├─ All rows from source file ✓
├─ Standardized column names ✓
└─ Ready for graphs! ✓

NOT included: 465 unmapped columns (auto-excluded)
```

---

## Mapping Summary - Simplified View

### What It Shows Now
```
┌──────────────────────────────────────────┐
│  MAPPING SUMMARY                         │
├──────────────────────────────────────────┤
│                                          │
│  Mapped Columns (Will be in output):     │
│  ┌────────────────────────────────────┐  │
│  │ URMS_L1 → voltage_phase_a          │  │
│  │ URMS_L2 → voltage_phase_b          │  │
│  │ IRMS_L1 → current_phase_a          │  │
│  │ kW_3P → kw                         │  │
│  │ ... (67 total)                     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Output Statistics:                      │
│  ├─ Total columns in file: 532          │
│  ├─ Columns you're using: 67            │
│  ├─ Automatically excluded: 465         │
│  └─ Normalized Excel will have: 67      │
│                                          │
│  📥 Download will contain:               │
│  • Only the 67 columns you mapped       │
│  • All rows from your file              │
│  • Standardized column names            │
│  • Ready for analysis!                  │
│                                          │
└──────────────────────────────────────────┘
```

---

## No More "Skip" Needed!

### Old Way
```
If you don't need a column:
→ Click "Maps to" dropdown
→ Select "— skip —"
→ Repeat for all 465 unwanted columns
(Tedious! 465 actions needed)
```

### New Way
```
If you don't need a column:
→ Just ignore it!
→ Don't map it
→ It's automatically excluded
(Simple! 0 actions needed)
```

---

## Quick Reference

### Your Actions Needed
```
1. Upload file ✓
2. Use "Left to Assign ▼" to find columns you need
3. Click columns one by one
4. Map the ones you need
5. Ignore the rest
6. Save configuration ✓
7. Upload data file ✓
8. Download Excel ✓

That's it!
No need to:
  ✗ Skip 465 columns
  ✗ Set NA for columns you don't use
  ✗ Do anything with unwanted columns
```

---

## Updated Workflow: 532-Column File

### Before (Old Way - Complex)
```
Step 1: Upload file (532 detected)
Step 2: Auto-map 67 columns
Step 3: Manually skip 300 columns ← Extra work!
Step 4: Manually skip 165 columns ← Extra work!
Step 5: Configure mapping summary
Step 6: Save
Total actions: ~400+ (very tedious)
```

### After (New Way - Simple)
```
Step 1: Upload file (532 detected)
Step 2: Click "Left to Assign ▼"
Step 3: Find & map 67 columns you need
Step 4: Ignore the rest (automatically excluded)
Step 5: See mapping summary
Step 6: Save
Total actions: ~67 (just what you need!)
```

---

## Statistics Box - Updated Interpretation

### Shows
```
Total Columns: 532
├─ This is all columns in your file

Assigned: 67
├─ Columns you've mapped
├─ These will be in your output

Left to Assign: 465
├─ NOT mapped yet
├─ These are automatically excluded!
├─ You don't need to do anything with them

Progress: 13%
├─ How many of the ones you ARE mapping are done
├─ Don't worry about the 87% unmapped
├─ That's OK - they're automatically excluded
```

---

## Understanding "Left to Assign"

### What It Means
```
"Left to Assign: 465 unmatched columns"

Translation:
├─ 465 columns haven't been mapped yet
├─ You don't need to map them!
├─ They're automatically not in the output
└─ This number decreases only if you map more
```

### You Don't Need to Address All 465!
```
The dropdown shows all 465 unmatched columns
But you only need to:
├─ Map the ones you care about (67)
└─ Ignore the rest (auto-excluded)

Example:
  You need: voltage_phase_a, kw, frequency
  → Find these 3 in the dropdown
  → Click and map them
  → Don't worry about the other 464!
```

---

## Mapping Summary - What to Expect

### Shows Your 67 Mapped Columns
```
File Column | Sheet | Maps to | Will be in output?
────────────────────────────────────────────────
URMS_L1     | CSV   | voltage_phase_a | ✓ YES
URMS_L2     | CSV   | voltage_phase_b | ✓ YES
URMS_L3     | CSV   | voltage_phase_c | ✓ YES
IRMS_L1     | CSV   | current_phase_a | ✓ YES
kW_3P       | CSV   | kw              | ✓ YES
... (62 more)

Total: 67 columns mapped
465 unmapped columns: Auto-excluded (you don't see them here)
```

### Download Contains
```
Your normalized Excel file will have:
├─ The 67 columns you mapped ✓
├─ All rows from your source file ✓
├─ Standardized column names ✓
└─ Ready to use! ✓

Does NOT contain:
├─ The 465 unmapped columns ✗
├─ Original column names ✗
└─ Data you didn't map ✗
```

---

## Bottom Line

### Remember This
```
✅ Only map columns you actually need
✅ Ignore everything else
✅ Unmapped = Automatically excluded
✅ No need to skip anything
✅ Simpler, faster, cleaner!

Example with 532 columns:
  Map 67 you need
  → Output has 67 columns
  → 465 others automatically excluded
  → Done!
```

---

## FAQ

### Q: Do I need to map all 532 columns?
```
A: NO! Only map the ones you need (e.g., 67)
   The other 465 are automatically excluded.
```

### Q: What happens to unmapped columns?
```
A: They're automatically excluded from the output.
   No need to do anything with them.
```

### Q: Do I need to click "Skip"?
```
A: NO! If you don't map a column, it's automatically skipped.
   No need to explicitly set anything to "skip".
```

### Q: How do I find the columns I need?
```
A: Use the "Left to Assign ▼" dropdown!
   It shows all unmapped columns.
   Click the one you need → Page scrolls to it.
```

### Q: What if I change my mind later?
```
A: Edit the configuration:
   1. Go back to Configuration page
   2. Upload the file again
   3. Modify your mappings
   4. Save
   5. Download with new columns
```

### Q: Will the output file be smaller?
```
A: Yes! Much smaller!
   Only includes the 67 columns you need.
   Example: 67 columns instead of 532
   = smaller file size = faster processing
```

---

## Summary Table

| Old Way | New Way |
|---------|---------|
| Map 67 + Skip 465 = 532 actions | Map 67 only = 67 actions |
| Complex workflow | Simple workflow |
| Tedious for large files | Easy even with 1000+ columns |
| Same result | Same result |
| **Slower** | **Faster** |

---

## Get Started Now!

### 3 Steps to Success

**Step 1:** Upload your file
```
System detects 532 columns
Shows "Left to Assign: 465"
```

**Step 2:** Click "Left to Assign ▼" and map what you need
```
Find columns like "voltage_phase_a", "kw", "frequency"
Click them
Map to standards
```

**Step 3:** Save and download
```
Only your 67 mapped columns in the output
Rest automatically excluded
Done!
```

---

**No need to configure every single column - just map what you use!** 🎯✨

