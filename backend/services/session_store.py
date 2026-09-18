from __future__ import annotations

import io
import logging
import threading
import time
from collections import OrderedDict

import pandas as pd

from services import db

logger = logging.getLogger(__name__)


class SessionStore:
    """In-memory holder for normalized measurement frames, with optional
    write-through to Postgres.

    When ``DATABASE_URL`` is configured (see :mod:`services.db`), frames are
    also persisted as Parquet so they survive a server restart; ``get`` falls
    back to loading from the database on a cache miss. Without a database it
    behaves as a plain LRU-ish in-memory cache.
    """

    def __init__(self, max_sessions: int = 48, ttl_seconds: float = db.RETENTION_HOURS * 3600) -> None:
        self._frames: OrderedDict[str, pd.DataFrame] = OrderedDict()
        self._stamps: dict[str, float] = {}
        self._lock = threading.Lock()
        self._max_sessions = max_sessions
        self._ttl = ttl_seconds

    def _purge_locked(self) -> None:
        """Drop frames older than the retention window (caller holds the lock)."""
        cutoff = time.time() - self._ttl
        for sid in [s for s, t in self._stamps.items() if t < cutoff]:
            self._frames.pop(sid, None)
            self._stamps.pop(sid, None)

    def put(self, session_id: str, df: pd.DataFrame) -> None:
        with self._lock:
            self._purge_locked()
            self._frames.pop(session_id, None)
            self._frames[session_id] = df
            self._stamps[session_id] = time.time()
            while len(self._frames) > self._max_sessions:
                old, _ = self._frames.popitem(last=False)
                self._stamps.pop(old, None)
        db.purge_expired()

        if db.enabled():
            try:
                buf = io.BytesIO()
                df.to_parquet(buf, engine="pyarrow", index=False)
                db.save_frame(session_id, buf.getvalue())
            except Exception:
                # Never let a persistence hiccup break an upload — the frame is
                # still cached in memory for this process.
                logger.exception("Could not persist frame for %s", session_id)

    def ids(self) -> list[str]:
        """Session ids held in memory, newest first."""
        with self._lock:
            self._purge_locked()
            return list(reversed(self._frames.keys()))

    def get(self, session_id: str) -> pd.DataFrame | None:
        with self._lock:
            self._purge_locked()
            df = self._frames.get(session_id)
            if df is not None:
                self._frames.move_to_end(session_id)
                return df

        # Cache miss — try the database (e.g. after a restart).
        if db.enabled():
            data = db.load_frame(session_id)
            if data is not None:
                try:
                    df = pd.read_parquet(io.BytesIO(data), engine="pyarrow")
                except Exception:
                    logger.exception("Could not read persisted frame for %s", session_id)
                    return None
                with self._lock:
                    self._frames[session_id] = df
                    self._stamps[session_id] = time.time()
                    while len(self._frames) > self._max_sessions:
                        old, _ = self._frames.popitem(last=False)
                        self._stamps.pop(old, None)
                return df
        return None


session_store = SessionStore()
