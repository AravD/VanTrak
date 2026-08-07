"""The /drivers endpoint is protected: no token → no data."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_drivers_requires_auth():
    res = client.get("/drivers")
    assert res.status_code in (401, 403)
