import logging
import sys
from telegram import BotCommand, Update
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from bot.config import bot_settings
from bot.handlers.start import start_command, help_command
from bot.handlers.review import start_review, handle_reveal_card, handle_rate_card
from bot.handlers.quiz import start_quiz, handle_quiz_answer
from bot.handlers.weak import weak_words_command
from bot.handlers.story import stories_command, handle_read_story
from bot.handlers.word_of_day import word_of_day_command, handle_add_word_callback
from bot.handlers.vocabulary import add_word_command, translate_command
from bot.handlers.batches import batches_command, handle_inspect_batch
from bot.handlers.progress import progress_command
from bot.handlers.settings import (
    settings_command,
    handle_confirm_unlink,
    handle_cancel_unlink,
)
from bot.handlers.text_message import handle_user_text_message
from bot.keyboards import main_menu_keyboard

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def post_init(application: Application) -> None:
    """Sets comprehensive bot commands in the Telegram menu button."""
    commands = [
        BotCommand("start", "Botni ishga tushirish / Hisobni ulash"),
        BotCommand("review", "Kunlik so'z takrorlash (SRS SM-2)"),
        BotCommand("quiz", "Interaktiv 4 talik viktorina"),
        BotCommand("add", "Yangi so'z qo'shish (masalan: /add resilient)"),
        BotCommand("weak", "Zaif so'zlarni mustahkamlash"),
        BotCommand("stories", "AI Mini hikoyalarni o'qish"),
        BotCommand("word", "Kunning maxsus so'zi"),
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
        "1. Buyruq orqali: `/add <inglizcha so'z>` (masalan: `/add resilient`)\n"
        "2. Yoki to'g'ridan-to'g'ri so'zni xabar qilib yuboring (masalan: `perseverance`)\n\n"
        "AI so'zni avtomatik tahlil qiladi, tarjima qiladi va 20 talik to'plamingizga kiritadi.",
        parse_mode="Markdown",
    )


async def main_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    await query.message.reply_text(
        "🏠 **Bosh Menyu:**\nQuyidagi bo'limlardan birini tanlang:",
        reply_markup=main_menu_keyboard(is_linked=True),
        parse_mode="Markdown",
    )


def build_bot_application() -> Application:
    """Builds and configures the complete python-telegram-bot Application."""
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
    app.add_handler(CommandHandler("quiz", start_quiz))
    app.add_handler(CommandHandler("add", add_word_command))
    app.add_handler(CommandHandler("weak", weak_words_command))
    app.add_handler(CommandHandler("stories", stories_command))
    app.add_handler(CommandHandler("story", stories_command))
    app.add_handler(CommandHandler("word", word_of_day_command))
    app.add_handler(CommandHandler("daily", word_of_day_command))
    app.add_handler(CommandHandler("translate", translate_command))
    app.add_handler(CommandHandler("batches", batches_command))
    app.add_handler(CommandHandler("progress", progress_command))
    app.add_handler(CommandHandler("settings", settings_command))

    # Callback queries from inline menus
    app.add_handler(CallbackQueryHandler(start_review, pattern="^cmd_review$"))
    app.add_handler(CallbackQueryHandler(start_quiz, pattern="^cmd_quiz$"))
    app.add_handler(CallbackQueryHandler(menu_add_callback, pattern="^cmd_add$"))
    app.add_handler(CallbackQueryHandler(batches_command, pattern="^cmd_batches$"))
    app.add_handler(CallbackQueryHandler(weak_words_command, pattern="^cmd_weak$"))
    app.add_handler(CallbackQueryHandler(stories_command, pattern="^cmd_stories$"))
    app.add_handler(CallbackQueryHandler(word_of_day_command, pattern="^cmd_word_of_day$"))
    app.add_handler(CallbackQueryHandler(progress_command, pattern="^cmd_progress$"))
    app.add_handler(CallbackQueryHandler(settings_command, pattern="^cmd_settings$"))
    app.add_handler(CallbackQueryHandler(main_menu_callback, pattern="^cmd_menu$"))
    app.add_handler(CallbackQueryHandler(help_command, pattern="^help_link$"))

    # Flashcard review callbacks
    app.add_handler(CallbackQueryHandler(handle_reveal_card, pattern="^reveal_"))
    app.add_handler(CallbackQueryHandler(handle_rate_card, pattern="^rate_"))

    # Interactive Quiz answer callback
    app.add_handler(CallbackQueryHandler(handle_quiz_answer, pattern="^qans_"))

    # Mini stories callback
    app.add_handler(CallbackQueryHandler(handle_read_story, pattern="^read_story_"))

    # Batch inspection callback
    app.add_handler(CallbackQueryHandler(handle_inspect_batch, pattern="^inspect_batch_"))

    # 1-click word addition callback
    app.add_handler(CallbackQueryHandler(handle_add_word_callback, pattern="^add_word_"))

    # Unlink account callbacks
    app.add_handler(CallbackQueryHandler(handle_confirm_unlink, pattern="^confirm_unlink$"))
    app.add_handler(CallbackQueryHandler(handle_cancel_unlink, pattern="^cancel_unlink$"))

    # Smart Text Message Handler (auto-translate & 1-click word add)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_user_text_message))

    return app


if __name__ == "__main__":
    if not bot_settings.TELEGRAM_BOT_TOKEN:
        print("Xatolik: TELEGRAM_BOT_TOKEN sozlanmagan. Iltimos, .env faylida bot tokenini ko'rsating.")
        sys.exit(1)

    print(f"Starting SmartVocab AI Telegram Bot (@{bot_settings.TELEGRAM_BOT_USERNAME})...")
    application = build_bot_application()
    application.run_polling()
