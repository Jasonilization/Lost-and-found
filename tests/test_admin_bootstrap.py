from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import backend as backend_app
from backend.database import Base, User


class AdminBootstrapTests(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()

    def tearDown(self) -> None:
        self.db.close()

    def test_bootstrap_creates_admin_once_when_missing(self) -> None:
        with patch.dict(os.environ, {"ADMIN_USERNAME": "bootstrapadmin", "ADMIN_PASSWORD": "strongpass"}, clear=False):
            user = backend_app.bootstrap_admin_from_env(self.db)

        self.assertIsNotNone(user)
        saved_user = self.db.query(User).filter(User.username == "bootstrapadmin").first()
        self.assertIsNotNone(saved_user)
        self.assertTrue(saved_user.is_admin)
        self.assertNotEqual(saved_user.password_hash, "strongpass")
        self.assertTrue(backend_app.verify_password("strongpass", saved_user.password_hash))

    def test_bootstrap_is_idempotent_when_admin_already_exists(self) -> None:
        existing_admin = User(
            username="existingadmin",
            password_hash=backend_app.hash_password("existingpass"),
            initials="existing.admin",
            class_of=2030,
            is_admin=True,
        )
        self.db.add(existing_admin)
        self.db.commit()

        with patch.dict(os.environ, {"ADMIN_USERNAME": "bootstrapadmin", "ADMIN_PASSWORD": "strongpass"}, clear=False):
            backend_app.ensure_admin_user(self.db)

        admins = self.db.query(User).filter(User.is_admin.is_(True)).all()
        self.assertEqual(len(admins), 1)
        self.assertEqual(admins[0].username, "existingadmin")

    def test_bootstrap_does_not_overwrite_existing_non_admin_user(self) -> None:
        existing_user = User(
            username="bootstrapadmin",
            password_hash=backend_app.hash_password("studentpass"),
            initials="student.one",
            class_of=2030,
            is_admin=False,
        )
        self.db.add(existing_user)
        self.db.commit()

        with patch.dict(os.environ, {"ADMIN_USERNAME": "bootstrapadmin", "ADMIN_PASSWORD": "strongpass"}, clear=False):
            result = backend_app.bootstrap_admin_from_env(self.db)

        self.assertIsNone(result)
        saved_user = self.db.query(User).filter(User.username == "bootstrapadmin").first()
        self.assertIsNotNone(saved_user)
        self.assertFalse(saved_user.is_admin)
        self.assertTrue(backend_app.verify_password("studentpass", saved_user.password_hash))

    def test_registered_users_are_not_auto_admins(self) -> None:
        payload = backend_app.RegisterPayload(
            username="student1",
            password="strongpass",
            initials="student.one",
            class_of=2030,
        )

        response = backend_app.register(payload, db=self.db)

        self.assertFalse(response["user"]["is_admin"])


if __name__ == "__main__":
    unittest.main()
