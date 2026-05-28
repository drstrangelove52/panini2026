from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..database import get_db
from .. import models
from ..schemas import UserCreate, UserLogin, Token, UserOut
from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..ntfy import notify
from ..geo import geolocate

router = APIRouter()


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _log(db: Session, event: str, ip: str,
               nickname: str = None, details: str = None,
               ntfy_priority: str = "high"):
    """Log a security event with geo-lookup; alert via ntfy if IP is outside Switzerland."""
    geo = await geolocate(ip)
    city = geo["city"]
    geo_str = (f"{city}, {geo['country']}" if city else geo["country"]) \
              + f" ({geo['country_code']})"
    full_details = f"{details} · {geo_str}" if details else geo_str

    db.add(models.SecurityEvent(
        event=event,
        ip=ip,
        nickname=nickname,
        details=full_details,
        country_code=geo["country_code"],
    ))
    db.commit()

    # Push notification for any non-Swiss, non-local access
    if not geo["is_local"] and geo["country_code"] not in ("CH", "??"):
        await notify(
            f"⚠️ Panini: {event} aus {geo['country']}",
            f"Ereignis: {event}\nNutzer: {nickname or '–'}\nIP: {ip}\nOrt: {geo_str}",
            priority=ntfy_priority,
        )


@router.post("/access", status_code=204)
async def log_access(request: Request, db: Session = Depends(get_db)):
    """
    Called by the frontend on every page load (no auth required).
    Deduplicated per IP per 2 hours to avoid log spam.
    """
    ip = _get_ip(request)

    # Skip if this IP was already logged as ACCESS within the last 2 hours
    cutoff = datetime.utcnow() - timedelta(hours=2)
    already_logged = db.query(models.SecurityEvent).filter(
        models.SecurityEvent.event == "ACCESS",
        models.SecurityEvent.ip == ip,
        models.SecurityEvent.timestamp >= cutoff,
    ).first()
    if already_logged:
        return

    # Page visits from abroad get default priority (less urgent than auth events)
    await _log(db, "ACCESS", ip, ntfy_priority="default")


@router.post("/register")
async def register(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    ip = _get_ip(request)
    if db.query(models.User).filter(models.User.nickname == data.nickname).first():
        await _log(db, "REGISTER_FAIL", ip, data.nickname, "Nickname bereits vergeben")
        raise HTTPException(status_code=400, detail="Nickname bereits vergeben")
    db.add(models.User(
        nickname=data.nickname,
        password_hash=hash_password(data.password),
        is_active=False,
        is_admin=False,
    ))
    db.commit()
    await _log(db, "REGISTER", ip, data.nickname)
    await notify(
        "Neue Registrierung – Panini Tauschbörse",
        f"'{data.nickname}' möchte mitmachen. Bitte im Admin-Bereich freischalten.",
        priority="default",
    )
    return {"message": "Registrierung erfolgreich. Warte auf Freischaltung durch den Admin."}


@router.post("/login", response_model=Token)
async def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    ip = _get_ip(request)
    user = db.query(models.User).filter(models.User.nickname == data.nickname).first()
    if not user or not verify_password(data.password, user.password_hash):
        await _log(db, "LOGIN_FAIL", ip, data.nickname, "Falscher Nickname oder Passwort")
        raise HTTPException(status_code=401, detail="Falscher Nickname oder Passwort")
    await _log(db, "LOGIN", ip, data.nickname)
    return Token(
        access_token=create_access_token(user.id),
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
