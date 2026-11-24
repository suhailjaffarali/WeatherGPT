import httpx, json
r = httpx.post("http://localhost:8000/api/chat", json={"message": "Should I irrigate rice today?", "lang": "en", "crop_type": "rice"}, timeout=15)
print(f"Status: {r.status_code}")
data = r.json()
print(f"Powered by: {data.get('powered_by')}")
print(f"Reply: {data.get('reply','')[:300]}")
