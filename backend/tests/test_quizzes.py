import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_anti_cheat_quiz_flow(client: AsyncClient):
    # Register user
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "quiz_student@smartvocab.uz", "password": "QuizPassword2026!"},
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add 4 words so we have enough options for multiple choice test
    words = [
        ("Kind", "Mehribon"),
        ("Honest", "Halol"),
        ("Brave", "Jasur"),
        ("Wise", "Dono"),
    ]
    for en, uz in words:
        await client.post(
            "/api/v1/vocabulary",
            json={"english_word": en, "uzbek_translation": uz},
            headers=headers,
        )

    # 1. Start Quiz
    start_resp = await client.post(
        "/api/v1/quizzes/start",
        json={"quiz_type": "mixed"},
        headers=headers,
    )
    assert start_resp.status_code == 201
    quiz_data = start_resp.json()
    attempt_id = quiz_data["attempt_id"]
    questions = quiz_data["questions"]
    assert len(questions) == 4

    # CRITICAL ANTI-CHEAT TEST: Verify correct_answer is NOT leaked in client payload!
    for q in questions:
        assert "correct_answer" not in q
        assert len(q["options"]) == 4

    # 2. Answer question 1
    q1 = questions[0]
    # Pick the right answer from options or intentionally pick a specific option
    answer_resp = await client.post(
        f"/api/v1/quizzes/{attempt_id}/answer",
        json={"question_id": q1["id"], "selected_option": q1["options"][0]},
        headers=headers,
    )
    assert answer_resp.status_code == 200
    ans_data = answer_resp.json()
    assert "is_correct" in ans_data
    assert "correct_answer" in ans_data  # Revealed only AFTER answering!

    # 3. Duplicate answer on same question should fail
    dup_resp = await client.post(
        f"/api/v1/quizzes/{attempt_id}/answer",
        json={"question_id": q1["id"], "selected_option": q1["options"][0]},
        headers=headers,
    )
    assert dup_resp.status_code == 400
    assert "allaqachon javob berilgan" in dup_resp.json()["detail"].lower()

    # 4. Finalize quiz
    complete_resp = await client.post(
        f"/api/v1/quizzes/{attempt_id}/complete",
        headers=headers,
    )
    assert complete_resp.status_code == 200
    summary = complete_resp.json()
    assert summary["status"] == "completed"
    assert summary["total_questions"] == 4
    assert summary["score_percent"] >= 0.0
