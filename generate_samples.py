import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

def generate_sample(filename, rows=100):
    start_time = datetime(2024, 1, 1, 0, 0, 0)
    timestamps = [start_time + timedelta(minutes=i*10) for i in range(rows)]
    
    # Generic realistic PQ data
    data = {
        "Timestamp": [t.strftime("%Y-%m-%d %H:%M:%S") for t in timestamps],
        "V_A": np.random.normal(230, 2, rows),
        "V_B": np.random.normal(230, 2, rows),
        "V_C": np.random.normal(230, 2, rows),
        "I_A": np.random.normal(50, 5, rows),
        "I_B": np.random.normal(50, 5, rows),
        "I_C": np.random.normal(50, 5, rows),
        "kW": np.random.normal(30, 3, rows),
        "kVA": np.random.normal(35, 3, rows),
        "PF": np.random.uniform(0.85, 0.99, rows),
        "Frequency": np.random.normal(50, 0.05, rows),
        "VTHD_A": np.random.uniform(1.0, 3.5, rows),
        "VTHD_B": np.random.uniform(1.0, 3.5, rows),
        "VTHD_C": np.random.uniform(1.0, 3.5, rows),
        "ITHD_A": np.random.uniform(5.0, 15.0, rows),
        "ITHD_B": np.random.uniform(5.0, 15.0, rows),
        "ITHD_C": np.random.uniform(5.0, 15.0, rows),
    }
    
    df = pd.DataFrame(data)
    
    csv_path = os.path.join("sample file", f"{filename}.csv")
    excel_path = os.path.join("sample file", f"{filename}.xlsx")
    
    df.to_csv(csv_path, index=False)
    
    try:
        df.to_excel(excel_path, index=False)
    except ModuleNotFoundError:
        # If openpyxl is missing, print a warning but continue
        print(f"Warning: openpyxl not installed, skipping Excel generation for {filename}")

if __name__ == "__main__":
    analyzers = ["ALM 36", "ALM 31", "ALM 20", "ALM 45", "Hioki P3198"]
    for analyzer in analyzers:
        safe_name = analyzer.replace(" ", "_").lower()
        generate_sample(f"sample_{safe_name}")
        print(f"Generated samples for {analyzer}")
