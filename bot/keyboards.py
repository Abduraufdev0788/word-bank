from typing import List, Dict, Any
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu_keyboard(is_linked: bool = True) -> InlineKeyboardMarkup:
    if not is_linked:
        return InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Veb-sayt manzili", callback_data="cmd_website")],
            [InlineKeyboardButton("ℹ️ Qanday ulanadi?", callback_data="help_link")],
        ])

    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔄 Kunlik Takrorlash (SRS)", callback_data="cmd_review"),
            InlineKeyboardButton("🎯 50 talik Test / Viktorina", callback_data="cmd_quiz_modes"),
        ],
        [
            InlineKeyboardButton("➕ Yangi so'z", callback_data="cmd_add"),
            InlineKeyboardButton("📁 Fayl yuklash (TXT/CSV)", callback_data="cmd_import_file"),
        ],
        [
            InlineKeyboardButton("📦 To'plamlarim (20 talik)", callback_data="cmd_batches"),
            InlineKeyboardButton("⚠️ Zaif So'zlar", callback_data="cmd_weak"),
        ],
        [
            InlineKeyboardButton("📖 Mini Hikoyalar", callback_data="cmd_stories"),
            InlineKeyboardButton("🌟 Kun so'zi", callback_data="cmd_word_of_day"),
        ],
        [
            InlineKeyboardButton("📊 Natijalarim", callback_data="cmd_progress"),
            InlineKeyboardButton("⚙️ Sozlamalar", callback_data="cmd_settings"),
        ],
        [
            InlineKeyboardButton("🌐 Veb-sayt manzili", callback_data="cmd_website"),
        ],
    ])


def quiz_mode_selection_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🎯 Bilgan so'zlar: 🇺🇿 O'zbekcha ➔ 🇬🇧 Inglizcha (50 ta)", callback_data="start_quiz_mastered_50_uz_to_en"),
        ],
        [
            InlineKeyboardButton("🎯 Bilgan so'zlar: 🇬🇧 Inglizcha ➔ 🇺🇿 O'zbekcha (50 ta)", callback_data="start_quiz_mastered_50"),
        ],
        [
            InlineKeyboardButton("📚 Barcha so'zlar (50 talik test)", callback_data="start_quiz_all_50"),
        ],
        [
            InlineKeyboardButton("⚠️ Zaif so'zlar testi", callback_data="start_quiz_weak"),
            InlineKeyboardButton("⚡️ Tezkor test (10 ta)", callback_data="start_quiz_fast"),
        ],
        [
            InlineKeyboardButton("🏠 Bosh menyu", callback_data="cmd_menu"),
        ],
    ])


def flashcard_reveal_keyboard(word_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("👀 Tarjimani ko'rish", callback_data=f"reveal_{word_id}")],
    ])


def flashcard_rating_keyboard(word_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔴 Unutdim (0)", callback_data=f"rate_{word_id}_0"),
            InlineKeyboardButton("🟠 Qiyin (3)", callback_data=f"rate_{word_id}_3"),
        ],
        [
            InlineKeyboardButton("🟢 Yaxshi (4)", callback_data=f"rate_{word_id}_4"),
            InlineKeyboardButton("🌟 Oson (5)", callback_data=f"rate_{word_id}_5"),
        ],
    ])


def quiz_options_keyboard(word_id: str, options: List[str], direction: str) -> InlineKeyboardMarkup:
    keyboard = []
    # 2x2 grid of options
    row = []
    for idx, opt in enumerate(options):
        # Truncate text if too long
        btn_text = opt if len(opt) <= 24 else opt[:22] + ".."
        row.append(
            InlineKeyboardButton(
                btn_text,
                callback_data=f"qans_{word_id}_{idx}_{direction}",
            )
        )
        if len(row) == 2:
            keyboard.append(row)
            row = []
    if row:
        keyboard.append(row)

    keyboard.append([
        InlineKeyboardButton("❌ Viktorinani tugatish", callback_data="cmd_menu")
    ])
    return InlineKeyboardMarkup(keyboard)


def word_of_day_keyboard(english_word: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("➕ Lug'atga qo'shish", callback_data=f"add_word_{english_word}"),
            InlineKeyboardButton("🔄 Boshqa so'z", callback_data="cmd_word_of_day"),
        ],
        [
            InlineKeyboardButton("🏠 Bosh menyu", callback_data="cmd_menu"),
        ],
    ])


def stories_list_keyboard(stories: List[Dict[str, Any]]) -> InlineKeyboardMarkup:
    buttons = []
    for s in stories[:5]:
        title = s.get("title_uz") or s.get("title_en") or "Hikoya"
        level = s.get("cefr_level", "B1")
        story_id = s.get("id")
        buttons.append([
            InlineKeyboardButton(f"📖 [{level}] {title[:28]}", callback_data=f"read_story_{story_id}")
        ])

    buttons.append([
        InlineKeyboardButton("🏠 Bosh menyu", callback_data="cmd_menu")
    ])
    return InlineKeyboardMarkup(buttons)


def batch_item_keyboard(batch_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("👁 So'zlarni ko'rish", callback_data=f"inspect_batch_{batch_id}"),
            InlineKeyboardButton("🔄 Takrorlash", callback_data="cmd_review"),
        ],
        [
            InlineKeyboardButton("🔙 To'plamlar ro'yxati", callback_data="cmd_batches"),
        ],
    ])


def unlink_confirmation_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("❌ Ha, hisobni uzish", callback_data="confirm_unlink"),
            InlineKeyboardButton("Bekor qilish", callback_data="cancel_unlink"),
        ]
    ])
