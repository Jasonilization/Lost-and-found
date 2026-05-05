from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import io
import json
import logging
import os
import re
import requests
import sys
import secrets
import stat
import threading
import time
from difflib import SequenceMatcher
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
try:
    from PIL import Image, UnidentifiedImageError
except ImportError:  # pragma: no cover - optional dependency for image normalization
    Image = None
    UnidentifiedImageError = OSError
try:
    from pillow_heif import register_heif_opener
except ImportError:  # pragma: no cover - optional dependency for HEIC/HEIF support
    register_heif_opener = None
from starlette.datastructures import UploadFile as StarletteUploadFile
from sqlalchemy import case, or_, text
from sqlalchemy.orm import Session
try:
    import psutil
except ImportError:  # pragma: no cover - optional dependency for system monitor metrics
    psutil = None
try:
    import resource
except ImportError:  # pragma: no cover - Unix-only runtime helper
    resource = None

from backend.ai_assistant import AI_MODEL, analyze_claim_match, analyze_evidence, analyze_report_abuse, model_size_label, normalize_language
from backend.ai_moderation import classify_user_input
from backend.database import AIInspectionLog, AuditLog, Claim, ItemQuery, LostFoundItem, Notification, QueryMessage, SessionLocal, User, UserSession, init_db
from backend.moderation import validate_class_of, validate_initials, validate_text_input
from backend.ollama_tagger import (
    build_search_text,
    debug_image_request,
    fallback_tags,
    generate_text_tag_result,
    get_llava_runtime_state,
    get_ollama_status,
    inspect_image_upload,
)

if register_heif_opener is not None:
    register_heif_opener()

