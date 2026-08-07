"""
Tests for the base endpoints.

`TestClient` runs the FastAPI app in-process (no real server needed) and lets us
make requests against it — fast, and exactly what you'd do to prove a feature
works before shipping.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_me_requires_auth():
    # No Authorization header → the dependency rejects it.
    res = client.get("/me")
    assert res.status_code in (401, 403)
