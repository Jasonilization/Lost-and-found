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

from backend.config import OLLAMA_HOST, OLLAMA_MODEL

OLLAMA_URL = OLLAMA_HOST
OLLAMA_TEXT_MODEL = os.getenv("OLLAMA_TEXT_MODEL", OLLAMA_MODEL).strip() or OLLAMA_MODEL
OLLAMA_IMAGE_MODEL = os.getenv("OLLAMA_IMAGE_MODEL", "llava").strip() or "llava"
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120"))
OLLAMA_HEALTH_TIMEOUT = float(os.getenv("OLLAMA_HEALTH_TIMEOUT", "2"))
MAX_TAGS = 8
VISION_MODEL_MARKERS = (
    "llava",
    "bakllava",
    "vision",
    "vl",
    "moondream",
    "minicpm-v",
)

TAGGING_PROMPT_TEMPLATE = "Generate 3 short tags for this item: {description}"
IMAGE_TAGGING_PROMPT = (
    "Analyze this image of a lost item.\n"
    "Return ONLY a list of 5-8 short tags.\n"
    "Use commas if possible.\n"
    "Focus on object type, color, material, brand, visible text, condition, and distinctive features."
)
IMAGE_MODERATION_PROMPT = (
    "Is this image appropriate for a school lost and found system?\n"
    "Answer ONLY: SAFE or UNSAFE."
)
IMAGE_INSPECTION_PROMPT = (
    "Perform both checks below on the same image in one pass.\n"
    f"Safety prompt:\n{IMAGE_MODERATION_PROMPT}\n"
    f"Tagging prompt:\n{IMAGE_TAGGING_PROMPT}\n"
    "Return strict JSON with keys: moderation, item_description, object_type, colours, notable_markings, possible_category, confidence_score, tags.\n"
    "Return valid JSON only. Do not use markdown, prose outside JSON, or multi-line string values.\n"
    "Keep tags as a JSON array of 5-8 specific lowercase noun phrases, maximum 5 words each.\n"
    "Prefer detailed tags like \"blue metal bottle\", \"black cap\", \"nike logo\", \"scratched case\" over generic single words.\n"
    "Use confidence_score as an integer from 0 to 100.\n"
    'Example: {"moderation":"SAFE","item_description":"blue Nike water bottle with black cap","object_type":"water bottle","colours":["blue","black"],"notable_markings":["Nike logo"],"possible_category":"Bottle","confidence_score":92,"tags":["blue bottle","nike","black cap"]}.\n'
    "If the image is inappropriate, reply with UNSAFE."
)

logger = logging.getLogger("ollama_tagger")
LLAVA_DEBUG_PREFIX = "[LLAVA TRACE]"

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
GENERIC_IMAGE_TAGS = {
    "campus",
    "item",
    "object",
    "school",
    "school item",
    "school-item",
    "lost item",
    "lost-item",
    "found item",
    "found-item",
    "unknown item",
}
INSPECTION_FIELD_KEYS = (
    "moderation",
    "item_description",
    "object_description",
    "object_type",
    "item_classification",
    "colours",
    "colors",
    "notable_markings",
    "markings",
    "distinctive_features",
    "possible_category",
    "category",
    "confidence_score",
    "confidence",
    "scene_context",
    "tags",
)
INSPECTION_FIELD_PATTERN = re.compile(
    r'(?im)(?:^|[,{]\s*|\n\s*)"?('
    + "|".join(re.escape(key) for key in INSPECTION_FIELD_KEYS)
    + r')"?\s*:\s*'
)
MISSING_IMAGE_RESPONSE_PATTERN = re.compile(
    r"\b(?:cannot|can't|unable|not able|do not|don't)\b.*\b(?:see|view|access|inspect|analy[sz]e)\b.*\bimage\b",
    re.IGNORECASE,
)
DESCRIPTIVE_OBJECT_PATTERN = re.compile(
    r"\b(?:black|blue|brown|gold|gray|green|grey|orange|pink|purple|red|silver|white|yellow)"
    r"(?:\s+[a-z0-9-]+){0,2}\s+"
    r"(?:bag|bottle|book|calculator|card|case|charger|glasses|headphones|hoodie|jacket|key|keys|laptop|notebook|phone|tablet|uniform|wallet|watch)\b",
    re.IGNORECASE,
)
VISUAL_FEATURE_TAGS = (
    "stickers",
    "scratched case",
    "scratch",
    "scratched",
    "dent",
    "dented",
    "scuffed",
    "loop cap",
    "plastic",
    "metal",
    "antique",
)

