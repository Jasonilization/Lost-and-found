from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import backend as backend_app
from backend.database import AIInspectionLog, Base, Claim, LostFoundItem, Notification, QueryMessage, User


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
        backend_app.REQUEST_TIMESTAMPS.clear()
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=engine)
        self.session_factory = TestingSessionLocal
        self.db = TestingSessionLocal()

        self.user = User(
            username="student1",
            password_hash="hashed",
            initials="student.one",
            class_of=2030,
            preferred_language="en",
        )
        self.admin_user = User(
            username="admin1",
            password_hash="hashed",
            initials="admin.one",
            class_of=2030,
            preferred_language="en",
            is_admin=True,
        )
        self.db.add_all([self.user, self.admin_user])
        self.db.commit()
        self.db.refresh(self.user)
        self.db.refresh(self.admin_user)

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

    def test_save_upload_bytes_normalizes_heic_to_jpeg(self) -> None:
        with patch(
            "backend.backend.normalize_report_image_bytes",
            return_value=("converted.jpg", b"\xff\xd8\xffconverted", "image/jpeg"),
        ):
            saved = backend_app.save_upload_bytes(
                "photo.heic",
                b"raw-heic",
                expected_extensions=backend_app.IMAGE_UPLOAD_EXTENSIONS,
                client_mime_type="image/heic",
                allowed_types=backend_app.REPORT_IMAGE_UPLOAD_TYPES,
            )

        self.assertIsNotNone(saved)
        self.assertEqual(saved["extension"], ".jpg")
        self.assertEqual(saved["mime_type"], "image/jpeg")
        self.created_upload_paths.append(saved["path"])

    def test_query_blocking_stops_before_save(self) -> None:
        request = DummyJSONRequest(
            "/query",
            {"message": "bad free chat", "language": "en"},
        )

        with patch("backend.backend.classify_user_input", return_value={"allowed": False, "reason": "Blocked", "confidence": 0.99}):
            with self.assertRaises(HTTPException) as exc:
                asyncio.run(backend_app.create_general_query(request, current_user=self.user, db=self.db))

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, "Message rejected due to content policy.")
        self.assertEqual(self.db.query(QueryMessage).count(), 0)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 0)

    def test_item_query_blocking_stops_before_save(self) -> None:
        request = DummyJSONRequest(
            f"/items/{self.item.id}/query",
            {"message": "bad item chat", "language": "en"},
        )

        with patch("backend.backend.classify_user_input", return_value={"allowed": False, "reason": "Blocked", "confidence": 0.99}):
            with self.assertRaises(HTTPException) as exc:
                asyncio.run(backend_app.create_query(self.item.id, request, current_user=self.user, db=self.db))

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, "Message rejected due to content policy.")
        self.assertEqual(self.db.query(QueryMessage).count(), 0)
        self.assertEqual(self.db.query(AIInspectionLog).count(), 0)

    def test_health_detailed_returns_admin_monitor_contract(self) -> None:
        with patch("backend.backend._get_uptime_seconds", return_value=120), \
             patch("backend.backend.get_ollama_status", return_value={"available": True}):
            payload = backend_app.health_detailed(current_user=self.admin_user)

        self.assertEqual(
            payload,
            {
                "status": "running",
                "uptime_seconds": 120,
            },
        )

    def test_admin_start_ollama_is_safe_when_already_running(self) -> None:
        with patch("backend.backend._get_uptime_seconds", return_value=120), \
             patch("backend.backend.get_ollama_status", return_value={"available": True}):
            payload = backend_app.admin_start_ollama(current_user=self.admin_user)

        self.assertEqual(payload["status"], "running")
        self.assertFalse(payload["started"])
        self.assertIn("already running", payload["message"].lower())

    def test_admin_start_ollama_launches_service(self) -> None:
        with patch("backend.backend._get_uptime_seconds", return_value=120), \
             patch("backend.backend.get_ollama_status", side_effect=[{"available": False}, {"available": True}]), \
             patch("backend.backend._ollama_service_pids", return_value=[]), \
             patch("backend.backend.shutil.which", return_value="/usr/local/bin/ollama"), \
             patch("backend.backend.subprocess.Popen") as mock_popen:
            payload = backend_app.admin_start_ollama(current_user=self.admin_user)

        mock_popen.assert_called_once()
        self.assertEqual(payload["status"], "running")
        self.assertTrue(payload["started"])

    def test_admin_stop_ollama_is_safe_when_already_stopped(self) -> None:
        with patch("backend.backend._get_uptime_seconds", return_value=120), \
             patch("backend.backend.get_ollama_status", return_value={"available": False}), \
             patch("backend.backend._ollama_service_pids", return_value=[]):
            payload = backend_app.admin_stop_ollama(current_user=self.admin_user)

        self.assertEqual(payload["status"], "stopped")
        self.assertFalse(payload["stopped"])
        self.assertIn("already stopped", payload["message"].lower())

    def test_admin_stop_ollama_stops_running_service(self) -> None:
        with patch("backend.backend._get_uptime_seconds", return_value=120), \
             patch("backend.backend.get_ollama_status", side_effect=[{"available": True}, {"available": False}]), \
             patch("backend.backend._ollama_service_pids", return_value=[1234]), \
             patch("backend.backend.os.kill") as mock_kill:
            payload = backend_app.admin_stop_ollama(current_user=self.admin_user)

        mock_kill.assert_called_once()
        self.assertEqual(payload["status"], "stopped")
        self.assertTrue(payload["stopped"])

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

    def test_rate_limit_returns_retry_after_details(self) -> None:
        request = DummyRequest("/query")
        for _ in range(backend_app.RATE_LIMITS["chat"]["limit"]):
            backend_app.enforce_rate_limit("chat", request=request, current_user=self.user)

        with self.assertRaises(HTTPException) as exc:
            backend_app.enforce_rate_limit("chat", request=request, current_user=self.user)

        self.assertEqual(exc.exception.status_code, 429)
        self.assertIn("retry_after", exc.exception.detail)
        self.assertGreaterEqual(exc.exception.detail["retry_after"], 1)

    def test_soft_delete_and_restore_item(self) -> None:
        delete_response = backend_app.admin_delete_item(self.item.id, current_user=self.admin_user, db=self.db)
        self.assertIn("item_id", delete_response)
        deleted_item = self.db.query(LostFoundItem).filter(LostFoundItem.id == self.item.id).first()
        self.assertIsNotNone(deleted_item.deleted_at)

        restore_response = backend_app.admin_restore_item(self.item.id, current_user=self.admin_user, db=self.db)
        self.assertEqual(restore_response["message"], "Report restored.")
        restored_item = self.db.query(LostFoundItem).filter(LostFoundItem.id == self.item.id).first()
        self.assertIsNone(restored_item.deleted_at)

    def test_claim_submission_creates_match_notification(self) -> None:
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
            backend_app.claim_item(self.item.id, payload, request=request, current_user=self.user, db=self.db)

        notifications = self.db.query(Notification).all()
        self.assertGreaterEqual(len(notifications), 1)
        self.assertTrue(any(notification.event_type == "item_matched_to_claim" for notification in notifications))

    def test_search_scoring_handles_partial_and_typo_matches(self) -> None:
        score_exact = backend_app.score_item_for_query(self.item, "blue bottle")
        score_typo = backend_app.score_item_for_query(self.item, "blu botle")

        self.assertGreater(score_exact, 0)
        self.assertGreater(score_typo, 0)

    def test_report_submits_without_image_when_text_tagging_fails(self) -> None:
        payload = backend_app.ReportPayload(
            reporter_name="Student One",
            title="Red Hoodie",
            description="Red hoodie left on the sports hall bleachers after practice.",
            location="Sports Hall",
            category="Uniform",
            evidence_details="Has a name tag inside the collar.",
        )
        request = DummyRequest("/items/report")
        background_tasks = BackgroundTasks()

        with patch("backend.backend.ensure_submission_allowed"), \
             patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.generate_text_tag_result", side_effect=RuntimeError("ollama failed")), \
             patch("backend.backend.fallback_tags", return_value={
                 "summary": "basic keyword tags",
                 "category": "Uniform",
                 "color": "",
                 "tags": ["hoodie", "uniform", "sports hall"],
                 "tag_source": "fallback-text",
             }), \
             patch("backend.backend.analyze_evidence", return_value={
                 "summary": "Looks plausible",
                 "inconsistencies": "",
                 "missing_info": "",
                 "validity": "Needs review",
             }), \
             patch("backend.backend.log_ai_package"), \
             patch("backend.backend.apply_abuse_analysis"):
            result = asyncio.run(
                backend_app.report_item(
                    payload,
                    request,
                    background_tasks=background_tasks,
                    current_user=self.user,
                    db=self.db,
                )
            )

        self.assertEqual(result["message"], "Report submitted successfully")
        self.assertEqual(len(background_tasks.tasks), 0)
        created = self.db.query(LostFoundItem).order_by(LostFoundItem.id.desc()).first()
        self.assertIsNotNone(created)
        self.assertEqual(created.tags[:3], ["hoodie", "uniform", "sports hall"])
        self.assertIsNone(created.image_path)

    def test_report_with_image_uses_llava_tags_immediately(self) -> None:
        payload = backend_app.ReportPayload(
            reporter_name="Student One",
            title="Blue Bottle",
            description="Blue bottle left near the long court benches after lunch.",
            location="Long Court",
            category="Bottle",
            image=backend_app.ReportImagePayload(
                filename="bottle.jpg",
                content_type="image/jpeg",
                data="ZmFrZQ==",
            ),
        )
        request = DummyRequest("/items/report")
        background_tasks = BackgroundTasks()

        with patch("backend.backend.ensure_submission_allowed"), \
             patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.decode_image_payload", return_value="/uploads/mock-bottle.jpg"), \
             patch("backend.backend.inspect_image_upload", return_value={
                 "moderation": "SAFE",
                 "tags": ["water bottle", "blue", "plastic", "loop cap", "scuffed"],
                 "llava_called": True,
             }), \
             patch("backend.backend.analyze_evidence", return_value={
                 "summary": "Looks plausible",
                 "inconsistencies": "",
                 "missing_info": "",
                 "validity": "Needs review",
             }), \
             patch("backend.backend.log_ai_package"), \
             patch("backend.backend.apply_abuse_analysis"):
            result = asyncio.run(
                backend_app.report_item(
                    payload,
                    request,
                    background_tasks=background_tasks,
                    current_user=self.user,
                    db=self.db,
                )
            )

        self.assertEqual(result["message"], "Report submitted successfully")
        self.assertEqual(len(background_tasks.tasks), 0)
        created = self.db.query(LostFoundItem).order_by(LostFoundItem.id.desc()).first()
        self.assertEqual(created.image_path, "/uploads/mock-bottle.jpg")
        self.assertEqual(created.tag_source, "llava-image")
        self.assertEqual(created.tags[:3], ["water bottle", "blue", "plastic"])

    def test_report_with_unsafe_image_is_rejected_fail_closed(self) -> None:
        payload = backend_app.ReportPayload(
            reporter_name="Student One",
            title="Blue Bottle",
            description="Blue bottle left near the long court benches after lunch.",
            location="Long Court",
            category="Bottle",
            image=backend_app.ReportImagePayload(
                filename="bottle.jpg",
                content_type="image/jpeg",
                data="ZmFrZQ==",
            ),
        )
        request = DummyRequest("/items/report")
        background_tasks = BackgroundTasks()

        with patch("backend.backend.ensure_submission_allowed"), \
             patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.decode_image_payload", return_value="/uploads/mock-bottle.jpg"), \
             patch("backend.backend.inspect_image_upload", return_value={
                 "moderation": "UNSAFE",
                 "tags": [],
                 "llava_called": True,
             }), \
             patch("backend.backend.delete_uploaded_path") as delete_uploaded_path:
            with self.assertRaises(HTTPException) as exc:
                asyncio.run(
                    backend_app.report_item(
                        payload,
                        request,
                        background_tasks=background_tasks,
                        current_user=self.user,
                        db=self.db,
                    )
                )

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.detail, "Image rejected as unsafe for the school lost and found system.")
        self.assertEqual(self.db.query(LostFoundItem).count(), 1)
        delete_uploaded_path.assert_called()

    def test_report_with_safe_image_falls_back_to_text_tags_when_llava_returns_no_tags(self) -> None:
        payload = backend_app.ReportPayload(
            reporter_name="Student One",
            title="Red Hoodie",
            description="Red hoodie left on the sports hall bleachers after practice.",
            location="Sports Hall",
            category="Uniform",
            image=backend_app.ReportImagePayload(
                filename="hoodie.jpg",
                content_type="image/jpeg",
                data="ZmFrZQ==",
            ),
        )
        request = DummyRequest("/items/report")
        background_tasks = BackgroundTasks()

        with patch("backend.backend.ensure_submission_allowed"), \
             patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.decode_image_payload", return_value="/uploads/mock-hoodie.jpg"), \
             patch("backend.backend.inspect_image_upload", return_value={
                 "moderation": "SAFE",
                 "tags": [],
                 "llava_called": True,
             }), \
             patch("backend.backend.generate_text_tag_result", return_value={
                 "summary": "AI-generated text tags",
                 "category": "Uniform",
                 "color": "",
                 "tags": ["hoodie", "red", "sports hall"],
                 "tag_source": "fallback-text",
             }), \
             patch("backend.backend.analyze_evidence", return_value={
                 "summary": "Looks plausible",
                 "inconsistencies": "",
                 "missing_info": "",
                 "validity": "Needs review",
             }), \
             patch("backend.backend.log_ai_package"), \
             patch("backend.backend.apply_abuse_analysis"):
            result = asyncio.run(
                backend_app.report_item(
                    payload,
                    request,
                    background_tasks=background_tasks,
                    current_user=self.user,
                    db=self.db,
                )
            )

        self.assertEqual(result["message"], "Report submitted successfully")
        created = self.db.query(LostFoundItem).order_by(LostFoundItem.id.desc()).first()
        self.assertEqual(created.tag_source, "text-fallback-after-llava-failure")
        self.assertEqual(created.tags[:3], ["hoodie", "red", "sports hall"])

    def test_report_with_weak_llava_tags_keeps_image_output(self) -> None:
        payload = backend_app.ReportPayload(
            reporter_name="Student One",
            title="Laptop",
            description="Laptop left in class.",
            location="Senior Building",
            category="Electronics",
            image=backend_app.ReportImagePayload(
                filename="laptop.jpg",
                content_type="image/jpeg",
                data="ZmFrZQ==",
            ),
        )
        request = DummyRequest("/items/report")
        background_tasks = BackgroundTasks()

        with patch("backend.backend.ensure_submission_allowed"), \
             patch("backend.backend.classify_user_input", return_value={"allowed": True, "reason": "Allowed", "confidence": 0.95}), \
             patch("backend.backend.decode_image_payload", return_value="/uploads/mock-laptop.jpg"), \
             patch("backend.backend.inspect_image_upload", return_value={
                 "moderation": "SAFE",
                 "tags": ["silver laptop", "stickers"],
                 "tag_validation_warnings": ["Image tags were shorter than preferred and were kept with low confidence."],
                 "validation_strength": "low",
             }), \
             patch("backend.backend.analyze_evidence", return_value={
                 "summary": "Looks plausible",
                 "inconsistencies": "",
                 "missing_info": "",
                 "validity": "Needs review",
             }), \
             patch("backend.backend.log_ai_package"), \
             patch("backend.backend.apply_abuse_analysis"):
            result = asyncio.run(
                backend_app.report_item(
                    payload,
                    request,
                    background_tasks=background_tasks,
                    current_user=self.user,
                    db=self.db,
                )
            )

        self.assertEqual(result["message"], "Report submitted successfully")
        created = self.db.query(LostFoundItem).order_by(LostFoundItem.id.desc()).first()
        self.assertEqual(created.tag_source, "llava-image-weak")
        self.assertEqual(created.ai_summary, "LLaVA image tags (low confidence)")
        self.assertEqual(created.tags[:2], ["silver laptop", "stickers"])

    def test_debug_llava_test_returns_trace_for_latest_upload(self) -> None:
        debug_path = backend_app.UPLOAD_DIR / "debug-test.jpg"
        debug_path.write_bytes(b"\xff\xd8\xffdebug-image")
        try:
            with patch("backend.backend.debug_image_request", return_value={
                "model": "llava",
                "image_file_bytes": 14,
                "image_base64_length": 20,
                "request_payload": {"has_images": True, "images_count": 1, "image_base64_lengths": [20]},
                "raw_response": '{"moderation":"SAFE","tags":["blue bottle"]}',
                "parsed_inspection": {"moderation": "SAFE", "tags": ["blue bottle"]},
                "parse_error": "",
            }):
                result = backend_app.debug_llava_test(filename="debug-test.jpg", current_user=self.admin_user)
        finally:
            if debug_path.exists():
                debug_path.unlink()

        self.assertEqual(result["filename"], "debug-test.jpg")
        self.assertEqual(result["prompt_mode"], "inspect")
        self.assertTrue(result["result"]["request_payload"]["has_images"])
        self.assertEqual(result["result"]["request_payload"]["images_count"], 1)


if __name__ == "__main__":
    unittest.main()
