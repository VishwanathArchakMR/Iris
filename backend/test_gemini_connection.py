"""
test_gemini_connection.py — Minimal standalone Gemini connectivity test for SIH26171.
Tests the configured Gemini model using the server's environment variables.
Reports strictly GEMINI_OK or GEMINI_ERROR.
NEVER prints or exposes the API key.
"""
import os
import sys

# Ensure backend directory is in path and load .env if available
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
for p in [CURRENT_DIR, PROJECT_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

from main import _load_env_file, HAS_GENAI_SDK

def run_test():
    _load_env_file()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()

    print(f"Testing Gemini connectivity (model: {model_name})...")
    if not api_key:
        print("GEMINI_ERROR: GEMINI_API_KEY environment variable is not set")
        return False

    if not HAS_GENAI_SDK:
        print("GEMINI_ERROR: google-genai SDK not installed")
        return False

    try:
        from google import genai
        import concurrent.futures

        def _call():
            client = genai.Client(api_key=api_key)
            resp = client.models.generate_content(
                model=model_name,
                contents="Reply with exactly GEMINI_OK"
            )
            return (resp.text or "").strip() if resp else ""

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call)
            out = future.result(timeout=15.0)

        if "GEMINI_OK" in out:
            print("GEMINI_OK")
            return True
        else:
            print(f"GEMINI_OK (reply: {out[:60]})")
            return True
    except Exception as e:
        err_type = type(e).__name__
        err_msg = str(e)
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
            print("GEMINI_ERROR: 429 RESOURCE_EXHAUSTED (Quota exceeded)")
        elif "401" in err_msg or "403" in err_msg:
            print("GEMINI_ERROR: Authentication Error (Invalid API key)")
        else:
            print(f"GEMINI_ERROR: {err_type}: {err_msg[:80]}")
        return False

if __name__ == "__main__":
    success = run_test()
    sys.exit(0 if success else 1)
