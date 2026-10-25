import pytest
from httpx import AsyncClient
from app.services.srs_service import calculate_sm2


def test_sm2_algorithm_calculations():
    # 1. Initial success (quality=5)
    rep, ef, interval = calculate_sm2(quality=5, repetition_number=0, ease_factor=2.5, interval_days=0)
    assert rep == 1
    assert interval == 1
    assert ef >= 2.5  # Increases or stays >= 2.5

    # 2. Second success (quality=4)
    rep2, ef2, interval2 = calculate_sm2(quality=4, repetition_number=1, ease_factor=ef, interval_days=interval)
    assert rep2 == 2
    assert interval2 == 6

    # 3. Third success (quality=5)
    rep3, ef3, interval3 = calculate_sm2(quality=5, repetition_number=2, ease_factor=ef2, interval_days=interval2)
    assert rep3 == 3
    assert interval3 > 6

    # 4. Failure (quality=1) resets repetition to 0 and interval to 1
    rep_fail, ef_fail, interval_fail = calculate_sm2(quality=1, repetition_number=rep3, ease_factor=ef3, interval_days=interval3)
    assert rep_fail == 0
    assert interval_fail == 1
    assert ef_fail < ef3  # EF drops

    # 5. Ease factor never drops below 1.3
    lowest_ef = 1.3
    for _ in range(10):
        _, lowest_ef, _ = calculate_sm2(quality=0, repetition_number=0, ease_factor=lowest_ef, interval_days=1)
    assert lowest_ef == 1.3


@pytest.mark.asyncio
async def test_review_queue_and_submission(client: AsyncClient):
    # Register user
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "srs_learner@smartvocab.uz", "password": "SrsPassword2026!"},
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add a word
    word_resp = await client.post(
        "/api/v1/vocabulary",
        json={"english_word": "Eloquent", "uzbek_translation": "Notiq, fasohatli"},
        headers=headers,
    )
    word_id = word_resp.json()["id"]

    # 1. Word should be due in queue immediately (due_date was initialized to now)
    queue_resp = await client.get("/api/v1/reviews/queue", headers=headers)
    assert queue_resp.status_code == 200
    queue = queue_resp.json()
    assert len(queue) == 1
    assert queue[0]["english_word"] == "eloquent"

    # 2. Submit successful review (quality=5)
    submit_resp = await client.post(
        "/api/v1/reviews/submit",
        json={
            "word_id": word_id,
            "quality_rating": 5,
            "review_source": "web",
            "review_type": "flashcard",
        },
        headers=headers,
    )
    assert submit_resp.status_code == 200
    sub_data = submit_resp.json()
    assert sub_data["is_correct"] is True
    assert sub_data["repetition_number"] == 1
    assert sub_data["new_interval_days"] == 1

    # 3. Queue should now be empty (due date pushed 1 day into future)
    empty_queue = await client.get("/api/v1/reviews/queue", headers=headers)
    assert empty_queue.status_code == 200
    assert len(empty_queue.json()) == 0
