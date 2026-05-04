from __future__ import annotations

import base64
import json
import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_TEXT_MODEL = os.getenv("OLLAMA_TEXT_MODEL", "llama3:8b")
OLLAMA_IMAGE_MODEL = os.getenv("OLLAMA_IMAGE_MODEL", "llava").strip() or "llava"
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "20"))
OLLAMA_HEALTH_TIMEOUT = float(os.getenv("OLLAMA_HEALTH_TIMEOUT", "2"))
MAX_TAGS = 8

TAGGING_PROMPT_TEMPLATE = "Generate 3 short tags for this item: {description}"
IMAGE_TAGGING_PROMPT = (
    "Analyze this image of a lost item.\n"
    "Return ONLY a list of 5-8 short tags.\n"
    "Use commas if possible.\n"
    "Focus on object type, color, brand, and distinctive features."
)
IMAGE_MODERATION_PROMPT = (
    "Is this image appropriate for a school lost and found system?\n"
    "Answer ONLY: SAFE or UNSAFE."
)
IMAGE_INSPECTION_PROMPT = (
    "Perform both checks below on the same image in one pass.\n"
    f"Safety prompt:\n{IMAGE_MODERATION_PROMPT}\n"
    f"Tagging prompt:\n{IMAGE_TAGGING_PROMPT}\n"
    'If possible, return JSON like {"moderation":"SAFE","tags":["tag1","tag2"]}.\n'
    "If the image is inappropriate, reply with UNSAFE."
)

logger = logging.getLogger("ollama_tagger")

