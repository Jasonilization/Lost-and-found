from __future__ import annotations

import json
import tempfile
import unittest
from unittest.mock import patch

import requests

from backend import ai_moderation
from backend.ollama_tagger import _call_ollama_generate, fallback_tags, generate_image_tags, get_available_image_model, inspect_image_upload, is_vision_capable_model, merge_tag_lists


class FakeResponse:
    def __init__(self, response_text: str) -> None:
        self._response_text = response_text
        self.text = response_text
        self.status_code = 200

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"response": self._response_text}


class FakeJSONResponse:
    def __init__(self, payload: dict, response_text: str = "", status_code: int = 200) -> None:
        self._payload = payload
        self.text = response_text or json.dumps(payload)
        self.status_code = status_code

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


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

    def test_generate_image_tags_returns_tags_when_multimodal_model_is_available(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value="llava"), \
             patch(
                 "backend.ollama_tagger._call_ollama_generate",
                 return_value='{"moderation":"SAFE","tags":["water bottle","blue","metal"]}',
             ):
            image_file.write(b"fake-image")
            image_file.flush()
            tags = generate_image_tags(image_file.name)

        self.assertEqual(tags, ["water bottle", "blue", "metal"])

    def test_generate_image_tags_stops_when_no_image_model_exists(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value=""):
            image_file.write(b"fake-image")
            image_file.flush()

            with self.assertRaises(RuntimeError):
                generate_image_tags(image_file.name)

    def test_get_available_image_model_accepts_latest_alias(self) -> None:
        with patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger._list_ollama_models", return_value=["llava:latest", "llama3:8b"]):
            model = get_available_image_model()

        self.assertEqual(model, "llava:latest")

    def test_get_available_image_model_rejects_text_only_model(self) -> None:
        with patch("backend.ollama_tagger.OLLAMA_IMAGE_MODEL", "llama3:8b"), \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger._list_ollama_models", return_value=["llama3:8b"]):
            model = get_available_image_model()

        self.assertEqual(model, "")

    def test_vision_model_detection_is_conservative(self) -> None:
        self.assertTrue(is_vision_capable_model("llava"))
        self.assertTrue(is_vision_capable_model("llama3.2-vision:latest"))
        self.assertTrue(is_vision_capable_model("qwen2-vl:7b"))
        self.assertFalse(is_vision_capable_model("llama3:8b"))
        self.assertFalse(is_vision_capable_model("mistral"))
        self.assertFalse(is_vision_capable_model("qwen2.5:7b"))

    def test_call_ollama_generate_uses_images_field(self) -> None:
        with patch("backend.ollama_tagger.requests.post", return_value=FakeResponse("ok")) as mock_post:
            _call_ollama_generate("llava", "prompt", images=["base64-image"])

        payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(payload["images"], ["base64-image"])
        self.assertNotIn("image", payload)

    def test_inspect_image_upload_logs_required_llava_trace(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger.OLLAMA_URL", "http://ollama:11434"), \
             patch("backend.ollama_tagger.requests.get") as mock_get, \
             patch("backend.ollama_tagger.requests.post") as mock_post:
            image_file.write(b"fake-image")
            image_file.flush()
            mock_get.side_effect = [
                FakeJSONResponse({}, "Ollama is running"),
                FakeJSONResponse({"models": [{"name": "llava"}]}),
            ]
            mock_post.return_value = FakeResponse(
                '{"moderation":"SAFE","item_description":"blue bottle","tags":["blue bottle","plastic","cap"]}'
            )

            with self.assertLogs("ollama_tagger", level="INFO") as captured:
                inspect_image_upload(image_file.name)

        log_text = "\n".join(captured.output)
        for expected in [
            "[LLAVA TRACE] 1. image received (yes/no): yes",
            "[LLAVA TRACE] 2. base64 encoding success (yes/no): yes",
            "[LLAVA TRACE] Ollama reachable: true",
            "[LLAVA TRACE] /api/tags responds: true",
            "[LLAVA TRACE] Model available: true",
            "[LLAVA TRACE] 3. payload built (show payload structure): yes",
            "[LLAVA TRACE] 4. endpoint used",
            "[LLAVA TRACE] 5. model used",
            "[LLAVA TRACE] 6. request sent (yes/no): yes",
            "[LLAVA TRACE] 7. response status code",
            "[LLAVA TRACE] 8. response body",
        ]:
            self.assertIn(expected, log_text)

        payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "llava")
        self.assertIn("Analyze this image of a lost item.", payload["prompt"])
        self.assertIn("images", payload)
        self.assertEqual(len(payload["images"]), 1)
        self.assertTrue(payload["images"][0])
        self.assertNotIn("image", payload)

    def test_inspect_image_upload_rejects_missing_image_response(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value="llava"), \
             patch("backend.ollama_tagger._call_ollama_generate", return_value="I cannot see the image."):
            image_file.write(b"fake-image")
            image_file.flush()
            with self.assertRaises(ValueError):
                inspect_image_upload(image_file.name)

    def test_inspect_image_upload_marks_generic_tags_invalid(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value="llava"), \
             patch(
                 "backend.ollama_tagger._call_ollama_generate",
                 return_value='{"moderation":"SAFE","tags":["campus","item","school item"]}',
             ):
            image_file.write(b"fake-image")
            image_file.flush()
            inspection = inspect_image_upload(image_file.name)

        self.assertEqual(inspection["moderation"], "SAFE")
        self.assertEqual(inspection["tags"], [])
        self.assertTrue(inspection["tag_validation_error"])

    def test_inspect_image_upload_keeps_visual_tags_even_without_color_keyword(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value="llava"), \
             patch(
                 "backend.ollama_tagger._call_ollama_generate",
                 return_value='{"moderation":"SAFE","tags":["artwork","oil painting","classical art","antique"]}',
             ):
            image_file.write(b"fake-image")
            image_file.flush()
            inspection = inspect_image_upload(image_file.name)

        self.assertEqual(inspection["moderation"], "SAFE")
        self.assertEqual(inspection["tags"], ["artwork", "oil painting", "classical art", "antique"])
        self.assertEqual(inspection["tag_validation_error"], "")
        self.assertEqual(inspection["validation_strength"], "normal")

    def test_inspect_image_upload_extracts_tags_from_sentence_response(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value="llava"), \
             patch(
                 "backend.ollama_tagger._call_ollama_generate",
                 return_value='{"moderation":"SAFE","tags":"It looks like a silver laptop with stickers and a scratched case."}',
             ):
            image_file.write(b"fake-image")
            image_file.flush()
            inspection = inspect_image_upload(image_file.name)

        self.assertEqual(inspection["moderation"], "SAFE")
        self.assertIn("silver laptop", inspection["tags"])
        self.assertIn("stickers", inspection["tags"])

    def test_inspect_image_upload_cleans_loose_multiline_llava_fields(self) -> None:
        loose_response = '''"moderation":"SAFE
"item_description":"image of a young girl with blonde hair and green eyes
holding up a hand against an industrial backdrop with futuristic elements
featuring a robotic arm with a metal claw
and in the background there's text that reads 'pragmata deluxe edition'
"object_type":"promotional artwork
"colours":["green","gray","black"]
"notable_markings":["robotic arm","metal claw","pragmata deluxe edition"]
"possible_category":"Other
"confidence_score":72'''
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value="llava"), \
             patch("backend.ollama_tagger._call_ollama_generate", return_value=loose_response):
            image_file.write(b"fake-image")
            image_file.flush()
            inspection = inspect_image_upload(image_file.name)

        self.assertEqual(inspection["moderation"], "SAFE")
        self.assertEqual(inspection["object_type"], "promotional artwork")
        self.assertEqual(inspection["confidence_score"], 72)
        self.assertIn("promotional artwork", inspection["tags"])
        self.assertIn("robotic arm", inspection["tags"])
        self.assertNotIn("item_description", " ".join(inspection["tags"]))
        self.assertTrue(all(len(tag) <= 48 for tag in inspection["tags"]))

    def test_inspect_image_upload_enriches_sparse_tags_from_clean_fields(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, \
             patch("backend.ollama_tagger._ollama_root_available", return_value=True), \
             patch("backend.ollama_tagger.get_available_image_model", return_value="llava"), \
             patch(
                 "backend.ollama_tagger._call_ollama_generate",
                 return_value=json.dumps({
                     "moderation": "SAFE",
                     "item_description": "green metal water bottle with a black cap and dent",
                     "object_type": "water bottle",
                     "colours": ["green", "black"],
                     "notable_markings": ["black cap", "small dent", "hydro logo"],
                     "possible_category": "Bottle",
                     "confidence_score": 91,
                     "tags": ["bottle", "green"],
                 }),
             ):
            image_file.write(b"fake-image")
            image_file.flush()
            inspection = inspect_image_upload(image_file.name)

        self.assertIn("green water bottle", inspection["tags"])
        self.assertIn("black water bottle", inspection["tags"])
        self.assertIn("black cap", inspection["tags"])
        self.assertIn("hydro logo", inspection["tags"])
        self.assertLessEqual(len(inspection["tags"]), 8)

    def test_merge_tag_lists_deduplicates_and_limits_output(self) -> None:
        merged = merge_tag_lists(
            ["blue", "bottle", "metal"],
            ["bottle", "sports hall", "lost-item"],
            ["campus", "school-item", "extra"],
        )

        self.assertEqual(merged, ["blue", "bottle", "metal", "sports hall", "lost-item", "campus", "school-item", "extra"])


if __name__ == "__main__":
    unittest.main()
