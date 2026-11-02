"""Sign-in for the API with the KISEM team's one login, kept in FOX Console (console.eassiitgn.page).

Active only when FOX_CONSOLE_URL is set (on the KISEM Oracle server: http://127.0.0.1:8080).
Every /api/ call except the health check must then carry "Authorization: Bearer <token>", the
app pass the Console gave at sign-in (to this analyser's screen, or to PostMan). The Console is
asked whether the pass is still good, which also honours paused or removed team members; the
answer is remembered for a minute so the API stays fast. Elsewhere (local, Hugging Face) nothing
changes.
"""
import asyncio
import hashlib
import json
import os
import time
import urllib.error
import urllib.request

from fastapi import Request
from fastapi.responses import JSONResponse

FOX_CONSOLE_URL = os.environ.get("FOX_CONSOLE_URL", "").strip().rstrip("/")
ALLOWED_APPS = {"power", "report"}
PUBLIC_PATHS = {"/api/health"}
GOOD_FOR = 60.0   # seconds a confirmed pass is trusted before asking the Console again
BAD_FOR = 10.0

_cache: dict[str, tuple[float, bool]] = {}


def _ask_console(token: str) -> bool:
    req = urllib.request.Request(
        f"{FOX_CONSOLE_URL}/api/device/me", headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode("utf-8") or "{}")
            return res.status == 200 and data.get("app") in ALLOWED_APPS
    except (urllib.error.URLError, ValueError, TimeoutError):
        return False


def _refused(message: str) -> JSONResponse:
    return JSONResponse({"detail": message}, status_code=401)


async def require_fox_console(request: Request, call_next):
    path = request.url.path
    if not FOX_CONSOLE_URL or request.method == "OPTIONS" or not path.startswith("/api/") or path in PUBLIC_PATHS:
        return await call_next(request)
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    if not token or len(token) > 200:
        return _refused("Please sign in with your FOX Console login.")
    key = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()
    hit = _cache.get(key)
    if not hit or hit[0] < now:
        ok = await asyncio.to_thread(_ask_console, token)
        if len(_cache) > 2000:
            for k in [k for k, (until, _) in _cache.items() if until < now]:
                _cache.pop(k, None)
        hit = _cache[key] = (now + (GOOD_FOR if ok else BAD_FOR), ok)
    if not hit[1]:
        return _refused("Your sign-in has ended. Please sign in again with your FOX Console login.")
    return await call_next(request)
