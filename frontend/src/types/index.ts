export interface User {
  id: string;
  email: string;
  full_name?: string;
  telegram_username?: string;
  is_telegram_linked?: boolean;
  preferred_cefr_level?: string;
  daily_words_goal: number;
  daily_review_goal: number;
  daily_study_time_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface WordExample {
  id?: string;
  sentence_en: string;
  sentence_uz: string;
}

export interface WordProgress {
  repetition_number: number;
  ease_factor: number;
  interval_days: number;
  due_date: string;
  last_reviewed_at?: string;
  times_reviewed: number;
  times_correct: number;
  times_incorrect: number;
  is_mastered: boolean;
  is_weak: boolean;
}

export interface Word {
  id: string;
  english_word: string;
  uzbek_translation: string;
  part_of_speech?: string;
  phonetic?: string;
  audio_url?: string;
  cefr_level?: string;
  notes?: string;
  batch_id?: string;
  order_in_batch: number;
  created_at: string;
  updated_at: string;
  examples: WordExample[];
  progress?: WordProgress;
}

export interface WordBatch {
  id: string;
  batch_number: number;
  title: string;
  source_file_name?: string;
  status: string;
  word_count: number;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  due_count?: number;
  words?: Word[];
}

export interface DueWordReview {
  id: string;
  english_word: string;
  uzbek_translation: string;
  part_of_speech?: string;
  phonetic?: string;
  batch_id?: string;
  due_date: string;
  repetition_number: number;
  is_weak: boolean;
}

export interface ReviewSubmission {
  word_id: string;
  quality_rating: number; // 0 to 5
  review_source?: string;
  review_type?: string;
  user_answer?: string;
  time_spent_ms?: number;
}

export interface ReviewResult {
  word_id: string;
  is_correct: boolean;
  repetition_number: number;
  new_interval_days: number;
  new_ease_factor: number;
  new_due_date: string;
  is_mastered: boolean;
  is_weak: boolean;
}

export interface DailyActivityChartPoint {
  date: string;
  day_name: string;
  active_minutes: number;
  words_learned: number;
  words_reviewed: number;
}

export interface GoalProgress {
  daily_words_goal: number;
  words_learned_today: number;
  words_goal_percent: number;
  daily_review_goal: number;
  words_reviewed_today: number;
  review_goal_percent: number;
  daily_study_time_minutes: number;
  study_time_minutes_today: number;
  study_time_goal_percent: number;
  daily_mastered_goal?: number;
  mastered_reviewed_today?: number;
  mastered_goal_percent?: number;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  description: string;
  created_at: string;
  is_success?: boolean;
}

export interface ActivityHeatmapDay {
  date: string;
  count: number;
  words_learned: number;
  words_reviewed: number;
  active_minutes: number;
  level: number; // 0, 1, 2, 3, 4
}

export interface ActivityHeatmapData {
  total_active_days: number;
  current_streak: number;
  longest_streak: number;
  total_contributions: number;
  days: ActivityHeatmapDay[];
}

export interface DashboardStats {
  total_words: number;
  words_due_today: number;
  words_learned_today: number;
  words_reviewed_today: number;
  words_mastered: number;
  words_weak: number;
  streak_days: number;
  today_study_time_seconds: number;
  today_study_time_minutes: number;
  total_study_time_minutes: number;
  overall_accuracy_percent: number;
  goals: GoalProgress;
  weekly_chart: DailyActivityChartPoint[];
  recent_activities: RecentActivityItem[];
  suggested_action: string;
  is_first_time_user: boolean;
  mastered_practice_words_available?: number;
}

export interface WeakWord {
  id: string;
  english_word: string;
  uzbek_translation: string;
  part_of_speech?: string;
  phonetic?: string;
  cefr_level?: string;
  times_reviewed: number;
  times_incorrect: number;
  accuracy_percent: number;
  last_reviewed_at?: string;
  repetition_number?: number;
  is_mastered?: boolean;
}

export interface ComprehensionQuestion {
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
}

export interface MiniStory {
  id?: string;
  title_en: string;
  title_uz: string;
  content_en: string;
  content_uz: string;
  cefr_level?: string;
  batch_id?: string;
  used_target_words: string[];
  comprehension_questions: ComprehensionQuestion[];
  created_at?: string;
}

export interface WordEnrichmentResult {
  uzbek_translation: string;
  part_of_speech: string;
  phonetic: string;
  cefr_level: string;
  examples: { sentence_en: string; sentence_uz: string }[];
  notes: string;
}

export interface ImportPreviewRow {
  english_word: string;
  uzbek_translation: string;
  is_duplicate: boolean;
  is_valid: boolean;
  error_message?: string;
}

export interface ImportPreviewResponse {
  file_name: string;
  file_type: string;
  total_detected_rows: number;
  valid_rows_count: number;
  duplicate_candidates_count: number;
  detected_en_column?: string;
  detected_uz_column?: string;
  preview_rows: ImportPreviewRow[];
  batches_to_create: number;
}

export interface StudyTimeSummary {
  today_active_seconds: number;
  today_active_minutes: number;
  weekly_active_seconds: number;
  weekly_active_minutes: number;
  total_active_seconds: number;
  total_active_hours: number;
}

export interface CefrMilestone {
  level: string;
  target_words: number;
  words_remaining: number;
  days_remaining: number;
  months_remaining: number;
  projected_date: string;
  is_achieved: boolean;
  status: 'completed' | 'in_progress' | 'upcoming';
}

export interface LevelAssessment {
  estimated_cefr_level: string;
  confidence_score: number;
  total_vocabulary_count: number;
  level_breakdown: Record<string, number>;
  assessed_at: string;
  recommendations: string[];
  next_cefr_level?: string;
  progress_percent?: number;
  words_to_next_level?: number;
  words_mastered?: number;
  daily_learning_pace?: number;
  milestones?: CefrMilestone[];
  forecast_summary?: string;
}

// --- Speaking Coach Interfaces ---
export interface SpeakingSentenceItem {
  id: number;
  text_en: string;
  text_uz: string;
  phonetic_tips?: string;
  target_words: string[];
}

export interface VocabularyHighlightItem {
  word: string;
  translation_uz: string;
  pronunciation?: string;
  tip?: string;
}

export interface SpeakingSessionResponse {
  topic: string;
  cefr_level: string;
  title: string;
  overview_uz: string;
  full_text_en: string;
  sentences: SpeakingSentenceItem[];
  vocabulary_highlights: VocabularyHighlightItem[];
}

export interface SpeakingPresetTopic {
  id: string;
  title: string;
  prompt: string;
  recommended_level: string;
  icon: string;
}

export interface WordComparisonItem {
  word: string;
  status: 'correct' | 'mispronounced' | 'missed';
  spoken_word?: string;
}

export interface AnalyzeSpeakingResponse {
  accuracy_score: number;
  feedback_uz: string;
  word_comparisons: WordComparisonItem[];
  suggestions: string[];
}
