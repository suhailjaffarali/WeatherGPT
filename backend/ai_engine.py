"""

ai_engine.py — WeatherGPT AI Processing Pipeline v2.1

Changes v2.1:
  - Full structured logging on every exception path (item 18).
  - stt_simulated flag in STTResult and AIResponse (item 23).
  - Groq Whisper real STT; falls back gracefully with stt_simulated=True (item 23).
  - <think>…</think> stripped from all LLM outputs (item 8).
  - max_tokens raised to 400 for Indic scripts (item 8).
  - Model names from env vars (item 8).
  - gTTS runs in asyncio.to_thread — non-blocking (item 5).
  - No null-byte corrupt audio on failure (item 4).
  - Punjabi (pa) has no server TTS voice — skipped cleanly (item 6).

Provider priority (fastest-first, all free):
  1. Groq Cloud      — GROQ_MODEL env var (default: qwen/qwen3.8-27b)
  2. Hugging Face    — HF_MODEL env var   (default: Qwen/Qwen2.5-72B-Instruct)
  3. Gemini          — GEMINI_MODEL env var (default: gemini-2.0-flash)
  4. Offline rules   — deterministic fallback (always works)

TTS server-side language support (gTTS):
  Supported  : en, hi, ta, te, bn, mr
  No support : pa — client uses device-native TTS; audio_url returns null.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional, TypedDict

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class STTResult(TypedDict):
    transcript: str
    lang: str
    stt_simulated: bool    # True when Groq Whisper was not used  (item 23)


class AIResponse(TypedDict):
    text_response: str
    audio_file_path: Optional[str]
    tts_available: bool
    stt_simulated: bool
    lang: str
    transcript: Optional[str]


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AUDIO_OUT_DIR: Path = Path(os.environ.get("AUDIO_OUT_DIR", "./audio_cache"))

GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
HF_TOKEN: str = os.environ.get("HF_TOKEN", "")
GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")

GROQ_URL: str = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL: str = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
GROQ_WHISPER_MODEL: str = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")

HF_ROUTER_URL: str = "https://router.huggingface.co/novita/v1/chat/completions"
HF_MODEL: str = os.environ.get("HF_MODEL", "Qwen/Qwen2.5-72B-Instruct")

GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

# Languages with known gTTS server-side voice support
TTS_SUPPORTED_LANGS: set[str] = {"en", "hi", "ta", "te", "bn", "mr"}

# ---------------------------------------------------------------------------
# System prompt with guardrails                                 (item 12)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT: str = (
    "You are an expert agricultural agronomist and weather assistant for rural Indian farmers. "
    "You receive real-time (or estimated) weather metrics and root-zone soil moisture data, "
    "plus a Decision Engine verdict block listing fixed irrigation, spraying, and harvest recommendations. "
    "You MUST follow those verdicts exactly and not contradict them. "
    "RULES: "
    "(1) Never state pesticide or fertiliser dosages or brand names. "
    "(2) Use only the numeric values provided — do not invent measurements. "
    "(3) When data is marked ESTIMATED, tell the farmer it may not be exact. "
    "(4) For chemical questions refer to the local Krishi Vigyan Kendra (KVK) or agriculture officer. "
    "(5) For natural disasters refer to official IMD alerts. "
    "(6) Answer in the requested language (Hindi, Punjabi, Telugu, Tamil, Marathi, Bengali, or English). "
    "(7) Limit response to 2-3 clear, practical sentences. "
    "No meteorological jargon."
)

LANG_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi (हिन्दी)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
    "te": "Telugu (తెలుగు)",
    "ta": "Tamil (தமிழ்)",
    "mr": "Marathi (मराठी)",
    "bn": "Bengali (বাংলা)",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _strip_think(text: str) -> str:
    return _THINK_RE.sub("", text).strip()


# ---------------------------------------------------------------------------
# LLM callers
# ---------------------------------------------------------------------------


async def _call_groq(messages: list[dict]) -> Optional[str]:
    """Call Groq Cloud Chat API (GROQ_MODEL env var)."""
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": GROQ_MODEL, "messages": messages,
                      "max_tokens": 400, "temperature": 0.5},
            )
            if resp.status_code == 200:
                return _strip_think(resp.json()["choices"][0]["message"]["content"].strip())
            logger.warning("Groq LLM returned HTTP %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("Groq LLM call failed: %s", exc)
    return None


async def _call_huggingface(messages: list[dict]) -> Optional[str]:
    """Call Hugging Face Serverless Chat API (HF_MODEL env var)."""
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                HF_ROUTER_URL,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"model": HF_MODEL, "messages": messages,
                      "max_tokens": 400, "temperature": 0.5},
            )
            if resp.status_code == 200:
                return _strip_think(resp.json()["choices"][0]["message"]["content"].strip())
            logger.warning("HF LLM returned HTTP %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("Hugging Face LLM call failed: %s", exc)
    return None


async def _call_gemini(
    prompt: str, system_instruction: str,
    previous_interaction_id: Optional[str] = None,
) -> tuple[Optional[str], Optional[str]]:
    """Call Gemini via Interactions API; return (text, interaction_id)."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None, None
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        kwargs: dict = {"model": GEMINI_MODEL, "input": prompt,
                        "system_instruction": system_instruction}
        if previous_interaction_id:
            kwargs["previous_interaction_id"] = previous_interaction_id
        interaction = await client.aio.interactions.create(**kwargs)
        output_text = getattr(interaction, "output_text", None)
        if output_text:
            return _strip_think(output_text.strip()), getattr(interaction, "id", None)
    except Exception as exc:
        logger.warning("Gemini call failed: %s", exc)
    return None, None


