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
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from backend.ai_assistant import AI_MODEL, analyze_evidence, generate_query_package, model_size_label
from backend.ai_moderation import classify_user_input
from backend.database import AIInspectionLog, Claim, ItemQuery, LostFoundItem, QueryMessage, SessionLocal, User, UserSession, init_db
from backend.moderation import validate_class_of, validate_initials, validate_text_input
from backend.ollama_tagger import OLLAMA_URL, build_search_text, fallback_tags, get_ollama_status, tag_item

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
REVIEW_STATUSES = ["approved", "rejected", "incomplete", "needs-review"]
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
    evidence_details: str = ""
    student_id: str = ""
    contact_info: str = ""
    secondary_location: str = ""
    color: str = ""
    time_slot: str = "Unknown"
    event_date: Optional[date] = None
    image: Optional[ReportImagePayload] = None


class ProfileImagePayload(BaseModel):
    filename: str
    content_type: Optional[str] = None
    data: str


class AdminItemReviewPayload(BaseModel):
    status: str
    notes: str = ""


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


def build_input_text(*parts: Optional[str]) -> str:
    return " ".join(str(part or "").strip() for part in parts if str(part or "").strip()).strip()


def privilege_rank(user: Optional[User]) -> int:
    return 1 if bool(user and user.is_admin) else 0


def ensure_target_is_manageable(current_user: User, target_user: User, *, action: str) -> None:
    if privilege_rank(target_user) > privilege_rank(current_user):
        raise HTTPException(status_code=403, detail=f"Cannot {action} a higher privilege user.")


def get_item_reporter(db: Session, item: LostFoundItem) -> Optional[User]:
    if not item.submitted_by_user_id:
        return None
    return db.query(User).filter(User.id == item.submitted_by_user_id).first()


def build_query_response(item: LostFoundItem) -> str:
    location = item.location or "the recorded location"
    status = item.status or ("Claimed" if item.claimed else "Open")
    if item.claimed:
        return (
            f'This report for "{item.title}" is already marked as claimed. '
            f"Your message was saved, and the last recorded location is {location}."
        )
    return (
        f'I saved your question for "{item.title}". '
        f"It is currently marked {status} at {location}. "
        "If this sounds like your item, use the claim form so an admin can review it."
    )


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
        raise HTTPException(status_code=400, detail=f"{field_label} looks invalid or too noisy.")
    return cleaned


def ensure_submission_allowed(db: Session, current_user: User) -> None:
    if current_user.is_admin:
        return

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
        "reporter_avatar_url": reporter.avatar_path if reporter and reporter.avatar_path else "",
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
        "evidence_details": item.evidence_details,
        "evidence_images": item.evidence_images,
        "evidence_summary": item.evidence_summary,
        "evidence_inconsistencies": item.evidence_inconsistencies,
        "evidence_missing_info": item.evidence_missing_info,
        "evidence_validity": item.evidence_validity,
        "review_status": item.review_status,
        "review_notes": item.review_notes,
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
        "avatar_url": user.avatar_path or "",
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
        "username": user.username,
        "initials": user.initials,
        "class_of": user.class_of,
        "identity": user_identity(user),
        "is_admin": bool(user.is_admin),
        "avatar_url": user.avatar_path or "",
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


def serialize_query(query: QueryMessage, author: Optional[User]) -> dict:
    role = (query.role or "user").strip().lower() or "user"
    return {
        "id": query.id,
        "item_id": query.item_id,
        "user_id": query.user_id,
        "role": role,
        "user_identity": "System" if role == "system" else user_identity(author),
        "avatar_url": "" if role == "system" else (author.avatar_path if author and author.avatar_path else ""),
        "message": query.message,
        "created_at": query.created_at.isoformat() if query.created_at else None,
    }


