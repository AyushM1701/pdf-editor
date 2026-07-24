import pytest
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect
from app.main import app
from app.core.config import get_settings, Settings

client = TestClient(app)

def get_test_settings():
    settings = Settings()
    settings.api_key = "secret_test_key"
    return settings

@pytest.fixture(autouse=True)
def override_settings():
    app.dependency_overrides[get_settings] = get_test_settings
    yield
    app.dependency_overrides.clear()

def test_missing_api_key():
    response = client.get("/api/extraction/status/fake-job")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid API Key"

def test_invalid_api_key():
    response = client.get("/api/extraction/status/fake-job", headers={"X-API-Key": "wrong"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid API Key"

def test_stream_missing_api_key():
    response = client.get("/api/extraction/stream/fake-job")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid API Key"
