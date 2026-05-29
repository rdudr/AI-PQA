# How to View Mapped Column Data - See Your Mappings

**Where to find the actual mapping data on the Configuration Page**

---

## 📍 The Statistics Bar You're Looking At

```
┌──────────────────────────────────────────────────────────────────┐
│  TOTAL COLUMNS    │    ASSIGNED        │   LEFT TO ASSIGN    │ PROGRESS    │
│       532         │      67 columns    │     465 unmatched   │  13%        │
│                   │      mapped        │     columns    ▼    │  complete   │
└──────────────────────────────────────────────────────────────────┘
```

**This bar shows the COUNTS, but not the actual mappings.**

---

## 🔍 Where to See the ACTUAL MAPPING DATA

### **Scroll Down to See the Mapping Table**

Below the statistics bar, you'll find the **actual column data**:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    FILE COLUMN      │ SHEET  │ MAPS TO (STANDARD)  │   TYPE    │
│   ─────────────────────────────────────────────────────────────│
│                                                                 │
│   URMS_L1           │  CSV   │ voltage_phase_a     │  Data     │
│   URMS_L2           │  CSV   │ voltage_phase_b     │  Data     │
│   URMS_L3           │  CSV   │ voltage_phase_c     │  Data     │
│   IRMS_L1           │  CSV   │ current_phase_a     │  Data     │
│   IRMS_L2           │  CSV   │ current_phase_b     │  Data     │
│   IRMS_L3           │  CSV   │ current_phase_c     │  Data     │
│   kW_3P             │  CSV   │ kw                  │  Data     │
│   kVA_3P            │  CSV   │ kva                 │  Data     │
│   PF_3P             │  CSV   │ pf                  │  Data     │
│   Freq_Avg          │  CSV   │ frequency           │  Data     │
│   THDV_1            │  CSV   │ vthd_a              │  Data     │
│   THDV_2            │  CSV   │ vthd_b              │  Data     │
│   THDV_3            │  CSV   │ vthd_c              │  Data     │
│   THDI_1            │  CSV   │ ithd_a              │  Data     │
│   THDI_2            │  CSV   │ ithd_b              │  Data     │
│   THDI_3            │  CSV   │ ithd_c              │  Data     │
│   Equipment_ID      │  CSV   │ NA                  │  Marker   │
│   Plant_Location    │  CSV   │ NA                  │  Marker   │
│   ... (49 more)     │  CSV   │ ...                 │  ...      │
│                                                                 │
│   [Scroll down to see all 67 mapped columns]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Understanding the Mapping Table Columns

### Column 1: **FILE COLUMN**
```
What: Name of column from your input file
Examples:
├─ URMS_L1 (your device's name)
├─ IRMS_L1 (your device's name)
├─ kW_3P (your device's name)
└─ Equipment_ID (your device's name)
```

### Column 2: **SHEET**
```
What: Which sheet this column comes from
Examples:
├─ CSV (for CSV files)
├─ Sheet1 (for Excel files)
├─ Sheet2 (for multi-sheet Excel)
└─ Data (for named sheets)
```

### Column 3: **MAPS TO (STANDARD)**
```
What: The standardized name it will use in output
Examples:
├─ voltage_phase_a (standard name)
├─ current_phase_a (standard name)
├─ kw (standard name)
├─ frequency (standard name)
├─ vthd_a (standard name)
├─ ithd_a (standard name)
├─ NA (metadata marker)
└─ (empty if not mapped yet)
```

### Column 4: **TYPE**
```
What: Purpose of this column
├─ Data: Measurement values (voltage, current, etc.)
│  └─ Will have real numbers in output
│
├─ Marker: Metadata or identifier
│  └─ Will have NA values in output
│  └─ For tracking/identification
│
└─ (empty if not yet assigned)
```

---

## 🎯 Reading the Actual Mapping Data

### Example: Your 67 Mapped Columns

