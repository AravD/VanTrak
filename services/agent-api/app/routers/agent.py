"""POST /agent — ask the operations agent a question; it can call tools for real data."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..agents.operations_agent import run_operations_agent
from ..auth import CurrentUser, get_current_user

router = APIRouter(tags=["agent"])

class AgentRequest(BaseModel):
    message: str

class AgentResponse(BaseModel):
    reply: str

@router.post("/agent", response_model=AgentResponse)
def agent(body: AgentRequest, user: CurrentUser = Depends(get_current_user)):
    reply = run_operations_agent(user, body.message)
    return AgentResponse(reply=reply)
