from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models
from ..schemas import StickerOut, BulkUpdate, HaveItem, SetQuantity
from ..auth import get_active_user

router = APIRouter()


@router.get("", response_model=List[StickerOut])
def list_stickers(db: Session = Depends(get_db), _=Depends(get_active_user)):
    return db.query(models.Sticker).order_by(models.Sticker.sort_order).all()


@router.get("/my/have", response_model=List[HaveItem])
def my_have(db: Session = Depends(get_db), user=Depends(get_active_user)):
    return db.query(models.UserHave).filter(
        models.UserHave.user_id == user.id).all()


@router.patch("/my/have/{sticker_id}", status_code=204)
def set_have_qty(sticker_id: int, data: SetQuantity, db: Session = Depends(get_db), user=Depends(get_active_user)):
    entry = db.query(models.UserHave).filter(
        models.UserHave.user_id == user.id,
        models.UserHave.sticker_id == sticker_id).first()
    if data.quantity <= 0:
        if entry:
            db.delete(entry)
    elif entry:
        entry.quantity = data.quantity
    else:
        _require_sticker(sticker_id, db)
        db.add(models.UserHave(user_id=user.id, sticker_id=sticker_id, quantity=data.quantity))
    db.commit()


@router.get("/my/want", response_model=List[int])
def my_want(db: Session = Depends(get_db), user=Depends(get_active_user)):
    return [w.sticker_id for w in db.query(models.UserWant).filter(
        models.UserWant.user_id == user.id).all()]


@router.put("/my/have/{sticker_id}", status_code=204)
def add_have(sticker_id: int, db: Session = Depends(get_db), user=Depends(get_active_user)):
    _require_sticker(sticker_id, db)
    if not db.query(models.UserHave).filter(
            models.UserHave.user_id == user.id,
            models.UserHave.sticker_id == sticker_id).first():
        db.add(models.UserHave(user_id=user.id, sticker_id=sticker_id))
        db.commit()


@router.delete("/my/have/{sticker_id}", status_code=204)
def remove_have(sticker_id: int, db: Session = Depends(get_db), user=Depends(get_active_user)):
    db.query(models.UserHave).filter(
        models.UserHave.user_id == user.id,
        models.UserHave.sticker_id == sticker_id).delete()
    db.commit()


@router.put("/my/want/{sticker_id}", status_code=204)
def add_want(sticker_id: int, db: Session = Depends(get_db), user=Depends(get_active_user)):
    _require_sticker(sticker_id, db)
    if not db.query(models.UserWant).filter(
            models.UserWant.user_id == user.id,
            models.UserWant.sticker_id == sticker_id).first():
        db.add(models.UserWant(user_id=user.id, sticker_id=sticker_id))
        db.commit()


@router.delete("/my/want/{sticker_id}", status_code=204)
def remove_want(sticker_id: int, db: Session = Depends(get_db), user=Depends(get_active_user)):
    db.query(models.UserWant).filter(
        models.UserWant.user_id == user.id,
        models.UserWant.sticker_id == sticker_id).delete()
    db.commit()


@router.post("/my/have/bulk", status_code=204)
def bulk_have(data: BulkUpdate, db: Session = Depends(get_db), user=Depends(get_active_user)):
    for sid in data.add:
        if not db.query(models.UserHave).filter(
                models.UserHave.user_id == user.id,
                models.UserHave.sticker_id == sid).first():
            db.add(models.UserHave(user_id=user.id, sticker_id=sid))
    for sid in data.remove:
        db.query(models.UserHave).filter(
            models.UserHave.user_id == user.id,
            models.UserHave.sticker_id == sid).delete()
    db.commit()


@router.post("/my/want/bulk", status_code=204)
def bulk_want(data: BulkUpdate, db: Session = Depends(get_db), user=Depends(get_active_user)):
    for sid in data.add:
        if not db.query(models.UserWant).filter(
                models.UserWant.user_id == user.id,
                models.UserWant.sticker_id == sid).first():
            db.add(models.UserWant(user_id=user.id, sticker_id=sid))
    for sid in data.remove:
        db.query(models.UserWant).filter(
            models.UserWant.user_id == user.id,
            models.UserWant.sticker_id == sid).delete()
    db.commit()


def _require_sticker(sticker_id: int, db: Session):
    if not db.query(models.Sticker).filter(models.Sticker.id == sticker_id).first():
        raise HTTPException(status_code=404, detail="Sticker nicht gefunden")