```
FILE COLUMN NAME    │ MAPS TO (What it becomes)  │ TYPE
────────────────────────────────────────────────────────────
URMS_L1             │ voltage_phase_a            │ Data
  ↓                   ↓
Your device calls    Becomes this standard name
this URMS_L1         in your Excel output

IRMS_L1             │ current_phase_a            │ Data
  ↓                   ↓
Your device calls    Becomes this standard name
this IRMS_L1         in your Excel output

kW_3P               │ kw                         │ Data
  ↓                   ↓
Your device calls    Becomes this standard name
this kW_3P           in your Excel output

Equipment_ID        │ NA                         │ Marker
  ↓                   ↓
Your device calls    Metadata field - all NA
this Equipment_ID    values in output
```

---

## 📈 How to View All 67 Mappings

### Step 1: Scroll Down on Configuration Page
```
After the statistics bar (532 | 67 | 465 | 13%)
                          ↓
You'll see the mapping table start

FILE COLUMN │ SHEET │ MAPS TO │ TYPE
────────────────────────────────────
URMS_L1     │ CSV   │ voltage │ Data
URMS_L2     │ CSV   │ voltage │ Data
...
```

### Step 2: Scroll Within the Table
```
The table shows multiple rows
You can scroll down to see more mappings

Usually shows:
├─ First 20 mappings on screen
├─ Scroll down for more
└─ Total: 67 mappings all listed
```

### Step 3: See All Mapped Columns
```
Table lists all 67 mapped columns:

┌─ Voltage mappings (URMS_L1, URMS_L2, URMS_L3)
├─ Current mappings (IRMS_L1, IRMS_L2, IRMS_L3)
├─ Power mappings (kW_3P, kVA_3P, PF_3P)
├─ Frequency mapping (Freq_Avg)
├─ THD voltage mappings (THDV_1, THDV_2, THDV_3)
├─ THD current mappings (THDI_1, THDI_2, THDI_3)
├─ Harmonic mappings (U12_FH01...U12_FH25, etc.)
├─ Phase B harmonics (U23_FH01...U23_FH25, etc.)
├─ Phase C harmonics (U31_FH01...U31_FH25, etc.)
├─ Current harmonics (A1_FH01...A3_FH25)
└─ Metadata mappings (Equipment_ID→NA, Plant_Location→NA)

Total: All 67 mappings displayed
```

---

## 💡 What You Can See in the Mapping Table

### Real Examples from Your Configuration

```
Your File Column    │ Maps To (Standard Name)    │ Type
──────────────────────────────────────────────────────────

URMS_L1             │ voltage_phase_a            │ Data
URMS_L2             │ voltage_phase_b            │ Data
URMS_L3             │ voltage_phase_c            │ Data

IRMS_L1             │ current_phase_a            │ Data
IRMS_L2             │ current_phase_b            │ Data
IRMS_L3             │ current_phase_c            │ Data

kW_3P               │ kw                         │ Data
kVA_3P              │ kva                        │ Data
PF_3P               │ pf                         │ Data

Freq_Avg            │ frequency                  │ Data

THDV_1              │ vthd_a                     │ Data
THDV_2              │ vthd_b                     │ Data
THDV_3              │ vthd_c                     │ Data

THDI_1              │ ithd_a                     │ Data
THDI_2              │ ithd_b                     │ Data
THDI_3              │ ithd_c                     │ Data

U12_FH01            │ u12_fh01                   │ Data
U12_FH03            │ u12_fh03                   │ Data
... (U12_FH25)

U23_FH01            │ u23_fh01                   │ Data
U23_FH03            │ u23_fh03                   │ Data
... (U23_FH25)

U31_FH01            │ u31_fh01                   │ Data
U31_FH03            │ u31_fh03                   │ Data
... (U31_FH25)

A1_FH01             │ a1_fh01                    │ Data
A1_FH03             │ a1_fh03                    │ Data
... (A1_FH25)

A2_FH01             │ a2_fh01                    │ Data
A2_FH03             │ a2_fh03                    │ Data
... (A2_FH25)

A3_FH01             │ a3_fh01                    │ Data
A3_FH03             │ a3_fh03                    │ Data
... (A3_FH25)

Equipment_ID        │ NA                         │ Marker
Plant_Location      │ NA                         │ Marker

─────────────────────────────────────────────────────────

Total: 67 mappings (all shown in table)
```

