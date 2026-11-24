"""
main.py — WeatherGPT FastAPI Backend v2.1

Run from backend/:    uvicorn main:app --host 0.0.0.0 --port 8000
Run from project root: uvicorn backend.main:app --host 0.0.0.0 --port 8000
Production:            gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000

Security hardening (v2.1):
  - Optional X-API-Key header authentication (APP_API_KEY env var)
  - slowapi rate limiting: 30/min on /api/chat, 10/min on /api/voice-query
  - CORS from ALLOWED_ORIGINS env var (never wildcard + credentials)
  - Upload validation: 5 MB max, audio/* only
  - In-memory TTL cache (10 min) for weather + soil keyed by rounded coords
  - Shared httpx.AsyncClient via lifespan (one per process)
  - Background audio-cache cleanup every 30 min (deletes files >2 h old)
  - Full structured logging — no bare `except: pass`
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from ai_engine import chat_with_gemini, process_voice_query
from decision_engine import (
    Verdict,
    harvest_verdict,
    irrigation_verdict,
    spraying_verdict,
    verdicts_to_prompt_context,
)

load_dotenv(Path(__file__).resolve().parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OWM_API_KEY: str = os.environ.get("OWM_API_KEY", "")
APP_API_KEY: str = os.environ.get("APP_API_KEY", "")            # item 14
OWM_BASE_URL: str = "https://api.openweathermap.org/data/3.0/onecall"
OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"
AUDIO_DIR: Path = Path(os.environ.get("AUDIO_OUT_DIR", "./audio_cache"))
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

MAX_AUDIO_BYTES: int = 5 * 1024 * 1024          # 5 MB upload limit  (item 16)
_CACHE_TTL: float = 600.0                        # 10 minutes         (item 20)
_AUDIO_MAX_AGE: float = 2 * 3600                 # 2 hours            (item 17)
_CLEANUP_INTERVAL: float = 30 * 60              # every 30 minutes   (item 17)

EXTREME_EVENTS: set[str] = {
    "tornado", "hurricane", "typhoon", "blizzard", "ice storm",
    "flood", "flash flood", "extreme cold", "extreme heat", "heat wave",
    "dust storm", "thunderstorm warning", "severe thunderstorm",
    "tropical storm", "extreme weather",
}

# ---------------------------------------------------------------------------
# Shared HTTP client                                             (item 19)
# ---------------------------------------------------------------------------
_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    if _http_client is None:
        raise RuntimeError("HTTP client not initialised — lifespan did not run.")
    return _http_client


# ---------------------------------------------------------------------------
# In-memory TTL cache                                           (item 20)
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[Any, float]] = {}


def _coords_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2)}:{round(lon, 2)}"


def _cache_get(namespace: str, key: str) -> Optional[Any]:
    full_key = f"{namespace}:{key}"
    entry = _cache.get(full_key)
    if entry:
        value, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return value
        del _cache[full_key]
    return None


def _cache_set(namespace: str, key: str, value: Any) -> None:
    _cache[f"{namespace}:{key}"] = (value, time.monotonic())


# ---------------------------------------------------------------------------
# Background audio-cache cleanup                                (item 17)
# ---------------------------------------------------------------------------
async def _audio_cleanup_loop() -> None:
    """Delete audio files older than 2 hours, runs every 30 minutes."""
    while True:
        try:
            await asyncio.sleep(_CLEANUP_INTERVAL)
            cutoff = time.time() - _AUDIO_MAX_AGE
            deleted = 0
            for f in AUDIO_DIR.glob("*.mp3"):
                try:
                    if f.stat().st_mtime < cutoff:
                        f.unlink()
                        deleted += 1
                except OSError as exc:
                    logger.warning("Audio cleanup: could not delete %s — %s", f.name, exc)
            if deleted:
                logger.info("Audio cleanup: removed %d stale file(s).", deleted)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Audio cleanup loop error: %s", exc)


# ---------------------------------------------------------------------------
# App lifespan — startup & shutdown                             (item 19, 17)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(application: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=10.0)
    cleanup_task = asyncio.create_task(_audio_cleanup_loop())
    logger.info("WeatherGPT backend started — shared HTTP client ready.")
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        await _http_client.aclose()
        logger.info("WeatherGPT backend shutdown — HTTP client closed.")


# ---------------------------------------------------------------------------
# Rate limiter                                                  (item 14)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# App & middleware
# ---------------------------------------------------------------------------
app = FastAPI(
    title="WeatherGPT API",
    version="2.1.0",
    description="AI-powered farm weather advisor for Indian farmers.",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — never combine wildcard with allow_credentials          (item 15)
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_wildcard_cors = ALLOWED_ORIGINS == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=not _wildcard_cors,   # credentials only when origins are explicit
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/audio", StaticFiles(directory=str(AUDIO_DIR)), name="tts_audio")


# ---------------------------------------------------------------------------
# Auth dependency                                               (item 14)
# ---------------------------------------------------------------------------
async def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> None:
    """Enforces X-API-Key only when APP_API_KEY is set in the environment."""
    if APP_API_KEY and x_api_key != APP_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key header.")


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class WeatherRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    crop_type: Optional[str] = Field(None, description="Crop profile for advisory")


class WeatherAlert(BaseModel):
    sender: str = "Weather Service"
    event: str
    description: str = ""


class WeatherData(BaseModel):
    temperature: float
    temperature_c: Optional[float] = None
    description: str
    humidity: int
    has_extreme_alert: bool
    alerts: list[WeatherAlert] = Field(default_factory=list)
    data_source: str = Field("live", description="'live' or 'estimated'")

    def model_post_init(self, __context: object) -> None:
        if self.temperature_c is None:
            self.temperature_c = self.temperature


class SoilData(BaseModel):
    soil_moisture_shallow: float
    soil_moisture_root: float
    evapotranspiration: float
    vapour_pressure_deficit: float
    timestamp: str = ""
    data_source: str = Field("live", description="'live' or 'estimated'")


class SoilResponse(BaseModel):
    status: str = "ok"
    lat: float
    lon: float
    soil: SoilData


class WeatherResponse(BaseModel):
    status: str = "ok"
    lat: float
    lon: float
    crop_type: Optional[str] = None
    weather: WeatherData
    soil: Optional[SoilData] = None

    @property
    def data(self) -> WeatherData:
        return self.weather


class VoiceQueryResponse(BaseModel):
    status: str = "ok"
    text_response: str
    audio_url: Optional[str] = None
    tts_available: bool = True
    stt_simulated: bool = False
    lang: str
    crop_type: str
    transcript: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    lang: str = Field("en")
    crop_type: str = Field("general")
    crop_stage: str = Field("growing")
    lat: float = Field(20.5937, ge=-90, le=90)
    lon: float = Field(78.9629, ge=-180, le=180)
    weather_description: Optional[str] = None
    previous_interaction_id: Optional[str] = None
    history: Optional[list[dict]] = Field(None, description="Last ≤4 turns [{role, content}]")


class ChatResponse(BaseModel):
    status: str = "ok"
    reply: str
    lang: str
    interaction_id: Optional[str] = None
    powered_by: str = "fallback"


class AdvisoryRequest(BaseModel):
    lat: float = Field(20.5937, ge=-90, le=90)
    lon: float = Field(78.9629, ge=-180, le=180)
    crop_stage: str = Field("growing")
    crop_type: Optional[str] = None


class AdvisoryResponse(BaseModel):
    status: str = "ok"
    irrigation: dict
    spraying: dict
    harvest: dict
    data_source: str = "live"


# ---------------------------------------------------------------------------
# Weather fetcher & parser
# ---------------------------------------------------------------------------
async def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch current weather from OpenWeatherMap One Call 3.0."""
    if not OWM_API_KEY:
        raise HTTPException(status_code=500, detail="OWM_API_KEY not configured.")

    client = get_http_client()
    params = {
        "lat": lat, "lon": lon, "appid": OWM_API_KEY,
        "units": "metric", "exclude": "minutely,hourly,daily",
    }
    try:
        resp = await client.get(OWM_BASE_URL, params=params)
    except httpx.HTTPError as exc:
        logger.error("OWM HTTP error for (%.2f, %.2f): %s", lat, lon, exc)
        raise HTTPException(status_code=502, detail="Weather API unreachable.")

    if resp.status_code != 200:
        logger.error("OWM returned %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=resp.status_code,
                            detail=f"OpenWeatherMap error: {resp.text[:200]}")
    return resp.json()


