import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import unlink_confirmation_keyboard, main_menu_keyboard

logger = logging.getLogger(__name__)


async def settings_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Sozlamalar uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    email = summary.get("email", "")
    cefr = summary.get("preferred_cefr_level", "B1")

    text = (
        f"⚙️ **Sozlamalar va Hisob Ma'lumotlari**\n\n"
        f"• Bog'langan email: `{email}`\n"
        f"• CEFR darajasi: `{cefr}`\n"
        f"• Telegram ID: `{user.id}`\n\n"
        f"Agar ushbu Telegram hisobini platformadan uzmoqchi bo'lsangiz, quyidagi tugmani bosing:"
    )

    if update.message:
        await update.message.reply_text(text, reply_markup=unlink_confirmation_keyboard(), parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, reply_markup=unlink_confirmation_keyboard(), parse_mode="Markdown")


async def handle_confirm_unlink(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not query or not user:
        return
    await query.answer()

    success = await api_client.unlink_account(user.id)
    if success:
        await query.edit_message_text(
            "🔒 **Telegram hisobingiz platformadan muvaffaqiyatli uzildi.**\n\n"
            "Qayta ulash uchun veb-sayt orqali yangi havola olishingiz mumkin.",
            reply_markup=main_menu_keyboard(is_linked=False),
            parse_mode="Markdown",
        )
    else:
        await query.edit_message_text("⚠️ Hisobni uzishda xatolik yuz berdi.")


async def handle_cancel_unlink(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.edit_message_text("Amal bekor qilindi.", reply_markup=main_menu_keyboard(is_linked=True))
