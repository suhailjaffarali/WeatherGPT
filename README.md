# WeatherGPT 🌦️🌾

**AI-Powered Agricultural Weather Assistant for Farmers**

WeatherGPT is a full-stack mobile application and backend designed to provide rural farmers with hyper-local weather intelligence, extreme event alerts, and voice-accessible crop advisory using LLMs.

---

## 📁 Project Architecture

```
WeatherGPT/
│
├── backend/                       # FastAPI Python Backend
│   ├── main.py                    # API Endpoints (Weather + Voice Advisory)
│   ├── ai_engine.py               # AI Pipeline (STT → LLM → TTS)
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Environment variables template
│   └── audio_cache/               # Local cache for generated TTS audio
│
├── mobile/                        # React Native / Expo Frontend
│   ├── App.tsx                    # Mobile App Entrypoint
│   ├── MainScreen.tsx             # Glassmorphic UI with dynamic weather gradients
│   ├── MainScreen.nativewind.js   # NativeWind / Tailwind alternative
│   ├── package.json               # Mobile npm dependencies
│   └── app.json                   # Expo configuration
│
├── legacy_pl_predictor/           # Archived Premier League ML prediction scripts
│
├── main.py                        # Root launcher script
├── .gitignore                     # Git configuration
└── README.md                      # Project documentation
```

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
# Edit .env with your OpenWeatherMap (and optionally OpenAI / Gemini) keys

# Start server
uvicorn main:app --reload --port 8000
```
- API Docs will be live at `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2. Mobile App Setup (Expo React Native)

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npx expo start
```
- Scan QR code using **Expo Go** on Android/iOS, or press `a` for Android Emulator / `i` for iOS Simulator.

---

## ⚡ Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status and API key check |
| `POST` | `/api/weather` | Accepts `{ "lat": float, "lon": float, "crop_type": string }` and returns weather metrics + alerts |
| `POST` | `/api/advisory` | Accepts voice recording + coordinates, returns LLM crop advice and synthesized TTS audio URL |
| `GET` | `/api/audio/{filename}` | Streams generated speech audio to mobile client |