app = FastAPI(title="School Lost and Found", debug=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads")).expanduser().resolve()
FRONTEND_DIR = BASE_DIR / "frontend"
LOG_DIR = Path(os.getenv("LOG_DIR", BASE_DIR / "data")).expanduser().resolve()

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

CLAIMS_LOG_PATH = LOG_DIR / "claims.log"
ADMIN_LOG_PATH = LOG_DIR / "admin_actions.log"
SECURITY_LOG_PATH = LOG_DIR / "security.log"
REPORT_LOG_PATH = LOG_DIR / "report_submission.log"
BOOTSTRAP_ADMIN_ENV_KEYS = (
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

claims_logger = logging.getLogger("claims")
if not claims_logger.handlers:
    handler = logging.FileHandler(CLAIMS_LOG_PATH)
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    claims_logger.addHandler(handler)
claims_logger.setLevel(logging.INFO)
claims_logger.propagate = False

report_logger = logging.getLogger("report_submission")
llava_trace_logger = logging.getLogger("ollama_tagger")
admin_logger = logging.getLogger("admin_actions")
block_logger = logging.getLogger("blocked_actions")
security_logger = logging.getLogger("security")
if not report_logger.handlers:
    report_handler = logging.FileHandler(REPORT_LOG_PATH)
    report_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    report_logger.addHandler(report_handler)
report_logger.setLevel(logging.INFO)
report_logger.propagate = False
if not llava_trace_logger.handlers:
    llava_handler = logging.FileHandler(REPORT_LOG_PATH)
    llava_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    llava_trace_logger.addHandler(llava_handler)
llava_trace_logger.setLevel(logging.INFO)
llava_trace_logger.propagate = False
if not admin_logger.handlers:
    admin_handler = logging.FileHandler(ADMIN_LOG_PATH)
    admin_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    admin_logger.addHandler(admin_handler)
admin_logger.setLevel(logging.INFO)
admin_logger.propagate = False
if not block_logger.handlers:
    block_handler = logging.FileHandler(ADMIN_LOG_PATH)
    block_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    block_logger.addHandler(block_handler)
block_logger.setLevel(logging.INFO)
block_logger.propagate = False
if not security_logger.handlers:
    security_handler = logging.FileHandler(SECURITY_LOG_PATH)
    security_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    security_logger.addHandler(security_handler)
security_logger.setLevel(logging.INFO)
security_logger.propagate = False

SCHOOL_LOCATIONS = [
    "New Sports Hall",
    "Sports Hall",
    "Long Court",
    "Library",
    "Morris Forum",
    "Senior Building",
    "Primary Building",
    "Innovation Building",
    "Swimming pool",
    "Robotics room",
    "Lost & Found Room",
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
ABUSE_OVERRIDE_STATUSES = ["", "allow", "flag"]
REPORT_SUBMISSION_COOLDOWN = timedelta(hours=1)
LOST_FOUND_ROOM_LABEL = "Lost & Found Room"
MAX_UPLOAD_SIZE = 5 * 1024 * 1024
MAX_REQUEST_SIZE = 5 * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024
RATE_LIMITS = {
    "chat": {"limit": 10, "window": timedelta(seconds=30)},
    "report": {"limit": 5, "window": timedelta(minutes=1)},
    "claim": {"limit": 3, "window": timedelta(minutes=1)},
}
GENERAL_UPLOAD_TYPES = {
    ".png": {"mime_types": {"image/png"}, "kind": "png"},
    ".jpg": {"mime_types": {"image/jpeg"}, "kind": "jpeg"},
    ".jpeg": {"mime_types": {"image/jpeg"}, "kind": "jpeg"},
    ".pdf": {"mime_types": {"application/pdf"}, "kind": "pdf"},
    ".txt": {"mime_types": {"text/plain"}, "kind": "txt"},
}
REPORT_IMAGE_UPLOAD_TYPES = {
    ".png": {"mime_types": {"image/png"}, "kind": "png"},
    ".jpg": {"mime_types": {"image/jpeg"}, "kind": "jpeg"},
    ".jpeg": {"mime_types": {"image/jpeg"}, "kind": "jpeg"},
    ".webp": {"mime_types": {"image/webp"}, "kind": "webp"},
    ".heic": {"mime_types": {"image/heic", "image/heif", "application/octet-stream"}, "kind": "heic"},
    ".heif": {"mime_types": {"image/heif", "image/heic", "application/octet-stream"}, "kind": "heif"},
}
ALLOWED_UPLOAD_TYPES = GENERAL_UPLOAD_TYPES
IMAGE_UPLOAD_EXTENSIONS = set(REPORT_IMAGE_UPLOAD_TYPES)
REQUEST_TIMESTAMPS: dict[str, list[datetime]] = {}
REQUEST_TIMESTAMPS_LOCK = threading.Lock()
APP_STARTED_AT = time.monotonic()
ACTIVE_REQUESTS = 0
ACTIVE_REQUESTS_LOCK = threading.Lock()
CPU_SAMPLE_LOCK = threading.Lock()
CPU_SAMPLE = {
    "wall": time.perf_counter(),
    "cpu": time.process_time(),
    "percent": 0.0,
}


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
    language: str = "en"


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


class LanguagePreferencePayload(BaseModel):
    language: str


class AdminItemReviewPayload(BaseModel):
    status: str
    notes: str = ""


class AdminAbuseOverridePayload(BaseModel):
    status: str
    notes: str = ""


class AdminClaimDecisionPayload(BaseModel):
    status: str


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    with SessionLocal() as db:
        ensure_admin_user(db)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def admin_count(db: Session) -> int:
    return db.query(User).filter(User.is_admin.is_(True)).count()


def bootstrap_admin_from_env(db: Session) -> Optional[User]:
    username = os.getenv("ADMIN_USERNAME", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "").strip()

    provided = {
        key: bool(os.getenv(key, "").strip())
        for key in BOOTSTRAP_ADMIN_ENV_KEYS
    }
    if not any(provided.values()):
        return None
    if not all(provided.values()):
        missing = [key for key, value in provided.items() if not value]
        security_log(
            "bootstrap_admin_skipped",
            level=logging.WARNING,
            reason="missing_env",
            missing=",".join(missing),
        )
        return None

    if len(username) < 3 or len(password) < 6:
        security_log(
            "bootstrap_admin_skipped",
            level=logging.WARNING,
            reason="invalid_credentials_shape",
        )
        return None

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        if existing_user.is_admin:
            return existing_user
        security_log(
            "bootstrap_admin_skipped",
            level=logging.WARNING,
            reason="username_conflict",
            username=username,
        )
        return None

    user = User(
        username=username,
        password_hash=hash_password(password),
        initials="admin.user",
        class_of=None,
        is_admin=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    security_log("bootstrap_admin_created", username=username)
    return user


def ensure_admin_user(db: Session) -> None:
    if admin_count(db) > 0:
        return
    created = bootstrap_admin_from_env(db)
    if created:
        return
    security_log(
        "admin_bootstrap_pending",
        level=logging.WARNING,
        mode="env_admin_bootstrap_required",
    )


def security_log(event: str, *, level: int = logging.INFO, **details: object) -> None:
    payload = " ".join(
        f"{key}={details[key]!r}"
        for key in sorted(details)
    )
    security_logger.log(level, "%s %s", event, payload)


def raise_rate_limit(scope: str, *, retry_after_seconds: int) -> None:
    message = (
        f"Too many {scope} requests right now. Please wait about {retry_after_seconds} second(s) and try again."
    )
    raise HTTPException(
        status_code=429,
        detail={"message": message, "retry_after": retry_after_seconds},
        headers={"Retry-After": str(retry_after_seconds)},
    )


def enforce_rate_limit(
    scope: str,
    *,
    request: Request,
    current_user: Optional[User],
) -> None:
    config = RATE_LIMITS[scope]
    now = datetime.utcnow()
    subject = f"user:{current_user.id}" if current_user else f"ip:{get_client_ip(request)}"
    key = f"{scope}:{subject}"
    with REQUEST_TIMESTAMPS_LOCK:
        timestamps = REQUEST_TIMESTAMPS.setdefault(key, [])
        cutoff = now - config["window"]
        timestamps[:] = [timestamp for timestamp in timestamps if timestamp >= cutoff]
        if len(timestamps) >= config["limit"]:
            retry_after_seconds = max(
                1,
                int((timestamps[0] + config["window"] - now).total_seconds()) + 1,
            )
            security_log(
                "rate_limit_blocked",
                level=logging.WARNING,
                scope=scope,
                subject=subject,
                route=request.url.path,
                limit=config["limit"],
                retry_after=retry_after_seconds,
            )
            raise_rate_limit(scope, retry_after_seconds=retry_after_seconds)
        timestamps.append(now)


def snapshot_item(item: LostFoundItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "report_type": item.report_type,
        "reporter_name": item.reporter_name,
        "title": item.title,
        "description": item.description,
        "location": item.location,
        "secondary_location": item.secondary_location,
        "category": item.category,
        "status": item.status,
        "claimed": bool(item.claimed),
        "review_status": item.review_status,
        "review_notes": item.review_notes,
        "abuse_flagged": bool(item.abuse_flagged),
        "abuse_risk_level": item.abuse_risk_level,
        "abuse_override_status": item.abuse_override_status,
        "abuse_override_notes": item.abuse_override_notes,
        "submitted_by_user_id": item.submitted_by_user_id,
        "deleted_at": item.deleted_at.isoformat() if item.deleted_at else None,
        "deleted_by_user_id": item.deleted_by_user_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def snapshot_claim(claim: Claim) -> dict[str, Any]:
    return {
        "id": claim.id,
        "item_id": claim.item_id,
        "user_id": claim.user_id,
        "claim_reason": claim.claim_reason,
        "item_description": claim.item_description,
        "lost_location": claim.lost_location,
        "identifying_info": claim.identifying_info,
        "match_score": int(claim.match_score or 0),
        "match_reasoning": claim.match_reasoning,
        "status": claim.status,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
        "updated_at": claim.updated_at.isoformat() if claim.updated_at else None,
    }


def snapshot_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "initials": user.initials,
        "class_of": user.class_of,
        "is_admin": bool(user.is_admin),
        "preferred_language": normalize_language(user.preferred_language),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def create_audit_log(
    db: Session,
    *,
    user_id: Optional[int],
    action_type: str,
    entity_type: str,
    entity_id: Optional[int],
    before_state: Any = None,
    after_state: Any = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AuditLog:
    audit = AuditLog(
        user_id=user_id,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    audit.before_state = before_state
    audit.after_state = after_state
    audit.audit_metadata = metadata or {}
    db.add(audit)
    return audit


def create_notification(
    db: Session,
    *,
    user_id: int,
    event_type: str,
    title: str,
    message: str,
    related_item_id: Optional[int] = None,
    related_claim_id: Optional[int] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        event_type=event_type,
        title=title,
        message=message,
        related_item_id=related_item_id,
        related_claim_id=related_claim_id,
    )
    db.add(notification)
    return notification


def admin_user_ids(db: Session, *, exclude_user_id: Optional[int] = None) -> list[int]:
    query = db.query(User.id).filter(User.is_admin.is_(True))
    if exclude_user_id:
        query = query.filter(User.id != exclude_user_id)
    return [row[0] for row in query.all()]


def serialize_audit_log(audit: AuditLog, user: Optional[User]) -> dict[str, Any]:
    return {
        "id": audit.id,
        "user_id": audit.user_id,
        "user_identity": user_identity(user),
        "action_type": audit.action_type,
        "entity_type": audit.entity_type,
        "entity_id": audit.entity_id,
        "before_state": audit.before_state,
        "after_state": audit.after_state,
        "metadata": audit.audit_metadata,
        "created_at": audit.created_at.isoformat() if audit.created_at else None,
    }


def serialize_notification(notification: Notification) -> dict[str, Any]:
    return {
        "id": notification.id,
        "event_type": notification.event_type,
        "title": notification.title,
        "message": notification.message,
        "related_item_id": notification.related_item_id,
        "related_claim_id": notification.related_claim_id,
        "read": bool(notification.read_at),
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


def mark_notification_read(notification: Notification) -> None:
    if not notification.read_at:
        notification.read_at = datetime.utcnow()


def sniff_file_type(sample: bytes) -> Optional[str]:
    if sample.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if sample.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(sample) >= 12 and sample[:4] == b"RIFF" and sample[8:12] == b"WEBP":
        return "image/webp"
    if len(sample) >= 12 and sample[4:8] == b"ftyp":
        brand = sample[8:12]
        if brand in {b"heic", b"heix", b"hevc", b"hevx"}:
            return "image/heic"
        if brand in {b"heim", b"heis", b"hevm", b"hevs", b"mif1", b"msf1"}:
            return "image/heif"
    if sample.startswith(b"%PDF-"):
        return "application/pdf"
    if b"\x00" in sample:
        return None
    try:
        sample.decode("utf-8")
        return "text/plain"
    except UnicodeDecodeError:
        return None


def validate_upload_metadata(
    filename: str,
    expected_extensions: Optional[set[str]] = None,
    *,
    allowed_types: Optional[dict[str, dict[str, object]]] = None,
) -> str:
    original_name = Path(filename or "").name
    extension = Path(original_name).suffix.lower()
    upload_types = allowed_types or ALLOWED_UPLOAD_TYPES
    allowed_extensions = expected_extensions or set(upload_types)
    if extension not in allowed_extensions or extension not in upload_types:
        allowed_labels = ", ".join(ext.lstrip(".").upper() for ext in sorted(allowed_extensions))
        security_log(
            "blocked_upload",
            level=logging.WARNING,
            reason="unsupported_extension",
            filename=original_name,
            extension=extension,
        )
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: {allowed_labels}.",
        )
    return extension


def safe_upload_path(extension: str) -> Path:
    destination = UPLOAD_DIR / f"{uuid4().hex}{extension}"
    return destination


def finalize_upload_permissions(destination: Path) -> None:
    destination.chmod(stat.S_IRUSR | stat.S_IWUSR)


def validate_detected_mime(
    extension: str,
    detected_mime_type: str,
    *,
    allowed_types: Optional[dict[str, dict[str, object]]] = None,
) -> None:
    upload_types = allowed_types or ALLOWED_UPLOAD_TYPES
    if detected_mime_type not in upload_types[extension]["mime_types"]:
        security_log(
            "blocked_upload",
            level=logging.WARNING,
            reason="mime_mismatch",
            extension=extension,
            detected_mime_type=detected_mime_type,
        )
        raise HTTPException(status_code=415, detail="Uploaded file content does not match the allowed file type.")


def replace_filename_extension(filename: str, extension: str) -> str:
    return f"{Path(filename or 'upload').stem}{extension}"


def sanitize_image_bytes(filename: str, file_bytes: bytes) -> tuple[str, bytes, str]:
    if Image is None:
        raise HTTPException(
            status_code=415,
            detail="This server cannot validate image uploads yet. Install Pillow image support first.",
        )
    try:
        with Image.open(io.BytesIO(file_bytes)) as image:
            image.load()
            has_alpha = "A" in image.getbands() or image.mode in {"LA", "PA", "RGBA"}
            output = io.BytesIO()
            if has_alpha:
                sanitized = image.convert("RGBA")
                sanitized.save(output, format="PNG", optimize=True)
                return replace_filename_extension(filename, ".png"), output.getvalue(), "image/png"

            sanitized = image.convert("RGB")
            sanitized.save(output, format="JPEG", quality=90, optimize=True)
            return replace_filename_extension(filename, ".jpg"), output.getvalue(), "image/jpeg"
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=415, detail="Uploaded image is corrupted or unreadable.") from exc


def normalize_report_image_bytes(
    filename: str,
    file_bytes: bytes,
    *,
    client_mime_type: Optional[str] = None,
) -> tuple[str, bytes, str]:
    sanitized_filename, sanitized_bytes, sanitized_mime_type = sanitize_image_bytes(filename, file_bytes)
    return sanitized_filename, sanitized_bytes, sanitized_mime_type


async def save_upload_file(
    upload: UploadFile | StarletteUploadFile,
    *,
    expected_extensions: Optional[set[str]] = None,
    allowed_types: Optional[dict[str, dict[str, object]]] = None,
) -> dict:
    upload_types = allowed_types or ALLOWED_UPLOAD_TYPES
    extension = validate_upload_metadata(upload.filename or "", expected_extensions, allowed_types=upload_types)
    destination = safe_upload_path(extension)
    total_size = 0
    first_chunk = b""
    client_mime_type = (upload.content_type or "").strip().lower()
    try:
        with destination.open("xb") as output_file:
            while True:
                chunk = await upload.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                if not first_chunk:
                    first_chunk = chunk[: min(len(chunk), 8192)]
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    security_log(
                        "blocked_upload",
                        level=logging.WARNING,
                        reason="file_too_large",
                        filename=Path(upload.filename or "").name,
                        size=total_size,
                    )
                    raise HTTPException(status_code=413, detail="Uploaded file exceeds the 5 MB limit.")
                output_file.write(chunk)
    except FileExistsError:
        destination = safe_upload_path(extension)
        return await save_upload_file(upload, expected_extensions=expected_extensions, allowed_types=upload_types)
    except HTTPException:
        if destination.exists():
            destination.unlink()
        raise
    except Exception:
        if destination.exists():
            destination.unlink()
        raise
    finally:
        await upload.close()

    detected_mime_type = sniff_file_type(first_chunk)
    if not detected_mime_type:
        if destination.exists():
            destination.unlink()
        security_log(
            "blocked_upload",
            level=logging.WARNING,
            reason="unverified_type",
            filename=Path(upload.filename or "").name,
        )
        raise HTTPException(status_code=415, detail="Could not verify the uploaded file type.")

    validate_detected_mime(extension, detected_mime_type, allowed_types=upload_types)
    if client_mime_type and client_mime_type not in upload_types[extension]["mime_types"]:
        if destination.exists():
            destination.unlink()
        security_log(
            "blocked_upload",
            level=logging.WARNING,
            reason="client_mime_mismatch",
            filename=Path(upload.filename or "").name,
            client_mime_type=client_mime_type,
            detected_mime_type=detected_mime_type,
        )
        raise HTTPException(status_code=415, detail="Client MIME type does not match the allowed file type.")

    finalize_upload_permissions(destination)
    return {
        "original_name": Path(upload.filename or "").name,
        "stored_name": destination.name,
        "path": f"/uploads/{destination.name}",
        "size": total_size,
        "mime_type": detected_mime_type,
        "extension": extension,
    }


def save_upload_bytes(
    filename: str,
    file_bytes: bytes,
    *,
    expected_extensions: Optional[set[str]] = None,
    client_mime_type: Optional[str] = None,
    allowed_types: Optional[dict[str, dict[str, object]]] = None,
) -> Optional[dict]:
    if not filename or not file_bytes:
        return None

    upload_types = allowed_types or ALLOWED_UPLOAD_TYPES
    working_filename = filename
    working_bytes = file_bytes
    working_client_mime_type = str(client_mime_type or "").strip().lower()
    extension = validate_upload_metadata(working_filename, expected_extensions, allowed_types=upload_types)
    if upload_types is REPORT_IMAGE_UPLOAD_TYPES:
        working_filename, working_bytes, working_client_mime_type = normalize_report_image_bytes(
            working_filename,
            working_bytes,
            client_mime_type=working_client_mime_type,
        )
        extension = validate_upload_metadata(working_filename, expected_extensions, allowed_types=upload_types)
    if len(working_bytes) > MAX_UPLOAD_SIZE:
        security_log(
            "blocked_upload",
            level=logging.WARNING,
            reason="file_too_large",
            filename=Path(filename).name,
            size=len(working_bytes),
        )
        raise HTTPException(status_code=413, detail="Uploaded file exceeds the 5 MB limit.")

    detected_mime_type = sniff_file_type(working_bytes[:8192])
    if not detected_mime_type:
        security_log(
            "blocked_upload",
            level=logging.WARNING,
            reason="unverified_type",
            filename=Path(filename).name,
        )
        raise HTTPException(status_code=415, detail="Could not verify the uploaded file type.")
    validate_detected_mime(extension, detected_mime_type, allowed_types=upload_types)
    if working_client_mime_type and working_client_mime_type not in upload_types[extension]["mime_types"]:
        security_log(
            "blocked_upload",
            level=logging.WARNING,
            reason="client_mime_mismatch",
            filename=Path(working_filename).name,
            client_mime_type=working_client_mime_type,
            detected_mime_type=detected_mime_type,
        )
        raise HTTPException(status_code=415, detail="Client MIME type does not match the allowed file type.")

    destination = safe_upload_path(extension)
    destination.write_bytes(working_bytes)
    finalize_upload_permissions(destination)
    return {
        "original_name": Path(working_filename).name,
        "stored_name": destination.name,
        "path": f"/uploads/{destination.name}",
        "size": len(working_bytes),
        "mime_type": detected_mime_type,
        "extension": extension,
    }


async def parse_query_submission(request: Request) -> tuple[QueryPayload, Optional[dict]]:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        message = str(form.get("message") or "")
        language = str(form.get("language") or "en")
        uploaded_file = form.get("file")
        attachment = None
        if hasattr(uploaded_file, "filename") and hasattr(uploaded_file, "read") and uploaded_file.filename:
            attachment = await save_upload_file(uploaded_file)
        return QueryPayload(message=message, language=language), attachment

    payload = QueryPayload(**(await request.json()))
    return payload, None


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


def decode_image_payload(image: Optional[ReportImagePayload]) -> Optional[str]:
    if not image or not image.data.strip():
        return None

    encoded = image.data.strip()
    if encoded.startswith("data:") and "," in encoded:
        encoded = encoded.split(",", 1)[1]

    report_logger.info(
        "[Upload] received image payload filename=%s content_type=%s base64_length=%s",
        Path(image.filename or "").name,
        str(image.content_type or "").strip().lower(),
        len(encoded),
    )

    try:
        file_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Image payload is not valid base64.") from exc

    report_logger.info(
        "[Upload] decoded image bytes filename=%s bytes=%s",
        Path(image.filename or "").name,
        len(file_bytes),
    )

    saved = save_upload_bytes(
        image.filename,
        file_bytes,
        expected_extensions=IMAGE_UPLOAD_EXTENSIONS,
        client_mime_type=image.content_type,
        allowed_types=REPORT_IMAGE_UPLOAD_TYPES,
    )
    if saved:
        report_logger.info(
            "[Upload] saved image filename=%s stored_name=%s bytes=%s mime_type=%s path=%s",
            saved.get("original_name", ""),
            saved.get("stored_name", ""),
            saved.get("size", 0),
            saved.get("mime_type", ""),
            saved.get("path", ""),
        )
    return saved["path"] if saved else None


def delete_uploaded_path(upload_path: Optional[str]) -> None:
    if not upload_path or not str(upload_path).startswith("/uploads/"):
        return

    absolute_path = BASE_DIR / str(upload_path).lstrip("/")
    try:
        if absolute_path.exists():
            absolute_path.unlink()
    except OSError:
        report_logger.warning("Could not delete upload path after rejection: %s", upload_path, exc_info=True)


def latest_uploaded_image_path() -> Optional[Path]:
    image_candidates = [
        path for path in UPLOAD_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_UPLOAD_EXTENSIONS
    ]
    if not image_candidates:
        return None
    return max(image_candidates, key=lambda path: path.stat().st_mtime)


def user_identity(user: Optional[User]) -> str:
    if not user:
        return ""
    if user.initials and user.class_of:
        return f"{user.initials} (Class of {user.class_of})"
    return user.username


def build_input_text(*parts: Optional[str]) -> str:
    return " ".join(str(part or "").strip() for part in parts if str(part or "").strip()).strip()


def normalize_search_text(value: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9\s]+", " ", str(value or "").lower()).strip()


def tokenize_search_text(value: Optional[str]) -> list[str]:
    return [token for token in normalize_search_text(value).split() if token]


def fuzzy_ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def score_token_against_field(token: str, field_value: str, *, exact: int, partial: int, fuzzy: int) -> int:
    normalized_field = normalize_search_text(field_value)
    if not token or not normalized_field:
        return 0
    field_tokens = tokenize_search_text(normalized_field)
    best_fuzzy = max((fuzzy_ratio(token, field_token) for field_token in field_tokens), default=0.0)
    if token == normalized_field or token in field_tokens:
        return exact
    if token in normalized_field:
        return partial
    if best_fuzzy >= 0.82:
        return fuzzy
    if best_fuzzy >= 0.72:
        return max(1, fuzzy - 4)
    return 0


def score_item_for_query(item: LostFoundItem, query_text: str) -> int:
    normalized_query = normalize_search_text(query_text)
    if not normalized_query:
        return 0

    tokens = tokenize_search_text(normalized_query)
    if not tokens:
        return 0

    title = item.title or ""
    description = item.description or ""
    category = item.category or ""
    location = item.location or ""
    tags = item.tags or []
    search_text = item.search_text or ""

    score = 0
    matched_tokens = 0

    if normalized_query in normalize_search_text(title):
        score += 40
    if normalized_query in normalize_search_text(location):
        score += 26
    if normalized_query in normalize_search_text(category):
        score += 18

    for token in tokens:
        token_score = 0
        token_score = max(token_score, score_token_against_field(token, title, exact=28, partial=20, fuzzy=16))
        token_score = max(token_score, score_token_against_field(token, " ".join(tags), exact=22, partial=16, fuzzy=13))
        token_score = max(token_score, score_token_against_field(token, category, exact=18, partial=12, fuzzy=9))
        token_score = max(token_score, score_token_against_field(token, location, exact=20, partial=15, fuzzy=11))
        token_score = max(token_score, score_token_against_field(token, description, exact=10, partial=8, fuzzy=6))
        token_score = max(token_score, score_token_against_field(token, search_text, exact=8, partial=6, fuzzy=4))
        if token_score > 0:
            matched_tokens += 1
            score += token_score

    coverage_bonus = matched_tokens * 6
    if matched_tokens == len(tokens):
        coverage_bonus += 12
    score += coverage_bonus
    return score


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

    remaining_seconds = max(1, int((next_allowed - datetime.utcnow()).total_seconds()) + 1)
    raise_rate_limit("report", retry_after_seconds=remaining_seconds)


def query_saved_message(language: str) -> str:
    normalized = normalize_language(language)
    if normalized == "zh-CN":
        return "消息已保存。"
    if normalized == "th":
        return "บันทึกข้อความแล้ว"
    return "Message saved."


def resolve_query_preferences(current_user: User, *, language: Optional[str]) -> str:
    normalized_language = normalize_language(language or current_user.preferred_language)
    if current_user.preferred_language != normalized_language:
        current_user.preferred_language = normalized_language
    return normalized_language


def cleanup_query_attachment(attachment: Optional[dict]) -> None:
    if not attachment:
        return
    delete_uploaded_path(attachment.get("path"))


def build_reporter_summary(db: Session, current_user: User, *, title: str) -> dict:
    now = datetime.utcnow()
    recent_items = (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.submitted_by_user_id == current_user.id,
            LostFoundItem.created_at >= now - timedelta(hours=24),
        )
        .count()
    )
    similar_titles = (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.submitted_by_user_id == current_user.id,
            LostFoundItem.created_at >= now - timedelta(days=7),
            LostFoundItem.title.ilike(title.strip()),
        )
        .count()
    )
    return {
        "recent_reports_24h": recent_items,
        "similar_title_reports_7d": similar_titles,
        "is_admin": bool(current_user.is_admin),
    }


def build_claim_summary(db: Session, *, item: LostFoundItem) -> dict:
    duplicate_claims = db.query(Claim).filter(Claim.item_id == item.id).count()
    recent_claims_for_user = (
        db.query(Claim)
        .filter(
            Claim.user_id == item.submitted_by_user_id,
            Claim.created_at >= datetime.utcnow() - timedelta(days=7),
        )
        .count()
        if item.submitted_by_user_id
        else 0
    )
    return {
        "duplicate_claims_for_item": duplicate_claims,
        "recent_claims_for_user_7d": recent_claims_for_user,
    }


def apply_abuse_analysis(db: Session, *, current_user: User, item: LostFoundItem) -> dict:
    before_state = snapshot_item(item)
    subject_user = (
        db.query(User).filter(User.id == item.submitted_by_user_id).first()
        if item.submitted_by_user_id
        else current_user
    )
    reporter_summary = build_reporter_summary(db, subject_user or current_user, title=item.title)
    claim_summary = build_claim_summary(db, item=item)
    package = analyze_report_abuse(
        report={
            "title": item.title,
            "description": item.description,
            "category": item.category,
            "location": item.location,
            "evidence_details": item.evidence_details,
            "evidence_summary": item.evidence_summary,
            "evidence_inconsistencies": item.evidence_inconsistencies,
            "evidence_missing_info": item.evidence_missing_info,
        },
        reporter_summary=reporter_summary,
        claim_summary=claim_summary,
    )
    item.abuse_genuine_score = int(package.get("genuine_score", 50) or 50)
    item.abuse_risk_level = str(package.get("risk_level", "medium")).strip().lower() or "medium"
    item.abuse_reasoning = str(package.get("reasoning", "")).strip()
    item.abuse_flagged = item.abuse_risk_level == "high"
    if item.abuse_override_status not in ABUSE_OVERRIDE_STATUSES:
        item.abuse_override_status = ""
    log_ai_package(
        db,
        current_user=current_user,
        route=f"/items/{item.id}/abuse-analysis",
        input_text=build_input_text(item.title, item.description, item.evidence_details, item.location),
        package=package,
        feature="abuse-detection",
    )
    if item.abuse_flagged and not before_state.get("abuse_flagged"):
        create_audit_log(
            db,
            user_id=current_user.id,
            action_type="abuse_flag_triggered",
            entity_type="report",
            entity_id=item.id,
            before_state=before_state,
            after_state=snapshot_item(item),
            metadata={"risk_level": item.abuse_risk_level, "genuine_score": item.abuse_genuine_score},
        )
    db.commit()
    db.refresh(item)
    return package


def serialize_item(item: LostFoundItem, reporter: Optional[User]) -> dict:
    override_status = (item.abuse_override_status or "").strip().lower()
    effective_risk = "high" if override_status == "flag" else "low" if override_status == "allow" else (item.abuse_risk_level or "medium")
    flagged = override_status == "flag" or (override_status != "allow" and bool(item.abuse_flagged))
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
        "abuse_genuine_score": int(item.abuse_genuine_score or 0),
        "abuse_risk_level": item.abuse_risk_level or "medium",
        "abuse_reasoning": item.abuse_reasoning or "",
        "abuse_flagged": bool(item.abuse_flagged),
        "abuse_override_status": override_status,
        "abuse_override_notes": item.abuse_override_notes or "",
        "effective_abuse_risk_level": effective_risk,
        "effective_abuse_flagged": flagged,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def calculate_user_trust_score(db: Session, user: User) -> dict[str, Any]:
    accepted_reports = db.query(LostFoundItem).filter(
        LostFoundItem.submitted_by_user_id == user.id,
        LostFoundItem.review_status == "approved",
    ).count()
    rejected_reports = db.query(LostFoundItem).filter(
        LostFoundItem.submitted_by_user_id == user.id,
        LostFoundItem.review_status == "rejected",
    ).count()
    abuse_flags = db.query(LostFoundItem).filter(
        LostFoundItem.submitted_by_user_id == user.id,
        LostFoundItem.abuse_flagged.is_(True),
    ).count()
    successful_claims = db.query(Claim).filter(
        Claim.user_id == user.id,
        Claim.status == "approved",
    ).count()
    score = 50 + (accepted_reports * 10) + (successful_claims * 12) - (rejected_reports * 15) - (abuse_flags * 20)
    return {
        "score": max(0, min(100, score)),
        "factors": {
            "accepted_reports": accepted_reports,
            "rejected_reports": rejected_reports,
            "abuse_flags": abuse_flags,
            "successful_claims": successful_claims,
        },
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
        "preferred_language": normalize_language(user.preferred_language),
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


def serialize_admin_user(db: Session, user: User) -> dict:
    trust = calculate_user_trust_score(db, user)
    return {
        "id": user.id,
        "username": user.username,
        "initials": user.initials,
        "class_of": user.class_of,
        "identity": user_identity(user),
        "is_admin": bool(user.is_admin),
        "avatar_url": user.avatar_path or "",
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "trust_score": int(trust["score"]),
        "trust_factors": trust["factors"],
    }


def serialize_admin_claim(db: Session, claim: Claim, item: LostFoundItem, claimant: Optional[User], reporter: Optional[User]) -> dict:
    claim_data = serialize_claim(claim, item, claimant, reporter)
    claim_data["match_score"] = int(claim.match_score or 0)
    claim_data["match_reasoning"] = claim.match_reasoning or ""
    claim_data["user"] = serialize_admin_user(db, claimant) if claimant else {
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
        "chat_mode": "message",
        "language": normalize_language(query.language),
        "attachment": {
            "name": query.attachment_name or "",
            "url": query.attachment_path or "",
            "size": int(query.attachment_size or 0),
            "content_type": query.attachment_mime_type or "",
        } if query.attachment_path else None,
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


def fetch_item_or_404(db: Session, item_id: int, *, include_deleted: bool = False) -> LostFoundItem:
    item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    if item.deleted_at and not include_deleted:
        raise HTTPException(status_code=404, detail="Item not found.")
    return item


def fetch_claim_or_404(db: Session, claim_id: int) -> Claim:
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return claim


def get_query_messages_for_scope(db: Session, *, user_id: int, item_id: Optional[int]) -> list[QueryMessage]:
    query = db.query(QueryMessage).filter(
        QueryMessage.user_id == user_id,
        QueryMessage.role != "system",
    )
    if item_id is None:
        query = query.filter(QueryMessage.item_id.is_(None))
    else:
        query = query.filter(QueryMessage.item_id == item_id)
    return query.order_by(QueryMessage.created_at.asc(), QueryMessage.id.asc()).all()


def serialize_query_list(db: Session, queries: list[QueryMessage]) -> list[dict]:
    authors = get_user_map(db, [query.user_id for query in queries])
    return [serialize_query(query, authors.get(query.user_id)) for query in queries]


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
    if decision.get("allowed", False):
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


def log_blocked_attempt(*, route: str, current_user: Optional[User], reason: str, content: str) -> None:
    block_logger.info(
        "route=%s user_id=%s username=%s reason=%s content=%s",
        route,
        current_user.id if current_user else "",
        current_user.username if current_user else "",
        reason,
        content,
    )


@app.middleware("http")
async def enforce_request_size_limit(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_SIZE:
                security_log(
                    "request_size_blocked",
                    level=logging.WARNING,
                    route=request.url.path,
                    client_ip=get_client_ip(request),
                    content_length=int(content_length),
                )
                return JSONResponse(status_code=413, content={"detail": "Request body exceeds the 5 MB limit."})
        except ValueError:
            pass

    received_bytes = 0
    original_receive = request.receive

    async def limited_receive():
        nonlocal received_bytes
        message = await original_receive()
        if message["type"] == "http.request":
            body = message.get("body", b"")
            received_bytes += len(body)
            if received_bytes > MAX_REQUEST_SIZE:
                security_log(
                    "streaming_request_size_blocked",
                    level=logging.WARNING,
                    route=request.url.path,
                    client_ip=get_client_ip(request),
                    received_bytes=received_bytes,
                )
                raise HTTPException(status_code=413, detail="Request body exceeds the 5 MB limit.")
        return message

    request._receive = limited_receive
    _increment_active_requests()
    try:
        return await call_next(request)
    finally:
        _decrement_active_requests()


@app.exception_handler(HTTPException)
async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    content: dict[str, Any]
    if isinstance(exc.detail, dict):
        content = {"detail": exc.detail.get("message") or exc.detail.get("detail") or "Request failed."}
        if "retry_after" in exc.detail:
            content["retry_after"] = exc.detail["retry_after"]
    else:
        content = {"detail": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception) -> JSONResponse:
    security_log(
        "unhandled_exception",
        level=logging.ERROR,
        route=request.url.path,
        client_ip=get_client_ip(request),
        error=str(exc),
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


def reject_blocked_request(*, route: str, current_user: Optional[User], reason: str, content: str) -> JSONResponse:
    log_blocked_attempt(route=route, current_user=current_user, reason=reason, content=content)
    return blocked_response(reason)


def enforce_moderation(
    db: Session,
    *,
    current_user: Optional[User],
    route: str,
    input_text: str,
    blocked_reason: str = "Message rejected due to content policy.",
) -> dict:
    decision = moderate_request(
        db,
        current_user=current_user,
        route=route,
        input_text=input_text,
    )
    if not decision.get("allowed", False):
        log_blocked_attempt(
            route=route,
            current_user=current_user,
            reason=str(decision.get("reason", blocked_reason)).strip() or blocked_reason,
            content=input_text,
        )
        raise HTTPException(status_code=400, detail=blocked_reason)
    return decision


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


def notify_claim_match(db: Session, *, item: LostFoundItem, claim: Claim, claimant: User) -> None:
    recipients = set(admin_user_ids(db))
    if item.submitted_by_user_id:
        recipients.add(item.submitted_by_user_id)
    recipients.add(claimant.id)
    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            event_type="item_matched_to_claim",
            title="Claim match update",
            message=f'"{item.title}" received a claim match with score {int(claim.match_score or 0)}/100.',
            related_item_id=item.id,
            related_claim_id=claim.id,
        )


def notify_claim_decision(db: Session, *, item: LostFoundItem, claim: Claim, status: str) -> None:
    recipients: set[int] = {claim.user_id}
    if item.submitted_by_user_id:
        recipients.add(item.submitted_by_user_id)
    action_label = "approved" if status == "approved" else "rejected"
    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            event_type=f"claim_{action_label}",
            title=f"Claim {action_label}",
            message=f'Your claim update for "{item.title}" was {action_label}.',
            related_item_id=item.id,
            related_claim_id=claim.id,
        )


def notify_report_room_move(db: Session, *, item: LostFoundItem) -> None:
    if not item.submitted_by_user_id:
        return
    create_notification(
        db,
        user_id=item.submitted_by_user_id,
        event_type="report_moved_to_room",
        title="Report location updated",
        message=f'"{item.title}" was moved to {LOST_FOUND_ROOM_LABEL}.',
        related_item_id=item.id,
    )


def notify_admin_override(db: Session, *, item: LostFoundItem, actor: User, status: str) -> None:
    recipients = set(admin_user_ids(db))
    if item.submitted_by_user_id:
        recipients.add(item.submitted_by_user_id)
    recipients.discard(actor.id)
    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            event_type="admin_override",
            title="Admin override applied",
            message=f'An admin override set "{item.title}" to {status or "cleared"}.',
            related_item_id=item.id,
        )

def _increment_active_requests() -> None:
    global ACTIVE_REQUESTS
    with ACTIVE_REQUESTS_LOCK:
        ACTIVE_REQUESTS += 1


def _decrement_active_requests() -> None:
    global ACTIVE_REQUESTS
    with ACTIVE_REQUESTS_LOCK:
        ACTIVE_REQUESTS = max(0, ACTIVE_REQUESTS - 1)


def _get_active_requests() -> int:
    with ACTIVE_REQUESTS_LOCK:
        return ACTIVE_REQUESTS


def _get_database_health() -> str:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return "ok"
    except Exception as exc:
        report_logger.warning("[Health] database check failed: %s", exc)
        return "down"


def _get_memory_usage_mb() -> float:
    if psutil is not None:
        try:
            process = psutil.Process()
            return round(float(process.memory_info().rss) / (1024 * 1024), 2)
        except Exception as exc:
            report_logger.warning("[Health] psutil memory usage failed: %s", exc)
    if resource is None:
        return 0.0
    usage_kb = float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    if sys.platform == "darwin":
        return round(usage_kb / (1024 * 1024), 2)
    return round(usage_kb / 1024, 2)


def _get_cpu_usage_percent() -> float:
    if psutil is not None:
        try:
            return round(float(psutil.cpu_percent(interval=None)), 2)
        except Exception as exc:
            report_logger.warning("[Health] psutil cpu usage failed: %s", exc)
    with CPU_SAMPLE_LOCK:
        now_wall = time.perf_counter()
        now_cpu = time.process_time()
        wall_delta = max(now_wall - float(CPU_SAMPLE["wall"]), 1e-6)
        cpu_delta = max(now_cpu - float(CPU_SAMPLE["cpu"]), 0.0)
        cpu_count = max(os.cpu_count() or 1, 1)
        percent = max(0.0, min(100.0, (cpu_delta / (wall_delta * cpu_count)) * 100))
        CPU_SAMPLE["wall"] = now_wall
        CPU_SAMPLE["cpu"] = now_cpu
        CPU_SAMPLE["percent"] = percent
        return round(percent, 2)


def _get_memory_percent() -> float:
    if psutil is not None:
        try:
            return round(float(psutil.virtual_memory().percent), 2)
        except Exception as exc:
            report_logger.warning("[Health] psutil memory percent failed: %s", exc)
    return -1


def _normalize_percent_metric(value: float) -> float:
    numeric_value = float(value)
    if numeric_value < 0:
        return -1
    return round(max(0.0, min(100.0, numeric_value)), 2)


def _get_gpu_usage_percent() -> float:
    return -1


def _get_gpu_temperature_c() -> float:
    return -1


def _get_ollama_latency_ms(ollama_status: dict) -> float:
    latency = ollama_status.get("latency_ms")
    try:
        numeric_value = round(float(latency), 2)
    except (TypeError, ValueError):
        return -1
    return numeric_value if numeric_value >= 0 else -1


def _get_last_ai_status() -> str:
    try:
        llava_runtime = get_llava_runtime_state()
    except Exception as exc:
        report_logger.warning("[Health] llava runtime state failed: %s", exc)
        return "unknown"
    status = str(llava_runtime.get("last_status") or "").strip().lower()
    return status or "unknown"


def _get_uptime_seconds() -> int:
    return int(time.monotonic() - APP_STARTED_AT)


@app.get("/health")
def health() -> dict:
    ollama_status = get_ollama_status()
    database_status = _get_database_health()
    return {
        "status": "ok",
        "backend": "ok",
        "database": database_status,
        "ollama": "ok" if ollama_status.get("available") else "down",
        "ai_model": "llava",
        "uptime_seconds": _get_uptime_seconds(),
    }


@app.get("/health/detailed")
def health_detailed(current_user: User = Depends(require_admin_user)) -> dict:
    del current_user
    ollama_status = get_ollama_status()
    gpu_temperature_c = _get_gpu_temperature_c()
    return {
        "cpu_usage_percent": _normalize_percent_metric(_get_cpu_usage_percent()),
        "memory_usage_percent": _normalize_percent_metric(_get_memory_percent()),
        "gpu_usage_percent": _normalize_percent_metric(_get_gpu_usage_percent()),
        "gpu_temperature_c": -1 if gpu_temperature_c < 0 else round(gpu_temperature_c, 2),
        "uptime_seconds": _get_uptime_seconds(),
        "ollama_latency_ms": _get_ollama_latency_ms(ollama_status),
        "last_ai_status": _get_last_ai_status(),
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


@app.post("/account/preferences/language")
def update_language_preference(
    payload: LanguagePreferencePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    current_user.preferred_language = normalize_language(payload.language)
    db.commit()
    db.refresh(current_user)
    return {"message": "Language preference updated.", "user": serialize_user(current_user)}


@app.get("/notifications")
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.read_at.is_(None).desc(), Notification.created_at.desc())
        .limit(40)
        .all()
    )
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    ).count()
    return {
        "notifications": [serialize_notification(notification) for notification in notifications],
        "unread_count": unread_count,
    }


@app.post("/notifications/{notification_id}/read")
def read_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    mark_notification_read(notification)
    db.commit()
    return {"message": "Notification marked as read.", "notification": serialize_notification(notification)}


@app.get("/debug/llava-test")
def debug_llava_test(
    filename: Optional[str] = None,
    prompt_mode: str = "inspect",
    current_user: User = Depends(require_admin_user),
) -> dict:
    del current_user
    requested_name = Path(filename or "").name
    image_path = (UPLOAD_DIR / requested_name) if requested_name else latest_uploaded_image_path()
    if not image_path or not image_path.exists():
        raise HTTPException(status_code=404, detail="No debug image found. Upload an image first or provide a filename.")

    normalized_mode = str(prompt_mode or "inspect").strip().lower()
    if normalized_mode not in {"inspect", "describe"}:
        raise HTTPException(status_code=400, detail="prompt_mode must be 'inspect' or 'describe'.")

    prompt = None if normalized_mode == "inspect" else "Describe this image. Mention only visible traits."
    report_logger.info(
        "[Debug] running llava test filename=%s prompt_mode=%s",
        image_path.name,
        normalized_mode,
    )

    try:
        result = debug_image_request(
            str(image_path),
            item_label=f"debug:{image_path.name}",
            prompt=prompt,
            parse_inspection=(normalized_mode == "inspect"),
        )
    except (RuntimeError, ValueError, requests.RequestException, json.JSONDecodeError) as exc:
        report_logger.warning("[Debug] llava test failed filename=%s prompt_mode=%s error=%s", image_path.name, normalized_mode, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "filename": image_path.name,
        "prompt_mode": normalized_mode,
        "result": result,
    }


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
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    del background_tasks
    enforce_rate_limit("report", request=request, current_user=current_user)
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
        return reject_blocked_request(
            route="/items/report",
            current_user=current_user,
            reason=str(moderation.get("reason", "Request is not relevant to the lost-and-found system.")),
            content=build_input_text(title, description, location, category),
        )

    image_path = decode_image_payload(payload.image)
    ai_result = None

    try:
        if image_path:
            image_file = BASE_DIR / image_path.lstrip("/")
            try:
                inspection = inspect_image_upload(str(image_file), item_label=title or reporter_name or "upload")
            except Exception as exc:
                report_logger.warning("[LLaVA] hard failure for item %s: %s", title or "upload", exc)
                ai_result = generate_text_tag_result(
                    title=title,
                    description=description,
                    location=location,
                    category=category,
                    color=color,
                )
            else:
                if inspection.get("moderation") != "SAFE":
                    delete_uploaded_path(image_path)
                    raise HTTPException(
                        status_code=400,
                        detail="Image rejected as unsafe for the school lost and found system.",
                    )

                ai_result = {
                    "summary": "[LLaVA] using raw output",
                    "category": category,
                    "color": color,
                    "tags": inspection.get("tags", []),
                    "tag_source": "llava-image",
                }
                report_logger.info("[LLaVA] using raw output")

        if not ai_result:
            try:
                ai_result = generate_text_tag_result(
                    title=title,
                    description=description,
                    location=location,
                    category=category,
                    color=color,
                )
            except Exception:
                report_logger.exception("Text tagging failed unexpectedly; using fallback tags.")
                ai_result = fallback_tags(title, description, category, color, location)
    except HTTPException:
        if image_path:
            delete_uploaded_path(image_path)
        raise

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
        tags=tags,
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
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_created",
        entity_type="report",
        entity_id=item.id,
        before_state=None,
        after_state=snapshot_item(item),
        metadata={"route": "/items/report"},
    )
    apply_abuse_analysis(db, current_user=current_user, item=item)
    return {
        "message": "Report submitted successfully",
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
    base_query = db.query(LostFoundItem).filter(LostFoundItem.deleted_at.is_(None))

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
                return reject_blocked_request(
                    route="/items",
                    current_user=current_user,
                    reason=str(moderation.get("reason", "Search was blocked.")),
                    content=lowered,
                )
            candidates = base_query.order_by(LostFoundItem.created_at.desc()).all()
            scored_items = [
                (item, score_item_for_query(item, lowered))
                for item in candidates
            ]
            items = [
                item
                for item, score in sorted(
                    scored_items,
                    key=lambda value: (value[1], value[0].created_at or datetime.min),
                    reverse=True,
                )
                if score > 0
            ]
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
    before_state = snapshot_item(item)
    item.status = status
    item.claimed = status == "Claimed"
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_edited",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"subaction": "status_updated", "status": status},
    )
    db.commit()
    db.refresh(item)
    log_admin_action(current_user, "update-item-status", item=item, note=f"item_status={item.status}")
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Status updated.", "item": serialize_item(item, reporter)}


@app.post("/items/{item_id}/claim")
def claim_item(
    item_id: int,
    payload: ClaimPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit("claim", request=request, current_user=current_user)
    route = f"/items/{item_id}/claim"
    claim_input_text = build_input_text(
        payload.claim_reason,
        payload.item_description,
        payload.lost_location,
        payload.identifying_info,
    )
    item = fetch_item_or_404(db, item_id)
    if item.claimed:
        raise HTTPException(status_code=400, detail="This item is already marked as claimed.")

    existing_claim = db.query(Claim).filter(Claim.item_id == item_id, Claim.user_id == current_user.id).first()
    if existing_claim:
        raise HTTPException(status_code=409, detail="You already submitted a claim for this item.")

    enforce_moderation(
        db,
        current_user=current_user,
        route=route,
        input_text=claim_input_text,
        blocked_reason="Message rejected due to content policy.",
    )

    claim_reason = moderate_field(payload.claim_reason, "Claim reason", min_meaningful_chars=6, max_chars=240)
    item_description = moderate_field(payload.item_description, "Item description", min_meaningful_chars=6, max_chars=240)
    lost_location = moderate_field(payload.lost_location, "Lost location", min_meaningful_chars=4, max_chars=120)
    identifying_info = moderate_field(payload.identifying_info, "Identifying info", min_meaningful_chars=4, max_chars=240)

    if len(re.findall(r"[a-z0-9']+", identifying_info.lower())) < 2:
        raise HTTPException(status_code=400, detail="Add identifying details like color, brand, markings, or unique features.")

    claim_match = analyze_claim_match(
        claim_reason=claim_reason,
        claim_description=item_description,
        lost_location=lost_location,
        identifying_info=identifying_info,
        item=serialize_item(item, get_item_reporter(db, item)),
    )
    if int(claim_match.get("match_score", 0) or 0) < 25:
        return reject_blocked_request(
            route=route,
            current_user=current_user,
            reason="Claim rejected because the provided details do not match the reported item closely enough.",
            content=claim_input_text,
        )
    log_ai_package(
        db,
        current_user=current_user,
        route=f"/items/{item_id}/claim-match",
        input_text=build_input_text(claim_reason, item_description, lost_location, identifying_info),
        package=claim_match,
        feature="claim-match",
    )

    claim = Claim(
        item_id=item.id,
        user_id=current_user.id,
        claim_reason=claim_reason,
        item_description=item_description,
        lost_location=lost_location,
        identifying_info=identifying_info,
        match_score=int(claim_match.get("match_score", 0) or 0),
        match_reasoning=str(claim_match.get("reasoning", "")).strip(),
        status="pending",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="claim_submitted",
        entity_type="claim",
        entity_id=claim.id,
        before_state=None,
        after_state=snapshot_claim(claim),
        metadata={"item_id": item.id, "match_score": int(claim.match_score or 0)},
    )
    notify_claim_match(db, item=item, claim=claim, claimant=current_user)

    apply_abuse_analysis(db, current_user=current_user, item=item)

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
    return {"users": [serialize_admin_user(db, user) for user in users]}


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
    return {"message": "User promoted to admin.", "user": serialize_admin_user(db, user)}


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
    return {"message": "Admin rights removed.", "user": serialize_admin_user(db, user)}


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
                db,
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
    items = (
        db.query(LostFoundItem)
        .filter(LostFoundItem.deleted_at.is_(None))
        .order_by(LostFoundItem.created_at.desc())
        .all()
    )
    reporters = get_user_map(db, [item.submitted_by_user_id or 0 for item in items])
    return {
        "items": [
            serialize_item(item, reporters.get(item.submitted_by_user_id or 0))
            for item in items
        ]
    }


@app.get("/admin/audit-logs")
def admin_audit_logs(
    _: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    audits = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(200).all()
    users = get_user_map(db, [audit.user_id or 0 for audit in audits])
    return {
        "audits": [
            serialize_audit_log(audit, users.get(audit.user_id or 0))
            for audit in audits
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
    before_state = snapshot_item(item)
    if item.deleted_at:
        raise HTTPException(status_code=409, detail="This report is already deleted.")
    item.deleted_at = datetime.utcnow()
    item.deleted_by_user_id = current_user.id
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_deleted",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"soft_delete": True},
    )
    db.commit()
    log_admin_action(current_user, "delete-item", item=item, note=f"title={item.title}")
    return {"message": "Report deleted. You can undo this action shortly.", "item_id": item.id}


@app.post("/admin/items/{item_id}/restore")
def admin_restore_item(
    item_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id, include_deleted=True)
    if not item.deleted_at:
        raise HTTPException(status_code=409, detail="This report is not deleted.")
    before_state = snapshot_item(item)
    item.deleted_at = None
    item.deleted_by_user_id = None
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_restored",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"soft_delete": True},
    )
    db.commit()
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Report restored.", "item": serialize_item(item, reporter)}


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

    before_state = snapshot_claim(claim)
    db.delete(claim)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="claim_deleted",
        entity_type="claim",
        entity_id=claim.id,
        before_state=before_state,
        after_state=None,
        metadata={"status": before_state.get("status", "")},
    )
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
    before_claim_state = snapshot_claim(claim)
    before_item_state = snapshot_item(item)

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
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="claim_approved",
        entity_type="claim",
        entity_id=claim.id,
        before_state={"claim": before_claim_state, "item": before_item_state},
        after_state={"claim": snapshot_claim(claim), "item": snapshot_item(item)},
        metadata={"item_id": item.id},
    )
    notify_claim_decision(db, item=item, claim=claim, status="approved")
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
        "claim": serialize_admin_claim(db, claim, item, claimant, reporter),
    }


@app.post("/admin/claims/{claim_id}/reject")
def admin_reject_claim(
    claim_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    claim = fetch_claim_or_404(db, claim_id)
    item = fetch_item_or_404(db, claim.item_id)
    before_claim_state = snapshot_claim(claim)

    if claim.status == "rejected":
        raise HTTPException(status_code=409, detail="This claim is already rejected.")
    if claim.status == "approved":
        raise HTTPException(status_code=409, detail="Approved claims cannot be rejected.")

    claim.status = "rejected"
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="claim_rejected",
        entity_type="claim",
        entity_id=claim.id,
        before_state=before_claim_state,
        after_state=snapshot_claim(claim),
        metadata={"item_id": item.id},
    )
    notify_claim_decision(db, item=item, claim=claim, status="rejected")
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
        "claim": serialize_admin_claim(db, claim, item, claimant, reporter),
    }


@app.post("/admin/claims/{claim_id}/undo-decision")
def admin_undo_claim_decision(
    claim_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    claim = fetch_claim_or_404(db, claim_id)
    item = fetch_item_or_404(db, claim.item_id)
    if claim.status not in {"approved", "rejected"}:
        raise HTTPException(status_code=409, detail="Only approved or rejected claims can be undone.")

    before_claim_state = snapshot_claim(claim)
    before_item_state = snapshot_item(item)
    claim.status = "pending"
    if item.claimed and item.status == "Claimed":
        other_approved_claim = (
            db.query(Claim)
            .filter(Claim.item_id == item.id, Claim.status == "approved", Claim.id != claim.id)
            .first()
        )
        if not other_approved_claim:
            item.claimed = False
            item.status = "Open"
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="claim_decision_undone",
        entity_type="claim",
        entity_id=claim.id,
        before_state={"claim": before_claim_state, "item": before_item_state},
        after_state={"claim": snapshot_claim(claim), "item": snapshot_item(item)},
        metadata={"item_id": item.id},
    )
    db.commit()
    db.refresh(claim)
    db.refresh(item)
    claimant = db.query(User).filter(User.id == claim.user_id).first()
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {
        "message": "Claim decision undone.",
        "claim": serialize_admin_claim(db, claim, item, claimant, reporter),
    }


@app.post("/items/{item_id}/mark-claimed")
def mark_item_claimed(
    item_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    before_state = snapshot_item(item)
    item.claimed = True
    item.status = "Claimed"
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_edited",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"subaction": "mark_claimed"},
    )
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
    before_state = snapshot_item(item)
    item.review_status = payload.status
    item.review_notes = payload.notes.strip()
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_edited",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"subaction": "review_updated", "review_status": item.review_status},
    )
    db.commit()
    db.refresh(item)
    log_admin_action(current_user, "review-item", item=item, note=f"review_status={item.review_status}")
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Item review updated.", "item": serialize_item(item, reporter)}