def serialize_ai_inspection(log: AIInspectionLog, user: Optional[User]) -> dict:
    return {
        "id": log.id,
        "feature": log.feature,
        "route": log.route,
        "input_text": log.input_text,
        "allowed": bool(log.allowed),
        "reason": log.reason,
        "confidence": float(log.confidence or 0.0),
        "tags": log.tags,
        "raw_output": log.raw_output,
        "prompt_text": log.prompt_text,
        "output_text": log.output_text,
        "model_name": log.model_name,
        "model_size": log.model_size,
        "fallback_triggered": bool(log.fallback_triggered),
        "request_metadata": log.request_metadata,
        "user_identity": user_identity(user),
        "created_at": log.created_at.isoformat() if log.created_at else None,
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


def list_catalog_items(db: Session, *, limit: int = 20) -> list[dict]:
    items = (
        db.query(LostFoundItem)
        .order_by(LostFoundItem.created_at.desc())
        .limit(limit)
        .all()
    )
    reporters = get_user_map(db, [item.submitted_by_user_id or 0 for item in items])
    return [serialize_item(item, reporters.get(item.submitted_by_user_id or 0)) for item in items]


def get_query_messages_for_scope(db: Session, *, user_id: int, item_id: Optional[int]) -> list[QueryMessage]:
    query = db.query(QueryMessage).filter(QueryMessage.user_id == user_id)
    if item_id is None:
        query = query.filter(QueryMessage.item_id.is_(None))
    else:
        query = query.filter(QueryMessage.item_id == item_id)
    return query.order_by(QueryMessage.created_at.asc(), QueryMessage.id.asc()).all()


def serialize_query_list(db: Session, queries: list[QueryMessage]) -> list[dict]:
    authors = get_user_map(db, [query.user_id for query in queries])
    return [serialize_query(query, authors.get(query.user_id)) for query in queries]


def item_to_query_context(item: Optional[LostFoundItem], reporter: Optional[User]) -> Optional[dict]:
    if not item:
        return None
    return serialize_item(item, reporter)


def log_ai_package(
    db: Session,
    *,
    current_user: Optional[User],
    route: str,
    input_text: str,
    package: dict,
    feature: str,
) -> None:
    log_ai_inspection(
        db,
        current_user=current_user,
        route=route,
        input_text=input_text,
        decision={
            "allowed": True,
            "reason": package.get("reasoning_focus", "") or "AI response generated.",
            "confidence": 1.0,
            "tags": [],
            "raw_output": package.get("output_text", ""),
        },
        feature=feature,
        prompt_text=package.get("prompt_text", ""),
        output_text=package.get("output_text", ""),
        model_name=package.get("model_name", AI_MODEL),
        model_size=package.get("model_size", model_size_label(AI_MODEL)),
        fallback_triggered=bool(package.get("fallback_triggered")),
        request_metadata=package.get("request_metadata", {}),
    )


def log_ai_inspection(
    db: Session,
    *,
    current_user: Optional[User],
    route: str,
    input_text: str,
    decision: dict,
    feature: str = "moderation",
    prompt_text: str = "",
    output_text: str = "",
    model_name: str = "",
    model_size: str = "",
    fallback_triggered: bool = False,
    request_metadata: Optional[dict] = None,
) -> AIInspectionLog:
    log = AIInspectionLog(
        user_id=current_user.id if current_user else None,
        route=route,
        input_text=input_text,
        allowed=bool(decision.get("allowed", False)),
        reason=str(decision.get("reason", "")).strip(),
        confidence=float(decision.get("confidence", 0.0) or 0.0),
        raw_output=str(decision.get("raw_output", "")).strip(),
        feature=feature,
        prompt_text=prompt_text,
        output_text=output_text,
        model_name=model_name,
        model_size=model_size,
        fallback_triggered=fallback_triggered,
    )
    log.tags = decision.get("tags", [])
    log.request_metadata = request_metadata or {}
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def moderate_request(
    db: Session,
    *,
    current_user: Optional[User],
    route: str,
    input_text: str,
) -> dict:
    decision = classify_user_input(input_text)
    log_ai_inspection(
        db,
        current_user=current_user,
        route=route,
        input_text=input_text,
        decision=decision,
        feature="moderation",
        model_name=AI_MODEL,
        model_size=model_size_label(AI_MODEL),
        fallback_triggered=bool(decision.get("fallback_triggered")),
        request_metadata={"route": route},
    )
    return decision


def blocked_response(reason: str) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": "Request blocked", "reason": reason},
    )


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
        "ollama_text_model": ollama_status.get("text_model", ""),
        "ai_chat_model": AI_MODEL,
        "ai_chat_model_size": model_size_label(AI_MODEL),
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


