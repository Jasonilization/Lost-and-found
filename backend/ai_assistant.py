from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Optional

import requests

from backend.ollama_tagger import OLLAMA_TEXT_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL

AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama").strip().lower()
AI_MODEL = os.getenv("AI_CHAT_MODEL", os.getenv("OLLAMA_CHAT_MODEL", OLLAMA_TEXT_MODEL or "llama3:8b")).strip() or "llama3:8b"
AI_TIMEOUT = float(os.getenv("AI_CHAT_TIMEOUT", str(max(OLLAMA_TIMEOUT, 20.0))))
AI_API_URL = os.getenv("AI_API_URL", "").strip()
AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
DEFAULT_SYSTEM_PROMPT = (
    "You are the Lost & Found campus assistant. "
    "Be context-aware, specific, concise, and helpful. "
    "Never answer with placeholders like [not found]. "
    "Prefer concrete references to item title, description, category, location, evidence, and recent chat context."
)


def model_size_label(model_name: str) -> str:
    match = re.search(r"(\d+(?:\.\d+)?)\s*[bB]", model_name or "")
    if match:
        return f"{match.group(1)}B"
    return "unknown"


def _extract_json_object(raw_output: str) -> dict[str, Any]:
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
    raise ValueError("No JSON object found in model output.")


def _call_ollama(prompt: str, system_prompt: str) -> str:
    payload = {
        "model": AI_MODEL,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
    }
    response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=AI_TIMEOUT)
    response.raise_for_status()
    data = response.json()
    return str(data.get("response", "")).strip()


