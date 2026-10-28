import re
import uuid
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vocabulary import Word


# Pre-compiled high-frequency English synonyms map
COMMON_SYNONYMS: Dict[str, Set[str]] = {
    "big": {"large", "huge", "great", "gigantic", "massive", "enormous", "broad"},
    "large": {"big", "huge", "great", "gigantic", "massive", "enormous"},
    "huge": {"big", "large", "great", "gigantic", "massive", "enormous"},
    "small": {"little", "tiny", "minute", "miniature", "slight"},
    "little": {"small", "tiny", "minute", "slight"},
    "tiny": {"small", "little", "minute", "miniature"},
    "fast": {"quick", "rapid", "swift", "speedy", "brisk"},
    "quick": {"fast", "rapid", "swift", "speedy", "brisk"},
    "rapid": {"fast", "quick", "swift", "speedy"},
    "start": {"begin", "commence", "initiate", "launch"},
    "begin": {"start", "commence", "initiate", "launch"},
    "commence": {"start", "begin", "initiate"},
    "finish": {"end", "complete", "conclude", "terminate", "wrap up"},
    "end": {"finish", "complete", "conclude", "terminate"},
    "complete": {"finish", "end", "conclude", "finalize"},
    "smart": {"clever", "intelligent", "bright", "wise"},
    "clever": {"smart", "intelligent", "bright", "cunning"},
    "intelligent": {"smart", "clever", "bright", "wise"},
    "difficult": {"hard", "tough", "challenging", "complex"},
    "hard": {"difficult", "tough", "challenging", "solid"},
    "tough": {"difficult", "hard", "challenging"},
    "easy": {"simple", "effortless", "straightforward"},
    "simple": {"easy", "straightforward", "basic", "plain"},
    "happy": {"glad", "cheerful", "joyful", "pleased", "delighted"},
    "glad": {"happy", "cheerful", "pleased", "delighted"},
    "cheerful": {"happy", "glad", "joyful"},
    "sad": {"unhappy", "sorrowful", "depressed", "gloomy"},
    "unhappy": {"sad", "sorrowful", "depressed"},
    "beautiful": {"pretty", "handsome", "attractive", "gorgeous", "lovely"},
    "pretty": {"beautiful", "attractive", "lovely"},
    "handsome": {"beautiful", "attractive", "good-looking"},
    "attractive": {"beautiful", "pretty", "handsome", "gorgeous"},
    "buy": {"purchase", "acquire"},
    "purchase": {"buy", "acquire"},
    "help": {"assist", "aid", "support"},
    "assist": {"help", "aid", "support"},
    "speak": {"talk", "say", "converse", "state"},
    "talk": {"speak", "chat", "converse"},
    "look": {"see", "watch", "glance", "view", "observe"},
    "see": {"look", "watch", "view", "spot"},
    "watch": {"look", "see", "observe"},
    "right": {"correct", "accurate", "exact", "true"},
    "correct": {"right", "accurate", "exact", "proper"},
    "accurate": {"right", "correct", "exact", "precise"},
    "wrong": {"incorrect", "erroneous", "false", "mistaken"},
    "incorrect": {"wrong", "erroneous", "false"},
    "job": {"work", "occupation", "profession", "career", "task"},
    "work": {"job", "labor", "task", "toil"},
    "tired": {"exhausted", "fatigued", "weary"},
    "exhausted": {"tired", "fatigued", "weary"},
    "scared": {"afraid", "frightened", "terrified", "fearful"},
    "afraid": {"scared", "frightened", "terrified"},
    "frightened": {"scared", "afraid", "terrified"},
    "calm": {"peaceful", "quiet", "serene", "tranquil"},
    "peaceful": {"calm", "quiet", "serene", "tranquil"},
    "quiet": {"calm", "silent", "peaceful", "still"},
    "silent": {"quiet", "still", "mute"},
    "rich": {"wealthy", "affluent", "prosperous"},
    "wealthy": {"rich", "affluent", "prosperous"},
    "poor": {"needy", "destitute", "impoverished"},
    "courage": {"bravery", "valor", "boldness"},
    "bravery": {"courage", "valor", "boldness"},
    "persevere": {"persist", "endure", "continue"},
    "persist": {"persevere", "endure", "continue"},
    "stop": {"halt", "cease", "pause", "discontinue"},
    "halt": {"stop", "cease", "pause"},
    "love": {"adore", "cherish", "treasure"},
    "hate": {"detest", "loathe", "dislike"},
    "dislike": {"hate", "detest"},
    "allow": {"permit", "let", "authorize"},
    "permit": {"allow", "let", "authorize"},
    "make": {"create", "produce", "build", "construct"},
    "create": {"make", "produce", "generate"},
    "choose": {"select", "pick", "opt"},
    "select": {"choose", "pick", "opt"},
    "important": {"crucial", "essential", "vital", "significant"},
    "crucial": {"important", "essential", "vital"},
    "essential": {"important", "crucial", "vital", "necessary"},
    "necessary": {"needed", "required", "essential"},
}