---

## 🔍 How to Find Specific Mapping Data

### Method 1: Scroll Through the Table
```
1. Go to Configuration Page
2. Upload your sample file
3. Scroll down to see mapping table
4. Read the columns: FILE COLUMN → MAPS TO
5. See which of your columns map to which standards
```

### Method 2: Use "Left to Assign" Dropdown
```
1. Click "Left to Assign ▼" at top
2. See 465 unmapped columns
3. To find a specific one:
   - Look for it in the dropdown
   - Click it
   - Page scrolls to that row in the table
   - See what it maps to (or if not mapped yet)
```

### Method 3: Search Within the Page
```
Use browser's Find function (Ctrl+F or Cmd+F):
1. Press Ctrl+F
2. Type the column name (e.g., "URMS_L1")
3. Browser highlights it in the table
4. See which row it's in
5. Read the mapping
```

---

## 📊 Complete Mapping Summary Example

### What You'll See After Scrolling

```
MAPPING SUMMARY SECTION (Below the table)
┌─────────────────────────────────────────────────────┐
│                                                     │
│  FILE COLUMN    │ SHEET │ MAPS TO   │ TYPE         │
│  ─────────────────────────────────────────────────  │
│  URMS_L1        │ CSV   │ voltage_  │ Data         │
│                 │       │ phase_a   │              │
│                                                     │
│  URMS_L2        │ CSV   │ voltage_  │ Data         │
│                 │       │ phase_b   │              │
│                                                     │
│  IRMS_L1        │ CSV   │ current_  │ Data         │
│                 │       │ phase_a   │              │
│                                                     │
│  ... (64 more mappings shown)                       │
│                                                     │
│  Total: 67 columns mapped                          │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Columns in Output: 67                        │  │
│  │ NA Columns: 300                              │  │
│  │ Skipped: 165                                 │  │
│  │ Output Rows: Auto from file                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  This is the mapping data for your                 │
│  67 columns that will be in output Excel!          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Summary: Where to Find Mapping Data

### On the Configuration Page, You'll Find:

**1. Statistics Bar (Top):**
```
Shows: 532 total | 67 assigned | 465 left | 13% progress
Purpose: Overview of configuration status
```

**2. Mapping Table (Middle - Scroll Down):**
```
Shows: All 67 mapped columns with their mappings
Format: FILE COLUMN → MAPS TO → TYPE
Purpose: See exactly which columns map to which standards
```

**3. Mapping Summary (Bottom):**
```
Shows: Summary statistics and download preview
Format: Visual grid showing output structure
Purpose: Confirm what will be in your output Excel
```

---

## 🎯 To See Your Mapping Data Right Now:

1. **Go to Configuration Page**
2. **Upload your sample file** → 532 columns detected
3. **Scroll down** past the statistics bar
4. **You'll see the mapping table:**
   ```
   FILE COLUMN │ MAPS TO (Standard Name) │ TYPE
   ────────────────────────────────────────────
   URMS_L1     │ voltage_phase_a         │ Data
   URMS_L2     │ voltage_phase_b         │ Data
   URMS_L3     │ voltage_phase_c         │ Data
   IRMS_L1     │ current_phase_a         │ Data
   ... (63 more)
   ```

5. **Continue scrolling** to see all 67 mappings

This table shows you **exactly which columns you've mapped and what they map to**! 📊

---

## 💾 Your Mapping Data Will Show:

✅ All 67 columns you've configured  
✅ Their original file names (URMS_L1, IRMS_L1, kW_3P, etc.)  
✅ Their standard names (voltage_phase_a, current_phase_a, kw, etc.)  
✅ Their type (Data, Marker, or Skipped)  
✅ Whether they'll be in output Excel  

**All the mapping data you need is right there in the table!** 🎉

