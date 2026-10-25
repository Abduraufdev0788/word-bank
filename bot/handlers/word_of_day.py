import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import word_of_day_keyboard, main_menu_keyboard

logger = logging.getLogger(__name__)


async def word_of_day_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Kun so'zini ko'rish uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    word_data = await api_client.get_word_of_the_day(user.id)
    if not word_data:
        await update.message.reply_text("Bugungi kun so'zi yuklanmadi. /word buyrug'ini qayta bosing.")
        return

    english = word_data.get("english_word", "")
    uzbek = word_data.get("uzbek_translation", "")
    phonetic = word_data.get("phonetic", "")
    pos = word_data.get("part_of_speech", "word")
    cefr = word_data.get("cefr_level", "B1")
    notes = word_data.get("notes", "")
    examples = word_data.get("examples", [])

    text = (
        f"🌟 **Kunning Maxsus So'zi (Word of the Day)**\n\n"
        f"🇬🇧 **{english}** `{phonetic}`\n"
        f"🇺🇿 **{uzbek}**\n"
        f"• Turkum: _{pos}_\n"
        f"• Daraja: `{cefr}`\n"
    )

    if notes:
        text += f"💡 _Izoh: {notes}_\n"

    if examples:
        text += "\n📖 **Namunaviy gaplar:**\n"
        for ex in examples[:2]:
            text += f"• {ex.get('sentence_en')}\n  _{ex.get('sentence_uz')}_\n"

    markup = word_of_day_keyboard(english)

    if update.message:
        await update.message.reply_text(text, reply_markup=markup, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, reply_markup=markup, parse_mode="Markdown")


async def handle_add_word_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not query or not user:
        return
    await query.answer()

    word_text = (query.data or "").replace("add_word_", "")
    if not word_text:
        return

    status_msg = await query.message.reply_text(f"⏳ `{word_text}` lug'atingizga qo'shilmoqda...")
    res = await api_client.quick_add_word(
        telegram_user_id=user.id,
        english_word=word_text,
        auto_enrich=True,
    )

    if res.get("success"):
        await status_msg.edit_text(
            f"✅ **{word_text}** muvaffaqiyatli saqlandi va 20 talik to'plamingizga kiritildi!",
            reply_markup=main_menu_keyboard(True),
            parse_mode="Markdown",
        )
    else:
        err = res.get("error", "So'z qo'shishda xatolik yuz berdi.")
        await status_msg.edit_text(f"⚠️ {err}", reply_markup=main_menu_keyboard(True))
