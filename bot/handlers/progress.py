import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client

logger = logging.getLogger(__name__)


async def progress_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Natijalarni ko'rish uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    streak = summary.get("streak_days", 1)
    due = summary.get("words_due_today", 0)
    reviewed_today = summary.get("words_reviewed_today", 0)
    minutes_today = summary.get("study_time_minutes_today", 0)
    cefr = summary.get("preferred_cefr_level", "B1")
    email = summary.get("email", "")

    # Visual streak bar
    streak_flames = "🔥" * min(streak, 7)
    if streak > 7:
        streak_flames += f" (+{streak - 7})"

    text = (
        f"📊 **SmartVocab AI — Shaxsiy Ta'lim Natijalari**\n"
        f"👤 Hisob: `{email}`\n"
        f"🎯 Maqsadli daraja: `{cefr}`\n\n"
        f"🔥 **Kunlik seriya (Streak):** {streak_flames}\n"
        f"   • {streak} kun ketma-ket faol mashg'ulot!\n\n"
        f"⏱ **Bugungi faol vaqt:** `{minutes_today}` daqiqa\n"
        f"🔄 **Bugun takrorlangan so'zlar:** `{reviewed_today}` ta\n"
        f"⏰ **Hozir navbatda turgan so'zlar:** `{due}` ta\n\n"
        f"💡 Telegramdagi har bir takrorlash faol vaqtingizga avtomatik qo'shiladi va veb-saytdagi statistikangiz bilan sinxronlashadi."
    )

    if update.message:
        await update.message.reply_text(text, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, parse_mode="Markdown")
