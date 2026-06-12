from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import io
import json
import logging
import math
import os
import re
import requests
import shutil
import signal
import smtplib
import subprocess
import sys
import secrets
import stat
import threading
import time
from collections import Counter
from difflib import SequenceMatcher
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
try:
    from PIL import Image, ImageDraw, UnidentifiedImageError
except ImportError:  # pragma: no cover - optional dependency for image normalization
    Image = None
    ImageDraw = None
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

from backend.ai_assistant import AI_MODEL, analyze_claim_match, analyze_evidence, analyze_report_abuse, generate_site_helper_package, model_size_label, normalize_language
from backend.ai_moderation import classify_user_input
from backend.database import AIInspectionLog, AuditLog, Claim, ClaimDraft, EmailVerificationCode, ItemQuery, LostFoundItem, MapRegion, Notification, QueryMessage, QuestionPost, QuestionReply, ReturnedItemDispute, SessionLocal, SystemMigration, UploadObject, User, UserSession, init_db
from backend.moderation import BLOCKED_WORDS, clean_text, validate_class_of, validate_initials, validate_text_input
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


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name, "").strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "on"}


def env_csv(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default
    values = [value.strip() for value in raw_value.split(",") if value.strip()]
    return values or default


def env_int(name: str, default: int, *, minimum: int = 0) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except ValueError:
        return max(minimum, default)


USER_ROLE_STUDENT = "student"
USER_ROLE_TEACHER = "teacher"
USER_ROLES = {USER_ROLE_STUDENT, USER_ROLE_TEACHER}


app = FastAPI(title="School Lost and Found", debug=False)

CORS_ALLOWED_ORIGINS = env_csv("CORS_ALLOWED_ORIGINS", ["*"])
CORS_ALLOWED_METHODS = env_csv("CORS_ALLOWED_METHODS", ["GET", "POST", "PATCH", "DELETE", "OPTIONS"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=env_flag("CORS_ALLOW_CREDENTIALS", False),
    allow_methods=CORS_ALLOWED_METHODS,
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_STORAGE_BACKEND = os.getenv(
    "UPLOAD_STORAGE_BACKEND",
    "database" if os.getenv("DATABASE_URL") else "filesystem",
).strip().lower()
if UPLOAD_STORAGE_BACKEND not in {"database", "filesystem"}:
    UPLOAD_STORAGE_BACKEND = "database" if os.getenv("DATABASE_URL") else "filesystem"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads")).expanduser().resolve()
LOGIN_BACKGROUND_PATH = (UPLOAD_DIR / "background.png").resolve()
MAP_IMAGE_URL = "/uploads/map.png"
MAP_IMAGE_SOURCE_WIDTH = 4484
MAP_IMAGE_SOURCE_HEIGHT = 3036
LOADING_VIDEO_URL = "/uploads/loading.mp4"
LOADING_VIDEO_PATH = (UPLOAD_DIR / "loading.mp4").resolve()
MAP_IMAGE_PATH = (UPLOAD_DIR / "map.png").resolve()
UPLOAD_CACHE_DIR = Path(os.getenv("UPLOAD_CACHE_DIR", "/tmp/lostfound-uploads")).expanduser().resolve()
FRONTEND_DIR = BASE_DIR / "frontend"
LOG_DIR = Path(os.getenv("LOG_DIR", BASE_DIR / "data")).expanduser().resolve()
LOG_TO_STDOUT = env_flag("LOG_TO_STDOUT", False)
FRONTEND_API_BASE_URL = os.getenv("PUBLIC_API_BASE_URL", os.getenv("API_BASE_URL", "")).strip()
FRONTEND_API_DEBUG = env_flag("API_DEBUG_LOGGING", True)
REQUEST_DEBUG_LOGGING = env_flag("REQUEST_DEBUG_LOGGING", True)
REQUEST_DEBUG_PAYLOAD_MAX_CHARS = env_int("REQUEST_DEBUG_PAYLOAD_MAX_CHARS", 4000, minimum=0)
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "").strip().rstrip("/")
SESSION_SECRET = os.getenv("SESSION_SECRET", "local-session-secret-change-me").strip()
EMAIL_VERIFICATION_SECRET = os.getenv("EMAIL_VERIFICATION_SECRET", SESSION_SECRET).strip() or "local-email-secret-change-me"
EMAIL_VERIFICATION_CODE_TTL_SECONDS = env_int("EMAIL_VERIFICATION_CODE_TTL_SECONDS", 600, minimum=60)
EMAIL_VERIFICATION_TOKEN_TTL_SECONDS = env_int("EMAIL_VERIFICATION_TOKEN_TTL_SECONDS", 900, minimum=60)
EMAIL_VERIFICATION_RESEND_SECONDS = env_int("EMAIL_VERIFICATION_RESEND_SECONDS", 60, minimum=15)
EMAIL_VERIFICATION_MAX_ATTEMPTS = env_int("EMAIL_VERIFICATION_MAX_ATTEMPTS", 5, minimum=1)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = env_int("SMTP_PORT", 587, minimum=1)
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "jasonilization@gmail.com").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "dkpvjysslqxpnpjl").strip()
SMTP_USE_TLS = env_flag("SMTP_USE_TLS", True)
SMTP_USE_SSL = env_flag("SMTP_USE_SSL", False)
SMTP_FROM_ADDRESS = (
    os.getenv("SMTP_FROM_ADDRESS", "jasonilization@gmail.com").strip()
    or os.getenv("SMTP_FROM_EMAIL", "").strip()
    or SMTP_USERNAME
    or "lostfound@localhost"
)
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "SHR-LOST-AND-FOUND").strip()
SCHOOL_EMAIL_DOMAINS = [value.lower() for value in env_csv("SCHOOL_EMAIL_DOMAINS", [])]
SMTP_LAST_RESULT: dict[str, Any] = {
    "connected": False,
    "last_error": "",
    "last_success_at": None,
    "last_failure_at": None,
}
SMTP_LAST_RESULT_LOCK = threading.Lock()

if UPLOAD_STORAGE_BACKEND == "database":
    UPLOAD_CACHE_DIR.mkdir(parents=True, exist_ok=True)
else:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
if not LOG_TO_STDOUT:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

CLAIMS_LOG_PATH = LOG_DIR / "claims.log"
ADMIN_LOG_PATH = LOG_DIR / "admin_actions.log"
SECURITY_LOG_PATH = LOG_DIR / "security.log"
REPORT_LOG_PATH = LOG_DIR / "report_submission.log"
BOOTSTRAP_ADMIN_ENV_KEYS = (
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
)

@app.on_event("startup")
def check_optional_ollama_on_startup() -> None:
    try:
        status = get_ollama_status()
    except Exception as exc:  # pragma: no cover - startup safety guard
        logging.getLogger("ollama_tagger").warning("Ollama startup check failed: %s", exc)
        return
    logging.getLogger("ollama_tagger").info(
        "Ollama startup status: available=%s host=%s models=%s",
        status.get("available"),
        status.get("host"),
        status.get("models", []),
    )

def build_log_handler(path: Path) -> logging.Handler:
    handler: logging.Handler
    if LOG_TO_STDOUT:
        handler = logging.StreamHandler(sys.stdout)
    else:
        handler = logging.FileHandler(path)
    return handler


claims_logger = logging.getLogger("claims")
if not claims_logger.handlers:
    handler = build_log_handler(CLAIMS_LOG_PATH)
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    claims_logger.addHandler(handler)
claims_logger.setLevel(logging.INFO)
claims_logger.propagate = False

report_logger = logging.getLogger("report_submission")
llava_trace_logger = logging.getLogger("ollama_tagger")
admin_logger = logging.getLogger("admin_actions")
block_logger = logging.getLogger("blocked_actions")
security_logger = logging.getLogger("security")
request_debug_logger = logging.getLogger("request_debug")
if not report_logger.handlers:
    report_handler = build_log_handler(REPORT_LOG_PATH)
    report_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    report_logger.addHandler(report_handler)
report_logger.setLevel(logging.INFO)
report_logger.propagate = False
if not llava_trace_logger.handlers:
    llava_handler = build_log_handler(REPORT_LOG_PATH)
    llava_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    llava_trace_logger.addHandler(llava_handler)
llava_trace_logger.setLevel(logging.INFO)
llava_trace_logger.propagate = False
if not admin_logger.handlers:
    admin_handler = build_log_handler(ADMIN_LOG_PATH)
    admin_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    admin_logger.addHandler(admin_handler)
admin_logger.setLevel(logging.INFO)
admin_logger.propagate = False
if not block_logger.handlers:
    block_handler = build_log_handler(ADMIN_LOG_PATH)
    block_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    block_logger.addHandler(block_handler)
block_logger.setLevel(logging.INFO)
block_logger.propagate = False
if not security_logger.handlers:
    security_handler = build_log_handler(SECURITY_LOG_PATH)
    security_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    security_logger.addHandler(security_handler)
security_logger.setLevel(logging.INFO)
security_logger.propagate = False
if not request_debug_logger.handlers:
    request_debug_handler = build_log_handler(REPORT_LOG_PATH)
    request_debug_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    request_debug_logger.addHandler(request_debug_handler)
request_debug_logger.setLevel(logging.INFO)
request_debug_logger.propagate = False

SCHOOL_SUB_LOCATION_LABELS: list[str] = []
SPORTS_BUILDING_SUB_LOCATION_LABELS = [
    "New Sports Hall",
    "Sports Hall",
]
SPORTS_COMPLEX_SUB_LOCATION_LABELS = [
    "Changing Rooms",
    "Strength & Conditioning Room",
]
ACADEMIC_FLOOR_COUNTS_BY_LOCATION_ID = {
    "innovation-building": 5,
    "senior-school": 4,
    "prep-school": 4,
    "pre-prep-school": 4,
}
INVALID_LOCATION_CODE_MESSAGE = "Invalid location code for selected zone"
SCHOOL_LOCATION_CODE_RULES = [
    {"prefix": "A", "location_id": "innovation-building", "name": "Innovation Building", "min_floor": 1, "max_floor": 5},
    {"prefix": "S", "location_id": "senior-school", "name": "Senior School", "min_floor": 1, "max_floor": 4},
    {"prefix": "P", "location_id": "pre-prep-school", "name": "Pre-Prep School", "min_floor": 1, "max_floor": 2},
    {"prefix": "P", "location_id": "prep-school", "name": "Prep School", "min_floor": 3, "max_floor": 4},
]
SCHOOL_LOCATION_ALIASES = {
    "Innovation Building": ["Innovation"],
    "Senior School": ["Senior Building", "Senior"],
    "Prep School": ["Prep", "Junior School", "Junior Area", "Junior"],
    "Pre-Prep School": ["Pre Prep School", "Pre-Prep", "Pre Prep"],
    "Sports Building": ["PE Building"],
    "Sports Fields & Running Track": ["Sports Fields", "Running Track", "Sports Field", "Track", "Long Court"],
    "Strength & Conditioning Room": ["Strength and Conditioning Room", "Strength and Conditioning", "S&C Room", "Weights Room"],
    "New Sports Hall": ["New Hall"],
    "Sports Hall": ["Old Sports Hall"],
    "Changing Rooms": ["PE Changing Rooms", "PE Changing Room"],
}


