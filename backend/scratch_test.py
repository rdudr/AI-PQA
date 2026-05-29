import json
import pathlib
import sys

# Insert 'backend' directory in path
backend_dir = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from routes.upload import _read_all_pages_for_mapping, _apply_mappings_to_dataframe
from services.config_store import get_mappings, get_custom_columns
from services.processing import process_bytes, _generate_harmonic_spectrum
from models.schema import AuditMetadata

def test_run():
    filename = "21-05-2025 TR_LT ALM45.xlsx"
    filepath = pathlib.Path(r"c:\Users\risha\Desktop\ai-power-quality-analyzer\sample data\alm45") / filename
    
    with open(filepath, "rb") as f:
        raw = f.read()
        
    metadata = AuditMetadata(
        pq_analyzer_type="ALM-45",
        custom_analyzer_name="",
        company_name="Test Company",
        plant_name="Test Plant",
        address="",
        machine_name="",
        engineer_name="",
        audit_date=""
    )
    
    print("Reading sheets...")
    pages = _read_all_pages_for_mapping(filename, raw)
    print(f"Loaded {len(pages)} sheets: {[p['sheet_name'] for p in pages]}")
    
    user_mappings = get_mappings(metadata.pq_analyzer_type)
    user_custom_cols = get_custom_columns(metadata.pq_analyzer_type)
    
    print(f"Loaded mappings: {len(user_mappings)} main, {len(user_custom_cols)} custom")
    
    normalized = _apply_mappings_to_dataframe(
        pages,
        user_mappings,
        source_pages=None,
        custom_cols=user_custom_cols,
    )
    
    print("\nColumns in normalized DataFrame:")
    print(list(normalized.columns))
    
    print("\nChecking for current phase columns:")
    for col in ["current_phase_a", "current_phase_b", "current_phase_c"]:
        if col in normalized.columns:
            non_null = normalized[col].dropna()
            print(f"  {col}: {len(non_null)} non-null values, average: {non_null.mean() if len(non_null) > 0 else 'N/A'}")
        else:
            print(f"  {col}: MISSING")
            
    print("\nChecking for current harmonic columns (A1_%FH01, etc.):")
    harmonic_cols = [c for c in normalized.columns if c.startswith("A1_%FH") or c.startswith("A2_%FH") or c.startswith("A3_%FH")]
    print(f"  Found {len(harmonic_cols)} current harmonic columns:")
    for c in sorted(harmonic_cols)[:5]:
        non_null = normalized[c].dropna()
        print(f"    {c}: {len(non_null)} non-null values, average: {non_null.mean() if len(non_null) > 0 else 'N/A'}")
        
    print("\nRunning full process_bytes...")
    resp = process_bytes(filename, raw, metadata)
    print(f"Process success! session_id: {resp.session_id}")
    print(f"Response Columns: {resp.columns[:15]} ... total {len(resp.columns)}")
    print(f"Response rows length: {len(resp.rows)}")
    if resp.rows:
        first_row = resp.rows[0].model_dump()
        extra_fields = {k: v for k, v in first_row.items() if k not in ["timestamp", "voltage_phase_a", "voltage_phase_b", "voltage_phase_c", "current_phase_a", "current_phase_b", "current_phase_c"]}
        print(f"First row keys: {list(first_row.keys())[:10]}...")
        print(f"A1_%FH01 in first row: {'A1_%FH01' in first_row} (value: {first_row.get('A1_%FH01')})")
        print(f"a1_%FH01 in first row: {'a1_%FH01' in first_row} (value: {first_row.get('a1_%FH01')})")
        
        # Check if the extra fields are in model_extra
        row_obj = resp.rows[0]
        print(f"row_obj.model_extra: {list(row_obj.model_extra.keys()) if row_obj.model_extra else 'None'}")
    
    print(f"Voltage Spectrum points: {len(resp.voltage_harmonic_spectrum)}")
    print(f"Current Spectrum points: {len(resp.current_harmonic_spectrum)}")
    print(f"Current Harmonic Spectrum values: {[f'H{pt.order}:{pt.magnitude_pct:.2f}%' for pt in resp.current_harmonic_spectrum]}")

    print("\nTesting get_summaries endpoint...")
    from routes.analytics import get_summaries
    summaries_resp = get_summaries(resp.session_id)
    harmonics_summary = summaries_resp.harmonics
    print(f"Harmonics Summary title: {harmonics_summary.title}")
    print("Harmonics Summary rows (first 10):")
    for row in harmonics_summary.rows[:10]:
        print(f"  Order {row.order}: {row.magnitude_pct:.2f}%")

if __name__ == "__main__":
    test_run()
