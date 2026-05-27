from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import TradeResult, TradeConfirm
from ..auth import get_active_user
from ..trade_engine import find_trades
from .. import models

router = APIRouter()


@router.get("", response_model=List[TradeResult])
def get_trades(db: Session = Depends(get_db), user: models.User = Depends(get_active_user)):
    return find_trades(user.id, db)


@router.post("/confirm")
def confirm_trade(body: TradeConfirm, db: Session = Depends(get_db), user: models.User = Depends(get_active_user)):
    if body.give_ids:
        db.query(models.UserHave).filter(
            models.UserHave.user_id == user.id,
            models.UserHave.sticker_id.in_(body.give_ids)
        ).delete(synchronize_session=False)

    if body.receive_ids:
        db.query(models.UserWant).filter(
            models.UserWant.user_id == user.id,
            models.UserWant.sticker_id.in_(body.receive_ids)
        ).delete(synchronize_session=False)

        existing = {r.sticker_id for r in db.query(models.UserHave).filter(
            models.UserHave.user_id == user.id,
            models.UserHave.sticker_id.in_(body.receive_ids)
        ).all()}
        for sid in body.receive_ids:
            if sid not in existing:
                db.add(models.UserHave(user_id=user.id, sticker_id=sid))

    db.commit()
    return {"ok": True}
