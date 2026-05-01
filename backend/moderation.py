from __future__ import annotations

import re

from fastapi import HTTPException

BLOCKED_WORDS = {
    "asshole",
    "bastard",
    "bitch",
    "fuck",
    "nude",
    "porn",
    "shit",
}

INITIALS_RE = re.compile(r"^[a-z]+(?:\.[a-z]+)+$")
LINK_RE = re.compile(r"(https?://|www\.)", re.IGNORECASE)
REPEATED_CHAR_RE = re.compile(r"(.)\1{5,}")
WORD_RE = re.compile(r"[a-z']+")


def clean_text(value: str) -> str:
    text = " ".join(str(value or "").split())
    text = re.sub(r"[^\w\s.,!?()'/:&-]", "", text)
    text = re.sub(r"([!?.,:/&-])\1{2,}", r"\1", text)
    return text.strip()


def validate_initials(value: str) -> str:
    cleaned = clean_text(value)
    if not INITIALS_RE.fullmatch(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Initials must be lowercase and formatted like name.initial.",
        )
    return cleaned


def validate_class_of(value: int) -> int:
    if not isinstance(value, int) or value < 2025 or value > 2035:
        raise HTTPException(status_code=400, detail="Class of must be a year between 2025 and 2035.")
    return value


def validate_text_input(
    value: str,
    field_label: str,
    *,
    min_meaningful_chars: int,
    max_chars: int,
) -> tuple[str, bool]:
    cleaned = clean_text(value)
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_label} is required.")
    if len(cleaned) > max_chars:
        raise HTTPException(status_code=400, detail=f"{field_label} must be {max_chars} characters or fewer.")

    meaningful_chars = len(re.findall(r"[A-Za-z0-9]", cleaned))
    if meaningful_chars < min_meaningful_chars:
        raise HTTPException(status_code=400, detail=f"{field_label} needs more meaningful detail.")
    if LINK_RE.search(cleaned):
        raise HTTPException(status_code=400, detail=f"{field_label} cannot contain links.")
    if REPEATED_CHAR_RE.search(cleaned):
        raise HTTPException(status_code=400, detail=f"{field_label} looks spammy. Please rewrite it.")

    words = set(WORD_RE.findall(cleaned.lower()))
    if words & BLOCKED_WORDS:
        raise HTTPException(status_code=400, detail=f"{field_label} contains blocked language.")

    suspicious = bool(
        re.search(r"(dm me|contact me|telegram|whatsapp|urgent|cash)", cleaned, re.IGNORECASE)
        or sum(1 for char in cleaned if char in "!?") >= 4
    )
    return cleaned, suspicious
