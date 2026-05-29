from __future__ import annotations

import io
import logging
import threading
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

    def __init__(self, max_sessions: int = 48) -> None:
        self._frames: OrderedDict[str, pd.DataFrame] = OrderedDict()
        self._lock = threading.Lock()
        self._max_sessions = max_sessions

    def put(self, session_id: str, df: pd.DataFrame) -> None:
        with self._lock:
            self._frames.pop(session_id, None)
            self._frames[session_id] = df
            while len(self._frames) > self._max_sessions:
                self._frames.popitem(last=False)

        if db.enabled():
            try:
                buf = io.BytesIO()
                df.to_parquet(buf, engine="pyarrow", index=False)
                db.save_frame(session_id, buf.getvalue())
            except Exception:
                # Never let a persistence hiccup break an upload — the frame is
                # still cached in memory for this process.
                logger.exception("Could not persist frame for %s", session_id)

    def get(self, session_id: str) -> pd.DataFrame | None:
        with self._lock:
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
                    while len(self._frames) > self._max_sessions:
                        self._frames.popitem(last=False)
                return df
        return None


session_store = SessionStore()
