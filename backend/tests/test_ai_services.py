import json
import uuid
from unittest.mock import MagicMock
import pytest
from httpx import AsyncClient

from app.schemas.ai import (
    WordEnrichmentResponse,
    WordExampleSchema,
    MiniStoryResponse,
    ComprehensionQuestionSchema,
)
from app.services.ai_service import (
    AIService,
    validate_target_words,
    ai_service,
)
from app.models.vocabulary import WordBatch, Word, WordExample


# --- 1. Target Words Validation Tests ---

def test_validate_target_words_exact_matches():
    content = "The quick brown fox jumps over the lazy dog."
    target_words = ["fox", "dog", "quick"]
    all_present, present, missing = validate_target_words(content, target_words)
    assert all_present is True
    assert set(present) == {"fox", "dog", "quick"}
    assert missing == []


def test_validate_target_words_inflections():
    content = "The cats were running happily, studied all night, and explored new places."
    target_words = ["cat", "run", "study", "explore", "place"]
    all_present, present, missing = validate_target_words(content, target_words)
    assert all_present is True
    assert len(missing) == 0


def test_validate_target_words_missing():
    content = "She bought an apple and an orange from the market."
    target_words = ["apple", "banana", "orange", "pineapple"]
    all_present, present, missing = validate_target_words(content, target_words)
    assert all_present is False
    assert set(present) == {"apple", "orange"}
    assert set(missing) == {"banana", "pineapple"}


def test_validate_target_words_phrases():
    content = "He had to look after his little brother during the weekend."
    target_words = ["look after", "brother"]
    all_present, present, missing = validate_target_words(content, target_words)
    assert all_present is True
    assert set(present) == {"look after", "brother"}


# --- 2. AIService Unit Tests with Mock Client ---

@pytest.mark.asyncio
async def test_ai_service_enrich_word():
    mock_client = MagicMock()
    fake_response = MagicMock()
    fake_response.parsed = WordEnrichmentResponse(
        uzbek_translation="olma",
        part_of_speech="noun",
        phonetic="/ˈæp.əl/",
        cefr_level="A1",
        examples=[
            WordExampleSchema(sentence_en="I eat an apple.", sentence_uz="Men olma yeyman."),
            WordExampleSchema(sentence_en="The apple is red.", sentence_uz="Olma qizil."),
        ],
        notes="Kundalik hayotda eng ko'p uchraydigan meva nomi.",
    )
    mock_client.models.generate_content.return_value = fake_response

    service = AIService(client=mock_client)
    res = await service.enrich_word("apple")
    assert res.uzbek_translation == "olma"
    assert res.phonetic == "/ˈæp.əl/"
    assert len(res.examples) == 2


@pytest.mark.asyncio
async def test_ai_service_generate_batch_story_retry_success():
    mock_client = MagicMock()

    # Attempt 1 misses "umbrella"
    story_attempt_1 = MagicMock()
    story_attempt_1.parsed = MiniStoryResponse(
        title_en="A Rainy Day",
        title_uz="Yomg'irli kun",
        content_en="Tom went outside in the rain and saw a puddle.",
        content_uz="Tom yomg'irda tashqariga chiqdi va ko'lmak ko'rdi.",
        used_target_words=["rain", "puddle"],
        comprehension_questions=[
            ComprehensionQuestionSchema(
                question="Who went outside?",
                options=["Tom", "Jack", "Bob", "Alice"],
                correct_option_index=0,
                explanation="Tom went outside.",
            ),
            ComprehensionQuestionSchema(
                question="What was the weather?",
                options=["Rainy", "Sunny", "Snowy", "Windy"],
                correct_option_index=0,
                explanation="It was raining.",
            ),
            ComprehensionQuestionSchema(
                question="What did he see?",
                options=["Puddle", "Tree", "Car", "Dog"],
                correct_option_index=0,
                explanation="He saw a puddle.",
            ),
        ],
    )

    # Attempt 2 includes "umbrella"
    story_attempt_2 = MagicMock()
    story_attempt_2.parsed = MiniStoryResponse(
        title_en="A Rainy Day with an Umbrella",
        title_uz="Soyabonli yomg'irli kun",
        content_en="Tom went outside in the rain with his yellow umbrella and stepped around the puddle.",
        content_uz="Tom sariq soyaboni bilan yomg'irda tashqariga chiqdi va ko'lmakni aylanib o'tdi.",
        used_target_words=["rain", "umbrella", "puddle"],
        comprehension_questions=story_attempt_1.parsed.comprehension_questions,
    )

    mock_client.models.generate_content.side_effect = [story_attempt_1, story_attempt_2]

    service = AIService(client=mock_client)
    story = await service.generate_batch_story(
        words=["rain", "umbrella", "puddle"],
        cefr_level="A2",
        max_retries=2,
    )

    assert mock_client.models.generate_content.call_count == 2
    assert "umbrella" in story.used_target_words
    assert "rain" in story.used_target_words


# --- 3. Endpoints Integration Tests ---

