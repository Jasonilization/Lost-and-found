from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import logging
import secrets
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from backend.database import Claim, ItemQuery, LostFoundItem, SessionLocal, User, UserSession, init_db
from backend.moderation import validate_class_of, validate_initials, validate_text_input
from backend.ollama_tagger import OLLAMA_URL, build_search_text, fallback_tags, get_ollama_status, moderate_text_with_ollama, tag_item

app = FastAPI(title="School Lost and Found")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
FRONTEND_DIR = BASE_DIR / "frontend"
LOG_DIR = BASE_DIR / "data"

UPLOAD_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

CLAIMS_LOG_PATH = LOG_DIR / "claims.log"
ADMIN_LOG_PATH = LOG_DIR / "admin_actions.log"

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

claims_logger = logging.getLogger("claims")
if not claims_logger.handlers:
    handler = logging.FileHandler(CLAIMS_LOG_PATH)
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    claims_logger.addHandler(handler)
claims_logger.setLevel(logging.INFO)
claims_logger.propagate = False

report_logger = logging.getLogger("report_submission")
admin_logger = logging.getLogger("admin_actions")
if not admin_logger.handlers:
    admin_handler = logging.FileHandler(ADMIN_LOG_PATH)
    admin_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    admin_logger.addHandler(admin_handler)
admin_logger.setLevel(logging.INFO)
admin_logger.propagate = False

SCHOOL_LOCATIONS = [
    "New Sports Hall",
    "Sports Hall",
    "Long Court",
    "Library",
    "Morris Forum",
    "Senior Building",
    "Primary Building",
    "Innovation Building",
]

CATEGORIES = [
    "Electronics",
    "ID Card",
    "Books",
    "Stationery",
    "Uniform",
    "Bag",
    "Bottle",
    "Keys",
    "Sports Gear",
    "Other",
]

TIME_SLOTS = ["Before School", "Morning", "Lunch", "Afternoon", "After School", "Unknown"]
STATUSES = ["Open", "Matched", "Claimed", "Archived"]
REPORT_TYPES = ["lost", "found"]
DEFAULT_REPORT_TYPE = "lost"
CLAIM_STATUSES = ["pending", "approved", "rejected"]
REPORT_SUBMISSION_COOLDOWN = timedelta(hours=1)


class RegisterPayload(BaseModel):
    username: str
    password: str
    initials: str
    class_of: int


class LoginPayload(BaseModel):
    username: str
    password: str


class ClaimPayload(BaseModel):
    claim_reason: str
    item_description: str
    lost_location: str
    identifying_info: str


class QueryPayload(BaseModel):
    message: str


class ReportImagePayload(BaseModel):
    filename: str
    content_type: Optional[str] = None
    data: str


class ReportPayload(BaseModel):
    reporter_name: str
    title: str
    description: str
    location: str
    category: str
    student_id: str = ""
    contact_info: str = ""
    secondary_location: str = ""
    color: str = ""
    time_slot: str = "Unknown"
    event_date: Optional[date] = None
    image: Optional[ReportImagePayload] = None


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str, salt: Optional[str] = None) -> str:
    real_salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), real_salt.encode("utf-8"), 100_000)
    return f"{real_salt}${derived.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, stored = password_hash.split("$", 1)
    except ValueError:
        return False
    candidate = hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(candidate, stored)


def issue_session_token() -> str:
    return secrets.token_urlsafe(32)


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = authorization.split(" ", 1)[1].strip()
    session = db.query(UserSession).filter(UserSession.token == token).first()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token.")

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Session user missing.")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    return require_admin_user(current_user)


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


def save_upload_bytes(filename: str, file_bytes: bytes) -> Optional[str]:
    if not filename or not file_bytes:
        return None

    original_name = Path(filename).name
    safe_name = f"{date.today().isoformat()}_{uuid4().hex[:8]}_{original_name}".replace(" ", "_")
    destination = UPLOAD_DIR / safe_name
    destination.write_bytes(file_bytes)
    return f"/uploads/{safe_name}"


def decode_image_payload(image: Optional[ReportImagePayload]) -> Optional[str]:
    if not image or not image.data.strip():
        return None

    encoded = image.data.strip()
    if encoded.startswith("data:") and "," in encoded:
        encoded = encoded.split(",", 1)[1]

    try:
        file_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Image payload is not valid base64.") from exc

    return save_upload_bytes(image.filename, file_bytes)


