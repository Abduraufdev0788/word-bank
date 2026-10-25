import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import stories_list_keyboard, main_menu_keyboard

logger = logging.getLogger(__name__)


async def stories_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Hikoyalarni ko'rish uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    stories = await api_client.get_stories(user.id, limit=5)
    if not stories:
        text = (
            "📖 **Sizda hali yaratilgan mini hikoyalar mavjud emas.**\n\n"
            "Veb-saytga kiring va 'AI Mini Hikoyalar' bo'limida 20 talik to'plamingiz asosida "
            "Google Gemini yordamida qiziqarli hikoyalar yarating!"
        )
        if update.message:
            await update.message.reply_text(text, reply_markup=main_menu_keyboard(True), parse_mode="Markdown")
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(text, reply_markup=main_menu_keyboard(True), parse_mode="Markdown")
        return

    # Cache stories in context
    context.user_data["user_stories"] = {s["id"]: s for s in stories}

    text = (
        f"📖 **AI Mini Hikoyalar Kutubxonasi:**\n\n"
        f"Quyidagi hikoyalardan birini tanlab, o'qishni boshlang:"
    )

    markup = stories_list_keyboard(stories)
    if update.message:
        await update.message.reply_text(text, reply_markup=markup, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, reply_markup=markup, parse_mode="Markdown")


async def handle_read_story(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()

    story_id = (query.data or "").replace("read_story_", "")
    stories_map = context.user_data.get("user_stories", {})
    story = stories_map.get(story_id)

    if not story:
        # Fetch fresh list
        user = update.effective_user
        if user:
            stories = await api_client.get_stories(user.id, limit=10)
            for s in stories:
                if str(s.get("id")) == story_id:
                    story = s
                    break

    if not story:
        await query.message.reply_text("Hikoya topilmadi yoki eskirgan. /stories orqali qayta urinib ko'ring.")
        return

    title_en = story.get("title_en", "")
    title_uz = story.get("title_uz", "")
    content_en = story.get("content_en", "")
    content_uz = story.get("content_uz", "")
    level = story.get("cefr_level", "B1")
    target_words = story.get("target_words", [])

    tw_str = ", ".join([f"`{tw}`" for tw in target_words[:10]]) if target_words else "Barcha to'plam so'zlari"

    text = (
        f"📖 **{title_en}** ({level})\n"
        f"🇺🇿 _{title_uz}_\n\n"
        f"🎯 **Ushbu hikoyadagi asosiy so'zlar:**\n{tw_str}\n\n"
        f"🇬🇧 **Inglizcha matn:**\n{content_en}\n\n"
        f"🇺🇿 **O'zbekcha tarjimasi:**\n{content_uz}"
    )

    await query.message.reply_text(text, reply_markup=main_menu_keyboard(True), parse_mode="Markdown")
