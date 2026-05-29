# "Left to Assign" Dropdown Guide

## New Feature: View Unmatched Columns List

The "Left to Assign" section in the Assignment Statistics Box now has a **down arrow (chevron)** that reveals which specific columns still need assignment.

---

## Visual Preview

### Before (Collapsed)
```
┌────────────────────────────────────────────────┐
│ Total: 532 │ Assigned: 45 │ Left to Assign ▼  │
│            │              │  465 unmatched     │
└────────────────────────────────────────────────┘
```

### After (Expanded - Click the arrow)
```
┌────────────────────────────────────────────────┐
│ Total: 532 │ Assigned: 45 │ Left to Assign ▲  │
│            │              │  465 unmatched     │
│            │              │                    │
│            │              │ ┌──────────────┐   │
│            │              │ │ URMS_L1 (CSV)│   │
│            │              │ │ URMS_L2 (CSV)│   │
│            │              │ │ IRMS_L1 (CSV)│   │
│            │              │ │ kW_3P (CSV)  │   │
│            │              │ │ ... (461 more)   │
│            │              │ └──────────────┘   │
│            │              │ (Scrollable list)  │
└────────────────────────────────────────────────┘
```

---

## How to Use

### Step 1: Click the Down Arrow
```
Located in the "Left to Assign" section of the statistics box
Click on: "Left to Assign ▼"
```

### Step 2: See the List
```
Dropdown appears showing all unmatched columns:
✓ Column name
✓ Which sheet it's from (e.g., "CSV", "Sheet1", etc.)
✓ Scrollable list (up to 465+ columns)
✓ Max height: 192px (shows ~8-10 columns at once)
```

### Step 3: Navigate to Column
```
Click on a column name in the list
→ Page automatically scrolls to that row in the mapping table
→ You can then assign it right away
```

---

## Features

### 🎯 Smart Column Filtering
```
List shows ONLY unmatched columns
✓ Columns set to "skip" → NOT shown
✓ Columns set to "NA" → NOT shown
✓ Columns already assigned → NOT shown
✓ Only truly unmatched columns displayed
```

### 🔄 Auto-Scroll to Column
```
Click any column in the dropdown
→ Page scrolls to that column's row in the table
→ Brings it to the center of the screen
→ You can immediately assign it
```

### 📌 Column Information
```
Each item shows:
- Column Name (e.g., "URMS_L1")
- Source Sheet (e.g., "(CSV)", "(Sheet1)", etc.)
- Click to navigate

Example:
  URMS_L1 (CSV) ← Column name and sheet
```

### 🎨 Interactive UI
```
Hovering over a column name:
✓ Background changes to lighter shade
✓ Shows it's clickable
✓ Smooth hover effect
```

---

## Example Workflow: 532-Column File

### Phase 1: File Uploaded
```
Statistics Box:
  Total: 532
  Assigned: 45
  Left to Assign: 465 ▼  ← Arrow visible
  Progress: 8%
```

### Phase 2: Click the Arrow
```
Left to Assign section expands
Shows list of 465 unmatched columns:
  1. Custom_Parameter_001 (CSV)
  2. Custom_Parameter_002 (CSV)
  3. Custom_Parameter_003 (CSV)
  4. Equipment_ID (CSV)
  5. Plant_Location (CSV)
  ... (460 more)
```

### Phase 3: Click a Column
```
Click on: "Equipment_ID (CSV)"
→ Page scrolls to that row
→ "Equipment_ID" row highlighted
→ You can now:
   - Set to "skip"
   - Set to "NA"
   - Assign to a standard column
```

### Phase 4: Assign It
```
Click "Maps to" dropdown
→ Select your choice
→ Click elsewhere to confirm
→ Column removed from "Left to Assign" list
→ Statistics update: 466 → 465 → 464 ...
```

### Phase 5: Repeat
```
Keep expanding list and clicking columns
Track progress in statistics box
465 → 400 → 300 → 200 → 100 → 0 ✓
```

---

## Tips & Tricks

### 🔍 Finding a Specific Column
```
Don't scroll through 465 columns:
1. Click "Left to Assign ▼" to open list
2. Look for your column name
3. Click it → Page scrolls directly to it
4. Assign immediately
```

### ⚡ Speed Up Assignment
```
1. Review "Left to Assign" list
2. Identify groups:
   - Temperature columns → all "skip"
   - ID columns → all "NA"
   - Measurement columns → assign to standards
3. Assign by group for efficiency
```