async def _call_llm(
    prompt: str,
    system_instruction: str,
    history: Optional[list[dict]] = None,
    previous_interaction_id: Optional[str] = None,
) -> tuple[Optional[str], Optional[str], str]:
    """Try Groq → HF → Gemini. Returns (text, interaction_id, provider)."""
    trimmed_history = (history or [])[-8:]
    messages = (
        [{"role": "system", "content": system_instruction}]
        + trimmed_history
        + [{"role": "user", "content": prompt}]
    )

    groq_text = await _call_groq(messages)
    if groq_text:
        return groq_text, None, f"Groq ({GROQ_MODEL})"

    hf_text = await _call_huggingface(messages)
    if hf_text:
        return hf_text, None, f"Hugging Face ({HF_MODEL})"

    gemini_text, interaction_id = await _call_gemini(
        prompt, system_instruction, previous_interaction_id
    )
    if gemini_text:
        return gemini_text, interaction_id, GEMINI_MODEL

    return None, None, "fallback"


# ---------------------------------------------------------------------------
# Multilingual STT simulation canned text (fallback only)
# ---------------------------------------------------------------------------

_MULTILINGUAL_TRANSCRIPTS: dict[str, dict[str, str]] = {
    "hi": {"rice": "आज धान की फसल में पानी कब देना चाहिए?",
           "wheat": "क्या आज गेहूं की सिंचाई का सही समय है?",
           "cotton": "कपास में कीटनाशक छिड़काव कब करें?",
           "general": "आज के मौसम में फसल की देखभाल कैसे करें?"},
    "pa": {"rice": "ਕੀ ਅੱਜ ਝੋਨੇ ਨੂੰ ਪਾਣੀ ਲਾਉਣਾ ਠੀਕ ਹੈ?",
           "wheat": "ਕਣਕ ਦੀ ਸਿੰਚਾਈ ਬਾਰੇ ਅੱਜ ਕੀ ਸਲਾਹ ਹੈ?",
           "cotton": "ਨਰਮੇ ਉੱਤੇ ਸਪਰੇਅ ਕਦੋਂ ਕਰੀਏ?",
           "general": "ਅੱਜ ਦੇ ਮੌਸਮ ਵਿੱਚ ਫ਼ਸਲ ਦੀ ਸਾਂਭ-ਸੰਭਾਲ ਕਿਵੇਂ ਕਰੀਏ?"},
    "te": {"rice": "ఈ రోజు వరి పంటకు నీరు పెట్టవచ్చా?",
           "wheat": "గోధుమ పంటకు ఎప్పుడు నీరు అందించాలి?",
           "cotton": "పత్తి పంటకు పురుగుల మందు ఎప్పుడు పిచికారీ చేయాలి?",
           "general": "ఈ రోజు వాతావరణంలో పంట రక్షణ సలహా ఏమిటి?"},
    "ta": {"rice": "இன்று நெல் பயிருக்கு நீர் பாய்ச்சலாமா?",
           "wheat": "கோதுமை நீர்ப்பாசனத்திற்கு சரியான நேரம் எது?",
           "cotton": "பருத்திக்கு பூச்சிக்கொல்லி மருந்து எப்போது தெளிப்பது?",
           "general": "இன்றைய வானிலைக்கு பயிர் பராமரிப்பு ஆலோசனை என்ன?"},
    "mr": {"rice": "आज भात पिकाला पाणी कधी द्यावे?",
           "wheat": "गहू पिकाला पाणी देण्याची योग्य वेळ कोणती?",
           "cotton": "कापसावर कीटकनाशक फवारणी कधी करावी?",
           "general": "आजच्या हवामानात पिकाची काळजी कशी घ्यावी?"},
    "bn": {"rice": "আজ কি ধান ফসলে সেচ দেওয়া উচিত?",
           "wheat": "গম ফসলে জল দেওয়ার সঠিক সময় কোনটি?",
           "cotton": "তুলা ফসলে কীটনাশক কখন স্প্রে করব?",
           "general": "আজকের আবহাওয়ায় ফসলের পরিচর্যা কীভাবে করব?"},
    "en": {"rice": "What should I do with my rice paddy today?",
           "wheat": "Is today a good day to irrigate my wheat field?",
           "cotton": "Should I spray pesticide on my cotton crop today?",
           "general": "What should I do with my crop today?"},
}


