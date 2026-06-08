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

RESILIENCE (added after a production incident)
----------------------------------------------
A database that is unreachable must NEVER block a request or crash the server.
Previously a bad DATABASE_URL (e.g. Supabase's IPv6-only direct host, which
Render's IPv4 egress can't reach) caused a 30 s pool timeout on the upload
path; the health check then failed and Render killed the instance. To prevent
that:

  * Short connect + pool timeouts (default 5 s) instead of the 30 s default.
  * A circuit breaker: after a failure the DB is skipped for a cooldown window
    so every subsequent request doesn't pay the timeout again.
  * Writes (save_summary / save_frame) run fire-and-forget on a background
    thread, so the HTTP response never waits on Postgres.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

_DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# Tunables (env-overridable). Kept small so a dead DB fails fast.
_CONNECT_TIMEOUT = int(os.environ.get("DB_CONNECT_TIMEOUT", "5"))   # libpq seconds
_POOL_TIMEOUT = float(os.environ.get("DB_POOL_TIMEOUT", "5"))       # getconn wait
_BREAKER_COOLDOWN = float(os.environ.get("DB_BREAKER_COOLDOWN", "120"))  # seconds

_pool: Any = None
_pool_lock = threading.Lock()
_schema_ready = False

# Circuit breaker: while monotonic() < _breaker_until, skip all DB work.
_breaker_until = 0.0

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


def _breaker_tripped() -> bool:
    return time.monotonic() < _breaker_until


def _trip_breaker() -> None:
    """Skip DB work for the cooldown window after a failure.

    Also tears down the pool so its background reconnect workers stop hammering
    an unreachable host. A fresh pool is created on the next attempt after the
    cooldown elapses.
    """
    global _breaker_until, _pool, _schema_ready
    _breaker_until = time.monotonic() + _BREAKER_COOLDOWN
    pool, _pool, _schema_ready = _pool, None, False
    if pool is not None:
        try:
            pool.close()
        except Exception:
            pass
    logger.warning(
        "DB circuit breaker tripped — skipping persistence for %.0fs", _BREAKER_COOLDOWN
    )


def _get_pool():
    """Lazily open the connection pool and ensure the schema exists.

    Returns the pool, or None if the pool can't be opened (callers then skip
    persistence and the app keeps running in-memory). Fails fast and trips the
    circuit breaker so a dead DB never blocks repeatedly.
    """
    global _pool, _schema_ready

    if _breaker_tripped():
        return None
    if _pool is not None:
        return _pool

    with _pool_lock:
        if _pool is None:
            try:
                from psycopg_pool import ConnectionPool

                # prepare_threshold=None disables prepared statements so the same
                # URL works against Supabase's transaction pooler (port 6543) too.
                # connect_timeout caps each TCP/auth attempt; pool timeout caps
                # how long getconn() waits — both small so we fail fast.
                pool = ConnectionPool(
                    _DATABASE_URL,
                    min_size=0,
                    max_size=4,
                    open=False,
                    timeout=_POOL_TIMEOUT,
                    kwargs={
                        "autocommit": True,
                        "prepare_threshold": None,
                        "connect_timeout": _CONNECT_TIMEOUT,
                    },
                )
                # wait=False: don't block startup waiting for the first connection.
                pool.open(wait=False)
                _pool = pool
            except Exception:
                logger.exception("Failed to open DB pool")
                _trip_breaker()
                return None

        if not _schema_ready:
            try:
                with _pool.connection() as conn:
                    for stmt in _DDL_STATEMENTS:
                        conn.execute(stmt)
                _schema_ready = True
                logger.info("PQ Postgres schema ready")
            except Exception:
                logger.exception("Failed to create PQ schema")
                _trip_breaker()
                return None

    return _pool


def _run_bg(fn, *args) -> None:
    """Run a write fire-and-forget on a daemon thread so the request never waits."""
    threading.Thread(target=fn, args=args, daemon=True).start()


# ── Session summaries (history) ────────────────────────────────────────────

def _save_summary_sync(payload: dict[str, Any]) -> None:
    meta = payload.get("metadata") or {}
    dq = payload.get("data_quality") or {}
    quality = dq.get("quality_score") if isinstance(dq, dict) else None
    try:
        from psycopg.types.json import Json

        pool = _get_pool()
        if pool is None:
            return
        with pool.connection() as conn:
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
        _trip_breaker()


def save_summary(payload: dict[str, Any]) -> None:
    """Upsert one processed session (fire-and-forget; never blocks the request)."""
    if not enabled() or _breaker_tripped():
        return
    _run_bg(_save_summary_sync, payload)


def load_summary(session_id: str) -> dict[str, Any] | None:
    """Return the stored full ProcessResponse JSON for a session, or None."""
    if not enabled() or _breaker_tripped():
        return None
    try:
        pool = _get_pool()
        if pool is None:
            return None
        with pool.connection() as conn:
            row = conn.execute(
                "SELECT payload FROM pq_sessions WHERE session_id = %s",
                (session_id,),
            ).fetchone()
            return row[0] if row else None
    except Exception:
        logger.exception("load_summary failed for %s", session_id)
        _trip_breaker()
        return None


def list_summaries() -> list[dict[str, Any]]:
    """Return lightweight summaries of all persisted sessions, newest first."""
    if not enabled() or _breaker_tripped():
        return []
    try:
        pool = _get_pool()
        if pool is None:
            return []
        with pool.connection() as conn:
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
        _trip_breaker()
        return []


def delete_session(session_id: str) -> None:
    """Remove a session's summary and frame."""
    if not enabled() or _breaker_tripped():
        return
    try:
        pool = _get_pool()
        if pool is None:
            return
        with pool.connection() as conn:
            conn.execute("DELETE FROM pq_sessions WHERE session_id = %s", (session_id,))
            conn.execute("DELETE FROM pq_frames WHERE session_id = %s", (session_id,))
    except Exception:
        logger.exception("delete_session failed for %s", session_id)
        _trip_breaker()


# ── Measurement frames (Parquet bytes) ─────────────────────────────────────

def _save_frame_sync(session_id: str, data: bytes) -> None:
    try:
        pool = _get_pool()
        if pool is None:
            return
        with pool.connection() as conn:
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
        _trip_breaker()


def save_frame(session_id: str, data: bytes) -> None:
    """Persist a measurement frame (fire-and-forget; never blocks the request)."""
    if not enabled() or _breaker_tripped():
        return
    _run_bg(_save_frame_sync, session_id, data)


def load_frame(session_id: str) -> bytes | None:
    if not enabled() or _breaker_tripped():
        return None
    try:
        pool = _get_pool()
        if pool is None:
            return None
        with pool.connection() as conn:
            row = conn.execute(
                "SELECT frame_parquet FROM pq_frames WHERE session_id = %s",
                (session_id,),
            ).fetchone()
        if not row or row[0] is None:
            return None
        return bytes(row[0])
    except Exception:
        logger.exception("load_frame failed for %s", session_id)
        _trip_breaker()
        return None
