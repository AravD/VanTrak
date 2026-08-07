from supabase import Client, create_client
from .config import settings

def user_client(access_token: str) -> Client:
    """A Supabase client scoped to the logged-in user (RLS applies)."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)  # send the user's token on DB requests
    return client