def user_identity(user: Optional[User]) -> str:
    if not user:
        return ""
    if user.initials and user.class_of:
        return f"{user.initials} (Class of {user.class_of})"
    return user.username


def get_user_map(db: Session, user_ids: list[int]) -> dict[int, User]:
    unique_ids = sorted({user_id for user_id in user_ids if user_id})
    if not unique_ids:
        return {}
    users = db.query(User).filter(User.id.in_(unique_ids)).all()
    return {user.id: user for user in users}


def moderate_field(value: str, field_label: str, *, min_meaningful_chars: int, max_chars: int) -> str:
    cleaned, suspicious = validate_text_input(
        value,
        field_label,
        min_meaningful_chars=min_meaningful_chars,
        max_chars=max_chars,
    )
    if suspicious:
        moderation = moderate_text_with_ollama(cleaned)
        if not moderation.get("safe", True):
            raise HTTPException(status_code=400, detail=f"{field_label} was blocked: {moderation.get('reason', 'unsafe content')}.")
    return cleaned


def ensure_submission_allowed(db: Session, current_user: User) -> None:
    latest = (
        db.query(LostFoundItem)
        .filter(LostFoundItem.submitted_by_user_id == current_user.id)
        .order_by(LostFoundItem.created_at.desc())
        .first()
    )
    if not latest or not latest.created_at:
        return

    next_allowed = latest.created_at + REPORT_SUBMISSION_COOLDOWN
    if next_allowed <= datetime.utcnow():
        return

    remaining_minutes = max(1, int((next_allowed - datetime.utcnow()).total_seconds() // 60) + 1)
    raise HTTPException(
        status_code=429,
        detail=f"You can submit only 1 item per hour. Try again in about {remaining_minutes} minute(s).",
    )


def serialize_item(item: LostFoundItem, reporter: Optional[User]) -> dict:
    return {
        "id": item.id,
        "report_type": item.report_type,
        "reporter_name": item.reporter_name,
        "reporter_identity": user_identity(reporter),
        "student_id": item.student_id,
        "contact_info": item.contact_info,
        "title": item.title,
        "description": item.description,
        "location": item.location,
        "secondary_location": item.secondary_location,
        "category": item.category,
        "color": item.color,
        "time_slot": item.time_slot,
        "event_date": item.event_date.isoformat() if item.event_date else None,
        "status": item.status,
        "claimed": bool(item.claimed),
        "tags": item.tags,
        "ai_summary": item.ai_summary,
        "tag_source": item.tag_source,
        "image_path": item.image_path,
        "image_url": item.image_path,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "initials": user.initials,
        "class_of": user.class_of,
        "identity": user_identity(user),
        "is_admin": bool(user.is_admin),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def serialize_claim(claim: Claim, item: LostFoundItem, claimant: Optional[User], reporter: Optional[User]) -> dict:
    return {
        "id": claim.id,
        "item_id": claim.item_id,
        "user_id": claim.user_id,
        "user_identity": user_identity(claimant),
        "claim_reason": claim.claim_reason,
        "item_description": claim.item_description,
        "lost_location": claim.lost_location,
        "identifying_info": claim.identifying_info,
        "status": claim.status,
        "timestamp": claim.created_at.isoformat() if claim.created_at else None,
        "updated_at": claim.updated_at.isoformat() if claim.updated_at else None,
        "item": serialize_item(item, reporter),
    }


def serialize_admin_user(user: User) -> dict:
    return {
        "id": user.id,
        "initials": user.initials,
        "class_of": user.class_of,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def serialize_admin_claim(claim: Claim, item: LostFoundItem, claimant: Optional[User], reporter: Optional[User]) -> dict:
    claim_data = serialize_claim(claim, item, claimant, reporter)
    claim_data["user"] = serialize_admin_user(claimant) if claimant else {
        "id": claim.user_id,
        "initials": "",
        "class_of": None,
        "created_at": None,
    }
    return claim_data


def serialize_query(query: ItemQuery, author: Optional[User]) -> dict:
    return {
        "id": query.id,
        "item_id": query.item_id,
        "user_id": query.user_id,
        "user_identity": user_identity(author),
        "message": query.message,
        "created_at": query.created_at.isoformat() if query.created_at else None,
    }


def fetch_item_or_404(db: Session, item_id: int) -> LostFoundItem:
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    return item


def fetch_claim_or_404(db: Session, claim_id: int) -> Claim:
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return claim


def log_admin_action(admin_user: User, action: str, *, claim: Optional[Claim] = None, item: Optional[LostFoundItem] = None, note: str = "") -> None:
    admin_logger.info(
        "admin_id=%s admin_username=%s action=%s claim_id=%s item_id=%s note=%s",
        admin_user.id,
        admin_user.username,
        action,
        claim.id if claim else "",
        item.id if item else "",
        note,
    )


@app.get("/health")
def health() -> dict:
    ollama_status = get_ollama_status()
    return {
        "status": "ok",
        "ollama_url": OLLAMA_URL,
        "ollama_available": ollama_status["available"],
        "ollama_message": ollama_status["message"],
        "ollama_error": ollama_status.get("error", ""),
        "ollama_vision_model": ollama_status.get("vision_model", ""),
        "ollama_text_model": ollama_status.get("text_model", ""),
    }


@app.post("/register")
def register(payload: RegisterPayload, db: Session = Depends(get_db)) -> dict:
    username = payload.username.strip()
    password = payload.password.strip()
    initials = validate_initials(payload.initials)
    class_of = validate_class_of(payload.class_of)

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username already exists.")

    user = User(
        username=username,
        password_hash=hash_password(password),
        initials=initials,
        class_of=class_of,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = issue_session_token()
    db.add(UserSession(user_id=user.id, token=token))
    db.commit()

    return {"token": token, "user": serialize_user(user)}


@app.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)) -> dict:
    username = payload.username.strip()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = issue_session_token()
    db.add(UserSession(user_id=user.id, token=token))
    db.commit()
    return {"token": token, "user": serialize_user(user)}


@app.get("/session")
def session_status(current_user: User = Depends(get_current_user)) -> dict:
    return {"user": serialize_user(current_user)}


@app.get("/filters")
def filters(_: User = Depends(get_current_user)) -> dict:
    return {
        "locations": SCHOOL_LOCATIONS,
        "categories": CATEGORIES,
        "time_slots": TIME_SLOTS,
        "statuses": STATUSES,
        "report_types": REPORT_TYPES,
    }


@app.post("/items/report")
async def report_item(
    payload: ReportPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_submission_allowed(db, current_user)

    report_logger.info(
        "Received report payload: %s",
        {
            "reporter_name": payload.reporter_name,
            "title": payload.title,
            "location": payload.location,
            "category": payload.category,
            "event_date": payload.event_date.isoformat() if payload.event_date else None,
            "has_image": bool(payload.image),
            "image_filename": payload.image.filename if payload.image else "",
        },
    )

    reporter_name = payload.reporter_name.strip() or current_user.username
    location = payload.location.strip()
    category = payload.category.strip()

    if not reporter_name:
        raise HTTPException(status_code=400, detail="Reporter name is required.")
    if not location:
        raise HTTPException(status_code=400, detail="Location is required.")
    if not category:
        raise HTTPException(status_code=400, detail="Category is required.")

    title = moderate_field(payload.title, "Item title", min_meaningful_chars=3, max_chars=80)
    description = moderate_field(payload.description, "Item description", min_meaningful_chars=10, max_chars=450)
    secondary_location = payload.secondary_location.strip()
    student_id = payload.student_id.strip()
    contact_info = payload.contact_info.strip()
    color = payload.color.strip()
    time_slot = payload.time_slot.strip() or "Unknown"

    image_path = decode_image_payload(payload.image)
    try:
        ai_result = tag_item(
            title=title,
            description=description,
            location=location,
            category=category,
            color=color,
            report_type=DEFAULT_REPORT_TYPE,
            image_path=image_path,
        )
    except Exception:
        report_logger.exception("AI tagging failed unexpectedly; using fallback tags.")
        ai_result = fallback_tags(title, description, category, color, location)

    tags = ai_result.get("tags", [])
    item = LostFoundItem(
        report_type=DEFAULT_REPORT_TYPE,
        reporter_name=reporter_name,
        student_id=student_id,
        contact_info=contact_info,
        title=title,
        description=description,
        location=location,
        secondary_location=secondary_location,
        category=ai_result.get("category") or category,
        color=ai_result.get("color") or color,
        time_slot=time_slot,
        event_date=payload.event_date,
        status="Open",
        tags=tags,
        ai_summary=ai_result.get("summary", ""),
        image_path=image_path,
        search_text=build_search_text(
            title=title,
            description=description,
            location=location,
            category=ai_result.get("category") or category,
            color=ai_result.get("color") or color,
            tags=tags,
        ),
        tag_source=ai_result.get("tag_source", "fallback-text"),
        submitted_by_user_id=current_user.id,
        claimed=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"message": "Report saved successfully", "item": serialize_item(item, current_user)}


@app.get("/items")
def list_items(
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    location: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    base_query = db.query(LostFoundItem)

    if report_type:
        base_query = base_query.filter(LostFoundItem.report_type == report_type)
    if status:
        base_query = base_query.filter(LostFoundItem.status == status)
    if location:
        base_query = base_query.filter(LostFoundItem.location == location)
    if category:
        base_query = base_query.filter(LostFoundItem.category == category)

    if q:
        lowered = q.strip().lower()
        if lowered:
            contains = f"%{lowered}%"
            starts = f"{lowered}%"
            score = (
                case((LostFoundItem.title.ilike(starts), 80), else_=0)
                + case((LostFoundItem.title.ilike(contains), 40), else_=0)
                + case((LostFoundItem.tags_json.ilike(contains), 30), else_=0)
                + case((LostFoundItem.location.ilike(contains), 25), else_=0)
                + case((LostFoundItem.description.ilike(contains), 20), else_=0)
                + case((LostFoundItem.search_text.ilike(contains), 10), else_=0)
            ).label("relevance")
            rows = (
                base_query.add_columns(score)
                .filter(
                    or_(
                        LostFoundItem.title.ilike(contains),
                        LostFoundItem.tags_json.ilike(contains),
                        LostFoundItem.location.ilike(contains),
                        LostFoundItem.description.ilike(contains),
                        LostFoundItem.search_text.ilike(contains),
                    )
                )
                .order_by(score.desc(), LostFoundItem.created_at.desc())
                .all()
            )
            items = [row[0] for row in rows]
        else:
            items = base_query.order_by(LostFoundItem.created_at.desc()).all()
    else:
        items = base_query.order_by(LostFoundItem.created_at.desc()).all()

    reporters = get_user_map(db, [item.submitted_by_user_id or 0 for item in items])
    return {"items": [serialize_item(item, reporters.get(item.submitted_by_user_id or 0)) for item in items]}


@app.patch("/items/{item_id}/status")
def update_item_status(
    item_id: int,
    status: str = Form(...),
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status.")

    item = fetch_item_or_404(db, item_id)
    item.status = status
    item.claimed = status == "Claimed"
    db.commit()
    db.refresh(item)
    log_admin_action(current_user, "update-item-status", item=item, note=f"item_status={item.status}")
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Status updated.", "item": serialize_item(item, reporter)}


@app.post("/items/{item_id}/claim")
def claim_item(
    item_id: int,
    payload: ClaimPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    if item.claimed:
        raise HTTPException(status_code=400, detail="This item is already marked as claimed.")

    existing_claim = db.query(Claim).filter(Claim.item_id == item_id, Claim.user_id == current_user.id).first()
    if existing_claim:
        raise HTTPException(status_code=409, detail="You already submitted a claim for this item.")

    claim = Claim(
        item_id=item.id,
        user_id=current_user.id,
        claim_reason=moderate_field(payload.claim_reason, "Claim reason", min_meaningful_chars=6, max_chars=240),
        item_description=moderate_field(payload.item_description, "Item description", min_meaningful_chars=6, max_chars=240),
        lost_location=moderate_field(payload.lost_location, "Lost location", min_meaningful_chars=4, max_chars=120),
        identifying_info=moderate_field(payload.identifying_info, "Identifying info", min_meaningful_chars=4, max_chars=240),
        status="pending",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    claims_logger.info(
        "claim_id=%s item_id=%s user_id=%s username=%s identity=%s status=%s",
        claim.id,
        item.id,
        current_user.id,
        current_user.username,
        user_identity(current_user),
        claim.status,
    )

    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Claim submitted.", "claim": serialize_claim(claim, item, current_user, reporter)}


@app.get("/claims/history")
def claim_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    claims = db.query(Claim).filter(Claim.user_id == current_user.id).order_by(Claim.created_at.desc()).all()
    item_map = {
        item.id: item
        for item in db.query(LostFoundItem).filter(LostFoundItem.id.in_([claim.item_id for claim in claims])).all()
    } if claims else {}
    reporter_map = get_user_map(db, [item.submitted_by_user_id or 0 for item in item_map.values()])
    return {
        "claims": [
            serialize_claim(
                claim,
                item_map[claim.item_id],
                current_user,
                reporter_map.get(item_map[claim.item_id].submitted_by_user_id or 0),
            )
            for claim in claims
            if claim.item_id in item_map
        ]
    }


@app.get("/admin/users")
def admin_list_users(
    _: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {"users": [serialize_admin_user(user) for user in users]}


@app.get("/admin/claims")
def admin_list_claims(
    _: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    claims = (
        db.query(Claim)
        .order_by(case((Claim.status == "pending", 0), else_=1), Claim.created_at.desc())
        .all()
    )
    item_ids = [claim.item_id for claim in claims]
    item_map = {
        item.id: item
        for item in db.query(LostFoundItem).filter(LostFoundItem.id.in_(item_ids)).all()
    } if item_ids else {}
    user_map = get_user_map(db, [claim.user_id for claim in claims])
    reporter_map = get_user_map(
        db,
        [item.submitted_by_user_id or 0 for item in item_map.values()],
    )
    return {
        "claims": [
            serialize_admin_claim(
                claim,
                item_map[claim.item_id],
                user_map.get(claim.user_id),
                reporter_map.get(item_map[claim.item_id].submitted_by_user_id or 0),
            )
            for claim in claims
            if claim.item_id in item_map
        ]
    }


@app.post("/admin/claims/{claim_id}/approve")
def admin_approve_claim(
    claim_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    claim = fetch_claim_or_404(db, claim_id)
    item = fetch_item_or_404(db, claim.item_id)

    if claim.status == "approved":
        raise HTTPException(status_code=409, detail="This claim is already approved.")
    if claim.status == "rejected":
        raise HTTPException(status_code=409, detail="Rejected claims cannot be approved.")

    existing_approved = (
        db.query(Claim)
        .filter(Claim.item_id == item.id, Claim.status == "approved", Claim.id != claim.id)
        .first()
    )
    if existing_approved or item.claimed:
        raise HTTPException(status_code=409, detail="This item already has an approved claim.")

    claim.status = "approved"
    item.claimed = True
    item.status = "Claimed"
    db.commit()
    db.refresh(claim)
    db.refresh(item)

    log_admin_action(
        current_user,
        "approve-claim",
        claim=claim,
        item=item,
        note=f"claim_status={claim.status} item_claimed={item.claimed}",
    )

    claimant = db.query(User).filter(User.id == claim.user_id).first()
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {
        "message": "Claim approved.",
        "claim": serialize_admin_claim(claim, item, claimant, reporter),
    }


@app.post("/admin/claims/{claim_id}/reject")
def admin_reject_claim(
    claim_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    claim = fetch_claim_or_404(db, claim_id)
    item = fetch_item_or_404(db, claim.item_id)

    if claim.status == "rejected":
        raise HTTPException(status_code=409, detail="This claim is already rejected.")
    if claim.status == "approved":
        raise HTTPException(status_code=409, detail="Approved claims cannot be rejected.")

    claim.status = "rejected"
    db.commit()
    db.refresh(claim)

    log_admin_action(
        current_user,
        "reject-claim",
        claim=claim,
        item=item,
        note=f"claim_status={claim.status}",
    )

    claimant = db.query(User).filter(User.id == claim.user_id).first()
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {
        "message": "Claim rejected.",
        "claim": serialize_admin_claim(claim, item, claimant, reporter),
    }


@app.post("/items/{item_id}/mark-claimed")
def mark_item_claimed(
    item_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    item.claimed = True
    item.status = "Claimed"
    db.commit()
    db.refresh(item)
    log_admin_action(current_user, "mark-item-claimed", item=item, note=f"item_status={item.status}")
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Item marked as claimed.", "item": serialize_item(item, reporter)}


@app.post("/items/{item_id}/query")
def create_query(
    item_id: int,
    payload: QueryPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _ = fetch_item_or_404(db, item_id)
    message = moderate_field(payload.message, "Query message", min_meaningful_chars=6, max_chars=220)
    item_query = ItemQuery(item_id=item_id, user_id=current_user.id, message=message)
    db.add(item_query)
    db.commit()
    db.refresh(item_query)
    return {"message": "Query posted.", "query": serialize_query(item_query, current_user)}


@app.get("/items/{item_id}/queries")
def list_queries(
    item_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _ = fetch_item_or_404(db, item_id)
    queries = db.query(ItemQuery).filter(ItemQuery.item_id == item_id).order_by(ItemQuery.created_at.asc()).all()
    authors = get_user_map(db, [query.user_id for query in queries])
    return {"queries": [serialize_query(query, authors.get(query.user_id)) for query in queries]}


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
