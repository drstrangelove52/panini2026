from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import timezone
from typing import List
from ..database import get_db
from .. import models
from ..schemas import UserOut, StickerOut, StickerCreate
from ..auth import get_admin_user

router = APIRouter()


@router.get("/stats")
def stats(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    return {
        "total_users":   db.query(models.User).count(),
        "active_users":  db.query(models.User).filter(models.User.is_active == True).count(),
        "pending_users": db.query(models.User).filter(
            models.User.is_active == False, models.User.is_admin == False).count(),
        "total_stickers":db.query(models.Sticker).count(),
    }


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.post("/users/{user_id}/approve", response_model=UserOut)
def approve_user(user_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)):
    user = _get_user(user_id, db)
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/revoke", response_model=UserOut)
def revoke_user(user_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)):
    user = _get_user(user_id, db)
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Eigener Account kann nicht gelöscht werden")
    user = _get_user(user_id, db)
    db.delete(user)
    db.commit()


@router.post("/users/{user_id}/make-admin", response_model=UserOut)
def make_admin(user_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)):
    user = _get_user(user_id, db)
    user.is_admin = True
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.get("/stickers", response_model=List[StickerOut])
def list_stickers(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    return db.query(models.Sticker).order_by(models.Sticker.sort_order).all()


@router.post("/stickers", response_model=StickerOut, status_code=201)
def create_sticker(data: StickerCreate, db: Session = Depends(get_db), _=Depends(get_admin_user)):
    if db.query(models.Sticker).filter(models.Sticker.code == data.code).first():
        raise HTTPException(status_code=400, detail="Code bereits vorhanden")
    max_order = db.query(models.Sticker).count()
    sticker = models.Sticker(**data.model_dump(), sort_order=max_order)
    db.add(sticker)
    db.commit()
    db.refresh(sticker)
    return sticker


@router.put("/stickers/{sticker_id}", response_model=StickerOut)
def update_sticker(sticker_id: int, data: StickerCreate,
                   db: Session = Depends(get_db), _=Depends(get_admin_user)):
    sticker = db.query(models.Sticker).filter(models.Sticker.id == sticker_id).first()
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker nicht gefunden")
    for k, v in data.model_dump().items():
        setattr(sticker, k, v)
    db.commit()
    db.refresh(sticker)
    return sticker


@router.delete("/stickers/{sticker_id}", status_code=204)
def delete_sticker(sticker_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)):
    sticker = db.query(models.Sticker).filter(models.Sticker.id == sticker_id).first()
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker nicht gefunden")
    db.delete(sticker)
    db.commit()


@router.get("/security-log")
def security_log(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    events = db.query(models.SecurityEvent)\
        .order_by(models.SecurityEvent.timestamp.desc())\
        .limit(200).all()
    def _ts(dt):
        # SQLite stores naive UTC datetimes – attach +00:00 so JS parses correctly
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    return [{"id": e.id, "timestamp": _ts(e.timestamp), "event": e.event,
             "ip": e.ip, "nickname": e.nickname, "details": e.details,
             "country_code": e.country_code}
            for e in events]


def _get_user(user_id: int, db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    return user
