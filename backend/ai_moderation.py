from __future__ import annotations

import json
import logging
import re
from functools import lru_cache

import requests

from backend.moderation import BLOCKED_WORDS, clean_text
from backend.ollama_tagger import OLLAMA_TEXT_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL

PROMPT_TEMPLATE = """You are a simple classifier.

Is this about a lost or found item?

Answer ONLY JSON:

{
  "allowed": true/false,
  "reason": "",
  "confidence": 0-1
}

Be lenient:
- allow short phrases
- allow incomplete sentences
- allow simple object mentions

Block ONLY if clearly unrelated."""

logger = logging.getLogger("lostfound.ai_moderation")

ITEM_KEYWORDS = {
    "airpods",
    "bag",
    "bottle",
    "book",
    "calculator",
    "card",
    "charger",
    "earbuds",
    "glasses",
    "headphones",
    "hoodie",
    "id",
    "jacket",
    "key",
    "keys",
    "laptop",
    "notebook",
    "pen",
    "pencil",
    "phone",
    "tablet",
    "uniform",
    "wallet",
    "watch",
}
STOP_WORDS = {
    "a",
    "an",
    "and",
    "anyone",
    "blue",
    "for",
    "found",
    "has",
    "have",
    "in",
    "is",
    "it",
    "lost",
    "me",
    "my",
    "seen",
    "the",
    "this",
    "water",
    "where",
}
CLEARLY_UNRELATED_PATTERNS = [
    re.compile(r"\btell me a joke\b", re.IGNORECASE),
    re.compile(r"\b(?:fav|favorite)\b.*\b(movie|music|song|food|color)\b", re.IGNORECASE),
    re.compile(r"\bwhat is your\b.*\b(movie|music|song|food|color)\b", re.IGNORECASE),
    re.compile(r"\bhello\b.*\bhow are you\b", re.IGNORECASE),
    re.compile(r"^\s*(hello|hi|hey)\s*$", re.IGNORECASE),
    re.compile(r"\bweather\b", re.IGNORECASE),
]
SPAM_PATTERNS = [
    re.compile(r"(.)\1{6,}"),
    re.compile(r"https?://|www\.", re.IGNORECASE),
]


def _coerce_confidence(value: object, default: float) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return default
    return max(0.0, min(1.0, confidence))


def _extract_keywords(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9-]+", text.lower())
    keywords: list[str] = []

    for word in words:
        if word in ITEM_KEYWORDS and word not in keywords:
            keywords.append(word)

    if keywords:
        return keywords[:6]

    for word in words:
        if len(word) < 3 or word in STOP_WORDS or word in keywords:
            continue
        keywords.append(word)
        if len(keywords) >= 6:
            break

    return keywords


def _clear_invalid_reason(text: str) -> str:
    lowered = text.lower()
    words = set(re.findall(r"[a-z']+", lowered))

    if words & BLOCKED_WORDS:
        return "Blocked: offensive content."

    if any(pattern.search(text) for pattern in SPAM_PATTERNS):
        return "Blocked: obvious spam."

    if any(pattern.search(text) for pattern in CLEARLY_UNRELATED_PATTERNS):
        return "Blocked: clearly unrelated to a lost or found item."

    return ""


def _format_raw_log(raw_output: str, parsed_json: dict | None, fallback_reason: str | None) -> str:
    return json.dumps(
        {
            "raw_model_output": raw_output,
            "parsed_json": parsed_json,
            "fallback_reason": fallback_reason,
        },
        ensure_ascii=True,
    )


def _extract_json_block(raw_output: str) -> dict:
    decoder = json.JSONDecoder()
    for index, char in enumerate(raw_output):
        if char != "{":
            continue
        try:
            parsed, _ = decoder.raw_decode(raw_output[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("No JSON object found in moderation output.")


def _fallback_decision(text: str, fallback_reason: str, raw_output: str = "") -> dict:
    return {
        "allowed": True,
        "reason": "Fallback: assumed relevant",
        "confidence": 0.5,
        "tags": _extract_keywords(text),
        "raw_output": _format_raw_log(raw_output, None, fallback_reason),
        "fallback_triggered": True,
    }


def _finalize_decision(text: str, parsed: dict, raw_output: str) -> dict:
    if not isinstance(parsed, dict):
        raise ValueError("Moderation JSON must be an object.")

    explicit_allow = parsed.get("allowed")
    confidence = _coerce_confidence(parsed.get("confidence"), 0.5)
    clear_invalid_reason = _clear_invalid_reason(text)
    clearly_invalid = bool(clear_invalid_reason)

    allowed = True
    reason = str(parsed.get("reason", "")).strip()
    if clearly_invalid:
        allowed = False
        confidence = max(confidence, 0.9)
        reason = clear_invalid_reason
    elif explicit_allow is False and confidence >= 0.6:
        allowed = True
        reason = "Allowed: not clearly invalid."
    elif not reason:
        reason = "Relevant lost-and-found request."

    return {
        "allowed": allowed,
        "reason": reason,
        "confidence": confidence,
        "tags": _extract_keywords(text),
        "raw_output": _format_raw_log(raw_output, parsed, None),
        "fallback_triggered": False,
    }


@lru_cache(maxsize=512)
def _classify_cached(cleaned_text: str) -> str:
    prompt = f"{PROMPT_TEMPLATE}\n\nInput: {cleaned_text}"
    payload = {
        "model": OLLAMA_TEXT_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    logger.info("Sending moderation request to Ollama: %s", {"model": OLLAMA_TEXT_MODEL, "prompt": prompt[:320]})
    response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=OLLAMA_TIMEOUT)
    response.raise_for_status()
    data = response.json()
    logger.info("Received moderation response from Ollama: %s", data)
    raw_output = str(data.get("response", "")).strip()
    parsed = _extract_json_block(raw_output)
    decision = _finalize_decision(cleaned_text, parsed, raw_output)
    return json.dumps(decision)


def classify_user_input(text: str) -> dict:
    cleaned_text = clean_text(text)
    try:
        decision = json.loads(_classify_cached(cleaned_text))
        return decision
    except requests.Timeout:
        fallback_reason = "timeout"
        logger.exception("Moderation request timed out; allowing via fallback.")
        return _fallback_decision(cleaned_text, fallback_reason)
    except (requests.RequestException, ValueError, json.JSONDecodeError, TypeError) as exc:
        fallback_reason = f"{type(exc).__name__}: {exc}"
        logger.exception("Moderation request failed; allowing via fallback.")
        return _fallback_decision(
            cleaned_text,
            fallback_reason,
        )
