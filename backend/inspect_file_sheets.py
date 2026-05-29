import pathlib
import pandas as pd

def inspect_excel(filename):
    filepath = pathlib.Path(r"c:\Users\risha\Desktop\ai-power-quality-analyzer\sample file") / filename
    print(f"=== Inspecting {filename} ===")
    xls = pd.ExcelFile(filepath)
    print("Sheets:", xls.sheet_names)
    for name in xls.sheet_names:
        df = pd.read_excel(xls, name, header=None)
        print(f"Sheet '{name}': shape={df.shape}")
        # print first 5 rows and 5 columns
        print(df.iloc[:5, :5])
        print("-" * 50)

if __name__ == "__main__":
    inspect_excel("sample_alm_45.xlsx")