# ---------------------------------------------------------------------------
# Stage 1 — Speech-to-Text (Groq Whisper)                     (item 23)
# ---------------------------------------------------------------------------

async def transcribe_audio(
    audio_bytes: bytes,
    crop_hint: str = "general",
    target_lang: str = "en",
) -> STTResult:
    """
    Transcribe farmer's voice using Groq Whisper (whisper-large-v3-turbo).

    Returns stt_simulated=True when:
      - No GROQ_API_KEY is set, OR
      - audio_bytes is too small (< 1000 bytes), OR
      - Groq Whisper API call fails.

    In simulated mode a canned question matching the crop hint is used.
    """
    api_key = os.environ.get("GROQ_API_KEY", "").strip()

    if api_key and len(audio_bytes) > 1000:
        WHISPER_LANG_MAP = {
            "en": "en", "hi": "hi", "pa": "pa",
            "te": "te", "ta": "ta", "mr": "mr", "bn": "bn",
        }
        whisper_lang = WHISPER_LANG_MAP.get(target_lang, "en")
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": ("audio.m4a", audio_bytes, "audio/mp4")},
                    data={"model": GROQ_WHISPER_MODEL, "language": whisper_lang,
                          "response_format": "json"},
                )
                if resp.status_code == 200:
                    transcript = resp.json().get("text", "").strip()
                    if transcript:
                        logger.info("Groq Whisper [%s]: %s", target_lang, transcript[:80])
                        return STTResult(transcript=transcript, lang=target_lang,
                                         stt_simulated=False)
                    logger.warning("Groq Whisper returned empty transcript.")
                else:
                    logger.warning("Groq Whisper HTTP %s: %s", resp.status_code, resp.text[:200])
        except Exception as exc:
            logger.warning("Groq Whisper transcription failed: %s", exc)

    # Fallback — simulated canned query                         (item 23)
    logger.info("STT simulated fallback: lang=%s crop=%s", target_lang, crop_hint)
    lang_dict = _MULTILINGUAL_TRANSCRIPTS.get(target_lang, _MULTILINGUAL_TRANSCRIPTS["en"])
    transcript = lang_dict.get(crop_hint.lower(), lang_dict["general"])
    return STTResult(transcript=transcript, lang=target_lang, stt_simulated=True)


# ---------------------------------------------------------------------------
# Stage 2 — LLM Advisory Generation
# ---------------------------------------------------------------------------

