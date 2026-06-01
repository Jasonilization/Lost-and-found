from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Optional

import requests

from backend.config import OLLAMA_MODEL
from backend.ollama_tagger import OLLAMA_TEXT_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL

AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama").strip().lower()
AI_MODEL = os.getenv("AI_CHAT_MODEL", os.getenv("OLLAMA_CHAT_MODEL", OLLAMA_TEXT_MODEL or OLLAMA_MODEL)).strip() or OLLAMA_MODEL
AI_TIMEOUT = float(os.getenv("AI_CHAT_TIMEOUT", str(max(OLLAMA_TIMEOUT, 20.0))))
AI_API_URL = os.getenv("AI_API_URL", "").strip()
AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
DEFAULT_SYSTEM_PROMPT = (
    "You are the Lost & Found campus assistant. "
    "Be context-aware, specific, concise, and helpful. "
    "Never answer with placeholders like [not found]. "
    "Prefer concrete references to item title, description, category, location, evidence, and recent chat context."
)
SUPPORTED_LANGUAGES = {"en", "zh-CN", "th"}
MEME_KEYWORDS = {
    "skibidi",
    "sigma",
    "gyatt",
    "rizz",
    "fanum",
    "ohio",
    "mewing",
    "among us",
    "sus",
    "sussy",
    "meme",
    "brainrot",
}


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


def _format_site_report_context(reports: list[dict[str, Any]]) -> str:
    if not reports:
        return "No reports are currently available."

    lines = []
    for report in reports[:120]:
        llava = report.get("llava_analysis") if isinstance(report.get("llava_analysis"), dict) else {}
        visual = (
            llava.get("item_description")
            or llava.get("object_description")
            or llava.get("object_type")
            or report.get("ai_summary")
            or ""
        )
        lines.append(
            f"- #{report.get('id')}: {report.get('title') or 'Untitled'} | "
            f"type={report.get('report_type') or 'unknown'} | "
            f"category={report.get('category') or 'Unknown'} | "
            f"color={report.get('color') or 'Unknown'} | "
            f"location={report.get('location') or 'Unknown'} | "
            f"status={report.get('status') or 'Open'} | "
            f"tags={', '.join(report.get('tags') or []) or 'none'} | "
            f"visual={visual or 'none'}"
        )
    suffix = "" if len(reports) <= 120 else f"\n...{len(reports) - 120} more reports are available to the backend search tool."
    return "\n".join(lines) + suffix


def _format_site_match_context(matches: list[dict[str, Any]]) -> str:
    if not matches:
        return "No likely matches were preselected."
    lines = []
    for match in matches[:8]:
        item = match.get("item") if isinstance(match.get("item"), dict) else match
        lines.append(
            f"- #{item.get('id')}: {item.get('title') or 'Untitled'} | "
            f"{item.get('category') or 'Unknown'} | {item.get('location') or 'Unknown'} | "
            f"score={match.get('score', 0)} | status={item.get('status') or 'Open'}"
        )
    return "\n".join(lines)


def _format_site_locations_context(locations: list[dict[str, Any]], regions: list[dict[str, Any]]) -> str:
    location_lines = []
    for location in locations:
        floors = location.get("floors") if isinstance(location.get("floors"), list) else []
        sub_locations = location.get("sub_locations") if isinstance(location.get("sub_locations"), list) else []
        children = [floor.get("label") for floor in floors if isinstance(floor, dict) and floor.get("label")]
        children.extend(
            sub_location.get("label")
            for sub_location in sub_locations
            if isinstance(sub_location, dict) and sub_location.get("label")
        )
        location_lines.append(
            f"- {location.get('name') or location.get('label') or 'Unknown'}"
            + (f" ({', '.join(children)})" if children else "")
        )

    region_lines = [
        f"- {region.get('zone') or 'Unknown'} > {region.get('label') or 'Unknown'}"
        for region in regions[:80]
    ]
    return (
        "Campus locations:\n"
        + ("\n".join(location_lines) if location_lines else "No configured locations.")
        + "\nMap regions:\n"
        + ("\n".join(region_lines) if region_lines else "No custom map regions.")
    )


