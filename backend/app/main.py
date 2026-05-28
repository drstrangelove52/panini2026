from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .routers import auth_router, stickers_router, trades_router, admin_router
from . import models
from sqlalchemy import text
import os, json, logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Panini WM 2026 Tauschbörse", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router,     prefix="/api/auth",    tags=["auth"])
app.include_router(stickers_router.router, prefix="/api/stickers",tags=["stickers"])
app.include_router(trades_router.router,   prefix="/api/trades",  tags=["trades"])
app.include_router(admin_router.router,    prefix="/api/admin",   tags=["admin"])


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    _seed_stickers()
    _ensure_admin()


def _migrate_db():
    """Apply incremental schema changes that can't be handled by create_all."""
    with engine.connect() as conn:
        # Ensure migration-tracking table exists
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations
            (id TEXT PRIMARY KEY,
             applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
        """))
        conn.commit()

        # ── DDL migrations (idempotent – safe to retry) ───────────────────────
        ddl = [
            "ALTER TABLE user_have ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE security_events ADD COLUMN country_code VARCHAR",
        ]
        for sql in ddl:
            try:
                conn.execute(text(sql))
                conn.commit()
                logger.info("DDL migration applied: %s", sql[:60])
            except Exception:
                pass  # Column already exists – safe to ignore

        # ── Data migrations (tracked to prevent re-run) ───────────────────────
        data_migrations = [
            (
                "v2_have_qty_semantics",
                # Old qty = number of extras.  New qty = total owned (in-album + extras).
                # +1 so existing duplicates stay tradeable under the new model.
                "UPDATE user_have SET quantity = quantity + 1",
                "Shift have.quantity: extras-only → total-owned",
            ),
        ]
        for migration_id, sql, description in data_migrations:
            already = conn.execute(
                text("SELECT 1 FROM schema_migrations WHERE id = :id"),
                {"id": migration_id},
            ).first()
            if not already:
                conn.execute(text(sql))
                conn.execute(
                    text("INSERT INTO schema_migrations (id) VALUES (:id)"),
                    {"id": migration_id},
                )
                conn.commit()
                logger.info("Data migration applied: %s – %s", migration_id, description)


def _seed_stickers():
    db = SessionLocal()
    try:
        if db.query(models.Sticker).count() > 0:
            return
        data_path = os.path.join(os.path.dirname(__file__), "data", "stickers_wm2026.json")
        with open(data_path, encoding="utf-8-sig") as f:
            stickers = json.load(f)
        for i, s in enumerate(stickers):
            db.add(models.Sticker(
                code=s["code"],
                category=s["category"],
                country_code=s.get("country_code"),
                country_name=s.get("country_name"),
                group_name=s.get("group"),
                number=s.get("number"),
                description=s.get("description"),
                is_foil=s.get("is_foil", False),
                sort_order=i,
            ))
        db.commit()
        logger.info("Seeded %d stickers", len(stickers))
    finally:
        db.close()


def _ensure_admin():
    db = SessionLocal()
    try:
        from .auth import hash_password
        nick = os.getenv("ADMIN_NICKNAME", "admin")
        pw = os.getenv("ADMIN_PASSWORD", "")
        if not pw:
            logger.warning("ADMIN_PASSWORD not set — admin account not created")
            return
        if db.query(models.User).filter(models.User.nickname == nick).first():
            return
        db.add(models.User(
            nickname=nick,
            password_hash=hash_password(pw),
            is_active=True,
            is_admin=True,
        ))
        db.commit()
        logger.info("Created admin user: %s", nick)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