def parse_weather(raw: dict) -> WeatherData:
    """Parse OWM payload. Only genuine extreme events set has_extreme_alert."""
    current = raw.get("current", {})
    weather_block = current.get("weather", [{}])[0]
    alerts_raw = raw.get("alerts", [])

    alerts = [
        WeatherAlert(
            sender=a.get("sender_name", "Weather Authority"),
            event=a.get("event", "Weather Alert"),
            description=a.get("description", ""),
        )
        for a in alerts_raw
    ]

    # Fix: only real extreme events trigger the flag            (item 9 / fixed)
    has_extreme = any(
        a.event.lower() in EXTREME_EVENTS
        or "warning" in a.event.lower()
        or "extreme" in a.event.lower()
        for a in alerts
    )
    temp = float(current.get("temp", 0.0))
    return WeatherData(
        temperature=temp, temperature_c=temp,
        description=weather_block.get("description", "Unknown conditions"),
        humidity=int(current.get("humidity", 0)),
        has_extreme_alert=has_extreme,
        alerts=alerts,
        data_source="live",
    )


def _estimated_weather(description: str = "partly cloudy") -> dict:
    """Hardcoded weather defaults flagged as 'estimated'."""
    logger.warning("Using ESTIMATED weather data — OWM API unavailable.")
    return {
        "temperature": 31.0, "temperature_c": 31.0, "humidity": 60,
        "description": description, "has_extreme_alert": False,
        "alerts": [], "data_source": "estimated",
    }


