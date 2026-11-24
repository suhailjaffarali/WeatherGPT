import httpx, os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

key = os.environ.get("GROQ_API_KEY", "").strip()
print(f"Key present: {bool(key)}")
print(f"Key prefix: {key[:10]}...")

# Test the call
try:
    r = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": "qwen/qwen3.8-27b", "messages": [{"role": "user", "content": "Say hello"}], "max_tokens": 30},
        timeout=15,
    )
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:500]}")
except Exception as e:
    print(f"Error: {e}")
