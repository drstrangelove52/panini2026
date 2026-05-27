from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..schemas import UserCreate, UserLogin, Token, UserOut
from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..ntfy import notify

router = APIRouter()


@router.post("/register")
async def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.nickname == data.nickname).first():
        raise HTTPException(status_code=400, detail="Nickname bereits vergeben")
    db.add(models.User(
        nickname=data.nickname,
        password_hash=hash_password(data.password),
        is_active=False,
        is_admin=False,
    ))
    db.commit()
    await notify(
        "Neue Registrierung – Panini Tauschbörse",
        f"'{data.nickname}' möchte mitmachen. Bitte im Admin-Bereich freischalten.",
        priority="default",
    )
    return {"message": "Registrierung erfolgreich. Warte auf Freischaltung durch den Admin."}


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.nickname == data.nickname).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Falscher Nickname oder Passwort")
    return Token(
        access_token=create_access_token(user.id),
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
