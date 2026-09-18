"""The PostMan queue — recordings an engineer has sent to the report.

"Send to PostMan" on the dashboard is the link between the two tools: it
builds the recording's bundle (backend/reports/postman_bundle.py, plus the
dashboard's own compliance, health, cost figures and chart images) and
parks it here under the panel and recording ID the engineer chose. PostMan
lists this queue and pulls from it; nothing else on the server is offered.

Entries live in memory and, when DATABASE_URL is set, in postman_bundles as
well, so a Space restart does not lose what was sent. Everything expires
after db.RETENTION_HOURS (24 h) — the server is a hand-off, not an archive.
"""
from __future__ import annotations

import threading
import time
from typing import Any

from services import db

_lock = threading.Lock()
_queue: dict[str, tuple[dict[str, Any], float]] = {}   # session_id -> (bundle, sent_at epoch)
_TTL = db.RETENTION_HOURS * 3600


def _purge_locked() -> None:
    cutoff = time.time() - _TTL
    for sid in [s for s, (_, t) in _queue.items() if t < cutoff]:
        _queue.pop(sid, None)


def _hydrate_locked() -> None:
    """Fold persisted bundles in (a restart empties memory, not the table)."""
    for sid, (payload, created) in db.load_bundles().items():
        if sid not in _queue or _queue[sid][1] < created:
            _queue[sid] = (payload, created)


def put(session_id: str, bundle: dict[str, Any]) -> None:
    with _lock:
        _purge_locked()
        _queue[session_id] = (bundle, time.time())
    db.save_bundle(session_id, bundle)
    db.purge_expired()


def get(session_id: str) -> dict[str, Any] | None:
    with _lock:
        _hydrate_locked()
        _purge_locked()
        entry = _queue.get(session_id)
        return entry[0] if entry else None


def remove(session_id: str) -> None:
    with _lock:
        _queue.pop(session_id, None)
    db.delete_bundle(session_id)


def listing() -> list[dict[str, Any]]:
    """What PostMan shows: one line per sent recording, newest first."""
    with _lock:
        _hydrate_locked()
        _purge_locked()
        items = sorted(_queue.items(), key=lambda kv: kv[1][1], reverse=True)
    out = []
    for sid, (b, sent) in items:
        out.append({
            "session_id": sid,
            "panel": b.get("panel", ""), "role": b.get("role", ""), "recording_id": b.get("recording_id", ""),
            "company_name": b.get("company", ""), "plant_name": b.get("plant", ""), "engineer": b.get("engineer", ""),
            "analyzer": b.get("instrument", ""), "audit_date": b.get("audit_date", ""), "filename": b.get("source_file", ""),
            "start": b.get("start", ""), "end": b.get("end", ""), "samples": b.get("samples", 0),
            "compliance_score": ((b.get("compliance") or {}).get("summary") or {}).get("score"),
            "health": (b.get("health") or {}).get("overall"),
            "charts": len(b.get("charts") or []),
            "sent_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(sent)),
            "expires_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(sent + _TTL)),
        })
    return out
