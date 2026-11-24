"""
WeatherGPT — Application Root Entrypoint

Run from project root:
    uvicorn main:app --host 0.0.0.0 --port 8000
    or: uvicorn backend.main:app --host 0.0.0.0 --port 8000

Run from backend directory:
    cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    import backend.main as _backend_main
except ImportError:
    import main as _backend_main

# Re-export key attributes from backend.main for compatibility
app = _backend_main.app
parse_weather = getattr(_backend_main, "parse_weather", None)
fetch_soil_data = getattr(_backend_main, "fetch_soil_data", None)
_estimated_weather = getattr(_backend_main, "_estimated_weather", None)
get_http_client = getattr(_backend_main, "get_http_client", None)
fetch_weather = getattr(_backend_main, "fetch_weather", None)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000)
