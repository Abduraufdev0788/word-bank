import uuid
from datetime import date, datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class DailyActivityChartPoint(BaseModel):
    date: str
    day_name: str
    active_minutes: int
    words_learned: int
    words_reviewed: int


class GoalProgressOut(BaseModel):
    daily_words_goal: int
    words_learned_today: int
    words_goal_percent: float
    daily_review_goal: int
    words_reviewed_today: int
    review_goal_percent: float
    daily_study_time_minutes: int
    study_time_minutes_today: int
    study_time_goal_percent: float
    daily_mastered_goal: int = 50
    mastered_reviewed_today: int = 0
    mastered_goal_percent: float = 0.0


class RecentActivityItem(BaseModel):
    id: uuid.UUID
    type: str  # 'review', 'add_word', 'quiz'
    description: str
    created_at: datetime
    is_success: Optional[bool] = None


class DashboardStatsOut(BaseModel):
    total_words: int
    words_due_today: int
    words_learned_today: int
    words_reviewed_today: int
    words_mastered: int
    words_weak: int
    streak_days: int
    today_study_time_seconds: int
    today_study_time_minutes: int
    total_study_time_minutes: int
    overall_accuracy_percent: float
    goals: GoalProgressOut
    weekly_chart: List[DailyActivityChartPoint]
    recent_activities: List[RecentActivityItem]
    suggested_action: str
    is_first_time_user: bool
    mastered_practice_words_available: int = 0


class WeakWordOut(BaseModel):
    id: uuid.UUID
    english_word: str
    uzbek_translation: str
    part_of_speech: Optional[str] = None
    phonetic: Optional[str] = None
    cefr_level: Optional[str] = None
    times_reviewed: int
    times_incorrect: int
    accuracy_percent: float
    last_reviewed_at: Optional[datetime] = None
    repetition_number: int = 0
    is_mastered: bool = False


class CefrMilestoneOut(BaseModel):
    level: str
    target_words: int
    words_remaining: int
    days_remaining: int
    months_remaining: float
    projected_date: str
    is_achieved: bool
    status: str  # "completed" | "in_progress" | "upcoming"


class LevelAssessmentOut(BaseModel):
    estimated_cefr_level: str
    confidence_score: float
    total_vocabulary_count: int
    level_breakdown: Dict[str, int]
    assessed_at: datetime
    recommendations: List[str]
    next_cefr_level: Optional[str] = "A2"
    progress_percent: float = 0.0
    words_to_next_level: int = 0
    words_mastered: int = 0
    daily_learning_pace: float = 10.0
    milestones: List[CefrMilestoneOut] = []
    forecast_summary: Optional[str] = None


class ActivityHeatmapDay(BaseModel):
    date: str  # YYYY-MM-DD
    count: int
    words_learned: int
    words_reviewed: int
    active_minutes: int
    level: int  # 0: 0, 1: 1-5, 2: 6-15, 3: 16-30, 4: >30


class ActivityHeatmapOut(BaseModel):
    total_active_days: int
    current_streak: int
    longest_streak: int
    total_contributions: int
    days: List[ActivityHeatmapDay]

