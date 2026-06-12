from __future__ import annotations

import unittest
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from backend import backend as backend_app
from backend.database import Base, LostFoundItem, User


class RoleAndEmailVerificationTests(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()
        backend_app.REQUEST_TIMESTAMPS.clear()

    def tearDown(self) -> None:
        self.db.close()

    def verification_token(self, email: str, purpose: str) -> str:
        record, _code = backend_app.create_email_verification_record(
            self.db,
            email=backend_app.normalize_email(email),
            purpose=purpose,
        )
        record.consumed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(record)
        return backend_app.create_email_verification_token(record)

    def request(self, path: str = "/test") -> Request:
        return Request({
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "query_string": b"",
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "scheme": "http",
        })

    def test_email_student_patterns_assign_student_role(self) -> None:
        self.assertEqual(
            backend_app.detect_role_from_identifiers("", "student123@school.edu"),
            backend_app.USER_ROLE_STUDENT,
        )
        self.assertEqual(
            backend_app.detect_role_from_identifiers("jason24", ""),
            backend_app.USER_ROLE_STUDENT,
        )
        self.assertEqual(
            backend_app.detect_role_from_identifiers("teacher", "teacher@school.edu"),
            backend_app.USER_ROLE_TEACHER,
        )

    def test_email_verification_code_hash_and_token_validate(self) -> None:
        email = "student123@students.example.edu"
        record, code = backend_app.create_email_verification_record(self.db, email=email, purpose="register")

        self.assertTrue(backend_app.verify_email_code_digest(email, "register", code, record.code_hash))
        self.assertFalse(backend_app.verify_email_code_digest(email, "register", "000000", record.code_hash))

        record.consumed_at = datetime.utcnow()
        self.db.commit()
        token = backend_app.create_email_verification_token(record)
        parsed = backend_app.parse_email_verification_token(
            self.db,
            token,
            expected_email=email,
            expected_purpose="register",
        )
        self.assertEqual(parsed.id, record.id)

    def test_manual_signup_requires_verified_email_and_detects_student(self) -> None:
        email = "jason24@students.example.edu"
        response = backend_app.register(
            backend_app.RegisterPayload(
                email=email,
                password="strongpass",
                email_verification_token=self.verification_token(email, "register"),
            ),
            db=self.db,
        )

        self.assertEqual(response["user"]["role"], backend_app.USER_ROLE_STUDENT)
        self.assertEqual(response["user"]["email"], email)
        self.assertTrue(response["user"]["email_verified"])
        self.assertIsNotNone(response["user"]["email_verified_at"])
        saved_user = self.db.query(User).filter(User.username == "jason24").first()
        self.assertEqual(saved_user.auto_detected_role, backend_app.USER_ROLE_STUDENT)
        self.assertEqual(saved_user.assigned_role, "")

    def test_login_uses_email_and_does_not_request_verification_code(self) -> None:
        user = User(
            username="student2028",
            email="student2028@students.example.edu",
            password_hash=backend_app.hash_password("strongpass"),
            email_verified=True,
            email_verified_at=datetime.utcnow(),
            role="",
            auto_detected_role="",
        )
        self.db.add(user)
        self.db.commit()

        response = backend_app.login(
            backend_app.LoginPayload(
                email="student2028@students.example.edu",
                password="strongpass",
            ),
            db=self.db,
        )
        self.db.refresh(user)

        self.assertEqual(response["user"]["role"], backend_app.USER_ROLE_STUDENT)
        self.assertTrue(response["user"]["email_verified"])
        self.assertIsNotNone(user.email_verified_at)

    def test_account_email_change_replaces_email_only_after_new_email_code(self) -> None:
        user = User(
            username="teacher",
            email="teacher@school.edu",
            password_hash=backend_app.hash_password("strongpass"),
            email_verified=True,
            email_verified_at=datetime.utcnow(),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        new_email = "teacher.new@school.edu"
        record, code = backend_app.create_email_verification_record(self.db, email=new_email, purpose="email_change")

        response = backend_app.confirm_account_email_change(
            backend_app.EmailChangeConfirmPayload(email=new_email, code=code),
            request=self.request("/account/email/confirm"),
            current_user=user,
            db=self.db,
        )
        self.db.refresh(user)
        self.db.refresh(record)

        self.assertEqual(response["user"]["email"], new_email)
        self.assertTrue(response["user"]["email_verified"])
        self.assertIsNotNone(record.consumed_at)
        self.assertEqual(user.email, new_email)

    def test_smtp_diagnostic_reports_development_log_when_unconfigured(self) -> None:
        with patch.object(backend_app, "SMTP_HOST", ""):
            result = backend_app.run_smtp_diagnostic_email("admin@example.edu")

        self.assertFalse(result["success"])
        self.assertEqual(result["config"]["delivery_mode"], "development-log")
        self.assertIn("development security log", result["error"])

    def test_smtp_status_uses_from_address_and_name_without_password(self) -> None:
        with patch.object(backend_app, "SMTP_HOST", "smtp.example.edu"), \
            patch.object(backend_app, "SMTP_USERNAME", "sender@example.edu"), \
            patch.object(backend_app, "SMTP_PASSWORD", "secret-password"), \
            patch.object(backend_app, "SMTP_FROM_ADDRESS", "lostfound@example.edu"), \
            patch.object(backend_app, "SMTP_FROM_NAME", "School Lost Found"):
            status = backend_app.smtp_config_status()

        self.assertEqual(status["delivery_mode"], "real-email")
        self.assertEqual(status["sender"], "School Lost Found <lostfound@example.edu>")
        self.assertTrue(status["password_configured"])
        self.assertNotIn("secret-password", str(status))

    def test_existing_user_migration_updates_roles_once(self) -> None:
        student = User(
            username="student2027",
            password_hash="hashed",
            role=backend_app.USER_ROLE_TEACHER,
            auto_detected_role=backend_app.USER_ROLE_TEACHER,
        )
        teacher = User(
            username="teacher",
            email="teacher@school.edu",
            password_hash="hashed",
            role=backend_app.USER_ROLE_STUDENT,
            auto_detected_role=backend_app.USER_ROLE_STUDENT,
        )
        overridden = User(
            username="manual123",
            password_hash="hashed",
            role=backend_app.USER_ROLE_TEACHER,
            auto_detected_role=backend_app.USER_ROLE_TEACHER,
            assigned_role=backend_app.USER_ROLE_TEACHER,
        )
        self.db.add_all([student, teacher, overridden])
        self.db.commit()

        backend_app.run_existing_user_role_detection_migration(self.db)
        self.db.refresh(student)
        self.db.refresh(teacher)
        self.db.refresh(overridden)

        self.assertEqual(student.auto_detected_role, backend_app.USER_ROLE_STUDENT)
        self.assertEqual(student.role, backend_app.USER_ROLE_STUDENT)
        self.assertEqual(teacher.auto_detected_role, backend_app.USER_ROLE_TEACHER)
        self.assertEqual(teacher.role, backend_app.USER_ROLE_TEACHER)
        self.assertEqual(overridden.auto_detected_role, backend_app.USER_ROLE_STUDENT)
        self.assertEqual(overridden.assigned_role, backend_app.USER_ROLE_TEACHER)
        self.assertEqual(overridden.role, backend_app.USER_ROLE_TEACHER)

    def test_assigned_role_override_takes_priority(self) -> None:
        user = User(
            username="student2029",
            password_hash="hashed",
            auto_detected_role=backend_app.USER_ROLE_STUDENT,
            assigned_role=backend_app.USER_ROLE_TEACHER,
            role=backend_app.USER_ROLE_TEACHER,
        )

        self.assertEqual(backend_app.user_role(user), backend_app.USER_ROLE_TEACHER)

    def test_admin_can_set_and_clear_role_override(self) -> None:
        admin = User(username="admin", password_hash="hashed", is_admin=True)
        user = User(username="student2030", password_hash="hashed")
        self.db.add_all([admin, user])
        self.db.commit()
        self.db.refresh(admin)
        self.db.refresh(user)

        backend_app.admin_set_user_school_role(
            user.id,
            backend_app.AdminUserRolePayload(role="teacher"),
            current_user=admin,
            db=self.db,
        )
        self.db.refresh(user)
        self.assertEqual(user.assigned_role, backend_app.USER_ROLE_TEACHER)
        self.assertEqual(user.role, backend_app.USER_ROLE_TEACHER)

        backend_app.admin_set_user_school_role(
            user.id,
            backend_app.AdminUserRolePayload(role="auto"),
            current_user=admin,
            db=self.db,
        )
        self.db.refresh(user)
        self.assertEqual(user.assigned_role, "")
        self.assertEqual(user.auto_detected_role, backend_app.USER_ROLE_STUDENT)
        self.assertEqual(user.role, backend_app.USER_ROLE_STUDENT)

    def test_students_cannot_enter_teacher_creation_paths(self) -> None:
        student = User(
            username="student1",
            password_hash="hashed",
            role=backend_app.USER_ROLE_STUDENT,
        )

        with self.assertRaises(HTTPException) as exc:
            backend_app.require_teacher_user(current_user=student)

        self.assertEqual(exc.exception.status_code, 403)

    def test_teachers_manage_only_their_own_items(self) -> None:
        teacher = User(username="teacher1", password_hash="hashed", role=backend_app.USER_ROLE_TEACHER)
        other_teacher = User(username="teacher2", password_hash="hashed", role=backend_app.USER_ROLE_TEACHER)
        self.db.add_all([teacher, other_teacher])
        self.db.commit()
        self.db.refresh(teacher)
        self.db.refresh(other_teacher)

        item = LostFoundItem(
            report_type="lost",
            reporter_name="Teacher One",
            title="Blue Bottle",
            description="Blue water bottle left in the sports hall.",
            location="Sports Hall",
            category="Bottle",
            submitted_by_user_id=teacher.id,
        )

        self.assertTrue(backend_app.user_can_manage_item(teacher, item))
        self.assertFalse(backend_app.user_can_manage_item(other_teacher, item))


if __name__ == "__main__":
    unittest.main()