# ---------------------------------------------------------------------------
# Soil data fetcher
# ---------------------------------------------------------------------------
async def fetch_soil_data(lat: float, lon: float) -> SoilData:
    """
    Fetch soil moisture from Open-Meteo. Uses API utc_offset_seconds to pick
    the correct local hour (item 3). Results are TTL-cached 10 min (item 20).
    """
    key = _coords_key(lat, lon)
    cached = _cache_get("soil", key)
    if cached is not None:
        logger.debug("Soil cache hit for %s", key)
        return cached

    params = {
        "latitude": lat, "longitude": lon,
        "hourly": (
            "soil_moisture_0_to_1cm,soil_moisture_9_to_27cm,"
            "evapotranspiration,vapour_pressure_deficit"
        ),
        "forecast_days": 1, "timezone": "auto",
    }
    try:
        client = get_http_client()
        resp = await client.get(OPEN_METEO_BASE_URL, params=params)

        if resp.status_code == 200:
            data = resp.json()
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])

            utc_offset_s = int(data.get("utc_offset_seconds", 0))
            local_dt = datetime.now(timezone.utc) + timedelta(seconds=utc_offset_s)
            local_hour_prefix = local_dt.strftime("%Y-%m-%dT%H")

            idx = 0
            for i, t in enumerate(times):
                if t.startswith(local_hour_prefix):
                    idx = i
                    break
            else:
                idx = min(local_dt.hour, max(0, len(times) - 1)) if times else 0

            def _val(k: str, default: float) -> float:
                arr = hourly.get(k, [])
                if arr and 0 <= idx < len(arr) and arr[idx] is not None:
                    return round(float(arr[idx]), 3)
                return default

            ts = times[idx] if times and 0 <= idx < len(times) else local_dt.isoformat()
            result = SoilData(
                soil_moisture_shallow=_val("soil_moisture_0_to_1cm", 0.22),
                soil_moisture_root=_val("soil_moisture_9_to_27cm", 0.28),
                evapotranspiration=_val("evapotranspiration", 0.15),
                vapour_pressure_deficit=_val("vapour_pressure_deficit", 1.15),
                timestamp=ts, data_source="live",
            )
            _cache_set("soil", key, result)
            return result
        else:
            logger.error("Open-Meteo soil returned %s", resp.status_code)
    except Exception as exc:
        logger.error("Open-Meteo soil API error for (%.2f, %.2f): %s", lat, lon, exc)

    logger.warning("Using ESTIMATED soil data — Open-Meteo unavailable.")
    return SoilData(
        soil_moisture_shallow=0.22, soil_moisture_root=0.28,
        evapotranspiration=0.15, vapour_pressure_deficit=1.15,
        timestamp=datetime.now(timezone.utc).isoformat(),
        data_source="estimated",
    )