async def create_auth_token(client: AsyncClient, email: str = "ai_test@example.com") -> str:
    res = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "AI User"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_translations_enrich_endpoint(client: AsyncClient, monkeypatch):
    token = await create_auth_token(client, "enrich_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Mock ai_service.enrich_word
    async def mock_enrich(word, context=None):
        return WordEnrichmentResponse(
            uzbek_translation="kitob",
            part_of_speech="noun",
            phonetic="/bʊk/",
            cefr_level="A1",
            examples=[
                WordExampleSchema(sentence_en="I read a book.", sentence_uz="Men kitob o'qiyman."),
                WordExampleSchema(sentence_en="A great book.", sentence_uz="Ajoyib kitob."),
            ],
            notes="Lug'atdagi asosiy so'z.",
        )

    monkeypatch.setattr(ai_service, "enrich_word", mock_enrich)

    res = await client.post(
        "/api/v1/translations/enrich",
        headers=headers,
        json={"english_word": "book"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["uzbek_translation"] == "kitob"
    assert data["phonetic"] == "/bʊk/"
    assert len(data["examples"]) == 2


@pytest.mark.asyncio
async def test_translations_quick_endpoint(client: AsyncClient, monkeypatch):
    token = await create_auth_token(client, "quick_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    async def mock_quick(text, source_lang="en", target_lang="uz"):
        from app.schemas.ai import QuickTranslationResponse
        return QuickTranslationResponse(
            original_text=text,
            translated_text="Salom dunyo",
            source_lang=source_lang,
            target_lang=target_lang,
        )

    async def mock_fast_translate(text, source_lang="en", target_lang="uz"):
        return "Salom dunyo"

    from app.services.translation_service import translation_service
    monkeypatch.setattr(translation_service, "fast_translate", mock_fast_translate)
    monkeypatch.setattr(ai_service, "translate_quick", mock_quick)

    res = await client.post(
        "/api/v1/translations/quick",
        headers=headers,
        json={"text": "Hello world", "source_lang": "en", "target_lang": "uz"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["translated_text"] == "Salom dunyo"


@pytest.mark.asyncio
async def test_stories_generate_from_batch_and_crud(client: AsyncClient, test_session, monkeypatch):
    token = await create_auth_token(client, "story_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create words which auto-create and populate a batch
    batch_id = None
    for w, tr in [("passport", "pasport"), ("luggage", "bagaj"), ("airport", "aeroport")]:
        add_res = await client.post(
            "/api/v1/vocabulary",
            headers=headers,
            json={"english_word": w, "uzbek_translation": tr},
        )
        assert add_res.status_code == 201
        batch_id = add_res.json()["batch_id"]

    assert batch_id is not None

    # Mock ai_service.generate_batch_story
    async def mock_generate_story(words, cefr_level="B1", max_retries=None):
        return MiniStoryResponse(
            title_en="A Journey to Samarkand",
            title_uz="Samarqandga sayohat",
            content_en="At the airport, he checked his luggage and presented his passport.",
            content_uz="Aeroportda u bagajini topshirdi va pasportini ko'rsatdi.",
            used_target_words=["airport", "luggage", "passport"],
            comprehension_questions=[
                ComprehensionQuestionSchema(
                    question="Where did the story begin?",
                    options=["At the airport", "At home", "In a train", "In a bus"],
                    correct_option_index=0,
                    explanation="He was at the airport.",
                ),
                ComprehensionQuestionSchema(
                    question="What did he check?",
                    options=["His luggage", "His coat", "His ticket", "His watch"],
                    correct_option_index=0,
                    explanation="He checked his luggage.",
                ),
                ComprehensionQuestionSchema(
                    question="What document did he present?",
                    options=["Passport", "ID card", "Driver license", "Visa"],
                    correct_option_index=0,
                    explanation="He presented his passport.",
                ),
            ],
        )

    monkeypatch.setattr(ai_service, "generate_batch_story", mock_generate_story)

    # 2. Generate Story from Batch
    gen_res = await client.post(
        "/api/v1/stories/generate",
        headers=headers,
        json={"batch_id": batch_id, "cefr_level": "B1"},
    )
    assert gen_res.status_code == 201
    story_data = gen_res.json()
    story_id = story_data["id"]
    assert story_data["title_en"] == "A Journey to Samarkand"
    assert "passport" in story_data["target_words"]
    assert len(story_data["comprehension_questions"]) == 3

    # 3. List stories
    list_res = await client.get("/api/v1/stories", headers=headers)
    assert list_res.status_code == 200
    stories_list = list_res.json()
    assert len(stories_list) >= 1
    assert any(s["id"] == story_id for s in stories_list)

    # 4. Get single story detail
    get_res = await client.get(f"/api/v1/stories/{story_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["title_uz"] == "Samarqandga sayohat"

    # 5. Delete story
    del_res = await client.delete(f"/api/v1/stories/{story_id}", headers=headers)
    assert del_res.status_code == 204

    # Confirm 404 after deletion
    get_after = await client.get(f"/api/v1/stories/{story_id}", headers=headers)
    assert get_after.status_code == 404
