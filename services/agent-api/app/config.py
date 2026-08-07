"""
App configuration read from environment variables / the `.env.api` file.

Pydantic matches each field to an env var of the same name (e.g. `supabase_url`
→ `SUPABASE_URL`, case-insensitive). Fields default to "" so the app can boot
before it's filled; endpoints that need a value error clearly at call time.

We point at an ABSOLUTE path to `services/agent-api/.env.api` so it loads no
matter which folder you start the server from.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py is at services/agent-api/app/config.py, so parent.parent = services/agent-api.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.api"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # OpenAI (Phase 3+): powers the /chat endpoint and, later, the agent.
    openai_api_key: str = ""
    gemini_api_key: str = ""


# Shared instance: `from app.config import settings`.
settings = Settings()
