import pytest
from httpx import AsyncClient


async def create_user_token(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "Analytics Tester"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_dashboard_first_time_user(client: AsyncClient):
    token = await create_user_token(client, "first_timer@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/analytics/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["is_first_time_user"] is True
    assert data["total_words"] == 0
    assert data["words_due_today"] == 0
    assert "Xush kelibsiz" in data["suggested_action"]
    assert len(data["weekly_chart"]) == 7
    assert data["goals"]["words_learned_today"] == 0
    assert data["goals"]["words_goal_percent"] == 0.0


@pytest.mark.asyncio
async def test_dashboard_with_activity_and_reviews(client: AsyncClient):
    token = await create_user_token(client, "active_learner@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Add words
    words = [
        ("Eloquent", "Notiqona, chiroyli so'zlovchi", "B2"),
        ("Resilient", "Chidamli, egilmas", "C1"),
        ("Benevolent", "Saxiy, mehrli", "B2"),
    ]
    added_word_ids = []
    for en, uz, cefr in words:
        add_res = await client.post(
            "/api/v1/vocabulary",
            headers=headers,
            json={"english_word": en, "uzbek_translation": uz, "cefr_level": cefr},
        )
        assert add_res.status_code == 201
        added_word_ids.append(add_res.json()["id"])

    # 2. Complete reviews: 1 good (quality 4), 1 failed (quality 1 - becomes weak word)
    rev1 = await client.post(
        "/api/v1/reviews/submit",
        headers=headers,
        json={
            "word_id": added_word_ids[0],
            "quality_rating": 4,
            "review_type": "flashcard",
            "source": "web",
        },
    )
    assert rev1.status_code == 200

    rev2 = await client.post(
        "/api/v1/reviews/submit",
        headers=headers,
        json={
            "word_id": added_word_ids[1],
            "quality_rating": 1,
            "review_type": "flashcard",
            "source": "web",
        },
    )
    assert rev2.status_code == 200

    # 3. Check dashboard
    dash_res = await client.get("/api/v1/analytics/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash = dash_res.json()

    assert dash["is_first_time_user"] is False
    assert dash["total_words"] == 3
    assert dash["words_weak"] >= 1
    assert len(dash["recent_activities"]) >= 2
    assert dash["overall_accuracy_percent"] == 50.0  # 1 of 2 correct

    # 4. Check weekly chart endpoint
    chart_res = await client.get("/api/v1/analytics/weekly-chart", headers=headers)
    assert chart_res.status_code == 200
    chart = chart_res.json()
    assert len(chart) == 7
    assert any(pt["words_reviewed"] > 0 for pt in chart)

    # 5. Check weak words endpoint
    weak_res = await client.get("/api/v1/analytics/weak-words", headers=headers)
    assert weak_res.status_code == 200
    weak_words = weak_res.json()
    assert len(weak_words) >= 1
    assert weak_words[0]["english_word"] == "resilient"
    assert weak_words[0]["times_incorrect"] >= 1

    # 6. Check level assessment endpoint
    level_res = await client.get("/api/v1/analytics/level-assessment", headers=headers)
    assert level_res.status_code == 200
    level = level_res.json()
    assert level["total_vocabulary_count"] == 3
    assert level["level_breakdown"]["B2"] == 2
    assert level["level_breakdown"]["C1"] == 1
    assert len(level["recommendations"]) >= 1

    # 7. Check GitHub-style activity heatmap endpoint
    heat_res = await client.get("/api/v1/analytics/activity-heatmap?days=90", headers=headers)
    assert heat_res.status_code == 200
    heat = heat_res.json()
    assert heat["total_active_days"] >= 1
    assert heat["current_streak"] >= 1
    assert len(heat["days"]) == 91  # 90 days + today
    assert heat["days"][-1]["level"] > 0


@pytest.mark.asyncio
async def test_analytics_multi_tenant_isolation(client: AsyncClient):
    token_a = await create_user_token(client, "user_a@example.com")
    token_b = await create_user_token(client, "user_b@example.com")

    # User A adds a word
    await client.post(
        "/api/v1/vocabulary",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"english_word": "Solitude", "uzbek_translation": "Yolg'izlik", "cefr_level": "C1"},
    )

    # User B should see 0 words
    res_b = await client.get(
        "/api/v1/analytics/dashboard",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 200
    assert res_b.json()["total_words"] == 0
    assert res_b.json()["is_first_time_user"] is True
