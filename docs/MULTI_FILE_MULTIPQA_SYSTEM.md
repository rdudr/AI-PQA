# Multi-File Upload & Multi-Device PQ Analyzer Design

This document details the architectural plan to support:
1. **Multi-file sequential upload and merging** (e.g., handling cases where a Power Quality analyzer is turned off and on again, generating multiple separate data files).
2. **Multi-device transitions** (e.g., starting a measurement interval with an **ALM-45** and later replacing/continuing it with an **ALM-36** or **Hioki** model).
3. **Decoupled AI analytics** (ensuring that switching models or merging files does not affect or disturb the underlying AI/ML normalizer, event detection, or compliance calculation modules).

---

## 1. System Architecture Diagram

```mermaid
graph TD
    subgraph UI (Frontend)
        A[Multiple File Uploader] -->|Upload File 1 + Model 1| B(API Request Payload)
        A -->|Upload File 2 + Model 2| B
    end

    subgraph API & Parsing Layer (Backend)
        B --> C[upload.py API Endpoint]
        C --> D1[Parser Registry: Model 1]
        C --> D2[Parser Registry: Model 2]
        
        File1[File 1 Raw Data] --> D1
        File2[File 2 Raw Data] --> D2
        
        D1 -->|Normalize to Standard Schema| DF1[Standard DataFrame 1]
        D2 -->|Normalize to Standard Schema| DF2[Standard DataFrame 2]
    end

    subgraph Merging & Time Alignment
        DF1 --> E[Sequence Merger & Deduplicator]
        DF2 --> E
        E -->|Time Sort & Deduplicate| F[Merged Standard DataFrame]
        E -->|Track Off-times & Transitions| G[Audit Timeline & Metadata]
    end

    subgraph AI & Analytics Core
        F --> H[ML Normalizer & Outlier Remover]
        H --> I[Analytics Engine]
        H --> J[AI Observation Generator]
        H --> K[Dip/Swell Event Monitor]
    end

    subgraph Output
        I --> L[Unified Report & Charts]
        J --> L
        K --> L
        G --> L
    end
```

---

## 2. Decoupling Vendor Files from AI Models (Universal Schema)

The core secret to ensuring the **AI Models and main analytics are NOT disturbed** when adding new models (like ALM-36, Fluke, Hioki, etc.) is the **Universal Schema**. 

The system already utilizes a `BasePQParser` class to translate vendor-specific CSV/Excel columns into **standardized metrics**:

| Standard Canonical Name | Description |
| :--- | :--- |
| `timestamp` | Date and time (synchronized to ISO format) |
| `voltage_phase_a` / `b` / `c` | Three-phase line-to-line or scaled line-to-neutral voltages |
| `current_phase_a` / `b` / `c` | Three-phase current readings (converted from kA to Amperes if needed) |
| `kw` / `kva` / `kvar` | Active, apparent, and reactive power readings |
| `pf` / `frequency` | Power factor and electrical frequency |
| `vthd_a` / `b` / `c` | Voltage Total Harmonic Distortion |
| `ithd_a` / `b` / `c` | Current Total Harmonic Distortion |

### Why this protects the AI models:
- **No changes to AI**: The AI models (outlier detection, clustering, harmonic analysis, observations) **only look at these standard column names**. 
- **Parser Isolation**: Each analyzer (ALM-45, ALM-36, Hioki) has a small, self-contained parser or user-configured mapping that converts raw sheets to standard columns. The AI code does not know or care which device the data came from.
- **Easy Extension**: Adding a new PQ meter in the future only requires adding its header synonym names to `parsers/base.py` or mappings in `/config`, leaving all ML normalizers and dashboards completely intact.

---

## 3. Multi-File Sequential Merging (Handling Power Off/On)

When a PQ meter shuts down (due to a power cut or battery death) and starts again, it creates a second file. To present a unified report, we merge these files sequentially.

### The Backend Merging Strategy:
1. **Independent Parsing**: Each uploaded file is parsed and mapped according to its designated model.
2. **Metadata Tagging**: We add a tracking column `source_device_model` (e.g. `"ALM-45"`) and `source_file` (e.g. `"batch_01.csv"`) to each row of each DataFrame.
3. **Concatenation**: Combine the DataFrames using `pd.concat()`.
4. **Temporal Ordering**: Sort all records by the `timestamp` column.
5. **Deduplication**: If there is an overlap in timestamps between two files (e.g., if both loggers ran simultaneously for a few minutes), we deduplicate:
   ```python
   merged_df = merged_df.drop_duplicates(subset=["timestamp"], keep="first")
   ```
6. **Outage/Gap Detection**:
   We inspect the time delta between consecutive rows. If the gap exceeds a threshold (e.g., 5 times the median sampling interval), we identify a **Power Outage/Device Down Event**:
   ```python
   time_diffs = pd.to_datetime(merged_df["timestamp"]).diff()
   median_interval = time_diffs.median()
   gaps = time_diffs > (5 * median_interval)
   ```
   These gaps are returned in the response metadata so the frontend can display **"System Off Periods"** on the timeline.

---

## 4. Python Implementation Recipe (Backend)

Here is how we can implement this merging logic in `backend/services/processing.py`:

