import {
  DashboardStats,
  DailyActivityChartPoint,
  DueWordReview,
  ImportPreviewResponse,
  MiniStory,
  ReviewResult,
  ReviewSubmission,
  StudyTimeSummary,
  User,
  WeakWord,
  Word,
  WordBatch,
  WordEnrichmentResult,
  LevelAssessment,
  ActivityHeatmapData,
  SpeakingSessionResponse,
  SpeakingPresetTopic,
  AnalyzeSpeakingResponse,
} from '../types';

const API_BASE = '/api/v1';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('smartvocab_token');
  }

  public setToken(token: string) {
    localStorage.setItem('smartvocab_token', token);
  }

  public clearToken() {
    localStorage.removeItem('smartvocab_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (endpoint !== '/auth/login' && endpoint !== '/auth/register') {
        this.clearToken();
        window.dispatchEvent(new Event('auth:unauthorized'));
        throw new Error("Sessiya muddati tugadi. Iltimos qayta kiring.");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Noto'g'ri email yoki parol kiritildi");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail || `Server xatosi: ${response.status}`;
      throw new Error(detail);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // --- Auth ---
  async login(email: string, pass: string): Promise<User> {
    const res = await this.request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    this.setToken(res.access_token);
    return this.getMe();
  }

  async register(data: { email: string; password: string; full_name?: string }): Promise<User> {
    const res = await this.request<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.access_token);
    return this.getMe();
  }

  async getMe(): Promise<User> {
    const raw = await this.request<any>('/auth/me');
    return {
      ...raw,
      preferred_cefr_level: raw.settings?.preferred_cefr_level || raw.preferred_cefr_level || 'B1',
      daily_words_goal: raw.settings?.daily_words_goal || raw.daily_words_goal || 10,
      daily_review_goal: raw.settings?.daily_review_goal || raw.daily_review_goal || 20,
      daily_study_time_minutes: raw.settings?.daily_study_time_minutes || raw.daily_study_time_minutes || 20,
      is_telegram_linked: Boolean(raw.is_telegram_linked || raw.telegram_username),
      telegram_username: raw.telegram_username,
    };
  }

  async updateProfile(data: any): Promise<any> {
    return this.request<any>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Analytics ---
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/analytics/dashboard');
  }

  async getWeeklyChart(): Promise<DailyActivityChartPoint[]> {
    return this.request<DailyActivityChartPoint[]>('/analytics/weekly-chart');
  }

  async getWeakWords(limit = 20, randomize = false): Promise<WeakWord[]> {
    return this.request<WeakWord[]>(`/analytics/weak-words?limit=${limit}&randomize=${randomize}`);
  }

  async getLevelAssessment(): Promise<LevelAssessment> {
    return this.request<LevelAssessment>('/analytics/level-assessment');
  }

  async getActivityHeatmap(days = 120): Promise<ActivityHeatmapData> {
    return this.request<ActivityHeatmapData>(`/analytics/activity-heatmap?days=${days}`);
  }

  // --- Reviews (SRS) ---
  async getDueReviews(): Promise<DueWordReview[]> {
    return this.request<DueWordReview[]>('/reviews/queue');
  }

  async submitReview(submission: ReviewSubmission): Promise<ReviewResult> {
    return this.request<ReviewResult>('/reviews/submit', {
      method: 'POST',
      body: JSON.stringify(submission),
    });
  }

  // --- Batches ---
  async getBatches(): Promise<WordBatch[]> {
    return this.request<WordBatch[]>('/batches');
  }

  async getBatchDetail(batchId: string): Promise<WordBatch> {
    return this.request<WordBatch>(`/batches/${batchId}`);
  }

  async createBatch(title: string, force_new = false): Promise<WordBatch> {
    return this.request<WordBatch>('/batches', {
      method: 'POST',
      body: JSON.stringify({ title, force_new }),
    });
  }

  async updateBatch(batchId: string, title: string): Promise<WordBatch> {
    return this.request<WordBatch>(`/batches/${batchId}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }

  async deleteBatch(batchId: string): Promise<void> {
    return this.request<void>(`/batches/${batchId}`, {
      method: 'DELETE',
    });
  }

  // --- Vocabulary ---
  async getWords(params?: {
    search?: string;
    batch_id?: string;
    is_weak?: boolean;
    is_mastered?: boolean;
    cefr_level?: string;
    skip?: number;
    limit?: number;
  }): Promise<Word[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.batch_id) query.append('batch_id', params.batch_id);
    if (params?.is_weak !== undefined) query.append('is_weak', String(params.is_weak));
    if (params?.is_mastered !== undefined) query.append('is_mastered', String(params.is_mastered));
    if (params?.cefr_level) query.append('cefr_level', params.cefr_level);
    if (params?.skip) query.append('skip', String(params.skip));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString();
    return this.request<Word[]>(`/vocabulary${qs ? `?${qs}` : ''}`);
  }

  async getMasteredPracticeWords(limit = 50): Promise<Word[]> {
    return this.request<Word[]>(`/vocabulary/mastered-practice?limit=${limit}`);
  }

  async getAllPracticeWords(limit = 50): Promise<Word[]> {
    return this.request<Word[]>(`/vocabulary/all-practice?limit=${limit}`);
  }

  async verifyAnswer(wordId: string, userAnswer: string): Promise<{
    is_correct: boolean;
    is_synonym_match: boolean;
    correct_english: string;
    correct_uzbek: string;
    explanation?: string;
  }> {
    return this.request('/vocabulary/verify-answer', {
      method: 'POST',
      body: JSON.stringify({ word_id: wordId, user_answer: userAnswer }),
    });
  }

  async createWord(data: {
    english_word: string;
    uzbek_translation: string;
    part_of_speech?: string;
    phonetic?: string;
    cefr_level?: string;
    notes?: string;
    batch_id?: string;
    examples?: { sentence_en: string; sentence_uz: string }[];
  }): Promise<Word> {
    return this.request<Word>('/vocabulary', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWord(id: string, data: Partial<Word>): Promise<Word> {
    return this.request<Word>(`/vocabulary/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWord(id: string): Promise<void> {
    return this.request<void>(`/vocabulary/${id}`, {
      method: 'DELETE',
    });
  }

  // --- AI Translations & Stories ---
  async enrichWord(englishWord: string, context?: string): Promise<WordEnrichmentResult> {
    return this.request<WordEnrichmentResult>('/translations/enrich', {
      method: 'POST',
      body: JSON.stringify({ english_word: englishWord, context }),
    });
  }

  async quickTranslate(text: string, source_lang = 'en', target_lang = 'uz') {
    return this.request<{ original_text: string; translated_text: string }>('/translations/quick', {
      method: 'POST',
      body: JSON.stringify({ text, source_lang, target_lang }),
    });
  }

  async generateStory(data: {
    cefr_level?: string;
    batch_id?: string;
    target_words?: string[];
  }): Promise<MiniStory> {
    return this.request<MiniStory>('/stories/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStories(params?: { limit?: number; cefr_level?: string; batch_id?: string }): Promise<MiniStory[]> {
    const query = new URLSearchParams();
    query.append('limit', String(params?.limit || 100));
    if (params?.cefr_level) query.append('cefr_level', params.cefr_level);
    if (params?.batch_id) query.append('batch_id', params.batch_id);
    const qs = query.toString();
    return this.request<MiniStory[]>(`/stories?${qs}`);
  }

  async deleteStory(id: string): Promise<void> {
    return this.request<void>(`/stories/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Imports ---
  async previewImport(file: File): Promise<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<ImportPreviewResponse>('/imports/preview', {
      method: 'POST',
      body: formData,
    });
  }

  async commitImport(
    file: File,
    options?: {
      en_column?: string;
      uz_column?: string;
      skip_duplicates?: boolean;
      fill_incomplete_batch?: boolean;
    }
  ) {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.en_column) formData.append('en_column', options.en_column);
    if (options?.uz_column) formData.append('uz_column', options.uz_column);
    formData.append('skip_duplicates', String(options?.skip_duplicates ?? true));
    formData.append('fill_incomplete_batch', String(options?.fill_incomplete_batch ?? true));

    return this.request<{
      message: string;
      total_imported: number;
      total_skipped_duplicates: number;
      batches_created: number;
      batches_updated: number;
    }>('/imports/commit', {
      method: 'POST',
      body: formData,
    });
  }

  // --- Study Sessions (Tracking) ---
  async startStudySession(activity_type = 'review'): Promise<{ session_id: string }> {
    return this.request<{ session_id: string }>('/study-sessions/start', {
      method: 'POST',
      body: JSON.stringify({ activity_type, source: 'web' }),
    });
  }

  async sendHeartbeat(sessionId: string): Promise<void> {
    return this.request<void>(`/study-sessions/${sessionId}/heartbeat`, {
      method: 'POST',
    });
  }

  async endStudySession(sessionId: string): Promise<void> {
    return this.request<void>(`/study-sessions/${sessionId}/end`, {
      method: 'POST',
    });
  }

  async getStudyTimeSummary(): Promise<StudyTimeSummary> {
    return this.request<StudyTimeSummary>('/study-sessions/summary');
  }

  // --- Telegram Link ---
  async getTelegramLinkToken(): Promise<{
    link_token: string;
    token?: string;
    bot_url?: string;
    bot_username?: string;
    expires_in_seconds?: number;
  }> {
    return this.request<{
      link_token: string;
      token?: string;
      bot_url?: string;
      bot_username?: string;
      expires_in_seconds?: number;
    }>('/telegram/link-token', { method: 'POST' });
  }

  async unlinkTelegram(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/telegram/unlink', {
      method: 'POST',
    });
  }

  // --- Speaking Coach ---
  async getSpeakingTopics(): Promise<SpeakingPresetTopic[]> {
    return this.request<SpeakingPresetTopic[]>('/speaking/topics');
  }

  async generateSpeakingSession(payload: {
    topic: string;
    cefr_level?: string;
    include_user_words?: boolean;
    sentence_count?: number;
  }): Promise<SpeakingSessionResponse> {
    return this.request<SpeakingSessionResponse>('/speaking/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async analyzeSpeakingAttempt(payload: {
    original_text: string;
    spoken_text: string;
    cefr_level?: string;
  }): Promise<AnalyzeSpeakingResponse> {
    return this.request<AnalyzeSpeakingResponse>('/speaking/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();
