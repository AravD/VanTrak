"""Public endpoint (no auth) to confirm the server is up."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/ping")
def ping():
    return {"message": "pong -- my first endpoint!"}

@router.get("/name")
def name():
    return {"message": "my name is Arav"}