import httpx, json

base = "http://localhost:8000"

# Test /api/advisory
r1 = httpx.post(f"{base}/api/advisory", json={"lat": 28.6, "lon": 77.2, "crop_stage": "growing"}, timeout=10)
print("ADVISORY status:", r1.status_code)
d = r1.json()
print("  irrigation:", d.get("irrigation"))
print("  spraying  :", d.get("spraying"))
print("  harvest   :", d.get("harvest"))
print("  data_src  :", d.get("data_source"))

# Test /api/chat with history
r2 = httpx.post(f"{base}/api/chat", json={
    "message": "Should I water my rice today?",
    "lang": "en",
    "crop_type": "rice",
    "crop_stage": "growing",
    "history": [
        {"role": "user", "content": "What crop should I grow in June?"},
        {"role": "assistant", "content": "In June, rice is a good choice for most of India."}
    ]
}, timeout=20)
print("\nCHAT status:", r2.status_code)
d2 = r2.json()
print("  powered_by:", d2.get("powered_by"))
print("  reply     :", d2.get("reply", "")[:200])
