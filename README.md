# WeatherGPT 🌦️🌾

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_58-61DAFB?style=flat&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![Groq](https://img.shields.io/badge/Groq-Whisper_%26_LLaMA-F05A28?style=flat)](https://groq.com)
[![Pytest](https://img.shields.io/badge/Tests-43_Passed_(100%25)-brightgreen?style=flat&logo=pytest&logoColor=white)](https://docs.pytest.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Hyperlocal Spoken Weather Intelligence & Agronomy Advisory for Indian Farmers**  
> Designed to empower rural farmers across India with real-time root-zone soil telemetry, deterministic agronomic safety verdicts, Groq Whisper voice recognition, and spoken advisories in **7 Indian languages** (Hindi, Punjabi, Telugu, Tamil, Marathi, Bengali, and English).

---

## 🌟 Key Features

### 🎙️ 1. Native Voice Assistant & Real Speech-to-Text (STT)
- **Groq Whisper Turbo (`whisper-large-v3-turbo`)**: Instant transcription of spoken farmer queries in Indian accents and dialects.
- **Expo Audio Native Recording**: Built with modern `expo-audio` hook-based architecture (`useAudioRecorder`) for high-fidelity native microphone capture on Android and iOS, alongside Web Speech API for browsers.
- **Hands-Free Agronomic Advice**: Auto-synthesizes spoken dialect responses using `expo-speech` and `gTTS` with automatic regional dialect voice fallback (e.g. `pa-IN`, `te-IN`, `ta-IN` gracefully falling back to `hi-IN` if native packs are not pre-installed).

### 🌾 2. Kisan Portal & Crop Lifecycle Telemetry
- **Crop Profile Selector**: Visual profiles for staple crops including **Rice (धान)**, **Wheat (गेहूं)**, and **Cotton (कपास)**.
- **3-Stage Lifecycle Stepper**: Dynamic advice adapts across **Sowing (बुवाई)** 🌱, **Growing (बढ़वार)** 🌿, and **Harvest (कटाई)** 🌾.
- **Root-Zone Soil Intelligence**: Live metrics pulled from Open-Meteo:
  - Shallow Soil Moisture ($0\text{–}1\text{ cm}$) & Root-Zone Moisture ($9\text{–}27\text{ cm}$).
  - Reference Evapotranspiration ($ET_0$) in mm/day.
  - Vapour Pressure Deficit (VPD) in kPa to prevent plant transpiration stress.
- **Interactive Audio Equalizer**: Real-time soundwave animation during audio playback with individual card-level speech readers.

### 🧠 3. Deterministic Decision Engine & LLM Cascade
- **Rule-Based Guardrails First**: Critical agricultural decisions (irrigation, chemical spraying, harvesting) run through a strict, unit-tested deterministic decision engine **before** reaching any LLM.
- **Multi-Tier LLM Fallback Cascade**:
  1. **Groq Cloud** (`qwen/qwen3.8-27b`) — Ultra-low latency inference.
  2. **HuggingFace Inference API** (`Qwen/Qwen2.5-72B-Instruct`) — Secondary cloud model.
  3. **Google Gemini** (`gemini-2.0-flash`) — Multimodal resilience fallback.
  4. **Offline Agronomic Rules** — 100% deterministic local rules if all upstream APIs fail.
- **AI Safety & Agronomy Compliance**: Strictly prohibits uncalibrated chemical pesticide brand recommendations, validates safety thresholds, and cites IMD / KVK agronomic principles.

### 🛡️ 4. Security & Production Hardening
- **SlowAPI Rate Limiting**: 30 req/min on `/api/chat`, 10 req/min on `/api/voice-query` with IP-based throttling.
- **CORS Hardening**: Strict origin configuration via `ALLOWED_ORIGINS` (never combines wildcards with credentials).
- **Upload Validation**: File upload size limits (max 5 MB) and MIME-type verification (HTTP 413 / 415 error codes).
- **In-Memory TTL Caching**: 10-minute cache on weather and soil endpoints keyed by coordinates rounded to 2 decimal places to conserve upstream API limits.
- **Audio Cache Garbage Collection**: Background task deletes synthesized audio files older than 2 hours every 30 minutes.
- **Connection Pooling**: Lifespan-managed singleton `httpx.AsyncClient` eliminates per-request handshake overhead.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WeatherGPT Mobile App                           │
│              (React Native • Expo SDK 58 • TypeScript)                │
│                                                                        │
│   ┌─────────────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│   │ 🌦️ Live Weather UI  │  │ 🌾 Kisan Portal UI │  │ 💬 AI Advisor  │  │
│   │ • Glassmorphism FX  │  │ • Crop Stepper     │  │ • 7 Dialects   │  │
│   │ • Dynamic Sky BG    │  │ • Soil KPI Strip   │  │ • Voice Dict.  │  │
│   └─────────────────────┘  └────────────────────┘  └────────────────┘  │
│                                      │                                 │
│                   expo-audio (Mic) / expo-speech (TTS)                 │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │ HTTP / REST (LAN / Cloud)
┌──────────────────────────────────────▼─────────────────────────────────┐
│                          FastAPI Backend                               │
│              (Python 3.11+ • Uvicorn • SlowAPI • Pydantic)              │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     Security & Gateways                        │   │
│   │  • X-API-Key Auth  • SlowAPI Rate Limiter  • File Validation  │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │             Hyperlocal Environmental Aggregator                │   │
│   │  • OpenWeatherMap (Forecasts & Extreme Weather Alerts)        │   │
│   │  • Open-Meteo (Root Soil Moisture, ET₀, VPD) [10m TTL Cache]  │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │             Deterministic Agronomic Decision Engine             │   │
│   │  • Irrigation: Skip (Rain/Saturated) vs Irrigate (Dry)        │   │
│   │  • Spraying: Safe vs Delay (Wind > 15 km/h, Rain, High VPD)   │   │
│   │  • Harvest: Safe vs Hold (Frost, Storm, Rain in 48h)           │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 STT & Multilingual AI Pipeline                 │   │
│   │  1. STT: Groq Whisper Turbo (`whisper-large-v3-turbo`)        │   │
│   │  2. LLM: Groq Qwen 27B ➔ HF Qwen 72B ➔ Gemini ➔ Local Rules   │   │
│   │  3. TTS: gTTS Multilingual Engine / Native Audio Synthesizer  │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Repository Structure

```
WeatherGPT/
├── backend/                       # Python FastAPI Core
│   ├── main.py                    # App entrypoint, endpoints, rate limiting, lifespan
│   ├── ai_engine.py               # Groq Whisper STT, LLM cascade, gTTS audio synthesis
│   ├── decision_engine.py         # Pure deterministic agronomic decision engine
│   ├── requirements.txt           # Production dependencies
│   ├── .env.example               # Template environment configuration (no secrets)
│   ├── Dockerfile                 # Gunicorn + Uvicorn container configuration
│   └── tests/                     # Comprehensive Pytest test suite
│       ├── test_api.py            # API health, auth, CORS, upload validation, LLM order
│       └── test_decision_engine.py# Decision thresholds, boundary conditions, alerts
│
├── mobile/                        # React Native / Expo Frontend
│   ├── App.tsx                    # Mobile root component
│   ├── MainScreen.tsx             # Main dashboard (Weather, Kisan Portal, AI Advisor)
│   ├── KisanPortal.js             # Visual crop selector, lifecycle stepper, soil telemetry
│   ├── ChatbotScreen.tsx          # Multilingual chat interface with voice dictation
│   ├── VoiceAssistantModal.tsx    # Live mic recording orb powered by expo-audio
│   ├── WeatherBackground.tsx      # Dynamic weather conditions gradient canvas
│   ├── LocationSearchModal.tsx    # Indian district & GPS locator modal
│   ├── SettingsModal.tsx          # Language (7 dialects), speech speed, units
│   ├── translations.ts            # Complete dictionary for en, hi, pa, te, ta, mr, bn
│   ├── apiConfig.ts               # Dynamic LAN IP & localhost autodetection
│   ├── app.json                   # Expo SDK 58 app manifest & permissions
│   └── package.json               # Frontend dependencies (React Native 0.88, React 19)
│
├── .gitignore                     # Git ignore rules (secrets, venv, node_modules, cache)
├── main.py                        # Root launcher proxy
└── README.md                      # Project documentation
```

---

## ⚡ API Endpoints Reference

| Method | Endpoint | Description | Auth / Rate Limit |
|---|---|---|---|
| `GET` | `/health` | Health probe & provider configuration booleans | Public |
| `POST` | `/api/weather` | Current weather, multi-day forecast & extreme IMD alerts | `X-API-Key` (optional) |
| `GET` | `/api/soil` | Root-zone soil moisture ($0\text{–}27\text{ cm}$), $ET_0$, and VPD | `X-API-Key` (optional) |
| `POST` | `/api/advisory` | Server-side deterministic agronomic verdicts (no LLM) | `X-API-Key` (optional) |
| `POST` | `/api/chat` | Multilingual conversational agronomist with decision context | 30 req / min |
| `POST` | `/api/voice-query` | Multipart audio upload $\to$ Groq Whisper STT $\to$ LLM $\to$ TTS | 10 req / min (Max 5 MB) |
| `GET` | `/static/audio/{file}` | Serves cached synthesized speech MP3 files | Public |

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**
- **Expo Go** mobile app on Android / iOS (or Android Studio emulator)
- (Optional) Free API keys for **Groq Cloud**, **OpenWeatherMap**, or **Google Gemini**

---

### 1. Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate a Python virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux / macOS:
# source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create your .env file from the template
copy .env.example .env    # Windows
# cp .env.example .env    # Linux / macOS

# 5. Edit backend/.env with your API keys:
# GROQ_API_KEY=gsk_...
# OWM_API_KEY=...
# GEMINI_API_KEY=...

# 6. Run the FastAPI development server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive Swagger API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

---

### 2. Mobile App Setup (React Native / Expo)

```bash
# 1. Navigate to mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Start Expo development server
npx expo start
```

#### Running on Your Device:
- **Android / iOS Device**: Open the **Expo Go** app and scan the QR code displayed in your terminal.
- **Web Browser**: Press `w` in the terminal to run in Chrome / Edge with Web Speech recognition.
- **Android Emulator**: Press `a` in the terminal.

> [!TIP]
> The app includes automatic LAN IP resolution (`apiConfig.ts`). If testing on a physical phone over Wi-Fi, ensure your phone and PC are connected to the same Wi-Fi network.

---

### 3. Running Backend Tests

The backend includes a comprehensive Pytest test suite covering decision engine boundary thresholds, upload validation, LLM fallback cascades, and weather alert parsing:

```bash
cd backend
venv\Scripts\python.exe -m pytest tests -v
```

**Test Suite Coverage:**
```
======================= 43 passed in 4.14s =======================
✔ TestHealth (health_ok, no_secrets_leaked)
✔ TestAlertParsing (extreme_event_flag, warning_flag, multiple_alerts)
✔ TestEstimatedDataFlag (open_meteo_fallback, owm_fallback)
✔ TestLLMFallbackOrder (groq_cascade, hf_fallback, gemini_fallback, offline_rules)
✔ TestUploadValidation (reject_oversized, reject_non_audio, accept_audio_mpeg)
✔ TestDecisionEngine (irrigation_verdicts, spraying_verdicts, harvest_verdicts)
```

---

### 4. Docker Deployment

Deploy with Docker using the production multi-worker Gunicorn setup:

```bash
cd backend

# Build Docker image
docker build -t weathergpt-backend .

# Run container on port 8000
docker run -d -p 8000:8000 --env-file .env --name weathergpt weathergpt-backend
```

---

## 🌐 Supported Indian Languages

| Language | Code | Spoken TTS Voice | Groq Whisper STT | UI Translations |
|---|:---:|:---:|:---:|:---:|
| **English** | `en` | `en-IN` | Supported | 100% |
| **Hindi (हिन्दी)** | `hi` | `hi-IN` | Supported | 100% |
| **Punjabi (ਪੰਜਾਬੀ)** | `pa` | `pa-IN` (Native Fallback) | Supported | 100% |
| **Telugu (తెలుగు)** | `te` | `te-IN` | Supported | 100% |
| **Tamil (தமிழ்)** | `ta` | `ta-IN` | Supported | 100% |
| **Marathi (मराठी)** | `mr` | `mr-IN` | Supported | 100% |
| **Bengali (বাংলা)** | `bn` | `bn-IN` | Supported | 100% |

---

## 🔒 Security & Privacy

- **Zero Secret Leakage**: API keys and tokens are strictly kept out of version control via `.gitignore`. The `/health` endpoint only reports boolean configuration states (`true`/`false`), never exposing the actual secrets.
- **Guardrailed Outputs**: LLM system prompts strictly avoid recommending high-risk chemical dosages or brand names, encouraging organic alternatives and verification through local Krishi Vigyan Kendras (KVK).
- **Ephemeral Audio Storage**: Audio recordings sent for transcription are processed in memory and cleaned up immediately; synthesized voice caches older than 2 hours are purged automatically.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
