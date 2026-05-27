from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nickname = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    have = relationship("UserHave", back_populates="user", cascade="all, delete-orphan")
    want = relationship("UserWant", back_populates="user", cascade="all, delete-orphan")


class Sticker(Base):
    __tablename__ = "stickers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    category = Column(String, nullable=False)
    country_code = Column(String, nullable=True)
    country_name = Column(String, nullable=True)
    group_name = Column(String, nullable=True)
    number = Column(Integer, nullable=True)
    description = Column(String, nullable=True)
    is_foil = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    have_entries = relationship("UserHave", back_populates="sticker")
    want_entries = relationship("UserWant", back_populates="sticker")


class UserHave(Base):
    __tablename__ = "user_have"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sticker_id = Column(Integer, ForeignKey("stickers.id"), nullable=False)

    user = relationship("User", back_populates="have")
    sticker = relationship("Sticker", back_populates="have_entries")

    __table_args__ = (UniqueConstraint("user_id", "sticker_id"),)


class UserWant(Base):
    __tablename__ = "user_want"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sticker_id = Column(Integer, ForeignKey("stickers.id"), nullable=False)

    user = relationship("User", back_populates="want")
    sticker = relationship("Sticker", back_populates="want_entries")

    __table_args__ = (UniqueConstraint("user_id", "sticker_id"),)


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    event = Column(String, nullable=False)
    ip = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    details = Column(String, nullable=True)
