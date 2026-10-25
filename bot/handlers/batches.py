import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client

logger = logging.getLogger(__name__)


async def batches_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ To'plamlarni ko'rish uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    batches = await api_client.get_batches(user.id)
    if not batches:
        text = (
            "📦 **Sizda hali so'z to'plamlari mavjud emas.**\n\n"
            "Yangi so'z qo'shish uchun `/add <so'z>` buyrug'idan foydalaning yoki "
            "veb-sayt orqali TXT, CSV, XLSX fayllaringizni import qiling!"
        )
    else:
        text = "📦 **Sizning 20 talik so'z to'plamlaringiz:**\n\n"
        for b in batches:
            num = b.get("batch_number", 1)
            title = b.get("title", f"{num}-to'plam")
            count = b.get("word_count", 0)
            status_str = b.get("status", "learning")
            due = b.get("due_count", 0)

            status_icon = "🟢" if count == 20 else "🟡"
            due_badge = f" | ⏰ {due} ta takrorlash" if due > 0 else ""

            text += (
                f"{status_icon} **{title}**\n"
                f"   • So'zlar: `{count}/20` ta ({status_str}){due_badge}\n\n"
            )

        text += "💡 To'plamlar 20 ta so'zdan to'ldiriladi va avtomatik navbatdagi to'plam ochiladi."

    if update.message:
        await update.message.reply_text(text, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, parse_mode="Markdown")
