import pytest

def test_local_upload_path_traversal(client):
    response = client.put(
        "/api/storage/local-upload/../secret.txt",
        content=b"test",
    )
    assert response.status_code == 400
    assert "Invalid object key format" in response.json()["error"]["message"] or "Invalid object key" in response.text

def test_local_upload_invalid_chars(client):
    response = client.put(
        "/api/storage/local-upload/file@name.txt",
        content=b"test",
    )
    assert response.status_code == 400

def test_local_upload_size_limit(client):
    # Just sending a large content-length header
    response = client.put(
        "/api/storage/local-upload/test.txt",
        content=b"test",
        headers={"content-length": str(100 * 1024 * 1024)}
    )
    assert response.status_code == 413
