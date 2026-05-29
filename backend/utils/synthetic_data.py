"""Generate synthetic PQ analyzer data for testing."""
from __future__ import annotations

import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


def generate_synthetic_pq_data(
    rows: int = 10000,
    intervals_minutes: int = 1,
) -> pd.DataFrame:
    """
    Generate synthetic power quality analyzer data.

    Args:
        rows: Number of rows to generate
        intervals_minutes: Time between samples

    Returns:
        DataFrame with realistic PQ data
    """
    # Time series
    start_time = datetime.now() - timedelta(hours=(rows * intervals_minutes / 60))
    timestamps = [
        (start_time + timedelta(minutes=i * intervals_minutes)).isoformat()
        for i in range(rows)
    ]

    # Base nominal values
    v_nominal = 230.0  # Phase voltage
    f_nominal = 50.0   # Frequency Hz

    # Generate realistic variations
    data = {
        "timestamp": timestamps,
        "voltage_phase_a": [],
        "voltage_phase_b": [],
        "voltage_phase_c": [],
        "current_phase_a": [],
        "current_phase_b": [],
        "current_phase_c": [],
        "kw": [],
        "kva": [],
        "pf": [],
        "frequency": [],
        "vthd_a": [],
        "vthd_b": [],
        "vthd_c": [],
        "ithd_a": [],
        "ithd_b": [],
        "ithd_c": [],
    }

    for i in range(rows):
        # Voltage variations (mostly nominal with occasional dips/swells)
        base_v = v_nominal
        if random.random() < 0.05:  # 5% chance of dip/swell
            base_v *= random.uniform(0.88, 1.12)

        # Three-phase with 120° offset + noise
        v_a = base_v + np.sin(i * 0.05) * 2 + random.gauss(0, 0.5)
        v_b = base_v + np.sin(i * 0.05 - 2.094) * 2 + random.gauss(0, 0.5)
        v_c = base_v + np.sin(i * 0.05 - 4.189) * 2 + random.gauss(0, 0.5)

        data["voltage_phase_a"].append(max(0, v_a))
        data["voltage_phase_b"].append(max(0, v_b))
        data["voltage_phase_c"].append(max(0, v_c))

        # Current variations (load pattern with harmonics)
        i_avg = 100 + np.sin(i * 0.01) * 30  # Daily load pattern
        i_a = max(0, i_avg + random.gauss(0, 5))
        i_b = max(0, i_avg + random.gauss(0, 5))
        i_c = max(0, i_avg + random.gauss(0, 5))

        data["current_phase_a"].append(i_a)
        data["current_phase_b"].append(i_b)
        data["current_phase_c"].append(i_c)

        # Power calculations
        pf = random.uniform(0.80, 0.98)
        kw = (v_a * i_a + v_b * i_b + v_c * i_c) / 3000 * pf
        kva = (v_a * i_a + v_b * i_b + v_c * i_c) / 3000

        data["kw"].append(max(0, kw))
        data["kva"].append(max(0, kva))
        data["pf"].append(max(0.70, min(1.0, pf)))

        # Frequency (mostly stable, occasional variations)
        freq = f_nominal + np.sin(i * 0.001) * 0.3 + random.gauss(0, 0.1)
        data["frequency"].append(freq)

        # THD values (percentage, typically 2-8%)
        thd_noise = random.gauss(0, 0.5)
        v_thd = max(0, 3.5 + np.sin(i * 0.02) * 1.5 + thd_noise)
        i_thd = max(0, 8.0 + np.sin(i * 0.015) * 3.0 + random.gauss(0, 1))

        data["vthd_a"].append(min(30, v_thd))
        data["vthd_b"].append(min(30, v_thd + random.gauss(0, 0.5)))
        data["vthd_c"].append(min(30, v_thd + random.gauss(0, 0.5)))

        data["ithd_a"].append(min(40, i_thd))
        data["ithd_b"].append(min(40, i_thd + random.gauss(0, 1)))
        data["ithd_c"].append(min(40, i_thd + random.gauss(0, 1)))

    return pd.DataFrame(data)


def save_synthetic_data(filepath: str, rows: int = 10000) -> str:
    """
    Generate and save synthetic test data.

    Args:
        filepath: Output file path
        rows: Number of rows

    Returns:
        Path to saved file
    """
    df = generate_synthetic_pq_data(rows)

    if filepath.lower().endswith(".csv"):
        df.to_csv(filepath, index=False)
    elif filepath.lower().endswith((".xlsx", ".xls")):
        df.to_excel(filepath, index=False, engine="openpyxl")
    else:
        filepath = filepath.replace(".txt", ".csv")
        df.to_csv(filepath, index=False)

    return filepath


if __name__ == "__main__":
    import sys

    rows = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    output = f"synthetic_pq_data_{rows}.csv"
    result = save_synthetic_data(output, rows)
    print(f"Generated {rows} rows of synthetic data in {result}")
