import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.api_client import api_client

logger = logging.getLogger(__name__)


async def handle_document_upload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles documents sent to the bot (TXT, CSV, XLSX) and imports into 20-word batches."""
    message = update.message
    user = update.effective_user
    if not message or not user or not message.document:
        return

    doc = message.document
    filename = doc.file_name or "file.txt"
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    allowed_exts = {"txt", "csv", "xlsx", "xls"}
    if ext not in allowed_exts:
        await message.reply_text(
            f"⚠️ **Noto'g'ri fayl formati:** `.{ext}`\n\n"
            "SmartVocab AI faqat quyidagi formatlarni qabul qiladi:\n"
            "• **TXT** (masalan: `apple - olma`)\n"
            "• **CSV** (English, Uzbek ustunlari)\n"
            "• **XLSX / XLS** (Excel jadvallari)\n\n"
            "Iltimos, ushbu formatlardan birida fayl yuboring.",
            parse_mode="Markdown",
        )
        return

    # Check user link status
    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        await message.reply_text(
            "⚠️ Fayl orqali so'zlarni yuklash uchun avval Telegram hisobingizni saytga bog'lang (/start).",
            parse_mode="Markdown",
        )
        return

    # Check file size (5MB limit)
    if doc.file_size and doc.file_size > 5 * 1024 * 1024:
        await message.reply_text("⚠️ Fayl hajmi 5 MB dan oshmasligi kerak.")
        return

    status_msg = await message.reply_text(
        f"📥 **`{filename}`** qabul qilindi.\n"
        f"⏳ Fayl yuklanmoqda va 20 talik to'plamlarga bo'linmoqda...",
        parse_mode="Markdown",
    )

    try:
        # Download file bytes via Telegram bot API
        bot_file = await context.bot.get_file(doc.file_id)
        file_bytes = await bot_file.download_as_bytearray()

        # Send to backend API
        res = await api_client.upload_import_file(
            telegram_user_id=user.id,
            file_bytes=bytes(file_bytes),
            filename=filename,
        )

        if not res.get("success"):
            err = res.get("error", "Faylni tahlil qilishda xatolik yuz berdi.")
            await status_msg.edit_text(f"⚠️ **Xatolik:**\n{err}", parse_mode="Markdown")
            return

        data = res.get("data", {})
        imported_words = data.get("imported_words", 0)
        batches_created = data.get("batches_created", 0)
        skipped = data.get("skipped_duplicates", 0)
        total_rows = data.get("total_rows", 0)

        success_text = (
            f"✅ **Lug'at fayli muvaffaqiyatli yuklandi!**\n\n"
            f"📄 Fayl: `{filename}`\n"
            f"📊 Qabul qilingan so'zlar: **{imported_words} ta**\n"
            f"📦 Yangi 20 talik to'plamlar: **{batches_created} ta**\n"
            f"⏭ O'tkazib yuborilgan (dublikat): **{skipped} ta**\n"
            f"📑 Jami qatorlar: **{total_rows} ta**\n\n"
            f"⚡️ Barcha so'zlar sizning shaxsiy hisobingizga saqlandi va veb-sayt bilan bir zumda sinxronlandi!"
        )

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🎯 50 talik Testni boshlash", callback_data="cmd_quiz_modes"),
                InlineKeyboardButton("📦 To'plamlarim", callback_data="cmd_batches"),
            ],
            [
                InlineKeyboardButton("🏠 Bosh menyu", callback_data="cmd_menu"),
            ],
        ])

        await status_msg.edit_text(success_text, reply_markup=keyboard, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Error handling document upload: {e}", exc_info=True)
        await status_msg.edit_text(
            f"⚠️ Faylni qayta ishlashda kutilmagan xatolik yuz berdi: {str(e)}"
        )


async def file_import_help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Shows instructions on how to send files to the bot."""
    text = (
        "📁 **Telegram orqali lug'at faylini yuklash:**\n\n"
        "Siz o'zingizda mavjud istalgan lug'at faylini to'g'ridan-to'g'ri botga yuborishingiz mumkin. "
        "Tizim uni avtomatik tahlil qilib, **20 talik qulay to'plamlarga** ajratadi.\n\n"
        "📋 **Qo'llab-quvvatlanadigan formatlar:**\n"
        "• **TXT (.txt):**\n"
        "  `resilient - chidamli`\n"
        "  `perseverance - qat'iyat`\n"
        "  `serendipity, tasodifiy omad`\n\n"
        "• **CSV (.csv):**\n"
        "  `English, Uzbek` ustunli jadval\n\n"
        "• **Excel (.xlsx / .xls):**\n"
        "  Inglizcha va o'zbekcha ustunlarga ega Excel hujjati\n\n"
        "💡 **Qanday yuklash kerak?**\n"
        "Shunchaki faylni Telegram chatga yuboring (fayl sifatida)!"
    )
    if update.message:
        await update.message.reply_text(text, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, parse_mode="Markdown")