@app.post("/admin/items/{item_id}/abuse-override")
def admin_override_abuse(
    item_id: int,
    payload: AdminAbuseOverridePayload,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    normalized_status = str(payload.status or "").strip().lower()
    if normalized_status not in ABUSE_OVERRIDE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid abuse override status.")

    item = fetch_item_or_404(db, item_id)
    before_state = snapshot_item(item)
    item.abuse_override_status = normalized_status
    item.abuse_override_notes = payload.notes.strip()
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="admin_override",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"override_status": normalized_status},
    )
    notify_admin_override(db, item=item, actor=current_user, status=normalized_status)
    db.commit()
    db.refresh(item)
    log_admin_action(current_user, "override-abuse", item=item, note=f"abuse_override_status={normalized_status}")
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Abuse override updated.", "item": serialize_item(item, reporter)}


@app.post("/admin/items/{item_id}/move-to-room")
def admin_move_item_to_room(
    item_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    before_state = snapshot_item(item)
    if item.location == LOST_FOUND_ROOM_LABEL:
        raise HTTPException(status_code=409, detail="This report is already in the lost and found room.")
    if item.location and item.location != LOST_FOUND_ROOM_LABEL:
        item.secondary_location = item.location
    item.location = LOST_FOUND_ROOM_LABEL
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_edited",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"subaction": "moved_to_room"},
    )
    notify_report_room_move(db, item=item)
    db.commit()
    db.refresh(item)
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Report moved to the lost and found room.", "item": serialize_item(item, reporter)}