_LLAVA_STATE_LOCK = threading.Lock()
_LLAVA_RUNTIME_STATE: dict[str, Any] = {
    "last_call_timestamp": None,
    "last_status": "failed",
    "last_latency_ms": 0.0,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _log_llava_debug(message: str, **details: Any) -> None:
    if details:
        detail_text = " ".join(f"{key}={details[key]!r}" for key in sorted(details))
        logger.info("%s %s %s", LLAVA_DEBUG_PREFIX, message, detail_text)
        return
    logger.info("%s %s", LLAVA_DEBUG_PREFIX, message)


def _ollama_generate_endpoint() -> str:
    return f"{OLLAMA_URL}/api/generate" if OLLAMA_URL else ""


def _describe_llava_error(exc: BaseException) -> str:
    if isinstance(exc, json.JSONDecodeError) or exc.__class__.__name__ == "JSONDecodeError":
        return f"invalid JSON: {exc}"
    if isinstance(exc, requests.Timeout):
        return f"timeout: {exc}"
    if isinstance(exc, requests.ConnectionError):
        message = str(exc)
        label = "connection refused" if "refused" in message.lower() else "connection error"
        return f"{label}: {message}"
    if isinstance(exc, requests.HTTPError):
        response = exc.response
        status_code = getattr(response, "status_code", None)
        body = getattr(response, "text", "")
        return f"http error status_code={status_code} body={body!r} error={exc}"
    if isinstance(exc, requests.RequestException):
        return f"request error: {exc}"
    return f"{exc.__class__.__name__}: {exc}"


def _log_llava_request_not_sent(*, endpoint: str, model: str, error: str) -> None:
    _log_llava_debug("3. payload built (show payload structure): no", error=error)
    _log_llava_debug("4. endpoint used", endpoint=endpoint)
    _log_llava_debug("5. model used", model=model)
    _log_llava_debug("6. request sent (yes/no): no", error=error)
    _log_llava_debug("7. response status code", status_code=None)
    _log_llava_debug("8. error", error=error)


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
    if not OLLAMA_URL:
        _log_llava_debug("Ollama reachable: false", endpoint="", request_sent=False, error="OLLAMA_HOST is unset")
        return False, 0.0
    _log_llava_debug("Ollama reachability check", endpoint=OLLAMA_URL, request_sent=True)
    try:
        response = requests.get(OLLAMA_URL, timeout=OLLAMA_HEALTH_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        logger.info("Ollama health check failed: %s", exc)
        _log_llava_debug(
            "Ollama reachable: false",
            endpoint=OLLAMA_URL,
            request_sent=True,
            error=_describe_llava_error(exc),
            latency_ms=round(latency_ms, 2),
            status_code=getattr(getattr(exc, "response", None), "status_code", None),
        )
        return False, latency_ms
    latency_ms = (time.perf_counter() - started) * 1000
    _log_llava_debug(
        "Ollama reachable: true",
        endpoint=OLLAMA_URL,
        status_code=response.status_code,
        response_body=response.text,
        latency_ms=round(latency_ms, 2),
    )
    return True, latency_ms


def _ollama_root_available() -> bool:
    available, _latency_ms = ping_ollama()
    return available


def _resolve_model_name(preferred_model: str, available_models: list[str]) -> str:
    model = (preferred_model or "").strip()
    if not model:
        return ""
    if model in available_models:
        return model
    if ":" not in model:
        latest_alias = f"{model}:latest"
        if latest_alias in available_models:
            return latest_alias
    for available_model in available_models:
        if available_model.split(":", 1)[0] == model:
            return available_model
    return ""


def is_vision_capable_model(model: str) -> bool:
    normalized = str(model or "").strip().lower()
    if not normalized:
        return False
    return any(marker in normalized for marker in VISION_MODEL_MARKERS)


def get_ollama_status() -> dict:
    available, latency_ms = ping_ollama()
    if not available:
        host_label = OLLAMA_URL or "an unset OLLAMA_HOST"
        return {
            "available": False,
            "host": OLLAMA_URL,
            "message": f"Ollama is not reachable at {host_label}. Configure OLLAMA_HOST.",
            "error": "Health check failed.",
            "text_model": OLLAMA_TEXT_MODEL,
            "text_ready": False,
            "image_model": "",
            "image_ready": False,
            "models": [],
            "latency_ms": round(latency_ms, 2),
        }

    models: list[str] = []
    model_error = ""
    try:
        models = _list_ollama_models()
    except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
        model_error = str(exc)
        logger.warning("Could not list Ollama models: %s", exc)

    resolved_text_model = _resolve_model_name(OLLAMA_TEXT_MODEL, models)
    resolved_image_model = _resolve_model_name(OLLAMA_IMAGE_MODEL, models)
    image_model_ready = bool(resolved_image_model and is_vision_capable_model(resolved_image_model))

    return {
        "available": True,
        "host": OLLAMA_URL,
        "message": f"Ollama is reachable at {OLLAMA_URL}.",
        "text_model": resolved_text_model or OLLAMA_TEXT_MODEL,
        "text_ready": bool(resolved_text_model),
        "image_model": resolved_image_model or OLLAMA_IMAGE_MODEL,
        "image_ready": image_model_ready,
        "models": models,
        "error": model_error,
        "latency_ms": round(latency_ms, 2),
    }


def _list_ollama_models() -> list[str]:
    endpoint = f"{OLLAMA_URL}/api/tags"
    _log_llava_debug("/api/tags request", endpoint=endpoint, request_sent=True)
    response: Optional[requests.Response] = None
    try:
        response = requests.get(endpoint, timeout=OLLAMA_HEALTH_TIMEOUT)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        _log_llava_debug(
            "/api/tags responds: false",
            endpoint=endpoint,
            status_code=getattr(response, "status_code", getattr(getattr(exc, "response", None), "status_code", None)),
            response_body=getattr(response, "text", ""),
            error=_describe_llava_error(exc),
        )
        raise
    except (ValueError, json.JSONDecodeError) as exc:
        _log_llava_debug(
            "/api/tags responds: false",
            endpoint=endpoint,
            status_code=getattr(response, "status_code", None),
            response_body=getattr(response, "text", ""),
            error=_describe_llava_error(exc),
        )
        raise

    _log_llava_debug(
        "/api/tags responds: true",
        endpoint=endpoint,
        status_code=response.status_code,
        response_body=response.text,
    )
    models = payload.get("models", [])
    names: list[str] = []
    for model in models:
        name = str(model.get("name") or model.get("model") or "").strip()
        if name:
            names.append(name)
    return names


def get_available_image_model() -> str:
    if not _ollama_root_available():
        _log_llava_debug(
            "image model resolution stopped",
            request_sent=False,
            endpoint=_ollama_generate_endpoint(),
            reason="Ollama root is unavailable",
        )
        _log_llava_debug("Model available: false", configured_model=OLLAMA_IMAGE_MODEL, reason="Ollama is unreachable")
        return ""

    try:
        available_models = _list_ollama_models()
    except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Could not list Ollama models for image tagging: %s", exc)
        _log_llava_debug("Model available: false", configured_model=OLLAMA_IMAGE_MODEL, error=_describe_llava_error(exc))
        return ""

    resolved_model = _resolve_model_name(OLLAMA_IMAGE_MODEL, available_models)
    if resolved_model:
        if not is_vision_capable_model(resolved_model):
            logger.warning(
                "[LLaVA] Refusing image analysis with non-vision model: %s",
                resolved_model,
            )
            _log_llava_debug("image model rejected", model=resolved_model, reason="not vision-capable")
            _log_llava_debug(
                "Model available: false",
                configured_model=OLLAMA_IMAGE_MODEL,
                resolved_model=resolved_model,
                reason="not vision-capable",
            )
            return ""
        if resolved_model != OLLAMA_IMAGE_MODEL:
            logger.info("Resolved Ollama image model alias %s -> %s", OLLAMA_IMAGE_MODEL, resolved_model)
        _log_llava_debug("image model resolved", configured_model=OLLAMA_IMAGE_MODEL, resolved_model=resolved_model)
        _log_llava_debug(
            "Model available: true",
            configured_model=OLLAMA_IMAGE_MODEL,
            resolved_model=resolved_model,
            available_models=available_models,
        )
        return resolved_model

    logger.warning("No multimodal Ollama model available for image tagging. Checked: %s", OLLAMA_IMAGE_MODEL)
    _log_llava_debug(
        "image model unavailable",
        configured_model=OLLAMA_IMAGE_MODEL,
        available_models=available_models,
    )
    _log_llava_debug(
        "Model available: false",
        configured_model=OLLAMA_IMAGE_MODEL,
        available_models=available_models,
    )
    return ""


def _normalize_tags(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values:
        normalized = str(value).strip().lower()
        normalized = normalized.strip("`'\"[]{}()<>")
        normalized = re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", normalized)
        normalized = re.sub(r"\s+", " ", normalized)
        if len(normalized) > 48 or len(normalized.split()) > 6:
            continue
        if ":" in normalized:
            continue
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


def _coerce_loose_value(raw_value: str) -> Any:
    value = str(raw_value or "").strip()
    value = value.rstrip(",").strip()
    value = value.rstrip("}").strip()
    if not value:
        return ""

    if value.startswith("["):
        end_index = value.rfind("]")
        list_text = value[:end_index + 1] if end_index >= 0 else value
        try:
            parsed = json.loads(list_text)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return [str(entry).strip() for entry in parsed if str(entry).strip()]
        return [
            entry.strip().strip("`'\"[]{}()<>")
            for entry in re.split(r"[,;\n]+", list_text.strip("[]"))
            if entry.strip().strip("`'\"[]{}()<>")
        ]

    value = value.strip("`")
    if value.startswith(("'", '"')):
        value = value[1:]
    if value.endswith(("'", '"')):
        value = value[:-1]
    return re.sub(r"\s+", " ", value).strip()


def _parse_loose_inspection_object(content: str) -> dict[str, Any]:
    stripped = _coerce_json_text(content).strip()
    if not stripped:
        return {}

    matches = list(INSPECTION_FIELD_PATTERN.finditer(stripped))
    if not matches:
        return {}

    parsed: dict[str, Any] = {}
    for index, match in enumerate(matches):
        key = match.group(1).lower()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(stripped)
        value = _coerce_loose_value(stripped[start:end])
        if value != "":
            parsed[key] = value
    return parsed


def _extract_descriptive_tags(text: str) -> list[str]:
    normalized_text = re.sub(r"\s+", " ", str(text or "").lower())
    tags: list[str] = []

    for match in DESCRIPTIVE_OBJECT_PATTERN.finditer(normalized_text):
        tags.append(match.group(0))

    for feature in VISUAL_FEATURE_TAGS:
        if re.search(rf"\b{re.escape(feature)}\b", normalized_text):
            tags.append(feature)

    if not tags:
        tags.extend(_extract_keyword_tags(normalized_text))

    return _normalize_tags(tags)


def _split_raw_tag_text(text: str) -> list[str]:
    if re.search(r"[,;\n]", text):
        return _normalize_tags(re.split(r"[,;\n]+", text))
    return _extract_descriptive_tags(text)


def _validate_image_tags(tags: list[str]) -> tuple[list[str], str, list[str], str]:
    cleaned = _normalize_tags(tags)
    useful_tags = [
        tag for tag in cleaned
        if tag not in GENERIC_IMAGE_TAGS
        and " ".join(part for part in re.split(r"[-\s]+", tag) if part) not in GENERIC_IMAGE_TAGS
    ]

    if cleaned and not useful_tags:
        return [], "Image tags were too generic to use.", [], "invalid"
    if useful_tags and len(useful_tags) < 3:
        return useful_tags, "", ["Image tags were shorter than preferred and were kept with low confidence."], "low"
    return useful_tags, "", [], "normal"


def _parse_tag_response(content: str) -> list[str]:
    stripped = _coerce_json_text(content)
    if not stripped:
        return []

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        loose_parsed = _parse_loose_inspection_object(stripped)
        if loose_parsed:
            raw_tags = loose_parsed.get("tags", [])
            if isinstance(raw_tags, list):
                return _normalize_tags([str(value) for value in raw_tags])
            if isinstance(raw_tags, str):
                return _split_raw_tag_text(raw_tags)
            return []
        return _split_raw_tag_text(stripped)

    if isinstance(parsed, dict):
        raw_tags = parsed.get("tags", [])
        if isinstance(raw_tags, list):
            return _normalize_tags([str(value) for value in raw_tags])
        if isinstance(raw_tags, str):
            return _split_raw_tag_text(raw_tags)
        return []

    if isinstance(parsed, list):
        return _normalize_tags([str(value) for value in parsed])

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
        parsed = _parse_loose_inspection_object(stripped)
        if not parsed:
            return "UNSAFE" if stripped.upper() == "UNSAFE" else "SAFE"

    if isinstance(parsed, dict):
        moderation = str(parsed.get("moderation", "")).strip().upper()
        if moderation in {"SAFE", "UNSAFE"}:
            return moderation
    return "SAFE"


def _parse_inspection_object(content: str) -> dict[str, Any]:
    try:
        parsed = json.loads(_coerce_json_text(content))
    except json.JSONDecodeError:
        return _parse_loose_inspection_object(content)
    return parsed if isinstance(parsed, dict) else {}


def _inspection_text_field(parsed: dict[str, Any], key: str) -> str:
    value = parsed.get(key)
    if isinstance(value, (list, tuple)):
        value = " ".join(str(entry).strip() for entry in value if str(entry).strip())
    return str(value or "").strip()


def _inspection_list_field(parsed: dict[str, Any], *keys: str) -> list[str]:
    values: list[str] = []
    for key in keys:
        raw_value = parsed.get(key)
        if isinstance(raw_value, str):
            candidates = re.split(r"[,;\n]+", raw_value)
        elif isinstance(raw_value, (list, tuple, set)):
            candidates = [str(entry) for entry in raw_value]
        else:
            candidates = []
        for candidate in candidates:
            text = re.sub(r"\s+", " ", str(candidate or "").strip())
            if text and text not in values:
                values.append(text)
    return values[:8]


def _inspection_confidence_score(parsed: dict[str, Any]) -> int:
    raw_value = (
        parsed.get("confidence_score")
        if "confidence_score" in parsed
        else parsed.get("confidence")
    )
    if raw_value is None:
        return 0
    if isinstance(raw_value, str):
        raw_value = raw_value.strip().rstrip("%")
    try:
        score = float(raw_value)
    except (TypeError, ValueError):
        return 0
    if 0 < score <= 1:
        score *= 100
    return max(0, min(100, int(round(score))))


def _inspection_tags_from_fields(
    *,
    object_type: str,
    colours: list[str],
    notable_markings: list[str],
    possible_category: str,
) -> list[str]:
    candidates: list[str] = []
    clean_object_type = re.sub(r"\s+", " ", str(object_type or "").strip().lower())
    clean_category = re.sub(r"\s+", " ", str(possible_category or "").strip().lower())

    if clean_object_type:
        for colour in colours[:2]:
            clean_colour = re.sub(r"\s+", " ", str(colour or "").strip().lower())
            if clean_colour and clean_colour not in clean_object_type:
                candidates.append(f"{clean_colour} {clean_object_type}")
        candidates.append(clean_object_type)

    candidates.extend(str(marking or "").strip().lower() for marking in notable_markings[:4])
    if clean_object_type:
        for marking in notable_markings[:3]:
            clean_marking = re.sub(r"\s+", " ", str(marking or "").strip().lower())
            if clean_marking and clean_object_type not in clean_marking:
                candidates.append(f"{clean_marking} {clean_object_type}")
    if clean_category and clean_category != "other":
        candidates.append(clean_category)

    return _normalize_tags(candidates)


def _build_ollama_payload(model: str, prompt: str, *, images: Optional[list[str]] = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if images is not None:
        if not images or not all(str(image or "").strip() for image in images):
            raise ValueError("missing images field: images must contain at least one base64 string.")
        payload["images"] = images
    return payload


def _payload_debug_summary(payload: dict[str, Any]) -> dict[str, Any]:
    images = payload.get("images") or []
    prompt_text = str(payload.get("prompt", "") or "")
    return {
        "keys": list(payload.keys()),
        "model": str(payload.get("model", "")).strip(),
        "prompt_present": bool(prompt_text.strip()),
        "prompt_chars": len(prompt_text),
        "images_field_type": "array" if isinstance(payload.get("images"), list) else type(payload.get("images")).__name__,
        "has_images": bool(images),
        "images_count": len(images),
        "image_base64_lengths": [len(str(image or "")) for image in images],
        "uses_images_field": "images" in payload,
        "uses_image_field": "image" in payload,
        "stream": bool(payload.get("stream", False)),
    }


def _call_ollama_generate(
    model: str,
    prompt: str,
    *,
    images: Optional[list[str]] = None,
    track_ai: bool = False,
    trace_lifecycle: bool = False,
) -> str:
    endpoint = _ollama_generate_endpoint()
    try:
        payload = _build_ollama_payload(model, prompt, images=images)
    except ValueError as exc:
        if trace_lifecycle:
            _log_llava_request_not_sent(endpoint=endpoint, model=model, error=_describe_llava_error(exc))
        raise

    payload_summary = _payload_debug_summary(payload)
    logger.info("[LLaVA] request payload: %s", payload_summary)
    if trace_lifecycle:
        _log_llava_debug("3. payload built (show payload structure): yes", payload_structure=payload_summary)
        _log_llava_debug("4. endpoint used", endpoint=endpoint)
        _log_llava_debug("5. model used", model=model)
    else:
        _log_llava_debug(
            "backend -> ollama request path",
            endpoint=endpoint,
            request_sent=False,
            payload=payload_summary,
        )
    started = time.perf_counter()
    timestamp = _utc_now_iso()
    response: Optional[requests.Response] = None
    try:
        if trace_lifecycle:
            _log_llava_debug("6. request sent (yes/no): yes", endpoint=endpoint)
        else:
            _log_llava_debug("request sent", endpoint=endpoint, request_sent=True)
        response = requests.post(endpoint, json=payload, timeout=OLLAMA_TIMEOUT)
        if trace_lifecycle:
            _log_llava_debug("7. response status code", status_code=response.status_code)
            _log_llava_debug("8. response body", response_body=response.text)
        else:
            _log_llava_debug(
                "response received",
                endpoint=endpoint,
                status_code=response.status_code,
                response_body=response.text,
            )
        response.raise_for_status()
        response_data = response.json()
        raw_response = str(response_data.get("response", "")).strip()
    except requests.RequestException as exc:
        if track_ai:
            _record_llava_result(success=False, latency_ms=(time.perf_counter() - started) * 1000, timestamp=timestamp)
        error_text = _describe_llava_error(exc)
        if trace_lifecycle:
            if response is None:
                _log_llava_debug("7. response status code", status_code=None)
            _log_llava_debug("8. error", error=error_text, latency_ms=round((time.perf_counter() - started) * 1000, 2))
        else:
            _log_llava_debug(
                "request error",
                endpoint=endpoint,
                request_sent=True,
                error=error_text,
                latency_ms=round((time.perf_counter() - started) * 1000, 2),
            )
        raise
    except (ValueError, json.JSONDecodeError) as exc:
        if track_ai:
            _record_llava_result(success=False, latency_ms=(time.perf_counter() - started) * 1000, timestamp=timestamp)
        error_text = f"invalid JSON response: {exc}"
        if trace_lifecycle:
            _log_llava_debug("8. error", error=error_text, response_body=getattr(response, "text", ""))
        else:
            _log_llava_debug(
                "payload or response parse error",
                endpoint=endpoint,
                request_sent=True,
                error=error_text,
                latency_ms=round((time.perf_counter() - started) * 1000, 2),
            )
        raise

    if track_ai:
        _record_llava_result(
            success=bool(raw_response),
            latency_ms=(time.perf_counter() - started) * 1000,
            timestamp=timestamp,
        )
    if not trace_lifecycle:
        _log_llava_debug(
            "response parsed",
            endpoint=endpoint,
            status_code=getattr(response, "status_code", None),
            response_body=raw_response,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
        )
    return raw_response


def _parse_inspection_response(content: str) -> dict[str, Any]:
    stripped = _coerce_json_text(content)
    if not stripped:
        raise ValueError("Missing image inspection response.")
    if MISSING_IMAGE_RESPONSE_PATTERN.search(stripped):
        raise ValueError("Image model did not inspect the uploaded image.")

    moderation = _parse_moderation(stripped)
    parsed = _parse_inspection_object(stripped)
    item_description = (
        _inspection_text_field(parsed, "item_description")
        or _inspection_text_field(parsed, "object_description")
    )
    object_type = (
        _inspection_text_field(parsed, "object_type")
        or _inspection_text_field(parsed, "item_classification")
    )
    colours = _inspection_list_field(parsed, "colours", "colors")
    notable_markings = _inspection_list_field(parsed, "notable_markings", "markings", "distinctive_features")
    possible_category = _inspection_text_field(parsed, "possible_category") or _inspection_text_field(parsed, "category")
    field_tags = _inspection_tags_from_fields(
        object_type=object_type,
        colours=colours,
        notable_markings=notable_markings,
        possible_category=possible_category,
    )
    raw_tags = merge_tag_lists(_parse_tag_response(stripped), field_tags, limit=MAX_TAGS)
    tags, validation_error, validation_warnings, validation_strength = _validate_image_tags(raw_tags)
    return {
        "moderation": moderation,
        "item_description": item_description,
        "object_type": object_type,
        "colours": colours,
        "notable_markings": notable_markings,
        "possible_category": possible_category,
        "confidence_score": _inspection_confidence_score(parsed),
        "object_description": item_description,
        "item_classification": object_type,
        "scene_context": _inspection_text_field(parsed, "scene_context"),
        "tags": tags[:MAX_TAGS],
        "tag_validation_error": validation_error,
        "tag_validation_warnings": validation_warnings,
        "validation_strength": validation_strength,
        "raw": stripped,
    }


def inspect_image_upload(image_path: str, *, item_label: str = "upload") -> dict[str, Any]:
    endpoint = _ollama_generate_endpoint()
    normalized_path = Path(str(image_path or "")).expanduser()
    if not normalized_path.exists() or not normalized_path.is_file():
        error = f"Image path is missing or invalid: {image_path}"
        _log_llava_debug("1. image received (yes/no): no", image_path=str(normalized_path), item_label=item_label)
        _log_llava_debug("2. base64 encoding success (yes/no): no", error=error)
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise ValueError(f"Image path is missing or invalid: {image_path}")
    _log_llava_debug("1. image received (yes/no): yes", image_path=str(normalized_path), item_label=item_label)

    logger.info("[LLaVA] Image detected")
    try:
        file_bytes = normalized_path.read_bytes()
    except OSError as exc:
        error = _describe_llava_error(exc)
        _log_llava_debug("2. base64 encoding success (yes/no): no", error=error)
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise
    if not file_bytes:
        error = f"Image file was empty: {normalized_path.name}"
        _log_llava_debug("2. base64 encoding success (yes/no): no", image_file_bytes=0, error=error)
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise ValueError(error)

    encoded_image = base64.b64encode(file_bytes).decode("utf-8")
    _log_llava_debug(
        "2. base64 encoding success (yes/no): yes",
        image_file_bytes=len(file_bytes),
        image_base64_length=len(encoded_image),
    )
    model = get_available_image_model()
    if not model:
        error = f"Required vision model '{OLLAMA_IMAGE_MODEL}' is unavailable."
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise RuntimeError(error)
    if not is_vision_capable_model(model):
        error = f"Configured model '{model}' is not vision-capable."
        _log_llava_request_not_sent(endpoint=endpoint, model=model, error=error)
        raise RuntimeError(error)

    logger.info("[LLaVA] tagging started for item %s", item_label)
    logger.info("[LLaVA] image file bytes: %s", len(file_bytes))
    logger.info("[LLaVA] image base64 length: %s", len(encoded_image))
    logger.info("[LLaVA] Sending image to model")
    logger.info("[LLaVA] Model: %s", model)
    raw_response = _call_ollama_generate(
        model,
        IMAGE_INSPECTION_PROMPT,
        images=[encoded_image],
        track_ai=True,
        trace_lifecycle=True,
    )
    logger.info("[LLaVA RAW] %s", raw_response)
    inspection = _parse_inspection_response(raw_response)
    logger.info("[LLaVA] moderation result: %s", inspection["moderation"])
    logger.info("[LLaVA TAGS] %s", inspection["tags"])
    inspection["llava_called"] = True
    inspection["model"] = model
    inspection["image_file_bytes"] = len(file_bytes)
    inspection["image_base64_length"] = len(encoded_image)
    logger.info("[LLaVA] Analysis complete")
    return inspection


def debug_image_request(
    image_path: str,
    *,
    item_label: str = "debug",
    prompt: Optional[str] = None,
    parse_inspection: bool = False,
) -> dict[str, Any]:
    endpoint = _ollama_generate_endpoint()
    normalized_path = Path(str(image_path or "")).expanduser()
    if not normalized_path.exists() or not normalized_path.is_file():
        error = f"Image path is missing or invalid: {image_path}"
        _log_llava_debug("1. image received (yes/no): no", image_path=str(normalized_path), item_label=item_label)
        _log_llava_debug("2. base64 encoding success (yes/no): no", error=error)
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise ValueError(error)
    _log_llava_debug("1. image received (yes/no): yes", image_path=str(normalized_path), item_label=item_label)

    try:
        file_bytes = normalized_path.read_bytes()
    except OSError as exc:
        error = _describe_llava_error(exc)
        _log_llava_debug("2. base64 encoding success (yes/no): no", error=error)
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise
    if not file_bytes:
        error = f"Image file was empty: {normalized_path.name}"
        _log_llava_debug("2. base64 encoding success (yes/no): no", image_file_bytes=0, error=error)
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise ValueError(error)

    encoded_image = base64.b64encode(file_bytes).decode("utf-8")
    _log_llava_debug(
        "2. base64 encoding success (yes/no): yes",
        image_file_bytes=len(file_bytes),
        image_base64_length=len(encoded_image),
    )

    model = get_available_image_model()
    if not model:
        error = f"Required vision model '{OLLAMA_IMAGE_MODEL}' is unavailable."
        _log_llava_request_not_sent(endpoint=endpoint, model=OLLAMA_IMAGE_MODEL, error=error)
        raise RuntimeError(error)
    if not is_vision_capable_model(model):
        error = f"Configured model '{model}' is not vision-capable."
        _log_llava_request_not_sent(endpoint=endpoint, model=model, error=error)
        raise RuntimeError(error)
    request_prompt = str(prompt or IMAGE_INSPECTION_PROMPT)
    payload = _build_ollama_payload(model, request_prompt, images=[encoded_image])

    logger.info("[LLaVA] debug request started for item %s", item_label)
    logger.info("[LLaVA] debug image file bytes: %s", len(file_bytes))
    logger.info("[LLaVA] debug image base64 length: %s", len(encoded_image))
    logger.info("[LLaVA] debug request payload: %s", _payload_debug_summary(payload))
    logger.info("[LLaVA] Sending image to model")
    logger.info("[LLaVA] Model: %s", model)

    raw_response = _call_ollama_generate(
        model,
        request_prompt,
        images=[encoded_image],
        track_ai=True,
        trace_lifecycle=True,
    )
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
        logger.warning("[LLaVA] image tagging stopped: %s", _describe_llava_error(exc))
        raise


def moderate_image_for_school(image_path: str, *, item_label: str = "upload") -> str:
    try:
        inspection = inspect_image_upload(image_path, item_label=item_label)
        return str(inspection["moderation"])
    except (OSError, requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        logger.warning("[LLaVA] image moderation stopped: %s", _describe_llava_error(exc))
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
        logger.warning("[LLaVA] image tag_item stopped: %s", _describe_llava_error(exc))
        raise

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
