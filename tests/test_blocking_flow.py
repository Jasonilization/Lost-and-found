from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import backend as backend_app
from backend.database import AIInspectionLog, Base, Claim, LostFoundItem, QueryMessage, User


class DummyClient:
    host = "127.0.0.1"


class DummyURL:
    def __init__(self, path: str) -> None:
        self.path = path


class DummyJSONRequest:
    def __init__(self, path: str, payload: dict) -> None:
        self.headers = {"content-type": "application/json"}
        self.client = DummyClient()
        self.url = DummyURL(path)
        self._payload = payload

    async def json(self) -> dict:
        return self._payload


class DummyRequest:
    def __init__(self, path: str) -> None:
        self.headers = {}
        self.client = DummyClient()
        self.url = DummyURL(path)


class BlockingFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()

        self.user = User(
            username="student1",
            password_hash="hashed",
            initials="student.one",
            class_of=2030,
            preferred_language="en",
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        self.item = LostFoundItem(
            report_type="lost",
            reporter_name="Student One",
            title="Blue Bottle",
            description="Blue water bottle left in the sports hall after class.",
            location="Sports Hall",
            category="Bottle",
            status="Open",
            submitted_by_user_id=self.user.id,
            claimed=False,
        )
        self.db.add(self.item)
        self.db.commit()
        self.db.refresh(self.item)
        self.created_upload_paths: list[str] = []

    def tearDown(self) -> None:
        for path in self.created_upload_paths:
            upload_path = backend_app.BASE_DIR / path.lstrip("/")
            if upload_path.exists():
                upload_path.unlink()
        self.db.close()

    def test_moderate_request_does_not_write_db_log_when_blocked(self) -> None:
        with patch("backend.backend.classify_user_input", return_value={"allowed": False, "reason": "Blocked", "confidence": 0.99}):
            decision = backend_app.moderate_request(
                self.db,
                current_user=self.user,
                route="/query",
                input_text="blocked text",
            )

        self.assertFalse(decision["allowed"])
        self.assertEqual(self.db.query(AIInspectionLog).count(), 0)

    def test_free_chat_blocking_stops_before_save_or_ai(self) -> None:
        request = DummyJSONRequest(
            "/query",
            {"message": "bad free chat", "language": "en", "chat_mode": "free"},
        )

        with patch("backend.backend.classify_user_input", return_value={"allowed": False, "reason": "Blocked", "confidence": 0.99}), \
             patch("backend.backend.generate_query_package") as generate_query_package:
            with self.assertRaises(HTTPException) as exc:
                asyncio.run(backend_app.create_general_query(request, current_user=self.user, db=self.db))

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, "Message rejected due to content policy.")
        self.assertEqual(self.db.query(QueryMessage).count(), 0)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 0)
        generate_query_package.assert_not_called()

    def test_ai_chat_blocking_stops_before_save_or_ai_reply(self) -> None:
        request = DummyJSONRequest(
            f"/items/{self.item.id}/query",
            {"message": "bad ai chat", "language": "en", "chat_mode": "ai"},
        )

        with patch("backend.backend.classify_user_input", return_value={"allowed": False, "reason": "Blocked", "confidence": 0.99}), \
             patch("backend.backend.generate_query_package") as generate_query_package:
            with self.assertRaises(HTTPException) as exc:
                asyncio.run(backend_app.create_query(self.item.id, request, current_user=self.user, db=self.db))

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, "Message rejected due to content policy.")
        self.assertEqual(self.db.query(QueryMessage).count(), 0)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 0)
        generate_query_package.assert_not_called()

    def test_low_match_claim_is_rejected_before_insert(self) -> None:
        payload = backend_app.ClaimPayload(
            claim_reason="This is definitely mine because I used it in class.",
            item_description="A blue metal bottle with a dent on the side.",
            lost_location="Sports Hall",
            identifying_info="Blue metal dented bottle",
        )
        request = DummyRequest(f"/items/{self.item.id}/claim")

        with patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.analyze_claim_match", return_value={"match_score": 24, "reasoning": "Too weak"}), \
             patch("backend.backend.apply_abuse_analysis") as apply_abuse_analysis:
            response = backend_app.claim_item(self.item.id, payload, request=request, current_user=self.user, db=self.db)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.db.query(Claim).count(), 0)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 1)
        apply_abuse_analysis.assert_not_called()

    def test_allowed_claim_logs_match_after_threshold_and_saves(self) -> None:
        payload = backend_app.ClaimPayload(
            claim_reason="This is my bottle from PE and I can describe the dent.",
            item_description="Blue metal bottle with a dent and scratched lid.",
            lost_location="Sports Hall",
            identifying_info="Blue metal dent scratched-lid",
        )
        request = DummyRequest(f"/items/{self.item.id}/claim")

        with patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.analyze_claim_match", return_value={"match_score": 78, "reasoning": "Strong match"}), \
             patch("backend.backend.apply_abuse_analysis"):
            result = backend_app.claim_item(self.item.id, payload, request=request, current_user=self.user, db=self.db)

        self.assertEqual(result["message"], "Claim submitted.")
        self.assertEqual(self.db.query(Claim).count(), 1)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 2)

    def test_save_upload_bytes_rejects_extension_spoof(self) -> None:
        with self.assertRaises(HTTPException) as exc:
            backend_app.save_upload_bytes(
                "photo.jpg",
                b"This is not a real jpeg file.",
            )

        self.assertEqual(exc.exception.status_code, 415)

    def test_save_upload_bytes_accepts_plain_text_attachment(self) -> None:
        saved = backend_app.save_upload_bytes(
            "note.txt",
            b"Lost near the library after lunch.",
        )

        self.assertIsNotNone(saved)
        self.assertEqual(saved["mime_type"], "text/plain")
        self.assertTrue(saved["path"].startswith("/uploads/"))
        self.created_upload_paths.append(saved["path"])


if __name__ == "__main__":
    unittest.main()
