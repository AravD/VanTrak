from fastapi import APIRouter, Depends
from ..auth import CurrentUser, get_current_user
from ..supabase_client import user_client

router = APIRouter(tags=["drivers"])

@router.get("/drivers")
def list_drivers(user: CurrentUser = Depends(get_current_user)):
    supabase = user_client(user.token)

    result = (
        supabase.table("drivers")
        .select("id, first_name, last_name, status, van_number")
        .order("first_name")
        .execute()
    )

    return result.data