async def generate_llm_response(
    transcript: str,
    weather_json: dict,
    crop_profile: str,
    lang: str,
    history: Optional[list[dict]] = None,
    decision_context: str = "",
) -> str:
    """Generate advisory. decision_context is injected as fixed facts before the prompt."""
    lang_label = LANG_NAMES.get(lang, "English")
    soil_info = weather_json.get("soil")
    data_source = weather_json.get("data_source", "live")
    source_note = " (NOTE: ESTIMATED data)" if data_source == "estimated" else ""

    soil_context = (
        f"Soil data{source_note}: {json.dumps(soil_info)}"
        if soil_info else f"Soil data: unavailable{source_note}"
    )
    weather_summary = {k: v for k, v in weather_json.items()
                       if k not in ("soil", "data_source", "alerts")}

    prompt = (
        f"{decision_context}"
        f"Farmer question: {transcript}\n"
        f"Crop: {crop_profile}\n"
        f"Current weather{source_note}: {json.dumps(weather_summary)}\n"
        f"{soil_context}\n"
        f"Reply strictly in {lang_label} in 2-3 clear, practical sentences."
    )

    llm_text, _, _ = await _call_llm(prompt=prompt, system_instruction=SYSTEM_PROMPT,
                                      history=history)
    if llm_text:
        return llm_text

    await asyncio.sleep(0.1)
    return _deterministic_fallback(weather_json, crop_profile, lang)


def _deterministic_fallback(weather_json: dict, crop_profile: str, lang: str) -> str:
    """Rule-based last-resort fallback using the same thresholds as decision_engine."""
    temp = float(weather_json.get("temperature", 30))
    humidity = int(weather_json.get("humidity", 50))
    alert = bool(weather_json.get("has_extreme_alert", False))
    desc = str(weather_json.get("description", "clear sky")).lower()
    is_rain = "rain" in desc or "drizzle" in desc or "shower" in desc

    soil = weather_json.get("soil") or {}
    root_m = soil.get("soil_moisture_root")
    if root_m is not None:
        pct = round(float(root_m) * 100)
        if float(root_m) > 0.35:
            irrigation_note = f" Soil is saturated ({pct}%) — skip irrigation."
        elif float(root_m) < 0.15:
            irrigation_note = f" Soil is very dry ({pct}%) — irrigate now."
        else:
            irrigation_note = f" Soil moisture is optimal ({pct}%)."
    else:
        irrigation_note = " Monitor soil moisture and irrigate in early morning if needed."

    t: dict[str, dict] = {
        "hi": {"alert": f"चेतावनी: गंभीर मौसम — {crop_profile} फसल सुरक्षित करें और नालियां साफ रखें।",
               "rain": f"बारिश की संभावना — {crop_profile} में सिंचाई रोकें।",
               "normal": f"मौसम अनुकूल — {temp:.0f}°C।{irrigation_note}"},
        "pa": {"alert": f"ਚੇਤਾਵਨੀ: ਖ਼ਰਾਬ ਮੌਸਮ — {crop_profile} ਫ਼ਸਲ ਦੀ ਰੱਖਿਆ ਕਰੋ।",
               "rain": f"ਮੀਂਹ ਦੇ ਆਸਾਰ — {crop_profile} ਨੂੰ ਪਾਣੀ ਨਾ ਲਾਓ।",
               "normal": f"ਮੌਸਮ ਠੀਕ — {temp:.0f}°C।{irrigation_note}"},
        "te": {"alert": f"హెచ్చరిక: తీవ్ర వాతావరణం — {crop_profile} పంట సురక్షితం చేయండి.",
               "rain": f"వర్షం — {crop_profile} నీటిపారుదల ఆపండి.",
               "normal": f"వాతావరణం అనుకూలం — {temp:.0f}°C.{irrigation_note}"},
        "ta": {"alert": f"எச்சரிக்கை: கடுமையான வானிலை — {crop_profile} பாதுகாக்கவும்.",
               "rain": f"மழை — {crop_profile} பாசனம் நிறுத்தவும்.",
               "normal": f"வானிலை சீர் — {temp:.0f}°C.{irrigation_note}"},
        "mr": {"alert": f"इशारा: तीव्र हवामान — {crop_profile} पीक सुरक्षित करा.",
               "rain": f"पावसाची शक्यता — {crop_profile} ला पाणी देणे थांबवा.",
               "normal": f"हवामान अनुकूल — {temp:.0f}°C.{irrigation_note}"},
        "bn": {"alert": f"সতর্কতা: তীব্র আবহাওয়া — {crop_profile} ফসল সুরক্ষিত করুন।",
               "rain": f"বৃষ্টি — {crop_profile} সেচ বন্ধ রাখুন।",
               "normal": f"আবহাওয়া অনুকূল — {temp:.0f}°C।{irrigation_note}"},
        "en": {"alert": f"⚠️ Severe weather — secure your {crop_profile} crop and clear field drains.",
               "rain": f"Rain forecast — skip irrigation for {crop_profile} today.",
               "normal": f"Stable at {temp:.0f}°C, {humidity}% humidity.{irrigation_note}"},
    }
    row = t.get(lang, t["en"])
    if alert:
        return row["alert"]
    if is_rain:
        return row["rain"]
    return row["normal"]


