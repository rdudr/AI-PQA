"""Saves a recording sent to PostMan into FOX Console, so it stays with the audit.

"Send to PostMan" parks the bundle in the analyser's own queue for 24 hours; PostMan can pull it
from there. On the KISEM server the bundle is ALSO saved as a record of the audit in FOX Console
(app "power", kind "pq_recording"), with the engineer's own Console pass. PostMan reads those
records with the rest of the audit's data (src/p19b_pqlink.js pqFromConsole), joins each one to its
panel in the single line diagram by recording ID or panel name, and keeps it as long as the audit.

The chart images stay in the 24-hour queue only: a Console record is at most 256 kB, and PostMan
draws its own charts from the series. Only on the KISEM server (FOX_CONSOLE_URL set).
"""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from backend.fox_console_auth import FOX_CONSOLE_URL

MAX_RECORD = 240 * 1024


def _call(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{FOX_CONSOLE_URL}{path}", data=data, method=method,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except ValueError:
            return e.code, {}
    except (urllib.error.URLError, TimeoutError, ValueError):
        return 0, {}


def my_audits(token: str) -> list[dict]:
    """The audits this person may record for (as FOX Console says)."""
    if not FOX_CONSOLE_URL or not token:
        return []
    status, data = _call("GET", "/api/device/me", token)
    if status != 200:
        return []
    return [{"id": a.get("id"), "title": a.get("title"), "client_name": a.get("client_name"), "site_name": a.get("site_name"),
             "industry_tag": a.get("industry_tag"), "fy": a.get("fy")} for a in data.get("audits", []) if a.get("id")]


def audit_profile(token: str, audit_id: str) -> dict:
    """The company of one audit as registered in FOX Console, and the signed-in engineer's name,
    so the upload form fills itself when the analyser is opened for that company."""
    if not FOX_CONSOLE_URL or not token or not audit_id:
        return {"profile": None, "engineer": ""}
    status, data = _call("GET", f"/api/device/audit-profile?audit_id={urllib.parse.quote(audit_id)}", token)
    _, me = _call("GET", "/api/device/me", token)
    return {"profile": data.get("profile") if status == 200 else None, "engineer": (me.get("user") or {}).get("name", "")}


def _thin(bundle: dict) -> dict:
    """The bundle without chart images, and with series halved until it fits one record."""
    b = {k: v for k, v in bundle.items() if k != "charts"}
    b["charts"] = []
    while len(json.dumps(b)) > MAX_RECORD:
        se = b.get("series") or {}
        t = se.get("t") or []
        if len(t) < 50:
            break
        b["series"] = {k: (v[::2] if isinstance(v, list) else v) for k, v in se.items()}
    return b


def save_recording(token: str, audit_id: str, bundle: dict) -> dict:
    """Saves the bundle as the audit's PQ recording. Returns {saved, record_id, error}."""
    if not FOX_CONSOLE_URL:
        return {"saved": False, "error": "Not on the KISEM server: kept in the 24-hour queue only."}
    if not token or not audit_id:
        return {"saved": False, "error": "Choose the audit to save it to FOX Console."}
    b = _thin(bundle)
    if len(json.dumps(b)) > MAX_RECORD:
        return {"saved": False, "error": "This recording is too large to save to FOX Console; pull it from PostMan within 24 hours."}
    key = (bundle.get("recording_id") or bundle.get("panel") or bundle.get("session_id") or "recording").strip()
    slug = re.sub(r"[^A-Za-z0-9-]+", "-", key).strip("-")[:40] or "recording"
    record_id = re.sub(r"[^A-Za-z0-9-]", "-", f"pq-{audit_id}-{slug}")
    now = int(time.time() * 1000)
    tag = (bundle.get("recording_id") or bundle.get("panel") or "")[:60] or None
    record = {"id": record_id, "audit_id": audit_id, "kind": "pq_recording", "tag": tag,
              "taken_at": now, "saved_at": now, "payload": {"schema": "postman-pq/v1", "bundle": b}}
    status, data = _call("POST", "/api/sync", token, {"since": now, "records": [record]})
    if status != 200:
        return {"saved": False, "error": data.get("error") or f"FOX Console answered {status or 'nothing'}."}
    r = next((x for x in data.get("results", []) if x.get("id") == record_id), {})
    if r.get("status") in ("stored", "updated", "unchanged"):
        return {"saved": True, "record_id": record_id, "status": r["status"]}
    if r.get("status") == "conflict":
        # A teammate saved this recording since: send again on top of their version.
        record["base_version"] = r.get("version")
        status, data = _call("POST", "/api/sync", token, {"since": now, "records": [record]})
        r = next((x for x in data.get("results", []) if x.get("id") == record_id), {})
        if r.get("status") in ("stored", "updated", "unchanged"):
            return {"saved": True, "record_id": record_id, "status": r["status"]}
    return {"saved": False, "error": r.get("reason") or "FOX Console did not store the recording."}
