import logging
import sys
from telegram import BotCommand, Update
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)

from bot.config import bot_settings
from bot.handlers.start import start_command, help_command
from bot.handlers.review import start_review, handle_reveal_card, handle_rate_card
from bot.handlers.vocabulary import add_word_command, translate_command
from bot.handlers.batches import batches_command
from bot.handlers.progress import progress_command
from bot.handlers.settings import (
    settings_command,
    handle_confirm_unlink,
    handle_cancel_unlink,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def post_init(application: Application) -> None:
    """Sets bot commands in the Telegram menu button."""
    commands = [
        BotCommand("start", "Botni ishga tushirish / Hisobni ulash"),
        BotCommand("review", "Kunlik so'z takrorlash (SRS)"),
        BotCommand("add", "Yangi so'z qo'shish (masalan: /add resilient)"),
        BotCommand("translate", "AI bilan tezkor tarjima"),
        BotCommand("batches", "20 talik so'z to'plamlarim"),
        BotCommand("progress", "Statistika, streak va faol vaqt"),
        BotCommand("settings", "Sozlamalar va hisobni boshqarish"),
        BotCommand("help", "Yordam va qo'llanma"),
    ]
    try:
        await application.bot.set_my_commands(commands)
        logger.info("Bot commands successfully registered in Telegram menu.")
    except Exception as e:
        logger.warning(f"Failed to set bot commands: {e}")


async def menu_add_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.message.reply_text(
        "➕ **Yangi so'z qo'shish:**\n\n"
        "So'z qo'shish uchun quyidagi formatda yozing:\n"
        "`/add <inglizcha so'z>`\n\n"
        "Masalan: `/add resilient`\n"
        "AI avtomatik ravishda so'zni tahlil qilib, to'plamingizga saqlaydi.",
        parse_mode="Markdown",
    )


def build_bot_application() -> Application:
    """Builds and configures the python-telegram-bot Application."""
    if not bot_settings.TELEGRAM_BOT_TOKEN:
        logger.warning(
            "TELEGRAM_BOT_TOKEN is not configured! Bot application created in offline/dry-run mode."
        )

    token = bot_settings.TELEGRAM_BOT_TOKEN or "DUMMY_TOKEN_FOR_TESTING"
    app = ApplicationBuilder().token(token).post_init(post_init).build()

    # Commands
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("review", start_review))
    app.add_handler(CommandHandler("add", add_word_command))
    app.add_handler(CommandHandler("translate", translate_command))
    app.add_handler(CommandHandler("batches", batches_command))
    app.add_handler(CommandHandler("progress", progress_command))
    app.add_handler(CommandHandler("settings", settings_command))

    # Callback queries from inline menus
    app.add_handler(CallbackQueryHandler(start_review, pattern="^cmd_review$"))
    app.add_handler(CallbackQueryHandler(menu_add_callback, pattern="^cmd_add$"))
    app.add_handler(CallbackQueryHandler(batches_command, pattern="^cmd_batches$"))
    app.add_handler(CallbackQueryHandler(progress_command, pattern="^cmd_progress$"))
    app.add_handler(CallbackQueryHandler(settings_command, pattern="^cmd_settings$"))
    app.add_handler(CallbackQueryHandler(help_command, pattern="^help_link$"))

    # Flashcard review callbacks
    app.add_handler(CallbackQueryHandler(handle_reveal_card, pattern="^reveal_"))
    app.add_handler(CallbackQueryHandler(handle_rate_card, pattern="^rate_"))

    # Unlink account callbacks
    app.add_handler(CallbackQueryHandler(handle_confirm_unlink, pattern="^confirm_unlink$"))
    app.add_handler(CallbackQueryHandler(handle_cancel_unlink, pattern="^cancel_unlink$"))

    return app


if __name__ == "__main__":
    if not bot_settings.TELEGRAM_BOT_TOKEN:
        print("Xatolik: TELEGRAM_BOT_TOKEN sozlanmagan. Iltimos, .env faylida bot tokenini ko'rsating.")
        sys.exit(1)

    print(f"Starting SmartVocab AI Telegram Bot (@{bot_settings.TELEGRAM_BOT_USERNAME})...")
    application = build_bot_application()
    application.run_polling()
