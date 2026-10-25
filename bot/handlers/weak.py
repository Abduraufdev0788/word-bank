import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import flashcard_reveal_keyboard, main_menu_keyboard
from bot.handlers.review import format_card_question

logger = logging.getLogger(__name__)


async def weak_words_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Zaif so'zlarni ko'rish uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    weak_words = await api_client.get_weak_words(user.id, limit=8)
    if not weak_words:
        text = (
            "🎉 **Sizda hech qanday zaif yoki qiyin so'z mavjud emas!**\n\n"
            "Barcha so'zlarni a'lo darajada o'zlashtirgansiz. Mashg'ulotni davom ettirish uchun /review yoki /quiz ni tanlang."
        )
        if update.message:
            await update.message.reply_text(text, reply_markup=main_menu_keyboard(True), parse_mode="Markdown")
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(text, reply_markup=main_menu_keyboard(True), parse_mode="Markdown")
        return

    # Put into review queue so user can practice them immediately
    context.user_data["review_queue"] = weak_words
    context.user_data["review_index"] = 0
    context.user_data["review_completed_count"] = 0

    first_card = weak_words[0]
    total = len(weak_words)

    intro_text = (
        f"⚠️ **Zaif So'zlar Laboratoriyasi:** {total} ta so'z\n\n"
        f"Ushbu so'zlar mashqlarda eng ko'p adashilgan yoki unutilgan. Ularni qayta mustahkamlaymiz!\n\n"
        f"{format_card_question(first_card, 0, total)}"
    )

    if update.message:
        await update.message.reply_text(
            intro_text,
            reply_markup=flashcard_reveal_keyboard(str(first_card["id"])),
            parse_mode="Markdown",
        )
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(
            intro_text,
            reply_markup=flashcard_reveal_keyboard(str(first_card["id"])),
            parse_mode="Markdown",
        )
