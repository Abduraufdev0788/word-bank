import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import main_menu_keyboard

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
        markup = main_menu_keyboard(True)
    else:
        text = "📦 **Sizning 20 talik so'z to'plamlaringiz:**\n\n"
        buttons = []
        for b in batches:
            num = b.get("batch_number", 1)
            title = b.get("title", f"{num}-to'plam")
            count = b.get("word_count", 0)
            status_str = b.get("status", "learning")
            due = b.get("due_count", 0)
            b_id = b.get("id")

            status_icon = "🟢" if count == 20 else "🟡"
            due_badge = f" | ⏰ {due} ta takrorlash" if due > 0 else ""

            text += (
                f"{status_icon} **{title}**\n"
                f"   • So'zlar: `{count}/20` ta ({status_str}){due_badge}\n\n"
            )

            buttons.append([
                InlineKeyboardButton(f"👁 {title} so'zlarini ko'rish", callback_data=f"inspect_batch_{b_id}")
            ])

        buttons.append([InlineKeyboardButton("🏠 Bosh menyu", callback_data="cmd_menu")])
        markup = InlineKeyboardMarkup(buttons)

    if update.message:
        await update.message.reply_text(text, reply_markup=markup, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, reply_markup=markup, parse_mode="Markdown")


async def handle_inspect_batch(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not query or not user:
        return
    await query.answer()

    batch_id = (query.data or "").replace("inspect_batch_", "")
    words = await api_client.get_batch_words(user.id, batch_id)

    if not words:
        await query.message.reply_text("Ushbu to'plamda hali so'zlar mavjud emas.")
        return

    text = f"📦 **To'plam tarkibidagi so'zlar ({len(words)} ta):**\n\n"
    for idx, w in enumerate(words, start=1):
        en = w.get("english_word", "")
        uz = w.get("uzbek_translation", "")
        pos = w.get("part_of_speech", "")
        text += f"{idx}. **{en}** — _{uz}_ ({pos})\n"

    reply_markup = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔄 Ushbu so'zlarni takrorlash", callback_data="cmd_review"),
            InlineKeyboardButton("🔙 To'plamlarga qaytish", callback_data="cmd_batches"),
        ]
    ])

    await query.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")
