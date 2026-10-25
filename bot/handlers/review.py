import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import flashcard_reveal_keyboard, flashcard_rating_keyboard, main_menu_keyboard

logger = logging.getLogger(__name__)


def format_card_question(word_data: dict, index: int, total: int) -> str:
    word = word_data.get("english_word", "")
    pos = word_data.get("part_of_speech") or "word"
    cefr = word_data.get("cefr_level") or "B1"
    is_weak = word_data.get("is_weak", False)

    weak_badge = " ⚠️ (Qiyin so'z)" if is_weak else ""
    return (
        f"📝 **Takrorlash:** [{index + 1}/{total}]{weak_badge}\n\n"
        f"🇬🇧 **{word}**\n"
        f"• Turkum: _{pos}_\n"
        f"• Daraja: `{cefr}`\n\n"
        f"❓ O'zbekcha tarjimasini eslashga harakat qiling:"
    )


def format_card_answer(word_data: dict, index: int, total: int) -> str:
    word = word_data.get("english_word", "")
    translation = word_data.get("uzbek_translation", "")
    phonetic = word_data.get("phonetic") or ""
    pos = word_data.get("part_of_speech") or "word"
    notes = word_data.get("notes") or ""
    examples = word_data.get("examples") or []

    text = (
        f"📝 **Takrorlash:** [{index + 1}/{total}]\n\n"
        f"🇬🇧 **{word}** {phonetic}\n"
        f"🇺🇿 **{translation}**\n"
        f"• Turkum: _{pos}_\n"
    )

    if notes:
        text += f"💡 _Izoh: {notes}_\n"

    if examples and len(examples) > 0:
        ex = examples[0]
        text += f"\n📖 **Misol:**\n• {ex.get('sentence_en')}\n• _{ex.get('sentence_uz')}_\n"

    text += "\n🤔 **Ushbu so'zni qanchalik yaxshi esladingiz?**"
    return text


async def start_review(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    # Check user link
    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Takrorlash uchun avval Telegram hisobingizni saytga bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    # Fetch review queue from backend
    queue = await api_client.get_review_queue(user.id, limit=10)
    if not queue:
        text = (
            "🎉 **Ajoyib! Bugungi barcha so'zlarni takrorlab bo'ldingiz.**\n\n"
            "Interval takrorlash algoritmi (SM-2) bo'yicha hozircha navbatda so'zlar qolmagan. "
            "Yangi so'z qo'shish uchun `/add <so'z>` buyrug'idan foydalanishingiz mumkin."
        )
        if update.message:
            await update.message.reply_text(text, reply_markup=main_menu_keyboard(True), parse_mode="Markdown")
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(text, reply_markup=main_menu_keyboard(True), parse_mode="Markdown")
        return

    # Save queue in user_data
    context.user_data["review_queue"] = queue
    context.user_data["review_index"] = 0
    context.user_data["review_completed_count"] = 0

    first_card = queue[0]
    card_text = format_card_question(first_card, 0, len(queue))

    if update.message:
        await update.message.reply_text(
            card_text,
            reply_markup=flashcard_reveal_keyboard(str(first_card["id"])),
            parse_mode="Markdown",
        )
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(
            card_text,
            reply_markup=flashcard_reveal_keyboard(str(first_card["id"])),
            parse_mode="Markdown",
        )


async def handle_reveal_card(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()

    data = query.data or ""
    word_id = data.replace("reveal_", "")

    queue = context.user_data.get("review_queue", [])
    index = context.user_data.get("review_index", 0)

    if not queue or index >= len(queue):
        await query.message.reply_text("Sessiya eskirgan. Yangi takrorlashni boshlang: /review")
        return

    current_card = queue[index]
    answer_text = format_card_answer(current_card, index, len(queue))

    await query.edit_message_text(
        answer_text,
        reply_markup=flashcard_rating_keyboard(word_id),
        parse_mode="Markdown",
    )


async def handle_rate_card(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not query or not user:
        return
    await query.answer()

    # Callback format: rate_{word_id}_{rating}
    parts = (query.data or "").split("_")
    if len(parts) < 3:
        return

    word_id = parts[1]
    rating = int(parts[2])

    # Submit review to backend (SRS SM-2 calculation and active study time)
    await api_client.submit_review(
        telegram_user_id=user.id,
        word_id=word_id,
        quality_rating=rating,
    )

    queue = context.user_data.get("review_queue", [])
    index = context.user_data.get("review_index", 0) + 1
    completed = context.user_data.get("review_completed_count", 0) + 1

    context.user_data["review_index"] = index
    context.user_data["review_completed_count"] = completed

    # Check if there are more cards
    if index < len(queue):
        next_card = queue[index]
        card_text = format_card_question(next_card, index, len(queue))
        await query.edit_message_text(
            card_text,
            reply_markup=flashcard_reveal_keyboard(str(next_card["id"])),
            parse_mode="Markdown",
        )
    else:
        # Session completed!
        summary_text = (
            f"🎉 **Mashg'ulot yakunlandi!**\n\n"
            f"• Takrorlangan so'zlar: **{completed} ta**\n"
            f"• Faol o'qish vaqti hisobingizga qo'shildi: ⏱ **+{(completed * 20)} soniya**\n"
            f"• Natijalar sayt va bot o'rtasida to'liq sinxronlandi!\n\n"
            f"Ajoyib davom eting! Kunlik seriyangizni saqlab qolishni unutmang."
        )
        await query.edit_message_text(
            summary_text,
            reply_markup=main_menu_keyboard(True),
            parse_mode="Markdown",
        )
