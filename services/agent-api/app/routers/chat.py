from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..auth import CurrentUser, get_current_user
from ..openai_client import get_openai_client

router = APIRouter(tags=["chat"])

# Cheap, fast, and supports tool-calling later. Swap the model here anytime.
MODEL = "gemini-flash-latest"

class ChatRequest(BaseModel):
    message: str
    system_prompt: str | None = None

class ChatResponse(BaseModel):
    reply: str

@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_openai_client()

    default_prompt = "You are a helpful assistant for VanTrak, " \
    "a delivery logistics operations app. Be concise."
    system_text = default_prompt + body.system_prompt

    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_text},
            {"role": "user", "content": body.message},
        ],
    )

    reply = completion.choices[0].message.content
    return ChatResponse(reply=reply or "")
