from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


def _strip_env_value(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {"'", '"'}:
        return cleaned[1:-1]
    return cleaned


def load_env_file(path: Path = ENV_FILE) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = _strip_env_value(value)


def normalize_http_url(value: str, default: str) -> str:
    host = (value or default).strip().rstrip("/")
    if not host:
        host = default
    if "://" not in host:
        host = f"http://{host}"
    return host.rstrip("/")


load_env_file()

OLLAMA_HOST = normalize_http_url(
    os.getenv("OLLAMA_HOST", os.getenv("OLLAMA_URL", "http://localhost:11434")),
    "http://localhost:11434",
)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", os.getenv("OLLAMA_TEXT_MODEL", "llama3:8b")).strip() or "llama3:8b"

