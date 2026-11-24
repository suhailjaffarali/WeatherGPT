import httpx
import sys

base = "http://127.0.0.1:8000"

print("1. Testing GET /health...")
r = httpx.get(f"{base}/health", timeout=5)
assert r.status_code == 200, f"Health failed: {r.status_code}"
print("   Health OK:", r.json())

print("2. Testing POST /api/advisory...")
r = httpx.post(f"{base}/api/advisory", json={"lat": 28.6, "lon": 77.2, "crop_stage": "growing"}, timeout=10)
assert r.status_code == 200, f"Advisory failed: {r.status_code}"
data = r.json()
assert "irrigation" in data and "spraying" in data and "harvest" in data
print("   Advisory OK! Irrigation badge:", data["irrigation"]["badge"])

print("3. Testing GET /api/soil...")
r = httpx.get(f"{base}/api/soil?lat=28.6&lon=77.2", timeout=10)
assert r.status_code == 200, f"Soil failed: {r.status_code}"
soil_data = r.json()
assert "soil" in soil_data
print("   Soil OK! Root moisture:", soil_data["soil"]["soil_moisture_root"], "Data source:", soil_data["soil"]["data_source"])

print("4. Testing POST /api/chat with live Groq LLM...")
r = httpx.post(f"{base}/api/chat", json={
    "message": "मेरी धान की फसल में खाद कब डालनी चाहिए?",
    "lang": "hi",
    "crop_type": "rice",
    "crop_stage": "growing"
}, timeout=15)
assert r.status_code == 200, f"Chat failed: {r.status_code}"
chat_data = r.json()
assert "reply" in chat_data and len(chat_data["reply"]) > 5
print("   Chat OK! Powered by:", chat_data.get("powered_by"))
print("   Reply preview:", chat_data["reply"][:120])

print("5. Testing POST /api/voice-query with simulated audio...")
# Upload 2KB of audio bytes
dummy_audio = b"\x00" * 2048
r = httpx.post(
    f"{base}/api/voice-query",
    files={"audio": ("test.mp3", dummy_audio, "audio/mpeg")},
    data={"lang": "hi", "crop_type": "rice", "crop_stage": "growing"},
    timeout=20
)
assert r.status_code == 200, f"Voice query failed: {r.status_code}"
voice_data = r.json()
assert "text_response" in voice_data
print("   Voice query OK! STT simulated:", voice_data.get("stt_simulated"))
print("   TTS available:", voice_data.get("tts_available"))
print("   Audio URL:", voice_data.get("audio_url"))
print("   Response preview:", voice_data["text_response"][:120])

print("\n>>> ALL 5 ENDPOINTS TESTED AND VERIFIED WORKING 100%! <<<")
