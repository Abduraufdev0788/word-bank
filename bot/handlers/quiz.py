import logging
from telegram import Update
from telegram.ext import ContextTypes

from bot.api_client import api_client
from bot.keyboards import quiz_options_keyboard, quiz_mode_selection_keyboard, main_menu_keyboard

logger = logging.getLogger(__name__)


async def show_quiz_modes(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Displays quiz mode selection (50 words from known words, all words, weak words, etc.)."""
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Test / Viktorina boshlash uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    text = (
        "🎯 **SmartVocab 50 talik Test & Viktorina Markazi:**\n\n"
        "Quyidagi test rejimlaridan birini tanlang:\n\n"
        "1. 🎯 **Bilgan so'zlar (50 talik test):**\n"
        "   _O'zlashtirilgan so'zlaringizdan 50 tasini sinovdan o'tkazing. Xato qilingan so'z darhol «Zaif so'zlar» ro'yxatiga kiritiladi!_\n\n"
        "2. 📚 **Barcha so'zlar (50 talik test):**\n"
        "   _Lug'at bankidagi barcha so'zlar orasidan 50 talik keng qamrovli sinov._\n\n"
        "3. ⚠️ **Zaif so'zlar testi:**\n"
        "   _Eng ko'p adashilgan va unutilgan so'zlar ustida ishlash._\n\n"
        "4. ⚡️ **Tezkor test (10 ta):**\n"
        "   _1 daqiqalik qisqa bilim sinovi._"
    )

    reply_markup = quiz_mode_selection_keyboard()

    if update.message:
        await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")


async def start_quiz(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    quiz_type: str = "mastered_50",
    count: int = 5,
    direction: str = "en_to_uz",
) -> None:
    """Starts the actual quiz session with the selected type and count."""
    user = update.effective_user
    if not user:
        return

    summary = await api_client.get_user_summary(user.id)
    if not summary or not summary.get("is_linked"):
        msg = "⚠️ Viktorina o'ynash uchun avval hisobingizni bog'lang (/start)."
        if update.message:
            await update.message.reply_text(msg)
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(msg)
        return

    if context.args and "uz" in context.args[0].lower():
        direction = "uz_to_en"

    # Support custom count from context.args if present
    target_count = count
    if context.args and len(context.args) > 1 and context.args[1].isdigit():
        target_count = int(context.args[1])

    questions = await api_client.get_quiz_questions(
        telegram_user_id=user.id,
        count=target_count,
        direction=direction,
        quiz_type=quiz_type,
    )

    if not questions:
        text = (
            "⚠️ **Lug'atingizda yetarli so'z topilmadi.**\n\n"
            "Viktorina boshlash uchun kamida 4-5 ta so'z kerak bo'ladi.\n"
            "Yangi so'z qo'shish uchun: `/add <inglizcha so'z>`"
        )
        if update.message:
            await update.message.reply_text(text, parse_mode="Markdown")
        elif update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(text, parse_mode="Markdown")
        return

    context.user_data["quiz_questions"] = questions
    context.user_data["quiz_index"] = 0
    context.user_data["quiz_score"] = 0
    context.user_data["quiz_weak_added"] = 0
    context.user_data["quiz_direction"] = direction
    context.user_data["quiz_type"] = quiz_type

    current_q = questions[0]
    total = len(questions)
    dir_title = "🇬🇧 Inglizcha ➡️ 🇺🇿 O'zbekcha" if direction == "en_to_uz" else "🇺🇿 O'zbekcha ➡️ 🇬🇧 Inglizcha"
    mode_title = "50 talik Viktorina" if target_count >= 50 else "Viktorinasi"

    text = (
        f"🎯 **SmartVocab {mode_title}** [1/{total}]\n"
        f"📌 Yo'nalish: {dir_title}\n\n"
        f"❓ **{current_q['prompt']}**\n\n"
        f"To'g'ri variantni tanlang:"
    )

    reply_markup = quiz_options_keyboard(
        word_id=current_q["word_id"],
        options=current_q["options"],
        direction=direction,
    )

    if update.message:
        await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    elif update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")


# Alias for explicit flow
start_quiz_flow = start_quiz


async def handle_quiz_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not query or not user:
        return
    await query.answer()

    # format: qans_{word_id}_{opt_idx}_{direction}
    parts = (query.data or "").split("_")
    if len(parts) < 4:
        return

    word_id = parts[1]
    opt_idx = int(parts[2])
    direction = "_".join(parts[3:])

    questions = context.user_data.get("quiz_questions", [])
    index = context.user_data.get("quiz_index", 0)

    if not questions or index >= len(questions):
        await query.message.reply_text("Viktorina sessiyasi tugagan. Qaytadan boshlash: /quiz")
        return

    current_q = questions[index]
    options = current_q.get("options", [])
    if opt_idx >= len(options):
        return

    selected_text = options[opt_idx]

    # Validate on backend (SRS SM-2 + study time + weak word logic)
    result = await api_client.submit_quiz_answer(
        telegram_user_id=user.id,
        word_id=word_id,
        selected_option=selected_text,
        direction=direction,
    )

    is_correct = result.get("is_correct", False) if result else False
    correct_ans = result.get("correct_answer", "") if result else ""
    explanation = result.get("explanation", "") if result else ""

    score = context.user_data.get("quiz_score", 0)
    weak_count = context.user_data.get("quiz_weak_added", 0)

    if is_correct:
        score += 1
        context.user_data["quiz_score"] = score
        if result and result.get("is_synonym_match"):
            feedback_icon = "✨ **To'g'ri! Siz tanlagan so'z to'g'ri sinonim sifatida qabul qilindi!**"
        else:
            feedback_icon = "✅ **To'g'ri! Barakalla!**"
    else:
        weak_count += 1
        context.user_data["quiz_weak_added"] = weak_count
        feedback_icon = (
            f"❌ **Noto'g'ri!**\nTo'g'ri javob: **{correct_ans}**\n\n"
            f"⚠️ **Diqqat:** Ushbu so'z xato qilindi va avtomatik ravishda «Zaif so'zlar» (bilmaganlar) ro'yxatiga qo'shildi!"
        )

    feedback_text = (
        f"{feedback_icon}\n\n"
        f"{explanation}\n"
        f"⏱ +15 soniya faol o'qish vaqti qo'shildi."
    )

    await query.message.reply_text(feedback_text, parse_mode="Markdown")

    # Proceed to next question or finalize
    index += 1
    context.user_data["quiz_index"] = index

    if index < len(questions):
        next_q = questions[index]
        total = len(questions)
        next_text = (
            f"🎯 **SmartVocab Viktorinasi** [{index + 1}/{total}]\n\n"
            f"❓ **{next_q['prompt']}**\n\n"
            f"To'g'ri variantni tanlang:"
        )
        next_markup = quiz_options_keyboard(
            word_id=next_q["word_id"],
            options=next_q["options"],
            direction=direction,
        )
        await query.message.reply_text(next_text, reply_markup=next_markup, parse_mode="Markdown")
    else:
        # Final summary
        total = len(questions)
        percent = round((score / total) * 100) if total > 0 else 0
        summary = (
            f"🏁 **Viktorina yakunlandi!**\n\n"
            f"📊 Natijangiz: **{score} / {total}** ({percent}%)\n"
            f"⚠️ Zaif so'zlarga o'tkazildi: **{weak_count} ta**\n"
            f"⚡️ Barcha javoblar sizning SRS xotirangizga saqlandi va sayt bilan sinxronlandi!\n\n"
            f"Yana o'ynash uchun: /quiz"
        )
        await query.message.reply_text(
            summary,
            reply_markup=main_menu_keyboard(True),
            parse_mode="Markdown",
        )
