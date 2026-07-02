import sys
import pathlib
import json

# Add backend directory to path
backend_dir = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from models.schema import AuditMetadata
from services.processing import process_multiple_files

def run_test():
    print("====================================================")
    print("  Testing Multi-File Ingestion, Merging & Gap Detection")
    print("====================================================")

    # 1. Load raw test data from fixtures
    fixtures_dir = backend_dir / "fixtures"
    hioki_path = fixtures_dir / "hioki_sample.csv"
    fluke_path = fixtures_dir / "fluke_sample.csv"

    if not hioki_path.exists() or not fluke_path.exists():
        print("Error: Test fixtures hioki_sample.csv or fluke_sample.csv are missing!")
        sys.exit(1)

    hioki_bytes = hioki_path.read_bytes()
    fluke_bytes = fluke_path.read_bytes()

    # 2. Build multi-file inputs
    # hioki_sample date: 2024-06-01 08:00:00 and 08:01:00
    # fluke_sample date: 2024-06-01 09:00:00
    # This creates a ~59-minute gap which should be detected.
    files_data = [
        {
            "filename": "hioki_sample.csv",
            "raw_bytes": hioki_bytes,
            "model_name": "hioki"
        },
        {
            "filename": "fluke_sample.csv",
            "raw_bytes": fluke_bytes,
            "model_name": "fluke"
        }
    ]

    metadata = AuditMetadata(
        pq_analyzer_type="Auto-detect",
        custom_analyzer_name="",
        company_name="Test Corp",
        plant_name="Test Plant",
        address="123 Test St",
        machine_name="Test Machine",
        engineer_name="Test Engineer",
        audit_date="2026-07-02"
    )

    # 3. Call multi-file processing
    print("-> Processing batch of 2 files...")
    response = process_multiple_files(files_data, metadata)

    # 4. Verify results
    print("\nVerification Checks:")
    print(f"  * ProcessResponse generated successfully. Session ID: {response.session_id}")
    print(f"  * Filename field matches: '{response.filename}' (Expected: 'hioki_sample.csv + fluke_sample.csv')")
    
    # Expected row count: 2 (hioki) + 1 (fluke) = 3 rows
    print(f"  * Total merged rows: {response.total_rows} (Expected: 3)")
    assert response.total_rows == 3, f"Expected 3 rows, got {response.total_rows}"

    # Verify time sorting
    timestamps = [row.timestamp for row in response.rows]
    print(f"  * Sorted timestamps: {timestamps}")
    assert timestamps == sorted(timestamps), "Timestamps are not in chronological order!"

    # Verify gap detection
    custom = response.metadata.custom_fields
    print(f"  * Custom fields: {json.dumps(custom, indent=2)}")
    
    assert "power_off_gaps" in custom, "Power off gaps not found in custom metadata!"
    gaps = custom["power_off_gaps"]
    print(f"  * Gaps found: {len(gaps)}")
    assert len(gaps) == 1, f"Expected 1 gap, found {len(gaps)}"
    
    gap = gaps[0]
    print(f"    Gap start: {gap['start']}, end: {gap['end']}, duration: {gap['duration_seconds']}s")
    assert gap["start"] == "2024-06-01 08:01:00", f"Unexpected gap start: {gap['start']}"
    assert gap["end"] == "2024-06-01 09:00:00", f"Unexpected gap end: {gap['end']}"
    # 59 minutes = 3540 seconds
    assert gap["duration_seconds"] == 3540, f"Expected 3540 seconds gap, got {gap['duration_seconds']}"

    # Verify AI observation additions
    obs = response.ai_observations
    print(f"  * AI observations: {obs}")
    gap_alert = [o for o in obs if "tracking interrupted" in o.lower()]
    assert len(gap_alert) > 0, "No gap warning found in AI observations!"
    print(f"  * AI Gap Observation: '{gap_alert[0]}'")

    print("\n====================================================")
    print("  SUCCESS: Multi-file sequential merging, chronological")
    print("           sorting, and gap detection tests passed!")
    print("====================================================")

if __name__ == "__main__":
    run_test()
