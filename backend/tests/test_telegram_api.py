import pytest
from httpx import AsyncClient


async def create_user_and_token(client: AsyncClient, email: str = "tg_tester@example.com") -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "Telegram Tester"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_telegram_link_flow_and_summary(client: AsyncClient):
    token = await create_user_and_token(client, "tg_flow@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Web user requests a link token
    link_res = await client.post("/api/v1/telegram/link-token", headers=headers)
    assert link_res.status_code == 201
    token_data = link_res.json()
    link_token = token_data["link_token"]
    assert "start=" in token_data["bot_url"]

    # 2. Before linking, telegram user status should be unlinked
    tg_user_id = 987654321
    status_before = await client.get(f"/api/v1/telegram/user/{tg_user_id}")
    assert status_before.status_code == 200
    assert status_before.json()["is_linked"] is False

    # 3. Telegram bot verifies token
    verify_res = await client.post(
        "/api/v1/telegram/verify-link",
        json={
            "token": link_token,
            "telegram_user_id": tg_user_id,
            "telegram_chat_id": 987654321,
            "username": "tester_tg",
            "first_name": "Tester",
        },
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["success"] is True

    # 4. Re-using token should fail (single-use constraint)
    reuse_res = await client.post(
        "/api/v1/telegram/verify-link",
        json={
            "token": link_token,
            "telegram_user_id": tg_user_id,
            "telegram_chat_id": 987654321,
        },
    )
    assert reuse_res.status_code == 400

    # 5. Telegram user summary should now be linked
    status_after = await client.get(f"/api/v1/telegram/user/{tg_user_id}")
    assert status_after.status_code == 200
    summary = status_after.json()
    assert summary["is_linked"] is True
    assert summary["email"] == "tg_flow@example.com"


@pytest.mark.asyncio
async def test_telegram_quick_add_and_review_flow(client: AsyncClient):
    token = await create_user_and_token(client, "tg_review@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    tg_user_id = 1122334455

    # Link account
    link_res = await client.post("/api/v1/telegram/link-token", headers=headers)
    link_token = link_res.json()["link_token"]
    await client.post(
        "/api/v1/telegram/verify-link",
        json={
            "token": link_token,
            "telegram_user_id": tg_user_id,
            "telegram_chat_id": tg_user_id,
            "username": "reviewer_tg",
        },
    )

    # 1. Quick add word from Telegram
    add_res = await client.post(
        f"/api/v1/telegram/vocabulary/quick-add/{tg_user_id}",
        json={
            "english_word": "Adventure",
            "uzbek_translation": "Sarguzasht",
            "auto_enrich": False,
        },
    )
    assert add_res.status_code == 201
    word_data = add_res.json()
    assert word_data["english_word"] == "adventure"
    word_id = word_data["id"]

    # 2. Get review queue from Telegram
    queue_res = await client.get(f"/api/v1/telegram/review/queue/{tg_user_id}")
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert len(queue) >= 1
    assert any(item["id"] == word_id for item in queue)

    # 3. Submit review answer via Telegram (SM-2 quality rating 4 = Good)
    submit_res = await client.post(
        f"/api/v1/telegram/review/submit/{tg_user_id}",
        json={
            "word_id": word_id,
            "quality_rating": 4,
            "user_answer": "Sarguzasht",
        },
    )
    assert submit_res.status_code == 200
    res_data = submit_res.json()
    assert res_data["repetition_number"] == 1
    assert res_data["interval_days"] >= 1

    # 4. Check user summary - study time and reviewed count should be recorded
    summary_res = await client.get(f"/api/v1/telegram/user/{tg_user_id}")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["words_reviewed_today"] >= 1

    # 5. Check batches list via Telegram
    batches_res = await client.get(f"/api/v1/telegram/batches/{tg_user_id}")
    assert batches_res.status_code == 200
    batches = batches_res.json()
    assert len(batches) >= 1

    # 6. Unlink account
    unlink_res = await client.post(f"/api/v1/telegram/unlink/{tg_user_id}")
    assert unlink_res.status_code == 200
    assert unlink_res.json()["success"] is True

    # After unlink, user should show is_linked = False
    unlinked_summary = await client.get(f"/api/v1/telegram/user/{tg_user_id}")
    assert unlinked_summary.json()["is_linked"] is False