def _format_site_floor_mapping_context(floor_mappings: list[dict[str, Any]]) -> str:
    if not floor_mappings:
        return "No floor mappings are configured."

    lines = []
    for mapping in floor_mappings[:80]:
        code_hint = mapping.get("code_hint") or ""
        sub_locations = mapping.get("sub_locations") if isinstance(mapping.get("sub_locations"), list) else []
        lines.append(
            f"- {mapping.get('path') or mapping.get('location') or 'Unknown'}"
            + (f" | code={code_hint}" if code_hint else "")
            + (f" | rooms={', '.join(sub_locations[:8])}" if sub_locations else "")
        )
    suffix = "" if len(floor_mappings) <= 80 else f"\n...{len(floor_mappings) - 80} more floor mappings are available."
    return "\n".join(lines) + suffix


def _format_site_upload_context(uploads: list[dict[str, Any]]) -> str:
    if not uploads:
        return "No upload metadata is available."
    lines = []
    for upload in uploads[:80]:
        lines.append(
            f"- {upload.get('path') or upload.get('name') or 'upload'} | "
            f"type={upload.get('content_type') or 'unknown'} | "
            f"size={upload.get('size') or 0}"
        )
    suffix = "" if len(uploads) <= 80 else f"\n...{len(uploads) - 80} more uploads are available."
    return "\n".join(lines) + suffix


def _format_data_access_context(data_context: dict[str, Any]) -> str:
    if not data_context:
        return "No backend data access context was provided."
    try:
        serialized = json.dumps(data_context, ensure_ascii=False, indent=2, default=str)
    except (TypeError, ValueError):
        serialized = str(data_context)
    max_chars = 36000
    if len(serialized) > max_chars:
        return serialized[:max_chars] + "\n...context truncated for prompt size; backend counts and query summaries remain authoritative."
    return serialized


def normalize_language(language: Optional[str]) -> str:
    value = str(language or "").strip()
    return value if value in SUPPORTED_LANGUAGES else "en"


def _language_instruction(language: str) -> str:
    normalized_language = normalize_language(language)
    if normalized_language == "zh-CN":
        return (
            "Respond in Simplified Chinese by default. "
            "Keep the reply and suggestions in Simplified Chinese unless the user explicitly asks for another language."
        )
    if normalized_language == "th":
        return (
            "Respond in Thai by default. "
            "Use a formal, school-appropriate tone and keep the wording concise unless the user explicitly asks for another language."
        )
    return "Respond in English unless the user explicitly asks for another language."


def generate_query_package(
    *,
    user_message: str,
    item: Optional[dict[str, Any]],
    history: list[dict[str, Any]],
    catalog_items: list[dict[str, Any]],
    language: str = "en",
) -> dict[str, Any]:
    contextual_mode = "item" if item else "general"
    normalized_language = normalize_language(language)
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
- {_language_instruction(normalized_language)}

