"""API routes for summary tables and events."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from analytics.events import detect_all_events
from analytics.summary import all_summary_tables
from models.schema import AllSummariesResponse, EventsResponse, PQEvent
from services.session_store import session_store

router = APIRouter(tags=["analytics"])


@router.get("/session/{session_id}/events", response_model=EventsResponse)
def get_events(
    session_id: str,
    limit: int = Query(100, ge=1, le=1000),
    severity: str | None = Query(None),
) -> EventsResponse:
    """Get detected PQ events for a session."""
    df = session_store.get(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    events = detect_all_events(df)

    # Filter by severity if requested
    if severity:
        events = [e for e in events if e.severity == severity]

    # Limit results
    events = events[:limit]

    # Convert to Pydantic models
    pq_events = [
        PQEvent(
            timestamp=e.timestamp,
            event_type=e.event_type.value,
            severity=e.severity.value,
            phase=e.phase,
            value=e.value,
            threshold=e.threshold,
            message=e.message,
        )
        for e in events
    ]

    return EventsResponse(
        session_id=session_id,
        total_events=len(pq_events),
        events=pq_events,
    )


@router.get("/session/{session_id}/summaries", response_model=AllSummariesResponse)
def get_summaries(session_id: str) -> AllSummariesResponse:
    """Get all summary statistics tables."""
    df = session_store.get(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Extract harmonic spectrum from harmonics columns
    import re
    import numpy as np

    order_map = {}
    for col in df.columns:
        col_lower = str(col).lower()
        order = None
        
        # Match %FHxx
        match = re.search(r"%fh(\d+)", col_lower)
        if match:
            order = int(match.group(1))
        # Match h followed by digits
        elif col_lower.startswith("h") and col_lower[1:].isdigit():
            order = int(col_lower[1:])
        # Match h{digits} with phase indicators (e.g. h3_i, i_h3, v_h3)
        else:
            match = re.search(r"(?:^|[_iuv])h(\d+)(?:$|[_iuv])", col_lower)
            if match:
                order = int(match.group(1))

        if order is not None:
            try:
                mean_val = float(df[col].mean())
                if not np.isnan(mean_val):
                    order_map.setdefault(order, []).append(mean_val)
            except Exception:
                pass

    harmonics_data = []
    for order in sorted(order_map.keys()):
        avg_val = float(np.mean(order_map[order]))
        harmonics_data.append({"order": order, "magnitude_pct": avg_val})

    summaries = all_summary_tables(df, harmonics_data)

    # Convert to response format
    def format_table(table):
        return {
            "title": table.title,
            "rows": [
                {
                    "parameter": r.get("parameter"),
                    "min": r.get("min"),
                    "max": r.get("max"),
                    "avg": r.get("avg"),
                    "rms": r.get("rms"),
                    "order": r.get("order"),
                    "magnitude_pct": r.get("magnitude_pct"),
                    "unit": r.get("unit"),
                }
                for r in table.rows
            ],
        }

    return AllSummariesResponse(
        session_id=session_id,
        voltage=format_table(summaries["voltage"]),
        current=format_table(summaries["current"]),
        power=format_table(summaries["power"]),
        thd=format_table(summaries["thd"]),
        frequency=format_table(summaries["frequency"]),
        harmonics=format_table(summaries["harmonics"]),
    )
