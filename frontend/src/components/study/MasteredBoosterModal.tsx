import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Trophy,
  Flame,
  Brain,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Word } from '../../types';
import { api } from '../../api/client';
import { useStudyTime } from '../../context/StudyTimeContext';

interface MasteredBoosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const MasteredBoosterModal: React.FC<MasteredBoosterModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<'answering' | 'correct' | 'incorrect'>('answering');
  const [mode, setMode] = useState<'typed' | 'choice'>('typed');
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const { startSession, endSession } = useStudyTime();

  useEffect(() => {
    if (isOpen) {
      loadPracticeWords();
      startSession('mastered_practice');
    } else {
      endSession();
    }
  }, [isOpen]);

  const loadPracticeWords = async () => {
    try {
      setLoading(true);
      setIsCompleted(false);
      setCurrentIndex(0);
      setUserInput('');
      setStatus('answering');
      setSelectedOption(null);
      setStats({ correct: 0, incorrect: 0 });

      // Fetch up to 50 randomized mastered/known words
      const data = await api.getMasteredPracticeWords(50);
      setWords(data);
    } catch (err) {
      console.error('Failed to load mastered words for practice:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentWord = words[currentIndex];

  // Prepare multiple choice options when mode is 'choice'
  useEffect(() => {
    if (!currentWord || words.length === 0) return;
    if (mode === 'choice') {
      const correct = currentWord.uzbek_translation;
      const otherWords = words.filter((w) => w.id !== currentWord.id);
      const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
      const distractors = shuffledOthers.slice(0, 3).map((w) => w.uzbek_translation);

      // If not enough distractors from pool, add defaults
      while (distractors.length < 3) {
        distractors.push('Boshqa maʼno');
      }

      const allOptions = [correct, ...distractors].sort(() => 0.5 - Math.random());
      setOptions(allOptions);
    }
  }, [currentIndex, mode, words]);

  useEffect(() => {
    if (status === 'answering' && inputRef.current && mode === 'typed') {
      inputRef.current.focus();
    }
  }, [currentIndex, status, mode]);

  const handleSpeak = (text: string, rate = 1.0) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate;
      window.speechSynthesis.speak(u);
    }
  };

  const cleanText = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[\(\)\[\]\,\.\;\:\!\?\'\"\`\-\_]/g, '')
      .replace(/\s+/g, ' ');

  const checkAnswerCorrectness = (input: string, target: string) => {
    const cleanIn = cleanText(input);
    const cleanTarget = cleanText(target);

    if (cleanIn === cleanTarget) return true;

    // Check if target has slash or comma-separated synonyms
    const synonyms = target
      .split(/[,;\/]/)
      .map((s) => cleanText(s))
      .filter(Boolean);

    return synonyms.some((syn) => syn === cleanIn || (cleanIn.length > 2 && syn.includes(cleanIn)));
  };

  const handleSubmitAnswer = async (e?: React.FormEvent, choiceAnswer?: string) => {
    if (e) e.preventDefault();
    if (!currentWord || status !== 'answering') return;

    const answerToEvaluate = choiceAnswer !== undefined ? choiceAnswer : userInput;
    if (!answerToEvaluate.trim()) return;

    const isCorrect = checkAnswerCorrectness(answerToEvaluate, currentWord.uzbek_translation);

    setStatus(isCorrect ? 'correct' : 'incorrect');
    setSelectedOption(answerToEvaluate);

    if (isCorrect) {
      setStats((prev) => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setStats((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }

    try {
      // Record review on backend with review_type="mastered_booster"
      await api.submitReview({
        word_id: currentWord.id,
        quality_rating: isCorrect ? 5 : 1,
        review_type: 'mastered_booster',
        review_source: 'web',
        user_answer: answerToEvaluate,
        time_spent_ms: 1200,
      });
    } catch (err) {
      console.error('Failed to submit review:', err);
    }
  };

  const handleNextWord = () => {
    if (currentIndex + 1 < words.length) {
      setCurrentIndex((prev) => prev + 1);
      setUserInput('');
      setSelectedOption(null);
      setStatus('answering');
    } else {
      setIsCompleted(true);
      onComplete?.();
    }
  };

  if (!isOpen) return null;

  const totalWords = words.length;
  const progressPercent = totalWords > 0 ? Math.round(((currentIndex + (status !== 'answering' ? 1 : 0)) / totalWords) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-dark-900 border border-brand-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-dark-800 bg-gradient-to-r from-dark-900 via-dark-850 to-brand-950/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-cyan/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  50 talik So'z Mustahkamlash
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  Kunlik Challenge
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                O'zlashtirilgan so'zlaringizni xotirada yangilang
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="bg-dark-950 rounded-xl p-0.5 border border-dark-800 flex items-center text-xs">
              <button
                type="button"
                onClick={() => setMode('typed')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  mode === 'typed'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Yozma
              </button>
              <button
                type="button"
                onClick={() => setMode('choice')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  mode === 'choice'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tanlov
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-dark-800/80 hover:bg-dark-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-dark-950 w-full overflow-hidden">
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-gradient-to-r from-brand-600 via-accent-violet to-accent-cyan transition-all duration-300"
          />
        </div>

        {/* Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-medium">So'zlar yuklanmoqda...</p>
            </div>
          ) : words.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto text-slate-500">
                <Brain className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">So'zlar topilmadi</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Mustahkamlash uchun avval kamida bir nechta so'z qo'shing yoki o'rganing.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-glow-brand"
              >
                Tushunarli
              </button>
            </div>
          ) : isCompleted ? (
            /* Celebration Screen */
            <div className="py-8 text-center space-y-6 animate-fadeIn">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-600 to-accent-cyan p-0.5 shadow-glow-brand">
                  <div className="w-full h-full bg-dark-900 rounded-[22px] flex items-center justify-center text-amber-400">
                    <Trophy className="w-10 h-10" />
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black border border-emerald-400 shadow-md">
                  100%
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Ajoyib Natija! Challenge Bajarildi 🎉
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Bugungi 50 talik bilgan so'zlarni mustahkamlash vazifasini muvaffaqiyatli yakunladingiz!
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                <div className="p-3.5 rounded-2xl bg-dark-850 border border-dark-750">
                  <span className="text-[11px] text-slate-400 font-medium">To'g'ri topildi</span>
                  <div className="text-xl font-black text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{stats.correct}</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-dark-850 border border-dark-750">
                  <span className="text-[11px] text-slate-400 font-medium">Qayta ko'rish lozim</span>
                  <div className="text-xl font-black text-rose-400 mt-1 flex items-center justify-center gap-1.5">
                    <XCircle className="w-5 h-5" />
                    <span>{stats.incorrect}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <button
                  onClick={loadPracticeWords}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Yana 50 ta so'z</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all"
                >
                  Dashboardga qaytish
                </button>
              </div>
            </div>
          ) : currentWord ? (
            /* Active Question */
            <div className="space-y-6">
              {/* Counter & Streak Badge */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-brand-400">
                  So'z {currentIndex + 1} / {totalWords}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[11px] font-semibold">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  To'g'ri: {stats.correct}
                </span>
              </div>

              {/* Target English Word Card */}
              <div className="p-6 rounded-2xl bg-dark-850 border border-dark-750/90 text-center space-y-3 relative overflow-hidden shadow-inner">
                <div className="flex items-center justify-center gap-2">
                  {currentWord.cefr_level && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      {currentWord.cefr_level}
                    </span>
                  )}
                  {currentWord.part_of_speech && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-dark-800 text-slate-400">
                      {currentWord.part_of_speech}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {currentWord.english_word}
                  </h2>
                  {currentWord.phonetic && (
                    <p className="text-xs font-mono text-slate-400">{currentWord.phonetic}</p>
                  )}
                </div>

                {/* Pronunciation audio buttons */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSpeak(currentWord.english_word, 1.0)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
                    title="Talaffuzni tinglash"
                  >
                    <Volume2 className="w-4 h-4 text-brand-400" />
                    <span>Oddiy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSpeak(currentWord.english_word, 0.75)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all active:scale-95"
                    title="Sekinlashtirilgan talaffuz"
                  >
                    <span>0.75x</span>
                  </button>
                </div>
              </div>

              {/* Input or Options based on Mode */}
              {mode === 'typed' ? (
                <form onSubmit={(e) => handleSubmitAnswer(e)} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      O'zbekcha tarjimasini yozing:
                    </label>
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        disabled={status !== 'answering'}
                        placeholder="Tarjimani kiriting va Enter bosing..."
                        className={`w-full px-4 py-3 rounded-xl bg-dark-850 border text-white text-sm outline-none transition-all ${
                          status === 'correct'
                            ? 'border-emerald-500 bg-emerald-950/20 shadow-glow-emerald'
                            : status === 'incorrect'
                            ? 'border-rose-500 bg-rose-950/20'
                            : 'border-dark-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
                        }`}
                      />
                    </div>
                  </div>

                  {status === 'answering' ? (
                    <button
                      type="submit"
                      disabled={!userInput.trim()}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet disabled:opacity-50 text-white text-xs font-bold shadow-glow-brand transition-all flex items-center justify-center gap-2"
                    >
                      <span>Javobni tekshirish</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : null}
                </form>
              ) : (
                /* Choice Mode */
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    To'g'ri tarjimani tanlang:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {options.map((opt, i) => {
                      const isCorrectOpt = opt === currentWord.uzbek_translation;
                      const isSelected = selectedOption === opt;

                      let btnStyle = 'bg-dark-850 border-dark-750 text-slate-200 hover:border-brand-500/50 hover:bg-dark-800';
                      if (status !== 'answering') {
                        if (isCorrectOpt) {
                          btnStyle = 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold';
                        } else if (isSelected && !isCorrectOpt) {
                          btnStyle = 'bg-rose-950/40 border-rose-500 text-rose-300 font-bold';
                        } else {
                          btnStyle = 'bg-dark-850 border-dark-800 text-slate-500 opacity-60';
                        }
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={status !== 'answering'}
                          onClick={() => handleSubmitAnswer(undefined, opt)}
                          className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between gap-2 ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {status !== 'answering' && isCorrectOpt && (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {status !== 'answering' && (
                <div
                  className={`p-4 rounded-2xl border flex items-start justify-between gap-3 animate-fadeIn ${
                    status === 'correct'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {status === 'correct' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-xs font-black">
                        {status === 'correct' ? "To'g'ri topdingiz! 🌟" : "Xato qilindi ⚠️"}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Asl tarjima:{' '}
                        <span className="font-bold text-white">
                          {currentWord.uzbek_translation}
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleNextWord}
                    autoFocus
                    className="px-4 py-2 rounded-xl bg-white text-dark-950 hover:bg-slate-200 text-xs font-black shadow-md transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <span>Keyingisi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