@app.get("/query")
def list_general_queries(
    language: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    normalized_language = resolve_query_preferences(current_user, language=language)
    db.commit()
    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=None)
    return {
        "queries": serialize_query_list(db, queries),
        "response": {"message": ""},
        "suggestions": [],
        "language": normalized_language,
    }


@app.post("/query")
async def create_general_query(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit("chat", request=request, current_user=current_user)
    payload, attachment = await parse_query_submission(request)
    route = "/query"
    try:
        normalized_language = resolve_query_preferences(current_user, language=payload.language)
        enforce_moderation(
            db,
            current_user=current_user,
            route=route,
            input_text=payload.message,
            blocked_reason="Message rejected due to content policy.",
        )
        message = moderate_field(payload.message, "Query message", min_meaningful_chars=6, max_chars=220)
        user_query = QueryMessage(
            item_id=None,
            user_id=current_user.id,
            role="user",
            message=message,
            chat_mode="message",
            language=normalized_language,
            attachment_name=attachment["original_name"] if attachment else "",
            attachment_path=attachment["path"] if attachment else "",
            attachment_size=attachment["size"] if attachment else None,
            attachment_mime_type=attachment["mime_type"] if attachment else "",
        )
        db.add(user_query)
        db.commit()
        db.refresh(user_query)
    except Exception:
        cleanup_query_attachment(attachment)
        raise

    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=None)
    return {
        "queries": serialize_query_list(db, queries),
        "response": {"message": query_saved_message(normalized_language)},
        "suggestions": [],
        "language": normalized_language,
    }


