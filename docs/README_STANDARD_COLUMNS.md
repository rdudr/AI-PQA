# Standard Columns & Parameter Names

## Overview
This document lists all available **"Maps to"** column names that can be configured in the Power Quality Analyzer. Developers need to create graphs and visualizations for each of these values.

---

## Complete List of Standard Columns

### **Basic Measurements**
These are fundamental power quality parameters:

- `timestamp` - Combined date and time of measurement
- `date` - Date of measurement (YYYY-MM-DD format)
- `time` - Time of measurement (HH:MM:SS format)
- `voltage_phase_a` - Voltage on Phase A
- `voltage_phase_b` - Voltage on Phase B
- `voltage_phase_c` - Voltage on Phase C
- `current_phase_a` - Current on Phase A
- `current_phase_b` - Current on Phase B
- `current_phase_c` - Current on Phase C
- `frequency` - Power frequency (Hz)
- `pf` - Power Factor

---

### **Power Values**
Energy consumption and generation metrics:

- `kw` - Real Power (kilowatts)
- `kva` - Apparent Power (kilovolt-amperes)
- `kvar` - Reactive Power (kilovolt-amperes reactive)
- `nkvar` - Non-Linear Reactive Power
- `dkvar` - Distortion Reactive Power
- `dpf` - Displacement Power Factor

---

### **Total Harmonic Distortion (THD)**
Voltage and current harmonics quality:

- `vthd_a` - Voltage THD on Phase A
- `vthd_b` - Voltage THD on Phase B
- `vthd_c` - Voltage THD on Phase C
- `ithd_a` - Current THD on Phase A
- `ithd_b` - Current THD on Phase B
- `ithd_c` - Current THD on Phase C

---

### **Voltage Harmonic Parameters - U12 (Phase 1-2)**
Voltage harmonics between Phase 1 and Phase 2 (ODD only: 01, 03, 05... 25):

- `U12_%FH01` - U12 Harmonic 01 (Fundamental)
- `U12_%FH03` - U12 Harmonic 03
- `U12_%FH05` - U12 Harmonic 05
- `U12_%FH07` - U12 Harmonic 07
- `U12_%FH09` - U12 Harmonic 09
- `U12_%FH11` - U12 Harmonic 11
- `U12_%FH13` - U12 Harmonic 13
- `U12_%FH15` - U12 Harmonic 15
- `U12_%FH17` - U12 Harmonic 17
- `U12_%FH19` - U12 Harmonic 19
- `U12_%FH21` - U12 Harmonic 21
- `U12_%FH23` - U12 Harmonic 23
- `U12_%FH25` - U12 Harmonic 25

---

### **Voltage Harmonic Parameters - U23 (Phase 2-3)**
Voltage harmonics between Phase 2 and Phase 3 (ODD only: 01, 03, 05... 25):

- `U23_%FH01` - U23 Harmonic 01 (Fundamental)
- `U23_%FH03` - U23 Harmonic 03
- `U23_%FH05` - U23 Harmonic 05
- ... (continues odd numbers)
- `U23_%FH25` - U23 Harmonic 25

---

### **Voltage Harmonic Parameters - U31 (Phase 3-1)**
Voltage harmonics between Phase 3 and Phase 1 (ODD only: 01, 03, 05... 25):

- `U31_%FH01` - U31 Harmonic 01 (Fundamental)
- `U31_%FH03` - U31 Harmonic 03
- `U31_%FH05` - U31 Harmonic 05
- ... (continues odd numbers)
- `U31_%FH25` - U31 Harmonic 25

---

### **Current Harmonic Parameters - A1 (Phase 1)**
Current harmonics on Phase 1 (ODD only: 01, 03, 05... 25):

- `A1_%FH01` - A1 Harmonic 01 (Fundamental)
- `A1_%FH03` - A1 Harmonic 03
- `A1_%FH05` - A1 Harmonic 05
- ... (continues odd numbers)
- `A1_%FH25` - A1 Harmonic 25

---

### **Current Harmonic Parameters - A2 (Phase 2)**
Current harmonics on Phase 2 (ODD only: 01, 03, 05... 25):

- `A2_%FH01` - A2 Harmonic 01 (Fundamental)
- `A2_%FH03` - A2 Harmonic 03
- `A2_%FH05` - A2 Harmonic 05
- ... (continues odd numbers)
- `A2_%FH25` - A2 Harmonic 25

---

### **Current Harmonic Parameters - A3 (Phase 3)**
Current harmonics on Phase 3 (ODD only: 01, 03, 05... 25):

- `A3_%FH01` - A3 Harmonic 01 (Fundamental)
- `A3_%FH03` - A3 Harmonic 03
- `A3_%FH05` - A3 Harmonic 05
- ... (continues odd numbers)
- `A3_%FH25` - A3 Harmonic 25

---

### **Voltage RMS Min/Max**
Voltage amplitude variations (phase-to-phase):

- `Urms12_min` - Minimum RMS Voltage (Phase 1-2)
- `Urms12_max` - Maximum RMS Voltage (Phase 1-2)
- `Urms23_min` - Minimum RMS Voltage (Phase 2-3)
- `Urms23_max` - Maximum RMS Voltage (Phase 2-3)
- `Urms31_min` - Minimum RMS Voltage (Phase 3-1)
- `Urms31_max` - Maximum RMS Voltage (Phase 3-1)

