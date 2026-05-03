from __future__ import annotations

import json
import unittest
from unittest.mock import patch

import requests

from backend import ai_moderation
from backend.ollama_tagger import fallback_tags


class FakeResponse:
    def __init__(self, response_text: str) -> None:
        self._response_text = response_text

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"response": self._response_text}


class AIModerationTests(unittest.TestCase):
    def setUp(self) -> None:
        ai_moderation._classify_cached.cache_clear()

    @patch("backend.ai_moderation.requests.post")
    def test_required_allow_queries_are_allowed(self, mock_post) -> None:
        mock_post.return_value = FakeResponse(
            'Model note\n{"allowed": true, "reason": "relevant item query", "confidence": 0.95}\nDone'
        )

        for text in [
            "water bottle",
            "blue water bottle in classroom",
            "has anyone seen this",
            "where is my bag",
            "lost phone",
        ]:
            with self.subTest(text=text):
                decision = ai_moderation.classify_user_input(text)
                self.assertTrue(decision["allowed"])
                self.assertGreaterEqual(decision["confidence"], 0.5)

    @patch("backend.ai_moderation.requests.post")
    def test_explicit_model_block_is_not_silently_overridden(self, mock_post) -> None:
        mock_post.return_value = FakeResponse(
            'Model note\n{"allowed": false, "reason": "too short", "confidence": 0.95}\nDone'
        )

        decision = ai_moderation.classify_user_input("blue water bottle in classroom")

        self.assertFalse(decision["allowed"])
        self.assertEqual(decision["reason"], "too short")

    @patch("backend.ai_moderation.requests.post")
    def test_required_block_queries_are_blocked(self, mock_post) -> None:
        mock_post.return_value = FakeResponse(
            json.dumps({"allowed": True, "reason": "looks fine", "confidence": 0.95})
        )

        for text in [
            "what is your fav movie",
            "tell me a joke",
            "hello how are you",
        ]:
            with self.subTest(text=text):
                decision = ai_moderation.classify_user_input(text)
                self.assertFalse(decision["allowed"])
                self.assertGreaterEqual(decision["confidence"], 0.6)

    @patch("backend.ai_moderation.requests.post")
    def test_meme_and_low_effort_queries_are_blocked(self, mock_post) -> None:
        mock_post.return_value = FakeResponse(
            json.dumps({"allowed": True, "reason": "looks fine", "confidence": 0.8})
        )

        for text in [
            "skibidi",
            "aaaaaaa",
            "mine",
            "lol lol lol lol",
        ]:
            with self.subTest(text=text):
                decision = ai_moderation.classify_user_input(text)
                self.assertFalse(decision["allowed"])
                self.assertGreaterEqual(decision["confidence"], 0.8)

    @patch("backend.ai_moderation.requests.post", side_effect=requests.Timeout("timed out"))
    def test_timeout_fallback_defaults_to_allowed_for_clear_item_query(self, _mock_post) -> None:
        decision = ai_moderation.classify_user_input("water bottle")

        self.assertTrue(decision["allowed"])
        self.assertEqual(decision["reason"], "Fallback: assumed relevant")
        self.assertEqual(decision["confidence"], 0.5)
        self.assertEqual(decision["tags"], ["bottle"])
        self.assertIn("timeout", decision["raw_output"])

    @patch("backend.ai_moderation.requests.post", side_effect=requests.Timeout("timed out"))
    def test_timeout_fallback_blocks_obvious_spam(self, _mock_post) -> None:
        decision = ai_moderation.classify_user_input("skibidi aaaaaaa")

        self.assertFalse(decision["allowed"])
        self.assertIn("Blocked", decision["reason"])
        self.assertGreaterEqual(decision["confidence"], 0.9)

    @patch("backend.ai_moderation.requests.post")
    def test_json_parse_failure_defaults_to_allowed(self, mock_post) -> None:
        mock_post.return_value = FakeResponse("definitely not json")

        decision = ai_moderation.classify_user_input("blue water bottle in classroom")

        self.assertTrue(decision["allowed"])
        self.assertEqual(decision["reason"], "Fallback: assumed relevant")
        self.assertEqual(decision["confidence"], 0.5)
        self.assertEqual(decision["tags"], ["bottle"])
        self.assertIn("No JSON object found", decision["raw_output"])

    def test_fallback_tags_extract_object_keywords(self) -> None:
        result = fallback_tags("water bottle", "", "", "", "")

        self.assertIn("bottle", result["tags"])
        self.assertEqual(result["tags"][0], "bottle")


if __name__ == "__main__":
    unittest.main()
