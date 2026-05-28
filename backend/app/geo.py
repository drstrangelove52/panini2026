import httpx
import logging

logger = logging.getLogger(__name__)

_PRIVATE_PREFIXES = (
    "10.", "192.168.", "127.", "::1", "fe80:",
    "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.",
    "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
    "172.30.", "172.31.",
)


async def geolocate(ip: str) -> dict:
    """
    Returns dict with: country_code, country, city, is_local.
    Uses ip-api.com (free, no key, 45 req/min – more than enough here).
    Falls back gracefully for private IPs or on network errors.
    """
    if not ip or ip in ("unknown", ""):
        return {"country_code": "??", "country": "Unbekannt", "city": "", "is_local": False}

    if any(ip.startswith(p) for p in _PRIVATE_PREFIXES):
        return {"country_code": "CH", "country": "Lokal", "city": "", "is_local": True}

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,countryCode,country,city"},
                timeout=3.0,
            )
            d = r.json()
            if d.get("status") == "success":
                return {
                    "country_code": d.get("countryCode", "??"),
                    "country":      d.get("country", "Unbekannt"),
                    "city":         d.get("city", ""),
                    "is_local":     False,
                }
    except Exception as exc:
        logger.warning("Geo lookup failed for %s: %s", ip, exc)

    return {"country_code": "??", "country": "Unbekannt", "city": "", "is_local": False}