def _call_hosted(prompt: str, system_prompt: str) -> str:
    if not AI_API_URL or not AI_API_KEY:
        raise RuntimeError("Hosted AI endpoint is not configured.")

    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }
    response = requests.post(
        AI_API_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {AI_API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=AI_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    message = choices[0].get("message", {}) if choices else {}
    return str(message.get("content", "")).strip()


def call_ai_json(
    *,
    prompt: str,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    fallback_payload: Optional[dict[str, Any]] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    provider = AI_PROVIDER if AI_PROVIDER in {"ollama", "hosted"} else "ollama"
    raw_output = ""
    fallback_triggered = False

    try:
        raw_output = _call_hosted(prompt, system_prompt) if provider == "hosted" else _call_ollama(prompt, system_prompt)
        parsed = _extract_json_object(raw_output)
    except Exception as exc:
        fallback_triggered = True
        if fallback_payload is None:
            raise
        parsed = dict(fallback_payload)
        parsed.setdefault("fallback_reason", f"{type(exc).__name__}: {exc}")

    return {
        "parsed": parsed,
        "prompt_text": prompt,
        "output_text": raw_output,
        "model_name": AI_MODEL,
        "model_size": model_size_label(AI_MODEL),
        "fallback_triggered": fallback_triggered,
        "request_metadata": metadata or {},
    }


def _format_history(history: list[dict[str, Any]]) -> str:
    if not history:
        return "No prior conversation."
    lines = []
    for entry in history[-10:]:
        role = str(entry.get("role", "user")).strip() or "user"
        speaker = "assistant" if role == "system" else "user"
        message = str(entry.get("message", "")).strip()
        if message:
            lines.append(f"{speaker}: {message}")
    return "\n".join(lines) if lines else "No prior conversation."


def _format_item_context(item: Optional[dict[str, Any]]) -> str:
    if not item:
        return "No specific item selected."
    fields = [
        f"Title: {item.get('title') or 'Unknown'}",
        f"Description: {item.get('description') or 'Unknown'}",
        f"Category: {item.get('category') or 'Unknown'}",
        f"Location: {item.get('location') or 'Unknown'}",
        f"Status: {item.get('status') or 'Open'}",
        f"Evidence details: {item.get('evidence_details') or 'None'}",
        f"Evidence summary: {item.get('evidence_summary') or 'None'}",
        f"Evidence inconsistencies: {item.get('evidence_inconsistencies') or 'None'}",
        f"Missing information: {item.get('evidence_missing_info') or 'None'}",
    ]
    return "\n".join(fields)


def _format_catalog_context(items: list[dict[str, Any]]) -> str:
    if not items:
        return "No current items available."

    now = datetime.utcnow()
    lines = []
    today_items = 0
    for item in items[:12]:
        created_at = item.get("created_at")
        if created_at:
            try:
                if datetime.fromisoformat(created_at) >= now - timedelta(days=1):
                    today_items += 1
            except ValueError:
                pass
        lines.append(
            f"- #{item.get('id')}: {item.get('title') or 'Untitled'} | "
            f"{item.get('category') or 'Unknown'} | {item.get('location') or 'Unknown'} | "
            f"status={item.get('status') or 'Open'}"
        )
    summary = f"Recent items in the system: {len(items)} total, about {today_items} reported in the last 24 hours."
    return f"{summary}\n" + "\n".join(lines)


def generate_query_package(
    *,
    user_message: str,
    item: Optional[dict[str, Any]],
    history: list[dict[str, Any]],
    catalog_items: list[dict[str, Any]],
) -> dict[str, Any]:
    contextual_mode = "item" if item else "general"
    prompt = f"""
Return ONLY valid JSON with this shape:
{{
  "reply": "assistant reply",
  "suggestions": ["question 1", "question 2", "question 3", "question 4"],
  "reasoning_focus": "short internal summary for admins"
}}

Rules:
- Suggestions must be distinct, useful, and grounded in the current context.
- Avoid generic filler.
- If an item is selected, mention its actual title/location/category where helpful.
- If no item is selected, answer using the available item catalog context.
- Never output [not found].

Mode: {contextual_mode}

Selected item context:
{_format_item_context(item)}

Recent chat history:
{_format_history(history)}

Catalog context:
{_format_catalog_context(catalog_items)}

Latest user message:
{user_message}
""".strip()

    fallback_reply = (
        f'I saved your question about "{item.get("title")}". '
        f'It is currently listed in {item.get("location") or "the recorded location"}. '
        "Try asking about claim steps, evidence details, or when it was reported."
    ) if item else (
        "I couldn't reach the AI model just now, but you can ask about recently reported items, categories, or locations."
    )

    result = call_ai_json(
        prompt=prompt,
        fallback_payload={
            "reply": fallback_reply,
            "suggestions": [
                "What items were found today?",
                "Has anyone reported a lost phone?",
                "Which locations have the most reports?",
                "How do I claim an item?",
            ] if not item else [
                f"Where was {item.get('title') or 'this item'} found?",
                "When was it reported?",
                "How can I claim this item?",
                "Are there more identifying details?",
            ],
            "reasoning_focus": "Fallback response due to AI failure.",
        },
        metadata={
            "mode": contextual_mode,
            "selected_item_id": item.get("id") if item else None,
            "history_count": len(history),
            "catalog_count": len(catalog_items),
        },
    )
    parsed = result["parsed"]
    suggestions = [
        str(value).strip()
        for value in parsed.get("suggestions", [])
        if str(value).strip()
    ]
    result["reply"] = str(parsed.get("reply", "")).strip() or fallback_reply
    result["suggestions"] = list(dict.fromkeys(suggestions))[:5]
    result["reasoning_focus"] = str(parsed.get("reasoning_focus", "")).strip()
    return result


def analyze_evidence(
    *,
    title: str,
    description: str,
    category: str,
    location: str,
    evidence_details: str,
    has_image: bool,
) -> dict[str, Any]:
    prompt = f"""
Return ONLY valid JSON:
{{
  "summary": "brief evidence summary",
  "inconsistencies": "possible inconsistency or 'None noted'",
  "missing_info": "missing information or 'None noted'",
  "validity": "Likely valid | Needs review | Incomplete"
}}

Report title: {title}
Description: {description}
Category: {category}
Location: {location}
Evidence details: {evidence_details or 'None'}
Image attached: {"yes" if has_image else "no"}
""".strip()

    fallback = {
        "summary": f"{title} reported in {location} under {category}.",
        "inconsistencies": "None noted",
        "missing_info": "Add more identifying marks or ownership clues if available.",
        "validity": "Needs review",
    }
    result = call_ai_json(
        prompt=prompt,
        fallback_payload=fallback,
        metadata={
            "feature": "evidence-analysis",
            "category": category,
            "location": location,
            "has_image": has_image,
        },
    )
    parsed = result["parsed"]
    result["summary"] = str(parsed.get("summary", fallback["summary"])).strip()
    result["inconsistencies"] = str(parsed.get("inconsistencies", fallback["inconsistencies"])).strip()
    result["missing_info"] = str(parsed.get("missing_info", fallback["missing_info"])).strip()
    result["validity"] = str(parsed.get("validity", fallback["validity"])).strip() or "Needs review"
    return result