def school_sub_locations(labels: list[str] | None = None) -> list[dict[str, str]]:
    source_labels = SCHOOL_SUB_LOCATION_LABELS if labels is None else labels
    return [
        {"id": re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-"), "label": label}
        for label in source_labels
    ]


def academic_floor_definitions(location_id: str) -> list[dict[str, Any]]:
    floors = []
    for floor_number in range(1, ACADEMIC_FLOOR_COUNTS_BY_LOCATION_ID.get(location_id, 0) + 1):
        label = f"Floor {floor_number}"
        floors.append({
            "id": f"floor-{floor_number}",
            "label": label,
            "sub_locations": [],
        })
    return floors


def map_text_region_from_pixels(x: int, y: int, width: int, height: int) -> dict[str, float]:
    return {
        "x": x / MAP_IMAGE_SOURCE_WIDTH,
        "y": y / MAP_IMAGE_SOURCE_HEIGHT,
        "width": width / MAP_IMAGE_SOURCE_WIDTH,
        "height": height / MAP_IMAGE_SOURCE_HEIGHT,
    }


SCHOOL_LOCATION_DATA = [
    {
        "id": "innovation-building",
        "name": "Innovation Building",
        "x": 25,
        "y": 42,
        "metadata": {"area_type": "Academic building", "navigation": "floors"},
        "sub_locations": [],
        "floors": academic_floor_definitions("innovation-building"),
        "interaction_regions": [
            {
                "id": "innovation-building-region",
                "label": "Innovation Building",
                "x": 0.069,
                "y": 0.257,
                "width": 0.219,
                "height": 0.043,
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
    {
        "id": "senior-school",
        "name": "Senior School",
        "x": 49,
        "y": 32,
        "metadata": {"area_type": "Academic building", "navigation": "floors"},
        "sub_locations": [],
        "floors": academic_floor_definitions("senior-school"),
        "interaction_regions": [
            {
                "id": "senior-school-region",
                "label": "Senior School",
                "x": 0.353,
                "y": 0.162,
                "width": 0.164,
                "height": 0.043,
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
    {
        "id": "prep-school",
        "name": "Prep School",
        "label": "Prep School",
        "x": 63,
        "y": 32,
        "metadata": {"area_type": "Academic building", "navigation": "floors"},
        "sub_locations": [],
        "floors": academic_floor_definitions("prep-school"),
        "interaction_regions": [
            {
                "id": "prep-school-region",
                "label": "Prep School",
                **map_text_region_from_pixels(2391, 500, 564, 101),
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
    {
        "id": "pre-prep-school",
        "name": "Pre-Prep School",
        "label": "Pre-Prep School",
        "x": 62,
        "y": 57,
        "metadata": {"area_type": "Academic building", "navigation": "floors"},
        "sub_locations": [],
        "floors": academic_floor_definitions("pre-prep-school"),
        "interaction_regions": [
            {
                "id": "pre-prep-school-region",
                "label": "Pre-Prep School",
                "x": 0.565,
                "y": 0.515,
                "width": 0.170,
                "height": 0.045,
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
    {
        "id": "sports-building",
        "name": "Sports Building",
        "label": "Sports Building",
        "x": 50,
        "y": 57,
        "metadata": {"area_type": "Sports building", "navigation": "areas"},
        "sub_locations": school_sub_locations(SPORTS_BUILDING_SUB_LOCATION_LABELS),
        "floors": [],
        "interaction_regions": [
            {
                "id": "sports-building-region",
                "label": "Sports Building",
                **map_text_region_from_pixels(1637, 1533, 542, 100),
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
    {
        "id": "sports-complex",
        "name": "Sports Complex",
        "x": 34,
        "y": 48,
        "metadata": {"area_type": "Sports complex", "navigation": "areas"},
        "sub_locations": school_sub_locations(SPORTS_COMPLEX_SUB_LOCATION_LABELS),
        "floors": [],
        "interaction_regions": [
            {
                "id": "sports-complex-region",
                "label": "Sports Complex",
                **map_text_region_from_pixels(864, 1336, 752, 88),
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
    {
        "id": "sports-fields-running-track",
        "name": "Sports Fields & Running Track",
        "label": "Sports Fields & Running Track",
        "x": 31,
        "y": 9,
        "metadata": {"area_type": "Sports field", "navigation": "standalone"},
        "sub_locations": [],
        "floors": [],
        "interaction_regions": [
            {
                "id": "sports-fields-running-track-region",
                "label": "Sports Fields & Running Track",
                "x": 0.164,
                "y": 0.070,
                "width": 0.262,
                "height": 0.043,
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
    {
        "id": "morris-forum",
        "name": "Morris Forum",
        "label": "Morris Forum",
        "x": 60,
        "y": 44,
        "metadata": {"area_type": "Forum", "navigation": "standalone"},
        "sub_locations": [],
        "floors": [],
        "interaction_regions": [
            {
                "id": "morris-forum-region",
                "label": "Morris Forum",
                "x": 0.530,
                "y": 0.352,
                "width": 0.145,
                "height": 0.043,
                "shape": "box",
                "points": [],
                "type": "zone",
            },
        ],
    },
]

FIXED_SCHOOL_ZONES = [location["name"] for location in SCHOOL_LOCATION_DATA]

SCHOOL_LOCATIONS = FIXED_SCHOOL_ZONES.copy()


def school_location_path_parts(value: str) -> list[str]:
    return [
        part.strip()
        for part in str(value or "").split(">")
        if part.strip()
    ]


def normalize_location_text(value: str | None) -> str:
    return re.sub(
        r"\s+",
        " ",
        re.sub(r"[^a-z0-9]+", " ", str(value or "").lower().replace("&", " and ")),
    ).strip()


def location_aliases(label: str) -> list[str]:
    values = [label, *SCHOOL_LOCATION_ALIASES.get(label, [])]
    return list(dict.fromkeys(normalize_location_text(value) for value in values if normalize_location_text(value)))


def school_location_alias_entries() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for location in SCHOOL_LOCATION_DATA:
        labels = [
            str(location.get("name") or ""),
            str(location.get("label") or ""),
        ]
        for label in labels:
            for alias in location_aliases(label):
                entries.append({"location": location, "alias": alias})
    return [entry for entry in entries if entry["alias"]]


def school_location_by_id(location_id: str) -> dict[str, Any] | None:
    return next((location for location in SCHOOL_LOCATION_DATA if location.get("id") == location_id), None)


def school_location_by_label(value: str) -> dict[str, Any] | None:
    normalized = normalize_location_text(value)
    if not normalized:
        return None
    return next(
        (entry["location"] for entry in school_location_alias_entries() if entry["alias"] == normalized),
        None,
    )


def location_context_id_from_values(*values: str) -> str:
    source = normalize_location_text(" ".join(str(value or "") for value in values))
    if not source:
        return ""
    entries = sorted(school_location_alias_entries(), key=lambda entry: len(entry["alias"]), reverse=True)
    match = next((entry for entry in entries if source == entry["alias"] or entry["alias"] in source), None)
    return str(match["location"].get("id") or "") if match else ""


def floor_number_from_label(value: str) -> int:
    label = str(value or "").strip()
    match = re.search(r"\b(?:floor|level)\s*([1-9])\b", label, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.fullmatch(r"floor-([1-9])", label, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    return 0


def floor_label_for_number(floor_number: int) -> str:
    return f"Floor {floor_number}"


def location_has_floor(location: dict[str, Any], floor_number: int) -> bool:
    max_floor = ACADEMIC_FLOOR_COUNTS_BY_LOCATION_ID.get(str(location.get("id") or ""), 0)
    return bool(max_floor and 1 <= floor_number <= max_floor)


def direct_sub_locations_for_location(location: dict[str, Any]) -> list[dict[str, Any]]:
    sub_locations = location.get("sub_locations") if isinstance(location.get("sub_locations"), list) else []
    return [sub_location for sub_location in sub_locations if isinstance(sub_location, dict)]


def sub_location_matches_label(sub_location: dict[str, Any], value: str) -> bool:
    normalized = normalize_location_text(value)
    labels = [
        str(sub_location.get("label") or ""),
        str(sub_location.get("id") or ""),
    ]
    aliases = [
        alias
        for label in labels
        for alias in location_aliases(label)
    ]
    return bool(normalized and normalized in aliases)


def direct_sub_location_matches(value: str) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    matches: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for location in SCHOOL_LOCATION_DATA:
        for sub_location in direct_sub_locations_for_location(location):
            if sub_location_matches_label(sub_location, value):
                matches.append((location, sub_location))
    return matches


def school_location_code_candidates(value: str) -> list[str]:
    source = str(value or "").strip()
    if not source:
        return []
    candidates: list[str] = []
    for part in school_location_path_parts(source) or [source]:
        normalized = re.sub(r"\s+", "", part.upper())
        if re.fullmatch(r"[ASP]\d+", normalized):
            candidates.append(normalized)
    for match in re.finditer(r"\b([ASP])\s*(\d+)\b", source, flags=re.IGNORECASE):
        candidates.append(f"{match.group(1).upper()}{match.group(2)}")
    return list(dict.fromkeys(candidates))


def parse_school_location_code(code: str, context_location_id: str = "") -> dict[str, Any] | None:
    normalized_code = str(code or "").strip().upper()
    match = re.fullmatch(r"([ASP])([1-5]\d{2})", normalized_code)
    if not match:
        return None
    prefix, room_number = match.groups()
    floor_number = int(room_number[0])
    rules = [
        rule
        for rule in SCHOOL_LOCATION_CODE_RULES
        if rule["prefix"] == prefix
        and int(rule["min_floor"]) <= floor_number <= int(rule["max_floor"])
    ]
    if context_location_id:
        rules = [rule for rule in rules if rule["location_id"] == context_location_id]
    if not rules:
        return None
    rule = rules[0]
    return {
        "code": normalized_code,
        "prefix": prefix,
        "room_number": room_number,
        "floor_number": floor_number,
        "location_id": rule["location_id"],
        "name": rule["name"],
    }


def valid_school_location_code(code: str) -> bool:
    return parse_school_location_code(code) is not None


def validate_school_location_codes(*values: str) -> None:
    context_location_id = location_context_id_from_values(*values)
    for value in values:
        for code in school_location_code_candidates(value):
            if parse_school_location_code(code, context_location_id):
                continue
            raise HTTPException(
                status_code=400,
                detail=INVALID_LOCATION_CODE_MESSAGE,
            )


def canonical_known_location(location_value: str, secondary_value: str = "") -> tuple[str, str] | None:
    raw_location = str(location_value or "").strip()
    raw_secondary = str(secondary_value or "").strip()
    if not raw_location:
        return None

    candidates = [
        f"{raw_secondary} > {raw_location}" if raw_secondary else "",
        raw_location,
    ]
    for candidate in [value for value in candidates if value]:
        parts = school_location_path_parts(candidate)
        if not parts:
            continue
        location = school_location_by_label(parts[0])
        if not location:
            continue
        location_name = str(location.get("name") or "").strip()
        if len(parts) == 1:
            return location_name, location_name

        floor_number = floor_number_from_label(parts[1])
        if floor_number and location_has_floor(location, floor_number):
            floor_label = floor_label_for_number(floor_number)
            if len(parts) == 2:
                return floor_label, location_name
            continue

        sub_location = next(
            (
                sub_location
                for sub_location in direct_sub_locations_for_location(location)
                if sub_location_matches_label(sub_location, parts[1])
            ),
            None,
        )
        if sub_location and len(parts) == 2:
            return str(sub_location.get("label") or "").strip(), location_name

    parent_location = school_location_by_label(raw_secondary)
    if parent_location:
        parent_name = str(parent_location.get("name") or "").strip()
        floor_number = floor_number_from_label(raw_location)
        if floor_number and location_has_floor(parent_location, floor_number):
            return floor_label_for_number(floor_number), parent_name
        sub_location = next(
            (
                sub_location
                for sub_location in direct_sub_locations_for_location(parent_location)
                if sub_location_matches_label(sub_location, raw_location)
            ),
            None,
        )
        if sub_location:
            return str(sub_location.get("label") or "").strip(), parent_name

    sub_location_matches = direct_sub_location_matches(raw_location)
    if len(sub_location_matches) == 1:
        parent, sub_location = sub_location_matches[0]
        return str(sub_location.get("label") or "").strip(), str(parent.get("name") or "").strip()

    return None


def canonical_report_location(location_value: str, secondary_value: str = "") -> tuple[str, str]:
    raw_location = str(location_value or "").strip()
    raw_secondary = str(secondary_value or "").strip()
    if not raw_location or normalize_location_text(raw_location) in {"unknown", "optional text"}:
        raise HTTPException(status_code=400, detail=INVALID_LOCATION_CODE_MESSAGE)

    context_location_id = location_context_id_from_values(raw_location, raw_secondary)
    code_candidates = [
        *school_location_code_candidates(raw_location),
        *school_location_code_candidates(raw_secondary),
    ]
    code_candidates = list(dict.fromkeys(code_candidates))
    if code_candidates:
        parsed_codes: list[dict[str, Any]] = []
        for code in code_candidates:
            parsed = parse_school_location_code(code, context_location_id)
            if not parsed:
                raise HTTPException(status_code=400, detail=INVALID_LOCATION_CODE_MESSAGE)
            parsed_codes.append(parsed)
        primary_code = school_location_code_candidates(raw_location)
        primary = next(
            (parsed for parsed in parsed_codes if parsed["code"] in primary_code),
            parsed_codes[0],
        )
        return primary["code"], f"{primary['name']} > {floor_label_for_number(primary['floor_number'])}"

    known_location = canonical_known_location(raw_location, raw_secondary)
    if known_location:
        return known_location

    raise HTTPException(status_code=400, detail=INVALID_LOCATION_CODE_MESSAGE)


def school_location_filter_values() -> list[str]:
    values: list[str] = []
    for location in SCHOOL_LOCATION_DATA:
        name = str(location.get("name") or "").strip()
        if not name:
            continue
        values.append(name)
        metadata = location.get("metadata") if isinstance(location.get("metadata"), dict) else {}
        area_type = str(metadata.get("area_type") or metadata.get("areaType") or "").lower()
        if "sport" in area_type:
            sub_locations = location.get("sub_locations") if isinstance(location.get("sub_locations"), list) else []
            values.extend(
                f"{name} > {sub_location['label']}"
                for sub_location in sub_locations
                if isinstance(sub_location, dict) and str(sub_location.get("label") or "").strip()
            )
            continue
        floors = location.get("floors")
        if not isinstance(floors, list):
            continue
        for floor in floors:
            if not isinstance(floor, dict):
                continue
            floor_label = str(floor.get("label") or "").strip()
            if not floor_label or re.fullmatch(r"undefined|null|\?", floor_label, flags=re.IGNORECASE):
                continue
            values.append(f"{name} > {floor_label}")
    return list(dict.fromkeys(values))

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
RECENT_RETURN_WINDOW_DAYS = 7
CLAIM_PREVIEW_PROMPT = (
    "You are looking only at a selected circular region from a lost-and-found image.\n"
    "Describe only what is visible inside this selected area.\n"
    'Return strict JSON with keys "description" and "tags".\n'
    'The "description" must be short. The "tags" value must be a short list of 1 to 5 lowercase tags.\n'
    "If the region is unclear, say that it is unclear instead of guessing."
)
MAX_UPLOAD_SIZE = 5 * 1024 * 1024
MAX_REQUEST_SIZE = 5 * 1024 * 1024
SOFT_DELETE_UPLOAD_CLEANUP_DELAY_SECONDS = max(0, int(os.getenv("SOFT_DELETE_UPLOAD_CLEANUP_DELAY_SECONDS", "120")))
CLAIM_MODERATION_BLOCK_HINTS = (
    "abusive",
    "gibberish",
    "inappropriate",
    "keyboard mash",
    "nonsens",
    "offensive",
    "random characters",
    "spam",
    "threat",
)
UPLOAD_CHUNK_SIZE = 1024 * 1024
RATE_LIMITS = {
    "chat": {"limit": 10, "window": timedelta(seconds=30)},
    "report": {"limit": 5, "window": timedelta(minutes=1)},
    "claim": {"limit": 3, "window": timedelta(minutes=1)},
    "email_code": {"limit": 4, "window": timedelta(minutes=15)},
    "email_verify": {"limit": 8, "window": timedelta(minutes=15)},
}
CLAIM_MATCH_MIN_SCORE = 35
QUESTION_TYPES = {"seen_item", "has_this_been_found", "lost_not_listed"}
QUESTION_REPLY_TYPES = {"reply", "suggestion", "confirmation"}
GENERAL_UPLOAD_TYPES = {
    ".png": {"mime_types": {"image/png"}, "kind": "png"},
    ".jpg": {"mime_types": {"image/jpeg"}, "kind": "jpeg"},
    ".jpeg": {"mime_types": {"image/jpeg"}, "kind": "jpeg"},
    ".pdf": {"mime_types": {"application/pdf"}, "kind": "pdf"},
    ".txt": {"mime_types": {"text/plain"}, "kind": "txt"},
}
REPORT_IMAGE_UPLOAD_TYPES = {
    ".png": {"mime_types": {"image/png"}, "kind": "png"},
    ".jpg": {"mime_types": {"image/jpeg", "image/jpg"}, "kind": "jpeg"},
    ".jpeg": {"mime_types": {"image/jpeg", "image/jpg"}, "kind": "jpeg"},
    ".webp": {"mime_types": {"image/webp"}, "kind": "webp"},
    ".heic": {"mime_types": {"image/heic", "image/heif", "application/octet-stream"}, "kind": "heic"},
    ".heif": {"mime_types": {"image/heif", "image/heic", "application/octet-stream"}, "kind": "heif"},
}
ALLOWED_UPLOAD_TYPES = GENERAL_UPLOAD_TYPES
IMAGE_UPLOAD_EXTENSIONS = set(REPORT_IMAGE_UPLOAD_TYPES)
AI_ANALYSIS_SUCCESS = "success"
AI_ANALYSIS_FALLBACK = "fallback"
AI_ANALYSIS_FAILED = "failed"
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
    username: str = ""
    email: str
    password: str
    initials: str = ""
    class_of: Optional[int] = None
    email_verification_token: str


class LoginPayload(BaseModel):
    email: str = ""
    password: str
    username: str = ""


class EmailVerificationRequestPayload(BaseModel):
    email: str
    purpose: str = "register"


class EmailVerificationConfirmPayload(BaseModel):
    email: str
    code: str
    purpose: str = "register"


class EmailChangePayload(BaseModel):
    email: str


class EmailChangeConfirmPayload(BaseModel):
    email: str
    code: str


class SmtpDiagnosticPayload(BaseModel):
    email: str


class ClaimPayload(BaseModel):
    claim_reason: str
    item_description: str
    lost_location: str
    identifying_info: str
    visual_selection: Optional[dict[str, Any]] = None
    visual_summary: str = ""
    visual_tags: list[str] = []


class QueryPayload(BaseModel):
    message: str
    language: str = "en"
    question_type: str = "lost_not_listed"
    location_hint: str = ""


class QuestionReplyPayload(BaseModel):
    message: str
    reply_type: str = "reply"
    suggested_item_id: Optional[int] = None


class ClaimDraftPayload(BaseModel):
    item_id: Optional[int] = None
    title: str = ""
    claim_reason: str = ""
    item_description: str
    lost_location: str = ""
    identifying_info: str = ""
    visual_selection: Optional[dict[str, Any]] = None
    visual_summary: str = ""
    visual_tags: list[str] = []
    source: str = "manual"


class ClaimDraftSubmitPayload(BaseModel):
    item_id: Optional[int] = None


class AssistantChatPayload(BaseModel):
    message: str
    language: str = "en"
    execute_search: bool = False
    query: str = ""


class ReportImagePayload(BaseModel):
    filename: str
    content_type: Optional[str] = None
    data: str


class ReportPayload(BaseModel):
    reporter_name: str = ""
    title: str
    description: str
    location: str = ""
    category: str = "Other"
    evidence_details: str = ""
    student_id: str = ""
    contact_info: str = ""
    secondary_location: str = ""
    color: str = ""
    time_slot: str = "Unknown"
    event_date: Optional[date] = None
    claim_required: bool = True
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


class ClaimRequirementPayload(BaseModel):
    claim_required: bool


class AdminClaimDecisionPayload(BaseModel):
    status: str


class AdminUserRolePayload(BaseModel):
    role: str


class RoomUploadPayload(BaseModel):
    label: str = ""
    images: list[ReportImagePayload]


class CircleSelectionPayload(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    radius: Optional[float] = None
    type: str = "circle"
    points: Optional[list[list[float]]] = None
    bounding_box: Optional[dict[str, float]] = None


class ClaimPreviewPayload(BaseModel):
    selection: CircleSelectionPayload


class ReturnedItemDisputePayload(BaseModel):
    reason: str


class MapRegionPayload(BaseModel):
    label: str
    zone: str
    x: float
    y: float
    width: float
    height: float


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    with SessionLocal() as db:
        ensure_admin_user(db)
        run_existing_user_role_detection_migration(db)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/config.js", include_in_schema=False)
def frontend_runtime_config() -> Response:
    payload = {
        "apiBaseUrl": FRONTEND_API_BASE_URL,
        "apiDebug": FRONTEND_API_DEBUG,
    }
    return Response(
        content=f"window.LOSTFOUND_CONFIG = Object.freeze({json.dumps(payload, separators=(',', ':'))});\n",
        media_type="application/javascript",
        headers={"Cache-Control": "no-store"},
    )


if UPLOAD_STORAGE_BACKEND == "filesystem":
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/uploads/background.png")
def serve_login_background() -> FileResponse:
    if not LOGIN_BACKGROUND_PATH.is_file():
        raise HTTPException(status_code=404, detail="Upload not found.")
    return FileResponse(
        LOGIN_BACKGROUND_PATH,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get(MAP_IMAGE_URL)
def serve_school_map() -> FileResponse:
    if not MAP_IMAGE_PATH.is_file():
        raise HTTPException(status_code=404, detail="Map image not found.")
    return FileResponse(
        MAP_IMAGE_PATH,
        media_type="image/png",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@app.get(LOADING_VIDEO_URL)
def serve_loading_video() -> FileResponse:
    if not LOADING_VIDEO_PATH.is_file():
        raise HTTPException(status_code=404, detail="Loading video not found.")
    return FileResponse(
        LOADING_VIDEO_PATH,
        media_type="video/mp4",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/uploads/{upload_path:path}")
def serve_database_upload(upload_path: str, db: Session = Depends(get_db)):
    if UPLOAD_STORAGE_BACKEND != "database":
        raise HTTPException(status_code=404, detail="Upload not found.")

    normalized_path = normalize_upload_url_path(f"/uploads/{upload_path}")
    if not normalized_path:
        raise HTTPException(status_code=404, detail="Upload not found.")

    upload_object = db.query(UploadObject).filter(UploadObject.path == normalized_path).first()
    if not upload_object:
        if normalized_path == "/uploads/background.png" and LOGIN_BACKGROUND_PATH.is_file():
            return FileResponse(
                LOGIN_BACKGROUND_PATH,
                media_type="image/png",
                headers={"Cache-Control": "public, max-age=86400"},
            )
        if normalized_path == MAP_IMAGE_URL and MAP_IMAGE_PATH.is_file():
            return FileResponse(
                MAP_IMAGE_PATH,
                media_type="image/png",
                headers={"Cache-Control": "no-store, max-age=0"},
            )
        if normalized_path == LOADING_VIDEO_URL and LOADING_VIDEO_PATH.is_file():
            return FileResponse(
                LOADING_VIDEO_PATH,
                media_type="video/mp4",
                headers={"Cache-Control": "public, max-age=86400"},
            )
        raise HTTPException(status_code=404, detail="Upload not found.")

    cache_control = "no-store, max-age=0" if normalized_path == MAP_IMAGE_URL else "public, max-age=86400"
    return Response(
        content=bytes(upload_object.content),
        media_type=upload_object.content_type or "application/octet-stream",
        headers={
            "Cache-Control": cache_control,
            "Content-Length": str(upload_object.size or len(upload_object.content)),
        },
    )


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
        role=detect_role_from_identifiers(username, ""),
        auto_detected_role=detect_role_from_identifiers(username, ""),
        assigned_role="",
        auth_provider="password",
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


def normalize_user_role(value: str, *, default: str = USER_ROLE_TEACHER) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in USER_ROLES else default


def normalize_optional_user_role(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in USER_ROLES else ""


def detect_role_from_identifiers(username: str = "", email: str = "") -> str:
    combined = f"{username or ''} {email or ''}"
    return USER_ROLE_STUDENT if re.search(r"\d", combined) else USER_ROLE_TEACHER


def role_detection_log(user: Optional[User], *, detected_role: str, source: str) -> None:
    security_logger.info(
        "[ROLE DETECTION] user=%s email=%s detected_role=%s source=%s",
        getattr(user, "username", "") or "",
        getattr(user, "email", "") or "",
        detected_role,
        source,
    )


def detect_user_auto_role(user: User) -> str:
    return detect_role_from_identifiers(user.username or "", user.email or "")


def apply_user_role_detection(user: User, *, source: str, force: bool = False) -> bool:
    detected_role = detect_user_auto_role(user)
    role_detection_log(user, detected_role=detected_role, source=source)

    current_auto_role = normalize_optional_user_role(getattr(user, "auto_detected_role", ""))
    assigned_role = normalize_optional_user_role(getattr(user, "assigned_role", ""))
    current_effective_role = normalize_optional_user_role(getattr(user, "role", ""))
    effective_role = assigned_role or detected_role
    changed = False

    if force or current_auto_role != detected_role:
        user.auto_detected_role = detected_role
        changed = True
    if getattr(user, "assigned_role", "") and not assigned_role:
        user.assigned_role = ""
        changed = True
    if current_effective_role != effective_role:
        user.role = effective_role
        changed = True
    return changed


def ensure_user_role_assignment(db: Session, user: User, *, source: str, force: bool = False) -> User:
    if apply_user_role_detection(user, source=source, force=force):
        db.commit()
        db.refresh(user)
    return user


def user_role(user: Optional[User]) -> str:
    if not user:
        return USER_ROLE_TEACHER
    assigned_role = normalize_optional_user_role(getattr(user, "assigned_role", ""))
    if assigned_role:
        return assigned_role
    auto_detected_role = normalize_optional_user_role(getattr(user, "auto_detected_role", ""))
    if auto_detected_role:
        return auto_detected_role
    return normalize_user_role(getattr(user, "role", ""), default=USER_ROLE_TEACHER)


def user_is_student(user: Optional[User]) -> bool:
    return user_role(user) == USER_ROLE_STUDENT and not bool(user and user.is_admin)


def user_can_create_content(user: Optional[User]) -> bool:
    return bool(user and (user.is_admin or user_role(user) == USER_ROLE_TEACHER))


def user_can_manage_item(user: Optional[User], item: LostFoundItem) -> bool:
    if not user:
        return False
    if user.is_admin:
        return True
    return user_role(user) == USER_ROLE_TEACHER and item.submitted_by_user_id == user.id


def ensure_can_manage_item(current_user: User, item: LostFoundItem) -> None:
    if not user_can_manage_item(current_user, item):
        raise HTTPException(status_code=403, detail="You can only manage content you created.")


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def validate_email_syntax(email: str) -> str:
    normalized = normalize_email(email)
    if len(normalized) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return normalized


def validate_email_address(email: str) -> str:
    normalized = validate_email_syntax(email)
    if SCHOOL_EMAIL_DOMAINS and not email_matches_domain_rules(normalized, SCHOOL_EMAIL_DOMAINS):
        raise HTTPException(status_code=403, detail="Use an approved school email address.")
    return normalized


def username_candidate_from_email(email: str) -> str:
    local_part = normalize_email(email).split("@", 1)[0]
    candidate = re.sub(r"[^a-z0-9_.-]+", "", local_part.lower()).strip("._-")
    if len(candidate) < 3:
        candidate = f"{candidate}user" if candidate else "user"
    return candidate[:48]


def unique_username_from_email(db: Session, email: str) -> str:
    base = username_candidate_from_email(email)
    candidate = base
    suffix = 2
    while db.query(User).filter(User.username == candidate).first():
        suffix_text = f"-{suffix}"
        candidate = f"{base[:48 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return candidate


def default_initials_from_email(email: str) -> str:
    local_part = normalize_email(email).split("@", 1)[0]
    words = re.findall(r"[a-z]+", local_part.lower())
    if len(words) >= 2:
        return f"{words[0]}.{words[1]}"
    if words and words[0] != "user":
        return f"{words[0]}.user"
    return "school.user"


def default_class_of_from_email(email: str) -> int:
    local_part = normalize_email(email).split("@", 1)[0]
    for match in re.finditer(r"(?<!\d)(20)?([2-3]\d)(?!\d)", local_part):
        year = int(match.group(0) if match.group(1) else f"20{match.group(2)}")
        if 2025 <= year <= 2035:
            return year
    return 2030


def user_email_is_verified(user: User) -> bool:
    return bool(getattr(user, "email_verified", False) or user.email_verified_at)


def email_domain(email: str) -> str:
    normalized = normalize_email(email)
    return normalized.split("@", 1)[1] if "@" in normalized else ""


def domain_matches_rule(domain: str, rule: str) -> bool:
    normalized_domain = str(domain or "").strip().lower()
    normalized_rule = str(rule or "").strip().lower().lstrip("@")
    if not normalized_domain or not normalized_rule:
        return False
    if normalized_rule.startswith("."):
        return normalized_domain.endswith(normalized_rule)
    return normalized_domain == normalized_rule or normalized_domain.endswith(f".{normalized_rule}")


def email_matches_domain_rules(email: str, rules: list[str]) -> bool:
    domain = email_domain(email)
    return any(domain_matches_rule(domain, rule) for rule in rules)


def email_is_school_account(email: str) -> bool:
    if SCHOOL_EMAIL_DOMAINS:
        return email_matches_domain_rules(email, SCHOOL_EMAIL_DOMAINS)
    return False


ROLE_DETECTION_MIGRATION_NAME = "role_detection_numeric_v1"


def run_existing_user_role_detection_migration(db: Session) -> None:
    existing = db.query(SystemMigration).filter(SystemMigration.name == ROLE_DETECTION_MIGRATION_NAME).first()
    if existing:
        return

    users = db.query(User).order_by(User.id.asc()).all()
    changed = 0
    for user in users:
        if apply_user_role_detection(user, source="existing_user", force=True):
            changed += 1

    db.add(SystemMigration(name=ROLE_DETECTION_MIGRATION_NAME, completed_at=datetime.utcnow()))
    db.commit()
    security_log("role_detection_migration_complete", migration=ROLE_DETECTION_MIGRATION_NAME, users=len(users), changed=changed)


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
        "claim_required": bool(item.claim_required),
        "is_room_item": bool(item.is_room_item),
        "llava_analysis": item.llava_analysis,
        "ai_analysis_status": item.ai_analysis_status or AI_ANALYSIS_SUCCESS,
        "unverified_ai_analysis": bool(item.unverified_ai_analysis),
        "room_label": item.room_label,
        "room_recorded_at": item.room_recorded_at.isoformat() if item.room_recorded_at else None,
        "returned_at": item.returned_at.isoformat() if item.returned_at else None,
        "returned_by_claim_id": item.returned_by_claim_id,
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
        "visual_selection": parse_json_object(claim.visual_selection_json, default={}),
        "visual_summary": claim.visual_summary or "",
        "visual_tags": parse_json_list(claim.visual_tags_json),
        "status": claim.status,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
        "updated_at": claim.updated_at.isoformat() if claim.updated_at else None,
    }


def snapshot_claim_draft(draft: ClaimDraft) -> dict[str, Any]:
    return {
        "id": draft.id,
        "item_id": draft.item_id,
        "user_id": draft.user_id,
        "title": draft.title,
        "claim_reason": draft.claim_reason,
        "item_description": draft.item_description,
        "lost_location": draft.lost_location,
        "identifying_info": draft.identifying_info,
        "visual_selection": parse_json_object(draft.visual_selection_json, default={}),
        "visual_summary": draft.visual_summary or "",
        "visual_tags": parse_json_list(draft.visual_tags_json),
        "source": draft.source,
        "status": draft.status,
        "submitted_claim_id": draft.submitted_claim_id,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
        "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
    }


def snapshot_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "email_verified": user_email_is_verified(user),
        "email_verified_at": user.email_verified_at.isoformat() if user.email_verified_at else None,
        "role": user_role(user),
        "auto_detected_role": normalize_optional_user_role(user.auto_detected_role) or USER_ROLE_TEACHER,
        "assigned_role": normalize_optional_user_role(user.assigned_role),
        "auth_provider": user.auth_provider or "password",
        "initials": user.initials,
        "class_of": user.class_of,
        "is_admin": bool(user.is_admin),
        "preferred_language": normalize_language(user.preferred_language),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
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
    related_question_id: Optional[int] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        event_type=event_type,
        title=title,
        message=message,
        related_item_id=related_item_id,
        related_claim_id=related_claim_id,
        related_question_id=related_question_id,
    )
    db.add(notification)
    return notification


def parse_json_object(raw_value: str, *, default: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    try:
        value = json.loads(raw_value or "{}")
        return value if isinstance(value, dict) else (default or {})
    except json.JSONDecodeError:
        return default or {}


def parse_json_list(raw_value: str) -> list[str]:
    try:
        value = json.loads(raw_value or "[]")
        if not isinstance(value, list):
            return []
        cleaned: list[str] = []
        for entry in value:
            normalized = str(entry).strip().lower()
            if normalized and normalized not in cleaned:
                cleaned.append(normalized)
        return cleaned[:8]
    except json.JSONDecodeError:
        return []


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
        "related_question_id": notification.related_question_id,
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


def normalized_upload_subdirectory(subdirectory: Optional[str] = None) -> list[str]:
    raw_subdirectory = str(subdirectory or "").strip().replace("\\", "/").strip("/")
    if not raw_subdirectory:
        return []

    parts = [part for part in raw_subdirectory.split("/") if part]
    if any(part in {".", ".."} or not re.fullmatch(r"[A-Za-z0-9._-]+", part) for part in parts):
        raise HTTPException(status_code=500, detail="Upload directory is misconfigured.")
    return parts


def upload_url_for_relative_path(relative_path: str) -> str:
    return f"/uploads/{relative_path.strip('/')}"


def safe_upload_relative_path(extension: str, *, subdirectory: Optional[str] = None) -> str:
    parts = normalized_upload_subdirectory(subdirectory)
    parts.append(f"{uuid4().hex}{extension}")
    return "/".join(parts)


def database_upload_cache_path(upload_path: Optional[str]) -> Optional[Path]:
    raw_path = normalize_upload_url_path(upload_path)
    if not raw_path:
        return None

    cache_path = (UPLOAD_CACHE_DIR / raw_path[len("/uploads/"):]).resolve()
    try:
        cache_path.relative_to(UPLOAD_CACHE_DIR)
    except ValueError:
        report_logger.warning("Rejected upload cache path outside cache: %s", raw_path)
        return None
    return cache_path


def store_upload_object(
    *,
    original_name: str,
    extension: str,
    file_bytes: bytes,
    mime_type: str,
    upload_subdir: Optional[str] = None,
) -> dict:
    relative_path = safe_upload_relative_path(extension, subdirectory=upload_subdir)
    upload_path = upload_url_for_relative_path(relative_path)
    db = SessionLocal()
    try:
        db.add(
            UploadObject(
                path=upload_path,
                original_name=Path(original_name or "").name,
                content_type=mime_type or "application/octet-stream",
                size=len(file_bytes),
                content=file_bytes,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    cache_path = database_upload_cache_path(upload_path)
    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(file_bytes)

    return {
        "original_name": Path(original_name or "").name,
        "stored_name": Path(relative_path).name,
        "path": upload_path,
        "size": len(file_bytes),
        "mime_type": mime_type,
        "extension": extension,
    }


def materialize_database_upload(upload_path: Optional[str]) -> Optional[Path]:
    raw_path = normalize_upload_url_path(upload_path)
    if not raw_path:
        return None

    db = SessionLocal()
    try:
        upload_object = db.query(UploadObject).filter(UploadObject.path == raw_path).first()
        if not upload_object:
            return None
        cache_path = database_upload_cache_path(raw_path)
        if not cache_path:
            return None
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        if not cache_path.exists() or cache_path.stat().st_size != upload_object.size:
            cache_path.write_bytes(bytes(upload_object.content))
        return cache_path
    finally:
        db.close()


def upload_url_for_path(destination: Path) -> str:
    relative_path = destination.resolve().relative_to(UPLOAD_DIR).as_posix()
    return f"/uploads/{relative_path}"


def safe_upload_path(extension: str, *, subdirectory: Optional[str] = None) -> Path:
    destination_dir = UPLOAD_DIR
    for part in normalized_upload_subdirectory(subdirectory):
        destination_dir = destination_dir / part
    destination_dir.mkdir(parents=True, exist_ok=True)
    return destination_dir / f"{uuid4().hex}{extension}"


def finalize_upload_permissions(destination: Path) -> None:
    # Uploads may be served by FastAPI or by nginx in production, so keep them
    # readable outside the writer process while preserving owner write access.
    destination.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)


def ensure_upload_is_served_readable(upload_path: Path) -> None:
    try:
        current_mode = stat.S_IMODE(upload_path.stat().st_mode)
        target_mode = stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH
        if current_mode != target_mode:
            upload_path.chmod(target_mode)
    except OSError:
        report_logger.warning("[Upload] could not update served permissions for %s", upload_path, exc_info=True)


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


def to_int_or_none(value: object) -> Optional[int]:
    try:
        parsed = int(str(value or "").strip())
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


async def save_upload_file(
    upload: UploadFile | StarletteUploadFile,
    *,
    expected_extensions: Optional[set[str]] = None,
    allowed_types: Optional[dict[str, dict[str, object]]] = None,
    upload_subdir: Optional[str] = None,
) -> dict:
    upload_types = allowed_types or ALLOWED_UPLOAD_TYPES
    extension = validate_upload_metadata(upload.filename or "", expected_extensions, allowed_types=upload_types)
    if UPLOAD_STORAGE_BACKEND == "database":
        total_size = 0
        first_chunk = b""
        content = bytearray()
        client_mime_type = (upload.content_type or "").strip().lower()
        try:
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
                content.extend(chunk)
        finally:
            await upload.close()

        detected_mime_type = sniff_file_type(first_chunk)
        if not detected_mime_type:
            security_log(
                "blocked_upload",
                level=logging.WARNING,
                reason="unverified_type",
                filename=Path(upload.filename or "").name,
            )
            raise HTTPException(status_code=415, detail="Could not verify the uploaded file type.")

        validate_detected_mime(extension, detected_mime_type, allowed_types=upload_types)
        if client_mime_type and client_mime_type not in upload_types[extension]["mime_types"]:
            security_log(
                "blocked_upload",
                level=logging.WARNING,
                reason="client_mime_mismatch",
                filename=Path(upload.filename or "").name,
                client_mime_type=client_mime_type,
                detected_mime_type=detected_mime_type,
            )
            raise HTTPException(status_code=415, detail="Client MIME type does not match the allowed file type.")

        return store_upload_object(
            original_name=upload.filename or "",
            extension=extension,
            file_bytes=bytes(content),
            mime_type=detected_mime_type,
            upload_subdir=upload_subdir,
        )

    destination = safe_upload_path(extension, subdirectory=upload_subdir)
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
        destination = safe_upload_path(extension, subdirectory=upload_subdir)
        return await save_upload_file(
            upload,
            expected_extensions=expected_extensions,
            allowed_types=upload_types,
            upload_subdir=upload_subdir,
        )
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
        "path": upload_url_for_path(destination),
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
    upload_subdir: Optional[str] = None,
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

    if UPLOAD_STORAGE_BACKEND == "database":
        return store_upload_object(
            original_name=working_filename,
            extension=extension,
            file_bytes=working_bytes,
            mime_type=detected_mime_type,
            upload_subdir=upload_subdir,
        )

    destination = safe_upload_path(extension, subdirectory=upload_subdir)
    destination.write_bytes(working_bytes)
    finalize_upload_permissions(destination)
    return {
        "original_name": Path(working_filename).name,
        "stored_name": destination.name,
        "path": upload_url_for_path(destination),
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
        question_type = str(form.get("question_type") or "lost_not_listed")
        location_hint = str(form.get("location_hint") or "")
        uploaded_file = form.get("file")
        attachment = None
        if hasattr(uploaded_file, "filename") and hasattr(uploaded_file, "read") and uploaded_file.filename:
            attachment = await save_upload_file(uploaded_file)
        return QueryPayload(
            message=message,
            language=language,
            question_type=question_type,
            location_hint=location_hint,
        ), attachment

    payload = QueryPayload(**(await request.json()))
    return payload, None


async def parse_question_reply_submission(request: Request) -> tuple[QuestionReplyPayload, Optional[dict]]:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        attachment = None
        if hasattr(uploaded_file, "filename") and hasattr(uploaded_file, "read") and uploaded_file.filename:
            attachment = await save_upload_file(uploaded_file)
        return QuestionReplyPayload(
            message=str(form.get("message") or ""),
            reply_type=str(form.get("reply_type") or "reply"),
            suggested_item_id=to_int_or_none(form.get("suggested_item_id")),
        ), attachment

    payload = QuestionReplyPayload(**(await request.json()))
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


def require_teacher_user(current_user: User = Depends(get_current_user)) -> User:
    if not user_can_create_content(current_user):
        raise HTTPException(status_code=403, detail="Teacher role required.")
    return current_user


def b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def b64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def normalize_verification_purpose(purpose: str) -> str:
    normalized = str(purpose or "").strip().lower()
    if normalized not in {"register", "email_change"}:
        raise HTTPException(status_code=400, detail="Unsupported verification purpose.")
    return normalized


def enforce_subject_rate_limit(scope: str, subject: str, *, route: str = "") -> None:
    config = RATE_LIMITS[scope]
    now = datetime.utcnow()
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
                route=route,
                limit=config["limit"],
                retry_after=retry_after_seconds,
            )
            raise_rate_limit(scope, retry_after_seconds=retry_after_seconds)
        timestamps.append(now)


def email_verification_secret() -> bytes:
    return EMAIL_VERIFICATION_SECRET.encode("utf-8")


def hash_email_code(email: str, purpose: str, code: str, salt: str) -> str:
    payload = f"{normalize_email(email)}|{purpose}|{salt}|{code}".encode("utf-8")
    return hmac.new(email_verification_secret(), payload, hashlib.sha256).hexdigest()


def email_code_digest(email: str, purpose: str, code: str) -> str:
    salt = secrets.token_hex(12)
    return f"{salt}${hash_email_code(email, purpose, code, salt)}"


def verify_email_code_digest(email: str, purpose: str, code: str, code_hash: str) -> bool:
    try:
        salt, stored = str(code_hash or "").split("$", 1)
    except ValueError:
        return False
    candidate = hash_email_code(email, purpose, code, salt)
    return hmac.compare_digest(candidate, stored)


def create_email_verification_record(
    db: Session,
    *,
    email: str,
    purpose: str,
    request: Optional[Request] = None,
) -> tuple[EmailVerificationCode, str]:
    now = datetime.utcnow()
    code = f"{secrets.randbelow(1_000_000):06d}"
    record = EmailVerificationCode(
        email=email,
        purpose=purpose,
        code_hash=email_code_digest(email, purpose, code),
        expires_at=now + timedelta(seconds=EMAIL_VERIFICATION_CODE_TTL_SECONDS),
        attempts=0,
        request_ip=get_client_ip(request) if request else "",
        user_agent=str(request.headers.get("user-agent", ""))[:240] if request else "",
        created_at=now,
        last_sent_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, code


def smtp_sender_header() -> str:
    return formataddr((SMTP_FROM_NAME, SMTP_FROM_ADDRESS)) if SMTP_FROM_NAME else SMTP_FROM_ADDRESS


def record_smtp_result(*, connected: bool, error: str = "") -> None:
    now = datetime.utcnow().isoformat()
    with SMTP_LAST_RESULT_LOCK:
        SMTP_LAST_RESULT["connected"] = connected
        SMTP_LAST_RESULT["last_error"] = error
        if connected:
            SMTP_LAST_RESULT["last_success_at"] = now
        else:
            SMTP_LAST_RESULT["last_failure_at"] = now


def smtp_unconfigured_message() -> str:
    return "Email delivery is not configured. Verification codes are currently being written to the development security log."


def smtp_config_status() -> dict[str, Any]:
    with SMTP_LAST_RESULT_LOCK:
        last_result = dict(SMTP_LAST_RESULT)
    configured = bool(SMTP_HOST)
    connected = bool(configured and last_result.get("connected"))
    return {
        "configured": configured,
        "connected": connected,
        "status": "connected" if connected else "not_connected",
        "host": SMTP_HOST,
        "port": SMTP_PORT,
        "username_configured": bool(SMTP_USERNAME),
        "password_configured": bool(SMTP_PASSWORD),
        "from_address": SMTP_FROM_ADDRESS,
        "from_name": SMTP_FROM_NAME,
        "sender": smtp_sender_header(),
        "use_tls": SMTP_USE_TLS,
        "use_ssl": SMTP_USE_SSL,
        "delivery_mode": "real-email" if configured else "development-log",
        "last_error": str(last_result.get("last_error") or ("" if configured else smtp_unconfigured_message())),
        "last_success_at": last_result.get("last_success_at"),
        "last_failure_at": last_result.get("last_failure_at"),
    }


def send_smtp_email(to_email: str, subject: str, body: str) -> None:
    if not SMTP_HOST:
        raise RuntimeError("SMTP_HOST is not configured.")
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_sender_header()
    message["To"] = to_email
    message.set_content(body)

    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            if SMTP_USERNAME or SMTP_PASSWORD:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        return

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
        smtp.ehlo()
        if SMTP_USE_TLS:
            smtp.starttls()
            smtp.ehlo()
        if SMTP_USERNAME or SMTP_PASSWORD:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)


def send_email_verification_code(email: str, code: str, *, purpose: str) -> bool:
    subject = "Your Lost and Found verification code"
    body = (
        "Use this verification code to continue with the school Lost and Found system:\n\n"
        f"{code}\n\n"
        f"This code expires in {EMAIL_VERIFICATION_CODE_TTL_SECONDS // 60} minute(s)."
    )
    if not SMTP_HOST:
        security_log("email_verification_code_dev", email=email, purpose=purpose, code=code)
        return False

    try:
        send_smtp_email(email, subject, body)
    except (RuntimeError, OSError, smtplib.SMTPException) as exc:
        error_message = str(exc)
        record_smtp_result(connected=False, error=error_message)
        security_log(
            "email_verification_send_failed",
            level=logging.WARNING,
            email=email,
            purpose=purpose,
            reason=error_message,
            smtp_host=SMTP_HOST,
            smtp_port=SMTP_PORT,
            smtp_use_tls=SMTP_USE_TLS,
            smtp_use_ssl=SMTP_USE_SSL,
            smtp_from_address=SMTP_FROM_ADDRESS,
            smtp_from_name=SMTP_FROM_NAME,
        )
        raise HTTPException(status_code=502, detail="Could not send verification email right now.") from exc

    record_smtp_result(connected=True)
    security_log("email_verification_code_sent", email=email, purpose=purpose)
    return True


def run_smtp_diagnostic_email(recipient: str) -> dict[str, Any]:
    config = smtp_config_status()
    subject = "Lost and Found SMTP diagnostic"
    body = (
        "This is a diagnostic email from the school Lost and Found system.\n\n"
        "If you received it, the SMTP provider accepted mail from this application."
    )
    if not SMTP_HOST:
        error_message = smtp_unconfigured_message()
        record_smtp_result(connected=False, error=error_message)
        security_log("smtp_test_failed", level=logging.WARNING, recipient=recipient, error=error_message, **config)
        return {
            "success": False,
            "smtp_connection": False,
            "smtp_delivery_accepted": False,
            "message": error_message,
            "error": error_message,
            "config": smtp_config_status(),
        }

    try:
        send_smtp_email(recipient, subject, body)
    except (RuntimeError, OSError, smtplib.SMTPException) as exc:
        error_message = str(exc)
        record_smtp_result(connected=False, error=error_message)
        security_log("smtp_test_failed", level=logging.WARNING, recipient=recipient, error=error_message, **config)
        return {
            "success": False,
            "smtp_connection": False,
            "smtp_delivery_accepted": False,
            "message": "SMTP diagnostic failed.",
            "error": error_message,
            "config": smtp_config_status(),
        }

    record_smtp_result(connected=True)
    security_log("smtp_test_success", recipient=recipient, **config)
    return {
        "success": True,
        "smtp_connection": True,
        "smtp_delivery_accepted": True,
        "message": "SMTP diagnostic email accepted by the mail server.",
        "error": "",
        "config": smtp_config_status(),
    }


def latest_pending_email_code(db: Session, *, email: str, purpose: str) -> Optional[EmailVerificationCode]:
    now = datetime.utcnow()
    return (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == purpose,
            EmailVerificationCode.consumed_at.is_(None),
            EmailVerificationCode.expires_at > now,
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )


def consume_email_verification_code(
    db: Session,
    *,
    email: str,
    purpose: str,
    code: str,
) -> tuple[EmailVerificationCode, datetime]:
    cleaned_code = re.sub(r"\D+", "", str(code or ""))
    if not re.fullmatch(r"\d{6}", cleaned_code):
        raise HTTPException(status_code=400, detail="Enter the 6-digit verification code.")

    record = latest_pending_email_code(db, email=email, purpose=purpose)
    if not record:
        raise HTTPException(status_code=400, detail="Verification code expired. Request a new code.")
    if int(record.attempts or 0) >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect code attempts. Request a new code.")

    record.attempts = int(record.attempts or 0) + 1
    if not verify_email_code_digest(email, purpose, cleaned_code, record.code_hash):
        db.commit()
        raise HTTPException(status_code=400, detail="Verification code is incorrect.")

    now = datetime.utcnow()
    record.consumed_at = now
    return record, now


def create_email_verification_token(record: EmailVerificationCode) -> str:
    expires_at = datetime.utcnow() + timedelta(seconds=EMAIL_VERIFICATION_TOKEN_TTL_SECONDS)
    payload = {
        "email": record.email,
        "purpose": record.purpose,
        "verification_id": record.id,
        "exp": int(expires_at.timestamp()),
    }
    encoded_payload = b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(email_verification_secret(), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{b64url_encode(signature)}"


def parse_email_verification_token(
    db: Session,
    token: str,
    *,
    expected_email: str,
    expected_purpose: str,
) -> EmailVerificationCode:
    try:
        encoded_payload, encoded_signature = str(token or "").split(".", 1)
        expected = hmac.new(email_verification_secret(), encoded_payload.encode("ascii"), hashlib.sha256).digest()
        actual = b64url_decode(encoded_signature)
        if not hmac.compare_digest(expected, actual):
            raise ValueError("signature mismatch")
        payload = json.loads(b64url_decode(encoded_payload).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, binascii.Error, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid email verification token.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid email verification token.")
    email = normalize_email(str(payload.get("email") or ""))
    purpose = normalize_verification_purpose(str(payload.get("purpose") or ""))
    exp = int(payload.get("exp") or 0)
    verification_id = int(payload.get("verification_id") or 0)
    if email != expected_email or purpose != expected_purpose:
        raise HTTPException(status_code=400, detail="Email verification does not match this account action.")
    if exp <= 0 or datetime.utcnow().timestamp() > exp:
        raise HTTPException(status_code=400, detail="Email verification expired. Request a new code.")

    record = db.query(EmailVerificationCode).filter(EmailVerificationCode.id == verification_id).first()
    if not record or record.email != email or record.purpose != purpose or not record.consumed_at:
        raise HTTPException(status_code=400, detail="Email verification has not been completed.")
    return record


def issue_user_session(db: Session, user: User) -> str:
    token = issue_session_token()
    db.add(UserSession(user_id=user.id, token=token))
    db.commit()
    return token


def decode_image_payload(image: Optional[ReportImagePayload], *, upload_subdir: Optional[str] = None) -> Optional[str]:
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
        upload_subdir=upload_subdir,
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


def normalize_upload_url_path(upload_path: Optional[str]) -> str:
    raw_path = str(upload_path or "").strip()
    if not raw_path:
        return ""
    if raw_path.startswith(("http://", "https://")):
        raw_path = urlparse(raw_path).path
    else:
        raw_path = raw_path.split("#", 1)[0].split("?", 1)[0]
    raw_path = raw_path.replace("\\", "/")
    raw_path = re.sub(r"/+", "/", raw_path)
    if raw_path.startswith("uploads/"):
        raw_path = f"/{raw_path}"
    if not raw_path.startswith("/uploads/"):
        return ""
    relative_path = raw_path[len("/uploads/"):]
    if not relative_path:
        return ""
    relative_parts = [part for part in relative_path.split("/") if part]
    if any(part in {".", ".."} for part in relative_parts):
        return ""
    return f"/uploads/{'/'.join(relative_parts)}"


def resolve_upload_path(upload_path: Optional[str]) -> Optional[Path]:
    raw_path = normalize_upload_url_path(upload_path)
    if not raw_path:
        return None

    if UPLOAD_STORAGE_BACKEND == "database":
        return materialize_database_upload(raw_path)

    absolute_path = (UPLOAD_DIR / raw_path[len("/uploads/"):]).resolve()
    try:
        absolute_path.relative_to(UPLOAD_DIR)
    except ValueError:
        report_logger.warning("Rejected upload cleanup outside uploads: %s", raw_path)
        return None
    return absolute_path


def delete_uploaded_path(upload_path: Optional[str]) -> None:
    if UPLOAD_STORAGE_BACKEND == "database":
        raw_path = normalize_upload_url_path(upload_path)
        if not raw_path:
            return
        db = SessionLocal()
        try:
            upload_object = db.query(UploadObject).filter(UploadObject.path == raw_path).first()
            if upload_object:
                db.delete(upload_object)
                db.commit()
        except Exception:
            db.rollback()
            report_logger.warning("Could not delete upload object: %s", upload_path, exc_info=True)
        finally:
            db.close()

        cache_path = database_upload_cache_path(raw_path)
        try:
            if cache_path and cache_path.exists():
                cache_path.unlink()
        except OSError:
            report_logger.warning("Could not delete upload cache path: %s", upload_path, exc_info=True)
        return

    absolute_path = resolve_upload_path(upload_path)
    if not absolute_path:
        return

    try:
        if absolute_path.exists():
            absolute_path.unlink()
    except OSError:
        report_logger.warning("Could not delete upload path: %s", upload_path, exc_info=True)


def item_upload_paths(item: LostFoundItem) -> list[str]:
    paths: list[str] = []
    for upload_path in [item.image_path, *item.evidence_images]:
        normalized_path = str(upload_path or "").strip()
        if normalized_path and normalized_path not in paths:
            paths.append(normalized_path)
    return paths


def sync_item_upload_references(item: LostFoundItem) -> None:
    existing_paths = [
        upload_path
        for upload_path in item_upload_paths(item)
        if (resolved_path := resolve_upload_path(upload_path)) and resolved_path.exists()
    ]
    item.image_path = item.image_path if item.image_path in existing_paths else None
    item.evidence_images = existing_paths


def cleanup_deleted_item_uploads(item_id: int, *, delay_seconds: int = SOFT_DELETE_UPLOAD_CLEANUP_DELAY_SECONDS) -> None:
    delay = max(0, int(delay_seconds or 0))
    if delay:
        time.sleep(delay)

    db = SessionLocal()
    try:
        item = db.query(LostFoundItem).filter(LostFoundItem.id == item_id).first()
        if not item or not item.deleted_at:
            return

        for upload_path in item_upload_paths(item):
            delete_uploaded_path(upload_path)

        sync_item_upload_references(item)
        db.commit()
    except Exception:
        db.rollback()
        report_logger.warning("Deferred upload cleanup failed for item_id=%s", item_id, exc_info=True)
    finally:
        db.close()


def latest_uploaded_image_path() -> Optional[Path]:
    if UPLOAD_STORAGE_BACKEND == "database":
        filters = [UploadObject.path.like(f"%{extension}") for extension in IMAGE_UPLOAD_EXTENSIONS]
        db = SessionLocal()
        try:
            upload_object = (
                db.query(UploadObject)
                .filter(or_(*filters))
                .order_by(UploadObject.created_at.desc())
                .first()
            )
            return materialize_database_upload(upload_object.path) if upload_object else None
        finally:
            db.close()

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


def safe_user_avatar_url(user: Optional[User]) -> str:
    avatar_path = str(user.avatar_path if user else "").strip()
    if not avatar_path:
        return ""
    normalized_avatar_path = normalize_upload_url_path(avatar_path)
    if not normalized_avatar_path:
        report_logger.warning(
            "[Profile] rejected malformed avatar path user_id=%s avatar_path=%s",
            getattr(user, "id", None),
            avatar_path,
        )
        return ""
    resolved_path = resolve_upload_path(normalized_avatar_path)
    if not resolved_path or not resolved_path.exists():
        report_logger.warning(
            "[Profile] avatar path unavailable user_id=%s avatar_path=%s",
            getattr(user, "id", None),
            avatar_path,
        )
        return ""
    ensure_upload_is_served_readable(resolved_path)
    return normalized_avatar_path


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


def mark_item_returned(item: LostFoundItem, *, claim_id: Optional[int] = None) -> None:
    item.claimed = True
    item.status = "Claimed"
    item.returned_at = item.returned_at or datetime.utcnow()
    item.returned_by_claim_id = claim_id


def clear_item_returned(item: LostFoundItem) -> None:
    item.returned_at = None
    item.returned_by_claim_id = None


def start_of_current_week_utc() -> datetime:
    now = datetime.utcnow()
    start = now - timedelta(days=now.weekday())
    return start.replace(hour=0, minute=0, second=0, microsecond=0)


def items_returned_this_week(db: Session) -> int:
    return (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.deleted_at.is_(None),
            LostFoundItem.returned_at.is_not(None),
            LostFoundItem.returned_at >= start_of_current_week_utc(),
        )
        .count()
    )


def _coerce_json_text(value: str) -> str:
    stripped = str(value or "").strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def parse_region_analysis(raw_response: str) -> dict[str, Any]:
    stripped = _coerce_json_text(raw_response)
    if not stripped:
        return {"description": "Selected area is unclear.", "tags": ["unclear"]}

    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        normalized = stripped[:180]
        tags = []
        for token in re.findall(r"[a-z0-9-]+", normalized.lower()):
            if len(token) < 3 or token in tags:
                continue
            tags.append(token)
            if len(tags) >= 5:
                break
        return {
            "description": normalized,
            "tags": tags or ["unclear"],
        }

    description = str(payload.get("description", "")).strip() if isinstance(payload, dict) else ""
    raw_tags = payload.get("tags", []) if isinstance(payload, dict) else []
    tags: list[str] = []
    if isinstance(raw_tags, list):
        for value in raw_tags:
            normalized = str(value).strip().lower()
            if normalized and normalized not in tags:
                tags.append(normalized)
    elif isinstance(raw_tags, str):
        for value in re.findall(r"[a-z0-9-]+", raw_tags.lower()):
            if value not in tags:
                tags.append(value)

    return {
        "description": description or "Selected area is unclear.",
        "tags": tags[:5] or ["unclear"],
    }


def validate_circle_selection(selection: CircleSelectionPayload) -> dict[str, float]:
    try:
        x = float(selection.x)
        y = float(selection.y)
        radius = float(selection.radius)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Circle selection requires x, y, and radius values.")
    if not 0.0 <= x <= 1.0 or not 0.0 <= y <= 1.0:
        raise HTTPException(status_code=400, detail="Selection coordinates must be normalized between 0 and 1.")
    if not 0.04 <= radius <= 0.48:
        raise HTTPException(status_code=400, detail="Selection radius must be between 0.04 and 0.48.")
    return {
        "x": round(x, 4),
        "y": round(y, 4),
        "radius": round(radius, 4),
    }


def _normalized_selection_type(selection: CircleSelectionPayload) -> str:
    return str(selection.type or "circle").strip().lower()


def _normalized_polygon_bounds(points: list[list[float]]) -> dict[str, float]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return {
        "left": round(min(xs), 4),
        "top": round(min(ys), 4),
        "right": round(max(xs), 4),
        "bottom": round(max(ys), 4),
    }


def validate_path_selection(selection: CircleSelectionPayload) -> dict[str, Any]:
    raw_points = selection.points or []
    if not isinstance(raw_points, list) or len(raw_points) < 3:
        raise HTTPException(status_code=400, detail="Freehand selection requires at least three points.")
    if len(raw_points) > 600:
        raise HTTPException(status_code=400, detail="Freehand selection has too many points.")

    normalized_points: list[list[float]] = []
    for raw_point in raw_points:
        if not isinstance(raw_point, (list, tuple)) or len(raw_point) < 2:
            raise HTTPException(status_code=400, detail="Freehand selection points must be coordinate pairs.")
        try:
            x = float(raw_point[0])
            y = float(raw_point[1])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Freehand selection points must be numeric.")
        if not 0.0 <= x <= 1.0 or not 0.0 <= y <= 1.0:
            raise HTTPException(status_code=400, detail="Freehand selection points must be normalized between 0 and 1.")
        rounded = [round(x, 4), round(y, 4)]
        if not normalized_points or normalized_points[-1] != rounded:
            normalized_points.append(rounded)

    if len(normalized_points) > 2 and normalized_points[0] == normalized_points[-1]:
        normalized_points.pop()
    if len(normalized_points) < 3:
        raise HTTPException(status_code=400, detail="Freehand selection requires at least three unique points.")

    bounds = _normalized_polygon_bounds(normalized_points)
    if bounds["right"] - bounds["left"] < 0.015 or bounds["bottom"] - bounds["top"] < 0.015:
        raise HTTPException(status_code=400, detail="Freehand selection is too small to analyze.")

    return {
        "type": "path",
        "points": normalized_points,
        "bounding_box": bounds,
    }


def validate_region_selection(selection: CircleSelectionPayload) -> dict[str, Any]:
    if _normalized_selection_type(selection) in {"path", "freehand", "polygon"}:
        return validate_path_selection(selection)
    return validate_circle_selection(selection)


def _resampling_filter() -> Any:
    resampling = getattr(Image, "Resampling", None) if Image is not None else None
    if resampling is not None and hasattr(resampling, "LANCZOS"):
        return resampling.LANCZOS
    return getattr(Image, "LANCZOS", getattr(Image, "ANTIALIAS", 1))


def analyze_item_region(item: LostFoundItem, selection: CircleSelectionPayload) -> dict[str, Any]:
    if Image is None or ImageDraw is None:
        raise HTTPException(status_code=415, detail="Image crop analysis requires Pillow image support.")
    if not item.image_path:
        raise HTTPException(status_code=400, detail="This item does not have an image to inspect.")

    source_path = resolve_upload_path(item.image_path)
    if not source_path or not source_path.exists():
        raise HTTPException(status_code=404, detail="The stored image for this item is missing.")

    normalized = validate_region_selection(selection)
    output_path = safe_upload_path(".png")
    try:
        with Image.open(source_path) as image:
            image.load()
            prepared = image.convert("RGBA")
            width, height = prepared.size
            if normalized.get("type") == "path":
                pixel_points = [
                    (point[0] * width, point[1] * height)
                    for point in normalized["points"]
                ]
                padding = max(6, int(min(width, height) * 0.012))
                left = max(0, math.floor(min(point[0] for point in pixel_points)) - padding)
                top = max(0, math.floor(min(point[1] for point in pixel_points)) - padding)
                right = min(width, math.ceil(max(point[0] for point in pixel_points)) + padding)
                bottom = min(height, math.ceil(max(point[1] for point in pixel_points)) + padding)
                cropped = prepared.crop((left, top, right, bottom))

                scale = 3
                mask_size = (max(1, cropped.size[0] * scale), max(1, cropped.size[1] * scale))
                mask = Image.new("L", mask_size, 0)
                draw = ImageDraw.Draw(mask)
                draw.polygon(
                    [
                        ((point[0] - left) * scale, (point[1] - top) * scale)
                        for point in pixel_points
                    ],
                    fill=255,
                )
                mask = mask.resize(cropped.size, _resampling_filter())
            else:
                center_x = int(width * normalized["x"])
                center_y = int(height * normalized["y"])
                radius_px = max(18, int(min(width, height) * normalized["radius"]))
                left = max(0, center_x - radius_px)
                top = max(0, center_y - radius_px)
                right = min(width, center_x + radius_px)
                bottom = min(height, center_y + radius_px)
                cropped = prepared.crop((left, top, right, bottom))

                mask = Image.new("L", cropped.size, 0)
                draw = ImageDraw.Draw(mask)
                draw.ellipse((0, 0, cropped.size[0] - 1, cropped.size[1] - 1), fill=255)

            output = Image.new("RGBA", cropped.size, (255, 255, 255, 255))
            output.paste(cropped, (0, 0), mask)
            output.save(output_path, format="PNG", optimize=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not analyze the selected image area.") from exc

    try:
        result = debug_image_request(
            str(output_path),
            item_label=f"claim-preview:{item.id}",
            prompt=CLAIM_PREVIEW_PROMPT,
            parse_inspection=False,
        )
        analysis = parse_region_analysis(result.get("raw_response", ""))
        return {
            "selection": normalized,
            "description": analysis["description"],
            "tags": analysis["tags"],
            "bounding_box": {
                "left": left,
                "top": top,
                "right": right,
                "bottom": bottom,
            },
        }
    except HTTPException:
        raise
    except Exception:
        fallback_text = item.room_label or item.title or "selected area"
        return {
            "selection": normalized,
            "description": f"Selected area from {fallback_text}.",
            "tags": item.tags[:4] or ["unclear"],
            "bounding_box": {
                "left": left,
                "top": top,
                "right": right,
                "bottom": bottom,
            },
            "inferred": True,
        }
    finally:
        if output_path.exists():
            output_path.unlink()


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


def minimally_validate_field(value: str, field_label: str, *, min_meaningful_chars: int, max_chars: int) -> str:
    cleaned = clean_text(value)
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_label} is required.")
    if len(cleaned) > max_chars:
        raise HTTPException(status_code=400, detail=f"{field_label} must be {max_chars} characters or fewer.")
    if len(re.findall(r"[^\W_]", cleaned, re.UNICODE)) < min_meaningful_chars:
        raise HTTPException(status_code=400, detail=f"{field_label} is too short.")
    return cleaned


def should_block_claim_moderation(decision: dict) -> bool:
    if decision.get("allowed", False):
        return False
    reason = clean_text(str(decision.get("reason", ""))).lower()
    return any(hint in reason for hint in CLAIM_MODERATION_BLOCK_HINTS)


def moderate_claim_submission(
    db: Session,
    *,
    current_user: Optional[User],
    route: str,
    input_text: str,
) -> dict:
    decision = classify_user_input(input_text)
    blocked = should_block_claim_moderation(decision)
    normalized_decision = dict(decision)
    if not blocked:
        normalized_decision["allowed"] = True
        normalized_decision["reason"] = str(decision.get("reason", "")).strip() or "Accepted: claim input allowed unless clearly invalid."

    log_ai_inspection(
        db,
        current_user=current_user,
        route=route,
        input_text=input_text,
        decision=normalized_decision,
        feature="moderation",
        model_name=AI_MODEL,
        model_size=model_size_label(AI_MODEL),
        fallback_triggered=bool(decision.get("fallback_triggered")),
        request_metadata={"route": route, "mode": "lenient-claim"},
    )
    return normalized_decision


def ensure_submission_allowed(db: Session, current_user: User) -> None:
    if not user_can_create_content(current_user):
        raise HTTPException(status_code=403, detail="Student accounts cannot create reports.")

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


QUERY_GIBBERISH_PATTERNS = (
    re.compile(r"(.)\1{7,}", re.IGNORECASE),
    re.compile(r"^[^\w]*$", re.UNICODE),
    re.compile(r"\b(?:skibidi|gyatt|fanum|brainrot|sussy)\b", re.IGNORECASE),
    re.compile(r"https?://|www\.", re.IGNORECASE),
)


def obvious_bad_query_reason(value: str) -> str:
    cleaned = clean_text(value)
    lowered_words = set(re.findall(r"[a-z']+", cleaned.lower()))
    if lowered_words & BLOCKED_WORDS:
        return "Message rejected due to inappropriate content."
    if any(pattern.search(cleaned) for pattern in QUERY_GIBBERISH_PATTERNS):
        return "Message rejected because it looks like spam or gibberish."
    tokens = re.findall(r"\w+", cleaned, re.UNICODE)
    if len(tokens) >= 5 and len(set(token.lower() for token in tokens)) <= 1:
        return "Message rejected because it looks repetitive."
    return ""


def enforce_lenient_query_moderation(
    db: Session,
    *,
    current_user: User,
    route: str,
    input_text: str,
) -> dict:
    reason = obvious_bad_query_reason(input_text)
    if reason:
        log_blocked_attempt(route=route, current_user=current_user, reason=reason, content=input_text)
        raise HTTPException(status_code=400, detail=reason)

    decision = classify_user_input(input_text)
    model_reason = str(decision.get("reason", "")).lower()
    model_block_is_obvious = (
        not decision.get("allowed", False)
        and any(keyword in model_reason for keyword in ("blocked", "spam", "gibberish", "offensive", "inappropriate", "threat", "abusive"))
    )
    if model_block_is_obvious:
        log_blocked_attempt(
            route=route,
            current_user=current_user,
            reason=str(decision.get("reason", "Message rejected due to content policy.")),
            content=input_text,
        )
        raise HTTPException(status_code=400, detail="Message rejected due to content policy.")

    if not decision.get("allowed", False):
        try:
            confidence = min(float(decision.get("confidence", 0.0) or 0.0), 0.5)
        except (TypeError, ValueError):
            confidence = 0.5
        decision = {
            **decision,
            "allowed": True,
            "reason": "Allowed by lenient query policy.",
            "confidence": confidence,
        }

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
        request_metadata={"route": route, "mode": "lenient-query"},
    )
    return decision


def normalize_question_type(value: str) -> str:
    normalized = str(value or "").strip().lower().replace("-", "_")
    return normalized if normalized in QUESTION_TYPES else "lost_not_listed"


def normalize_question_reply_type(value: str) -> str:
    normalized = str(value or "").strip().lower().replace("-", "_")
    return normalized if normalized in QUESTION_REPLY_TYPES else "reply"


def enforce_structured_question_intent(message: str, *, item_scoped: bool = False) -> None:
    lowered = clean_text(message).lower()
    if re.search(r"\b(?:hello|hi|joke|weather|homework|assignment|movie|song|game|chat|how\s+are\s+you)\b", lowered):
        raise HTTPException(
            status_code=400,
            detail="Question Board accepts lost-item lookup questions only.",
        )
    allowed_patterns = (
        r"\bdid\s+anyone\s+(?:see|find|pick\s+up|notice)\b",
        r"\bhas\s+(?:this|it|my|anyone)\b.*\bfound\b",
        r"\b(?:i\s+)?lost\b",
        r"\b(?:missing|misplaced|looking\s+for|not\s+listed)\b",
        r"\b(?:found|reported)\b.*\b(?:item|phone|bottle|bag|wallet|keys?|laptop|card|uniform|book)\b",
    )
    item_scoped_patterns = (
        r"\b(?:this|item|report|still|available|found|where|location)\b",
    )
    if any(re.search(pattern, lowered) for pattern in allowed_patterns):
        return
    if item_scoped and any(re.search(pattern, lowered) for pattern in item_scoped_patterns):
        return
    tokens = re.findall(r"[a-z0-9]+", lowered)
    if 1 <= len(tokens) <= 12:
        return
    raise HTTPException(
        status_code=400,
        detail="Question Board accepts lost-item lookup questions only.",
    )


def structured_query_matches(db: Session, query_text: str, *, limit: int = 8) -> list[dict[str, Any]]:
    candidates = (
        db.query(LostFoundItem)
        .filter(LostFoundItem.deleted_at.is_(None), LostFoundItem.returned_at.is_(None))
        .order_by(LostFoundItem.created_at.desc())
        .all()
    )
    scored_items = [
        (item, score_item_for_query(item, query_text))
        for item in candidates
    ]
    return [
        assistant_match_payload(item, score)
        for item, score in sorted(
            scored_items,
            key=lambda value: (value[1], value[0].created_at or datetime.min),
            reverse=True,
        )[:limit]
        if score > 0
    ]


def matching_public_questions(db: Session, query_text: str, *, exclude_question_id: Optional[int] = None, limit: int = 6) -> list[dict[str, Any]]:
    normalized = clean_text(query_text).lower()
    tokens = set(re.findall(r"[a-z0-9]+", normalized))
    if not tokens:
        return []
    questions = db.query(QuestionPost).order_by(QuestionPost.created_at.desc()).limit(80).all()
    scored: list[tuple[QuestionPost, int]] = []
    for question in questions:
        if exclude_question_id and question.id == exclude_question_id:
            continue
        source = " ".join([question.question_text or "", question.location_hint or ""]).lower()
        source_tokens = set(re.findall(r"[a-z0-9]+", source))
        score = len(tokens & source_tokens) * 12
        if normalized and normalized in source:
            score += 30
        if score > 0:
            scored.append((question, score))
    authors = get_user_map(db, [question.user_id for question, _score in scored])
    return [
        {
            **serialize_question_post(db, question, authors.get(question.user_id), include_replies=False),
            "score": score,
        }
        for question, score in sorted(
            scored,
            key=lambda value: (value[1], value[0].created_at or datetime.min),
            reverse=True,
        )[:limit]
    ]


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
        "reporter_avatar_url": safe_user_avatar_url(reporter),
        "submitted_by_user_id": item.submitted_by_user_id,
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
        "claim_required": bool(item.claim_required),
        "is_room_item": bool(item.is_room_item),
        "room_label": item.room_label or "",
        "room_recorded_at": item.room_recorded_at.isoformat() if item.room_recorded_at else None,
        "returned_at": item.returned_at.isoformat() if item.returned_at else None,
        "returned_by_claim_id": item.returned_by_claim_id,
        "tags": item.tags,
        "ai_summary": item.ai_summary,
        "tag_source": item.tag_source,
        "llava_analysis": item.llava_analysis,
        "ai_analysis_status": item.ai_analysis_status or AI_ANALYSIS_SUCCESS,
        "unverified_ai_analysis": bool(item.unverified_ai_analysis),
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
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_map_region(region: MapRegion) -> dict[str, Any]:
    return {
        "id": region.id,
        "label": region.label,
        "zone": region.zone,
        "x": float(region.x),
        "y": float(region.y),
        "width": float(region.width),
        "height": float(region.height),
    }


def serialize_location_interaction_region(region: dict[str, Any]) -> dict[str, Any]:
    region_type = str(region.get("type") or "zone").strip().lower()
    if region_type not in {"zone", "text"}:
        region_type = "zone"

    def unit_value(key: str, fallback: float = 0.0) -> float:
        try:
            value = float(region.get(key, fallback))
        except (TypeError, ValueError):
            value = fallback
        return max(0.0, min(1.0, value))

    x = unit_value("x")
    y = unit_value("y")
    width = min(1.0 - x, max(0.001, unit_value("width", 0.04)))
    height = min(1.0 - y, max(0.001, unit_value("height", 0.04)))
    return {
        "id": str(region.get("id") or ""),
        "label": str(region.get("label") or ""),
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "points": [],
        "shape": "box",
        "type": region_type,
    }


def serialize_school_sub_location(sub_location: dict[str, Any]) -> dict[str, str]:
    return {
        "id": str(sub_location.get("id") or sub_location.get("label") or "").strip(),
        "label": str(sub_location.get("label") or sub_location.get("id") or "").strip(),
    }


def serialize_school_floor(floor: dict[str, Any]) -> dict[str, Any]:
    sub_locations = floor.get("sub_locations")
    if not isinstance(sub_locations, list):
        sub_locations = []
    return {
        "id": str(floor.get("id") or floor.get("label") or "").strip(),
        "label": str(floor.get("label") or floor.get("id") or "").strip(),
        "sub_locations": [
            serialize_school_sub_location(sub_location)
            for sub_location in sub_locations
            if isinstance(sub_location, dict)
        ],
    }


def serialize_school_location(location: dict[str, Any]) -> dict[str, Any]:
    sub_locations = location.get("sub_locations")
    if not isinstance(sub_locations, list):
        sub_locations = []
    floors = location.get("floors")
    if not isinstance(floors, list):
        floors = location.get("floor_definitions")
    if not isinstance(floors, list):
        floors = []
    interaction_regions = location.get("interaction_regions")
    if not isinstance(interaction_regions, list):
        interaction_regions = []
    return {
        "id": str(location.get("id") or ""),
        "name": str(location.get("name") or ""),
        "label": str(location.get("label") or location.get("name") or ""),
        "x": float(location.get("x") or 0),
        "y": float(location.get("y") or 0),
        "metadata": location.get("metadata") if isinstance(location.get("metadata"), dict) else {},
        "sub_locations": [
            serialize_school_sub_location(sub_location)
            for sub_location in sub_locations
            if isinstance(sub_location, dict)
        ],
        "floors": [
            serialize_school_floor(floor)
            for floor in floors
            if isinstance(floor, dict)
        ],
        "interaction_regions": [
            serialize_location_interaction_region(region)
            for region in interaction_regions
            if isinstance(region, dict)
        ],
    }


def validate_map_region_payload(payload: MapRegionPayload) -> dict[str, Any]:
    label = minimally_validate_field(payload.label, "Region label", min_meaningful_chars=2, max_chars=80)
    zone = clean_text(payload.zone)
    if zone not in FIXED_SCHOOL_ZONES:
        raise HTTPException(status_code=400, detail="Region zone must be one of the fixed school zones.")

    values = {
        "x": payload.x,
        "y": payload.y,
        "width": payload.width,
        "height": payload.height,
    }
    normalized: dict[str, float] = {}
    for field_name, raw_value in values.items():
        try:
            number_value = float(raw_value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"{field_name} must be a number.") from None
        if not math.isfinite(number_value):
            raise HTTPException(status_code=400, detail=f"{field_name} must be a finite number.")
        if number_value < 0 or number_value > 1:
            raise HTTPException(status_code=400, detail=f"{field_name} must be between 0 and 1.")
        normalized[field_name] = number_value

    if normalized["width"] <= 0 or normalized["height"] <= 0:
        raise HTTPException(status_code=400, detail="Region width and height must be greater than 0.")
    if normalized["x"] + normalized["width"] > 1.000001 or normalized["y"] + normalized["height"] > 1.000001:
        raise HTTPException(status_code=400, detail="Region must stay inside the map image.")

    return {
        "label": label,
        "zone": zone,
        **normalized,
    }


def map_region_path(region: MapRegion | dict[str, Any]) -> str:
    zone = region["zone"] if isinstance(region, dict) else region.zone
    label = region["label"] if isinstance(region, dict) else region.label
    return f"{zone} > {label}"


def item_is_active_map_item(item: LostFoundItem) -> bool:
    return not bool(item.claimed) and item.returned_at is None and item.deleted_at is None


def item_recent_for_map(item: LostFoundItem) -> bool:
    timestamp = item.updated_at or item.created_at
    return bool(timestamp and timestamp >= datetime.utcnow() - timedelta(days=7))


def map_item_sources(item: LostFoundItem) -> list[str]:
    return [
        item.location or "",
        item.secondary_location or "",
        f"{item.secondary_location or ''} > {item.location or ''}",
    ]


def map_item_location_infos(item: LostFoundItem) -> list[dict[str, Any]]:
    infos: list[dict[str, Any]] = []
    for source in list(dict.fromkeys(map_item_sources(item))):
        context_location_id = location_context_id_from_values(source)
        for code in school_location_code_candidates(source):
            parsed = parse_school_location_code(code, context_location_id)
            if not parsed:
                continue
            infos.append({
                "location_id": parsed["location_id"],
                "location_name": parsed["name"],
                "floor_number": parsed["floor_number"],
                "sub_location_label": "",
            })

        known_location = canonical_known_location(source)
        if not known_location:
            continue
        value, parent_name = known_location
        parent = school_location_by_label(parent_name)
        if not parent:
            continue
        infos.append({
            "location_id": parent.get("id"),
            "location_name": parent.get("name"),
            "floor_number": floor_number_from_label(value),
            "sub_location_label": value if any(
                sub_location_matches_label(sub_location, value)
                for sub_location in direct_sub_locations_for_location(parent)
            ) else "",
        })

    deduped: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    for info in infos:
        key = (
            info.get("location_id"),
            info.get("floor_number"),
            normalize_location_text(info.get("sub_location_label") or ""),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(info)
    return deduped


def item_matches_map_region(item: LostFoundItem, region: MapRegion) -> bool:
    label = normalize_search_text(region.label)
    zone = normalize_search_text(region.zone)
    path = normalize_search_text(map_region_path(region))
    if not label:
        return False
    sources = [normalize_search_text(source) for source in map_item_sources(item)]
    matching_zone = school_location_by_label(region.zone)
    if matching_zone and any(
        info.get("location_id") == matching_zone.get("id")
        and normalize_location_text(info.get("sub_location_label") or "") == normalize_location_text(region.label)
        for info in map_item_location_infos(item)
    ):
        return True
    if any(path and path in source for source in sources):
        return True
    if not any(label in source for source in sources):
        return False
    secondary = normalize_search_text(item.secondary_location or "")
    location = normalize_search_text(item.location or "")
    return not secondary or zone in secondary or zone in location


def item_matches_map_zone(item: LostFoundItem, zone: str, regions: list[MapRegion]) -> bool:
    normalized_zone = normalize_search_text(zone)
    matching_location = school_location_by_label(zone)
    if matching_location and any(
        info.get("location_id") == matching_location.get("id")
        for info in map_item_location_infos(item)
    ):
        return True
    sources = [normalize_search_text(source) for source in map_item_sources(item)]
    if normalized_zone and any(normalized_zone in source for source in sources):
        return True
    return any(region.zone == zone and item_matches_map_region(item, region) for region in regions)


def build_map_item_stats(db: Session, regions: list[MapRegion]) -> dict[str, Any]:
    items = (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.deleted_at.is_(None),
            LostFoundItem.is_room_item.is_(False),
        )
        .all()
    )
    region_stats = {
        region.id: {
            "item_count": 0,
            "lost_count": 0,
            "recent_count": 0,
            "recent_activity": False,
        }
        for region in regions
    }
    zone_stats = {
        zone: {
            "item_count": 0,
            "lost_count": 0,
            "recent_count": 0,
            "recent_activity": False,
        }
        for zone in FIXED_SCHOOL_ZONES
    }
    location_stats = {
        location["id"]: {
            "item_count": 0,
            "lost_count": 0,
            "recent_count": 0,
            "recent_activity": False,
        }
        for location in SCHOOL_LOCATION_DATA
    }

    for item in items:
        if not item_is_active_map_item(item):
            continue
        is_lost = (item.report_type or "").lower() == "lost"
        is_recent = item_recent_for_map(item)

        for region in regions:
            if not item_matches_map_region(item, region):
                continue
            stats = region_stats[region.id]
            stats["item_count"] += 1
            stats["lost_count"] += 1 if is_lost else 0
            stats["recent_count"] += 1 if is_recent else 0
            stats["recent_activity"] = stats["recent_activity"] or is_recent

        matching_zones = {zone for zone in FIXED_SCHOOL_ZONES if item_matches_map_zone(item, zone, regions)}
        for zone in matching_zones:
            stats = zone_stats[zone]
            stats["item_count"] += 1
            stats["lost_count"] += 1 if is_lost else 0
            stats["recent_count"] += 1 if is_recent else 0
            stats["recent_activity"] = stats["recent_activity"] or is_recent
            location_id = next(
                (location["id"] for location in SCHOOL_LOCATION_DATA if location["name"] == zone),
                None,
            )
            if location_id and location_id in location_stats:
                location_stats[location_id]["item_count"] += 1
                location_stats[location_id]["lost_count"] += 1 if is_lost else 0
                location_stats[location_id]["recent_count"] += 1 if is_recent else 0
                location_stats[location_id]["recent_activity"] = (
                    location_stats[location_id]["recent_activity"] or is_recent
                )

    return {
        "regions": region_stats,
        "zones": zone_stats,
        "locations": location_stats,
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
        "email": user.email or "",
        "email_verified": user_email_is_verified(user),
        "email_verified_at": user.email_verified_at.isoformat() if user.email_verified_at else None,
        "role": user_role(user),
        "auto_detected_role": normalize_optional_user_role(user.auto_detected_role) or USER_ROLE_TEACHER,
        "assigned_role": normalize_optional_user_role(user.assigned_role),
        "role_source": "assigned" if normalize_optional_user_role(user.assigned_role) else "auto",
        "school_account": email_is_school_account(user.email or ""),
        "auth_provider": user.auth_provider or "password",
        "initials": user.initials,
        "class_of": user.class_of,
        "identity": user_identity(user),
        "is_admin": bool(user.is_admin),
        "avatar_url": safe_user_avatar_url(user),
        "preferred_language": normalize_language(user.preferred_language),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
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
        "visual_selection": parse_json_object(claim.visual_selection_json, default={}),
        "visual_summary": claim.visual_summary or "",
        "visual_tags": parse_json_list(claim.visual_tags_json),
        "status": claim.status,
        "timestamp": claim.created_at.isoformat() if claim.created_at else None,
        "updated_at": claim.updated_at.isoformat() if claim.updated_at else None,
        "item": serialize_item(item, reporter),
    }


def serialize_claim_draft(
    draft: ClaimDraft,
    item: Optional[LostFoundItem],
    claimant: Optional[User],
    reporter: Optional[User],
) -> dict:
    return {
        "id": f"draft-{draft.id}",
        "draft_id": draft.id,
        "item_id": draft.item_id,
        "user_id": draft.user_id,
        "user_identity": user_identity(claimant),
        "title": draft.title or (item.title if item else ""),
        "claim_reason": draft.claim_reason,
        "item_description": draft.item_description,
        "lost_location": draft.lost_location,
        "identifying_info": draft.identifying_info,
        "visual_selection": parse_json_object(draft.visual_selection_json, default={}),
        "visual_summary": draft.visual_summary or "",
        "visual_tags": parse_json_list(draft.visual_tags_json),
        "status": draft.status or "draft",
        "source": draft.source or "manual",
        "submitted_claim_id": draft.submitted_claim_id,
        "timestamp": draft.created_at.isoformat() if draft.created_at else None,
        "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
        "is_draft": True,
        "item": serialize_item(item, reporter) if item else None,
    }


def serialize_returned_dispute(
    dispute: ReturnedItemDispute,
    item: LostFoundItem,
    user: Optional[User],
    reporter: Optional[User],
) -> dict:
    return {
        "id": dispute.id,
        "item_id": dispute.item_id,
        "user_id": dispute.user_id,
        "user_identity": user_identity(user),
        "reason": dispute.reason,
        "status": dispute.status,
        "created_at": dispute.created_at.isoformat() if dispute.created_at else None,
        "updated_at": dispute.updated_at.isoformat() if dispute.updated_at else None,
        "item": serialize_item(item, reporter) if item else None,
    }


def serialize_admin_user(db: Session, user: User) -> dict:
    trust = calculate_user_trust_score(db, user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "email_verified": user_email_is_verified(user),
        "role": user_role(user),
        "auto_detected_role": normalize_optional_user_role(user.auto_detected_role) or USER_ROLE_TEACHER,
        "assigned_role": normalize_optional_user_role(user.assigned_role),
        "role_source": "assigned" if normalize_optional_user_role(user.assigned_role) else "auto",
        "email_verified_at": user.email_verified_at.isoformat() if user.email_verified_at else None,
        "school_account": email_is_school_account(user.email or ""),
        "auth_provider": user.auth_provider or "password",
        "initials": user.initials,
        "class_of": user.class_of,
        "identity": user_identity(user),
        "is_admin": bool(user.is_admin),
        "avatar_url": safe_user_avatar_url(user),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
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
        "avatar_url": "" if role == "system" else safe_user_avatar_url(author),
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


def serialize_question_reply(reply: QuestionReply, author: Optional[User]) -> dict:
    return {
        "id": reply.id,
        "question_id": reply.question_id,
        "user_id": reply.user_id,
        "user_identity": user_identity(author),
        "avatar_url": safe_user_avatar_url(author),
        "message": reply.message,
        "reply_type": reply.reply_type or "reply",
        "suggested_item_id": reply.suggested_item_id,
        "attachment": {
            "name": reply.attachment_name or "",
            "url": reply.attachment_path or "",
            "size": int(reply.attachment_size or 0),
            "content_type": reply.attachment_mime_type or "",
        } if reply.attachment_path else None,
        "created_at": reply.created_at.isoformat() if reply.created_at else None,
    }


def serialize_question_post(
    db: Session,
    question: QuestionPost,
    author: Optional[User],
    *,
    include_replies: bool = False,
) -> dict:
    reply_count = db.query(QuestionReply).filter(QuestionReply.question_id == question.id).count()
    payload = {
        "id": question.id,
        "user_id": question.user_id,
        "user_identity": user_identity(author),
        "avatar_url": safe_user_avatar_url(author),
        "question_text": question.question_text,
        "question_type": question.question_type or "lost_not_listed",
        "location_hint": question.location_hint or "",
        "language": normalize_language(question.language),
        "attachment": {
            "name": question.attachment_name or "",
            "url": question.attachment_path or "",
            "size": int(question.attachment_size or 0),
            "content_type": question.attachment_mime_type or "",
        } if question.attachment_path else None,
        "reply_count": int(reply_count or 0),
        "direct_chat_thread_id": question.direct_chat_thread_id or "",
        "direct_chat_started_at": question.direct_chat_started_at.isoformat() if question.direct_chat_started_at else None,
        "created_at": question.created_at.isoformat() if question.created_at else None,
        "updated_at": question.updated_at.isoformat() if question.updated_at else None,
    }
    if include_replies:
        replies = (
            db.query(QuestionReply)
            .filter(QuestionReply.question_id == question.id)
            .order_by(QuestionReply.created_at.asc(), QuestionReply.id.asc())
            .all()
        )
        authors = get_user_map(db, [reply.user_id for reply in replies])
        payload["replies"] = [serialize_question_reply(reply, authors.get(reply.user_id)) for reply in replies]
    return payload


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


def fetch_claim_draft_or_404(db: Session, draft_id: int, *, current_user: User) -> ClaimDraft:
    draft = (
        db.query(ClaimDraft)
        .filter(ClaimDraft.id == draft_id, ClaimDraft.user_id == current_user.id)
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Claim draft not found.")
    return draft


def fetch_question_or_404(db: Session, question_id: int) -> QuestionPost:
    question = db.query(QuestionPost).filter(QuestionPost.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")
    return question


def get_query_messages_for_scope(
    db: Session,
    *,
    user_id: int,
    item_id: Optional[int],
    include_all_users: bool = False,
) -> list[QueryMessage]:
    query = db.query(QueryMessage).filter(QueryMessage.role != "system")
    if not include_all_users:
        query = query.filter(QueryMessage.user_id == user_id)
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


def blocked_response(reason: str):
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


SENSITIVE_LOG_KEYS = {
    "authorization",
    "content",
    "data",
    "image",
    "password",
    "raw",
    "secret",
    "token",
}


def truncate_debug_text(value: str, limit: int = REQUEST_DEBUG_PAYLOAD_MAX_CHARS) -> str:
    if limit <= 0:
        return ""
    if len(value) <= limit:
        return value
    return f"{value[:limit]}...<truncated {len(value) - limit} chars>"


def scrub_debug_payload(value: Any, key: str = "") -> Any:
    lowered_key = key.lower()
    if lowered_key in SENSITIVE_LOG_KEYS:
        if isinstance(value, str):
            return f"<redacted {len(value)} chars>"
        if isinstance(value, (bytes, bytearray)):
            return f"<redacted {len(value)} bytes>"
        return "<redacted>"

    if isinstance(value, dict):
        return {str(child_key): scrub_debug_payload(child_value, str(child_key)) for child_key, child_value in value.items()}

    if isinstance(value, list):
        return [scrub_debug_payload(item, key) for item in value[:20]]

    if isinstance(value, str):
        return truncate_debug_text(value)

    return value


def summarize_debug_payload(body: bytes, content_type: str, *, truncated: bool, content_length: Optional[int]) -> Any:
    if not body and not content_length:
        return ""

    lowered_content_type = content_type.lower()
    if "multipart/form-data" in lowered_content_type:
        return {
            "content_type": "multipart/form-data",
            "captured_bytes": len(body),
            "content_length": content_length,
            "truncated": truncated,
        }

    if "application/json" in lowered_content_type:
        try:
            parsed = json.loads(body.decode("utf-8", errors="replace") or "{}")
            return scrub_debug_payload(parsed)
        except json.JSONDecodeError:
            pass

    decoded = body.decode("utf-8", errors="replace")
    payload = truncate_debug_text(decoded)
    return {
        "content_type": content_type or "unknown",
        "captured": payload,
        "content_length": content_length,
        "truncated": truncated,
    }


def format_debug_payload(payload: Any) -> str:
    if isinstance(payload, str):
        return payload
    try:
        return json.dumps(payload, ensure_ascii=False, sort_keys=True)
    except (TypeError, ValueError):
        return str(payload)


@app.middleware("http")
async def enforce_request_size_limit(request: Request, call_next):
    content_length = request.headers.get("content-length")
    parsed_content_length: Optional[int] = None
    if content_length:
        try:
            parsed_content_length = int(content_length)
            if parsed_content_length > MAX_REQUEST_SIZE:
                security_log(
                    "request_size_blocked",
                    level=logging.WARNING,
                    route=request.url.path,
                    client_ip=get_client_ip(request),
                    content_length=parsed_content_length,
                )
                if REQUEST_DEBUG_LOGGING:
                    request_debug_logger.warning(
                        "request method=%s path=%s query=%s status=%s duration_ms=%s payload=%s",
                        request.method,
                        request.url.path,
                        request.url.query,
                        413,
                        0,
                        format_debug_payload({
                            "content_length": parsed_content_length,
                            "blocked": "request body exceeds limit",
                        }),
                    )
                return JSONResponse(status_code=413, content={"detail": "Request body exceeds the 5 MB limit."})
        except ValueError:
            pass

    received_bytes = 0
    captured_body = bytearray()
    captured_truncated = False
    capture_limit = max(0, REQUEST_DEBUG_PAYLOAD_MAX_CHARS * 4)
    original_receive = request.receive
    replay_messages: list[dict[str, Any]] = []

    while True:
        message = await original_receive()
        replay_messages.append(message)
        if message["type"] == "http.request":
            body = message.get("body", b"")
            received_bytes += len(body)
            if REQUEST_DEBUG_LOGGING and body and capture_limit:
                remaining = capture_limit - len(captured_body)
                if remaining > 0:
                    captured_body.extend(body[:remaining])
                if len(body) > remaining:
                    captured_truncated = True
            if received_bytes > MAX_REQUEST_SIZE:
                security_log(
                    "streaming_request_size_blocked",
                    level=logging.WARNING,
                    route=request.url.path,
                    client_ip=get_client_ip(request),
                    received_bytes=received_bytes,
                )
                if REQUEST_DEBUG_LOGGING:
                    request_debug_logger.warning(
                        "request method=%s path=%s query=%s status=%s duration_ms=%s payload=%s",
                        request.method,
                        request.url.path,
                        request.url.query,
                        413,
                        0,
                        format_debug_payload({
                            "received_bytes": received_bytes,
                            "blocked": "request body exceeds limit",
                        }),
                    )
                return JSONResponse(status_code=413, content={"detail": "Request body exceeds the 5 MB limit."})
            if not message.get("more_body", False):
                break
        elif message["type"] == "http.disconnect":
            break

    async def replay_receive():
        if replay_messages:
            return replay_messages.pop(0)
        return {"type": "http.request", "body": b"", "more_body": False}

    request._receive = replay_receive
    _increment_active_requests()
    started_at = time.perf_counter()
    status_code: Any = "error"
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        _decrement_active_requests()
        if REQUEST_DEBUG_LOGGING:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            payload = summarize_debug_payload(
                bytes(captured_body),
                request.headers.get("content-type", ""),
                truncated=captured_truncated,
                content_length=parsed_content_length,
            )
            request_debug_logger.info(
                "request method=%s path=%s query=%s status=%s duration_ms=%s payload=%s",
                request.method,
                request.url.path,
                request.url.query,
                status_code,
                duration_ms,
                format_debug_payload(payload),
            )


@app.exception_handler(HTTPException)
async def handle_http_exception(request: Request, exc: HTTPException):
    content: dict[str, Any]
    if isinstance(exc.detail, dict):
        content = {"detail": exc.detail.get("message") or exc.detail.get("detail") or "Request failed."}
        if "retry_after" in exc.detail:
            content["retry_after"] = exc.detail["retry_after"]
    else:
        content = {"detail": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception):
    security_log(
        "unhandled_exception",
        level=logging.ERROR,
        route=request.url.path,
        client_ip=get_client_ip(request),
        error=str(exc),
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


def reject_blocked_request(*, route: str, current_user: Optional[User], reason: str, content: str):
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
        if action_label == "approved" and recipient_id == claim.user_id:
            message = (
                f'Your claim for "{item.title}" was approved. '
                f"Please collect the item at {LOST_FOUND_ROOM_LABEL}."
            )
        elif action_label == "approved":
            message = f'A claim for "{item.title}" was approved. The item is marked as returned.'
        elif recipient_id == claim.user_id:
            message = f'Your claim for "{item.title}" was rejected.'
        else:
            message = f'A claim for "{item.title}" was rejected.'
        create_notification(
            db,
            user_id=recipient_id,
            event_type=f"claim_{action_label}",
            title=f"Claim {action_label}",
            message=message,
            related_item_id=item.id,
            related_claim_id=claim.id,
        )


def notify_claim_submitted(db: Session, *, item: LostFoundItem, claim: Claim, claimant: User) -> None:
    recipients = set(admin_user_ids(db, exclude_user_id=claimant.id))
    if item.submitted_by_user_id and item.submitted_by_user_id != claimant.id:
        recipients.add(item.submitted_by_user_id)
    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            event_type="claim_submitted",
            title="New claim received",
            message=f'{claimant.username} submitted a claim for "{item.title}".',
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


def notify_query_interaction(db: Session, *, item: LostFoundItem, actor: User) -> None:
    recipients = set(admin_user_ids(db, exclude_user_id=actor.id))
    if item.submitted_by_user_id and item.submitted_by_user_id != actor.id:
        recipients.add(item.submitted_by_user_id)
    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            event_type="query_interaction",
            title="New report interaction",
            message=f'{actor.username} sent a new question about "{item.title}".',
            related_item_id=item.id,
        )


def notify_question_reply(db: Session, *, question: QuestionPost, reply: QuestionReply, actor: User) -> None:
    if question.user_id == actor.id:
        return
    create_notification(
        db,
        user_id=question.user_id,
        event_type="question_reply",
        title="New reply on your question",
        message=f'{actor.username} replied to "{question.question_text[:80]}".',
        related_question_id=question.id,
    )


def notify_dispute_submitted(db: Session, *, item: LostFoundItem, dispute: ReturnedItemDispute, actor: User) -> None:
    recipients = set(admin_user_ids(db, exclude_user_id=actor.id))
    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            event_type="returned_dispute",
            title="Returned item dispute",
            message=f'{actor.username} disputed the return of "{item.title}".',
            related_item_id=item.id,
        )


def notify_potential_match(
    db: Session,
    *,
    recipient_user_id: int,
    item: LostFoundItem,
    matching_item: LostFoundItem,
) -> None:
    create_notification(
        db,
        user_id=recipient_user_id,
        event_type="potential_match",
        title="Potential match found",
        message=f'"{matching_item.title}" may match your report "{item.title}".',
        related_item_id=matching_item.id,
    )


def maybe_notify_potential_matches(db: Session, *, item: LostFoundItem) -> None:
    if item.deleted_at:
        return

    if item.is_room_item:
        candidates = (
            db.query(LostFoundItem)
            .filter(
                LostFoundItem.id != item.id,
                LostFoundItem.deleted_at.is_(None),
                LostFoundItem.is_room_item.is_(False),
                LostFoundItem.claimed.is_(False),
                LostFoundItem.submitted_by_user_id.is_not(None),
            )
            .all()
        )
        notified_users: set[int] = set()
        for candidate in candidates:
            if not candidate.submitted_by_user_id or candidate.submitted_by_user_id in notified_users:
                continue
            score = score_item_for_query(item, build_input_text(candidate.title, candidate.description, candidate.category))
            if score >= 80:
                notify_potential_match(
                    db,
                    recipient_user_id=candidate.submitted_by_user_id,
                    item=candidate,
                    matching_item=item,
                )
                notified_users.add(candidate.submitted_by_user_id)
        return

    if not item.submitted_by_user_id:
        return

    room_candidates = (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.id != item.id,
            LostFoundItem.deleted_at.is_(None),
            LostFoundItem.is_room_item.is_(True),
            LostFoundItem.claimed.is_(False),
        )
        .all()
    )
    for candidate in room_candidates:
        score = score_item_for_query(candidate, build_input_text(item.title, item.description, item.category, item.location))
        if score >= 80:
            notify_potential_match(
                db,
                recipient_user_id=item.submitted_by_user_id,
                item=item,
                matching_item=candidate,
            )
            break

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
        except (OSError, requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as exc:
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
        except (OSError, requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as exc:
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


def _ollama_service_pids() -> list[int]:
    pids: list[int] = []
    if psutil is not None:
        try:
            for process in psutil.process_iter(["pid", "cmdline"]):
                cmdline = process.info.get("cmdline") or []
                normalized = " ".join(str(part) for part in cmdline).lower()
                if "ollama" in normalized and "serve" in normalized:
                    pids.append(int(process.info["pid"]))
        except Exception as exc:
            report_logger.warning("[Health] psutil ollama process scan failed: %s", exc)
    if pids:
        return sorted(set(pids))

    try:
        result = subprocess.run(
            ["pgrep", "-f", "ollama serve"],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        report_logger.warning("[Health] pgrep failed while scanning Ollama: %s", exc)
        return []

    for line in result.stdout.splitlines():
        try:
            pids.append(int(line.strip()))
        except ValueError:
            continue
    return sorted(set(pids))


def _wait_for_ollama_availability(target_available: bool, *, timeout_seconds: float = 4.0) -> dict[str, Any]:
    deadline = time.monotonic() + max(0.5, timeout_seconds)
    latest_status = get_ollama_status()
    while time.monotonic() < deadline:
        if bool(latest_status.get("available")) is target_available:
            return latest_status
        time.sleep(0.25)
        latest_status = get_ollama_status()
    return latest_status


def _ollama_host_is_local(ollama_status: dict[str, Any]) -> bool:
    parsed = urlparse(str(ollama_status.get("host") or ""))
    hostname = (parsed.hostname or "").lower()
    return hostname in {"", "local" + "host", "::1", "0.0.0.0"} or hostname.startswith("127.")


def _serialize_admin_health(ollama_status: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    current_status = ollama_status or get_ollama_status()
    return {
        "status": "running" if current_status.get("available") else "stopped",
        "ollama": current_status,
        "uptime_seconds": _get_uptime_seconds(),
    }


@app.get("/health")
def health() -> dict:
    ollama_status = get_ollama_status()
    database_status = _get_database_health()
    return {
        "status": "ok",
        "backend": "ok",
        "database": database_status,
        "ollama": "ok" if ollama_status.get("available") else "down",
        "ollama_details": ollama_status,
        "ai_model": ollama_status.get("text_model") or "unconfigured",
        "uptime_seconds": _get_uptime_seconds(),
    }


@app.get("/ready")
def ready():
    database_status = _get_database_health()
    if database_status != "ok":
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "database": database_status,
                "uptime_seconds": _get_uptime_seconds(),
            },
        )

    return {
        "status": "ready",
        "database": "ok",
        "uptime_seconds": _get_uptime_seconds(),
    }


@app.get("/health/detailed")
def health_detailed(current_user: User = Depends(require_admin_user)) -> dict:
    del current_user
    return _serialize_admin_health()


@app.post("/admin/ollama/start")
def admin_start_ollama(current_user: User = Depends(require_admin_user)) -> dict[str, Any]:
    current_status = get_ollama_status()
    if current_status.get("available"):
        log_admin_action(current_user, "ollama_start", note="already_running")
        return {
            **_serialize_admin_health(current_status),
            "message": "Ollama is already running.",
            "started": False,
        }

    if not _ollama_host_is_local(current_status):
        log_admin_action(current_user, "ollama_start", note="remote_host_configured")
        return {
            **_serialize_admin_health(current_status),
            "status": "remote",
            "message": f"Ollama is configured at {current_status.get('host')}. Start or fix that server directly.",
            "started": False,
        }

    existing_pids = _ollama_service_pids()
    if existing_pids:
        current_status = _wait_for_ollama_availability(True, timeout_seconds=2.0)
        next_status = "running" if current_status.get("available") else "starting"
        log_admin_action(current_user, "ollama_start", note=f"existing_processes={len(existing_pids)} status={next_status}")
        return {
            **_serialize_admin_health(current_status),
            "status": next_status,
            "message": "Ollama is already starting." if next_status == "starting" else "Ollama is running.",
            "started": False,
        }

    ollama_cli = shutil.which("ollama")
    if not ollama_cli:
        log_admin_action(current_user, "ollama_start", note="cli_missing")
        return {
            **_serialize_admin_health(current_status),
            "status": "unavailable",
            "message": "Ollama CLI is not installed on this server.",
            "started": False,
        }

    try:
        subprocess.Popen(
            [ollama_cli, "serve"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as exc:
        report_logger.warning("[Admin] Ollama start failed: %s", exc)
        log_admin_action(current_user, "ollama_start", note=f"error={exc}")
        return {
            **_serialize_admin_health(current_status),
            "status": "error",
            "message": f"Could not start Ollama: {exc}",
            "started": False,
        }

    current_status = _wait_for_ollama_availability(True)
    next_status = "running" if current_status.get("available") else "starting"
    log_admin_action(current_user, "ollama_start", note=f"status={next_status}")
    return {
        **_serialize_admin_health(current_status),
        "status": next_status,
        "message": "Ollama start requested." if next_status == "starting" else "Ollama is running.",
        "started": True,
    }


@app.post("/admin/ollama/stop")
def admin_stop_ollama(current_user: User = Depends(require_admin_user)) -> dict[str, Any]:
    current_status = get_ollama_status()
    if not _ollama_host_is_local(current_status):
        log_admin_action(current_user, "ollama_stop", note="remote_host_configured")
        return {
            **_serialize_admin_health(current_status),
            "status": "remote",
            "message": f"Ollama is configured at {current_status.get('host')}. Stop that server directly if needed.",
            "stopped": False,
        }

    pids = _ollama_service_pids()
    if not current_status.get("available") and not pids:
        log_admin_action(current_user, "ollama_stop", note="already_stopped")
        return {
            **_serialize_admin_health(current_status),
            "message": "Ollama is already stopped.",
            "stopped": False,
        }

    stopped_any = False
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
            stopped_any = True
        except ProcessLookupError:
            continue
        except OSError as exc:
            report_logger.warning("[Admin] Ollama stop failed for pid=%s: %s", pid, exc)

    current_status = _wait_for_ollama_availability(False)
    next_status = "stopped" if not current_status.get("available") else "running"
    log_admin_action(current_user, "ollama_stop", note=f"requested_pids={len(pids)} status={next_status}")
    return {
        **_serialize_admin_health(current_status),
        "status": next_status,
        "message": "Ollama is stopped." if next_status == "stopped" else "Ollama stop request did not stop the running service.",
        "stopped": stopped_any or next_status == "stopped",
    }


@app.get("/auth/login-images")
def login_report_images(db: Session = Depends(get_db)) -> dict[str, Any]:
    items = (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.deleted_at.is_(None),
            LostFoundItem.image_path.is_not(None),
            LostFoundItem.image_path != "",
        )
        .order_by(LostFoundItem.created_at.desc(), LostFoundItem.id.desc())
        .limit(5)
        .all()
    )
    return {
        "items": [
            {
                "id": item.id,
                "title": item.title,
                "image_url": item.image_path,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
            if item.image_path
        ],
    }


@app.post("/auth/email/request-code")
def request_email_verification_code(
    payload: EmailVerificationRequestPayload,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    email = validate_email_address(payload.email)
    purpose = normalize_verification_purpose(payload.purpose)
    if purpose != "register":
        raise HTTPException(status_code=400, detail="Use the account email-change flow for this verification purpose.")
    enforce_rate_limit("email_code", request=request, current_user=None)
    enforce_subject_rate_limit("email_code", f"email:{email}", route=request.url.path)

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="That email is already connected to an account.")

    pending = latest_pending_email_code(db, email=email, purpose=purpose)
    if pending and pending.last_sent_at:
        retry_after = int((pending.last_sent_at + timedelta(seconds=EMAIL_VERIFICATION_RESEND_SECONDS) - datetime.utcnow()).total_seconds())
        if retry_after > 0:
            raise_rate_limit("email verification code", retry_after_seconds=retry_after)

    record, code = create_email_verification_record(db, email=email, purpose=purpose, request=request)
    sent = send_email_verification_code(email, code, purpose=purpose)
    return {
        "message": "Verification code sent." if sent else smtp_unconfigured_message(),
        "email": email,
        "purpose": purpose,
        "expires_in": EMAIL_VERIFICATION_CODE_TTL_SECONDS,
        "resend_after": EMAIL_VERIFICATION_RESEND_SECONDS,
        "delivery": "real-email" if sent else "development-log",
        "verification_id": record.id,
    }


@app.post("/auth/email/verify-code")
def verify_email_verification_code(
    payload: EmailVerificationConfirmPayload,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    email = validate_email_address(payload.email)
    purpose = normalize_verification_purpose(payload.purpose)
    if purpose != "register":
        raise HTTPException(status_code=400, detail="Use the account email-change flow for this verification purpose.")

    enforce_rate_limit("email_verify", request=request, current_user=None)
    enforce_subject_rate_limit("email_verify", f"email:{email}", route=request.url.path)
    record, now = consume_email_verification_code(db, email=email, purpose=purpose, code=payload.code)
    user = db.query(User).filter(User.email == email).first()
    if user and not user_email_is_verified(user):
        user.email_verified = True
        user.email_verified_at = now
    db.commit()
    db.refresh(record)
    if user:
        db.refresh(user)

    return {
        "message": "Email verified.",
        "email": email,
        "purpose": purpose,
        "verification_token": create_email_verification_token(record),
        "verified_at": now.isoformat(),
        "token_expires_in": EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
    }


@app.post("/register")
def register(payload: RegisterPayload, db: Session = Depends(get_db)) -> dict:
    email = validate_email_address(payload.email)
    requested_username = str(payload.username or "").strip()
    username = requested_username or unique_username_from_email(db, email)
    password = payload.password.strip()
    initials = validate_initials(payload.initials or default_initials_from_email(email))
    class_of = validate_class_of(payload.class_of if payload.class_of is not None else default_class_of_from_email(email))

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username already exists.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already exists.")

    parse_email_verification_token(
        db,
        payload.email_verification_token,
        expected_email=email,
        expected_purpose="register",
    )

    detected_role = detect_role_from_identifiers(username, email)
    user = User(
        username=username,
        password_hash=hash_password(password),
        email=email,
        email_verified=True,
        email_verified_at=datetime.utcnow(),
        initials=initials,
        class_of=class_of,
        is_admin=False,
        role=detected_role,
        auto_detected_role=detected_role,
        assigned_role="",
        auth_provider="password",
        last_login_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    role_detection_log(user, detected_role=detected_role, source="manual_signup")

    token = issue_user_session(db, user)

    return {"token": token, "user": serialize_user(user)}


@app.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)) -> dict:
    email = normalize_email(payload.email)
    username = str(payload.username or "").strip()
    user = None
    if email:
        user = db.query(User).filter(User.email == email).first()
    elif username:
        user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if user.email_verified_at and not getattr(user, "email_verified", False):
        user.email_verified = True
    user.last_login_at = datetime.utcnow()
    ensure_user_role_assignment(db, user, source="existing_user")
    if user.last_login_at:
        db.commit()
        db.refresh(user)
    token = issue_user_session(db, user)
    return {"token": token, "user": serialize_user(user)}


@app.get("/session")
def session_status(current_user: User = Depends(get_current_user)) -> dict:
    return {"user": serialize_user(current_user)}


@app.post("/account/email/request-code")
def request_account_email_change_code(
    payload: EmailChangePayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    email = validate_email_address(payload.email)
    current_email = normalize_email(current_user.email or "")
    if email == current_email and user_email_is_verified(current_user):
        raise HTTPException(status_code=400, detail="This email is already verified on your account.")
    existing = db.query(User).filter(User.email == email, User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="That email is already connected to an account.")

    purpose = "email_change"
    enforce_rate_limit("email_code", request=request, current_user=current_user)
    enforce_subject_rate_limit("email_code", f"user:{current_user.id}:email:{email}", route=request.url.path)
    pending = latest_pending_email_code(db, email=email, purpose=purpose)
    if pending and pending.last_sent_at:
        retry_after = int((pending.last_sent_at + timedelta(seconds=EMAIL_VERIFICATION_RESEND_SECONDS) - datetime.utcnow()).total_seconds())
        if retry_after > 0:
            raise_rate_limit("email verification code", retry_after_seconds=retry_after)

    record, code = create_email_verification_record(db, email=email, purpose=purpose, request=request)
    sent = send_email_verification_code(email, code, purpose=purpose)
    return {
        "message": "Verification code sent." if sent else smtp_unconfigured_message(),
        "email": email,
        "purpose": purpose,
        "expires_in": EMAIL_VERIFICATION_CODE_TTL_SECONDS,
        "resend_after": EMAIL_VERIFICATION_RESEND_SECONDS,
        "delivery": "real-email" if sent else "development-log",
        "verification_id": record.id,
    }


@app.post("/account/email/confirm")
def confirm_account_email_change(
    payload: EmailChangeConfirmPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    email = validate_email_address(payload.email)
    existing = db.query(User).filter(User.email == email, User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="That email is already connected to an account.")

    purpose = "email_change"
    enforce_rate_limit("email_verify", request=request, current_user=current_user)
    enforce_subject_rate_limit("email_verify", f"user:{current_user.id}:email:{email}", route=request.url.path)
    _record, now = consume_email_verification_code(db, email=email, purpose=purpose, code=payload.code)
    old_email = current_user.email or ""
    current_user.email = email
    current_user.email_verified = True
    current_user.email_verified_at = now
    db.commit()
    db.refresh(current_user)
    security_log("account_email_changed", user_id=current_user.id, old_email=old_email, new_email=email)
    return {
        "message": "Email updated.",
        "email": email,
        "verified_at": now.isoformat(),
        "user": serialize_user(current_user),
    }


@app.post("/debug/smtp-test")
def debug_smtp_test(
    payload: SmtpDiagnosticPayload,
    current_user: User = Depends(require_admin_user),
) -> dict[str, Any]:
    del current_user
    recipient = validate_email_syntax(payload.email)
    return run_smtp_diagnostic_email(recipient)


@app.get("/debug/smtp-status")
def debug_smtp_status(current_user: User = Depends(require_admin_user)) -> dict[str, Any]:
    del current_user
    return smtp_config_status()


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
    avatar_path = decode_image_payload(image, upload_subdir="profile")
    if not avatar_path:
        raise HTTPException(status_code=400, detail="Profile image is required.")
    avatar_file = resolve_upload_path(avatar_path)
    if not avatar_file or not avatar_file.exists():
        report_logger.error(
            "[Profile] saved avatar missing after upload user_id=%s avatar_path=%s",
            current_user.id,
            avatar_path,
        )
        raise HTTPException(status_code=500, detail="Profile image upload did not save correctly.")
    ensure_upload_is_served_readable(avatar_file)
    old_avatar_path = current_user.avatar_path
    try:
        current_user.avatar_path = avatar_path
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        delete_uploaded_path(avatar_path)
        raise

    if old_avatar_path and old_avatar_path != avatar_path:
        delete_uploaded_path(old_avatar_path)

    report_logger.info(
        "[Profile] avatar updated user_id=%s avatar_path=%s bytes=%s",
        current_user.id,
        avatar_path,
        avatar_file.stat().st_size if avatar_file.exists() else 0,
    )

    return {
        "message": "Profile image updated.",
        "user": serialize_user(current_user),
        "avatar_version": int(time.time() * 1000),
    }


def current_map_image_version(db: Session) -> int:
    upload_object = db.query(UploadObject).filter(UploadObject.path == MAP_IMAGE_URL).first()
    if upload_object:
        created_at = upload_object.created_at or datetime.utcnow()
        return max(1, int(created_at.timestamp() * 1000) + int(upload_object.size or 0))
    if MAP_IMAGE_PATH.is_file():
        return max(1, int(MAP_IMAGE_PATH.stat().st_mtime * 1000))
    return max(1, int(time.time() * 1000))


@app.get("/map")
def get_school_map(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    regions = db.query(MapRegion).order_by(MapRegion.zone.asc(), MapRegion.label.asc()).all()
    return {
        "image_url": MAP_IMAGE_URL,
        "image_version": current_map_image_version(db),
        "loading_video_url": LOADING_VIDEO_URL,
        "zones": FIXED_SCHOOL_ZONES,
        "locations": [serialize_school_location(location) for location in SCHOOL_LOCATION_DATA],
        "regions": [serialize_map_region(region) for region in regions],
        "stats": build_map_item_stats(db, regions),
    }


@app.post("/admin/map/regions")
def admin_create_map_region(
    payload: MapRegionPayload,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    data = validate_map_region_payload(payload)
    region = MapRegion(id=uuid4().hex, **data)
    db.add(region)
    db.commit()
    db.refresh(region)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="map_region_created",
        entity_type="map_region",
        entity_id=None,
        before_state=None,
        after_state=serialize_map_region(region),
        metadata={"region_id": region.id},
    )
    db.commit()
    log_admin_action(current_user, "create-map-region", note=f"region_id={region.id} zone={region.zone}")
    return {
        "message": "Map region created.",
        "region": serialize_map_region(region),
    }


@app.patch("/admin/map/regions/{region_id}")
def admin_update_map_region(
    region_id: str,
    payload: MapRegionPayload,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    region = db.query(MapRegion).filter(MapRegion.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Map region not found.")

    before_state = serialize_map_region(region)
    data = validate_map_region_payload(payload)
    for key, value in data.items():
        setattr(region, key, value)
    region.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(region)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="map_region_updated",
        entity_type="map_region",
        entity_id=None,
        before_state=before_state,
        after_state=serialize_map_region(region),
        metadata={"region_id": region.id},
    )
    db.commit()
    log_admin_action(current_user, "update-map-region", note=f"region_id={region.id} zone={region.zone}")
    return {
        "message": "Map region updated.",
        "region": serialize_map_region(region),
    }


@app.delete("/admin/map/regions/{region_id}")
def admin_delete_map_region(
    region_id: str,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    region = db.query(MapRegion).filter(MapRegion.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Map region not found.")

    before_state = serialize_map_region(region)
    db.delete(region)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="map_region_deleted",
        entity_type="map_region",
        entity_id=None,
        before_state=before_state,
        after_state=None,
        metadata={"region_id": region_id},
    )
    db.commit()
    log_admin_action(current_user, "delete-map-region", note=f"region_id={region_id}")
    return {"message": "Map region deleted."}


@app.get("/filters")
def filters(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    regions = db.query(MapRegion).order_by(MapRegion.zone.asc(), MapRegion.label.asc()).all()
    locations = [
        *school_location_filter_values(),
        *(map_region_path(region) for region in regions),
    ]
    return {
        "locations": locations or SCHOOL_LOCATIONS,
        "categories": CATEGORIES,
        "time_slots": TIME_SLOTS,
        "statuses": STATUSES,
        "report_types": REPORT_TYPES,
    }


def clean_ai_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def clean_ai_list(value: Any) -> list[str]:
    if isinstance(value, str):
        candidates = re.split(r"[,;\n]+", value)
    elif isinstance(value, (list, tuple, set)):
        candidates = value
    else:
        candidates = []
    cleaned: list[str] = []
    for candidate in candidates:
        text = clean_ai_text(candidate)
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned[:8]


def clean_ai_confidence(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, str):
        value = value.strip().rstrip("%")
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0
    if 0 < score <= 1:
        score *= 100
    return max(0, min(100, int(round(score))))


def llava_category_or_default(value: Any, default: str) -> str:
    proposed = clean_ai_text(value)
    if not proposed:
        return default
    normalized = proposed.lower()
    for category in CATEGORIES:
        if normalized == category.lower():
            return category
    if "bottle" in normalized:
        return "Bottle"
    if "bag" in normalized or "backpack" in normalized:
        return "Bag"
    if "book" in normalized:
        return "Books"
    if "card" in normalized or "id" in normalized:
        return "ID Card"
    if "key" in normalized:
        return "Keys"
    if any(term in normalized for term in ["laptop", "phone", "charger", "tablet", "calculator", "headphone", "earbud"]):
        return "Electronics"
    if any(term in normalized for term in ["pen", "pencil", "stationery", "notebook"]):
        return "Stationery"
    if any(term in normalized for term in ["hoodie", "uniform", "jacket"]):
        return "Uniform"
    if "sport" in normalized:
        return "Sports Gear"
    return default


def llava_report_summary(analysis: dict[str, Any]) -> str:
    item_description = clean_ai_text(analysis.get("item_description") or analysis.get("object_description"))
    if item_description:
        return item_description[:260]

    object_type = clean_ai_text(analysis.get("object_type") or analysis.get("item_classification"))
    colours = clean_ai_list(analysis.get("colours"))
    markings = clean_ai_list(analysis.get("notable_markings"))
    if object_type:
        prefix = f"{', '.join(colours)} {object_type}".strip() if colours else object_type
        suffix = f" with {', '.join(markings)}" if markings else ""
        return f"{prefix}{suffix}"[:260]

    parts = [
        clean_ai_text(analysis.get("object_description")),
        clean_ai_text(analysis.get("item_classification")),
        clean_ai_text(analysis.get("scene_context")),
    ]
    summary = " | ".join(part for part in parts if part)
    return summary or clean_ai_text(analysis.get("raw"))[:260] or "LLaVA image analysis completed"


def llava_has_primary_description(analysis: dict[str, Any]) -> bool:
    return bool(clean_ai_text(
        analysis.get("item_description")
        or analysis.get("object_description")
        or analysis.get("object_type")
        or analysis.get("item_classification")
    ))


def llava_analysis_payload(
    *,
    image_path: str,
    inspection: Optional[dict[str, Any]] = None,
    error: Optional[Exception] = None,
    fallback_source: str = "",
    ai_analysis_status: str = AI_ANALYSIS_SUCCESS,
    fallback_reason: str = "",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "image_path": image_path,
        "llava_called": bool(inspection),
        "llava_attempted": True,
        "ai_analysis_status": ai_analysis_status,
        "unverified_ai_analysis": bool(error or not inspection),
    }
    if inspection:
        raw_output = clean_ai_text(inspection.get("raw"))
        payload.update({
            "moderation": inspection.get("moderation", ""),
            "item_description": clean_ai_text(inspection.get("item_description") or inspection.get("object_description")),
            "object_type": clean_ai_text(inspection.get("object_type") or inspection.get("item_classification")),
            "item_subtype": clean_ai_text(inspection.get("item_subtype")),
            "colours": clean_ai_list(inspection.get("colours")),
            "materials": clean_ai_list(inspection.get("materials")),
            "brand": clean_ai_text(inspection.get("brand")),
            "visible_text": clean_ai_list(inspection.get("visible_text")),
            "notable_markings": clean_ai_list(inspection.get("notable_markings")),
            "distinguishing_features": clean_ai_list(inspection.get("distinguishing_features") or inspection.get("distinctive_features")),
            "condition": clean_ai_text(inspection.get("condition")),
            "shape": clean_ai_text(inspection.get("shape")),
            "size_estimate": clean_ai_text(inspection.get("size_estimate")),
            "possible_category": clean_ai_text(inspection.get("possible_category")),
            "confidence_score": clean_ai_confidence(inspection.get("confidence_score")),
            "object_description": clean_ai_text(inspection.get("object_description")),
            "item_classification": clean_ai_text(inspection.get("item_classification")),
            "scene_context": clean_ai_text(inspection.get("scene_context")),
            "uncertainty_notes": clean_ai_text(inspection.get("uncertainty_notes")),
            "safety_notes": clean_ai_text(inspection.get("safety_notes")),
            "tags": inspection.get("tags", []),
            "tag_validation_error": inspection.get("tag_validation_error", ""),
            "tag_validation_warnings": inspection.get("tag_validation_warnings", []),
            "validation_strength": inspection.get("validation_strength", ""),
            "full_json_response": inspection.get("full_json_response") or inspection.get("parsed_json") or {},
            "parsed_json": inspection.get("parsed_json") or inspection.get("full_json_response") or {},
            "raw": raw_output,
            "output_text": raw_output,
            "model": clean_ai_text(inspection.get("model")),
            "image_file_bytes": inspection.get("image_file_bytes", 0),
            "image_base64_length": inspection.get("image_base64_length", 0),
        })
    if error:
        payload.update({
            "error": str(error),
            "fallback_source": fallback_source,
            "fallback_reason": fallback_reason or str(error),
        })
    elif fallback_reason:
        payload["fallback_reason"] = fallback_reason
    payload["request_metadata"] = {
        "image_path": image_path,
        "ai_analysis_status": payload.get("ai_analysis_status", ai_analysis_status),
        "fallback_source": payload.get("fallback_source", ""),
        "fallback_reason": payload.get("fallback_reason", ""),
        "llava_called": payload.get("llava_called", False),
        "llava_attempted": payload.get("llava_attempted", True),
        "model": payload.get("model", ""),
        "full_json_response_present": bool(payload.get("full_json_response")),
    }
    return payload


ASSISTANT_QUERY_STOP_WORDS = {
    "a",
    "all",
    "about",
    "any",
    "anyone",
    "are",
    "at",
    "by",
    "can",
    "count",
    "counts",
    "could",
    "did",
    "do",
    "find",
    "floor",
    "floors",
    "for",
    "found",
    "have",
    "help",
    "how",
    "i",
    "image",
    "images",
    "in",
    "is",
    "it",
    "item",
    "items",
    "latest",
    "list",
    "lost",
    "me",
    "most",
    "my",
    "near",
    "newest",
    "photo",
    "photos",
    "picture",
    "pictures",
    "please",
    "recent",
    "report",
    "reported",
    "reports",
    "search",
    "show",
    "someone",
    "stats",
    "statistics",
    "the",
    "there",
    "to",
    "top",
    "visual",
    "was",
    "what",
    "where",
    "which",
    "with",
}


ASSISTANT_IMAGE_WORDS = {"image", "images", "photo", "photos", "picture", "pictures", "visual", "llava"}
ASSISTANT_RECENT_WORDS = {"latest", "recent", "newest", "new"}
ASSISTANT_STATS_WORDS = {"most", "count", "counts", "stats", "statistics", "breakdown", "rank", "ranked", "top", "where"}
ASSISTANT_CONTEXT_LIMIT = 120
ASSISTANT_DETAIL_LIMIT = 12


def iso_datetime(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def assistant_json_text_values(value: Any) -> list[str]:
    values: list[str] = []
    if isinstance(value, dict):
        for key, nested_value in value.items():
            if str(key).lower() in {"raw", "output_text", "prompt_text"}:
                continue
            values.extend(assistant_json_text_values(nested_value))
    elif isinstance(value, list):
        for nested_value in value:
            values.extend(assistant_json_text_values(nested_value))
    elif value is not None:
        text_value = str(value).strip()
        if text_value and len(text_value) <= 400:
            values.append(text_value)
    return values


def assistant_primary_llava_description(llava_analysis: dict[str, Any]) -> str:
    for key in ("item_description", "object_description", "description", "scene_context", "object_type", "item_classification"):
        value = str(llava_analysis.get(key) or "").strip()
        if value:
            return value
    return ""


def assistant_detected_objects(llava_analysis: dict[str, Any]) -> list[str]:
    objects: list[str] = []
    for key in ("detected_objects", "objects", "object_type", "item_classification", "possible_category"):
        value = llava_analysis.get(key)
        candidates = value if isinstance(value, list) else [value]
        for candidate in candidates:
            if isinstance(candidate, dict):
                candidate = candidate.get("name") or candidate.get("label") or candidate.get("object")
            text_value = str(candidate or "").strip().lower()
            if text_value and text_value not in objects:
                objects.append(text_value)
    return objects[:12]


def assistant_item_has_image_or_llava(item: LostFoundItem) -> bool:
    return bool(item.image_path or item.evidence_images or item.llava_analysis)


def assistant_location_path(item: LostFoundItem) -> str:
    location = str(item.location or "").strip()
    secondary = str(item.secondary_location or "").strip()
    if secondary and location and normalize_location_text(location) not in normalize_location_text(secondary):
        return f"{secondary} > {location}"
    return secondary or location or "Unknown"


def assistant_report_reference(item: LostFoundItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "report_type": item.report_type,
        "category": item.category,
        "location": item.location,
        "secondary_location": item.secondary_location,
        "location_path": assistant_location_path(item),
        "status": item.status,
        "tags": item.tags,
        "image_path": item.image_path,
        "llava_description": assistant_primary_llava_description(item.llava_analysis),
        "created_at": iso_datetime(item.created_at),
        "updated_at": iso_datetime(item.updated_at),
    }


def assistant_report_payload(item: LostFoundItem) -> dict[str, Any]:
    llava_analysis = item.llava_analysis
    return {
        "id": item.id,
        "report_type": item.report_type,
        "reporter_name": item.reporter_name,
        "student_id": item.student_id,
        "contact_info": item.contact_info,
        "title": item.title,
        "description": item.description,
        "location": item.location,
        "secondary_location": item.secondary_location,
        "location_path": assistant_location_path(item),
        "category": item.category,
        "color": item.color,
        "time_slot": item.time_slot,
        "event_date": item.event_date.isoformat() if item.event_date else None,
        "status": item.status,
        "claimed": bool(item.claimed),
        "is_room_item": bool(item.is_room_item),
        "room_label": item.room_label or "",
        "room_recorded_at": iso_datetime(item.room_recorded_at),
        "returned_at": iso_datetime(item.returned_at),
        "returned_by_claim_id": item.returned_by_claim_id,
        "tags": item.tags,
        "ai_summary": item.ai_summary,
        "tag_source": item.tag_source,
        "ai_analysis_status": item.ai_analysis_status or AI_ANALYSIS_SUCCESS,
        "unverified_ai_analysis": bool(item.unverified_ai_analysis),
        "image_path": item.image_path,
        "image": {
            "path": item.image_path,
            "evidence_images": item.evidence_images,
            "llava_description": assistant_primary_llava_description(llava_analysis),
            "detected_objects": assistant_detected_objects(llava_analysis),
            "confidence_score": llava_analysis.get("confidence_score"),
            "analysis_status": item.ai_analysis_status or AI_ANALYSIS_SUCCESS,
            "unverified_ai_analysis": bool(item.unverified_ai_analysis),
        },
        "evidence_images": item.evidence_images,
        "evidence_details": item.evidence_details,
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
        "abuse_override_status": item.abuse_override_status or "",
        "abuse_override_notes": item.abuse_override_notes or "",
        "submitted_by_user_id": item.submitted_by_user_id,
        "deleted_at": iso_datetime(item.deleted_at),
        "deleted_by_user_id": item.deleted_by_user_id,
        "search_text": item.search_text or "",
        "llava_analysis": llava_analysis,
        "created_at": iso_datetime(item.created_at),
        "updated_at": iso_datetime(item.updated_at),
    }


def assistant_upload_metadata(db: Session) -> list[dict[str, Any]]:
    if UPLOAD_STORAGE_BACKEND == "database":
        uploads = db.query(UploadObject).order_by(UploadObject.created_at.desc()).all()
        return [
            {
                "path": upload.path,
                "name": upload.original_name,
                "content_type": upload.content_type,
                "size": int(upload.size or 0),
                "created_at": upload.created_at.isoformat() if upload.created_at else None,
            }
            for upload in uploads
            if str(upload.content_type or "").lower().startswith("image/")
            or Path(upload.path or "").suffix.lower() in IMAGE_UPLOAD_EXTENSIONS
        ]

    if not UPLOAD_DIR.exists():
        return []
    uploads: list[dict[str, Any]] = []
    for path in UPLOAD_DIR.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_UPLOAD_EXTENSIONS:
            continue
        try:
            stat_result = path.stat()
        except OSError:
            continue
        uploads.append({
            "path": upload_url_for_path(path),
            "name": path.name,
            "content_type": mime_type_for_extension(path.suffix.lower()),
            "size": int(stat_result.st_size),
            "created_at": datetime.fromtimestamp(stat_result.st_mtime).isoformat(),
        })
    return sorted(uploads, key=lambda value: value.get("created_at") or "", reverse=True)


def mime_type_for_extension(extension: str) -> str:
    normalized = str(extension or "").lower()
    if normalized == ".png":
        return "image/png"
    if normalized in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if normalized == ".webp":
        return "image/webp"
    if normalized == ".heic":
        return "image/heic"
    if normalized == ".heif":
        return "image/heif"
    return "application/octet-stream"


def assistant_match_payload(item: LostFoundItem, score: int) -> dict[str, Any]:
    payload = assistant_report_payload(item)
    return {
        "score": int(score),
        "item": payload,
    }


def assistant_query_floor_number(query_text: str) -> int:
    floor_number = floor_number_from_label(query_text)
    if floor_number:
        return floor_number
    match = re.search(r"\b([1-9])(?:st|nd|rd|th)?\s+(?:floor|level)\b", query_text, flags=re.IGNORECASE)
    return int(match.group(1)) if match else 0


def assistant_location_filters(query_text: str) -> list[dict[str, Any]]:
    normalized_query = normalize_location_text(query_text)
    floor_number = assistant_query_floor_number(query_text)
    filters: list[dict[str, Any]] = []
    if normalized_query:
        for entry in school_location_alias_entries():
            alias = entry["alias"]
            if alias and alias in normalized_query:
                location = entry["location"]
                filters.append({
                    "location_id": str(location.get("id") or ""),
                    "location_name": str(location.get("name") or location.get("label") or ""),
                    "floor_number": floor_number,
                })
    if floor_number and not filters:
        filters.append({"location_id": "", "location_name": "", "floor_number": floor_number})

    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()
    for entry in filters:
        key = (entry["location_id"], int(entry.get("floor_number") or 0))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def assistant_report_ids_from_text(query_text: str) -> list[int]:
    ids: list[int] = []
    for match in re.finditer(r"(?:\breport\b|\bitem\b)\s*#?\s*(\d+)|#(\d+)", query_text, flags=re.IGNORECASE):
        raw_value = match.group(1) or match.group(2)
        try:
            report_id = int(raw_value)
        except (TypeError, ValueError):
            continue
        if report_id > 0 and report_id not in ids:
            ids.append(report_id)
    return ids[:20]


def assistant_query_intent(query_text: str) -> dict[str, Any]:
    normalized_query = normalize_search_text(query_text)
    tokens = set(tokenize_search_text(normalized_query))
    return {
        "normalized_query": normalized_query,
        "tokens": sorted(tokens),
        "keywords": assistant_relevant_query_tokens(query_text),
        "report_ids": assistant_report_ids_from_text(query_text),
        "location_filters": assistant_location_filters(query_text),
        "wants_lost": bool({"lost", "missing"} & tokens),
        "wants_found": bool({"found", "available", "stored", "room"} & tokens),
        "wants_image": bool(ASSISTANT_IMAGE_WORDS & tokens),
        "wants_recent": bool(ASSISTANT_RECENT_WORDS & tokens),
        "wants_stats": bool(ASSISTANT_STATS_WORDS & tokens),
        "requires_records": bool(
            {"find", "show", "list", "search", "where", "latest", "recent", "newest", "any", "anyone"} & tokens
        ),
    }


def assistant_relevant_query_tokens(query_text: str) -> list[str]:
    keywords: list[str] = []
    for token in tokenize_search_text(query_text):
        if token in ASSISTANT_QUERY_STOP_WORDS or len(token) <= 1:
            continue
        if token not in keywords:
            keywords.append(token)
        if len(token) > 3 and token.endswith("s"):
            singular = token[:-1]
            if singular and singular not in ASSISTANT_QUERY_STOP_WORDS and singular not in keywords:
                keywords.append(singular)
    return keywords[:12]


def assistant_item_search_blob(item: LostFoundItem) -> str:
    llava_analysis = item.llava_analysis
    parts = [
        item.title,
        item.description,
        item.location,
        item.secondary_location,
        assistant_location_path(item),
        item.category,
        item.color,
        item.time_slot,
        item.status,
        item.ai_summary,
        item.tag_source,
        item.search_text,
        item.evidence_details,
        item.evidence_summary,
        item.evidence_inconsistencies,
        item.evidence_missing_info,
        item.evidence_validity,
        item.review_status,
        item.review_notes,
        item.abuse_reasoning,
        item.image_path,
        " ".join(item.evidence_images),
        " ".join(item.tags),
        " ".join(assistant_detected_objects(llava_analysis)),
        assistant_primary_llava_description(llava_analysis),
        " ".join(assistant_json_text_values(llava_analysis)),
    ]
    return " ".join(str(part or "").strip() for part in parts if str(part or "").strip())


def assistant_item_matches_keywords(item: LostFoundItem, keywords: list[str]) -> bool:
    if not keywords:
        return True
    normalized_blob = normalize_search_text(assistant_item_search_blob(item))
    return any(
        score_token_against_field(str(token), normalized_blob, exact=18, partial=12, fuzzy=9) > 0
        for token in keywords
    )


def assistant_item_matches_location_filter(item: LostFoundItem, filters: list[dict[str, Any]]) -> bool:
    if not filters:
        return True

    infos = map_item_location_infos(item)
    normalized_blob = normalize_location_text(assistant_item_search_blob(item))
    for location_filter in filters:
        location_id = str(location_filter.get("location_id") or "")
        location_name = str(location_filter.get("location_name") or "")
        floor_number = int(location_filter.get("floor_number") or 0)

        for info in infos:
            if location_id and info.get("location_id") != location_id:
                continue
            if floor_number and info.get("floor_number") != floor_number:
                continue
            if location_id or floor_number:
                return True

        location_matches_text = not location_name or normalize_location_text(location_name) in normalized_blob
        floor_matches_text = not floor_number or f"floor {floor_number}" in normalized_blob or f"level {floor_number}" in normalized_blob
        if location_matches_text and floor_matches_text:
            return True

    return False


def assistant_item_passes_query_intent(item: LostFoundItem, intent: dict[str, Any]) -> bool:
    report_type = str(item.report_type or "").lower()
    wants_lost = bool(intent.get("wants_lost"))
    wants_found = bool(intent.get("wants_found"))
    if wants_lost != wants_found:
        if wants_lost and report_type != "lost":
            return False
        if wants_found and report_type != "found" and not item.is_room_item:
            return False
    if intent.get("wants_image") and not assistant_item_has_image_or_llava(item):
        return False
    if not assistant_item_matches_location_filter(item, intent.get("location_filters") or []):
        return False
    return True


def assistant_score_item_for_query(item: LostFoundItem, query_text: str, intent: Optional[dict[str, Any]] = None) -> int:
    intent = intent or assistant_query_intent(query_text)
    if item.id in set(intent.get("report_ids") or []):
        return 1000

    normalized_query = str(intent.get("normalized_query") or normalize_search_text(query_text))
    score = score_item_for_query(item, normalized_query)
    normalized_blob = normalize_search_text(assistant_item_search_blob(item))
    if normalized_query and normalized_query in normalized_blob:
        score += 30

    matched_keywords = 0
    for token in intent.get("keywords") or assistant_relevant_query_tokens(query_text):
        token_score = score_token_against_field(str(token), normalized_blob, exact=18, partial=12, fuzzy=9)
        if token_score > 0:
            matched_keywords += 1
            score += token_score

    if matched_keywords:
        score += matched_keywords * 5
    if intent.get("location_filters") and assistant_item_matches_location_filter(item, intent.get("location_filters") or []):
        score += 35
    if intent.get("wants_image") and assistant_item_has_image_or_llava(item):
        score += 25
    if intent.get("wants_lost") and str(item.report_type or "").lower() == "lost":
        score += 12
    if intent.get("wants_found") and (str(item.report_type or "").lower() == "found" or item.is_room_item):
        score += 12
    return score


def assistant_scored_items(items: list[LostFoundItem], query_text: str) -> list[tuple[LostFoundItem, int]]:
    intent = assistant_query_intent(query_text)
    normalized_query = str(intent.get("normalized_query") or "")
    keywords = intent.get("keywords") or []
    has_filter = bool(
        intent.get("report_ids")
        or intent.get("location_filters")
        or intent.get("wants_image")
        or intent.get("wants_lost")
        or intent.get("wants_found")
    )
    sorted_items = sorted(items, key=lambda item: item.created_at or datetime.min, reverse=True)
    if not normalized_query and not has_filter:
        return [(item, 0) for item in sorted_items]
    if intent.get("wants_stats") and not keywords and not has_filter:
        return [(item, 1) for item in sorted_items]

    scored: list[tuple[LostFoundItem, int]] = []
    for item in items:
        if not assistant_item_passes_query_intent(item, intent):
            continue
        if keywords and not assistant_item_matches_keywords(item, keywords):
            continue
        score = assistant_score_item_for_query(item, query_text, intent)
        if score > 0 or (has_filter and not keywords):
            scored.append((item, score))

    scored.sort(key=lambda value: (value[1], value[0].created_at or datetime.min), reverse=True)
    return scored


def assistant_search_items(items: list[LostFoundItem], query_text: str, *, limit: int = 8) -> list[dict[str, Any]]:
    scored = assistant_scored_items(items, query_text)
    return [assistant_match_payload(item, score) for item, score in scored[:limit]]


def assistant_generated_query(message: str, matches: list[dict[str, Any]]) -> str:
    intent = assistant_query_intent(message)
    tokens = intent.get("keywords") or []
    query_parts: list[str] = []
    for token in tokens[:8]:
        if token not in query_parts:
            query_parts.append(token)
    for location_filter in intent.get("location_filters") or []:
        location_name = str(location_filter.get("location_name") or "").strip()
        floor_number = int(location_filter.get("floor_number") or 0)
        if location_name and location_name.lower() not in " ".join(query_parts).lower():
            query_parts.append(location_name)
        if floor_number and f"floor {floor_number}" not in " ".join(query_parts).lower():
            query_parts.append(f"Floor {floor_number}")
    if intent.get("wants_image") and "image" not in query_parts:
        query_parts.append("image")

    top_match = matches[0] if matches else {}
    top_item = top_match.get("item") if isinstance(top_match.get("item"), dict) else {}
    top_score = int(top_match.get("score") or 0) if isinstance(top_match, dict) else 0
    if top_item and top_score >= 45:
        for value in [
            top_item.get("color"),
            top_item.get("category"),
            top_item.get("location"),
        ]:
            text_value = str(value or "").strip()
            if text_value and text_value.lower() not in " ".join(query_parts).lower():
                query_parts.append(text_value)

    return " ".join(query_parts).strip()[:160]


def assistant_counter_rows(counter: Counter, *, limit: int = 20, key_name: str = "name") -> list[dict[str, Any]]:
    return [
        {key_name: str(key), "count": int(count)}
        for key, count in counter.most_common(limit)
        if str(key).strip()
    ]


def assistant_floor_paths_for_item(item: LostFoundItem) -> list[str]:
    paths: list[str] = []
    for info in map_item_location_infos(item):
        floor_number = int(info.get("floor_number") or 0)
        location_name = str(info.get("location_name") or "").strip()
        if floor_number and location_name:
            path = f"{location_name} > Floor {floor_number}"
            if path not in paths:
                paths.append(path)
    return paths


def assistant_report_statistics(items: list[LostFoundItem]) -> dict[str, Any]:
    location_counter: Counter = Counter()
    floor_counter: Counter = Counter()
    tag_counter: Counter = Counter()
    status_counter: Counter = Counter()
    type_counter: Counter = Counter()
    category_counter: Counter = Counter()
    time_slot_counter: Counter = Counter()
    day_counter: Counter = Counter()
    month_counter: Counter = Counter()

    for item in items:
        location_counter[assistant_location_path(item)] += 1
        floor_paths = assistant_floor_paths_for_item(item)
        if floor_paths:
            for floor_path in floor_paths:
                floor_counter[floor_path] += 1
        elif item.location or item.secondary_location:
            floor_counter[f"No floor > {assistant_location_path(item)}"] += 1
        for tag in item.tags:
            tag_counter[tag] += 1
        status_counter[item.status or "Unknown"] += 1
        type_counter[item.report_type or "unknown"] += 1
        category_counter[item.category or "Unknown"] += 1
        time_slot_counter[item.time_slot or "Unknown"] += 1
        timestamp = item.event_date or (item.created_at.date() if item.created_at else None)
        if timestamp:
            day_counter[timestamp.isoformat()] += 1
            month_counter[timestamp.strftime("%Y-%m")] += 1

    return {
        "by_location": assistant_counter_rows(location_counter, limit=40, key_name="location"),
        "by_floor": assistant_counter_rows(floor_counter, limit=40, key_name="floor"),
        "by_tag": assistant_counter_rows(tag_counter, limit=40, key_name="tag"),
        "by_status": assistant_counter_rows(status_counter, limit=20, key_name="status"),
        "by_report_type": assistant_counter_rows(type_counter, limit=10, key_name="report_type"),
        "by_category": assistant_counter_rows(category_counter, limit=20, key_name="category"),
        "by_time_slot": assistant_counter_rows(time_slot_counter, limit=20, key_name="time_slot"),
        "by_day": [
            {"date": day, "count": int(count)}
            for day, count in sorted(day_counter.items(), reverse=True)[:60]
        ],
        "by_month": [
            {"month": month, "count": int(count)}
            for month, count in sorted(month_counter.items(), reverse=True)[:36]
        ],
    }


def assistant_heatmap_summary(db: Session) -> dict[str, Any]:
    regions = db.query(MapRegion).order_by(MapRegion.zone.asc(), MapRegion.label.asc()).all()
    stats = build_map_item_stats(db, regions)

    def top_rows(source: dict[str, dict[str, Any]], key_name: str) -> list[dict[str, Any]]:
        rows = []
        for key, value in source.items():
            rows.append({
                key_name: key,
                "item_count": int(value.get("item_count") or 0),
                "lost_count": int(value.get("lost_count") or 0),
                "recent_count": int(value.get("recent_count") or 0),
                "recent_activity": bool(value.get("recent_activity")),
            })
        return sorted(rows, key=lambda row: (row["item_count"], row["recent_count"]), reverse=True)[:20]

    return {
        "top_zones": top_rows(stats.get("zones", {}), "zone"),
        "top_regions": top_rows(stats.get("regions", {}), "region_id"),
        "top_locations": top_rows(stats.get("locations", {}), "location_id"),
        "raw_stats": stats,
    }


def assistant_global_context(db: Session, items: list[LostFoundItem]) -> dict[str, Any]:
    active_items = [
        item
        for item in items
        if item.deleted_at is None and not item.claimed and str(item.status or "").lower() != "archived"
    ]
    active_location_counter = Counter(assistant_location_path(item) for item in active_items)
    statistics = assistant_report_statistics(items)
    return {
        "source": "database/report-storage/ai-analysis-storage",
        "read_only": True,
        "total_report_count": len(items),
        "active_report_count": len(active_items),
        "deleted_report_count": sum(1 for item in items if item.deleted_at is not None),
        "image_report_count": sum(1 for item in items if assistant_item_has_image_or_llava(item)),
        "llava_analysis_count": sum(1 for item in items if item.llava_analysis),
        "top_locations_by_reports": statistics.get("by_location", [])[:15],
        "most_recent_reports": [assistant_report_reference(item) for item in sorted(items, key=lambda item: item.created_at or datetime.min, reverse=True)[:12]],
        "most_frequent_tags": statistics.get("by_tag", [])[:20],
        "active_locations": assistant_counter_rows(active_location_counter, limit=30, key_name="location"),
        "heatmap_summary": assistant_heatmap_summary(db),
        "statistics": statistics,
    }


def assistant_location_breakdown(items: list[LostFoundItem]) -> dict[str, Any]:
    location_counter = Counter(assistant_location_path(item) for item in items)
    floor_counter = Counter(
        floor_path
        for item in items
        for floor_path in (assistant_floor_paths_for_item(item) or [f"No floor > {assistant_location_path(item)}"])
    )
    recent_by_location: dict[str, list[dict[str, Any]]] = {}
    for item in sorted(items, key=lambda value: value.created_at or datetime.min, reverse=True):
        location_path = assistant_location_path(item)
        recent_by_location.setdefault(location_path, [])
        if len(recent_by_location[location_path]) < 3:
            recent_by_location[location_path].append(assistant_report_reference(item))

    ranked_locations = assistant_counter_rows(location_counter, limit=30, key_name="location")
    for row in ranked_locations:
        row["recent_examples"] = recent_by_location.get(row["location"], [])
    return {
        "ranked_locations": ranked_locations,
        "ranked_floors": assistant_counter_rows(floor_counter, limit=30, key_name="floor"),
    }


def assistant_report_history_context(db: Session, report_ids: list[int], *, limit: Optional[int] = ASSISTANT_CONTEXT_LIMIT) -> list[dict[str, Any]]:
    if not report_ids:
        return []
    query = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "report", AuditLog.entity_id.in_(report_ids))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    )
    if limit:
        query = query.limit(limit)
    audits = query.all()
    users = get_user_map(db, [audit.user_id or 0 for audit in audits])
    return [serialize_audit_log(audit, users.get(audit.user_id or 0)) for audit in audits]


def assistant_recent_audit_context(db: Session, *, include_all: bool = False) -> dict[str, Any]:
    total_count = db.query(AuditLog).count()
    query = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    )
    if not include_all:
        query = query.limit(ASSISTANT_CONTEXT_LIMIT)
    audits = query.all()
    users = get_user_map(db, [audit.user_id or 0 for audit in audits])
    return {
        "total_count": total_count,
        "returned_count": len(audits),
        "truncated": len(audits) < total_count,
        "recent": [serialize_audit_log(audit, users.get(audit.user_id or 0)) for audit in audits],
        "admin_action_log_lines": assistant_log_tail(ADMIN_LOG_PATH, limit=40),
    }


def assistant_log_tail(path: Path, *, limit: int) -> list[str]:
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    return lines[-limit:]


def assistant_query_logs_context(db: Session, *, include_all: bool = False) -> dict[str, Any]:
    query_message_query = (
        db.query(QueryMessage)
        .order_by(QueryMessage.created_at.desc(), QueryMessage.id.desc())
    )
    legacy_item_query = (
        db.query(ItemQuery)
        .order_by(ItemQuery.created_at.desc(), ItemQuery.id.desc())
    )
    search_log_query = (
        db.query(AIInspectionLog)
        .filter(AIInspectionLog.route == "/items")
        .order_by(AIInspectionLog.created_at.desc(), AIInspectionLog.id.desc())
    )
    if not include_all:
        query_message_query = query_message_query.limit(ASSISTANT_CONTEXT_LIMIT)
        legacy_item_query = legacy_item_query.limit(ASSISTANT_CONTEXT_LIMIT)
        search_log_query = search_log_query.limit(ASSISTANT_CONTEXT_LIMIT)

    query_messages = query_message_query.all()
    legacy_item_queries = legacy_item_query.all()
    search_logs = search_log_query.all()
    query_message_count = db.query(QueryMessage).count()
    legacy_item_query_count = db.query(ItemQuery).count()
    logged_report_search_count = db.query(AIInspectionLog).filter(AIInspectionLog.route == "/items").count()
    return {
        "query_message_count": query_message_count,
        "legacy_item_query_count": legacy_item_query_count,
        "logged_report_search_count": logged_report_search_count,
        "returned_query_message_count": len(query_messages),
        "returned_legacy_item_query_count": len(legacy_item_queries),
        "returned_logged_report_search_count": len(search_logs),
        "truncated": (
            len(query_messages) < query_message_count
            or len(legacy_item_queries) < legacy_item_query_count
            or len(search_logs) < logged_report_search_count
        ),
        "recent_query_messages": [
            {
                "id": message.id,
                "item_id": message.item_id,
                "user_id": message.user_id,
                "role": message.role,
                "message": message.message,
                "language": normalize_language(message.language),
                "attachment_path": message.attachment_path,
                "created_at": iso_datetime(message.created_at),
            }
            for message in query_messages
        ],
        "recent_legacy_item_queries": [
            {
                "id": query.id,
                "item_id": query.item_id,
                "user_id": query.user_id,
                "role": query.role,
                "message": query.message,
                "created_at": iso_datetime(query.created_at),
            }
            for query in legacy_item_queries
        ],
        "recent_logged_report_searches": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "route": log.route,
                "input_text": log.input_text,
                "allowed": bool(log.allowed),
                "reason": log.reason,
                "tags": log.tags,
                "created_at": iso_datetime(log.created_at),
            }
            for log in search_logs
        ],
    }


def assistant_image_context(items: list[LostFoundItem]) -> list[dict[str, Any]]:
    return [
        {
            "report": assistant_report_reference(item),
            "image_path": item.image_path,
            "evidence_images": item.evidence_images,
            "llava_description": assistant_primary_llava_description(item.llava_analysis),
            "detected_objects": assistant_detected_objects(item.llava_analysis),
            "confidence_score": item.llava_analysis.get("confidence_score"),
            "llava_analysis": item.llava_analysis,
        }
        for item in items
        if assistant_item_has_image_or_llava(item)
    ][:ASSISTANT_DETAIL_LIMIT]


def assistant_no_records_reply(query_text: str, language: str) -> str:
    query = str(query_text or "").strip()
    suffix = f' for "{query}"' if query else ""
    if normalize_language(language) == "zh-CN":
        return f"No records found{suffix}. 数据库中没有匹配记录。"
    if normalize_language(language) == "th":
        return f"No records found{suffix}. ไม่พบระเบียนที่ตรงกันในฐานข้อมูล"
    return f"No records found{suffix}."


def assistant_query_requires_record_answer(query_text: str, intent: dict[str, Any]) -> bool:
    normalized_query = str(intent.get("normalized_query") or normalize_search_text(query_text))
    tokens = set(intent.get("tokens") or [])
    return bool(
        intent.get("report_ids")
        or intent.get("location_filters")
        or intent.get("wants_image")
        or intent.get("wants_stats")
        or ({"find", "show", "list", "search", "latest", "recent", "newest", "anyone"} & tokens)
        or re.search(r"\b(has anyone|are there|do we have)\b", normalized_query)
    )


def assistant_data_access_context(
    db: Session,
    *,
    items: list[LostFoundItem],
    query_text: str,
    suggested_query: str,
    scoped_scored_items: list[tuple[LostFoundItem, int]],
    locations: list[dict[str, Any]],
    map_regions: list[dict[str, Any]],
    floor_mappings: list[dict[str, Any]],
    upload_metadata: list[dict[str, Any]],
) -> dict[str, Any]:
    intent = assistant_query_intent(query_text)
    scoped_items = [item for item, _score in scoped_scored_items]
    items_by_id = {item.id: item for item in items}
    requested_ids = intent.get("report_ids") or []
    query_tokens = set(intent.get("tokens") or [])
    include_full_audit = bool(query_tokens & {
        "action",
        "actions",
        "admin",
        "audit",
        "audits",
        "change",
        "changes",
        "edit",
        "edited",
        "edits",
        "history",
        "status",
    })
    include_full_query_logs = bool(query_tokens & {"log", "logged", "logs", "queries", "query", "search", "searches"})
    specific_reports = [
        assistant_report_payload(items_by_id[report_id])
        for report_id in requested_ids
        if report_id in items_by_id
    ]
    if not specific_reports and (intent.get("wants_image") or requested_ids) and scoped_items:
        specific_reports = [assistant_report_payload(item) for item in scoped_items[:ASSISTANT_DETAIL_LIMIT]]

    missing_report_ids = [report_id for report_id in requested_ids if report_id not in items_by_id]
    no_records_found = assistant_query_requires_record_answer(query_text, intent) and not scoped_items and not specific_reports

    return {
        "source_of_truth": {
            "database": True,
            "report_storage_layer": True,
            "ai_analysis_storage": True,
            "frontend_state_used": False,
            "read_only": True,
        },
        "query_summary": {
            "query_text": query_text,
            "suggested_query": suggested_query,
            "intent": intent,
            "searched_report_count": len(items),
            "matched_report_count": len(scoped_items),
            "no_records_found": no_records_found,
            "missing_report_ids": missing_report_ids,
            "top_matches": [
                {**assistant_report_reference(item), "score": int(score)}
                for item, score in scoped_scored_items[:20]
            ],
            "location_breakdown": assistant_location_breakdown(scoped_items),
            "image_reports": assistant_image_context(scoped_items),
        },
        "global_context": assistant_global_context(db, items),
        "on_demand_context": {
            "specific_reports": specific_reports,
            "specific_report_history": assistant_report_history_context(db, requested_ids, limit=None),
            "recent_report_history": assistant_report_history_context(db, [item.id for item in scoped_items[:10]]),
            "admin_actions": assistant_recent_audit_context(db, include_all=include_full_audit),
            "user_search_and_query_logs": assistant_query_logs_context(db, include_all=include_full_query_logs),
            "uploads": upload_metadata,
            "locations": locations,
            "map_regions": map_regions,
            "floor_mappings": floor_mappings,
        },
    }


def assistant_location_payload(db: Session) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    regions = db.query(MapRegion).order_by(MapRegion.zone.asc(), MapRegion.label.asc()).all()
    return (
        [serialize_school_location(location) for location in SCHOOL_LOCATION_DATA],
        [serialize_map_region(region) for region in regions],
    )


def assistant_floor_mapping_payload() -> list[dict[str, Any]]:
    mappings: list[dict[str, Any]] = []
    rules_by_location = {}
    for rule in SCHOOL_LOCATION_CODE_RULES:
        rules_by_location.setdefault(rule["location_id"], []).append(rule)

    for location in SCHOOL_LOCATION_DATA:
        location_id = str(location.get("id") or "")
        location_name = str(location.get("name") or location.get("label") or "")
        floors = location.get("floors") if isinstance(location.get("floors"), list) else []
        location_rules = rules_by_location.get(location_id, [])
        for floor in floors:
            if not isinstance(floor, dict):
                continue
            floor_label = str(floor.get("label") or floor.get("id") or "").strip()
            floor_number = floor_number_from_label(floor_label)
            code_rules = [
                rule
                for rule in location_rules
                if floor_number and int(rule["min_floor"]) <= floor_number <= int(rule["max_floor"])
            ]
            code_hint = ", ".join(
                f"{rule['prefix']}{floor_number}xx"
                for rule in code_rules
            )
            sub_locations = floor.get("sub_locations") if isinstance(floor.get("sub_locations"), list) else []
            mappings.append({
                "location_id": location_id,
                "location": location_name,
                "floor_id": str(floor.get("id") or floor_label),
                "floor_label": floor_label,
                "floor_number": floor_number,
                "path": f"{location_name} > {floor_label}" if location_name and floor_label else location_name,
                "code_hint": code_hint,
                "sub_locations": [
                    str(sub_location.get("label") or sub_location.get("id") or "").strip()
                    for sub_location in sub_locations
                    if isinstance(sub_location, dict) and str(sub_location.get("label") or sub_location.get("id") or "").strip()
                ],
            })

    return mappings


@app.post("/assistant/chat")
def site_assistant_chat(
    payload: AssistantChatPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit("chat", request=request, current_user=current_user)
    reason = obvious_bad_query_reason(payload.message)
    if reason:
        raise HTTPException(status_code=400, detail=reason)

    message = minimally_validate_field(payload.message, "Assistant message", min_meaningful_chars=1, max_chars=420)
    normalized_language = normalize_language(payload.language or current_user.preferred_language)

    items = db.query(LostFoundItem).order_by(LostFoundItem.created_at.desc()).all()
    reports = [assistant_report_payload(item) for item in items]
    locations, map_regions = assistant_location_payload(db)
    floor_mappings = assistant_floor_mapping_payload()
    uploads = assistant_upload_metadata(db)

    likely_scored_items = assistant_scored_items(items, message)
    likely_matches = [assistant_match_payload(item, score) for item, score in likely_scored_items[:6]]
    suggested_query = clean_text(payload.query)[:160] if payload.query.strip() else assistant_generated_query(message, likely_matches)
    search_scored_items = assistant_scored_items(items, suggested_query or message) if payload.execute_search else []
    search_results = [assistant_match_payload(item, score) for item, score in search_scored_items[:10]]
    scoped_scored_items = search_scored_items if payload.execute_search else likely_scored_items
    data_context = assistant_data_access_context(
        db,
        items=items,
        query_text=message,
        suggested_query=suggested_query,
        scoped_scored_items=scoped_scored_items,
        locations=locations,
        map_regions=map_regions,
        floor_mappings=floor_mappings,
        upload_metadata=uploads,
    )

    package = generate_site_helper_package(
        user_message=message,
        reports=reports,
        likely_matches=likely_matches,
        locations=locations,
        map_regions=map_regions,
        floor_mappings=floor_mappings,
        upload_metadata=uploads,
        suggested_query=suggested_query,
        execute_search=bool(payload.execute_search),
        search_results=search_results,
        data_context=data_context,
        language=normalized_language,
    )
    if data_context.get("query_summary", {}).get("no_records_found"):
        package["reply"] = assistant_no_records_reply(suggested_query or message, normalized_language)

    return {
        "reply": package.get("reply", ""),
        "suggested_query": package.get("suggested_query") or suggested_query,
        "suggested_actions": package.get("suggested_actions", []),
        "navigation_target": package.get("navigation_target", "none"),
        "can_execute_search": bool(suggested_query) and not payload.execute_search,
        "executed_search": bool(payload.execute_search),
        "likely_matches": likely_matches[:4],
        "results": search_results,
        "report_count": len(reports),
        "location_count": len(locations) + len(map_regions),
        "floor_mapping_count": len(floor_mappings),
        "upload_metadata_count": len(uploads),
        "data_context_summary": {
            "source_of_truth": data_context.get("source_of_truth", {}),
            "matched_report_count": data_context.get("query_summary", {}).get("matched_report_count", 0),
            "no_records_found": data_context.get("query_summary", {}).get("no_records_found", False),
        },
        "language": normalized_language,
    }


@app.get("/stats/summary")
def stats_summary(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return {
        "items_returned_this_week": items_returned_this_week(db),
    }


@app.get("/room/items")
def list_room_items(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    items = (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.deleted_at.is_(None),
            LostFoundItem.is_room_item.is_(True),
            LostFoundItem.returned_at.is_(None),
        )
        .order_by(LostFoundItem.room_recorded_at.desc(), LostFoundItem.created_at.desc())
        .all()
    )
    reporters = get_user_map(db, [item.submitted_by_user_id or 0 for item in items])
    return {
        "items": [serialize_item(item, reporters.get(item.submitted_by_user_id or 0)) for item in items],
        "items_returned_this_week": items_returned_this_week(db),
    }


@app.get("/returned/items")
def list_recently_returned_items(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    items = (
        db.query(LostFoundItem)
        .filter(
            LostFoundItem.deleted_at.is_(None),
            LostFoundItem.returned_at.is_not(None),
        )
        .order_by(LostFoundItem.returned_at.desc(), LostFoundItem.updated_at.desc())
        .limit(36)
        .all()
    )
    reporters = get_user_map(db, [item.submitted_by_user_id or 0 for item in items])
    return {
        "items": [serialize_item(item, reporters.get(item.submitted_by_user_id or 0)) for item in items],
        "items_returned_this_week": items_returned_this_week(db),
    }


@app.post("/room/items")
@app.post("/admin/room/items")
def admin_upload_room_items(
    payload: RoomUploadPayload,
    current_user: User = Depends(require_teacher_user),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.images:
        raise HTTPException(status_code=400, detail="Upload at least one image for the lost and found room.")

    label = str(payload.label or "").strip()
    cleaned_label = moderate_field(label, "Room label", min_meaningful_chars=2, max_chars=80) if label else ""
    created_items: list[LostFoundItem] = []

    for index, image_payload in enumerate(payload.images, start=1):
        image_path = decode_image_payload(image_payload)
        ai_result = None
        llava_analysis: dict[str, Any] = {}
        ai_analysis_status = AI_ANALYSIS_SUCCESS
        unverified_ai_analysis = False
        try:
            if image_path:
                report_logger.info("[LLaVA] Image detected")
                image_file = resolve_upload_path(image_path)
                if not image_file or not image_file.exists():
                    raise HTTPException(status_code=404, detail="The stored image for this room item is missing.")
                report_logger.info("[LLaVA] Sending image to model")
                inspection = inspect_image_upload(str(image_file), item_label=cleaned_label or f"room-item-{index}")
                report_logger.info("[LLaVA] Model: %s", inspection.get("model") or "unknown")
                llava_analysis = llava_analysis_payload(
                    image_path=image_path,
                    inspection=inspection,
                    ai_analysis_status=AI_ANALYSIS_SUCCESS,
                )
                if inspection.get("moderation") != "SAFE":
                    ai_analysis_status = AI_ANALYSIS_FAILED
                    llava_analysis["ai_analysis_status"] = AI_ANALYSIS_FAILED
                    llava_analysis["fallback_reason"] = "Image moderation returned unsafe."
                    llava_analysis["request_metadata"]["ai_analysis_status"] = AI_ANALYSIS_FAILED
                    llava_analysis["request_metadata"]["fallback_reason"] = "Image moderation returned unsafe."
                    report_logger.warning("[LLaVA] Analysis failed status=%s reason=image-unsafe", ai_analysis_status)
                    delete_uploaded_path(image_path)
                    raise HTTPException(status_code=400, detail="Image rejected as unsafe for the school lost and found system.")
                inspection_tags = inspection.get("tags", [])
                has_primary_description = llava_has_primary_description(llava_analysis)
                if not inspection_tags and not has_primary_description:
                    reason = "LLaVA returned no usable tags or description."
                    report_logger.error("[LLaVA] Image processing stopped for room item %s: %s", index, reason)
                    delete_uploaded_path(image_path)
                    raise HTTPException(status_code=503, detail=f"LLaVA image processing stopped: {reason}")
                if inspection_tags or has_primary_description:
                    weak_image_tags = inspection.get("validation_strength") == "low" or bool(inspection.get("tag_validation_warnings"))
                    ai_result = {
                        "summary": llava_report_summary(llava_analysis),
                        "category": llava_category_or_default(inspection.get("possible_category"), "Other"),
                        "color": ", ".join(clean_ai_list(inspection.get("colours"))[:2]),
                        "tags": inspection_tags,
                        "tag_source": "llava-image-weak" if weak_image_tags else "llava-image",
                    }
                    unverified_ai_analysis = bool(weak_image_tags)
                    llava_analysis["unverified_ai_analysis"] = bool(weak_image_tags)
                    report_logger.info("[LLaVA] Analysis complete status=%s", ai_analysis_status)

            if not ai_result:
                ai_result = generate_text_tag_result(
                    title=cleaned_label or "Lost & Found Room item",
                    description=cleaned_label or "Physical item stored in the lost and found room.",
                    location=LOST_FOUND_ROOM_LABEL,
                    category="Other",
                    color="",
                )
        except HTTPException:
            raise
        except Exception as exc:
            fallback_reason = str(exc) or exc.__class__.__name__
            if image_path:
                llava_analysis = llava_analysis_payload(
                    image_path=image_path,
                    error=exc,
                    fallback_source="",
                    ai_analysis_status=AI_ANALYSIS_FAILED,
                    fallback_reason=fallback_reason,
                )
                report_logger.error("[LLaVA] Image processing stopped for room item %s: %s", index, fallback_reason)
                delete_uploaded_path(image_path)
                raise HTTPException(status_code=503, detail=f"LLaVA image processing stopped: {fallback_reason}") from exc
            raise

        title = cleaned_label or f"Room item {index}"
        description = cleaned_label or "Physical item currently stored in the lost and found room."
        tags: list[str] = []
        for tag in ai_result.get("tags", []):
            normalized = str(tag).strip().lower()
            if normalized and normalized not in tags:
                tags.append(normalized)

        item = LostFoundItem(
            report_type="found",
            reporter_name=current_user.username,
            title=title,
            description=description,
            location=LOST_FOUND_ROOM_LABEL,
            secondary_location="room-upload",
            category=ai_result.get("category") or "Other",
            color=ai_result.get("color") or "",
            time_slot="Unknown",
            event_date=date.today(),
            status="Open",
            tags=tags,
            ai_summary=ai_result.get("summary", ""),
            image_path=image_path,
            llava_analysis_json=json.dumps(llava_analysis, ensure_ascii=False),
            ai_analysis_status=ai_analysis_status,
            unverified_ai_analysis=unverified_ai_analysis,
            search_text=build_search_text(
                title=title,
                description=description,
                location=LOST_FOUND_ROOM_LABEL,
                category=ai_result.get("category") or "Other",
                color=ai_result.get("color") or "",
                tags=tags,
            ),
            tag_source=ai_result.get("tag_source", "fallback-text"),
            submitted_by_user_id=current_user.id,
            claimed=False,
            claim_required=True,
            is_room_item=True,
            room_label=cleaned_label,
            room_recorded_at=datetime.utcnow(),
            evidence_validity="Teacher uploaded",
            review_status="approved",
            review_notes="Teacher uploaded directly to Lost & Found Room.",
        )
        item.evidence_images = [image_path] if image_path else []
        db.add(item)
        db.commit()
        db.refresh(item)
        if image_path:
            report_logger.info("[LLaVA] Attached metadata to report #%s", item.id)
        create_audit_log(
            db,
            user_id=current_user.id,
            action_type="room_item_uploaded",
            entity_type="report",
            entity_id=item.id,
            before_state=None,
            after_state=snapshot_item(item),
            metadata={"route": "/admin/room/items", "image_index": index},
        )
        maybe_notify_potential_matches(db, item=item)
        apply_abuse_analysis(db, current_user=current_user, item=item)
        created_items.append(item)

    reporters = get_user_map(db, [item.submitted_by_user_id or 0 for item in created_items])
    return {
        "message": "Item added to Lost & Found Room" if len(created_items) == 1 else "Items added to Lost & Found Room",
        "items": [serialize_item(item, reporters.get(item.submitted_by_user_id or 0)) for item in created_items],
    }


@app.post("/items/report")
async def report_item(
    payload: ReportPayload,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_teacher_user),
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
    location = payload.location.strip() or "Unknown"
    category = payload.category.strip() or "Other"
    secondary_location = payload.secondary_location.strip()
    location, secondary_location = canonical_report_location(location, secondary_location)

    reporter_name = moderate_field(reporter_name, "Reporter name", min_meaningful_chars=2, max_chars=80)
    title = moderate_field(payload.title, "Item title", min_meaningful_chars=3, max_chars=80)
    description = moderate_field(payload.description, "Item description", min_meaningful_chars=6, max_chars=450)
    evidence_details = payload.evidence_details.strip()
    student_id = payload.student_id.strip()
    contact_info = payload.contact_info.strip()
    color = payload.color.strip()
    time_slot = payload.time_slot.strip() or "Unknown"

    image_path = decode_image_payload(payload.image)
    ai_result = None
    llava_analysis: dict[str, Any] = {}
    ai_analysis_status = AI_ANALYSIS_SUCCESS
    unverified_ai_analysis = False

    try:
        if image_path:
            report_logger.info(
                "[LLaVA] Image detected filename=%s path=%s",
                Path(payload.image.filename or "").name if payload.image else "",
                image_path,
            )
            image_file = resolve_upload_path(image_path)
            image_file_for_inspection = image_file if image_file else (BASE_DIR / image_path.lstrip("/"))
            try:
                report_logger.info("[LLaVA] Sending image to model")
                inspection = inspect_image_upload(str(image_file_for_inspection), item_label=title or reporter_name or "upload")
                report_logger.info("[LLaVA] Model: %s", inspection.get("model") or "unknown")
            except (OSError, requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as exc:
                failure_reason = str(exc) or exc.__class__.__name__
                report_logger.error("[LLaVA] Image processing stopped for item %s: %s", title or "upload", failure_reason)
                llava_analysis = llava_analysis_payload(
                    image_path=image_path or "",
                    error=exc,
                    fallback_source="",
                    ai_analysis_status=AI_ANALYSIS_FAILED,
                    fallback_reason=failure_reason,
                )
                raise HTTPException(status_code=503, detail=f"LLaVA image processing stopped: {failure_reason}") from exc
            else:
                llava_analysis = llava_analysis_payload(
                    image_path=image_path,
                    inspection=inspection,
                    ai_analysis_status=AI_ANALYSIS_SUCCESS,
                )
                if inspection.get("moderation") != "SAFE":
                    ai_analysis_status = AI_ANALYSIS_FAILED
                    llava_analysis["ai_analysis_status"] = AI_ANALYSIS_FAILED
                    llava_analysis["fallback_reason"] = "Image moderation returned unsafe."
                    llava_analysis["request_metadata"]["ai_analysis_status"] = AI_ANALYSIS_FAILED
                    llava_analysis["request_metadata"]["fallback_reason"] = "Image moderation returned unsafe."
                    report_logger.warning("[LLaVA] Analysis failed status=%s reason=image-unsafe", ai_analysis_status)
                    log_ai_package(
                        db,
                        current_user=current_user,
                        route="/items/report/llava-image-analysis",
                        input_text=build_input_text(title, description, evidence_details, location),
                        package=llava_analysis,
                        feature="llava-image-analysis",
                    )
                    delete_uploaded_path(image_path)
                    image_path = None
                    raise HTTPException(
                        status_code=400,
                        detail="Image rejected as unsafe for the school lost and found system.",
                    )

                inspection_tags = inspection.get("tags", [])
                has_primary_description = llava_has_primary_description(llava_analysis)
                if not inspection_tags and not has_primary_description:
                    reason = "LLaVA returned no usable tags or description."
                    llava_analysis["unverified_ai_analysis"] = True
                    llava_analysis["ai_analysis_status"] = AI_ANALYSIS_FAILED
                    llava_analysis["fallback_reason"] = reason
                    llava_analysis["request_metadata"]["ai_analysis_status"] = AI_ANALYSIS_FAILED
                    llava_analysis["request_metadata"]["fallback_reason"] = reason
                    report_logger.error("[LLaVA] Image processing stopped for item %s: %s", title or "upload", reason)
                    raise HTTPException(status_code=503, detail=f"LLaVA image processing stopped: {reason}")
                else:
                    weak_image_tags = inspection.get("validation_strength") == "low" or bool(inspection.get("tag_validation_warnings"))
                    possible_category = llava_category_or_default(inspection.get("possible_category"), category)
                    analysis_colours = clean_ai_list(inspection.get("colours"))
                    ai_result = {
                        "summary": llava_report_summary(llava_analysis),
                        "category": possible_category if category == "Other" else category,
                        "color": color or ", ".join(analysis_colours[:2]),
                        "tags": inspection_tags,
                        "tag_source": "llava-image-weak" if weak_image_tags else "llava-image",
                    }
                    unverified_ai_analysis = bool(weak_image_tags)
                    llava_analysis["unverified_ai_analysis"] = bool(weak_image_tags)
                    report_logger.info("[LLaVA] Analysis complete status=%s", ai_analysis_status)

            log_ai_package(
                db,
                current_user=current_user,
                route="/items/report/llava-image-analysis",
                input_text=build_input_text(title, description, evidence_details, location),
                package=llava_analysis,
                feature="llava-image-analysis",
            )

        moderation = moderate_request(
            db,
            current_user=current_user,
            route="/items/report",
            input_text=build_input_text(title, description, location, category),
        )
        if not moderation.get("allowed", False):
            if image_path:
                delete_uploaded_path(image_path)
            return reject_blocked_request(
                route="/items/report",
                current_user=current_user,
                reason=str(moderation.get("reason", "Request is not relevant to the lost-and-found system.")),
                content=build_input_text(title, description, location, category),
            )

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
        event_date=payload.event_date or date.today(),
        status="Open",
        tags=tags,
        ai_summary=ai_result.get("summary", ""),
        image_path=image_path,
        llava_analysis_json=json.dumps(llava_analysis, ensure_ascii=False),
        ai_analysis_status=ai_analysis_status,
        unverified_ai_analysis=unverified_ai_analysis,
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
        claim_required=bool(payload.claim_required),
    )
    item.evidence_images = [image_path] if image_path else []
    db.add(item)
    db.commit()
    db.refresh(item)
    if image_path:
        report_logger.info("[LLaVA] Attached metadata to report #%s", item.id)
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
    maybe_notify_potential_matches(db, item=item)
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


@app.post("/items/{item_id}/claim-preview")
def preview_claim_region(
    item_id: int,
    payload: ClaimPreviewPayload,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    analysis = analyze_item_region(item, payload.selection)
    return {
        "message": "Selected area analyzed.",
        "preview": analysis,
        "item": serialize_item(item, get_item_reporter(db, item)),
    }


@app.get("/items")
def list_items(
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    location: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    include_room: bool = False,
    room_only: bool = False,
    returned_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    base_query = db.query(LostFoundItem).filter(LostFoundItem.deleted_at.is_(None))

    if room_only:
        base_query = base_query.filter(LostFoundItem.is_room_item.is_(True))
    elif not include_room:
        base_query = base_query.filter(LostFoundItem.is_room_item.is_(False))

    if report_type:
        base_query = base_query.filter(LostFoundItem.report_type == report_type)
    if status:
        base_query = base_query.filter(LostFoundItem.status == status)
    if location:
        base_query = base_query.filter(LostFoundItem.location == location)
    if category:
        base_query = base_query.filter(LostFoundItem.category == category)
    if returned_only:
        base_query = base_query.filter(LostFoundItem.returned_at.is_not(None))

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status.")

    item = fetch_item_or_404(db, item_id)
    ensure_can_manage_item(current_user, item)
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


@app.patch("/items/{item_id}/claim-requirement")
def update_item_claim_requirement(
    item_id: int,
    payload: ClaimRequirementPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    ensure_can_manage_item(current_user, item)
    before_state = snapshot_item(item)
    item.claim_required = bool(payload.claim_required)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="report_edited",
        entity_type="report",
        entity_id=item.id,
        before_state=before_state,
        after_state=snapshot_item(item),
        metadata={"subaction": "claim_requirement_updated", "claim_required": bool(item.claim_required)},
    )
    db.commit()
    db.refresh(item)
    log_admin_action(
        current_user,
        "update-claim-requirement",
        item=item,
        note=f"claim_required={bool(item.claim_required)}",
    )
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Claim requirement updated.", "item": serialize_item(item, reporter)}


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
    if not item.claim_required:
        raise HTTPException(status_code=400, detail="This report allows direct collection and does not require a claim.")

    existing_claim = db.query(Claim).filter(Claim.item_id == item_id, Claim.user_id == current_user.id).first()
    if existing_claim:
        raise HTTPException(status_code=409, detail="You already submitted a claim for this item.")

    moderation_decision = moderate_claim_submission(
        db,
        current_user=current_user,
        route=route,
        input_text=claim_input_text,
    )
    if not moderation_decision.get("allowed", False):
        log_blocked_attempt(
            route=route,
            current_user=current_user,
            reason=str(moderation_decision.get("reason", "Message rejected due to content policy.")).strip() or "Message rejected due to content policy.",
            content=claim_input_text,
        )
        raise HTTPException(status_code=400, detail="Message rejected due to content policy.")

    claim_reason = minimally_validate_field(payload.claim_reason, "Claim reason", min_meaningful_chars=3, max_chars=240)
    item_description = minimally_validate_field(payload.item_description, "Item description", min_meaningful_chars=2, max_chars=240)
    lost_location = minimally_validate_field(payload.lost_location, "Lost location", min_meaningful_chars=2, max_chars=120)
    validate_school_location_codes(lost_location)
    identifying_info = minimally_validate_field(payload.identifying_info, "Identifying info", min_meaningful_chars=2, max_chars=240)

    claim_match = analyze_claim_match(
        claim_reason=claim_reason,
        claim_description=item_description,
        lost_location=lost_location,
        identifying_info=identifying_info,
        item=serialize_item(item, get_item_reporter(db, item)),
    )
    match_score = int(claim_match.get("match_score", 0) or 0)
    match_reasoning = str(claim_match.get("reasoning", "")).strip()
    if match_score < CLAIM_MATCH_MIN_SCORE:
        db.commit()
        return JSONResponse(
            status_code=400,
            content={
                "detail": "Claim details do not match this report closely enough.",
                "match_score": match_score,
                "reasoning": match_reasoning,
            },
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
        match_score=match_score,
        match_reasoning=match_reasoning,
        visual_selection_json=json.dumps(payload.visual_selection or {}),
        visual_summary=str(payload.visual_summary or "").strip()[:240],
        visual_tags_json=json.dumps([
            str(tag).strip().lower()
            for tag in payload.visual_tags[:5]
            if str(tag).strip()
        ]),
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
    notify_claim_submitted(db, item=item, claim=claim, claimant=current_user)
    db.commit()

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


@app.post("/claim-drafts")
def create_claim_draft(
    payload: ClaimDraftPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit("claim", request=request, current_user=current_user)
    item = fetch_item_or_404(db, payload.item_id) if payload.item_id else None
    if item and item.claimed:
        raise HTTPException(status_code=400, detail="This item is already marked as claimed.")
    if item and not item.claim_required:
        raise HTTPException(status_code=400, detail="This report allows direct collection and does not require a claim.")

    title_source = payload.title.strip() or (item.title if item else "")
    title = clean_text(title_source)[:100]
    claim_reason = clean_text(payload.claim_reason)[:240]
    item_description = minimally_validate_field(payload.item_description, "Draft item description", min_meaningful_chars=2, max_chars=240)
    lost_location = clean_text(payload.lost_location)[:120]
    identifying_info = clean_text(payload.identifying_info)[:240]
    source = str(payload.source or "manual").strip().lower()[:40] or "manual"

    draft_input_text = build_input_text(title, claim_reason, item_description, lost_location, identifying_info)
    moderation_decision = moderate_claim_submission(
        db,
        current_user=current_user,
        route="/claim-drafts",
        input_text=draft_input_text,
    )
    if not moderation_decision.get("allowed", False):
        log_blocked_attempt(
            route="/claim-drafts",
            current_user=current_user,
            reason=str(moderation_decision.get("reason", "Message rejected due to content policy.")).strip() or "Message rejected due to content policy.",
            content=draft_input_text,
        )
        raise HTTPException(status_code=400, detail="Message rejected due to content policy.")

    draft = ClaimDraft(
        item_id=item.id if item else None,
        user_id=current_user.id,
        title=title,
        claim_reason=claim_reason,
        item_description=item_description,
        lost_location=lost_location,
        identifying_info=identifying_info,
        visual_selection_json=json.dumps(payload.visual_selection or {}),
        visual_summary=str(payload.visual_summary or "").strip()[:240],
        visual_tags_json=json.dumps([
            str(tag).strip().lower()
            for tag in payload.visual_tags[:5]
            if str(tag).strip()
        ]),
        source=source,
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="claim_draft_created",
        entity_type="claim_draft",
        entity_id=draft.id,
        before_state=None,
        after_state=snapshot_claim_draft(draft),
        metadata={"item_id": draft.item_id, "source": draft.source},
    )
    db.commit()
    reporter = get_item_reporter(db, item) if item else None
    return {
        "message": "Claim draft saved.",
        "draft": serialize_claim_draft(draft, item, current_user, reporter),
    }


@app.get("/claim-drafts")
def list_claim_drafts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    drafts = (
        db.query(ClaimDraft)
        .filter(ClaimDraft.user_id == current_user.id, ClaimDraft.status == "draft")
        .order_by(ClaimDraft.updated_at.desc(), ClaimDraft.created_at.desc())
        .all()
    )
    item_ids = [draft.item_id for draft in drafts if draft.item_id]
    item_map = {
        item.id: item
        for item in db.query(LostFoundItem).filter(LostFoundItem.id.in_(item_ids)).all()
    } if item_ids else {}
    reporter_map = get_user_map(db, [item.submitted_by_user_id or 0 for item in item_map.values()])
    return {
        "drafts": [
            serialize_claim_draft(
                draft,
                item_map.get(draft.item_id),
                current_user,
                reporter_map.get(item_map[draft.item_id].submitted_by_user_id or 0) if draft.item_id in item_map else None,
            )
            for draft in drafts
        ]
    }


@app.post("/claim-drafts/{draft_id}/submit")
def submit_claim_draft(
    draft_id: int,
    payload: ClaimDraftSubmitPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    draft = fetch_claim_draft_or_404(db, draft_id, current_user=current_user)
    if draft.status != "draft":
        raise HTTPException(status_code=409, detail="This draft has already been submitted.")
    item_id = payload.item_id or draft.item_id
    if not item_id:
        raise HTTPException(status_code=400, detail="Attach this draft to an existing report before submitting.")

    result = claim_item(
        item_id,
        ClaimPayload(
            claim_reason=draft.claim_reason or "I believe this item is mine.",
            item_description=draft.item_description,
            lost_location=draft.lost_location,
            identifying_info=draft.identifying_info,
            visual_selection=parse_json_object(draft.visual_selection_json, default={}),
            visual_summary=draft.visual_summary or "",
            visual_tags=parse_json_list(draft.visual_tags_json),
        ),
        request=request,
        current_user=current_user,
        db=db,
    )
    if isinstance(result, JSONResponse):
        return result

    draft.item_id = item_id
    draft.status = "submitted"
    draft.submitted_claim_id = result.get("claim", {}).get("id")
    draft.updated_at = datetime.utcnow()
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="claim_draft_submitted",
        entity_type="claim_draft",
        entity_id=draft.id,
        before_state=None,
        after_state=snapshot_claim_draft(draft),
        metadata={"item_id": item_id, "claim_id": draft.submitted_claim_id},
    )
    db.commit()
    return {
        "message": "Claim draft submitted for review.",
        "claim": result.get("claim"),
        "draft": snapshot_claim_draft(draft),
    }


@app.get("/claims/history")
def claim_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    claims = db.query(Claim).filter(Claim.user_id == current_user.id).order_by(Claim.created_at.desc()).all()
    drafts = (
        db.query(ClaimDraft)
        .filter(ClaimDraft.user_id == current_user.id, ClaimDraft.status == "draft")
        .order_by(ClaimDraft.updated_at.desc(), ClaimDraft.created_at.desc())
        .all()
    )
    all_item_ids = [claim.item_id for claim in claims] + [draft.item_id for draft in drafts if draft.item_id]
    item_map = {
        item.id: item
        for item in db.query(LostFoundItem).filter(LostFoundItem.id.in_(all_item_ids)).all()
    } if all_item_ids else {}
    reporter_map = get_user_map(db, [item.submitted_by_user_id or 0 for item in item_map.values()])
    return {
        "drafts": [
            serialize_claim_draft(
                draft,
                item_map.get(draft.item_id),
                current_user,
                reporter_map.get(item_map[draft.item_id].submitted_by_user_id or 0) if draft.item_id in item_map else None,
            )
            for draft in drafts
        ],
        "claims": [
            serialize_claim(
                claim,
                item_map[claim.item_id],
                current_user,
                reporter_map.get(item_map[claim.item_id].submitted_by_user_id or 0),
            )
            for claim in claims
            if claim.item_id in item_map
        ] + [
            serialize_claim_draft(
                draft,
                item_map.get(draft.item_id),
                current_user,
                reporter_map.get(item_map[draft.item_id].submitted_by_user_id or 0) if draft.item_id in item_map else None,
            )
            for draft in drafts
        ],
    }


@app.post("/items/{item_id}/returned-disputes")
def submit_returned_item_dispute(
    item_id: int,
    payload: ReturnedItemDisputePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    if not item.returned_at:
        raise HTTPException(status_code=400, detail="This item is not in the recently returned list.")

    existing_dispute = (
        db.query(ReturnedItemDispute)
        .filter(
            ReturnedItemDispute.item_id == item.id,
            ReturnedItemDispute.user_id == current_user.id,
            ReturnedItemDispute.status == "pending",
        )
        .first()
    )
    if existing_dispute:
        raise HTTPException(status_code=409, detail="You already submitted a dispute for this returned item.")

    reason = moderate_field(payload.reason, "Dispute reason", min_meaningful_chars=8, max_chars=240)
    dispute = ReturnedItemDispute(
        item_id=item.id,
        user_id=current_user.id,
        reason=reason,
        status="pending",
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="returned_item_disputed",
        entity_type="report",
        entity_id=item.id,
        before_state=None,
        after_state={
            "dispute_id": dispute.id,
            "status": dispute.status,
            "reason": dispute.reason,
        },
        metadata={"item_id": item.id},
    )
    notify_dispute_submitted(db, item=item, dispute=dispute, actor=current_user)
    db.commit()
    return {
        "message": "Your dispute has been sent to the admin team for review.",
        "dispute": serialize_returned_dispute(dispute, item, current_user, get_item_reporter(db, item)),
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


@app.post("/admin/users/{user_id}/role")
def admin_set_user_school_role(
    user_id: int,
    payload: AdminUserRolePayload,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    ensure_target_is_manageable(current_user, user, action="change role for")

    requested_role = str(payload.role or "").strip().lower()
    if requested_role in {"", "auto", "detected"}:
        assigned_role = ""
    else:
        assigned_role = normalize_optional_user_role(requested_role)
        if not assigned_role:
            raise HTTPException(status_code=400, detail="Role must be student, teacher, or auto.")

    before_state = snapshot_user(user)
    detected_role = detect_user_auto_role(user)
    role_detection_log(user, detected_role=detected_role, source="existing_user")
    user.auto_detected_role = detected_role
    user.assigned_role = assigned_role
    user.role = assigned_role or detected_role
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="user_role_updated",
        entity_type="user",
        entity_id=user.id,
        before_state=before_state,
        after_state=snapshot_user(user),
        metadata={
            "assigned_role": assigned_role,
            "auto_detected_role": detected_role,
            "role_source": "assigned" if assigned_role else "auto",
        },
    )
    db.commit()
    db.refresh(user)
    log_admin_action(
        current_user,
        "set-user-role",
        note=f"target_user_id={user.id} assigned_role={assigned_role or 'auto'} auto_detected_role={detected_role}",
    )
    return {
        "message": "User role updated.",
        "user": serialize_admin_user(db, user),
    }


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


def admin_delete_item(
    item_id: int,
    background_tasks: Optional[BackgroundTasks] = None,
    current_user: User = None,
    db: Session = None,
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
    if background_tasks:
        background_tasks.add_task(cleanup_deleted_item_uploads, item.id)
    log_admin_action(current_user, "delete-item", item=item, note=f"title={item.title}")
    return {"message": "Report deleted. You can undo this action shortly.", "item_id": item.id}


@app.delete("/admin/items/{item_id}")
def admin_delete_item_endpoint(
    item_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    return admin_delete_item(item_id, background_tasks=background_tasks, current_user=current_user, db=db)


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
    sync_item_upload_references(item)
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
    user_question_ids = [row.id for row in db.query(QuestionPost.id).filter(QuestionPost.user_id == user.id).all()]
    if user_question_ids:
        db.query(QuestionReply).filter(QuestionReply.question_id.in_(user_question_ids)).delete(synchronize_session=False)
    db.query(QuestionReply).filter(QuestionReply.user_id == user.id).delete()
    db.query(QuestionPost).filter(QuestionPost.user_id == user.id).delete()
    db.query(ClaimDraft).filter(ClaimDraft.user_id == user.id).delete()
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


@app.delete("/admin/query-messages/{message_id}")
def admin_delete_query_message(
    message_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    message = db.query(QueryMessage).filter(QueryMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Query message not found.")

    author = db.query(User).filter(User.id == message.user_id).first()
    before_state = serialize_query(message, author)
    attachment_path = message.attachment_path
    db.delete(message)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="query_message_deleted",
        entity_type="query_message",
        entity_id=message_id,
        before_state=before_state,
        after_state=None,
        metadata={"item_id": before_state.get("item_id"), "message_user_id": before_state.get("user_id")},
    )
    db.commit()
    delete_uploaded_path(attachment_path)
    log_admin_action(current_user, "delete-query-message", note=f"message_id={message_id}")
    return {"message": "Query message deleted.", "message_id": message_id}


@app.delete("/admin/items/{item_id}/query-thread")
def admin_clear_item_query_thread(
    item_id: int,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    messages = (
        db.query(QueryMessage)
        .filter(QueryMessage.item_id == item.id)
        .order_by(QueryMessage.created_at.asc(), QueryMessage.id.asc())
        .all()
    )
    if not messages:
        return {"message": "No query messages to clear.", "item_id": item.id, "deleted_count": 0}

    authors = get_user_map(db, [message.user_id for message in messages])
    before_state = [serialize_query(message, authors.get(message.user_id)) for message in messages]
    attachment_paths = [message.attachment_path for message in messages if message.attachment_path]
    deleted_count = len(messages)
    for message in messages:
        db.delete(message)
    create_audit_log(
        db,
        user_id=current_user.id,
        action_type="query_thread_cleared",
        entity_type="item",
        entity_id=item.id,
        before_state=before_state,
        after_state=[],
        metadata={"item_id": item.id, "deleted_count": deleted_count},
    )
    db.commit()
    for attachment_path in attachment_paths:
        delete_uploaded_path(attachment_path)
    log_admin_action(current_user, "clear-query-thread", item=item, note=f"deleted_count={deleted_count}")
    return {"message": "Item query thread cleared.", "item_id": item.id, "deleted_count": deleted_count}


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
    mark_item_returned(item, claim_id=claim.id)
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
            clear_item_returned(item)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = fetch_item_or_404(db, item_id)
    ensure_can_manage_item(current_user, item)
    before_state = snapshot_item(item)
    mark_item_returned(item)
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
    item.is_room_item = True
    item.room_recorded_at = datetime.utcnow()
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
    maybe_notify_potential_matches(db, item=item)
    db.commit()
    db.refresh(item)
    reporter = db.query(User).filter(User.id == item.submitted_by_user_id).first() if item.submitted_by_user_id else None
    return {"message": "Report moved to the lost and found room.", "item": serialize_item(item, reporter)}


def create_public_question_from_payload(
    db: Session,
    *,
    current_user: User,
    payload: QueryPayload,
    attachment: Optional[dict],
    item_id: Optional[int] = None,
) -> tuple[QuestionPost, QueryMessage]:
    question_text = minimally_validate_field(payload.message, "Question", min_meaningful_chars=3, max_chars=220)
    enforce_structured_question_intent(question_text, item_scoped=bool(item_id))
    question_type = normalize_question_type(payload.question_type)
    location_hint = clean_text(payload.location_hint)[:120]
    normalized_language = resolve_query_preferences(current_user, language=payload.language)
    question = QuestionPost(
        item_id=item_id,
        user_id=current_user.id,
        question_text=question_text,
        question_type=question_type,
        location_hint=location_hint,
        language=normalized_language,
        attachment_name=attachment["original_name"] if attachment else "",
        attachment_path=attachment["path"] if attachment else "",
        attachment_size=attachment["size"] if attachment else None,
        attachment_mime_type=attachment["mime_type"] if attachment else "",
    )
    user_query = QueryMessage(
        item_id=item_id,
        user_id=current_user.id,
        role="user",
        message=question_text,
        chat_mode="question",
        language=normalized_language,
        attachment_name=attachment["original_name"] if attachment else "",
        attachment_path=attachment["path"] if attachment else "",
        attachment_size=attachment["size"] if attachment else None,
        attachment_mime_type=attachment["mime_type"] if attachment else "",
    )
    db.add(question)
    db.add(user_query)
    db.commit()
    db.refresh(question)
    db.refresh(user_query)
    return question, user_query


@app.get("/questions")
def list_questions(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    questions = db.query(QuestionPost).order_by(QuestionPost.created_at.desc(), QuestionPost.id.desc()).limit(80).all()
    authors = get_user_map(db, [question.user_id for question in questions])
    return {
        "questions": [
            serialize_question_post(db, question, authors.get(question.user_id), include_replies=False)
            for question in questions
        ]
    }


@app.get("/questions/{question_id}")
def get_question_thread(
    question_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    question = fetch_question_or_404(db, question_id)
    author = db.query(User).filter(User.id == question.user_id).first()
    return {"question": serialize_question_post(db, question, author, include_replies=True)}


@app.post("/questions/{question_id}/replies")
async def create_question_reply(
    question_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    enforce_rate_limit("chat", request=request, current_user=current_user)
    question = fetch_question_or_404(db, question_id)
    payload, attachment = await parse_question_reply_submission(request)
    route = f"/questions/{question_id}/replies"
    try:
        enforce_lenient_query_moderation(
            db,
            current_user=current_user,
            route=route,
            input_text=payload.message,
        )
        message = minimally_validate_field(payload.message, "Reply", min_meaningful_chars=1, max_chars=320)
        reply_type = normalize_question_reply_type(payload.reply_type)
        suggested_item_id = payload.suggested_item_id
        if suggested_item_id:
            fetch_item_or_404(db, suggested_item_id)
        reply = QuestionReply(
            question_id=question.id,
            user_id=current_user.id,
            message=message,
            reply_type=reply_type,
            suggested_item_id=suggested_item_id,
            attachment_name=attachment["original_name"] if attachment else "",
            attachment_path=attachment["path"] if attachment else "",
            attachment_size=attachment["size"] if attachment else None,
            attachment_mime_type=attachment["mime_type"] if attachment else "",
        )
        db.add(reply)
        if not question.direct_chat_thread_id:
            question.direct_chat_thread_id = f"question-{question.id}"
            question.direct_chat_started_at = datetime.utcnow()
        question.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(reply)
        db.refresh(question)
        notify_question_reply(db, question=question, reply=reply, actor=current_user)
        db.commit()
    except Exception:
        cleanup_query_attachment(attachment)
        raise

    author = db.query(User).filter(User.id == question.user_id).first()
    return {
        "message": "Reply posted.",
        "question": serialize_question_post(db, question, author, include_replies=True),
        "reply": serialize_question_reply(reply, current_user),
        "direct_chat": {
            "thread_id": question.direct_chat_thread_id,
            "started_at": question.direct_chat_started_at.isoformat() if question.direct_chat_started_at else None,
        },
    }


@app.post("/questions/{question_id}/convert-chat")
def convert_question_to_direct_chat(
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    question = fetch_question_or_404(db, question_id)
    if current_user.id != question.user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only the question owner can convert this thread.")
    if not question.direct_chat_thread_id:
        question.direct_chat_thread_id = f"question-{question.id}"
        question.direct_chat_started_at = datetime.utcnow()
        db.commit()
        db.refresh(question)
    author = db.query(User).filter(User.id == question.user_id).first()
    return {
        "message": "Question thread converted to direct chat.",
        "question": serialize_question_post(db, question, author, include_replies=True),
    }


@app.get("/query")
def list_general_queries(
    language: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    normalized_language = resolve_query_preferences(current_user, language=language)
    db.commit()
    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=None)
    questions = db.query(QuestionPost).order_by(QuestionPost.created_at.desc(), QuestionPost.id.desc()).limit(80).all()
    authors = get_user_map(db, [question.user_id for question in questions])
    return {
        "queries": serialize_query_list(db, queries),
        "questions": [
            serialize_question_post(db, question, authors.get(question.user_id), include_replies=False)
            for question in questions
        ],
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
        enforce_lenient_query_moderation(
            db,
            current_user=current_user,
            route=route,
            input_text=payload.message,
        )
        question, user_query = create_public_question_from_payload(
            db,
            current_user=current_user,
            payload=payload,
            attachment=attachment,
            item_id=None,
        )
    except Exception:
        cleanup_query_attachment(attachment)
        raise

    queries = get_query_messages_for_scope(db, user_id=current_user.id, item_id=None)
    questions = db.query(QuestionPost).order_by(QuestionPost.created_at.desc(), QuestionPost.id.desc()).limit(80).all()
    authors = get_user_map(db, [public_question.user_id for public_question in questions])
    matches = structured_query_matches(db, user_query.message)
    return {
        "queries": serialize_query_list(db, queries),
        "question": serialize_question_post(db, question, current_user, include_replies=True),
        "questions": [
            serialize_question_post(db, public_question, authors.get(public_question.user_id), include_replies=False)
            for public_question in questions
        ],
        "matches": matches,
        "matching_questions": matching_public_questions(db, user_query.message, exclude_question_id=question.id),
        "response": {"message": ""},
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
    queries = get_query_messages_for_scope(
        db,
        user_id=current_user.id,
        item_id=item_id,
        include_all_users=current_user.is_admin,
    )
    questions = (
        db.query(QuestionPost)
        .order_by(QuestionPost.created_at.desc(), QuestionPost.id.desc())
        .limit(80)
        .all()
    )
    authors = get_user_map(db, [question.user_id for question in questions])
    return {
        "queries": serialize_query_list(db, queries),
        "questions": [
            serialize_question_post(db, question, authors.get(question.user_id), include_replies=False)
            for question in questions
        ],
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
        enforce_lenient_query_moderation(
            db,
            current_user=current_user,
            route=route,
            input_text=payload.message,
        )
        item = fetch_item_or_404(db, item_id)
        question, user_query = create_public_question_from_payload(
            db,
            current_user=current_user,
            payload=payload,
            attachment=attachment,
            item_id=item_id,
        )
        notify_query_interaction(db, item=item, actor=current_user)
        db.commit()
    except Exception:
        cleanup_query_attachment(attachment)
        raise

    queries = get_query_messages_for_scope(
        db,
        user_id=current_user.id,
        item_id=item_id,
        include_all_users=current_user.is_admin,
    )
    questions = db.query(QuestionPost).order_by(QuestionPost.created_at.desc(), QuestionPost.id.desc()).limit(80).all()
    authors = get_user_map(db, [public_question.user_id for public_question in questions])
    matches = structured_query_matches(
        db,
        build_input_text(user_query.message, item.title, item.category, item.location, item.secondary_location),
    )
    return {
        "queries": serialize_query_list(db, queries),
        "question": serialize_question_post(db, question, current_user, include_replies=True),
        "questions": [
            serialize_question_post(db, public_question, authors.get(public_question.user_id), include_replies=False)
            for public_question in questions
        ],
        "matches": matches,
        "matching_questions": matching_public_questions(db, user_query.message, exclude_question_id=question.id),
        "response": {"message": ""},
        "suggestions": [],
        "language": normalized_language,
    }


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
