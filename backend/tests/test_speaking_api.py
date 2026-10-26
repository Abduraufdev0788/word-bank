import pytest
from httpx import AsyncClient


async def create_user_token(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "Speaking Tester"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_get_suggested_topics(client: AsyncClient):
    res = await client.get("/api/v1/speaking/topics")
    assert res.status_code == 200
    topics = res.json()
    assert isinstance(topics, list)
    assert len(topics) >= 5
    assert any(t["id"] == "job_interview" for t in topics)


@pytest.mark.asyncio
async def test_generate_speaking_session(client: AsyncClient):
    token = await create_user_token(client, "speaking_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "topic": "Ordering coffee at a cafe",
        "cefr_level": "A2",
        "include_user_words": False,
        "sentence_count": 5,
    }

    res = await client.post("/api/v1/speaking/generate", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "sentences" in data
    assert len(data["sentences"]) >= 3
    assert data["cefr_level"] == "A2"
    first_sent = data["sentences"][0]
    assert "text_en" in first_sent
    assert "text_uz" in first_sent
    assert "id" in first_sent


@pytest.mark.asyncio
async def test_analyze_speaking_attempt_perfect(client: AsyncClient):
    token = await create_user_token(client, "speaking_analyst@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "original_text": "I would like to order a warm cappuccino please.",
        "spoken_text": "I would like to order a warm cappuccino please",
        "cefr_level": "A2",
    }

    res = await client.post("/api/v1/speaking/analyze", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["accuracy_score"] == 100.0
    assert "word_comparisons" in data
    assert all(w["status"] == "correct" for w in data["word_comparisons"])


@pytest.mark.asyncio
async def test_analyze_speaking_attempt_partial(client: AsyncClient):
    token = await create_user_token(client, "speaking_partial@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "original_text": "Learning a new language opens wonderful doors in your career.",
        "spoken_text": "Learning new language opens doors career",
        "cefr_level": "B1",
    }

    res = await client.post("/api/v1/speaking/analyze", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()

    assert 40.0 <= data["accuracy_score"] <= 90.0
    assert any(w["status"] == "missed" for w in data["word_comparisons"])
    assert len(data["feedback_uz"]) > 5