PRIORITY_TAGS = {
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
TAG_STOP_WORDS = {
    "a",
    "an",
    "and",
    "anyone",
    "for",
    "found",
    "from",
    "has",
    "in",
    "lost",
    "near",
    "seen",
    "the",
    "this",
    "with",
}

_LLAVA_STATE_LOCK = threading.Lock()
_LLAVA_RUNTIME_STATE: dict[str, Any] = {
    "last_call_timestamp": None,
    "last_status": "failed",
    "last_latency_ms": 0.0,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _record_llava_result(*, success: bool, latency_ms: float, timestamp: Optional[str] = None) -> None:
    with _LLAVA_STATE_LOCK:
        _LLAVA_RUNTIME_STATE["last_call_timestamp"] = timestamp or _utc_now_iso()
        _LLAVA_RUNTIME_STATE["last_status"] = "success" if success else "failed"
        _LLAVA_RUNTIME_STATE["last_latency_ms"] = round(float(latency_ms), 2)


def get_llava_runtime_state() -> dict[str, Any]:
    with _LLAVA_STATE_LOCK:
        return dict(_LLAVA_RUNTIME_STATE)


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


def _extract_keyword_tags(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9-]+", text.lower())
    tags: list[str] = []

    for word in words:
        if word in PRIORITY_TAGS and word not in tags:
            tags.append(word)

    for word in words:
        if len(tags) >= MAX_TAGS:
            break
        if len(word) <= 2 or word in TAG_STOP_WORDS or word in tags:
            continue
        tags.append(word)

    return tags[:MAX_TAGS]


def fallback_tags(title: str, description: str, category: str, color: str, location: str) -> dict:
    tags = []
    for value in _extract_keyword_tags(f"{title} {description}"):
        if value and value not in tags:
            tags.append(value)

    for value in [category, color, location]:
        text = str(value).strip().lower()
        if text and text not in tags and text != "other":
            tags.append(text)

    for default_tag in ["school-item", "lost-item", "campus"]:
        if default_tag not in tags:
            tags.append(default_tag)
        if len(tags) >= 3:
            break

    return {
        "summary": "basic keyword tags",
        "category": category,
        "color": color,
        "tags": tags[:MAX_TAGS],
        "tag_source": "fallback-text",
    }


def merge_tag_lists(*tag_groups: list[str], limit: int = MAX_TAGS) -> list[str]:
    merged: list[str] = []
    for tag_group in tag_groups:
        for tag in tag_group or []:
            normalized = str(tag).strip().lower()
            if normalized and normalized not in merged:
                merged.append(normalized)
            if len(merged) >= limit:
                return merged[:limit]
    return merged[:limit]


def image_to_base64(image_path: str) -> str:
    return base64.b64encode(Path(image_path).read_bytes()).decode("utf-8")


def ping_ollama() -> tuple[bool, float]:
    started = time.perf_counter()
    try:
        requests.get(OLLAMA_URL, timeout=OLLAMA_HEALTH_TIMEOUT)
    except requests.RequestException as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        logger.info("Ollama health check failed: %s", exc)
        return False, latency_ms
    latency_ms = (time.perf_counter() - started) * 1000
    return True, latency_ms


def _ollama_root_available() -> bool:
    available, _latency_ms = ping_ollama()
    return available


def get_ollama_status() -> dict:
    available, latency_ms = ping_ollama()
    if not available:
        return {
            "available": False,
            "message": f"Ollama is not reachable at {OLLAMA_URL}. Start it with `ollama serve`.",
            "error": "Health check failed.",
            "text_model": OLLAMA_TEXT_MODEL,
            "image_model": "",
            "image_ready": False,
            "latency_ms": round(latency_ms, 2),
        }

    return {
        "available": True,
        "message": f"Ollama is reachable at {OLLAMA_URL}.",
        "text_model": OLLAMA_TEXT_MODEL,
        "text_ready": True,
        "image_model": OLLAMA_IMAGE_MODEL,
        "image_ready": True,
        "latency_ms": round(latency_ms, 2),
    }


def _list_ollama_models() -> list[str]:
    response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=OLLAMA_HEALTH_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    models = payload.get("models", [])
    names: list[str] = []
    for model in models:
        name = str(model.get("name") or model.get("model") or "").strip()
        if name:
            names.append(name)
    return names


def get_available_image_model() -> str:
    if not _ollama_root_available():
        return ""

    try:
        available_models = _list_ollama_models()
    except requests.RequestException as exc:
        logger.warning("Could not list Ollama models for image tagging: %s", exc)
        return ""

    if OLLAMA_IMAGE_MODEL in available_models:
        return OLLAMA_IMAGE_MODEL

    if ":" not in OLLAMA_IMAGE_MODEL:
        latest_alias = f"{OLLAMA_IMAGE_MODEL}:latest"
        if latest_alias in available_models:
            logger.info("Resolved Ollama image model alias %s -> %s", OLLAMA_IMAGE_MODEL, latest_alias)
            return latest_alias

    for available_model in available_models:
        if available_model.split(":", 1)[0] == OLLAMA_IMAGE_MODEL:
            logger.info("Resolved Ollama image model alias %s -> %s", OLLAMA_IMAGE_MODEL, available_model)
            return available_model

    logger.warning("No multimodal Ollama model available for image tagging. Checked: %s", OLLAMA_IMAGE_MODEL)
    return ""


def _normalize_tags(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values:
        normalized = str(value).strip().lower()
        normalized = normalized.strip("`'\"[]{}()<>")
        normalized = re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", normalized)
        if normalized and normalized not in cleaned:
            cleaned.append(normalized)
        if len(cleaned) >= MAX_TAGS:
            break
    return cleaned[:MAX_TAGS]


def _coerce_json_text(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def _split_raw_tag_text(text: str) -> list[str]:
    parts = re.split(r"[\s,]+", text)
    return _normalize_tags(parts)


def _parse_tag_response(content: str) -> list[str]:
    stripped = _coerce_json_text(content)
    if not stripped:
        return []

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return _split_raw_tag_text(stripped)

    if isinstance(parsed, dict):
        raw_tags = parsed.get("tags", [])
        if isinstance(raw_tags, list):
            flattened: list[str] = []
            for value in raw_tags:
                flattened.extend(_split_raw_tag_text(str(value)))
            return _normalize_tags(flattened)
        if isinstance(raw_tags, str):
            return _split_raw_tag_text(raw_tags)
        return _split_raw_tag_text(stripped)

    if isinstance(parsed, list):
        flattened = []
        for value in parsed:
            flattened.extend(_split_raw_tag_text(str(value)))
        return _normalize_tags(flattened)

    if isinstance(parsed, str):
        return _split_raw_tag_text(parsed)

    return _split_raw_tag_text(stripped)


def _parse_moderation(content: str) -> str:
    stripped = _coerce_json_text(content)
    if not stripped:
        return "SAFE"

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return "UNSAFE" if stripped.upper() == "UNSAFE" else "SAFE"

    if isinstance(parsed, dict):
        moderation = str(parsed.get("moderation", "")).strip().upper()
        if moderation in {"SAFE", "UNSAFE"}:
            return moderation
    return "SAFE"


def _build_ollama_payload(model: str, prompt: str, *, images: Optional[list[str]] = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if images:
        payload["images"] = images
    return payload


def _payload_debug_summary(payload: dict[str, Any]) -> dict[str, Any]:
    images = payload.get("images") or []
    return {
        "model": str(payload.get("model", "")).strip(),
        "prompt": str(payload.get("prompt", "")).strip(),
        "has_images": bool(images),
        "images_count": len(images),
        "image_base64_lengths": [len(str(image or "")) for image in images],
        "stream": bool(payload.get("stream", False)),
    }


def _call_ollama_generate(
    model: str,
    prompt: str,
    *,
    images: Optional[list[str]] = None,
    track_ai: bool = False,
) -> str:
    payload = _build_ollama_payload(model, prompt, images=images)
    logger.info("[LLaVA] request payload: %s", _payload_debug_summary(payload))
    started = time.perf_counter()
    timestamp = _utc_now_iso()
    try:
        response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=OLLAMA_TIMEOUT)
        response.raise_for_status()
        response_data = response.json()
        raw_response = str(response_data.get("response", "")).strip()
    except requests.RequestException:
        if track_ai:
            _record_llava_result(success=False, latency_ms=(time.perf_counter() - started) * 1000, timestamp=timestamp)
        raise
    except (ValueError, json.JSONDecodeError):
        if track_ai:
            _record_llava_result(success=False, latency_ms=(time.perf_counter() - started) * 1000, timestamp=timestamp)
        raise

    if track_ai:
        _record_llava_result(
            success=bool(raw_response),
            latency_ms=(time.perf_counter() - started) * 1000,
            timestamp=timestamp,
        )
    return raw_response


def _parse_inspection_response(content: str) -> dict[str, Any]:
    stripped = _coerce_json_text(content)
    if not stripped:
        raise ValueError("Missing image inspection response.")

    moderation = _parse_moderation(stripped)
    tags = _parse_tag_response(stripped)
    return {
        "moderation": moderation,
        "tags": tags[:MAX_TAGS],
        "raw": stripped,
    }


def inspect_image_upload(image_path: str, *, item_label: str = "upload") -> dict[str, Any]:
    normalized_path = Path(str(image_path or "")).expanduser()
    if not normalized_path.exists() or not normalized_path.is_file():
        raise ValueError(f"Image path is missing or invalid: {image_path}")

    if not _ollama_root_available():
        raise RuntimeError("Ollama is unavailable.")

    model = get_available_image_model()
    if not model:
        raise RuntimeError(f"Required image model '{OLLAMA_IMAGE_MODEL}' is unavailable.")

    file_bytes = normalized_path.read_bytes()
    if not file_bytes:
        raise ValueError(f"Image file was empty: {normalized_path.name}")

    encoded_image = base64.b64encode(file_bytes).decode("utf-8")
    logger.info("[LLaVA] tagging started for item %s", item_label)
    logger.info("[LLaVA] image file bytes: %s", len(file_bytes))
    logger.info("[LLaVA] image base64 length: %s", len(encoded_image))
    raw_response = _call_ollama_generate(
        model,
        IMAGE_INSPECTION_PROMPT,
        images=[encoded_image],
        track_ai=True,
    )
    logger.info("[LLaVA RAW] %s", raw_response)
    inspection = _parse_inspection_response(raw_response)
    logger.info("[LLaVA] moderation result: %s", inspection["moderation"])
    logger.info("[LLaVA TAGS] %s", inspection["tags"])
    inspection["llava_called"] = True
    inspection["image_file_bytes"] = len(file_bytes)
    inspection["image_base64_length"] = len(encoded_image)
    return inspection


def debug_image_request(
    image_path: str,
    *,
    item_label: str = "debug",
    prompt: Optional[str] = None,
    parse_inspection: bool = False,
) -> dict[str, Any]:
    normalized_path = Path(str(image_path or "")).expanduser()
    if not normalized_path.exists() or not normalized_path.is_file():
        raise ValueError(f"Image path is missing or invalid: {image_path}")

    if not _ollama_root_available():
        raise RuntimeError("Ollama is unavailable.")

    model = get_available_image_model()
    if not model:
        raise RuntimeError(f"Required image model '{OLLAMA_IMAGE_MODEL}' is unavailable.")

    file_bytes = normalized_path.read_bytes()
    encoded_image = base64.b64encode(file_bytes).decode("utf-8")
    request_prompt = str(prompt or IMAGE_INSPECTION_PROMPT)
    payload = _build_ollama_payload(model, request_prompt, images=[encoded_image])

    logger.info("[LLaVA] debug request started for item %s", item_label)
    logger.info("[LLaVA] debug image file bytes: %s", len(file_bytes))
    logger.info("[LLaVA] debug image base64 length: %s", len(encoded_image))
    logger.info("[LLaVA] debug request payload: %s", _payload_debug_summary(payload))

    raw_response = _call_ollama_generate(model, request_prompt, images=[encoded_image], track_ai=True)
    logger.info("[LLaVA RAW] %s", raw_response)

    parsed: dict[str, Any] | None = None
    parse_error = ""
    if parse_inspection:
        try:
            parsed = _parse_inspection_response(raw_response)
        except ValueError as exc:
            parse_error = str(exc)

    return {
        "model": model,
        "item_label": item_label,
        "image_path": str(normalized_path),
        "image_file_bytes": len(file_bytes),
        "image_base64_length": len(encoded_image),
        "request_payload": _payload_debug_summary(payload),
        "raw_response": raw_response,
        "parsed_inspection": parsed,
        "parse_error": parse_error,
    }


def generate_text_tag_result(
    title: str,
    description: str,
    location: str,
    category: str,
    color: str,
) -> dict:
    if not _ollama_root_available():
        return fallback_tags(title, description, category, color, location)

    try:
        prompt_text = TAGGING_PROMPT_TEMPLATE.format(description=(description or title).strip())
        raw_response = _call_ollama_generate(OLLAMA_TEXT_MODEL, prompt_text)
        tags = _parse_tag_response(raw_response)
        if not tags:
            raise ValueError("Missing tags in Ollama response.")
        return {
            "summary": "AI-generated text tags",
            "category": category,
            "color": color,
            "tags": tags[:MAX_TAGS],
            "tag_source": "ollama-text",
        }
    except (requests.RequestException, KeyError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Ollama text tagging failed: %s", exc)

    return fallback_tags(title, description, category, color, location)


def generate_tags_from_image(image_path: str) -> list[str]:
    try:
        inspection = inspect_image_upload(image_path)
        if inspection["moderation"] != "SAFE":
            logger.warning("[LLaVA] tagging skipped because moderation returned %s", inspection["moderation"])
            return []
        return inspection["tags"][:MAX_TAGS]
    except (OSError, requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        logger.warning("[LLaVA] tagging failed: %s", exc)
        return []


def moderate_image_for_school(image_path: str, *, item_label: str = "upload") -> str:
    try:
        inspection = inspect_image_upload(image_path, item_label=item_label)
        return str(inspection["moderation"])
    except (OSError, requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        logger.warning("[LLaVA] moderation failed: %s", exc)
        raise


def generate_image_tags(image_path: str) -> list[str]:
    return generate_tags_from_image(image_path)


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
    if not image_path:
        return generate_text_tag_result(title, description, location, category, color)
    try:
        inspection = inspect_image_upload(image_path)
    except (OSError, requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        logger.warning("[LLaVA] hard failure during tag_item: %s", exc)
        return generate_text_tag_result(title, description, location, category, color)

    if inspection["moderation"] != "SAFE":
        return {
            "summary": "Unsafe image",
            "category": category,
            "color": color,
            "tags": [],
            "tag_source": "llava-image",
        }

    return {
        "summary": "[LLaVA] using raw output",
        "category": category,
        "color": color,
        "tags": inspection["tags"][:MAX_TAGS],
        "tag_source": "llava-image",
    }
