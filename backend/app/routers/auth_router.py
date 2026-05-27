from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..schemas import UserCreate, UserLogin, Token, UserOut
from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..ntfy import notify

router = APIRouter()


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _log(db: Session, event: str, ip: str, nickname: str = None, details: str = None):
    db.add(models.SecurityEvent(event=event, ip=ip, nickname=nickname, details=details))
    db.commit()


@router.post("/register")
async def register(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    ip = _get_ip(request)
    if db.query(models.User).filter(models.User.nickname == data.nickname).first():
        _log(db, "REGISTER_FAIL", ip, data.nickname, "Nickname bereits vergeben")
        raise HTTPException(status_code=400, detail="Nickname bereits vergeben")
    db.add(models.User(
        nickname=data.nickname,
        password_hash=hash_password(data.password),
        is_active=False,
        is_admin=False,
    ))
    db.commit()
    _log(db, "REGISTER", ip, data.nickname)
    await notify(
        "Neue Registrierung – Panini Tauschbörse",
        f"'{data.nickname}' möchte mitmachen. Bitte im Admin-Bereich freischalten.",
        priority="default",
    )
    return {"message": "Registrierung erfolgreich. Warte auf Freischaltung durch den Admin."}


@router.post("/login", response_model=Token)
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    ip = _get_ip(request)
    user = db.query(models.User).filter(models.User.nickname == data.nickname).first()
    if not user or not verify_password(data.password, user.password_hash):
        _log(db, "LOGIN_FAIL", ip, data.nickname)
        raise HTTPException(status_code=401, detail="Falscher Nickname oder Passwort")
    _log(db, "LOGIN", ip, data.nickname)
    return Token(
        access_token=create_access_token(user.id),
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
