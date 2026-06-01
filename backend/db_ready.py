from __future__ import annotations

import logging
import os
import random
import time
from collections.abc import Callable
from typing import TypeVar

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

T = TypeVar("T")

LOGGER = logging.getLogger("database_ready")

TRUE_VALUES = {"1", "true", "yes", "on"}
NON_RETRYABLE_MARKERS = (
    "authentication failed",
    "database \"",
    "does not exist",
    "invalid authorization",
    "no pg_hba.conf entry",
    "password authentication failed",
    "permission denied",
    "role \"",
)


def _env_float(name: str, default: float, *, minimum: float) -> float:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default
    try:
        return max(float(raw_value), minimum)
    except ValueError:
        return default


def _database_wait_enabled() -> bool:
    raw_value = os.getenv("DATABASE_WAIT_DISABLED", "").strip().lower()
    return raw_value not in TRUE_VALUES


def _is_postgres_url(database_url: str) -> bool:
    normalized = database_url.strip().lower()
    return normalized.startswith("postgresql://") or normalized.startswith("postgresql+")


def _target_label(database_url: str) -> str:
    try:
        parsed_url = make_url(database_url)
    except Exception:
        return "configured PostgreSQL database"

    host = parsed_url.host or "configured-host"
    port = parsed_url.port or 5432
    database = parsed_url.database or ""
    return f"{host}:{port}/{database}"


def _is_retryable_database_error(exc: Exception) -> bool:
    if not isinstance(exc, (OperationalError, OSError)):
        return False

    message = str(exc).lower()
    return not any(marker in message for marker in NON_RETRYABLE_MARKERS)


def _format_error(exc: Exception) -> str:
    message = str(exc).strip().replace("\n", " ")
    if len(message) > 500:
        message = f"{message[:497]}..."
    return f"{type(exc).__name__}: {message}"


def run_with_database_retries(
    operation: Callable[[], T],
    *,
    operation_name: str,
    timeout: float | None = None,
    initial_delay: float | None = None,
    max_delay: float | None = None,
    logger: logging.Logger | None = None,
) -> T:
    active_logger = logger or LOGGER
    if not _database_wait_enabled():
        active_logger.info("DATABASE_WAIT_DISABLED is set; running %s without retries", operation_name)
        return operation()

    timeout_seconds = timeout if timeout is not None else _env_float("DATABASE_WAIT_TIMEOUT", 120.0, minimum=1.0)
    delay_seconds = initial_delay if initial_delay is not None else _env_float("DATABASE_WAIT_INITIAL_DELAY", 1.0, minimum=0.1)
    max_delay_seconds = max_delay if max_delay is not None else _env_float("DATABASE_WAIT_MAX_DELAY", 8.0, minimum=0.1)
    deadline = time.monotonic() + timeout_seconds
    attempt = 0

    while True:
        attempt += 1
        try:
            result = operation()
        except Exception as exc:
            if not _is_retryable_database_error(exc):
                active_logger.error("%s failed with a non-retryable error: %s", operation_name, _format_error(exc))
                raise

            remaining_seconds = deadline - time.monotonic()
            if remaining_seconds <= 0:
                active_logger.error(
                    "%s did not become ready within %.1f seconds after %s attempts. Last error: %s",
                    operation_name,
                    timeout_seconds,
                    attempt,
                    _format_error(exc),
                )
                raise

            sleep_seconds = min(delay_seconds + random.uniform(0, delay_seconds * 0.25), remaining_seconds)
            active_logger.warning(
                "%s is not ready yet (attempt %s, %.1fs remaining): %s; retrying in %.1fs",
                operation_name,
                attempt,
                remaining_seconds,
                _format_error(exc),
                sleep_seconds,
            )
            time.sleep(sleep_seconds)
            delay_seconds = min(delay_seconds * 2, max_delay_seconds)
        else:
            if attempt > 1:
                active_logger.info("%s succeeded after %s attempts", operation_name, attempt)
            return result


def wait_for_database(database_url: str | None = None) -> None:
    if not _database_wait_enabled():
        LOGGER.info("DATABASE_WAIT_DISABLED is set; skipping database readiness wait")
        return

    resolved_database_url = (database_url if database_url is not None else os.getenv("DATABASE_URL", "")).strip()
    if not resolved_database_url or not _is_postgres_url(resolved_database_url):
        LOGGER.info("DATABASE_URL is not PostgreSQL; skipping database readiness wait")
        return

    connect_timeout = int(_env_float("DATABASE_CONNECT_TIMEOUT", 5.0, minimum=1.0))
    target = _target_label(resolved_database_url)
    engine = create_engine(
        resolved_database_url,
        connect_args={"connect_timeout": connect_timeout},
        pool_pre_ping=True,
    )

    def probe() -> None:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    try:
        run_with_database_retries(probe, operation_name=f"PostgreSQL {target}", logger=LOGGER)
    finally:
        engine.dispose()


def main() -> int:
    logging.basicConfig(
        level=os.getenv("DATABASE_WAIT_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    try:
        wait_for_database()
    except Exception:
        LOGGER.exception("PostgreSQL readiness check failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
