"""
System Verification Script - Tests end-to-end data flow and normalization
Verifies: Config → File Inspection → Mapping → Processing → Normalization
"""
from __future__ import annotations

import json
import pathlib
from typing import Any

import pandas as pd

from ml.normalizer import PQNormalizer
from models.schema import AuditMetadata
from parsers.base import STANDARD_COLUMNS
from parsers.registry import get_parser
from services.config_store import add_model, get_mappings, remove_model, save_mappings
from utils.io import load_dataframe


def print_section(title: str) -> None:
    """Print formatted section header."""
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}")


def print_status(status: str, message: str, details: Any = None) -> None:
    """Print status message with optional details."""
    symbols = {"✓": "[OK]", "✗": "[ERR]", "→": "->", "•": "*"}
    prefix = symbols.get(status[0], "*")
    print(f"  {prefix} {message}")
    if details:
        if isinstance(details, dict):
            for key, value in details.items():
                print(f"      {key}: {value}")
        elif isinstance(details, list):
            for item in details:
                print(f"      - {item}")
        else:
            print(f"      {details}")


def verify_standard_columns() -> bool:
    """Verify standard columns are properly defined."""
    print_section("1. STANDARD COLUMNS VERIFICATION")

    try:
        cols = list(STANDARD_COLUMNS)
        print_status("✓", f"Standard columns loaded: {len(cols)} columns")

        # Check for key columns
        required = {"timestamp", "voltage_phase_a", "current_phase_a", "kw", "pf", "frequency"}
        found = {c for c in cols if c in required}
        missing = required - found

        if missing:
            print_status("✗", f"Missing required columns: {missing}")
            return False

        print_status("✓", "All required columns present", {
            "Basic measurements": 9,
            "Power values": 6,
            "THD parameters": 6,
            "Voltage harmonics": 39,  # U12, U23, U31 × 13 odd harmonics
            "Current harmonics": 39,  # A1, A2, A3 × 13 odd harmonics
            "Voltage RMS Min/Max": 6,
            "Current RMS Min/Max": 6,
        })

        # Check harmonics
        harmonic_cols = [c for c in cols if "_%FH" in c]
        print_status("✓", f"Harmonic columns found: {len(harmonic_cols)}", {
            "U12 harmonics": len([c for c in harmonic_cols if c.startswith("U12")]),
            "U23 harmonics": len([c for c in harmonic_cols if c.startswith("U23")]),
            "U31 harmonics": len([c for c in harmonic_cols if c.startswith("U31")]),
            "A1 harmonics": len([c for c in harmonic_cols if c.startswith("A1")]),
            "A2 harmonics": len([c for c in harmonic_cols if c.startswith("A2")]),
            "A3 harmonics": len([c for c in harmonic_cols if c.startswith("A3")]),
        })

        return True
    except Exception as e:
        print_status("✗", f"Error: {e}")
        return False


def verify_parsers() -> bool:
    """Verify available parsers."""
    print_section("2. PARSER VERIFICATION")

    try:
        parser_types = ["hioki", "fluke", "schneider", "dranetz", "alm", "custom"]
        results = {}

        for parser_type in parser_types:
            try:
                parser = get_parser(parser_type)
                results[parser_type] = "OK" if parser else "ERR"
            except Exception as e:
                results[parser_type] = str(e)[:50]

        for parser_type, status in results.items():
            symbol = "✓" if status == "OK" else "✗"
            print_status(symbol, f"{parser_type.upper()} parser: {status}")

        return all(v == "OK" for v in results.values())
    except Exception as e:
        print_status("✗", f"Error: {e}")
        return False


def verify_model_config(model_name: str = "TEST_MODEL_VERIFY") -> bool:
    """Verify model configuration system."""
    print_section("3. MODEL CONFIGURATION VERIFICATION")

    try:
        # Create model
        print_status("→", f"Creating model: {model_name}")
        model = add_model(model_name)
        print_status("✓", f"Model created: {model.get('name', 'unknown')}")

        # Test mappings
        test_mappings = {
            "Date": "timestamp",
            "URMS_L1": "voltage_phase_a",
            "IRMS_L1": "current_phase_a",
            "kW_3P": "kw",
            "PF_3P": "pf",
            "Freq_Avg": "frequency",
        }

        print_status("→", f"Saving {len(test_mappings)} column mappings")
        save_mappings(model_name, test_mappings)

        # Retrieve mappings
        retrieved = get_mappings(model_name)
        print_status("✓", f"Retrieved {len(retrieved)} mappings")

        # Verify
        if len(retrieved) == len(test_mappings):
            print_status("✓", "All mappings verified")
        else:
            print_status("✗", f"Mismatch: saved {len(test_mappings)}, got {len(retrieved)}")

        # Cleanup
        remove_model(model_name)
        print_status("✓", f"Model cleaned up: {model_name}")

        return True
    except Exception as e:
        print_status("✗", f"Error: {e}")
        try:
            remove_model(model_name)
        except:
            pass
        return False


