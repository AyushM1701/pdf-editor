import pytest
from app.api.routes.extraction import jobs

def test_extraction_job_lifecycle(client):
    response = client.post(
        "/api/extraction/run",
        json={
            "object_key": "test_doc.pdf",
        }
    )
    # Background task won't actually succeed because it tries to download from missing test_doc.pdf
    # But it will create the job
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    job_id = data["job_id"]

    # Test status endpoint
    status_resp = client.get(f"/api/extraction/status/{job_id}")
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] in ("processing", "failed")

def test_extraction_job_not_found(client):
    response = client.get("/api/extraction/status/does-not-exist")
    assert response.status_code == 404
