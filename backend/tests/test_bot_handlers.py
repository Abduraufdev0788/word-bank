from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from bot.handlers.start import start_command, help_command
from bot.handlers.review import (
    start_review,
    handle_reveal_card,
    handle_rate_card,
    format_card_question,
    format_card_answer,
)
from bot.handlers.vocabulary import add_word_command, translate_command
from bot.handlers.batches import batches_command
from bot.handlers.progress import progress_command
from bot.handlers.settings import settings_command, handle_confirm_unlink
from bot.handlers.quiz import start_quiz, handle_quiz_answer
from bot.handlers.story import stories_command, handle_read_story
from bot.handlers.text_message import handle_user_text_message


@pytest.mark.asyncio
async def test_bot_start_with_linking_token():
    update = MagicMock()
    update.effective_user.id = 12345
    update.effective_user.username = "test_user"
    update.effective_user.first_name = "Abdurauf"
    update.effective_chat.id = 12345
    update.message.reply_text = AsyncMock()

    context = MagicMock()
    context.args = ["sample_valid_token_123"]

    with patch("bot.handlers.start.api_client.verify_link", new_callable=AsyncMock) as mock_link:
        mock_link.return_value = {
            "success": True,
            "data": {"email": "user@smartvocab.uz", "full_name": "Abdurauf"},
        }
        await start_command(update, context)

        mock_link.assert_called_once_with(
            token="sample_valid_token_123",
            telegram_user_id=12345,
            telegram_chat_id=12345,
            username="test_user",
            first_name="Abdurauf",
        )
        update.message.reply_text.assert_called_once()
        sent_text = update.message.reply_text.call_args[0][0]
        assert "Tabriklaymiz, Abdurauf!" in sent_text
        assert "user@smartvocab.uz" in sent_text


@pytest.mark.asyncio
async def test_bot_start_already_linked():
    update = MagicMock()
    update.effective_user.id = 12345
    update.effective_user.first_name = "Abdurauf"
    update.effective_chat.id = 12345
    update.message.reply_text = AsyncMock()

    context = MagicMock()
    context.args = []

    with patch("bot.handlers.start.api_client.get_user_summary", new_callable=AsyncMock) as mock_summary:
        mock_summary.return_value = {
            "is_linked": True,
            "full_name": "Abdurauf",
            "streak_days": 5,
            "words_due_today": 8,
            "study_time_minutes_today": 15,
        }
        await start_command(update, context)

        update.message.reply_text.assert_called_once()
        sent_text = update.message.reply_text.call_args[0][0]
        assert "8 ta so'z" in sent_text
        assert "5 kun" in sent_text


@pytest.mark.asyncio
async def test_bot_review_flow_cards_and_ratings():
    update = MagicMock()
    update.effective_user.id = 12345
    update.message.reply_text = AsyncMock()

    context = MagicMock()
    context.user_data = {}

    fake_queue = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "english_word": "Perseverance",
            "uzbek_translation": "Matonat",
            "part_of_speech": "noun",
            "cefr_level": "C1",
            "phonetic": "/ˌpɜː.sɪˈvɪə.rəns/",
            "notes": "Qat'iyatlilik",
            "examples": [{"sentence_en": "Keep going.", "sentence_uz": "Davom eting."}],
        }
    ]

    with patch("bot.handlers.review.api_client.get_user_summary", new_callable=AsyncMock) as mock_sum, \
         patch("bot.handlers.review.api_client.get_review_queue", new_callable=AsyncMock) as mock_q:
        mock_sum.return_value = {"is_linked": True}
        mock_q.return_value = fake_queue

        await start_review(update, context)
        update.message.reply_text.assert_called_once()
        assert context.user_data["review_index"] == 0
        assert len(context.user_data["review_queue"]) == 1

    # Test reveal
    cb_update = MagicMock()
    cb_update.callback_query.data = "reveal_11111111-1111-1111-1111-111111111111"
    cb_update.callback_query.answer = AsyncMock()
    cb_update.callback_query.edit_message_text = AsyncMock()

    await handle_reveal_card(cb_update, context)
    cb_update.callback_query.edit_message_text.assert_called_once()
    revealed_text = cb_update.callback_query.edit_message_text.call_args[0][0]
    assert "Matonat" in revealed_text

    # Test rate
    rate_update = MagicMock()
    rate_update.effective_user.id = 12345
    rate_update.callback_query.data = "rate_11111111-1111-1111-1111-111111111111_4"
    rate_update.callback_query.answer = AsyncMock()
    rate_update.callback_query.edit_message_text = AsyncMock()

    with patch("bot.handlers.review.api_client.submit_review", new_callable=AsyncMock) as mock_sub:
        mock_sub.return_value = {"is_correct": True}
        await handle_rate_card(rate_update, context)

        mock_sub.assert_called_once_with(
            telegram_user_id=12345,
            word_id="11111111-1111-1111-1111-111111111111",
            quality_rating=4,
        )
        rate_update.callback_query.edit_message_text.assert_called_once()
        finish_text = rate_update.callback_query.edit_message_text.call_args[0][0]
        assert "Mashg'ulot yakunlandi" in finish_text


