from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu_keyboard(is_linked: bool = True) -> InlineKeyboardMarkup:
    if not is_linked:
        return InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Saytga o'tish", url="http://localhost:5173")],
            [InlineKeyboardButton("ℹ️ Qanday ulanadi?", callback_data="help_link")],
        ])

    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔄 Kunlik Takrorlash", callback_data="cmd_review"),
            InlineKeyboardButton("➕ So'z qo'shish", callback_data="cmd_add"),
        ],
        [
            InlineKeyboardButton("📦 To'plamlarim", callback_data="cmd_batches"),
            InlineKeyboardButton("📊 Natijalarim", callback_data="cmd_progress"),
        ],
        [
            InlineKeyboardButton("⚙️ Sozlamalar", callback_data="cmd_settings"),
            InlineKeyboardButton("🌐 Veb-sayt", url="http://localhost:5173"),
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


def unlink_confirmation_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("❌ Ha, hisobni uzish", callback_data="confirm_unlink"),
            InlineKeyboardButton("Bekor qilish", callback_data="cancel_unlink"),
        ]
    ])
