import json as _json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
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
def confirm_trade(body: TradeConfirm, db: Session = Depends(get_db),
                  user: models.User = Depends(get_active_user)):
    # ── Update own inventory ──────────────────────────────────────────────────
    if body.give_ids:
        for sid in body.give_ids:
            entry = db.query(models.UserHave).filter(
                models.UserHave.user_id == user.id,
                models.UserHave.sticker_id == sid).first()
            if entry:
                if entry.quantity <= 1:
                    db.delete(entry)
                else:
                    entry.quantity -= 1

    if body.receive_ids:
        db.query(models.UserWant).filter(
            models.UserWant.user_id == user.id,
            models.UserWant.sticker_id.in_(body.receive_ids)
        ).delete(synchronize_session=False)

        for sid in body.receive_ids:
            entry = db.query(models.UserHave).filter(
                models.UserHave.user_id == user.id,
                models.UserHave.sticker_id == sid).first()
            if entry:
                entry.quantity += 1
            else:
                db.add(models.UserHave(user_id=user.id, sticker_id=sid, quantity=1))

    # ── Create pending notice for partner ────────────────────────────────────
    if body.partner_id and body.partner_id != user.id:
        # Replace any existing pending between these two (avoid duplicates)
        db.query(models.TradePending).filter(
            models.TradePending.confirmer_id == user.id,
            models.TradePending.partner_id == body.partner_id,
        ).delete()
        db.add(models.TradePending(
            confirmer_id=user.id,
            partner_id=body.partner_id,
            give_ids=_json.dumps(body.give_ids),
            receive_ids=_json.dumps(body.receive_ids),
        ))

    db.commit()
    return {"ok": True}


@router.get("/pending")
def get_pending(db: Session = Depends(get_db), user: models.User = Depends(get_active_user)):
    """Return trade confirmations from others that are waiting for the current user."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    pendings = db.query(models.TradePending).filter(
        models.TradePending.partner_id == user.id,
        models.TradePending.confirmed_at >= cutoff,
    ).all()

    result = []
    for p in pendings:
        confirmer = db.query(models.User).filter(models.User.id == p.confirmer_id).first()
        give_ids    = _json.loads(p.give_ids)     # confirmer gave these → I receive
        receive_ids = _json.loads(p.receive_ids)  # confirmer received → I gave

        def sticker_info(sid):
            s = db.query(models.Sticker).filter(models.Sticker.id == sid).first()
            return {"id": s.id, "code": s.code, "description": s.description,
                    "country_name": s.country_name, "is_foil": s.is_foil} if s else None

        i_receive = [x for x in (sticker_info(s) for s in give_ids)    if x]
        i_give    = [x for x in (sticker_info(s) for s in receive_ids) if x]

        result.append({
            "id": p.id,
            "confirmer_nickname": confirmer.nickname if confirmer else "?",
            "i_receive": i_receive,
            "i_give":    i_give,
            "give_ids":     give_ids,      # raw IDs for the confirm call
            "receive_ids":  receive_ids,
            "confirmed_at": p.confirmed_at.isoformat() if p.confirmed_at else None,
        })
    return result


@router.post("/pending/{pending_id}/confirm", status_code=204)
def confirm_pending(pending_id: int, db: Session = Depends(get_db),
                    user: models.User = Depends(get_active_user)):
    """Partner confirms their side of the trade — updates their inventory."""
    pending = db.query(models.TradePending).filter(
        models.TradePending.id == pending_id,
        models.TradePending.partner_id == user.id,
    ).first()
    if not pending:
        raise HTTPException(status_code=404, detail="Nicht gefunden")

    # From my (partner's) perspective:
    #   confirmer gave  → I receive these (remove from my want, add to my have)
    #   confirmer got   → I gave these    (decrement my have)
    my_receive_ids = _json.loads(pending.give_ids)
    my_give_ids    = _json.loads(pending.receive_ids)

    for sid in my_give_ids:
        entry = db.query(models.UserHave).filter(
            models.UserHave.user_id == user.id,
            models.UserHave.sticker_id == sid).first()
        if entry:
            if entry.quantity <= 1:
                db.delete(entry)
            else:
                entry.quantity -= 1

    db.query(models.UserWant).filter(
        models.UserWant.user_id == user.id,
        models.UserWant.sticker_id.in_(my_receive_ids)
    ).delete(synchronize_session=False)

    for sid in my_receive_ids:
        entry = db.query(models.UserHave).filter(
            models.UserHave.user_id == user.id,
            models.UserHave.sticker_id == sid).first()
        if entry:
            entry.quantity += 1
        else:
            db.add(models.UserHave(user_id=user.id, sticker_id=sid, quantity=1))

    db.delete(pending)
    db.commit()


@router.delete("/pending/{pending_id}", status_code=204)
def dismiss_pending(pending_id: int, db: Session = Depends(get_db),
                    user: models.User = Depends(get_active_user)):
    """Dismiss a pending notice without updating inventory."""
    db.query(models.TradePending).filter(
        models.TradePending.id == pending_id,
        models.TradePending.partner_id == user.id,
    ).delete()
    db.commit()