---

### **Current RMS Min/Max**
Current amplitude variations:

- `Arms1_min` - Minimum RMS Current (Phase 1)
- `Arms1_max` - Maximum RMS Current (Phase 1)
- `Arms2_min` - Minimum RMS Current (Phase 2)
- `Arms2_max` - Maximum RMS Current (Phase 2)
- `Arms3_min` - Minimum RMS Current (Phase 3)
- `Arms3_max` - Maximum RMS Current (Phase 3)

---

### **Special Values**
Not Available marker:

- `NA` - Not Available (use when data doesn't apply)

---

## Total Count

| Category | Count |
|----------|-------|
| Basic Measurements | 11 |
| Power Values | 6 |
| THD Parameters | 6 |
| Voltage Harmonics U12 (ODD: 01,03,05...25) | 13 |
| Voltage Harmonics U23 (ODD: 01,03,05...25) | 13 |
| Voltage Harmonics U31 (ODD: 01,03,05...25) | 13 |
| Current Harmonics A1 (ODD: 01,03,05...25) | 13 |
| Current Harmonics A2 (ODD: 01,03,05...25) | 13 |
| Current Harmonics A3 (ODD: 01,03,05...25) | 13 |
| Voltage RMS Min/Max | 6 |
| Current RMS Min/Max | 6 |
| Special Values | 1 |
| **TOTAL STANDARD** | **114** |
| **+ Custom Columns** | **Unlimited** |

---

## Custom Column Mapping

### Feature
If you have columns with the same name across different sheets but with different values, or columns that don't fit the standard list:

**At the bottom of the Configuration page**, you can:
1. **Enter Column Name** - The exact name from your CSV/XLSX file
2. **Select Source Sheet** - Which sheet/page this column comes from
3. **Assign Maps To** - Custom name for this column (e.g., `CUSTOM_01`, `CUSTOM_PARAM_X`)
4. **Add to Configuration** - The custom mapping is added and saved

### Example Use Cases
- Same column name on two different sheets with different data → Create two custom mappings pointing to different sheets
- Non-standard parameter from equipment → Create custom "Maps to" name
- Temporary measurement column → Map it with custom naming convention

### Custom Column List
All custom columns are displayed in a table on the configuration page showing:
- Column Name (from file)
- Source Sheet
- Maps To (custom assignment)
- Action (Remove if needed)

---

## Developer Graph Requirements

### For Each Parameter:
Developers should create visualizations for:

1. **Time Series Graph**
   - X-axis: Timestamp
   - Y-axis: Parameter value
   - Shows trend over time

2. **Min/Max/Avg Chart**
   - Display minimum, maximum, and average values
   - Useful for understanding variations

3. **Histogram/Distribution**
   - For understanding frequency distribution of values
   - Especially important for harmonic parameters

4. **Comparison Charts**
   - For phase parameters (A, B, C or R, Y, B)
   - Side-by-side or overlay comparison

5. **Summary Metrics**
   - Current value
   - Peak value
   - Average value
   - Standard deviation

---

## Implementation Notes

### Harmonics (U/A_%FH01-25)
- **Harmonic 01** = Fundamental frequency
- **Odd Harmonics Only** = 01, 03, 05, 07, 09, 11, 13, 15, 17, 19, 21, 23, 25 (13 total per phase)
- Zero-padded format (01, 03, 05, etc.)
- Typically measured as % of fundamental
- Essential for power quality assessment
- **Voltage Harmonics:** U12, U23, U31 (phase-to-phase)
- **Current Harmonics:** A1, A2, A3 (per phase)

### THD Parameters (vthd_a, b, c / ithd_a, b, c)
- Calculated from harmonic magnitudes
- Critical for identifying power quality issues
- Limits defined by standards (IEC, IEEE)

### Voltage RMS Min/Max (Urms12-31)
- Phase-to-phase voltage monitoring
- Detects voltage imbalance and sags/swells
- Important for equipment protection

### Current RMS Min/Max (Arms1-3)
- Phase current monitoring
- Detects overloading conditions
- Critical for thermal protection

---

## Configuration Workflow

1. **Upload** CSV/XLSX file with raw data
2. **Map Columns** - Assign file columns to standard names
3. **Select Source Page** - Choose which page/sheet for each column
4. **Save Configuration** - Settings stored for future uploads
5. **Visualize** - Graphs generated for all mapped parameters

---

## File Format Support

- **CSV** - Comma-separated values
- **XLSX** - Microsoft Excel
- **XLS** - Legacy Excel format

### Multi-Sheet Support
- Different analyzer exports may use multiple sheets
- Each column can be mapped to different sheets
- Timestamp may vary across sheets

---

## Next Steps for Developers

1. Review this list of 73 standard parameters
2. Create graph templates for each category
3. Implement visualization components
4. Configure dashboard layout
5. Add filtering and export options
6. Implement real-time monitoring views

---

## Questions?

Contact development team for:
- Graph design specifications
- Data export formats
- Real-time monitoring requirements
- Custom parameter additions
