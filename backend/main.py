from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ai_engine import process_voice_query

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OWM_API_KEY: str = os.environ.get("OWM_API_KEY", "")
OWM_BASE_URL: str = "https://api.openweathermap.org/data/3.0/onecall"
AUDIO_DIR: Path = Path(os.environ.get("AUDIO_OUT_DIR", "./audio_cache"))
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

EXTREME_EVENTS: set[str] = {
    "tornado",
    "hurricane",
    "typhoon",
    "blizzard",
    "ice storm",
    "flood",
    "flash flood",
    "extreme cold",
    "extreme heat",
    "heat wave",
    "dust storm",
    "thunderstorm warning",
    "severe thunderstorm",
    "tropical storm",
    "extreme weather",
}

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class WeatherRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    crop_type: Optional[str] = Field(None, description="Optional crop profile for LLM advisory")


class WeatherAlert(BaseModel):
    sender: str = "Weather Service"
    event: str
    description: str = ""


class WeatherData(BaseModel):
    temperature: float = Field(..., description="Temperature in Celsius")
    temperature_c: Optional[float] = None
    description: str
    humidity: int
    has_extreme_alert: bool
    alerts: list[WeatherAlert] = Field(default_factory=list)

    def model_post_init(self, __context: object) -> None:
        if self.temperature_c is None:
            self.temperature_c = self.temperature


class WeatherResponse(BaseModel):
    status: str = "ok"
    lat: float
    lon: float
    crop_type: Optional[str] = None
    weather: WeatherData

    @property
    def data(self) -> WeatherData:
        """Alias for frontend compatibility."""
        return self.weather


class AdvisoryResponse(BaseModel):
    status: str = "ok"
    text_response: str
    audio_url: str
    lang: str
    crop_profile: str


# ---------------------------------------------------------------------------
# App Initialization & Middleware
# ---------------------------------------------------------------------------

app = FastAPI(
    title="WeatherGPT API",
    version="1.0.0",
    description="Backend services for WeatherGPT AI-powered farm weather advisor",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Weather Fetcher & Parser
# ---------------------------------------------------------------------------


async def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch current weather + alerts from OpenWeatherMap One Call 3.0 API."""
    if not OWM_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OWM_API_KEY is not configured in backend .env file.",
        )

    params = {
        "lat": lat,
        "lon": lon,
        "appid": OWM_API_KEY,
        "units": "metric",
        "exclude": "minutely,hourly,daily",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(OWM_BASE_URL, params=params)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"OpenWeatherMap API error: {resp.text}",
        )

    return resp.json()


def parse_weather(raw: dict) -> WeatherData:
    """Extract and validate weather metrics from raw OWM payload."""
    current = raw.get("current", {})
    weather_block = current.get("weather", [{}])[0]
    alerts_raw = raw.get("alerts", [])

    alerts: list[WeatherAlert] = [
        WeatherAlert(
            sender=a.get("sender_name", "Weather Authority"),
            event=a.get("event", "Weather Alert"),
            description=a.get("description", ""),
        )
        for a in alerts_raw
    ]

    has_extreme = any(
        a.event.lower() in EXTREME_EVENTS
        or "warning" in a.event.lower()
        or "extreme" in a.event.lower()
        for a in alerts
    ) or (len(alerts) > 0)

    temp = float(current.get("temp", 0.0))

    return WeatherData(
        temperature=temp,
        temperature_c=temp,
        description=weather_block.get("description", "Unknown conditions"),
        humidity=int(current.get("humidity", 0)),
        has_extreme_alert=has_extreme,
        alerts=alerts,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "WeatherGPT",
        "owm_configured": bool(OWM_API_KEY),
    }


@app.post("/api/weather", response_model=WeatherResponse)
async def get_weather(req: WeatherRequest) -> WeatherResponse:
    """Fetch live weather metrics and alert status for given coordinates."""
    raw = await fetch_weather(req.lat, req.lon)
    weather = parse_weather(raw)

    return WeatherResponse(
        status="ok",
        lat=req.lat,
        lon=req.lon,
        crop_type=req.crop_type,
        weather=weather,
    )


@app.post("/api/advisory", response_model=AdvisoryResponse)
async def get_voice_advisory(
    audio: UploadFile = File(..., description="Audio recording of farmer query"),
    crop_type: str = Form("general"),
    lat: float = Form(20.5937),
    lon: float = Form(78.9629),
) -> AdvisoryResponse:
    """End-to-end voice pipeline: Audio STT -> LLM Crop Advisory -> TTS Audio."""
    audio_bytes = await audio.read()

    # 1. Fetch current weather for the farmer's location
    try:
        raw_weather = await fetch_weather(lat, lon)
        weather_data = parse_weather(raw_weather).model_dump()
    except Exception:
        # Fallback simulated weather if key not yet provided
        weather_data = {
            "temperature": 32.0,
            "humidity": 65,
            "description": "partly cloudy",
            "has_extreme_alert": False,
        }

    # 2. Run AI pipeline (STT -> LLM -> TTS)
    result = await process_voice_query(
        audio_bytes=audio_bytes,
        weather_json=weather_data,
        crop_profile=crop_type,
    )

    audio_file_name = Path(result["audio_file_path"]).name

    return AdvisoryResponse(
        status="ok",
        text_response=result["text_response"],
        audio_url=f"/api/audio/{audio_file_name}",
        lang=result["lang"],
        crop_profile=crop_type,
    )


@app.get("/api/audio/{filename}")
async def get_audio_file(filename: str):
    """Serve synthesized TTS audio response files."""
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path=file_path, media_type="audio/mpeg")
