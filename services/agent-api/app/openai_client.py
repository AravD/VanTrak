"""
One shared OpenAI client for the whole app.

`OpenAI()` reads the API key we pass from settings. We build it lazily (only on
first use) and cache it, so importing the app never requires the key to be set —
endpoints that actually call OpenAI fail clearly at call time if it's missing.
"""

from functools import lru_cache

from openai import OpenAI

from .config import settings


@lru_cache
def get_openai_client() -> OpenAI:
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set in the API's .env.api file."
        )
    return OpenAI(
        api_key=settings.gemini_api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )