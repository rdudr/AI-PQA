"""Optional Postgres persistence for processed PQ sessions.

Activated only when the ``DATABASE_URL`` environment variable is set. When it
is unset (the normal local-dev case), every function here is a no-op and the
app behaves exactly as before — sessions live purely in memory.

Two tables:
  * ``pq_sessions`` — one row per processed upload: the full ProcessResponse
    JSON plus a few flat columns used by the history list.
  * ``pq_frames``   — the normalized measurement frame, stored as Parquet bytes
    so the table view / exports / analytics endpoints can be rebuilt after a
    server restart.

All psycopg imports are lazy (inside functions, behind ``enabled()``), so the
module imports cleanly even when psycopg isn't installed locally.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any

logger = logging.getLogger(__name__)

_DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

_pool: Any = None
_pool_lock = threading.Lock()
_schema_ready = False

_DDL_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS pq_sessions (
        session_id    TEXT PRIMARY KEY,
        company_name  TEXT,
        plant_name    TEXT,
        analyzer      TEXT,
        audit_date    TEXT,
        filename      TEXT,
        total_rows    INTEGER,
        quality_score DOUBLE PRECISION,
        payload       JSONB NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pq_frames (
        session_id    TEXT PRIMARY KEY,
        frame_parquet BYTEA NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
)


def enabled() -> bool:
    """True when a database URL is configured (i.e. persistence is on)."""
    return bool(_DATABASE_URL)


def _get_pool():
    """Lazily open the connection pool and ensure the schema exists.

    Returns the pool, or None if the pool can't be opened (callers then skip
    persistence and the app keeps running in-memory).
    """
    global _pool, _schema_ready
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is None:
            from psycopg_pool import ConnectionPool

            # prepare_threshold=None disables prepared statements so the same
            # URL works against Supabase's transaction pooler (port 6543) too.
            pool = ConnectionPool(
                _DATABASE_URL,
                min_size=0,
                max_size=4,
                open=False,
                kwargs={"autocommit": True, "prepare_threshold": None},
            )
            pool.open()
            _pool = pool
        if not _schema_ready:
            try:
                with _pool.connection() as conn:
                    for stmt in _DDL_STATEMENTS:
                        conn.execute(stmt)
                _schema_ready = True
                logger.info("PQ Postgres schema ready")
            except Exception:
                logger.exception("Failed to create PQ schema")
    return _pool


# ── Session summaries (history) ────────────────────────────────────────────

def save_summary(payload: dict[str, Any]) -> None:
    """Upsert one processed session's full ProcessResponse JSON + index fields."""
    if not enabled():
        return
    meta = payload.get("metadata") or {}
    dq = payload.get("data_quality") or {}
    quality = dq.get("quality_score") if isinstance(dq, dict) else None
    try:
        from psycopg.types.json import Json

        with _get_pool().connection() as conn:
            conn.execute(
                """
                INSERT INTO pq_sessions
                    (session_id, company_name, plant_name, analyzer, audit_date,
                     filename, total_rows, quality_score, payload)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    company_name  = EXCLUDED.company_name,
                    plant_name    = EXCLUDED.plant_name,
                    analyzer      = EXCLUDED.analyzer,
                    audit_date    = EXCLUDED.audit_date,
                    filename      = EXCLUDED.filename,
                    total_rows    = EXCLUDED.total_rows,
                    quality_score = EXCLUDED.quality_score,
                    payload       = EXCLUDED.payload
                """,
                (
                    payload.get("session_id"),
                    meta.get("company_name"),
                    meta.get("plant_name"),
                    meta.get("pq_analyzer_type"),
                    meta.get("audit_date"),
                    payload.get("filename"),
                    payload.get("total_rows"),
                    quality,
                    Json(payload),
                ),
            )
    except Exception:
        logger.exception("save_summary failed for %s", payload.get("session_id"))


def load_summary(session_id: str) -> dict[str, Any] | None:
    """Return the stored full ProcessResponse JSON for a session, or None."""
    if not enabled():
        return None
    try:
        with _get_pool().connection() as conn:
            row = conn.execute(
                "SELECT payload FROM pq_sessions WHERE session_id = %s",
                (session_id,),
            ).fetchone()
            return row[0] if row else None
    except Exception:
        logger.exception("load_summary failed for %s", session_id)
        return None


def list_summaries() -> list[dict[str, Any]]:
    """Return lightweight summaries of all persisted sessions, newest first."""
    if not enabled():
        return []
    try:
        with _get_pool().connection() as conn:
            rows = conn.execute(
                """
                SELECT session_id, filename, company_name, plant_name,
                       analyzer, audit_date, total_rows, quality_score
                FROM pq_sessions
                ORDER BY created_at DESC
                """
            ).fetchall()
        return [
            {
                "session_id": r[0],
                "filename": r[1] or "",
                "company_name": r[2] or "",
                "plant_name": r[3] or "",
                "analyzer": r[4] or "",
                "audit_date": r[5] or "",
                "total_rows": r[6] or 0,
                "quality_score": r[7] or 0,
            }
            for r in rows
        ]
    except Exception:
        logger.exception("list_summaries failed")
        return []


def delete_session(session_id: str) -> None:
    """Remove a session's summary and frame."""
    if not enabled():
        return
    try:
        with _get_pool().connection() as conn:
            conn.execute("DELETE FROM pq_sessions WHERE session_id = %s", (session_id,))
            conn.execute("DELETE FROM pq_frames WHERE session_id = %s", (session_id,))
    except Exception:
        logger.exception("delete_session failed for %s", session_id)


# ── Measurement frames (Parquet bytes) ─────────────────────────────────────

def save_frame(session_id: str, data: bytes) -> None:
    if not enabled():
        return
    try:
        with _get_pool().connection() as conn:
            conn.execute(
                """
                INSERT INTO pq_frames (session_id, frame_parquet)
                VALUES (%s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    frame_parquet = EXCLUDED.frame_parquet,
                    created_at    = now()
                """,
                (session_id, data),
            )
    except Exception:
        logger.exception("save_frame failed for %s", session_id)


def load_frame(session_id: str) -> bytes | None:
    if not enabled():
        return None
    try:
        with _get_pool().connection() as conn:
            row = conn.execute(
                "SELECT frame_parquet FROM pq_frames WHERE session_id = %s",
                (session_id,),
            ).fetchone()
        if not row or row[0] is None:
            return None
        return bytes(row[0])
    except Exception:
        logger.exception("load_frame failed for %s", session_id)
        return None
