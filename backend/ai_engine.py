"""
ai_engine.py — WeatherGPT AI processing pipeline.

Stages:  audio → STT (Whisper mock) → LLM (mock) → TTS (gTTS mock) → response
All external calls are mocked; swap with real SDKs when ready.
"""

import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import TypedDict

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class STTResult(TypedDict):
    transcript: str
    lang: str


class AIResponse(TypedDict):
    text_response: str
    audio_file_path: str
    lang: str


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AUDIO_OUT_DIR: Path = Path(os.environ.get("AUDIO_OUT_DIR", "./audio_cache"))
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")

SYSTEM_PROMPT: str = (
    "You are an agricultural weather assistant for rural farmers. "
    "Given the current weather data and a specific crop profile, "
    "provide short, actionable advice tailored to the crop. "
    "Do NOT use meteorological jargon. "
    "Use simple, practical language a farmer can immediately act on. "
    "Reply in the same language the farmer spoke in (detected language). "
    "Limit your response to 3-4 sentences maximum."
)

# ---------------------------------------------------------------------------
# Stage 1 — Speech-to-Text (Whisper mock)
# ---------------------------------------------------------------------------


async def transcribe_audio(audio_bytes: bytes) -> STTResult:
    """
    Mock: Simulates OpenAI Whisper API transcription.

    Real implementation:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        transcript = await client.audio.transcriptions.create(
            model="whisper-1",
            file=("audio.webm", audio_bytes),
            response_format="verbose_json",
        )
        return {"transcript": transcript.text, "lang": transcript.language}
    """
    await asyncio.sleep(0.3)  # simulate network latency

    _ = audio_bytes  # acknowledge input

    return STTResult(
        transcript="What should I do with my rice crop today?",
        lang="en",
    )


# ---------------------------------------------------------------------------
# Stage 2 — LLM advisory generation (mock)
# ---------------------------------------------------------------------------


def _build_user_prompt(
    transcript: str,
    weather_json: dict,
    crop_profile: str,
    lang: str,
) -> str:
    weather_summary = json.dumps(weather_json, indent=2)
    return (
        f"Farmer's question ({lang}): \"{transcript}\"\n\n"
        f"Crop: {crop_profile}\n\n"
        f"Current weather data:\n```json\n{weather_summary}\n```\n\n"
        "Give your advice now."
    )


async def generate_llm_response(
    transcript: str,
    weather_json: dict,
    crop_profile: str,
    lang: str,
) -> str:
    """
    Mock: Simulates an LLM chat completion (OpenAI / Gemini).

    Real implementation (OpenAI):
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        completion = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=256,
        )
        return completion.choices[0].message.content

    Real implementation (Gemini):
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.4,
                max_output_tokens=256,
            ),
        )
        return response.text
    """
    user_prompt = _build_user_prompt(transcript, weather_json, crop_profile, lang)
    _ = user_prompt  # would be sent to real API

    await asyncio.sleep(0.5)  # simulate network latency

    # --- mock response keyed to weather conditions ---
    temp = weather_json.get("temperature", 30)
    humidity = weather_json.get("humidity", 50)
    alert = weather_json.get("has_extreme_alert", False)

    if alert:
        return (
            f"Warning: extreme weather detected. Secure your {crop_profile} crop immediately. "
            "Cover seedlings with protective mulch, ensure drainage channels are clear, "
            "and delay any fertilizer application until conditions stabilize."
        )

    if temp > 38:
        return (
            f"It's very hot at {temp}°C. Water your {crop_profile} early morning or late evening. "
            "Add straw mulch around the base to keep roots cool and reduce water loss."
        )

    if humidity > 80:
        return (
            f"Humidity is high at {humidity}%. Watch your {crop_profile} for fungal diseases. "
            "Improve air circulation and avoid overhead watering today."
        )

    return (
        f"Conditions look favorable for your {crop_profile}. "
        f"Temperature is {temp}°C with {humidity}% humidity — a good day for regular maintenance. "
        "Check soil moisture and irrigate only if the top inch of soil is dry."
    )


# ---------------------------------------------------------------------------
# Stage 3 — Text-to-Speech (gTTS mock)
# ---------------------------------------------------------------------------


async def synthesize_speech(text: str, lang: str) -> str:
    """
    Mock: Simulates gTTS text-to-speech synthesis.

    Real implementation:
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang)
        tts.save(str(file_path))
    """
    AUDIO_OUT_DIR.mkdir(parents=True, exist_ok=True)
    file_name = f"response_{uuid.uuid4().hex[:12]}.mp3"
    file_path = AUDIO_OUT_DIR / file_name

    await asyncio.sleep(0.2)  # simulate synthesis time

    # Write a tiny placeholder file so the path is valid
    file_path.write_bytes(b"\x00" * 64)

    return str(file_path)


# ---------------------------------------------------------------------------
# Pipeline entrypoint
# ---------------------------------------------------------------------------


async def process_voice_query(
    audio_bytes: bytes,
    weather_json: dict,
    crop_profile: str = "general",
) -> AIResponse:
    """
    Full pipeline: STT → LLM → TTS.

    Parameters
    ----------
    audio_bytes : bytes
        Raw audio from the client microphone.
    weather_json : dict
        Parsed weather data from OpenWeatherMap (temperature, humidity, etc.).
    crop_profile : str
        Crop type the farmer is growing (e.g., "rice", "wheat").

    Returns
    -------
    AIResponse
        text_response : The LLM advisory text.
        audio_file_path : Path to the generated MP3 file.
        lang : Detected language code.
    """
    # Stage 1: Transcribe
    stt: STTResult = await transcribe_audio(audio_bytes)

    # Stage 2: Generate advice
    text_response: str = await generate_llm_response(
        transcript=stt["transcript"],
        weather_json=weather_json,
        crop_profile=crop_profile,
        lang=stt["lang"],
    )

    # Stage 3: Synthesize audio
    audio_file_path: str = await synthesize_speech(
        text=text_response,
        lang=stt["lang"],
    )

    return AIResponse(
        text_response=text_response,
        audio_file_path=audio_file_path,
        lang=stt["lang"],
    )

