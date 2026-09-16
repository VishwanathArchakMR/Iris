import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)

for p in [CURRENT_DIR, PROJECT_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

from main import _load_env_file

_load_env_file()

api_key = os.getenv("GEMINI_API_KEY", "").strip()
model = os.getenv("GEMINI_MODEL", "").strip()

print("MODEL =", model)
print("KEY PRESENT =", bool(api_key))
print("KEY PREFIX =", api_key[:3] if api_key else "NONE")

try:
    from google import genai

    client = genai.Client(api_key=api_key)

    print("\nCalling Gemini...\n")

    response = client.models.generate_content(
        model=model,
        contents="Reply with exactly: TEST_OK"
    )

    print("SUCCESS")
    print("RESPONSE =", response.text)

except Exception as e:
    print("\n===== ACTUAL GEMINI ERROR =====")
    print(type(e).__name__)
    print(str(e))
    print("===== END ERROR =====")