Mode: {contextual_mode}
Preferred language: {normalized_language}

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
        (
            f'我已经保存你关于“{item.get("title")}”的问题。'
            f'它目前记录在{item.get("location") or "已登记地点"}。'
            "你可以继续询问认领步骤、证据信息或上报时间。"
        ) if normalized_language == "zh-CN" else (
            f'I saved your question about "{item.get("title")}". '
            f'It is currently listed in {item.get("location") or "the recorded location"}. '
            "Try asking about claim steps, evidence details, or when it was reported."
        )
    ) if item else (
        "我暂时无法连接到 AI，但你仍然可以询问最近上报的物品、分类或地点。"
        if normalized_language == "zh-CN"
        else "I couldn't reach the AI model just now, but you can ask about recently reported items, categories, or locations."
    )

    result = call_ai_json(
        prompt=prompt,
        fallback_payload={
            "reply": fallback_reply,
            "suggestions": (
                [
                    "今天有哪些新上报的物品？",
                    "有人上报丢失手机吗？",
                    "哪些地点最近报告最多？",
                    "我该怎么认领物品？",
                ] if normalized_language == "zh-CN" else [
                    "What items were found today?",
                    "Has anyone reported a lost phone?",
                    "Which locations have the most reports?",
                    "How do I claim an item?",
                ]
            ) if not item else (
                [
                    f"{item.get('title') or '这个物品'}是在哪里发现的？",
                    "它是什么时候上报的？",
                    "我要怎么认领这个物品？",
                    "还有其他可识别细节吗？",
                ] if normalized_language == "zh-CN" else [
                    f"Where was {item.get('title') or 'this item'} found?",
                    "When was it reported?",
                    "How can I claim this item?",
                    "Are there more identifying details?",
                ]
            ),
            "reasoning_focus": "Fallback response due to AI failure.",
        },
        metadata={
            "mode": contextual_mode,
            "language": normalized_language,
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


def generate_site_helper_package(
    *,
    user_message: str,
    reports: list[dict[str, Any]],
    likely_matches: list[dict[str, Any]],
    locations: list[dict[str, Any]],
    map_regions: list[dict[str, Any]],
    floor_mappings: list[dict[str, Any]],
    upload_metadata: list[dict[str, Any]],
    suggested_query: str,
    execute_search: bool,
    search_results: list[dict[str, Any]],
    data_context: Optional[dict[str, Any]] = None,
    language: str = "en",
) -> dict[str, Any]:
    normalized_language = normalize_language(language)
    prompt = f"""
Return ONLY valid JSON with this shape:
{{
  "reply": "assistant reply",
  "suggested_query": "short search query",
  "suggested_actions": ["action 1", "action 2", "action 3"],
  "navigation_target": "reports|map|room|new_report|claims|query|none",
  "reasoning_focus": "short internal summary"
}}

You are the read-only site intelligence assistant for a school lost-and-found system.

Capabilities:
- Treat the Backend data access context as the source of truth. It was loaded read-only from the database, report storage, upload storage, and AI/LLaVA analysis storage, not from frontend state.
- Answer using all report, metadata, location, upload, heatmap, audit/history, user query/search log, and LLaVA metadata available in this request.
- Use campus floor mappings, room-code hints, and map regions when answering navigation questions.
- Suggest concise search queries for lost items, but never invent a report, tag, location, count, image, or LLaVA result.
- If search results were executed, summarize the strongest matches with report IDs, titles, locations/floors, counts, and why they match.
- If the backend context says no_records_found is true or matched_report_count is 0 for a record lookup, say "no records found".
- For image-based reports, include the image path, LLaVA description, detected objects, and confidence score when relevant and available.
- For history/admin questions, use audit/history context as read-only visibility only.
- Help users navigate: reports search, school map, lost and found room, new report form, claims, and item chat.
- Never say that you changed, deleted, claimed, approved, or submitted data.
- If details are absent from the backend context, say they are not recorded; do not guess.
- Structure data-heavy answers with counts and recent examples where possible.
- {_language_instruction(normalized_language)}

Preferred language: {normalized_language}
Search executed by backend: {"yes" if execute_search else "no"}
Backend suggested query: {suggested_query or "none"}

Latest user message:
{user_message}

Likely matches preselected from all reports:
{_format_site_match_context(likely_matches)}

Search results:
{_format_site_match_context(search_results)}

All report context:
{_format_site_report_context(reports)}

Location and map context:
{_format_site_locations_context(locations, map_regions)}

Floor mappings:
{_format_site_floor_mapping_context(floor_mappings)}

Upload metadata:
{_format_site_upload_context(upload_metadata)}

Backend data access context:
{_format_data_access_context(data_context or {})}
""".strip()

    first_match = (search_results or likely_matches or [{}])[0]
    first_item = first_match.get("item") if isinstance(first_match.get("item"), dict) else first_match
    query_summary = (data_context or {}).get("query_summary", {}) if isinstance(data_context, dict) else {}
    location_breakdown = query_summary.get("location_breakdown", {}) if isinstance(query_summary, dict) else {}
    ranked_locations = location_breakdown.get("ranked_locations", []) if isinstance(location_breakdown, dict) else []
    fallback_reply = (
        f"I suggest searching for \"{suggested_query}\"."
        if suggested_query else
        "I can help search reports, explain campus locations, or guide you to the report form."
    )
    if query_summary.get("no_records_found"):
        fallback_reply = f'No records found for "{suggested_query or user_message}".'
    elif ranked_locations:
        top_locations = ", ".join(
            f"{row.get('location')} ({row.get('count')})"
            for row in ranked_locations[:3]
            if row.get("location")
        )
        if top_locations:
            fallback_reply = (
                f"I found {query_summary.get('matched_report_count', len(search_results or likely_matches))} matching report(s). "
                f"Top locations: {top_locations}."
            )
    if execute_search and first_item:
        fallback_reply = (
            f'The strongest match is report #{first_item.get("id")}: "{first_item.get("title")}" '
            f'at {first_item.get("location") or "the recorded location"}.'
        )

    result = call_ai_json(
        prompt=prompt,
        fallback_payload={
            "reply": fallback_reply,
            "suggested_query": suggested_query,
            "suggested_actions": [
                "Run this search",
                "Open reports",
                "Open the school map",
            ],
            "navigation_target": "reports" if suggested_query else "none",
            "reasoning_focus": "Fallback site helper response.",
        },
        metadata={
            "feature": "site-helper",
            "language": normalized_language,
            "report_count": len(reports),
            "likely_match_count": len(likely_matches),
            "search_executed": execute_search,
            "search_result_count": len(search_results),
            "upload_metadata_count": len(upload_metadata),
            "floor_mapping_count": len(floor_mappings),
            "data_context_available": bool(data_context),
            "matched_report_count": query_summary.get("matched_report_count", 0) if isinstance(query_summary, dict) else 0,
        },
    )
    parsed = result["parsed"]
    suggested_actions = [
        str(value).strip()
        for value in parsed.get("suggested_actions", [])
        if str(value).strip()
    ]
    navigation_target = str(parsed.get("navigation_target", "none")).strip().lower()
    if navigation_target not in {"reports", "map", "room", "new_report", "claims", "query", "none"}:
        navigation_target = "none"

    result["reply"] = str(parsed.get("reply", "")).strip() or fallback_reply
    result["suggested_query"] = str(parsed.get("suggested_query", "")).strip() or suggested_query
    result["suggested_actions"] = list(dict.fromkeys(suggested_actions))[:5]
    result["navigation_target"] = navigation_target
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


def analyze_report_abuse(
    *,
    report: dict[str, Any],
    reporter_summary: dict[str, Any],
    claim_summary: dict[str, Any],
) -> dict[str, Any]:
    prompt = f"""
Return ONLY valid JSON with this shape:
{{
  "genuine_score": 0,
  "risk_level": "low",
  "reasoning": "short summary"
}}

You are evaluating whether a lost-and-found report looks genuine or suspicious.

Focus on:
- repeated spam reports from the same user
- inconsistent or contradictory item details
- missing or weak identifying details
- excessive duplicate claims linked to similar reports
- suspicious frequency patterns
- meme keywords, repeated slang, nonsense phrases, low semantic coherence, or obvious joke/troll structure

Score meaning:
- 0 means highly suspicious
- 100 means very likely genuine

Risk levels:
- low
- medium
- high

Report:
Title: {report.get("title") or ""}
Description: {report.get("description") or ""}
Category: {report.get("category") or ""}
Location: {report.get("location") or ""}
Evidence details: {report.get("evidence_details") or ""}
Evidence summary: {report.get("evidence_summary") or ""}
Evidence inconsistencies: {report.get("evidence_inconsistencies") or ""}
Evidence missing info: {report.get("evidence_missing_info") or ""}

Reporter history:
{json.dumps(reporter_summary, ensure_ascii=False)}

Claim signals:
{json.dumps(claim_summary, ensure_ascii=False)}
""".strip()

    recent_reports = int(reporter_summary.get("recent_reports_24h", 0) or 0)
    repeated_titles = int(reporter_summary.get("similar_title_reports_7d", 0) or 0)
    duplicate_claims = int(claim_summary.get("duplicate_claims_for_item", 0) or 0)
    claimant_burst = int(claim_summary.get("recent_claims_for_user_7d", 0) or 0)
    missing_info = str(report.get("evidence_missing_info") or "").strip()
    inconsistencies = str(report.get("evidence_inconsistencies") or "").strip()
    combined_text = " ".join(
        str(report.get(key) or "").strip().lower()
        for key in ("title", "description", "evidence_details", "evidence_summary")
    ).strip()
    words = re.findall(r"[a-zA-Z']+", combined_text)
    unique_words = {word for word in words if word}
    repeated_word_count = sum(1 for word in unique_words if words.count(word) >= 3 and len(word) >= 4)
    meme_hits = sorted(keyword for keyword in MEME_KEYWORDS if keyword in combined_text)
    punctuation_runs = len(re.findall(r"([!?])\1{2,}", combined_text))
    elongated_words = len(re.findall(r"\b([a-z])\1{3,}\b", combined_text))
    low_semantic_coherence = (
        len(words) >= 4
        and len(unique_words) <= max(2, len(words) // 5)
    )
    obvious_troll_structure = bool(meme_hits) or repeated_word_count >= 2 or punctuation_runs >= 1 or elongated_words >= 1 or low_semantic_coherence

    fallback_score = 88
    if missing_info:
        fallback_score -= 14
    if inconsistencies:
        fallback_score -= 22
    if meme_hits:
        fallback_score -= 45
    if repeated_word_count >= 2:
        fallback_score -= 20
    if punctuation_runs >= 1:
        fallback_score -= 8
    if elongated_words >= 1:
        fallback_score -= 10
    if low_semantic_coherence:
        fallback_score -= 24
    if recent_reports >= 3:
        fallback_score -= 18
    if repeated_titles >= 2:
        fallback_score -= 14
    if duplicate_claims >= 3:
        fallback_score -= 8
    if claimant_burst >= 6:
        fallback_score -= 10
    fallback_score = max(5, min(98, fallback_score))

    fallback_risk = "low" if fallback_score >= 75 else "medium" if fallback_score >= 45 else "high"
    fallback_reason_bits = []
    if missing_info:
        fallback_reason_bits.append("Missing key details in the report")
    if inconsistencies:
        fallback_reason_bits.append("Description contains contradictions or weak evidence")
    if meme_hits:
        fallback_reason_bits.append(f"Contains meme or slang markers: {', '.join(meme_hits[:4])}")
    if repeated_word_count >= 2:
        fallback_reason_bits.append("Repeated slang or recycled wording makes the report look spammy")
    if low_semantic_coherence:
        fallback_reason_bits.append("Text has very low semantic coherence")
    if punctuation_runs >= 1 or elongated_words >= 1:
        fallback_reason_bits.append("Joke-like or exaggerated phrasing was detected")
    if recent_reports >= 3:
        fallback_reason_bits.append("Reporter submitted several reports in a short window")
    if repeated_titles >= 2:
        fallback_reason_bits.append("Similar reports from the same user look repetitive")
    if duplicate_claims >= 3:
        fallback_reason_bits.append("Multiple similar claims increase moderation risk")
    if claimant_burst >= 6:
        fallback_reason_bits.append("Claim activity is unusually high")
    if not fallback_reason_bits:
        fallback_reason_bits.append("Report details look reasonably consistent")

    result = call_ai_json(
        prompt=prompt,
        fallback_payload={
            "genuine_score": fallback_score,
            "risk_level": fallback_risk,
            "reasoning": ". ".join(fallback_reason_bits),
        },
        metadata={
            "recent_reports_24h": recent_reports,
            "similar_title_reports_7d": repeated_titles,
            "duplicate_claims_for_item": duplicate_claims,
            "recent_claims_for_user_7d": claimant_burst,
            "meme_hits": meme_hits,
            "repeated_word_count": repeated_word_count,
            "low_semantic_coherence": low_semantic_coherence,
        },
    )
    parsed = result["parsed"]
    score = int(parsed.get("genuine_score", fallback_score) or fallback_score)
    score = max(0, min(100, score))
    risk_level = str(parsed.get("risk_level", fallback_risk)).strip().lower()
    if risk_level not in {"low", "medium", "high"}:
        risk_level = fallback_risk
    if obvious_troll_structure:
        score = min(score, 25)
        risk_level = "high"
    elif score < 85 and risk_level == "low":
        risk_level = "medium"
    elif score < 55:
        risk_level = "high"
    elif score < 85:
        risk_level = "medium"
    else:
        risk_level = "low"
    result["genuine_score"] = score
    result["risk_level"] = risk_level
    result["reasoning"] = str(parsed.get("reasoning", "")).strip() or ". ".join(fallback_reason_bits)
    return result


def analyze_claim_match(
    *,
    claim_reason: str,
    claim_description: str,
    lost_location: str,
    identifying_info: str,
    item: dict[str, Any],
) -> dict[str, Any]:
    prompt = f"""
Return ONLY valid JSON with this shape:
{{
  "match_score": 0,
  "reasoning": "short explanation"
}}

Evaluate only how well a claim matches an existing lost-and-found item.

Important rules:
- Score only match quality between the claim details and the reported item.
- Do NOT judge whether the item report itself is realistic, genuine, fake, or suspicious.
- Generic claims with weak identifying details should score very low.
- Strong claims mention concrete details like color, brand, markings, accessories, damage, stickers, or exact loss context.
- Do not assume legitimacy when details are vague.

Claim:
Reason: {claim_reason}
Description: {claim_description}
Lost location: {lost_location}
Identifying info: {identifying_info}

Reported item:
Title: {item.get("title") or ""}
Description: {item.get("description") or ""}
Category: {item.get("category") or ""}
Location: {item.get("location") or ""}
Color: {item.get("color") or ""}
Evidence details: {item.get("evidence_details") or ""}
Evidence summary: {item.get("evidence_summary") or ""}
Tags: {", ".join(item.get("tags") or [])}
""".strip()

    combined_claim = " ".join([claim_reason, claim_description, lost_location, identifying_info]).strip().lower()
    detail_words = re.findall(r"[a-z0-9']+", combined_claim)
    generic_phrases = {
        "its mine",
        "it's mine",
        "belongs to me",
        "my item",
        "mine",
        "i lost it",
        "that is mine",
    }
    has_generic_phrase = any(phrase in combined_claim for phrase in generic_phrases)
    meaningful_detail_words = [word for word in detail_words if len(word) >= 3]
    item_reference_text = " ".join(
        str(item.get(key) or "").lower()
        for key in ("title", "description", "category", "location", "color", "evidence_details", "evidence_summary")
    )
    overlap = sorted({word for word in meaningful_detail_words if word in item_reference_text})

    fallback_score = 18
    if len(meaningful_detail_words) >= 8:
        fallback_score += 18
    if len(meaningful_detail_words) >= 14:
        fallback_score += 10
    if overlap:
        fallback_score += min(40, len(overlap) * 8)
    if has_generic_phrase:
        fallback_score = min(fallback_score, 8)
    if len(meaningful_detail_words) < 5:
        fallback_score = min(fallback_score, 20)
    if len(overlap) < 2:
        fallback_score = min(fallback_score, 35)
    fallback_score = max(0, min(100, fallback_score))

    fallback_reasons = []
    if has_generic_phrase:
        fallback_reasons.append("Claim is generic and does not provide enough identifying detail")
    if len(meaningful_detail_words) < 5:
        fallback_reasons.append("Very few specific details were provided")
    if overlap:
        fallback_reasons.append(f"Matches item details on: {', '.join(overlap[:5])}")
    else:
        fallback_reasons.append("No strong overlap with the reported item details")
    if len(overlap) < 2:
        fallback_reasons.append("Match evidence is weak, so confidence should stay low")

    result = call_ai_json(
        prompt=prompt,
        fallback_payload={
            "match_score": fallback_score,
            "reasoning": ". ".join(fallback_reasons),
        },
        metadata={
            "detail_word_count": len(meaningful_detail_words),
            "overlap_terms": overlap[:8],
            "generic_claim": has_generic_phrase,
        },
    )
    parsed = result["parsed"]
    match_score = int(parsed.get("match_score", fallback_score) or fallback_score)
    match_score = max(0, min(100, match_score))
    if has_generic_phrase:
        match_score = min(match_score, 8)
    elif len(meaningful_detail_words) < 5:
        match_score = min(match_score, 20)
    elif len(overlap) < 2:
        match_score = min(match_score, 35)
    result["match_score"] = match_score
    result["reasoning"] = str(parsed.get("reasoning", "")).strip() or ". ".join(fallback_reasons)
    return result