@app.post("/account/profile-image")
def upload_profile_image(
    payload: ProfileImagePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    image = ReportImagePayload(filename=payload.filename, content_type=payload.content_type, data=payload.data)
    avatar_path = decode_image_payload(image)
    if current_user.avatar_path and current_user.avatar_path.startswith("/uploads/"):
        old_path = BASE_DIR / current_user.avatar_path.lstrip("/")
        if old_path.exists():
            old_path.unlink()
    current_user.avatar_path = avatar_path
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile image updated.", "user": serialize_user(current_user)}


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
            "evidence_details": payload.evidence_details,
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

    reporter_name = moderate_field(reporter_name, "Reporter name", min_meaningful_chars=2, max_chars=80)
    title = moderate_field(payload.title, "Item title", min_meaningful_chars=3, max_chars=80)
    description = moderate_field(payload.description, "Item description", min_meaningful_chars=10, max_chars=450)
    evidence_details = payload.evidence_details.strip()
    secondary_location = payload.secondary_location.strip()
    student_id = payload.student_id.strip()
    contact_info = payload.contact_info.strip()
    color = payload.color.strip()
    time_slot = payload.time_slot.strip() or "Unknown"

    moderation = moderate_request(
        db,
        current_user=current_user,
        route="/items/report",
        input_text=build_input_text(title, description, location, category),
    )
    if not moderation.get("allowed", False):
        return blocked_response(str(moderation.get("reason", "Request is not relevant to the lost-and-found system.")))

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

    evidence_result = analyze_evidence(
        title=title,
        description=description,
        category=category,
        location=location,
        evidence_details=evidence_details,
        has_image=bool(image_path),
    )
    log_ai_package(
        db,
        current_user=current_user,
        route="/items/report/evidence-analysis",
        input_text=build_input_text(title, description, evidence_details, location),
        package=evidence_result,
        feature="evidence-analysis",
    )

    tags = []
    for tag in ai_result.get("tags", []):
        value = str(tag).strip().lower()
        if value and value not in tags:
            tags.append(value)
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
        tags=tags[:6],
        ai_summary=ai_result.get("summary", ""),
        image_path=image_path,
        evidence_details=evidence_details,
        evidence_summary=evidence_result.get("summary", ""),
        evidence_inconsistencies=evidence_result.get("inconsistencies", ""),
        evidence_missing_info=evidence_result.get("missing_info", ""),
        evidence_validity=evidence_result.get("validity", "Needs review"),
        review_status="needs-review",
        review_notes="",
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
    item.evidence_images = [image_path] if image_path else []
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "message": "Report saved successfully",
        "reason": str(moderation.get("reason", "")).strip() or "Accepted: relevant lost-and-found request.",
        "item": serialize_item(item, current_user),
    }


