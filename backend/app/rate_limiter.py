"""
Simple in-memory rate limiter – no external dependencies required.
Resets on process restart, which is acceptable for a small family app.
"""
from collections import defaultdict
from datetime import datetime, timedelta
import threading


class SimpleRateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._counts: dict[str, list[datetime]] = defaultdict(list)

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> bool:
        """Return True if the request is allowed, False if rate limit exceeded."""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=window_seconds)
        with self._lock:
            # Purge timestamps outside the window (lazy cleanup)
            self._counts[key] = [t for t in self._counts[key] if t > cutoff]
            if len(self._counts[key]) >= limit:
                return False
            self._counts[key].append(now)
            return True


rate_limiter = SimpleRateLimiter()
