"""
Application entry point. Uvicorn loads `app` via "app.main:app".

As we add features, endpoint groups get registered here:
- routers/ : plain HTTP endpoints (health, me, later drivers/schedules)
- agents/  : the AI operations agent (chat endpoint, added in the agent phase)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import agent, chat, drivers, health, me, payroll

app = FastAPI(title="VanTrak Agent API")

# Which browser origins may call this API (the web dev servers).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(me.router)
app.include_router(drivers.router)
app.include_router(chat.router)
app.include_router(agent.router)
app.include_router(payroll.router)
