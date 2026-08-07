"""Auth package. Re-export the common names so callers can do
`from app.auth import CurrentUser, get_current_user`."""

from .dependencies import CurrentUser, get_current_user

__all__ = ["CurrentUser", "get_current_user"]
