import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.config import bot_settings
from bot.keyboards import main_menu_keyboard

logger = logging.getLogger(__name__)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    chat = update.effective_chat

    if not user or not chat:
        return

    # Check if /link was called without args
    raw_text = getattr(update.message, "text", None)
    if isinstance(raw_text, str) and raw_text.startswith("/link") and not (context.args and len(context.args) > 0):
        await update.message.reply_text(
            "ℹ️ **Hisobni ulash uchun:**\n"
            "Veb-saytdagi **Sozlamalar** sahifasidan 'Xavfsiz ulanish kodini olish' tugmasini bosing va chiqqan kodni botga yuboring:\n"
            "Masalan: `/link <sizning_kodingiz>` yoki shunchaki 'To'g'ridan-to'g'ri Telegramda ochish' tugmasini bosing.",
            parse_mode="Markdown",
        )
        return

    # Check if a linking token was passed: /start <token> or /link <token>
    args = context.args
    if args and len(args) > 0:
        token = args[0].strip()
        link_result = await api_client.verify_link(
            token=token,
            telegram_user_id=user.id,
            telegram_chat_id=chat.id,
            username=user.username,
            first_name=user.first_name,
        )

        if link_result.get("success"):
            data = link_result.get("data", {})
            full_name = data.get("full_name") or user.first_name
            text = (
                f"🎉 **Tabriklaymiz, {full_name}!**\n\n"
                f"Telegram hisobingiz **SmartVocab AI** platformasiga muvaffaqiyatli bog'landi.\n"
                f"Bog'langan hisob: `{data.get('email')}`\n\n"
                f"Endi saytdagi barcha so'zlaringiz va takrorlashlaringiz shu bot orqali avtomatik sinxronlashadi!\n\n"
                f"Quyidagi menyu orqali mashg'ulotni boshlashingiz mumkin:"
            )
            await update.message.reply_text(
                text,
                reply_markup=main_menu_keyboard(is_linked=True),
                parse_mode="Markdown",
            )
            return
        else:
            err_msg = link_result.get("error", "Bog'lash kodi noto'g'ri yoki eskirgan.")
            text = (
                f"⚠️ **Bog'lashda xatolik yuz berdi:**\n{err_msg}\n\n"
                f"Iltimos, SmartVocab AI veb-saytiga kiring va Profilingizdan yangi 'Telegramni ulash' havolasini oling."
            )
            await update.message.reply_text(
                text,
                reply_markup=main_menu_keyboard(is_linked=False),
                parse_mode="Markdown",
            )
            return

    # Regular /start without token: check if user is already linked
    summary = await api_client.get_user_summary(user.id)
    if summary and summary.get("is_linked"):
        streak = summary.get("streak_days", 0)
        due = summary.get("words_due_today", 0)
        time_today = summary.get("study_time_minutes_today", 0)
        name = summary.get("full_name") or user.first_name

        text = (
            f"👋 **Assalomu alaykum, {name}!**\n\n"
            f"🎯 **Bugungi ta'lim holatingiz:**\n"
            f"• Takrorlash lozim: **{due} ta so'z**\n"
            f"• Ketma-ket o'qish (streak): 🔥 **{streak} kun**\n"
            f"• Bugungi faol vaqt: ⏱ **{time_today} daqiqa**\n\n"
            f"Mashg'ulotni boshlash uchun tugmalardan birini tanlang:"
        )
        await update.message.reply_text(
            text,
            reply_markup=main_menu_keyboard(is_linked=True),
            parse_mode="Markdown",
        )
    else:
        text = (
            f"👋 **Assalomu alaykum, {user.first_name}!**\n\n"
            f"**SmartVocab AI** — bu Google Gemini bilan boyitilgan, aqlli interval takrorlash (SRS) "
            f"va shaxsiy lug'at platformangizning rasmiy Telegram boti.\n\n"
            f"⚠️ **Hisobingiz hali platformaga ulanmagan.**\n\n"
            f"Botdan to'liq foydalanish uchun saytimizdagi hisobingizni bog'lashingiz kerak:\n"
            f"1. Veb-saytimizga kiring:\n"
            f"   🌐 **Server manzili:** {bot_settings.APP_URL}\n"
            f"   🌐 **Lokal manzil:** http://localhost:5173\n"
            f"2. Profilingizdan **'Telegramni ulash'** tugmasini bosing.\n"
            f"3. Berilgan maxsus havola orqali botga kiring."
        )
        await update.message.reply_text(
            text,
            reply_markup=main_menu_keyboard(is_linked=False),
            parse_mode="Markdown",
        )


async def website_info_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.message or (update.callback_query.message if update.callback_query else None)
    if update.callback_query:
        await update.callback_query.answer()

    text = (
        "🌐 **SmartVocab AI Veb-Platformasi**\n\n"
        "Platformaga kirish uchun quyidagi manzillardan foydalanishingiz mumkin:\n"
        f"🔗 **Server:** {bot_settings.APP_URL}\n"
        "🔗 **Lokal:** http://localhost:5173\n\n"
        "💡 **Hisobni ulash tartibi:**\n"
        "1. Saytga kiring va ro'yxatdan o'ting / hisobingizga kiring.\n"
        "2. Sozlamalar yoki Profil bo'limidan **'Telegramni ulash'** tugmasini bosing.\n"
        "3. Chiqqan havola orqali botga o'tsangiz, profilingiz avtomatik ulanadi."
    )
    if msg:
        await msg.reply_text(text, parse_mode="Markdown")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        f"📖 **SmartVocab AI Bot Buyruqlari:**\n\n"
        f"🔄 `/review` — Bugun takrorlanishi lozim bo'lgan so'zlarni mashq qilish\n"
        f"🎯 `/quiz` — 4 talik interaktiv viktorina (test)\n"
        f"➕ `/add <so'z>` — Lug'atga yangi inglizcha so'z qo'shish (AI avtomatik boyitadi)\n"
        f"🔤 `/translate <matn>` — AI yordamida tezkor tarjima olish\n"
        f"📦 `/batches` — 20 talik to'plamlaringiz holatini ko'rish\n"
        f"⚠️ `/weak` — Zaif so'zlar bo'yicha mashq\n"
        f"📖 `/stories` — CEFR darajangizga mos AI mini hikoyalar\n"
        f"🌟 `/word` — Kunning maxsus so'zi\n"
        f"📊 `/progress` — Kunlik natijalar, o'rganilgan so'zlar va seriya (streak)\n"
        f"⚙️ `/settings` — Hisob ma'lumotlari va sozlamalar\n"
        f"ℹ️ `/help` — Yordam va qo'llanma"
    )
    if update.message:
        await update.message.reply_text(text, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, parse_mode="Markdown")

