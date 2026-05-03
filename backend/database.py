from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "lost_found.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class LostFoundItem(Base):
    __tablename__ = "lost_found_items"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String, index=True, nullable=False)
    reporter_name = Column(String, nullable=False)
    student_id = Column(String, default="")
    contact_info = Column(String, default="")
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, index=True, nullable=False)
    secondary_location = Column(String, default="")
    category = Column(String, index=True, nullable=False)
    color = Column(String, default="")
    time_slot = Column(String, default="Unknown")
    event_date = Column(Date, nullable=True)
    status = Column(String, default="Open", index=True)
    tags_json = Column(Text, default="[]")
    ai_summary = Column(Text, default="")
    image_path = Column(String, nullable=True)
    search_text = Column(Text, default="")
    tag_source = Column(String, default="fallback-text")
    submitted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    claimed = Column(Boolean, default=False, nullable=False)
    evidence_details = Column(Text, default="")
    evidence_images_json = Column(Text, default="[]")
    evidence_summary = Column(Text, default="")
    evidence_inconsistencies = Column(Text, default="")
    evidence_missing_info = Column(Text, default="")
    evidence_validity = Column(String, default="Needs review")
    review_status = Column(String, default="needs-review", index=True)
    review_notes = Column(Text, default="")
    abuse_genuine_score = Column(Integer, default=50, nullable=False)
    abuse_risk_level = Column(String, default="medium", index=True)
    abuse_reasoning = Column(Text, default="")
    abuse_flagged = Column(Boolean, default=False, nullable=False)
    abuse_override_status = Column(String, default="", index=True)
    abuse_override_notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def tags(self) -> list[str]:
        try:
            value = json.loads(self.tags_json or "[]")
            return [str(tag) for tag in value if str(tag).strip()]
        except json.JSONDecodeError:
            return []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        cleaned = []
        for tag in value:
            text_value = str(tag).strip().lower()
            if text_value and text_value not in cleaned:
                cleaned.append(text_value)
        self.tags_json = json.dumps(cleaned[:6])

    @property
    def evidence_images(self) -> list[str]:
        try:
            value = json.loads(self.evidence_images_json or "[]")
            return [str(path) for path in value if str(path).strip()]
        except json.JSONDecodeError:
            return []

    @evidence_images.setter
    def evidence_images(self, value: list[str]) -> None:
        cleaned = []
        for path in value:
            text_value = str(path).strip()
            if text_value and text_value not in cleaned:
                cleaned.append(text_value)
        self.evidence_images_json = json.dumps(cleaned[:6])

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    initials = Column(String, default="")
    class_of = Column(Integer, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    avatar_path = Column(String, nullable=True)
    preferred_language = Column(String, default="en", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("lost_found_items.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    claim_reason = Column(Text, nullable=False)
    item_description = Column(Text, nullable=False)
    lost_location = Column(String, nullable=False)
    identifying_info = Column(Text, nullable=False)
    match_score = Column(Integer, default=0, nullable=False)
    match_reasoning = Column(Text, default="")
    status = Column(String, default="pending", index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ItemQuery(Base):
    __tablename__ = "item_queries"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("lost_found_items.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, default="user", nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AIInspectionLog(Base):
    __tablename__ = "ai_inspection_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    route = Column(String, nullable=False, index=True)
    input_text = Column(Text, nullable=False)
    allowed = Column(Boolean, default=False, nullable=False)
    reason = Column(Text, default="")
    confidence = Column(Float, default=0.0)
    keywords_json = Column(Text, default="[]")
    raw_output = Column(Text, default="")
    feature = Column(String, default="moderation", index=True)
    prompt_text = Column(Text, default="")
    output_text = Column(Text, default="")
    model_name = Column(String, default="")
    model_size = Column(String, default="")
    fallback_triggered = Column(Boolean, default=False, nullable=False)
    request_metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def tags(self) -> list[str]:
        try:
            value = json.loads(self.keywords_json or "[]")
            return [str(keyword) for keyword in value if str(keyword).strip()]
        except json.JSONDecodeError:
            return []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        cleaned = []
        for keyword in value:
            text_value = str(keyword).strip().lower()
            if text_value and text_value not in cleaned:
                cleaned.append(text_value)
        self.keywords_json = json.dumps(cleaned[:12])

    @property
    def request_metadata(self) -> dict:
        try:
            value = json.loads(self.request_metadata_json or "{}")
            return value if isinstance(value, dict) else {}
        except json.JSONDecodeError:
            return {}

    @request_metadata.setter
    def request_metadata(self, value: dict) -> None:
        self.request_metadata_json = json.dumps(value or {})


class QueryMessage(Base):
    __tablename__ = "query_messages"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("lost_found_items.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, default="user", nullable=False)
    message = Column(Text, nullable=False)
    chat_mode = Column(String, default="ai", nullable=False)
    language = Column(String, default="en", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def _add_column_if_missing(table_name: str, column_name: str, column_sql: str) -> None:
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"))


def _create_index_if_missing(index_name: str, table_name: str, column_name: str) -> None:
    inspector = inspect(engine)
    existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    if index_name in existing_indexes:
        return

    with engine.begin() as connection:
        connection.execute(text(f"CREATE INDEX {index_name} ON {table_name} ({column_name})"))


def _drop_table_if_exists(table_name: str) -> None:
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return

    with engine.begin() as connection:
        connection.execute(text(f"DROP TABLE IF EXISTS {table_name}"))


def init_db() -> None:
    _drop_table_if_exists("ai_routing_audits")
    Base.metadata.create_all(bind=engine)
    _add_column_if_missing("lost_found_items", "claimed", "BOOLEAN NOT NULL DEFAULT 0")
    _add_column_if_missing("lost_found_items", "submitted_by_user_id", "INTEGER")
    _add_column_if_missing("lost_found_items", "tag_source", "VARCHAR DEFAULT 'fallback-text'")
    _add_column_if_missing("lost_found_items", "evidence_details", "TEXT DEFAULT ''")
    _add_column_if_missing("lost_found_items", "evidence_images_json", "TEXT DEFAULT '[]'")
    _add_column_if_missing("lost_found_items", "evidence_summary", "TEXT DEFAULT ''")
    _add_column_if_missing("lost_found_items", "evidence_inconsistencies", "TEXT DEFAULT ''")
    _add_column_if_missing("lost_found_items", "evidence_missing_info", "TEXT DEFAULT ''")
    _add_column_if_missing("lost_found_items", "evidence_validity", "VARCHAR DEFAULT 'Needs review'")
    _add_column_if_missing("lost_found_items", "review_status", "VARCHAR DEFAULT 'needs-review'")
    _add_column_if_missing("lost_found_items", "review_notes", "TEXT DEFAULT ''")
    _add_column_if_missing("lost_found_items", "abuse_genuine_score", "INTEGER NOT NULL DEFAULT 50")
    _add_column_if_missing("lost_found_items", "abuse_risk_level", "VARCHAR DEFAULT 'medium'")
    _add_column_if_missing("lost_found_items", "abuse_reasoning", "TEXT DEFAULT ''")
    _add_column_if_missing("lost_found_items", "abuse_flagged", "BOOLEAN NOT NULL DEFAULT 0")
    _add_column_if_missing("lost_found_items", "abuse_override_status", "VARCHAR DEFAULT ''")
    _add_column_if_missing("lost_found_items", "abuse_override_notes", "TEXT DEFAULT ''")
    _add_column_if_missing("users", "initials", "VARCHAR DEFAULT ''")
    _add_column_if_missing("users", "class_of", "INTEGER")
    _add_column_if_missing("users", "avatar_path", "VARCHAR")
    _add_column_if_missing("users", "preferred_language", "VARCHAR NOT NULL DEFAULT 'en'")
    _add_column_if_missing("claims", "match_score", "INTEGER NOT NULL DEFAULT 0")
    _add_column_if_missing("claims", "match_reasoning", "TEXT DEFAULT ''")
    _add_column_if_missing("item_queries", "role", "VARCHAR NOT NULL DEFAULT 'user'")
    _add_column_if_missing("query_messages", "chat_mode", "VARCHAR NOT NULL DEFAULT 'ai'")
    _add_column_if_missing("query_messages", "language", "VARCHAR NOT NULL DEFAULT 'en'")
    _add_column_if_missing("ai_inspection_logs", "feature", "VARCHAR DEFAULT 'moderation'")
    _add_column_if_missing("ai_inspection_logs", "prompt_text", "TEXT DEFAULT ''")
    _add_column_if_missing("ai_inspection_logs", "output_text", "TEXT DEFAULT ''")
    _add_column_if_missing("ai_inspection_logs", "model_name", "VARCHAR DEFAULT ''")
    _add_column_if_missing("ai_inspection_logs", "model_size", "VARCHAR DEFAULT ''")
    _add_column_if_missing("ai_inspection_logs", "fallback_triggered", "BOOLEAN NOT NULL DEFAULT 0")
    _add_column_if_missing("ai_inspection_logs", "request_metadata_json", "TEXT DEFAULT '{}'")
    _create_index_if_missing("ix_lost_found_items_submitted_by_user_id", "lost_found_items", "submitted_by_user_id")
    _create_index_if_missing("ix_lost_found_items_review_status", "lost_found_items", "review_status")
    _create_index_if_missing("ix_lost_found_items_abuse_risk_level", "lost_found_items", "abuse_risk_level")
    _create_index_if_missing("ix_lost_found_items_abuse_override_status", "lost_found_items", "abuse_override_status")
    _create_index_if_missing("ix_ai_inspection_logs_user_id", "ai_inspection_logs", "user_id")
    _create_index_if_missing("ix_ai_inspection_logs_feature", "ai_inspection_logs", "feature")
