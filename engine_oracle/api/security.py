"""
Security module - server-side tier and admin checks.
This runs on Railway, uses SERVICE_ROLE Supabase key (bypasses RLS).
Frontend cannot bypass these checks.
"""
import os, time
from fastapi import HTTPException, Header, Request
from typing import Optional

SUPABASE_URL          = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")
ADMIN_EMAILS          = ["predictivefpl@outlook.com", "navindhillon@gmail.com"]

# Simple in-memory rate limiter (per IP)
_rate_buckets: dict = {}

def rate_limit(key: str, max_per_min: int = 30) -> bool:
    """Returns True if rate limit OK, False if exceeded."""
    now    = time.time()
    bucket = _rate_buckets.get(key, [])
    bucket = [t for t in bucket if now - t < 60]
    if len(bucket) >= max_per_min:
        return False
    bucket.append(now)
    _rate_buckets[key] = bucket
    return True


async def get_user_tier_server(email: str) -> str:
    """Authoritative tier lookup using service_role key (bypasses RLS)."""
    if not email or not SUPABASE_SERVICE_KEY:
        return "free"
    if email in ADMIN_EMAILS:
        return "pro"
    import aiohttp
    try:
        async with aiohttp.ClientSession() as sess:
            url = f"{SUPABASE_URL}/rest/v1/users?email=eq.{email}&select=tier&limit=1"
            headers = {
                "apikey":        SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            }
            async with sess.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as r:
                if r.status == 200:
                    rows = await r.json()
                    if rows and isinstance(rows, list):
                        return rows[0].get("tier", "free")
    except Exception:
        pass
    return "free"


def is_admin_email(email: str) -> bool:
    return email in ADMIN_EMAILS


async def require_pro(request: Request):
    """FastAPI dependency - blocks request if user is not Pro."""
    # Get email from request body or header
    email = request.headers.get("x-user-email", "")
    if not email:
        try:
            body = await request.json()
            email = body.get("email", "")
        except Exception:
            pass
    if not email:
        raise HTTPException(status_code=401, detail="Email required")
    tier = await get_user_tier_server(email)
    if tier != "pro":
        raise HTTPException(status_code=403, detail="Pro tier required")
    return email


async def require_admin(request: Request):
    """FastAPI dependency - blocks request if user is not admin."""
    email = request.headers.get("x-user-email", "")
    if not is_admin_email(email):
        raise HTTPException(status_code=403, detail="Admin only")
    return email


def require_rate_limit(request: Request, max_per_min: int = 30):
    """Rate limit by IP."""
    ip = request.client.host if request.client else "unknown"
    if not rate_limit(ip, max_per_min):
        raise HTTPException(status_code=429, detail="Too many requests")