@pytest.mark.asyncio
async def test_bot_quick_add_word():
    update = MagicMock()
    update.effective_user.id = 12345
    mock_status_msg = MagicMock()
    mock_status_msg.edit_text = AsyncMock()
    update.message.reply_text = AsyncMock(return_value=mock_status_msg)

    context = MagicMock()
    context.args = ["resilient"]

    with patch("bot.handlers.vocabulary.api_client.get_user_summary", new_callable=AsyncMock) as mock_sum, \
         patch("bot.handlers.vocabulary.api_client.quick_add_word", new_callable=AsyncMock) as mock_add:
        mock_sum.return_value = {"is_linked": True}
        mock_add.return_value = {
            "success": True,
            "word": {
                "english_word": "resilient",
                "uzbek_translation": "egilmas, chidamli",
                "part_of_speech": "adjective",
                "cefr_level": "C1",
                "phonetic": "/rɪˈzɪl.jənt/",
                "examples": [{"sentence_en": "She is resilient.", "sentence_uz": "U chidamli."}],
            },
        }

        await add_word_command(update, context)
        mock_add.assert_called_once_with(
            telegram_user_id=12345,
            english_word="resilient",
            auto_enrich=True,
        )
        mock_status_msg.edit_text.assert_called_once()
        saved_text = mock_status_msg.edit_text.call_args[0][0]
        assert "egilmas, chidamli" in saved_text


@pytest.mark.asyncio
async def test_bot_quiz_flow():
    update = MagicMock()
    update.effective_user.id = 12345
    update.message.reply_text = AsyncMock()

    context = MagicMock()
    context.args = []
    context.user_data = {}

    fake_questions = [
        {
            "word_id": "test-word-1",
            "prompt": "Persistent",
            "options": ["Tirishop", "Dangasa", "Qo'rqoq", "Shoshqaloq"],
            "direction": "en_to_uz",
        }
    ]

    with patch("bot.handlers.quiz.api_client.get_user_summary", new_callable=AsyncMock) as mock_sum, \
         patch("bot.handlers.quiz.api_client.get_quiz_questions", new_callable=AsyncMock) as mock_q:
        mock_sum.return_value = {"is_linked": True}
        mock_q.return_value = fake_questions

        await start_quiz(update, context)
        update.message.reply_text.assert_called_once()
        sent_text = update.message.reply_text.call_args[0][0]
        assert "Persistent" in sent_text
        assert context.user_data["quiz_index"] == 0

    # Answer quiz question
    cb_update = MagicMock()
    cb_update.effective_user.id = 12345
    cb_update.callback_query.data = "qans_test-word-1_0_en_to_uz"
    cb_update.callback_query.answer = AsyncMock()
    cb_update.callback_query.message.reply_text = AsyncMock()

    with patch("bot.handlers.quiz.api_client.submit_quiz_answer", new_callable=AsyncMock) as mock_ans:
        mock_ans.return_value = {
            "is_correct": True,
            "correct_answer": "Tirishqoq",
            "explanation": "🇬🇧 Persistent = 🇺🇿 Tirishqoq",
        }
        await handle_quiz_answer(cb_update, context)
        mock_ans.assert_called_once_with(
            telegram_user_id=12345,
            word_id="test-word-1",
            selected_option="Tirishop",
            direction="en_to_uz",
        )
        assert cb_update.callback_query.message.reply_text.call_count == 2
        final_summary = cb_update.callback_query.message.reply_text.call_args[0][0]
        assert "Viktorina yakunlandi" in final_summary


@pytest.mark.asyncio
async def test_bot_text_message_single_word_prompt():
    update = MagicMock()
    update.effective_user.id = 12345
    update.message.text = "ubiquitous"
    mock_status_msg = MagicMock()
    mock_status_msg.edit_text = AsyncMock()
    update.message.reply_text = AsyncMock(return_value=mock_status_msg)

    context = MagicMock()

    with patch("bot.handlers.text_message.api_client.get_user_summary", new_callable=AsyncMock) as mock_sum, \
         patch("bot.handlers.text_message.api_client.quick_translate", new_callable=AsyncMock) as mock_tr:
        mock_sum.return_value = {"is_linked": True}
        mock_tr.return_value = "hamma joyda hozir bo'lgan"

        await handle_user_text_message(update, context)

        mock_status_msg.edit_text.assert_called_once()
        text_out = mock_status_msg.edit_text.call_args[0][0]
        assert "ubiquitous" in text_out
        assert "hamma joyda hozir bo'lgan" in text_out

