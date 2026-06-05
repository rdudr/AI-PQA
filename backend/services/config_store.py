"""Persistent storage for PQ model configurations.

Layout on disk:
  backend/config/models.json          – list of registered model names + metadata
  backend/config/mappings/<name>.json – column mappings for each model
"""
from __future__ import annotations

import json
import pathlib
from datetime import datetime

_ROOT = pathlib.Path(__file__).resolve().parent.parent / "config"
_MODELS_FILE = _ROOT / "models.json"
_MAPPINGS_DIR = _ROOT / "mappings"

# Built-in models that always appear in the dropdown — even on a fresh
# deploy where backend/config/ is empty.  These are the PQ analyzer families
# the parser registry already supports out of the box.  Users can still add
# their own custom names on top via "Add new PQ model".
BUILTIN_MODELS: list[str] = [
    # ALM series (Algodue / Lovato OEM rebrands)
    "ALM-20",
    "ALM-31",
    "ALM-36",
    "ALM-45",
]


def _ensure_dirs() -> None:
    _ROOT.mkdir(parents=True, exist_ok=True)
    _MAPPINGS_DIR.mkdir(parents=True, exist_ok=True)


def _load_models() -> list[dict]:
    _ensure_dirs()
    if not _MODELS_FILE.exists():
        return []
    try:
        return json.loads(_MODELS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_models(models: list[dict]) -> None:
    _ensure_dirs()
    _MODELS_FILE.write_text(json.dumps(models, indent=2), encoding="utf-8")


# ── Public API ─────────────────────────────────────────────────────────────────

def list_models() -> list[dict]:
    """Return all models: built-ins + user-added custom ones."""
    custom = _load_models()
    custom_names = {m["name"] for m in custom}

    result = []
    # Built-ins first (always present, cannot be deleted via API)
    for name in BUILTIN_MODELS:
        result.append({
            "name": name,
            "is_builtin": True,
            "has_config": _mapping_path(name).exists(),
            "created_at": None,
        })

    # Custom models added by the user
    for m in custom:
        if m["name"] not in {r["name"] for r in result}:
            result.append({**m, "is_builtin": False})

    return result


def add_model(name: str) -> dict:
    """Register a new custom PQ model by name."""
    name = name.strip()
    if not name:
        raise ValueError("Model name cannot be empty.")
    models = _load_models()
    if any(m["name"] == name for m in models) or name in BUILTIN_MODELS:
        raise ValueError(f"Model '{name}' already exists.")
    entry = {
        "name": name,
        "is_builtin": False,
        "has_config": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    models.append(entry)
    _save_models(models)
    return entry


def remove_model(name: str) -> None:
    """Delete a custom model and its mapping file. Built-ins cannot be deleted."""
    if name in BUILTIN_MODELS:
        raise ValueError(f"Built-in model '{name}' cannot be removed.")
    models = [m for m in _load_models() if m["name"] != name]
    _save_models(models)
    mp = _mapping_path(name)
    if mp.exists():
        mp.unlink()


def _mapping_path(name: str) -> pathlib.Path:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    return _MAPPINGS_DIR / f"{safe}.json"


def get_mappings(name: str) -> dict[str, str]:
    """Return saved column mappings for a model, or {} if none saved yet."""
    path = _mapping_path(name)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_mappings(name: str, mappings: dict[str, str]) -> None:
    """Persist column mappings for a model.
    mappings: {raw_column_name: standard_column_name | 'NA'}
    """
    _ensure_dirs()
    _mapping_path(name).write_text(json.dumps(mappings, indent=2), encoding="utf-8")
    # Mark has_config = True in models list
    if name not in BUILTIN_MODELS:
        models = _load_models()
        for m in models:
            if m["name"] == name:
                m["has_config"] = True
        _save_models(models)


# ── Custom column metadata ─────────────────────────────────────────────────────

def _custom_cols_path(name: str) -> pathlib.Path:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    return _MAPPINGS_DIR / f"{safe}_custom_columns.json"


def get_custom_columns(name: str) -> list[dict]:
    """Return saved custom columns for a model, or [] if none saved yet.
    Each entry: {"name": str, "sheet": str, "mapTo": str}
    """
    path = _custom_cols_path(name)
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_custom_columns(name: str, columns: list[dict]) -> None:
    """Persist custom column metadata for a model.
    columns: [{"name": str, "sheet": str, "mapTo": str}, ...]
    """
    _ensure_dirs()
    _custom_cols_path(name).write_text(json.dumps(columns, indent=2), encoding="utf-8")
