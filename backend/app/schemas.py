from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
import re


class UserCreate(BaseModel):
    nickname: str
    password: str

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v):
        if len(v) < 2 or len(v) > 20:
            raise ValueError("Nickname muss 2-20 Zeichen lang sein")
        if not re.match(r"^[a-zA-Z0-9_\-äöüÄÖÜ]+$", v):
            raise ValueError("Nur Buchstaben, Zahlen, _ und - erlaubt")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 4:
            raise ValueError("Passwort muss mindestens 4 Zeichen haben")
        return v


class UserLogin(BaseModel):
    nickname: str
    password: str


class UserOut(BaseModel):
    id: int
    nickname: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class StickerOut(BaseModel):
    id: int
    code: str
    category: str
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    group_name: Optional[str] = None
    number: Optional[int] = None
    description: Optional[str] = None
    is_foil: bool

    model_config = {"from_attributes": True}


class StickerCreate(BaseModel):
    code: str
    category: str
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    group_name: Optional[str] = None
    number: Optional[int] = None
    description: Optional[str] = None
    is_foil: bool = False


class HaveItem(BaseModel):
    sticker_id: int
    quantity: int

    model_config = {"from_attributes": True}


class SetQuantity(BaseModel):
    quantity: int


class BulkUpdate(BaseModel):
    add: List[int] = []
    remove: List[int] = []


class TradeSticker(BaseModel):
    id: int
    code: str
    description: Optional[str] = None
    country_name: Optional[str] = None
    is_foil: bool

    model_config = {"from_attributes": True}


class TradePartner(BaseModel):
    user_id: int
    nickname: str
    give: List[TradeSticker] = []
    receive: List[TradeSticker] = []


class TradeChainStep(BaseModel):
    from_user: str
    to_user: str
    stickers: List[TradeSticker] = []


class TradeResult(BaseModel):
    type: str
    label: str
    color: str
    partners: List[TradePartner] = []
    chain: List[TradeChainStep] = []


class TradeConfirm(BaseModel):
    give_ids: List[int] = []
    receive_ids: List[int] = []
    partner_id: Optional[int] = None


class TradePendingOut(BaseModel):
    id: int
    confirmer_nickname: str
    # From MY (partner's) perspective: what I get and what I give
    i_receive: List[TradeSticker] = []   # stickers coming to me (confirmer gave these)
    i_give: List[TradeSticker] = []      # stickers leaving me (confirmer received these)
    give_ids: List[int] = []             # raw IDs needed for confirm call
    receive_ids: List[int] = []          # raw IDs needed for confirm call
    confirmed_at: Optional[datetime] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 4:
            raise ValueError("Passwort muss mindestens 4 Zeichen haben")
        return v