def clean_text(text: str) -> str:
    """Normalizes string for comparison: lowercase, stripped, removes punctuation."""
    if not text:
        return ""
    cleaned = text.lower().strip()
    cleaned = re.sub(r"[\(\)\[\]\,\.\;\:\!\?\'\"\`\-\_\/\\]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


async def verify_english_answer(
    user_input: str,
    target_word: Word,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Tuple[bool, bool, Optional[str]]:
    """
    Verifies if user's typed English answer is correct for target_word (Uzbek prompt).
    Handles:
    1. Exact match with target english_word
    2. Split/slashed matches in target english_word (e.g. "large / big")
    3. Other words in user's dictionary sharing the exact or equivalent Uzbek translation
    4. Common synonym pairs (e.g. "big" for "large")
    5. Fast machine translation cross-check

    Returns:
    (is_correct: bool, is_synonym_match: bool, explanation_note: Optional[str])
    """
    clean_in = clean_text(user_input)
    clean_target_en = clean_text(target_word.english_word)
    clean_target_uz = clean_text(target_word.uzbek_translation)

    if not clean_in:
        return False, False, "Javob kiritilmadi"

    # 1. Exact direct match
    if clean_in == clean_target_en:
        return True, False, None

    # 2. Target word contains slashes or commas: e.g. "begin / start", "big, large"
    target_parts = [clean_text(p) for p in re.split(r"[/,;()]+", target_word.english_word) if clean_text(p)]
    if clean_in in target_parts:
        return True, True, f"To'g'ri! '{user_input.strip()}' sinonim sifatida qabul qilindi."

    # 3. Check user's own database words: Does user have another word with the same Uzbek translation?
    # e.g. User has 'big' -> 'katta' AND 'large' -> 'katta'
    equiv_stmt = select(Word.english_word, Word.uzbek_translation).where(
        Word.user_id == user_id,
        Word.id != target_word.id,
    )
    user_words_res = await db.execute(equiv_stmt)
    for ow_en, ow_uz in user_words_res.all():
        ow_clean_en = clean_text(ow_en)
        ow_clean_uz = clean_text(ow_uz)
        if ow_clean_en == clean_in:
            # Check if this word's Uzbek translation matches or overlaps with target
            if (
                ow_clean_uz == clean_target_uz
                or ow_clean_uz in clean_target_uz
                or clean_target_uz in ow_clean_uz
            ):
                return (
                    True,
                    True,
                    f"To'g'ri! Lug'atingizdagi '{user_input.strip()}' so'zi ham '{target_word.uzbek_translation}' ma'nosiga ega (Asosiy so'z: {target_word.english_word}).",
                )

    # 4. Check common synonyms dictionary
    synonyms_for_target = COMMON_SYNONYMS.get(clean_target_en, set())
    if clean_in in synonyms_for_target:
        return (
            True,
            True,
            f"Ajoyib! '{user_input.strip()}' so'zi '{target_word.english_word}' ning to'g'ri sinonimi hisoblanadi.",
        )

    # Reverse lookup in common synonyms
    for canon, syn_set in COMMON_SYNONYMS.items():
        if (clean_in == canon or clean_in in syn_set) and (clean_target_en == canon or clean_target_en in syn_set):
            return (
                True,
                True,
                f"Ajoyib! '{user_input.strip()}' so'zi '{target_word.english_word}' ning to'g'ri sinonimi hisoblanadi.",
            )

    # 5. Fast translation cross-check via translation_service
    try:
        from app.services.translation_service import translation_service
        # Translate user's entered English word to Uzbek
        tr_uz = await translation_service.fast_translate(clean_in, "en", "uz")
        clean_tr_uz = clean_text(tr_uz)
        if clean_tr_uz and (
            clean_tr_uz == clean_target_uz
            or clean_tr_uz in clean_target_uz
            or clean_target_uz in clean_tr_uz
        ):
            return (
                True,
                True,
                f"To'g'ri! '{user_input.strip()}' ham '{target_word.uzbek_translation}' ma'nosini beradi (Asosiy so'z: {target_word.english_word}).",
            )
    except Exception:
        pass

    # No match found: Answer is incorrect
    return False, False, f"Noto'g'ri. To'g'ri javob: '{target_word.english_word}'"
