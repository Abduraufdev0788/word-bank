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


@pytest.mark.asyncio
async def test_telegram_quiz_weak_words_and_word_of_day(client: AsyncClient):
    token = await create_user_and_token(client, "tg_quiz_tester@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    tg_user_id = 7788990011

    # Link account
    link_res = await client.post("/api/v1/telegram/link-token", headers=headers)
    link_token = link_res.json()["link_token"]
    await client.post(
        "/api/v1/telegram/verify-link",
        json={
            "token": link_token,
            "telegram_user_id": tg_user_id,
            "telegram_chat_id": tg_user_id,
            "username": "quiz_tg_user",
        },
    )

    # 1. Add words
    words_to_add = [
        {"english_word": "Persevere", "uzbek_translation": "Sabot qilmoq"},
        {"english_word": "Brilliant", "uzbek_translation": "Ajoyib"},
        {"english_word": "Courage", "uzbek_translation": "Jasorat"},
    ]
    added_ids = []
    for w in words_to_add:
        res = await client.post(
            f"/api/v1/telegram/vocabulary/quick-add/{tg_user_id}",
            json={**w, "auto_enrich": False},
        )
        assert res.status_code == 201
        added_ids.append(res.json()["id"])

    # 2. Test Word of the Day
    wotd_res = await client.get(f"/api/v1/telegram/word-of-the-day/{tg_user_id}")
    assert wotd_res.status_code == 200
    wotd_data = wotd_res.json()
    assert "english_word" in wotd_data
    assert "uzbek_translation" in wotd_data

    # 3. Test Weak Words
    weak_res = await client.get(f"/api/v1/telegram/weak-words/{tg_user_id}")
    assert weak_res.status_code == 200
    weak_data = weak_res.json()
    assert len(weak_data) >= 1

    # 4. Test Quiz generation
    quiz_res = await client.get(f"/api/v1/telegram/quiz/{tg_user_id}?count=3&direction=en_to_uz")
    assert quiz_res.status_code == 200
    questions = quiz_res.json()
    assert len(questions) >= 1
    first_q = questions[0]
    assert "prompt" in first_q
    assert "options" in first_q
    assert len(first_q["options"]) >= 2

    # 5. Test Quiz Answer Submission (Correct)
    ans_res = await client.post(
        f"/api/v1/telegram/quiz/answer/{tg_user_id}",
        json={
            "word_id": added_ids[0],
            "selected_option": "Sabot qilmoq",
            "direction": "en_to_uz",
        },
    )
    assert ans_res.status_code == 200
    ans_data = ans_res.json()
    assert ans_data["is_correct"] is True
    assert "Sabot qilmoq" in ans_data["correct_answer"]

    # 6. Test Quiz Answer Submission (Incorrect)
    wrong_ans_res = await client.post(
        f"/api/v1/telegram/quiz/answer/{tg_user_id}",
        json={
            "word_id": added_ids[1],
            "selected_option": "Mutlaqo noto'g'ri so'z",
            "direction": "en_to_uz",
        },
    )
    assert wrong_ans_res.status_code == 200
    wrong_ans_data = wrong_ans_res.json()
    assert wrong_ans_data["is_correct"] is False
    assert wrong_ans_data["correct_answer"] == "Ajoyib"
    assert wrong_ans_data["was_marked_weak"] is True

    # 7. Test Batch words
    batches = (await client.get(f"/api/v1/telegram/batches/{tg_user_id}")).json()
    assert len(batches) >= 1
    batch_id = batches[0]["id"]
    batch_words_res = await client.get(f"/api/v1/telegram/batches/{tg_user_id}/{batch_id}/words")
    assert batch_words_res.status_code == 200
    assert len(batch_words_res.json()) >= 3

    # 8. Test Telegram File Import (TXT/CSV via Bot)
    file_content = "apple - olma\nbanana - banan\norange - apelsin\ngrape - uzum\n"
    import_res = await client.post(
        f"/api/v1/telegram/import-file/{tg_user_id}",
        files={"file": ("vocabulary_test.txt", file_content.encode("utf-8"), "text/plain")},
    )
    assert import_res.status_code == 200
    import_data = import_res.json()
    assert import_data["success"] is True
    assert import_data["imported_words"] >= 4
    assert (import_data["batches_created"] + import_data.get("batches_updated", 0)) >= 1

