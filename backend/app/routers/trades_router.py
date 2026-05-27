from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import TradeResult
from ..auth import get_active_user
from ..trade_engine import find_trades
from .. import models

router = APIRouter()


@router.get("", response_model=List[TradeResult])
def get_trades(db: Session = Depends(get_db), user: models.User = Depends(get_active_user)):
    return find_trades(user.id, db)