@app.get("/items/{item_id}")
def get_item(
    item_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    reporter = get_item_reporter(db, item)
    return {"item": serialize_item(item, reporter)}


@app.get("/items")
def list_items(
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    location: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user),
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
            moderation = moderate_request(
                db,
                current_user=current_user,
                route="/items",
                input_text=lowered,
            )
            if not moderation.get("allowed", False):
                return blocked_response(str(moderation.get("reason", "Search was blocked.")))
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

    moderation = moderate_request(
        db,
        current_user=current_user,
        route=f"/items/{item_id}/claim",
        input_text=build_input_text(
            payload.claim_reason,
            payload.item_description,
            payload.lost_location,
            payload.identifying_info,
        ),
    )
    if not moderation.get("allowed", False):
        return blocked_response(str(moderation.get("reason", "Claim was blocked.")))

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


@app.post("/admin/users/{user_id}/promote")
def admin_promote_user(
    user_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    ensure_target_is_manageable(current_user, user, action="promote")
    if user.is_admin:
        raise HTTPException(status_code=409, detail="User is already an admin.")

    user.is_admin = True
    db.commit()
    db.refresh(user)
    log_admin_action(current_user, "promote-user", note=f"target_user_id={user.id}")
    return {"message": "User promoted to admin.", "user": serialize_admin_user(user)}


@app.post("/admin/users/{user_id}/demote")
def admin_demote_user(
    user_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    ensure_target_is_manageable(current_user, user, action="demote")
    if not user.is_admin:
        raise HTTPException(status_code=409, detail="User is not an admin.")
    if user.id == current_user.id:
        raise HTTPException(status_code=409, detail="Admin cannot demote their own account.")

    admin_count = db.query(User).filter(User.is_admin.is_(True)).count()
    if admin_count <= 1:
        raise HTTPException(status_code=409, detail="Cannot demote the last admin user.")

    user.is_admin = False
    db.commit()
    db.refresh(user)
    log_admin_action(current_user, "demote-user", note=f"target_user_id={user.id}")
    return {"message": "Admin rights removed.", "user": serialize_admin_user(user)}


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


@app.get("/admin/items")
def admin_list_items(
    _: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    items = db.query(LostFoundItem).order_by(LostFoundItem.created_at.desc()).all()
    reporters = get_user_map(db, [item.submitted_by_user_id or 0 for item in items])
    return {
        "items": [
            serialize_item(item, reporters.get(item.submitted_by_user_id or 0))
            for item in items
        ]
    }


@app.get("/admin/ai-inspection")
def admin_ai_inspection(
    _: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    logs = db.query(AIInspectionLog).order_by(AIInspectionLog.created_at.desc()).all()
    users = get_user_map(db, [log.user_id or 0 for log in logs])
    return {
        "logs": [
            serialize_ai_inspection(log, users.get(log.user_id or 0))
            for log in logs
        ]
    }


@app.delete("/admin/items/{item_id}")
def admin_delete_item(
    item_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    if item.image_path and item.image_path.startswith("/uploads/"):
        upload_path = BASE_DIR / item.image_path.lstrip("/")
        if upload_path.exists():
            upload_path.unlink()
    db.query(ItemQuery).filter(ItemQuery.item_id == item.id).delete()
    db.query(QueryMessage).filter(QueryMessage.item_id == item.id).delete()
    db.query(Claim).filter(Claim.item_id == item.id).delete()
    db.delete(item)
    db.commit()
    log_admin_action(current_user, "delete-item", item=item, note=f"title={item.title}")
    return {"message": "Item deleted."}


@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_user.id:
        raise HTTPException(status_code=409, detail="Admin cannot delete their own account.")
    ensure_target_is_manageable(current_user, user, action="delete")
    if user.is_admin:
        admin_count = db.query(User).filter(User.is_admin.is_(True)).count()
        if admin_count <= 1:
            raise HTTPException(status_code=409, detail="Cannot delete the last admin user.")

    db.query(LostFoundItem).filter(LostFoundItem.submitted_by_user_id == user.id).update(
        {LostFoundItem.submitted_by_user_id: None},
        synchronize_session=False,
    )
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.query(AIInspectionLog).filter(AIInspectionLog.user_id == user.id).delete()
    db.query(ItemQuery).filter(ItemQuery.user_id == user.id).delete()
    db.query(QueryMessage).filter(QueryMessage.user_id == user.id).delete()
    db.query(Claim).filter(Claim.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    log_admin_action(current_user, "delete-user", note=f"deleted_user_id={user_id}")
    return {"message": "User deleted."}


@app.delete("/admin/claims/{claim_id}")
def admin_delete_claim(
    claim_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    claim = fetch_claim_or_404(db, claim_id)
    if claim.status == "approved":
        raise HTTPException(status_code=409, detail="Approved claims cannot be deleted.")

    db.delete(claim)
    db.commit()
    log_admin_action(current_user, "delete-claim", claim=claim, note=f"claim_status={claim.status}")
    return {"message": "Claim deleted."}


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


@app.post("/admin/items/{item_id}/review")
def admin_review_item(
    item_id: int,
    payload: AdminItemReviewPayload,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.status not in REVIEW_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid review status.")

    item = fetch_item_or_404(db, item_id)
    item.review_status = payload.status
    item.review_notes = payload.notes.strip()
    db.commit()
    db.refresh(item)
    log_admin_action(current_user, "review-item", item=item, note=f"review_status={item.review_status}")
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Item review updated.", "item": serialize_item(item, reporter)}


@app.get("/query")
def list_general_queries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=None)
    serialized_queries = serialize_query_list(db, queries)
    package = generate_query_package(
        user_message=serialized_queries[-1]["message"] if serialized_queries else "Show starter suggestions.",
        item=None,
        history=serialized_queries,
        catalog_items=list_catalog_items(db),
    )
    log_ai_package(
        db,
        current_user=current_user,
        route="/query/suggestions",
        input_text=serialized_queries[-1]["message"] if serialized_queries else "Show starter suggestions.",
        package=package,
        feature="query-suggestions",
    )
    return {
        "queries": serialized_queries,
        "response": {"message": ""},
        "suggestions": package.get("suggestions", []),
    }


@app.post("/query")
def create_general_query(
    payload: QueryPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    moderation = moderate_request(
        db,
        current_user=current_user,
        route="/query",
        input_text=payload.message,
    )
    if not moderation.get("allowed", False):
        return blocked_response(str(moderation.get("reason", "Query was blocked.")))

    message = moderate_field(payload.message, "Query message", min_meaningful_chars=6, max_chars=220)
    existing_queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=None)
    serialized_history = serialize_query_list(db, existing_queries)
    package = generate_query_package(
        user_message=message,
        item=None,
        history=serialized_history,
        catalog_items=list_catalog_items(db),
    )
    log_ai_package(
        db,
        current_user=current_user,
        route="/query",
        input_text=message,
        package=package,
        feature="general-query",
    )

    user_query = QueryMessage(item_id=None, user_id=current_user.id, role="user", message=message)
    system_query = QueryMessage(item_id=None, user_id=current_user.id, role="system", message=package["reply"])
    db.add(user_query)
    db.add(system_query)
    db.commit()
    db.refresh(user_query)
    db.refresh(system_query)

    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=None)
    return {
        "queries": serialize_query_list(db, queries),
        "response": {"message": package["reply"]},
        "suggestions": package.get("suggestions", []),
    }


@app.get("/items/{item_id}/queries")
def list_queries(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    reporter = get_item_reporter(db, item)
    item_context = item_to_query_context(item, reporter)
    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=item_id)
    serialized_queries = serialize_query_list(db, queries)
    package = generate_query_package(
        user_message=serialized_queries[-1]["message"] if serialized_queries else "Show starter suggestions.",
        item=item_context,
        history=serialized_queries,
        catalog_items=list_catalog_items(db),
    )
    log_ai_package(
        db,
        current_user=current_user,
        route=f"/items/{item_id}/queries/suggestions",
        input_text=serialized_queries[-1]["message"] if serialized_queries else "Show starter suggestions.",
        package=package,
        feature="query-suggestions",
    )
    return {
        "queries": serialized_queries,
        "response": {"message": ""},
        "suggestions": package.get("suggestions", []),
    }


@app.post("/items/{item_id}/query")
def create_query(
    item_id: int,
    payload: QueryPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    reporter = get_item_reporter(db, item)
    moderation = moderate_request(
        db,
        current_user=current_user,
        route=f"/items/{item_id}/query",
        input_text=payload.message,
    )
    if not moderation.get("allowed", False):
        return blocked_response(str(moderation.get("reason", "Query was blocked.")))

    message = moderate_field(payload.message, "Query message", min_meaningful_chars=6, max_chars=220)
    existing_queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=item_id)
    serialized_history = serialize_query_list(db, existing_queries)
    package = generate_query_package(
        user_message=message,
        item=item_to_query_context(item, reporter),
        history=serialized_history,
        catalog_items=list_catalog_items(db),
    )
    log_ai_package(
        db,
        current_user=current_user,
        route=f"/items/{item_id}/query",
        input_text=message,
        package=package,
        feature="item-query",
    )

    user_query = QueryMessage(item_id=item_id, user_id=current_user.id, role="user", message=message)
    system_query = QueryMessage(item_id=item_id, user_id=current_user.id, role="system", message=package["reply"])
    db.add(user_query)
    db.add(system_query)
    db.commit()
    db.refresh(user_query)
    db.refresh(system_query)

    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=item_id)
    return {
        "queries": serialize_query_list(db, queries),
        "response": {"message": package["reply"]},
        "suggestions": package.get("suggestions", []),
    }


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