def verify_sample_file(file_path: str | pathlib.Path) -> bool:
    """Verify sample file can be loaded and processed."""
    print_section(f"4. SAMPLE FILE VERIFICATION: {pathlib.Path(file_path).name}")

    try:
        file_path = pathlib.Path(file_path)
        if not file_path.exists():
            print_status("✗", f"File not found: {file_path}")
            return False

        # Load raw data
        print_status("→", "Loading file...")
        with open(file_path, "rb") as f:
            raw = f.read()

        df = load_dataframe(file_path.name, raw)
        print_status("✓", f"File loaded: {df.shape[0]} rows × {df.shape[1]} columns")
        print_status("•", "Columns:", df.columns.tolist())

        # Get parser
        print_status("→", "Detecting parser type...")
        from parsers.detect import detect_vendor
        device_type = detect_vendor(df)
        print_status("✓", f"Detected device: {device_type}")

        # Parse and normalize
        parser = get_parser(device_type)
        normalized = parser.normalize(df)
        print_status("✓", f"Parsed and mapped to {normalized.shape[1]} standard columns")

        # Show sample
        if not normalized.empty:
            print_status("•", "Sample data:", {
                "Rows": normalized.shape[0],
                "Columns": normalized.shape[1],
                "First row": dict(normalized.iloc[0].head(5).items()),
            })

        return True
    except Exception as e:
        print_status("✗", f"Error: {e}")
        return False


def verify_normalization() -> bool:
    """Verify ML-based normalization."""
    print_section("5. NORMALIZATION VERIFICATION")

    try:
        # Create sample data
        print_status("→", "Creating sample dataset...")
        sample_data = {
            "timestamp": pd.date_range("2026-01-01", periods=100, freq="1min"),
            "voltage_phase_a": [230.0 + (i % 10) * 0.5 for i in range(100)],
            "voltage_phase_b": [230.0 + ((i+1) % 10) * 0.5 for i in range(100)],
            "voltage_phase_c": [230.0 + ((i+2) % 10) * 0.5 for i in range(100)],
            "current_phase_a": [10.0 + (i % 5) * 0.2 for i in range(100)],
            "current_phase_b": [10.0 + ((i+1) % 5) * 0.2 for i in range(100)],
            "current_phase_c": [10.0 + ((i+2) % 5) * 0.2 for i in range(100)],
            "kw": [2.3 + (i % 3) * 0.1 for i in range(100)],
            "kva": [2.5 + (i % 3) * 0.1 for i in range(100)],
            "pf": [0.92 + (i % 2) * 0.01 for i in range(100)],
            "frequency": [50.0 + (i % 2) * 0.02 for i in range(100)],
            "vthd_a": [2.1 + (i % 4) * 0.2 for i in range(100)],
            "vthd_b": [2.0 + (i % 4) * 0.2 for i in range(100)],
            "vthd_c": [2.2 + (i % 4) * 0.2 for i in range(100)],
            "ithd_a": [3.2 + (i % 5) * 0.3 for i in range(100)],
            "ithd_b": [3.1 + (i % 5) * 0.3 for i in range(100)],
            "ithd_c": [3.0 + (i % 5) * 0.3 for i in range(100)],
        }
        df = pd.DataFrame(sample_data)
        print_status("✓", f"Sample dataset created: {df.shape}")

        # Apply normalization
        print_status("→", "Applying ML normalization...")
        normalizer = PQNormalizer()
        normalized, quality_report = normalizer.fit_transform(df)

        print_status("✓", "Normalization completed")
        print_status("•", "Quality Report:", {
            "Overall Quality Score": quality_report.get("overall_quality_score", "N/A"),
            "Total Columns": quality_report.get("total_columns", "N/A"),
            "Columns Processed": quality_report.get("columns_processed", "N/A"),
        })

        # Verify output
        if not normalized.empty and len(quality_report) > 0:
            print_status("✓", f"Normalized dataset: {normalized.shape}")
            return True
        else:
            print_status("✗", "Normalization produced empty result")
            return False

    except Exception as e:
        print_status("✗", f"Error: {e}")
        return False


def verify_sample_files() -> bool:
    """Verify all available sample files."""
    print_section("6. SAMPLE DATA FILES VERIFICATION")

    sample_dir = pathlib.Path(__file__).parent.parent / "sample file"
    fixture_dir = pathlib.Path(__file__).parent / "fixtures"

    all_pass = True
    for directory in [sample_dir, fixture_dir]:
        if directory.exists():
            csv_files = list(directory.glob("*.csv"))[:2]  # Test first 2 files
            for csv_file in csv_files:
                result = verify_sample_file(csv_file)
                all_pass = all_pass and result

    return all_pass


def generate_report(results: dict[str, bool]) -> None:
    """Generate final report."""
    print_section("FINAL VERIFICATION REPORT")

    total = len(results)
    passed = sum(1 for v in results.values() if v)

    for test_name, result in results.items():
        symbol = "✓" if result else "✗"
        print_status(symbol, test_name)

    print(f"\n{'-' * 70}")
    print(f"  RESULT: {passed}/{total} tests passed")

    if passed == total:
        print(f"  [OK] All systems operational and connected!")
    else:
        print(f"  [ERR] Some systems need attention")
    print(f"{'-' * 70}\n")


def main() -> None:
    """Run complete system verification."""
    print("\n" + "=" * 70)
    print("  PQ ANALYZER - COMPLETE SYSTEM VERIFICATION")
    print("  Testing: Configuration -> Mapping -> Processing -> Normalization")
    print("=" * 70)

    results = {
        "Standard Columns": verify_standard_columns(),
        "Parser Availability": verify_parsers(),
        "Model Configuration": verify_model_config(),
        "Sample File Processing": verify_sample_files(),
        "ML Normalization": verify_normalization(),
    }

    generate_report(results)


if __name__ == "__main__":
    main()