@app.get("/items/{item_id}/queries")
def list_queries(
    item_id: int,
    language: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    normalized_language = resolve_query_preferences(current_user, language=language)
    db.commit()
    fetch_item_or_404(db, item_id)
    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=item_id)
    return {
        "queries": serialize_query_list(db, queries),
        "response": {"message": ""},
        "suggestions": [],
        "language": normalized_language,
    }


@app.post("/items/{item_id}/query")
async def create_query(
    item_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit("chat", request=request, current_user=current_user)
    payload, attachment = await parse_query_submission(request)
    route = f"/items/{item_id}/query"
    try:
        normalized_language = resolve_query_preferences(current_user, language=payload.language)
        enforce_moderation(
            db,
            current_user=current_user,
            route=route,
            input_text=payload.message,
            blocked_reason="Message rejected due to content policy.",
        )
        item = fetch_item_or_404(db, item_id)
        message = moderate_field(payload.message, "Query message", min_meaningful_chars=6, max_chars=220)
        user_query = QueryMessage(
            item_id=item_id,
            user_id=current_user.id,
            role="user",
            message=message,
            chat_mode="message",
            language=normalized_language,
            attachment_name=attachment["original_name"] if attachment else "",
            attachment_path=attachment["path"] if attachment else "",
            attachment_size=attachment["size"] if attachment else None,
            attachment_mime_type=attachment["mime_type"] if attachment else "",
        )
        db.add(user_query)
        db.commit()
        db.refresh(user_query)
    except Exception:
        cleanup_query_attachment(attachment)
        raise

    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=item_id)
    return {
        "queries": serialize_query_list(db, queries),
        "response": {"message": build_query_response(item)},
        "suggestions": [],
        "language": normalized_language,
    }


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
