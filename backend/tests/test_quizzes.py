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


@pytest.mark.asyncio
async def test_50_words_quiz_and_weak_word_tagging(client: AsyncClient):
    """Verifies 50-word test generation and automatic weak-word tagging on wrong answers."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "booster50@smartvocab.uz", "password": "BoosterPass2026!"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add 5 words
    test_words = [
        ("Resilient", "Chidamli"),
        ("Tenacious", "Qat'iyatli"),
        ("Pragmatic", "Amaliy"),
        ("Lucid", "Tiniq"),
        ("Diligent", "Tirishqoq"),
    ]
    for en, uz in test_words:
        await client.post(
            "/api/v1/vocabulary",
            json={"english_word": en, "uzbek_translation": uz},
            headers=headers,
        )

    # Test all-practice endpoint
    all_prac = await client.get("/api/v1/vocabulary/all-practice?limit=50", headers=headers)
    assert all_prac.status_code == 200
    assert len(all_prac.json()) == 5

    # Start 50-talik test from all words
    start_resp = await client.post(
        "/api/v1/quizzes/start",
        json={"quiz_type": "all_50", "question_count": 50},
        headers=headers,
    )
    assert start_resp.status_code == 201
    quiz_data = start_resp.json()
    attempt_id = quiz_data["attempt_id"]
    assert quiz_data["total_questions"] == 5

    # Intentionally answer INCORRECTLY
    first_q = quiz_data["questions"][0]
    wrong_answer = "Mutlaqo_noto'g'ri_javob"
    ans_resp = await client.post(
        f"/api/v1/quizzes/{attempt_id}/answer",
        json={"question_id": first_q["id"], "selected_option": wrong_answer},
        headers=headers,
    )
    assert ans_resp.status_code == 200
    ans_data = ans_resp.json()
    assert ans_data["is_correct"] is False
    # Verified: word was tagged as weak!
    assert ans_data["was_marked_weak"] is True

    # Verify that the word now appears in weak-words list
    weak_res = await client.get("/api/v1/vocabulary/weak-words", headers=headers)
    assert weak_res.status_code == 200
    weak_words = weak_res.json()
    assert any(w["id"] == first_q["word_id"] for w in weak_words)


@pytest.mark.asyncio
async def test_uz_to_en_quiz_with_synonyms_and_verification(client: AsyncClient):
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "synonym_tester@example.com", "password": "SynonymPass2026!"},
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add 4 words: large, fast, start, happy
    test_words = [
        {"english_word": "large", "uzbek_translation": "katta"},
        {"english_word": "fast", "uzbek_translation": "tez"},
        {"english_word": "start", "uzbek_translation": "boshlamoq"},
        {"english_word": "happy", "uzbek_translation": "xursand"},
    ]
    created_words = []
    for w in test_words:
        res = await client.post("/api/v1/vocabulary", json=w, headers=headers)
        assert res.status_code == 201
        created_words.append(res.json())

    # 1. Start uz_to_en quiz
    quiz_res = await client.post(
        "/api/v1/quizzes/start",
        json={"quiz_type": "all_50", "direction": "uz_to_en", "question_count": 4},
        headers=headers,
    )
    assert quiz_res.status_code == 201
    q_data = quiz_res.json()
    attempt_id = q_data["attempt_id"]
    questions = q_data["questions"]
    assert len(questions) == 4
    assert questions[0]["direction"] == "uz_to_en"

    # Find the question for 'large' (Uzbek 'katta')
    large_word = next(w for w in created_words if w["english_word"] == "large")
    large_q = next(q for q in questions if q["word_id"] == large_word["id"])

    # 2. Answer with synonym 'big' (instead of exact word 'large')!
    ans_res = await client.post(
        f"/api/v1/quizzes/{attempt_id}/answer",
        json={"question_id": large_q["id"], "selected_option": "big"},
        headers=headers,
    )
    assert ans_res.status_code == 200
    ans_data = ans_res.json()
    assert ans_data["is_correct"] is True
    assert ans_data["is_synonym_match"] is True
    assert ans_data["was_marked_weak"] is False

    # 3. Test standalone /api/v1/vocabulary/verify-answer endpoint
    fast_word = next(w for w in created_words if w["english_word"] == "fast")
    verify_res = await client.post(
        "/api/v1/vocabulary/verify-answer",
        json={"word_id": fast_word["id"], "user_answer": "quick"},
        headers=headers,
    )
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["is_correct"] is True
    assert v_data["is_synonym_match"] is True
    assert "tez" in v_data["correct_uzbek"]
