"""
tests/test_api.py

Integration tests for the FastAPI app covering:
  - Estimated-data flag when upstreams fail (mocked httpx)
  - LLM fallback order (Groq fail → HF → Gemini → offline rules)
  - Alert parsing (only extreme events set has_extreme_alert)
  - Upload validation (file size > 5 MB, non-audio content type)
  - Health endpoint reports provider config booleans
"""

import sys
import os
import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
for p in (BACKEND_DIR, ROOT_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import pytest
from fastapi.testclient import TestClient

try:
    from backend.main import (
        app,
        parse_weather,
        fetch_soil_data,
        _estimated_weather,
    )
    _MODULE_PREFIX = "backend.main"
except ImportError:
    from main import (
        app,
        parse_weather,
        fetch_soil_data,
        _estimated_weather,
    )
    _MODULE_PREFIX = "main"


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """TestClient using the lifespan context (creates shared HTTP client)."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── Health endpoint ─────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self, client: TestClient):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "providers" in data
        providers = data["providers"]
        # Must be booleans, never the actual key values
        for key in ("groq_configured", "hf_configured", "gemini_configured", "owm_configured"):
            assert isinstance(providers[key], bool), f"{key} must be bool"

    def test_health_no_secrets_leaked(self, client: TestClient):
        """Actual API key values must never appear in the health response."""
        resp = client.get("/health")
        body = resp.text
        groq_key = os.environ.get("GROQ_API_KEY", "")
        if groq_key:
            assert groq_key not in body


# ── Alert parsing ───────────────────────────────────────────────────────────

class TestAlertParsing:
    def _raw_owm(self, events: list[str]) -> dict:
        return {
            "current": {"temp": 30.0, "humidity": 65,
                        "weather": [{"description": "clear sky"}]},
            "alerts": [{"sender_name": "IMD", "event": e, "description": ""} for e in events],
        }

    def test_extreme_event_sets_flag(self):
        raw = self._raw_owm(["flood"])
        wd = parse_weather(raw)
        assert wd.has_extreme_alert is True

    def test_warning_in_name_sets_flag(self):
        raw = self._raw_owm(["Strong Wind Warning"])
        wd = parse_weather(raw)
        assert wd.has_extreme_alert is True

    def test_non_extreme_alert_does_not_set_flag(self):
        """A routine advisory (e.g. fog) must NOT set has_extreme_alert."""
        raw = self._raw_owm(["Dense Fog Advisory"])
        wd = parse_weather(raw)
        assert wd.has_extreme_alert is False

    def test_no_alerts_flag_false(self):
        raw = self._raw_owm([])
        wd = parse_weather(raw)
        assert wd.has_extreme_alert is False

    def test_multiple_alerts_one_extreme(self):
        raw = self._raw_owm(["Dense Fog Advisory", "heat wave"])
        wd = parse_weather(raw)
        assert wd.has_extreme_alert is True


# ── Estimated-data flag when upstreams fail ─────────────────────────────────

class TestEstimatedDataFlag:
    @pytest.mark.asyncio
    async def test_soil_estimated_on_open_meteo_failure(self):
        """When Open-Meteo is unreachable, soil data_source must be 'estimated'."""
        import httpx
        with patch(f"{_MODULE_PREFIX}.get_http_client") as mock_client_getter:
            mock_client = AsyncMock()
            mock_client.get.side_effect = httpx.ConnectError("unreachable")
            mock_client_getter.return_value = mock_client

            soil = await fetch_soil_data(28.6, 77.2)
        assert soil.data_source == "estimated"

    def test_weather_estimated_when_no_owm_key(self):
        """Without OWM_API_KEY the fallback weather must carry data_source='estimated'."""
        w = _estimated_weather()
        assert w["data_source"] == "estimated"
        assert w["temperature"] == 31.0  # check it's the documented default


# ── LLM fallback order ───────────────────────────────────────────────────────

class TestLLMFallbackOrder:
    """Mock each provider in turn to verify the cascade: Groq → HF → Gemini → rules."""

    @pytest.mark.asyncio
    async def test_groq_success_stops_cascade(self):
        from ai_engine import _call_llm
        with patch("ai_engine._call_groq", new=AsyncMock(return_value="Groq reply")):
            text, _, provider = await _call_llm("prompt", "system")
        assert text == "Groq reply"
        assert "Groq" in provider

    @pytest.mark.asyncio
    async def test_groq_fail_falls_to_hf(self):
        from ai_engine import _call_llm
        with patch("ai_engine._call_groq", new=AsyncMock(return_value=None)), \
             patch("ai_engine._call_huggingface", new=AsyncMock(return_value="HF reply")):
            text, _, provider = await _call_llm("prompt", "system")
        assert text == "HF reply"
        assert "Hugging Face" in provider

    @pytest.mark.asyncio
    async def test_groq_hf_fail_falls_to_gemini(self):
        from ai_engine import _call_llm
        with patch("ai_engine._call_groq", new=AsyncMock(return_value=None)), \
             patch("ai_engine._call_huggingface", new=AsyncMock(return_value=None)), \
             patch("ai_engine._call_gemini", new=AsyncMock(return_value=("Gemini reply", "id-123"))):
            text, iid, provider = await _call_llm("prompt", "system")
        assert text == "Gemini reply"
        assert iid == "id-123"

    @pytest.mark.asyncio
    async def test_all_llm_fail_returns_none(self):
        """When all providers return None, the caller uses the offline fallback."""
        from ai_engine import _call_llm
        with patch("ai_engine._call_groq", new=AsyncMock(return_value=None)), \
             patch("ai_engine._call_huggingface", new=AsyncMock(return_value=None)), \
             patch("ai_engine._call_gemini", new=AsyncMock(return_value=(None, None))):
            text, _, provider = await _call_llm("prompt", "system")
        assert text is None
        assert provider == "fallback"

    @pytest.mark.asyncio
    async def test_offline_fallback_used_in_chat(self):
        """chat_with_gemini returns a non-empty string even when all LLMs fail."""
        from ai_engine import chat_with_gemini
        weather = {"temperature": 30, "humidity": 55, "description": "clear sky",
                   "has_extreme_alert": False, "data_source": "estimated"}
        with patch("ai_engine._call_llm",
                   new=AsyncMock(return_value=(None, None, "fallback"))):
            result = await chat_with_gemini("What to do?", weather, "rice", "en")
        assert isinstance(result["reply"], str)
        assert len(result["reply"]) > 10
        assert result["powered_by"] == "fallback"


# ── Upload validation ────────────────────────────────────────────────────────

class TestUploadValidation:
    def test_reject_oversized_audio(self, client: TestClient):
        """Files > 5 MB must return HTTP 413."""
        big_audio = b"0" * (5 * 1024 * 1024 + 1)
        resp = client.post(
            "/api/voice-query",
            files={"audio": ("too_big.mp3", io.BytesIO(big_audio), "audio/mpeg")},
            data={"lang": "en", "crop_type": "rice"},
        )
        assert resp.status_code == 413

    def test_reject_non_audio_content_type(self, client: TestClient):
        """Files with a non-audio MIME type must return HTTP 415."""
        resp = client.post(
            "/api/voice-query",
            files={"audio": ("evil.pdf", io.BytesIO(b"PDF content"), "application/pdf")},
            data={"lang": "en", "crop_type": "rice"},
        )
        assert resp.status_code == 415

    def test_accept_audio_mpeg(self, client: TestClient):
        """A small audio/mpeg file should be accepted (may fail STT/LLM but not 413/415)."""
        tiny_audio = b"\x00" * 2048   # small but valid content-type
        resp = client.post(
            "/api/voice-query",
            files={"audio": ("clip.mp3", io.BytesIO(tiny_audio), "audio/mpeg")},
            data={"lang": "en", "crop_type": "general"},
        )
        # Should not be 413 or 415; may be 200 (with stt_simulated) or 5xx if Groq key absent
        assert resp.status_code not in (413, 415)

    def test_reject_image_content_type(self, client: TestClient):
        resp = client.post(
            "/api/voice-query",
            files={"audio": ("photo.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg")},
            data={"lang": "hi", "crop_type": "wheat"},
        )
        assert resp.status_code == 415


# ── Advisory endpoint smoke test ─────────────────────────────────────────────

class TestAdvisory:
    def test_advisory_returns_three_verdicts(self, client: TestClient):
        resp = client.post(
            "/api/advisory",
            json={"lat": 28.6, "lon": 77.2, "crop_stage": "growing"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        for key in ("irrigation", "spraying", "harvest"):
            assert key in data
            assert "ok" in data[key]
            assert "badge" in data[key]
            assert "reason" in data[key]
        assert data["data_source"] in ("live", "estimated")
