"""
WeatherGPT — Application Root Entrypoint
Run directly from root:
    uvicorn main:app --reload

Or from backend directory:
    cd backend && uvicorn main:app --reload
"""
import sys
from pathlib import Path

# Add backend directory to sys.path for direct imports
BACKEND_DIR = Path(__file__).resolve().parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402, F401

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
