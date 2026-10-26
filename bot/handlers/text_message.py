import logging
import re
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import main_menu_keyboard

logger = logging.getLogger(__name__)


async def handle_user_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user or not update.message or not update.message.text:
        return

    text = update.message.text.strip()
    if text.startswith("/"):
        return

    # Check if user is linked
    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        clean_token = text.replace("/link", "").replace("link", "").strip()
        if len(clean_token) >= 20 and " " not in clean_token:
            link_result = await api_client.verify_link(
                token=clean_token,
                telegram_user_id=user.id,
                telegram_chat_id=chat.id,
                username=user.username,
                first_name=user.first_name,
            )
            if link_result.get("success"):
                data = link_result.get("data", {})
                full_name = data.get("full_name") or user.first_name
                await update.message.reply_text(
                    f"🎉 **Tabriklaymiz, {full_name}!**\n\n"
                    f"Telegram hisobingiz **SmartVocab AI** platformasiga muvaffaqiyatli bog'landi.\n"
                    f"Bog'langan hisob: `{data.get('email')}`\n\n"
                    f"Endi saytdagi barcha so'zlaringiz va takrorlashlaringiz shu bot orqali avtomatik sinxronlashadi!\n\n"
                    f"Quyidagi menyu orqali mashg'ulotni boshlashingiz mumkin:",
                    reply_markup=main_menu_keyboard(is_linked=True),
                    parse_mode="Markdown",
                )
                return

        await update.message.reply_text(
            "👋 Salom! Botdan to'liq foydalanish va so'zlarni saqlash uchun "
            "avval hisobingizni bog'lang: saytdan linking kodini oling yoki /start buyrug'ini yuboring.",
            reply_markup=main_menu_keyboard(False),
        )
        return

    words = text.split()

    # Case 1: Single English word sent directly (e.g. "relentless", "ubiquitous")
    is_single_english_word = (
        len(words) == 1
        and re.match(r"^[a-zA-Z\-']+$", words[0]) is not None
        and len(words[0]) >= 2
    )

    if is_single_english_word:
        clean_word = words[0].lower()
        status_msg = await update.message.reply_text(f"🔍 `{clean_word}` so'zi tahlil qilinmoqda...")

        # Get quick translation
        translated = await api_client.quick_translate(clean_word)
        if not translated:
            translated = "AI orqali tarjima qilinadi"

        reply_markup = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("➕ Lug'atga saqlash", callback_data=f"add_word_{clean_word}"),
                InlineKeyboardButton("🔄 Takrorlash", callback_data="cmd_review"),
            ],
            [
                InlineKeyboardButton("🏠 Bosh menyu", callback_data="cmd_menu"),
            ],
        ])

        await status_msg.edit_text(
            f"🇬🇧 **{clean_word}**\n"
            f"🇺🇿 Tarjima: **{translated}**\n\n"
            f"Ushbu so'zni 20 talik to'plamingizga va interval takrorlash (SRS) jadvalingizga qo'shasizmi?",
            reply_markup=reply_markup,
            parse_mode="Markdown",
        )
        return

    # Case 2: Multi-word phrase or sentence -> Automatic Quick AI Translation
    status_msg = await update.message.reply_text("🔄 AI orqali tarjima qilinmoqda...")
    translated = await api_client.quick_translate(text)

    if translated:
        response_text = (
            f"📝 **Asl matn:**\n{text}\n\n"
            f"🇺🇿 **Tarjima:**\n{translated}"
        )
        await status_msg.edit_text(response_text, parse_mode="Markdown")
    else:
        await status_msg.edit_text(
            f"Matn qabul qilindi: `{text}`\n\n"
            f"Buyruqlardan foydalanish uchun /help ni bosing.",
            reply_markup=main_menu_keyboard(True),
            parse_mode="Markdown",
        )
