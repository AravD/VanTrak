# VanTrak Agent API (FastAPI)

An extra application layer on top of Supabase. Supabase stays the database + auth
+ RLS; this service holds business logic and the AI operations agent. It talks to
Supabase **as the logged-in user**, so RLS still protects the data.

```
app/
  main.py         # FastAPI app + wiring
  config.py       # env settings
  auth/           # verify Supabase JWT → CurrentUser  (working)
  routers/        # HTTP endpoints: /health, /me        (working)
  agents/         # the AI operations agent + prompts   (stub, Phase 4)
  tools/          # functions the agent can call        (stub)
  services/       # shared business logic               (stub)
  schemas/        # Pydantic request/response models     (stub)
  tests/          # pytest                               (working)
```

## Setup

```bash
cd services/agent-api
python3 -m venv .venv
source .venv/bin/activate          # every new terminal
pip install -r requirements.txt
cp .env.example .env               # then fill it in
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/health
- Interactive docs: http://localhost:8000/docs

## Test

```bash
pytest
```

## Docker (later phase)

From the repo root: `docker compose up --build`.