### 📊 Track Your Progress
```
Start: 465 unmatched
  ↓ Assign 100 columns
After: 365 unmatched (in list)
  ↓ Assign 200 columns
After: 165 unmatched (in list)
  ↓ Assign 165 columns
After: 0 unmatched ✓ DONE!
```

### 🔄 Collapse When Not Needed
```
Click the arrow again: ▼ → ▲
List collapses
Saves space on screen
Statistics box goes back to compact size
```

---

## Responsive Design

### Desktop View
```
"Left to Assign" section shows:
- Label with dropdown arrow
- Count: "465 unmatched columns"
- Expandable list below
```

### Tablet View
```
"Left to Assign" section shows:
- Same as desktop
- Adjusted padding for smaller screen
- List still scrollable
```

### Mobile View
```
"Left to Assign" section shows:
- Stacked layout
- Full-width list when expanded
- Touch-friendly target areas
```

---

## Column List Details

### What's Included
```
✅ Column name (exact as in file)
✅ Source sheet (where it comes from)
✅ Unmatched status (no assignment yet)
```

### What's Excluded
```
❌ Already assigned columns
❌ Columns set to "skip"
❌ Columns set to "NA"
❌ Auto-detected columns (unless later unmapped)
```

### List Behavior
```
✓ Scrollable (max height: 192px)
✓ Shows ~8-10 columns at once
✓ Smooth scrolling
✓ Updates in real-time as you assign
```

---

## Real-Time Updates

### When You Assign a Column
```
Before:
  Left to Assign: 465 columns
  List shows:
    ├─ Column_A
    ├─ Column_B
    ├─ Column_C
    └─ ... 462 more

Click "Column_B" row → Assign to "voltage_phase_a"

After:
  Left to Assign: 464 columns ← Count updated
  List shows:
    ├─ Column_A
    ├─ Column_C  ← Column_B removed
    └─ ... 461 more
```

### When You Skip a Column
```
Setting a column to "skip":
✓ Removes from "Left to Assign" list
✓ Count decreases (465 → 464)
✓ But column NOT counted as "assigned"
✓ Won't appear in exported data
```

### When You Mark as NA
```
Setting a column to "NA":
✓ Removes from "Left to Assign" list
✓ Count decreases (465 → 464)
✓ Column marked as "assigned" (for stats)
✓ Will appear in exported data as "NA" values
```

---

## Performance Notes

### Large Lists (500+ columns)
```
✓ Smooth scrolling even with 465+ items
✓ No lag when clicking columns
✓ Auto-scroll is instant
✓ Efficient rendering
```

### Memory Usage
```
✓ Minimal impact on browser memory
✓ List only generated when expanded
✓ Collapsed when not in use
```

---

## Accessibility

### Keyboard Support
```
✓ Tab key navigates between columns
✓ Enter key selects and scrolls
✓ Escape key closes dropdown (future enhancement)
```

### Screen Reader Support
```
✓ Column names announced clearly
✓ Sheet information included
✓ "Unmatched column" status indicated
```

### Visual Indicators
```
✓ Chevron rotates when expanding/collapsing
✓ Hover effect shows clickability
✓ Smooth animations for clarity
```

---

## Summary

| Feature | Benefit |
|---------|---------|
| **Down Arrow** | See which columns are unmatched |
| **Column List** | Know exactly what needs assignment |
| **Auto-Scroll** | Quickly navigate to columns |
| **Real-Time** | List updates as you work |
| **Responsive** | Works on all screen sizes |

---

## Example: Complete Workflow

### Start with 532 columns
```
1. Upload file
   ↓
2. See: "Left to Assign: 465 ▼"
   ↓
3. Click arrow to see list
   ↓
4. Find "Equipment_ID" in list
   ↓
5. Click "Equipment_ID (CSV)"
   ↓
6. Page scrolls to that row
   ↓
7. Click "Maps to" dropdown
   ↓
8. Select "NA" (for metadata)
   ↓
9. Dropdown closes, list updates
   ↓
10. "Left to Assign: 464 ▼" (one less)
    ↓
11. Repeat until 0 left to assign
    ↓
12. All 532 columns assigned! ✅
```

---

**The "Left to Assign" dropdown makes managing 500+ columns effortless!** 🎯

