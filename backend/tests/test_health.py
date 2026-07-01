"""
Tests for GET /health endpoint.

SPEC: SPEC-M1-A — Config & scaffolding
ACs covered:
  - GET /health returns 200
  - Response body is {"status": "ok"}
  - Endpoint requires no authentication
"""


async def test_health_returns_200(client):
    """GET /health must respond with HTTP 200."""
    response = await client.get("/health")
    assert response.status_code == 200


async def test_health_body_is_ok(client):
    """GET /health body must be exactly {"status": "ok"}."""
    response = await client.get("/health")
    assert response.json() == {"status": "ok"}


async def test_health_no_auth_required(client):
    """GET /health must be accessible without any Authorization header."""
    # Explicit: send request with no headers at all
    response = await client.get("/health", headers={})
    assert response.status_code == 200
