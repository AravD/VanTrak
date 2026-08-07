"""Protected endpoint: proves the auth chain works end-to-end."""

from fastapi import APIRouter, Depends

from ..auth import CurrentUser, get_current_user

router = APIRouter(tags=["me"])


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "role": user.role}