async def _get_weather_cached(lat: float, lon: float,
                               description: str = "partly cloudy") -> dict:
    """Fetch weather with TTL cache; falls back to estimated on error."""
    key = _coords_key(lat, lon)
    cached = _cache_get("weather", key)
    if cached is not None:
        logger.debug("Weather cache hit for %s", key)
        return cached

    if OWM_API_KEY:
        try:
            raw = await fetch_weather(lat, lon)
            result = parse_weather(raw).model_dump()
            _cache_set("weather", key, result)
            return result
        except Exception as exc:
            logger.warning("Weather fetch failed for (%.2f, %.2f): %s — using estimated.", lat, lon, exc)
    return _estimated_weather(description)


# ---------------------------------------------------------------------------
# Decision engine helper
# ---------------------------------------------------------------------------
def _run_decision_engine(
    weather: dict, soil: Optional[SoilData], crop_stage: str = "growing",
) -> tuple[Verdict, Verdict, Verdict, str]:
    root_m = soil.soil_moisture_root if soil else None
    vpd = soil.vapour_pressure_deficit if soil else None
    desc = str(weather.get("description", "")).lower()
    is_rain = any(w in desc for w in ("rain", "drizzle", "shower", "thunderstorm"))
    has_alert = bool(weather.get("has_extreme_alert", False))
    humidity = int(weather.get("humidity", 50))
    temp = float(weather.get("temperature", 30))
    data_src = weather.get("data_source", "live")

    irr = irrigation_verdict(root_moisture=root_m, is_rain_forecast=is_rain)
    spr = spraying_verdict(vpd_kpa=vpd, wind_gusts_ms=None,
                           is_rain_forecast=is_rain, humidity_pct=humidity)
    har = harvest_verdict(crop_stage=crop_stage, is_rain_forecast=is_rain,
                          has_extreme_alert=has_alert, temperature_c=temp)
    ctx = verdicts_to_prompt_context(irr, spr, har, data_source=data_src)
    return irr, spr, har, ctx


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():                                        # item 21
    return {
        "status": "healthy",
        "service": "WeatherGPT",
        "version": "2.1.0",
        "providers": {
            "groq_configured": bool(os.environ.get("GROQ_API_KEY", "").strip()),
            "hf_configured": bool(os.environ.get("HF_TOKEN", "").strip()),
            "gemini_configured": bool(os.environ.get("GEMINI_API_KEY", "").strip()),
            "owm_configured": bool(OWM_API_KEY),
        },
        "auth_enabled": bool(APP_API_KEY),
        "open_meteo_soil_enabled": True,
        "rate_limiting_enabled": True,
    }


@app.post("/api/advisory", response_model=AdvisoryResponse,
          dependencies=[Depends(verify_api_key)])
async def get_advisory(req: AdvisoryRequest) -> AdvisoryResponse:
    """Server-side agronomic decision verdicts — no LLM call."""
    soil = await fetch_soil_data(req.lat, req.lon)
    weather_dict = await _get_weather_cached(req.lat, req.lon)
    irr, spr, har, _ = _run_decision_engine(weather_dict, soil, req.crop_stage)
    return AdvisoryResponse(
        status="ok", irrigation=irr.to_dict(), spraying=spr.to_dict(),
        harvest=har.to_dict(), data_source=weather_dict.get("data_source", "live"),
    )


