import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client

logger = logging.getLogger(__name__)


async def add_word_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user or not update.message:
        return

    # Check user link
    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        await update.message.reply_text(
            "⚠️ So'z qo'shish uchun avval Telegram hisobingizni saytga bog'lang (/start)."
        )
        return

    args = context.args
    if not args:
        await update.message.reply_text(
            "ℹ️ **So'z qo'shish uchun buyruqdan so'ng so'zni yozing:**\n"
            "Masalan: `/add resilient` yoki `/add serendipity`",
            parse_mode="Markdown",
        )
        return

    word_text = " ".join(args).strip()
    status_msg = await update.message.reply_text(
        f"🤖 `{word_text}` so'zi tahlil qilinmoqda va AI yordamida boyitilmoqda..."
    )

    result = await api_client.quick_add_word(
        telegram_user_id=user.id,
        english_word=word_text,
        auto_enrich=True,
    )

    if not result.get("success"):
        err = result.get("error", "So'z qo'shishda xatolik yuz berdi.")
        await status_msg.edit_text(f"⚠️ {err}")
        return

    w = result.get("word", {})
    english = w.get("english_word", word_text)
    uzbek = w.get("uzbek_translation", "")
    phonetic = w.get("phonetic", "")
    pos = w.get("part_of_speech", "")
    cefr = w.get("cefr_level", "")
    notes = w.get("notes", "")
    examples = w.get("examples", [])

    text = (
        f"✅ **So'z muvaffaqiyatli saqlandi!**\n\n"
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

    text += "\n📦 Ushbu so'z 20 talik to'plamingizga joylandi va takrorlash jadvaliga kiritildi."
    await status_msg.edit_text(text, parse_mode="Markdown")


async def translate_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return

    args = context.args
    if not args:
        await update.message.reply_text(
            "ℹ️ **Tarjima qilish uchun matn kiriting:**\n"
            "Masalan: `/translate Learning languages expands your mind.`",
            parse_mode="Markdown",
        )
        return

    query_text = " ".join(args).strip()
    status_msg = await update.message.reply_text("🔄 Tarjima qilinmoqda...")

    translated = await api_client.quick_translate(query_text)
    if translated:
        text = (
            f"🇬🇧 **Asl matn:**\n{query_text}\n\n"
            f"🇺🇿 **Tarjima:**\n{translated}"
        )
        await status_msg.edit_text(text, parse_mode="Markdown")
    else:
        await status_msg.edit_text("⚠️ Tarjima qilishda xatolik yuz berdi. Qaytadan urinib ko'ring.")
