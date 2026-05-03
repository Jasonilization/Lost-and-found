from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import backend as backend_app
from backend.database import AIInspectionLog, Base, Claim, LostFoundItem, QueryMessage, User


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

    def tearDown(self) -> None:
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
        payload = backend_app.QueryPayload(message="bad free chat", language="en", chat_mode="free")

        with patch("backend.backend.classify_user_input", return_value={"allowed": False, "reason": "Blocked", "confidence": 0.99}), \
             patch("backend.backend.generate_query_package") as generate_query_package:
            with self.assertRaises(HTTPException) as exc:
                backend_app.create_general_query(payload, current_user=self.user, db=self.db)

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, "Message rejected due to content policy.")
        self.assertEqual(self.db.query(QueryMessage).count(), 0)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 0)
        generate_query_package.assert_not_called()

    def test_ai_chat_blocking_stops_before_save_or_ai_reply(self) -> None:
        payload = backend_app.QueryPayload(message="bad ai chat", language="en", chat_mode="ai")

        with patch("backend.backend.classify_user_input", return_value={"allowed": False, "reason": "Blocked", "confidence": 0.99}), \
             patch("backend.backend.generate_query_package") as generate_query_package:
            with self.assertRaises(HTTPException) as exc:
                backend_app.create_query(self.item.id, payload, current_user=self.user, db=self.db)

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

        with patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.analyze_claim_match", return_value={"match_score": 24, "reasoning": "Too weak"}), \
             patch("backend.backend.apply_abuse_analysis") as apply_abuse_analysis:
            response = backend_app.claim_item(self.item.id, payload, current_user=self.user, db=self.db)

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

        with patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.analyze_claim_match", return_value={"match_score": 78, "reasoning": "Strong match"}), \
             patch("backend.backend.apply_abuse_analysis"):
            result = backend_app.claim_item(self.item.id, payload, current_user=self.user, db=self.db)

        self.assertEqual(result["message"], "Claim submitted.")
        self.assertEqual(self.db.query(Claim).count(), 1)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 2)


if __name__ == "__main__":
    unittest.main()