# ---------------------------------------------------------------------------
# Stage 3 — TTS (non-blocking)                                 (items 4,5,6)
# ---------------------------------------------------------------------------

async def synthesize_speech(text: str, lang: str) -> Optional[str]:
    """
    Synthesize audio with gTTS in a thread (non-blocking).
    Returns file path on success, None when lang unsupported or gTTS fails.

    Server TTS support: en, hi, ta, te, bn, mr.
    No support (use device TTS): pa.
    """
    if lang not in TTS_SUPPORTED_LANGS:
        logger.info("TTS: lang '%s' has no server voice — skipping.", lang)
        return None

    AUDIO_OUT_DIR.mkdir(parents=True, exist_ok=True)
    file_path = AUDIO_OUT_DIR / f"response_{uuid.uuid4().hex[:12]}.mp3"

    def _save() -> None:
        from gtts import gTTS
        gTTS(text=text, lang=lang).save(str(file_path))

    try:
        await asyncio.to_thread(_save)
        return str(file_path)
    except Exception as exc:
        logger.warning("gTTS synthesis failed for lang=%s: %s", lang, exc)
        return None


# ---------------------------------------------------------------------------
# Public API — chat_with_gemini
# ---------------------------------------------------------------------------

async def chat_with_gemini(
    message: str,
    weather_json: dict,
    crop_profile: str = "general",
    lang: str = "en",
    previous_interaction_id: Optional[str] = None,
    history: Optional[list[dict]] = None,
    decision_context: str = "",
) -> dict:
    """Multi-turn conversational agronomist reply backed by Groq/HF/Gemini."""
    lang_label = LANG_NAMES.get(lang, "English")
    soil_info = weather_json.get("soil")
    data_source = weather_json.get("data_source", "live")
    source_note = " (ESTIMATED data)" if data_source == "estimated" else ""

    soil_context = (
        f"Soil data{source_note}: {json.dumps(soil_info)}"
        if soil_info else f"Soil data: unavailable{source_note}"
    )
    weather_summary = {k: v for k, v in weather_json.items()
                       if k not in ("soil", "data_source", "alerts")}

    prompt = (
        f"{decision_context}"
        f"Farmer message: {message}\n"
        f"Crop: {crop_profile}\n"
        f"Current weather{source_note}: {json.dumps(weather_summary)}\n"
        f"{soil_context}\n"
        f"Reply strictly in {lang_label} in 2-3 clear, practical sentences."
    )

    llm_text, interaction_id, provider = await _call_llm(
        prompt=prompt, system_instruction=SYSTEM_PROMPT,
        history=history, previous_interaction_id=previous_interaction_id,
    )
    if llm_text:
        return {"reply": llm_text, "interaction_id": interaction_id, "powered_by": provider}

    fallback = _deterministic_fallback(weather_json, crop_profile, lang)
    return {"reply": fallback, "interaction_id": None, "powered_by": "fallback"}


# ---------------------------------------------------------------------------
# Public API — process_voice_query
# ---------------------------------------------------------------------------

async def process_voice_query(
    audio_bytes: bytes,
    weather_json: dict,
    crop_profile: str = "general",
    target_lang: str = "en",
    decision_context: str = "",
) -> AIResponse:
    """Full multilingual voice pipeline: STT → LLM → TTS."""
    stt = await transcribe_audio(audio_bytes, crop_hint=crop_profile, target_lang=target_lang)

    text_response = await generate_llm_response(
        transcript=stt["transcript"], weather_json=weather_json,
        crop_profile=crop_profile, lang=stt["lang"],
        decision_context=decision_context,
    )

    audio_file_path = await synthesize_speech(text=text_response, lang=stt["lang"])

    return AIResponse(
        text_response=text_response,
        audio_file_path=audio_file_path,
        tts_available=audio_file_path is not None,
        stt_simulated=stt["stt_simulated"],
        lang=stt["lang"],
        transcript=stt["transcript"],
    )