@app.post("/api/chat", response_model=ChatResponse,
          dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")                                      # item 14
async def chat_endpoint(request: Request, req: ChatRequest) -> ChatResponse:
    """Conversational AI Agronomist — decision engine runs first."""
    weather_data = await _get_weather_cached(
        req.lat, req.lon, req.weather_description or "partly cloudy"
    )
    soil: Optional[SoilData] = None
    try:
        soil = await fetch_soil_data(req.lat, req.lon)
        weather_data = dict(weather_data)
        weather_data["soil"] = soil.model_dump()
    except Exception as exc:
        logger.warning("Soil fetch failed in /api/chat: %s", exc)

    _, _, _, decision_ctx = _run_decision_engine(weather_data, soil, req.crop_stage)
    result = await chat_with_gemini(
        message=req.message, weather_json=weather_data,
        crop_profile=req.crop_type, lang=req.lang,
        previous_interaction_id=req.previous_interaction_id,
        history=req.history, decision_context=decision_ctx,
    )
    return ChatResponse(
        status="ok", reply=result["reply"], lang=req.lang,
        interaction_id=result.get("interaction_id"),
        powered_by=result.get("powered_by", "fallback"),
    )


@app.get("/api/soil", response_model=SoilResponse,
         dependencies=[Depends(verify_api_key)])
async def get_soil(lat: float = 20.5937, lon: float = 78.9629) -> SoilResponse:
    soil = await fetch_soil_data(lat, lon)
    return SoilResponse(status="ok", lat=lat, lon=lon, soil=soil)


@app.post("/api/weather", response_model=WeatherResponse,
          dependencies=[Depends(verify_api_key)])
async def get_weather(req: WeatherRequest) -> WeatherResponse:
    raw = await fetch_weather(req.lat, req.lon)
    weather = parse_weather(raw)
    soil_data: Optional[SoilData] = None
    try:
        soil_data = await fetch_soil_data(req.lat, req.lon)
    except Exception as exc:
        logger.warning("Soil fetch failed in /api/weather: %s", exc)
    return WeatherResponse(
        status="ok", lat=req.lat, lon=req.lon,
        crop_type=req.crop_type, weather=weather, soil=soil_data,
    )


@app.post("/api/voice-query", response_model=VoiceQueryResponse,
          dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")                                      # item 14
async def voice_query(
    request: Request,
    audio: UploadFile = File(...),
    lat: float = Form(20.5937),
    lon: float = Form(78.9629),
    crop_type: str = Form("general"),
    crop_stage: str = Form("growing"),
    lang: str = Form("en"),
) -> VoiceQueryResponse:
    """
    Voice pipeline: validate upload → fetch data → decision engine → STT → LLM → TTS.
    """
    # Upload validation                                          (item 16)
    ct = audio.content_type or ""
    if ct and not ct.startswith("audio/") and ct != "application/octet-stream":
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type '{ct}'. Upload an audio file (audio/*).",
        )
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large ({len(audio_bytes)//1024} KB). Maximum is 5 MB.",
        )

    # Weather + soil
    weather_data = await _get_weather_cached(lat, lon)
    soil: Optional[SoilData] = None
    try:
        soil = await fetch_soil_data(lat, lon)
        weather_data = dict(weather_data)
        weather_data["soil"] = soil.model_dump()
    except Exception as exc:
        logger.warning("Soil fetch failed in /api/voice-query: %s", exc)

    # Decision engine
    _, _, _, decision_ctx = _run_decision_engine(weather_data, soil, crop_stage)

    # AI pipeline
    result = await process_voice_query(
        audio_bytes=audio_bytes, weather_json=weather_data,
        crop_profile=crop_type, target_lang=lang,
        decision_context=decision_ctx,
    )

    audio_url: Optional[str] = None
    if result["audio_file_path"]:
        audio_url = f"/static/audio/{Path(result['audio_file_path']).name}"

    return VoiceQueryResponse(
        status="ok",
        text_response=result["text_response"],
        audio_url=audio_url,
        tts_available=result["tts_available"],
        stt_simulated=result.get("stt_simulated", False),
        lang=result["lang"],
        crop_type=crop_type,
        transcript=result.get("transcript"),
    )


@app.get("/api/audio/{filename}", dependencies=[Depends(verify_api_key)])
async def get_audio_file(filename: str):
    """Serve synthesized TTS audio files (legacy endpoint)."""
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    return FileResponse(path=file_path, media_type="audio/mpeg")
