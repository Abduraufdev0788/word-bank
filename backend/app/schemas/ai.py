import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# --- Word Enrichment & Translation ---

class WordExampleSchema(BaseModel):
    sentence_en: str = Field(description="English example sentence")
    sentence_uz: str = Field(description="Uzbek translation of the sentence")


class WordEnrichmentResponse(BaseModel):
    uzbek_translation: str = Field(description="Primary Uzbek translation")
    part_of_speech: str = Field(description="noun, verb, adjective, adverb, phrase, etc.")
    phonetic: str = Field(default="", description="IPA phonetic transcription, e.g. /ˈæp.əl/")
    cefr_level: str = Field(default="B1", description="Estimated CEFR level: A1, A2, B1, B2, C1, or C2")
    examples: List[WordExampleSchema] = Field(
        default_factory=list,
        description="List of 2 or 3 high quality example sentences with Uzbek translations",
    )
    notes: str = Field(default="", description="Helpful nuance or cultural note in Uzbek")


class WordEnrichmentRequest(BaseModel):
    english_word: str = Field(min_length=1, max_length=150, description="English word or phrase to enrich")
    context: Optional[str] = Field(default=None, max_length=500, description="Optional context or usage clue")


class QuickTranslationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000, description="Text to translate")
    source_lang: str = Field(default="en", description="Source language code ('en' or 'uz')")
    target_lang: str = Field(default="uz", description="Target language code ('uz' or 'en')")


class QuickTranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str


# --- Mini Story & Comprehension ---

class ComprehensionQuestionSchema(BaseModel):
    question: str = Field(description="Comprehension question in English or Uzbek")
    options: List[str] = Field(min_length=4, max_length=4, description="4 multiple choice options")
    correct_option_index: int = Field(ge=0, le=3, description="0-indexed position of correct answer (0, 1, 2, or 3)")
    explanation: str = Field(description="Short explanation why this answer is correct")


class MiniStoryResponse(BaseModel):
    title_en: str = Field(description="English title for the story")
    title_uz: str = Field(description="Uzbek translation of the title")
    content_en: str = Field(description="English story text incorporating all target words")
    content_uz: str = Field(description="Natural, accurate Uzbek translation of the story")
    used_target_words: List[str] = Field(description="List of target words integrated into the story")
    comprehension_questions: List[ComprehensionQuestionSchema] = Field(
        min_length=3,
        description="3 comprehension check questions",
    )


class StoryGenerateRequest(BaseModel):
    batch_id: Optional[uuid.UUID] = Field(default=None, description="Batch to generate story from (fetches its words)")
    words: Optional[List[str]] = Field(default=None, description="Custom list of English words (if not using batch_id)")
    cefr_level: str = Field(default="B1", description="Target CEFR level: A1, A2, B1, B2, C1, C2")

    @field_validator("cefr_level")
    @classmethod
    def validate_cefr(cls, v: str) -> str:
        valid = ["A1", "A2", "B1", "B2", "C1", "C2"]
        v_upper = v.upper().strip()
        if v_upper not in valid:
            raise ValueError(f"CEFR level must be one of {valid}")
        return v_upper


class MiniStoryOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    batch_id: Optional[uuid.UUID]
    cefr_level: str
    title_en: str
    title_uz: str
    content_en: str
    content_uz: str
    target_words: List[str]
    comprehension_questions: List[ComprehensionQuestionSchema]
    created_at: datetime

    model_config = {"from_attributes": True}
