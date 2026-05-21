"""Smoke tests."""


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_openapi(client):
    res = client.get("/api/docs/openapi.json")
    assert res.status_code == 200
    body = res.get_json()
    assert body["info"]["title"] == "MedMeAI API"
    assert "/appointments/" in body["paths"]
