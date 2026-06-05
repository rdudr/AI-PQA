"""Verify a local / offline install of the PQ Analyzer backend.

Run before the first server start to confirm every dependency is in
place and every parser can actually be loaded.  Prints a single
self-explanatory report and exits with code 0 if everything is healthy,
non-zero otherwise.

    python backend/check_install.py

Why this exists
---------------
The PQ Analyzer ships with code paths for legacy Excel (.xls via xlrd),
modern Excel (.xlsx via calamine / openpyxl), and vendor-specific
parsers.  An offline install that has been pip-installed only partially
(or against an older requirements.txt) may *appear* to start up fine
but silently 400 every file upload.  This script catches that before
your first user does.
"""
from __future__ import annotations

import io
import sys
import pathlib

# Allow `from utils...` imports when run as a top-level script
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))


def _ok(label: str, ok: bool, detail: str = "") -> bool:
    icon = "OK   " if ok else "FAIL "
    line = f"{icon} {label}"
    if detail:
        line += f"   {detail}"
    print(line)
    return ok


def main() -> int:
    print("=" * 56)
    print("AI Power Quality Analyzer — local install verification")
    print("=" * 56)
    all_ok = True

    # ── Core libraries ───────────────────────────────────────────────
    print("\n[1] Core dependencies")
    for mod in ("fastapi", "uvicorn", "pandas", "numpy", "pydantic"):
        try:
            m = __import__(mod)
            v = getattr(m, "__version__", "?")
            all_ok &= _ok(f"{mod}", True, f"v{v}")
        except ImportError as e:
            all_ok &= _ok(mod, False, str(e))

    # ── Excel engines ────────────────────────────────────────────────
    # Required: xlrd (.xls), openpyxl (.xlsx fallback), calamine (.xlsx primary)
    # Optional: pyxlsb (.xlsb — rare, only some Excel binary files)
    print("\n[2] Excel reading engines")
    from utils.excel_open import available_engines
    engines = available_engines()
    OPTIONAL = {"pyxlsb"}
    for k, v in engines.items():
        is_optional = k in OPTIONAL
        # Optional deps don't break the overall verdict
        if not is_optional:
            all_ok &= v
        detail = (
            "needed for .xls"          if k == "xlrd" and not v else
            "needed for .xlsx"         if k == "openpyxl" and not v else
            "needed for .xlsx / .xlsb" if k == "calamine" and not v else
            "optional (.xlsb only)"    if is_optional else ""
        )
        _ok(k, v or is_optional, detail)
    if not engines.get("xlrd"):
        print("        -> .xls uploads from the config page will be limited to calamine fallback")
    if not engines.get("calamine") and not engines.get("openpyxl"):
        all_ok = False
        print("        -> .xlsx uploads are BROKEN with no engine to read them")

    # ── Parsers loadable ─────────────────────────────────────────────
    print("\n[3] Built-in parser modules")
    for mod_name, cls in [
        ("parsers.alm",        "ALMParser"),
        ("parsers.hioki",      "HiokiParser"),
        ("parsers.fluke",      "FlukeParser"),
        ("parsers.schneider",  "SchneiderParser"),
        ("parsers.dranetz",    "DranetzParser"),
        ("parsers.custom_csv", "CustomCsvParser"),
    ]:
        try:
            mod = __import__(mod_name, fromlist=[cls])
            getattr(mod, cls)()
            all_ok &= _ok(f"{mod_name}.{cls}", True)
        except Exception as e:  # noqa: BLE001
            all_ok &= _ok(f"{mod_name}.{cls}", False, f"{type(e).__name__}: {e}")

    # ── Functional round-trip ────────────────────────────────────────
    print("\n[4] Functional round-trip (synthetic data)")
    try:
        import pandas as pd
        from parsers.alm import ALMParser
        df = pd.DataFrame({
            "Date Time":    ["2024-01-01 00:00:00"],
            "I1 (A)":       [50.0],
            "P sum (kW)":   [25.0],
            "PF sum":       [0.95],
            "U12 (V)":      [230.0],
        })
        out = ALMParser().normalize(df)
        for col in ("kw", "kva", "pf", "current_phase_a", "voltage_phase_a"):
            ok = col in out.columns
            # kva may be NaN if not provided in the synthetic, that's fine
            all_ok &= _ok(f"ALM detects '{col}'", ok)
    except Exception as e:  # noqa: BLE001
        all_ok &= _ok("ALM functional check", False, f"{type(e).__name__}: {e}")

    # ── Verdict ──────────────────────────────────────────────────────
    print()
    print("=" * 56)
    if all_ok:
        print("All checks passed. Backend is ready for offline use.")
        print("Run:  uvicorn backend.main:app --reload --port 8000")
        return 0
    print("Some checks FAILED — fix the items marked FAIL above.")
    print("Most common fix:")
    print("    pip install -r backend/requirements.txt")
    return 1


if __name__ == "__main__":
    sys.exit(main())