```python
import pandas as pd
import numpy as np
from datetime import datetime
from models.schema import AuditMetadata, ProcessResponse
from services.processing import process_bytes

def process_multiple_files(
    uploaded_files: list[tuple[str, bytes, str]],  # List of (filename, file_bytes, model_name)
    general_metadata: AuditMetadata
) -> ProcessResponse:
    parsed_dfs = []
    device_intervals = []

    for filename, raw_bytes, model_name in uploaded_files:
        # 1. Parse each file to standard schema using its model configuration
        df = parse_single_file_to_df(filename, raw_bytes, model_name)
        
        if df.empty:
            continue
            
        # 2. Append device/file source tracking
        df["source_device_model"] = model_name
        df["source_file"] = filename
        
        # Calculate time range for this file segment
        df_sorted = df.dropna(subset=["timestamp"]).sort_values("timestamp")
        if not df_sorted.empty:
            start_t = df_sorted["timestamp"].iloc[0]
            end_t = df_sorted["timestamp"].iloc[-1]
            device_intervals.append({
                "file": filename,
                "model": model_name,
                "start": str(start_t),
                "end": str(end_t)
            })
            
        parsed_dfs.append(df)

    if not parsed_dfs:
        raise ValueError("No valid PQ data found in uploaded files.")

    # 3. Concatenate and sort globally by timestamp
    combined_df = pd.concat(parsed_dfs, ignore_index=True)
    combined_df["timestamp"] = pd.to_datetime(combined_df["timestamp"])
    combined_df = combined_df.sort_values("timestamp").reset_index(drop=True)
    
    # 4. Deduplicate overlapping timestamps
    combined_df = combined_df.drop_duplicates(subset=["timestamp"], keep="first")
    
    # Convert timestamp back to standard ISO string format
    combined_df["timestamp"] = combined_df["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # 5. Detect Gaps/Off-times
    gaps = []
    ts_series = pd.to_datetime(combined_df["timestamp"])
    time_diffs = ts_series.diff()
    median_interval = time_diffs.median()
    
    # If gap is larger than e.g. 10 minutes or 5x the regular interval, mark it
    gap_threshold = max(pd.Timedelta(minutes=10), 5 * median_interval)
    gap_indices = time_diffs[time_diffs > gap_threshold].index
    
    for idx in gap_indices:
        gap_start = combined_df.loc[idx - 1, "timestamp"]
        gap_end = combined_df.loc[idx, "timestamp"]
        gaps.append({
            "start": gap_start,
            "end": gap_end,
            "duration_seconds": int((ts_series.loc[idx] - ts_series.loc[idx - 1]).total_seconds())
        })

    # 6. Pass the combined dataframe to the regular ML Normalizer and AI observer
    # The normalizer only sees STANDARD_COLUMNS, completely unaware of vendor details!
    normalizer = PQNormalizer()
    normalized, quality_report = normalizer.fit_transform(combined_df)
    
    # 7. Add multi-device details to final response metadata
    response = build_full_analytics_response(normalized, general_metadata, quality_report)
    response.metadata.custom_fields = {
        "device_transitions": device_intervals,
        "power_off_gaps": gaps,
        "merged_files_count": len(uploaded_files)
    }
    
    return response
```

---

## 5. UI Enhancements (Frontend)

To make the application look **state-of-the-art and highly premium**, the upload interface and dashboard will be enhanced:

### A. Multi-File Upload UI
Instead of a single file input, the `UploadPage.tsx` will display a dynamic list of files.
- Each uploaded file has a row showing:
  - **Filename and File Size**
  - **Model Dropdown** (allowing the user to choose `ALM-45` for file 1, and `ALM-36` for file 2, or let the backend auto-detect).
  - **Status Indicator** (green checkmark for "Parsed successfully", red for "Errors").
  - **Time Span Preview** (automatically extracted from the file headers, e.g., `2026-07-01 10:00 to 14:00`).

### B. Dashboard Timeline & Gap Warning
On the main dashboard page:
1. **Device Shift Indicator**: A small badge or timeline element showing the transition:
   > 🕒 **Audit Timeline**: 
   > - `10:00 - 14:00` monitored via **ALM-45**
   > - `14:00 - 14:30` 🔌 **Power Interruption / Gap Detected (30 mins)**
   > - `14:30 - 18:00` monitored via **ALM-36**
2. **Gap Alerts**: The AI observations panel can automatically output comments such as:
   > 💡 *System observed 1 power-down event between 14:00 and 14:30. Ensure PQ analyzer batteries are checked before audits.*

---

## 6. How it Looks in Action (Premium UI Design Mockup)

```
+-----------------------------------------------------------------------------------+
|  PHASE 2 - MEASUREMENT INTAKE                                                     |
|  Upload PQ Analyzer Exports                                                        |
|                                                                                   |
|  +------------------------------------------------------------------------------+ |
|  | [Drag & Drop Files Here]                                                     | |
|  +------------------------------------------------------------------------------+ |
|                                                                                   |
|  Uploaded Files:                                                                  |
|  +------------------------------------------------------------------------------+ |
|  | File Name            | File Size | Analyzer Model    | Detected Interval     | |
|  +----------------------+-----------+-------------------+-----------------------+ |
|  | [x] log_part_1.csv   | 4.2 MB    | [ ALM-45      v ] | 2026-07-01 10:00-14:00| |
|  | [x] log_part_2.csv   | 3.8 MB    | [ ALM-36      v ] | 2026-07-01 14:30-18:00| |
|  +----------------------+-----------+-------------------+-----------------------+ |
|                                                                                   |
|  Audit Details:                                                                   |
|  Company: [ Acme Industrial ]   Plant: [ Plant Alpha ]   Date: [ 2026-07-01 ]      |
|                                                                                   |
|  [ PROCESS & LAUNCH DASHBOARD ]                                                   |
+-----------------------------------------------------------------------------------+
```

This ensures maximum flexibility for audits, captures outages as actual data points, and **keeps all AI algorithms completely safe and independent of hardware shifts**.
