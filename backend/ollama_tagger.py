from __future__ import annotations

import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_TEXT_MODEL = os.getenv("OLLAMA_TEXT_MODEL", "smollm2:135m")
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "moondream")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "3"))
OLLAMA_HEALTH_TIMEOUT = float(os.getenv("OLLAMA_HEALTH_TIMEOUT", "2"))

TAGGING_PROMPT_TEMPLATE = "Generate 3 short tags for this item: {description}"
MODERATION_PROMPT = (
    'Return JSON only: {"safe":true,"reason":"short"}. '
    "Mark unsafe for harassment, explicit content, spam, or abusive language."
)
logger = logging.getLogger("ollama_tagger")


def build_search_text(
    title: str,
    description: str,
    location: str,
    category: str,
    color: str,
    tags: list[str],
) -> str:
    parts = [title, description, location, category, color, " ".join(tags)]
    return " ".join(part for part in parts if part).lower()


def fallback_tags(title: str, description: str, category: str, color: str, location: str) -> dict:
    tags = []
    for value in [category, color, location]:
        text = str(value).strip().lower()
        if text and text not in tags and text != "other":
            tags.append(text)

    words = f"{title} {description}".lower().replace(",", " ").split()
    stop_words = {"the", "and", "with", "from", "near", "lost", "found", "black", "white"}
    for word in words:
        clean = "".join(ch for ch in word if ch.isalnum() or ch == "-")
        if len(clean) > 2 and clean not in stop_words and clean not in tags:
            tags.append(clean)
        if len(tags) >= 6:
            break

    for default_tag in ["school-item", "lost-item", "campus"]:
        if default_tag not in tags:
            tags.append(default_tag)
        if len(tags) >= 3:
            break

    return {
        "summary": "basic keyword tags",
        "category": category,
        "color": color,
        "tags": tags[:6],
        "tag_source": "fallback-text",
    }


def image_to_base64(image_path: str) -> str:
    return base64.b64encode(Path(image_path).read_bytes()).decode("utf-8")


def _ollama_root_available() -> bool:
    try:
        logger.debug("Ollama health check request: %s", OLLAMA_URL)
        response = requests.get(OLLAMA_URL, timeout=OLLAMA_HEALTH_TIMEOUT)
        logger.debug("Ollama health check response: status=%s", response.status_code)
        return True
    except requests.RequestException as exc:
        logger.warning("Ollama health check failed: %s", exc)
        return False


def get_ollama_status() -> dict:
    if not _ollama_root_available():
        return {
            "available": False,
            "message": f"Ollama is not reachable at {OLLAMA_URL}. Start it with `ollama serve`.",
            "error": "Health check failed.",
            "vision_model": OLLAMA_VISION_MODEL,
            "text_model": OLLAMA_TEXT_MODEL,
        }

    return {
        "available": True,
        "message": f"Ollama is reachable at {OLLAMA_URL}.",
        "vision_model": OLLAMA_VISION_MODEL,
        "vision_ready": False,
        "text_model": OLLAMA_TEXT_MODEL,
        "text_ready": True,
    }


def _normalize_tags(parsed_tags: list[str]) -> list[str]:
    cleaned = []
    for tag in parsed_tags:
        value = str(tag).strip().lower()
        value = re.sub(r'^[\-\*\d\.\)\s"]+', "", value)
        value = re.sub(r'["]+$', "", value)
        value = re.split(r"\s+-\s+|\s{2,}|:\s", value, maxsplit=1)[0].strip(" ,.-")
        if value and value not in cleaned:
            cleaned.append(value)
    return cleaned[:6]


def _parse_tag_response(content: str) -> list[str]:
    stripped = content.strip()
    if not stripped:
        return []

    quoted_tags = re.findall(r'"([^"]+)"', stripped)
    if quoted_tags:
        return _normalize_tags(quoted_tags)

    numbered_line_tags = []
    for line in stripped.splitlines():
        candidate = line.strip()
        if not candidate or candidate.startswith("-"):
            continue
        candidate = re.sub(r"^\d+[\.\)]\s*", "", candidate)
        if candidate:
            numbered_line_tags.append(candidate)

    if numbered_line_tags:
        return _normalize_tags(numbered_line_tags)

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return _normalize_tags(re.split(r"[,\n]", stripped))

    if isinstance(parsed, dict):
        raw_tags = parsed.get("tags", [])
    elif isinstance(parsed, list):
        raw_tags = parsed
    elif isinstance(parsed, str):
        raw_tags = re.split(r"[,\n]", parsed)
    else:
        raw_tags = []

    return _normalize_tags(raw_tags)


def _call_ollama_generate(model: str, prompt: str) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }

    logger.debug(
        "Ollama request sent: %s",
        {
            "model": model,
            "prompt": prompt,
            "timeout": OLLAMA_TIMEOUT,
        },
    )
    response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=OLLAMA_TIMEOUT)
    response.raise_for_status()
    response_data = response.json()
    logger.debug("Ollama response received: status=%s data=%s", response.status_code, response_data)
    return str(response_data.get("response", "")).strip()


def moderate_text_with_ollama(text: str) -> dict:
    status = get_ollama_status()
    if not status.get("available"):
        return {"safe": True, "reason": "ai moderation unavailable", "source": "local-only"}

    try:
        parsed = json.loads(_call_ollama_generate(OLLAMA_TEXT_MODEL, f"{MODERATION_PROMPT}\n\nText: {text}"))
        return {
            "safe": bool(parsed.get("safe", True)),
            "reason": str(parsed.get("reason", "")).strip() or "ai moderation result",
            "source": "ollama-text",
        }
    except (requests.RequestException, KeyError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Ollama moderation failed: %s", exc)
        return {"safe": True, "reason": "ai moderation fallback", "source": "local-only"}


def tag_item(
    title: str,
    description: str,
    location: str,
    category: str,
    color: str,
    report_type: str,
    image_path: Optional[str] = None,
) -> dict:
    del report_type
    del image_path
    if not _ollama_root_available():
        return fallback_tags(title, description, category, color, location)

    try:
        prompt_text = TAGGING_PROMPT_TEMPLATE.format(description=(description or title).strip())
        raw_response = _call_ollama_generate(OLLAMA_TEXT_MODEL, prompt_text)
        tags = _parse_tag_response(raw_response)
        if not tags:
            raise ValueError("Missing tags in Ollama response.")
        return {
            "summary": "AI-generated tags",
            "category": category,
            "color": color,
            "tags": tags,
            "tag_source": "ollama-text",
        }
    except (requests.RequestException, KeyError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Ollama tagging failed: %s", exc)

    return fallback_tags(title, description, category, color, location)
