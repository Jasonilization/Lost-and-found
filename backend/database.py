from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, create_engine, inspect, text
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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    initials = Column(String, default="")
    class_of = Column(Integer, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
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
    status = Column(String, default="pending", index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ItemQuery(Base):
    __tablename__ = "item_queries"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("lost_found_items.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _add_column_if_missing("lost_found_items", "claimed", "BOOLEAN NOT NULL DEFAULT 0")
    _add_column_if_missing("lost_found_items", "submitted_by_user_id", "INTEGER")
    _add_column_if_missing("lost_found_items", "tag_source", "VARCHAR DEFAULT 'fallback-text'")
    _add_column_if_missing("users", "initials", "VARCHAR DEFAULT ''")
    _add_column_if_missing("users", "class_of", "INTEGER")
    _create_index_if_missing("ix_lost_found_items_submitted_by_user_id", "lost_found_items", "submitted_by_user_id")
