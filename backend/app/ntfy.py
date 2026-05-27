import httpx
import os
import logging

logger = logging.getLogger(__name__)

NTFY_URL = os.getenv("NTFY_URL", "")


async def notify(title: str, message: str, priority: str = "default"):
    if not NTFY_URL:
        return
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                NTFY_URL,
                content=message.encode("utf-8"),
                headers={
                    "Title": title.encode("utf-8"),
                    "Priority": priority,
                    "Tags": "soccer",
                },
                timeout=5.0,
            )
    except Exception as e:
        logger.warning("ntfy notification failed: %s", e)
