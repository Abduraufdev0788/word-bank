import React, { useState } from 'react';
import {
  Trophy,
  Zap,
  TrendingUp,
  CheckCircle,
  Sparkles,
  Info,
  Calendar,
  Rocket,
  Target,
  Gauge,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { LevelAssessment } from '../../types';

interface LevelGrowthCardProps {
  assessment: LevelAssessment | null;
  loading?: boolean;
}

const CEFR_CONFIG: Record<
  string,
  { label: string; name: string; color: string; badgeBg: string; textGradient: string }
> = {
  A1: {
    label: 'A1',
    name: "Boshlang'ich (Beginner)",
    color: 'from-emerald-500 to-teal-600',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    textGradient: 'from-emerald-400 to-teal-300',
  },
  A2: {
    label: 'A2',
    name: 'Elementar (Elementary)',
    color: 'from-cyan-500 to-sky-600',
    badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    textGradient: 'from-cyan-400 to-sky-300',
  },
  B1: {
    label: 'B1',
    name: "O'rta (Intermediate)",
    color: 'from-brand-500 to-accent-violet',
    badgeBg: 'bg-brand-500/20 border-brand-500/40 text-brand-300',
    textGradient: 'from-brand-400 to-accent-violet',
  },
  B2: {
    label: 'B2',
    name: "Yuqori O'rta (Upper-Intermediate)",
    color: 'from-purple-500 to-pink-600',
    badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
    textGradient: 'from-purple-400 to-pink-300',
  },
  C1: {
    label: 'C1',
    name: 'Ilgari (Advanced)',
    color: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    textGradient: 'from-amber-400 to-orange-300',
  },
  C2: {
    label: 'C2',
    name: 'Mukammal (Proficient / Mastery)',
    color: 'from-rose-500 to-red-600',
    badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    textGradient: 'from-rose-400 to-red-300',
  },
};

const PACE_PRESETS = [
  { value: 5, label: '5 ta/kun', speed: 'Xotirjam' },
  { value: 10, label: '10 ta/kun', speed: 'Optimal' },
  { value: 15, label: '15 ta/kun', speed: 'Faol' },
  { value: 20, label: '20 ta/kun', speed: 'Intensiv' },
  { value: 30, label: '30 ta/kun', speed: 'Tezkor 🚀' },
];

export const LevelGrowthCard: React.FC<LevelGrowthCardProps> = ({ assessment, loading }) => {
  const initialPace = assessment?.daily_learning_pace ? Math.round(assessment.daily_learning_pace) : 10;
  const [selectedPace, setSelectedPace] = useState<number>(initialPace);

  if (loading) {
    return (
      <div className="p-7 rounded-3xl bg-dark-900 border border-dark-800 animate-pulse space-y-5">
        <div className="h-6 w-52 bg-dark-800 rounded-md" />
        <div className="h-24 bg-dark-800/60 rounded-2xl" />
        <div className="h-44 bg-dark-800/40 rounded-2xl" />
      </div>
    );
  }

  if (!assessment) return null;

  const currentLevelKey = assessment.estimated_cefr_level || 'A1';
  const currentConfig = CEFR_CONFIG[currentLevelKey] || CEFR_CONFIG['A1'];
  const nextLevelKey = assessment.next_cefr_level || 'A2';
  const progressPct = assessment.progress_percent ?? 0;
  const wordsToNext = assessment.words_to_next_level ?? 0;
  const confidencePercent = Math.round((assessment.confidence_score || 0.5) * 100);

  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // Base milestones configuration
  const defaultMilestones = [
    { level: 'A2', target_words: 150 },
    { level: 'B1', target_words: 400 },
    { level: 'B2', target_words: 900 },
    { level: 'C1', target_words: 1800 },
    { level: 'C2', target_words: 3500 },
  ];

  // Dynamic projection based on selected pace
  const projectedMilestones = defaultMilestones.map((m) => {
    const totalWords = assessment.total_vocabulary_count || 0;
    const isAchieved = totalWords >= m.target_words;
    const wordsRemaining = Math.max(0, m.target_words - totalWords);
    const pace = Math.max(1, selectedPace);
    const daysRemaining = isAchieved ? 0 : Math.ceil(wordsRemaining / pace);
    const monthsRemaining = isAchieved ? 0 : +(daysRemaining / 30).toFixed(1);

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysRemaining);

    return {
      level: m.level,
      target_words: m.target_words,
      words_remaining: wordsRemaining,
      days_remaining: daysRemaining,
      months_remaining: monthsRemaining,
      target_date: targetDate,
      is_achieved: isAchieved,
      status: isAchieved ? 'completed' : wordsRemaining === wordsToNext ? 'in_progress' : 'upcoming',
    };
  });

  const nextMilestone = projectedMilestones.find((m) => !m.is_achieved);

  return (
    <div className="p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-dark-900 via-dark-850 to-dark-950 border border-dark-750/90 shadow-2xl space-y-6 sm:space-y-8 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-accent-violet/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header: Title + Current Level Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-xl font-black text-white tracking-tight flex flex-wrap items-center gap-2">
                O'sish Dinamikasi & Kelajak Prognozi
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  AI Spaced Repetition
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Hozirgi o'rganish sur'atingiz orqali qancha muddatda qaysi darajaga yetishingiz bashorati
              </p>
            </div>
          </div>
        </div>

        {/* Current CEFR Level Pill */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl border flex items-center gap-2.5 shadow-lg backdrop-blur-md ${currentConfig.badgeBg}`}
          >
            <Trophy className="w-4 sm:w-5 h-4 sm:h-5 animate-pulse" />
            <div className="text-left">
              <span className="text-xs font-black uppercase tracking-wider block">
                {currentLevelKey} DARAGASI
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium opacity-90 block">
                {currentConfig.name.split(' ')[0]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Progress Card: Towards Next Level */}
      <div className="p-4 sm:p-6 rounded-2xl bg-dark-950/70 border border-dark-800/90 space-y-3 relative z-10 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white flex items-center gap-1.5 text-xs sm:text-sm">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              {currentLevelKey}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-extrabold text-brand-300 text-xs sm:text-sm flex items-center gap-1.5">
              <Target className="w-4 h-4 text-brand-400" />
              {nextLevelKey} marrasiga intilish
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 font-mono">
            <span className="text-xs font-black text-brand-400 bg-brand-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-brand-500/20">
              {progressPct}% tayyor
            </span>
            {wordsToNext > 0 && (
              <span className="text-[11px] sm:text-xs text-slate-400">
                (yana <strong className="text-white font-bold">{wordsToNext}</strong> ta so'z)
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Gradient Bar */}
        <div className="h-3 sm:h-3.5 w-full bg-dark-800/80 rounded-full overflow-hidden p-0.5 border border-dark-750/70 shadow-inner">
          <div
            style={{ width: `${Math.min(100, Math.max(6, progressPct))}%` }}
            className={`h-full rounded-full bg-gradient-to-r ${currentConfig.color} transition-all duration-1000 shadow-glow-brand`}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-slate-500 font-mono">
          <span>0 so'z</span>
          <span className="text-slate-300 font-semibold truncate px-1">
            Lug'atingiz: {assessment.total_vocabulary_count} ta
          </span>
          <span className="text-brand-300">{nextLevelKey}</span>
        </div>
      </div>

      {/* Interactive Pace Simulator & CEFR Timeline Forecaster */}
      <div className="space-y-4 relative z-10 pt-1 sm:pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent-cyan" />
            <h4 className="text-sm font-extrabold text-white tracking-tight">
              Kelajak Bashorati: Qachon qaysi darajaga chiqasiz?
            </h4>
          </div>

          {/* Interactive Speed Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-dark-950/80 p-1 rounded-xl border border-dark-800 self-start md:self-auto">
            <span className="text-[11px] text-slate-400 px-1.5 font-medium">Tezlik:</span>
            {PACE_PRESETS.map((p) => {
              const isActive = selectedPace === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => setSelectedPace(p.value)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-accent-violet text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800'
                  }`}
                  title={p.speed}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Milestones Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
          {projectedMilestones.map((m) => {
            const isTarget = m.status === 'in_progress' || (!m.is_achieved && m === nextMilestone);

            return (
              <div
                key={m.level}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                  m.is_achieved
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : isTarget
                    ? 'bg-gradient-to-b from-brand-950/60 to-dark-900 border-brand-500/50 shadow-glow-brand ring-1 ring-brand-500/30'
                    : 'bg-dark-950/50 border-dark-800/80 text-slate-400 hover:border-dark-700'
                }`}
              >
                {/* Top Status */}
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span
                    className={`text-sm sm:text-base font-black px-2 py-0.5 rounded-lg border ${
                      m.is_achieved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : isTarget
                        ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                        : 'bg-dark-800 text-slate-400 border-dark-700'
                    }`}
                  >
                    {m.level}
                  </span>

                  {m.is_achieved ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" /> Erishildi
                    </span>
                  ) : isTarget ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-brand-300 animate-pulse">
                      <Rocket className="w-3.5 h-3.5" /> Asosiy maqsad
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">
                      Kelgusi
                    </span>
                  )}
                </div>

                {/* Target words count */}
                <div className="space-y-1 mb-2 sm:mb-3">
                  <div className="text-xs text-slate-400">
                    Marra: <strong className="text-white font-bold">{m.target_words}</strong> ta so'z
                  </div>
                  {!m.is_achieved && (
                    <div className="text-[11px] text-slate-400">
                      Qoldi: <span className="text-brand-300 font-semibold">{m.words_remaining}</span> ta
                    </div>
                  )}
                </div>

                {/* Duration & Forecast Date */}
                <div className="pt-2 border-t border-dark-800/80 space-y-1">
                  {m.is_achieved ? (
                    <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> To'liq o'zlashtirildi
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                          <Clock className="w-3 h-3 text-accent-cyan" /> Muddat:
                        </span>
                        <span className="text-accent-cyan font-mono">
                          {m.months_remaining < 1
                            ? `${m.days_remaining} kunda`
                            : `${m.months_remaining} oyda`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-2.5 h-2.5 text-slate-500" />
                        {m.target_date.toLocaleDateString('uz-UZ', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Insight banner */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-brand-950/80 via-dark-900 to-accent-violet/10 border border-brand-500/30 flex items-start gap-3 shadow-md">
          <Sparkles className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h5 className="font-bold text-white flex items-center gap-1.5">
              AI Prognoz Xulosasi:
            </h5>
            <p className="text-slate-300 leading-relaxed">
              {nextMilestone ? (
                <>
                  Kuniga <strong className="text-white font-bold">{selectedPace} ta so'z</strong> o'rganish sur'ati bilan{' '}
                  <strong className="text-brand-300 font-bold">{nextMilestone.level} darajasiga</strong>{' '}
                  <span className="text-accent-cyan font-bold font-mono">
                    {nextMilestone.months_remaining < 1
                      ? `${nextMilestone.days_remaining} kunda`
                      : `${nextMilestone.months_remaining} oyda (${nextMilestone.days_remaining} kunda)`}
                  </span>{' '}
                  erishasiz. Barqarorlik — muvaffaqiyat garovidir!
                </>
              ) : (
                "Barcha CEFR darajalari bo'yicha yuqori marralarga erishildi! Yangi ilgari so'zlarni kiritib lug'atingizni yanada boyitishda davom eting."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* CEFR Word Distribution Ladder (3 cols on mobile, 6 on desktop) */}
      <div className="space-y-2.5 relative z-10 pt-2 border-t border-dark-800">
        <span className="text-xs font-bold text-slate-300">Lug'atdagi mavjud so'zlar taqsimoti:</span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {levels.map((lvl) => {
            const count = assessment.level_breakdown[lvl] || 0;
            const isCurrent = lvl === currentLevelKey;
            const cfg = CEFR_CONFIG[lvl];

            return (
              <div
                key={lvl}
                className={`p-2.5 sm:p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                  isCurrent
                    ? `${cfg.badgeBg} ring-2 ring-brand-500/40 shadow-lg scale-105`
                    : 'bg-dark-950/60 border-dark-800/80 text-slate-400 hover:border-dark-700'
                }`}
              >
                <span
                  className={`text-xs font-black tracking-tight ${
                    isCurrent ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {lvl}
                </span>
                <span className="text-xs font-mono font-bold mt-0.5 text-white">{count}</span>
                <span className="text-[9px] text-slate-500 font-medium">ta so'z</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Insights Row (1 col on mobile, 3 on tablet/desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-dark-800/80 relative z-10 text-xs">
        <div className="p-2 sm:p-0 rounded-xl sm:rounded-none bg-dark-950/40 sm:bg-transparent space-y-0.5">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Mustahkamlangan
          </span>
          <p className="text-base font-black text-white">
            {assessment.words_mastered ?? 0}{' '}
            <span className="text-[11px] font-normal text-slate-400">so'z</span>
          </p>
        </div>

        <div className="p-2 sm:p-0 rounded-xl sm:rounded-none bg-dark-950/40 sm:bg-transparent space-y-0.5">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Jami so'z boyligi
          </span>
          <p className="text-base font-black text-brand-300">
            {assessment.total_vocabulary_count}{' '}
            <span className="text-[11px] font-normal text-slate-400">so'z</span>
          </p>
        </div>

        <div className="p-2 sm:p-0 rounded-xl sm:rounded-none bg-dark-950/40 sm:bg-transparent space-y-0.5">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-cyan-400" /> Ishonchlilik indeksi
          </span>
          <p className="text-base font-black text-cyan-300 font-mono">
            {confidencePercent}%
          </p>
        </div>
      </div>
    </div>
  );
};
