from typing import List, Optional
from pydantic import BaseModel, Field


class SpeakingSentenceItem(BaseModel):
    id: int = Field(description="Sentence sequence ID starting at 1")
    text_en: str = Field(description="English sentence for speaking practice")
    text_uz: str = Field(description="Uzbek translation of the sentence")
    phonetic_tips: Optional[str] = Field(
        default=None,
        description="Pronunciation tips for challenging sounds or intonation in this sentence",
    )
    target_words: List[str] = Field(
        default_factory=list,
        description="Important vocabulary featured in this sentence",
    )


class VocabularyHighlightItem(BaseModel):
    word: str = Field(description="English word")
    translation_uz: str = Field(description="Uzbek translation")
    pronunciation: Optional[str] = Field(default=None, description="IPA or phonetic guide")
    tip: Optional[str] = Field(default=None, description="Usage note or advice")


class GenerateSpeakingRequest(BaseModel):
    topic: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Speaking topic or situation (e.g., 'Job Interview', 'Ordering food in a cafe')",
    )
    cefr_level: str = Field(
        default="B1",
        description="Target CEFR proficiency level (A1, A2, B1, B2, C1, C2)",
    )
    include_user_words: bool = Field(
        default=True,
        description="Whether to incorporate recent or weak vocabulary from user's bank",
    )
    sentence_count: int = Field(
        default=5,
        ge=3,
        le=10,
        description="Target sentence count",
    )


class SpeakingSessionResponse(BaseModel):
    topic: str = Field(description="Topic practiced")
    cefr_level: str = Field(description="CEFR Level")
    title: str = Field(description="Title of the speaking monologue or scenario")
    overview_uz: str = Field(description="Uzbek overview explaining the scenario and context")
    full_text_en: str = Field(description="Complete English speech text")
    sentences: List[SpeakingSentenceItem] = Field(
        default_factory=list,
        description="List of ordered sentences with translations and phonetic tips",
    )
    vocabulary_highlights: List[VocabularyHighlightItem] = Field(
        default_factory=list,
        description="Highlighted key vocabulary with translations and pronunciation advice",
    )


class AnalyzeSpeakingAttemptRequest(BaseModel):
    original_text: str = Field(..., min_length=1, description="Original reference sentence")
    spoken_text: str = Field(..., min_length=1, description="Text recognized from user's speech")
    cefr_level: Optional[str] = Field(default="B1", description="Current CEFR level")


class WordComparisonItem(BaseModel):
    word: str = Field(description="Word token from reference text")
    status: str = Field(description="'correct', 'mispronounced', 'missed'")
    spoken_word: Optional[str] = Field(default=None, description="What the user actually said")


class AnalyzeSpeakingAttemptResponse(BaseModel):
    accuracy_score: float = Field(
        ..., ge=0.0, le=100.0, description="Pronunciation accuracy percentage (0-100)"
    )
    feedback_uz: str = Field(description="Encouraging feedback in Uzbek with actionable tips")
    word_comparisons: List[WordComparisonItem] = Field(
        default_factory=list, description="Word-by-word comparison markers"
    )
    suggestions: List[str] = Field(
        default_factory=list, description="Specific pronunciation tips for words that were missed"
    )
