import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Flame,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileUp,
  PlusCircle,
  Brain,
  Layers,
  ChevronRight,
  Calendar,
  PenTool,
  Trophy,
  Zap,
  Target,
  Mic,
} from 'lucide-react';
import { api } from '../api/client';
import { DashboardStats, LevelAssessment } from '../types';
import { LevelGrowthCard } from '../components/analytics/LevelGrowthCard';
import { ActivityHeatmap } from '../components/analytics/ActivityHeatmap';

interface DashboardProps {
  onStartReview: () => void;
  onOpenAddWord: () => void;
  onOpenImport: () => void;
  onNavigateToBatches: () => void;
  onNavigateToWeakWords: () => void;
  onNavigateToStories: () => void;
  onNavigateToMasteredWords?: () => void;
  onNavigateToWords?: () => void;
  onNavigateToSpeaking?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartReview,
  onOpenAddWord,
  onOpenImport,
  onNavigateToBatches,
  onNavigateToWeakWords,
  onNavigateToStories,
  onNavigateToMasteredWords,
  onNavigateToWords,
  onNavigateToSpeaking,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [levelAssessment, setLevelAssessment] = useState<LevelAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [data, levelData] = await Promise.all([
        api.getDashboardStats(),
        api.getLevelAssessment().catch(() => null),
      ]);
      setStats(data);
      setLevelAssessment(levelData);
    } catch (err: any) {
      setError(err.message || "Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Time-based greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Xayrli tong', icon: '🌅' };
    if (hour >= 12 && hour < 18) return { text: 'Xayrli kun', icon: '☀️' };
    if (hour >= 18 && hour < 23) return { text: 'Xayrli kech', icon: '🌙' };
    return { text: 'Xayrli tun', icon: '🌌' };
  };

  // Uzbek formatted date
  const todayFormatted = new Date().toLocaleDateString('uz-UZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="p-6 sm:p-10 space-y-8 animate-pulse max-w-7xl mx-auto">
        <div className="h-28 rounded-3xl bg-dark-900 border border-dark-800" />
        <div className="h-52 rounded-3xl bg-dark-900 border border-dark-800" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-dark-900 border border-dark-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-rose-400 text-sm">{error || "Xatolik yuz berdi"}</p>
        <button
          onClick={fetchStats}
          className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow-brand transition-all"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  const { goals, weekly_chart, recent_activities } = stats;
  const greeting = getGreeting();

  return (
    <div className="p-3.5 sm:p-6 lg:p-10 space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-16 sm:pb-24">
      {/* Top Welcome & Motivational Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl">{greeting.icon}</span>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              {greeting.text}, do'stim!
            </h1>
            {stats.streak_days > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm animate-pulse">
                <Flame className="w-3.5 h-3.5 fill-amber-400" /> {stats.streak_days} kunlik seriya!
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="capitalize">{todayFormatted}</span>
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-brand-300 font-medium">SmartVocab AI Intelligence</span>
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenAddWord}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700/80 hover:border-brand-500/40 text-slate-200 text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-brand-400" />
            <span>Yangi so'z</span>
          </button>
          <button
            onClick={onOpenImport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all active:scale-95"
          >
            <FileUp className="w-4 h-4" />
            <span>Fayl yuklash</span>
          </button>
        </div>
      </div>

      {/* Primary Study / Review Card */}
      {stats.is_first_time_user || stats.total_words === 0 ? (
        <div className="p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-brand-950 via-dark-900 to-accent-violet/15 border border-brand-500/35 relative overflow-hidden shadow-2xl">
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Xush kelibsiz!
            </span>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              SmartVocab AI — Shaxsiy intellektual lug'at platformangiz
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              So'zlarni shunchaki yodlamang — Spaced Repetition (SRS SM-2) algoritmi va Google Gemini yordamida uzoq muddatli xotirangizga muhrlang. Boshlash uchun dastlabki so'zlaringizni import qiling yoki qo'lda kiriting!
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-2">
              <button
                onClick={onOpenImport}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold shadow-glow-brand transition-all active:scale-95"
              >
                <FileUp className="w-4 h-4" />
                <span>Lug'at faylini yuklash (TXT, CSV, XLSX)</span>
              </button>
              <button
                onClick={onOpenAddWord}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-200 text-xs sm:text-sm font-semibold transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4 text-brand-400" />
                <span>Yangi so'z kiritish</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-7 lg:p-9 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-dark-900 via-dark-850 to-brand-950/50 border border-brand-500/35 relative overflow-hidden shadow-2xl">
          {/* Ambient radial lighting */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-accent-violet/15 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 sm:gap-6 relative z-10">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-500/20 text-brand-300 border border-brand-500/35 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Spaced Repetition (SRS SM-2)
                </span>
                {stats.words_due_today > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Navbatda kutmoqda
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Kunlik vazifa bajarildi
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
                {stats.words_due_today > 0 ? (
                  <>
                    Bugun takrorlash uchun{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-cyan font-mono underline decoration-brand-500/50">
                      {stats.words_due_today} ta so'z
                    </span>{' '}
                    tayyor!
                  </>
                ) : (
                  <>Bugungi barcha takrorlashlar muvaffaqiyatli yakunlandi! 🎉</>
                )}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {stats.suggested_action}
              </p>
            </div>

            {/* Action Button */}
            <div className="w-full sm:w-auto flex items-center gap-3 shrink-0">
              {stats.words_due_today > 0 ? (
                <button
                  onClick={onStartReview}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-brand-600 via-accent-violet to-brand-600 hover:from-brand-500 hover:to-accent-violet text-white text-xs sm:text-sm font-extrabold shadow-glow-brand transition-all active:scale-95 group"
                >
                  <PenTool className="w-4 sm:w-5 h-4 sm:h-5 text-brand-200 group-hover:rotate-12 transition-transform" />
                  <span>Hozir takrorlashni boshlash</span>
                  <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={onNavigateToStories}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl sm:rounded-2xl bg-dark-800 hover:bg-dark-750 border border-brand-500/40 text-brand-300 hover:text-white text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <Brain className="w-4 h-4 text-brand-400" />
                    <span>Mini Hikoya o'qish</span>
                  </button>
                  <button
                    onClick={onStartReview}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl sm:rounded-2xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-300 text-xs font-semibold transition-all"
                  >
                    <span>Erkin mashq</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Metrics Cards (4 Columns) with rich glowing gradients */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {/* Total Words Card */}
        <div
          onClick={onNavigateToWords}
          className="p-3.5 sm:p-5 lg:p-6 rounded-2xl bg-gradient-to-br from-dark-900 via-dark-850 to-dark-900 border border-dark-800/90 hover:border-brand-500/50 transition-all duration-300 shadow-lg cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300">Jami so'zlar</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 group-hover:scale-110 transition-transform">
              <BookOpen className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">{stats.total_words}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex items-center justify-between truncate">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" /> 20 talik to'plamlarda
            </span>
            <span className="text-brand-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Bank <ChevronRight className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* Mastered Words Card */}
        <div
          onClick={onNavigateToMasteredWords}
          className="p-3.5 sm:p-5 lg:p-6 rounded-2xl bg-gradient-to-br from-dark-900 via-dark-850 to-dark-900 border border-dark-800/90 hover:border-emerald-500/50 transition-all duration-300 shadow-lg cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300">O'zlashtirilgan</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">{stats.words_mastered}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Aniqlik: {stats.overall_accuracy_percent}%</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Ko'rish <ChevronRight className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* Weak Words Card */}
        <div
          onClick={onNavigateToWeakWords}
          className="p-3.5 sm:p-5 lg:p-6 rounded-2xl bg-gradient-to-br from-dark-900 via-dark-850 to-dark-900 border border-dark-800/90 hover:border-rose-500/50 transition-all duration-300 shadow-lg cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300">Zaif so'zlar</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">{stats.words_weak}</p>
          <p className="text-[10px] sm:text-[11px] text-rose-400 font-semibold mt-1 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Mashq qilish</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </p>
        </div>

        {/* Active Study Time Card */}
        <div className="p-3.5 sm:p-5 lg:p-6 rounded-2xl bg-gradient-to-br from-dark-900 via-dark-850 to-dark-900 border border-dark-800/90 hover:border-cyan-500/40 transition-all duration-300 shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300">Bugungi vaqt</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-accent-cyan group-hover:scale-110 transition-transform">
              <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-accent-cyan tracking-tight font-mono">
            {stats.today_study_time_minutes}{' '}
            <span className="text-xs sm:text-sm font-sans font-normal text-slate-400">daqiqa</span>
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>Jami:</span>
            <span className="text-slate-300 font-bold">{(stats.total_study_time_minutes / 60).toFixed(1)} soat</span>
          </p>
        </div>
      </div>


      {/* Level Growth, CEFR Milestone Forecast & Speed Simulator */}
      <LevelGrowthCard assessment={levelAssessment} />

      {/* GitHub-Style Learning Activity Heatmap */}
      <ActivityHeatmap initialDays={180} />

      {/* Quick Interactive Study Modes Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-extrabold text-white tracking-tight">
              Tezkor Mashg'ulot Turlari
            </h3>
          </div>
          <span className="text-xs text-slate-400">Kerakli bo'limni tanlang</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* AI Speaking Coach */}
          <div
            onClick={onNavigateToSpeaking}
            className="p-5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-emerald-500/50 hover:bg-dark-850/80 transition-all cursor-pointer group shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-emerald-300 transition-colors">
              AI Speaking (Talaffuz)
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Mavzu tanlang, gapiring va real vaqtda talaffuzingizni baholang.
            </p>
          </div>

          {/* Reverse Recall / Typed Recall */}
          <div
            onClick={onStartReview}
            className="p-5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-brand-500/50 hover:bg-dark-850/80 transition-all cursor-pointer group shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <PenTool className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-brand-300 transition-colors">
              Yozma Mashq (Spelling)
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              O'zbekcha tarjimasi beriladi, inglizchasini to'g'ri yozib xotirani charxlaysiz.
            </p>
          </div>

          {/* AI Stories */}
          <div
            onClick={onNavigateToStories}
            className="p-5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-violet-500/50 hover:bg-dark-850/80 transition-all cursor-pointer group shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Brain className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-violet-300 transition-colors">
              AI Mini Hikoyalar
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Yodlagan so'zlaringiz asosida Gemini AI yaratgan qiziqarli hikoyalarni o'qing.
            </p>
          </div>

          {/* Batches 20-words */}
          <div
            onClick={onNavigateToBatches}
            className="p-5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-cyan-500/50 hover:bg-dark-850/80 transition-all cursor-pointer group shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-accent-cyan flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-cyan-300 transition-colors">
              20 talik To'plamlar
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Barcha so'zlaringiz tartibli 20 talik bloklarda to'plangan va nazoratda.
            </p>
          </div>

          {/* Weak Words Practice */}
          <div
            onClick={onNavigateToWeakWords}
            className="p-5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-rose-500/50 hover:bg-dark-850/80 transition-all cursor-pointer group shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-rose-300 transition-colors">
              Zaif So'zlarni Qaytarish
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Xato qilingan yoki unutilayotgan so'zlarni maxsus qayta mustahkamlash.
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Weekly Activity Chart & Daily Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Activity Bar Chart */}
        <div className="lg:col-span-2 p-6 sm:p-7 rounded-3xl bg-dark-900 border border-dark-800/90 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <h4 className="text-sm font-extrabold text-white">So'nggi 7 kunlik faoliyat</h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">Haqiqiy faol daqiqalar</span>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 px-2">
            {weekly_chart.map((day, idx) => {
              const maxMinutes = Math.max(...weekly_chart.map((d) => d.active_minutes), 30);
              const heightPercent = Math.min(100, Math.round((day.active_minutes / maxMinutes) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.active_minutes}m
                  </div>
                  <div className="w-full bg-dark-950/80 rounded-xl h-32 flex items-end overflow-hidden p-0.5 border border-dark-800">
                    <div
                      style={{ height: `${Math.max(8, heightPercent)}%` }}
                      className={`w-full rounded-lg transition-all duration-500 ${
                        day.active_minutes > 0
                          ? 'bg-gradient-to-t from-brand-600 via-accent-violet to-cyan-400 group-hover:brightness-110 shadow-sm'
                          : 'bg-dark-800'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{day.day_name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Goals Completion */}
        <div className="p-6 sm:p-7 rounded-3xl bg-dark-900 border border-dark-800/90 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-white">Bugungi maqsadlar</h4>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>

          <div className="space-y-4">
            {/* Words Goal */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Yangi so'zlar:</span>
                <span className="font-bold text-slate-200 font-mono">
                  {goals.words_learned_today} / {goals.daily_words_goal}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-dark-950 p-0.5 border border-dark-800 overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, goals.words_goal_percent)}%` }}
                  className="h-full bg-gradient-to-r from-brand-600 to-accent-violet rounded-full transition-all duration-500"
                />
              </div>
            </div>

            {/* Review Goal */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Takrorlashlar:</span>
                <span className="font-bold text-slate-200 font-mono">
                  {goals.words_reviewed_today} / {goals.daily_review_goal}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-dark-950 p-0.5 border border-dark-800 overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, goals.review_goal_percent)}%` }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-500"
                />
              </div>
            </div>

            {/* Study Time Goal */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">O'qish vaqti:</span>
                <span className="font-bold text-slate-200 font-mono">
                  {goals.study_time_minutes_today} / {goals.daily_study_time_minutes} daqiqa
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-dark-950 p-0.5 border border-dark-800 overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, goals.study_time_goal_percent)}%` }}
                  className="h-full bg-gradient-to-r from-cyan-600 to-sky-400 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-dark-800">
            <button
              onClick={onNavigateToBatches}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-dark-750 text-xs font-bold text-brand-300 hover:text-white transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-400" />
                <span>Mening 20 talik to'plamlarim</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      {recent_activities.length > 0 && (
        <div className="p-6 sm:p-7 rounded-3xl bg-dark-900 border border-dark-800/90 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-white">So'nggi o'quv faoliyati</h4>
            <span className="text-xs text-slate-500">Jonli oqim</span>
          </div>

          <div className="divide-y divide-dark-800/80">
            {recent_activities.slice(0, 5).map((act) => (
              <div key={act.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      act.is_success === false ? 'bg-rose-500' : 'bg-emerald-400 shadow-sm'
                    }`}
                  />
                  <p className="text-xs text-slate-200 font-medium">{act.description}</p>
                </div>
                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
