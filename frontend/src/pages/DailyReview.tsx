import React, { useEffect, useState, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Volume2,
  RotateCw,
  CheckCircle2,
  Award,
  PenTool,
  CreditCard,
  ArrowRight,
  HelpCircle,
  XCircle,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import { api } from '../api/client';
import { DueWordReview, ReviewResult } from '../types';
import { useStudyTime } from '../context/StudyTimeContext';

interface DailyReviewProps {
  onBackToDashboard: () => void;
}

type ReviewMode = 'typed' | 'flashcard';
type TypedState = 'typing' | 'correct' | 'revealed' | 'incorrect_try';

function evaluateAnswer(userAnswer: string, expectedAnswer: string): { isCorrect: boolean } {
  // 100% aniq moslik: kichik harflar va bo'sh joylar tozalangan holda
  const normUser = userAnswer.trim().toLowerCase().replace(/\s+/g, ' ');
  const normExpected = expectedAnswer.trim().toLowerCase().replace(/\s+/g, ' ');

  // 1. 100% to'liq to'g'ri kelganda
  if (normUser === normExpected) {
    return { isCorrect: true };
  }

  // 2. Agar so'zda slash yoki vergul bilan bir nechta to'g'ri variant berilgan bo'lsa (masalan: "hi / hello")
  const variants = normExpected
    .split(/[/;,]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  if (variants.includes(normUser)) {
    return { isCorrect: true };
  }

  // 100% aniq bo'lmasa (hatto 1 ta harf farq qilsa ham) - XATO deb hisoblanadi
  return { isCorrect: false };
}

export const DailyReview: React.FC<DailyReviewProps> = ({ onBackToDashboard }) => {
  const { startSession, endSession } = useStudyTime();
  const [queue, setQueue] = useState<DueWordReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('typed');

  // Flashcard mode state
  const [isFlipped, setIsFlipped] = useState(false);

  // Typed mode state
  const [typedInput, setTypedInput] = useState('');
  const [typedState, setTypedState] = useState<TypedState>('typing');
  const [mistakeCount, setMistakeCount] = useState(0);
  const [inputShaking, setInputShaking] = useState(false);
  const [lastUserAnswer, setLastUserAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // Fetch due review queue
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        setLoading(true);
        const words = await api.getDueReviews();
        setQueue(words);
        if (words.length > 0) {
          await startSession('review');
        }
      } catch (err) {
        console.error('Failed to load review queue:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();

    return () => {
      endSession();
    };
  }, []);

  const currentWord = queue[currentIndex];

  // Auto focus input on typed mode or word switch
  useEffect(() => {
    if (reviewMode === 'typed' && (typedState === 'typing' || typedState === 'incorrect_try') && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, reviewMode, typedState]);

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // Multi-burst celebration confetti
  const triggerCelebrationEffect = () => {
    confetti({
      particleCount: 85,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#06b6d4'],
      scalar: 1.15,
    });

    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 60,
        origin: { x: 0.15, y: 0.7 },
        colors: ['#10b981', '#34d399', '#6ee7b7'],
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 60,
        origin: { x: 0.85, y: 0.7 },
        colors: ['#6366f1', '#818cf8', '#a78bfa'],
      });
    }, 150);
  };

  const proceedToNextWord = () => {
    if (currentIndex + 1 < queue.length) {
      setIsFlipped(false);
      setTypedInput('');
      setTypedState('typing');
      setMistakeCount(0);
      setInputShaking(false);
      setLastUserAnswer('');
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      endSession();
      triggerCelebrationEffect();
    }
  };

  // Submit rating for flashcard mode
  const handleRatingSubmit = async (rating: number) => {
    if (!currentWord || submitting) return;

    setSubmitting(true);
    try {
      const res = await api.submitReview({
        word_id: currentWord.id,
        quality_rating: rating,
        review_source: 'web',
        review_type: 'flashcard',
      });

      setResults((prev) => [...prev, res]);
      proceedToNextWord();
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Check typed answer
  const handleCheckTyped = async () => {
    if (!currentWord || submitting || !typedInput.trim()) return;

    const answer = typedInput.trim();
    setLastUserAnswer(answer);
    const evaluation = evaluateAnswer(answer, currentWord.english_word);

    if (evaluation.isCorrect) {
      // 1. TO'G'RI: Chiroyli bayramona effect, audio, va keyingisiga o'tish imkoni
      setTypedState('correct');
      triggerCelebrationEffect();
      handleSpeak(currentWord.english_word);

      // SM-2 rating: 5 if 100% first try, 4 if 1 mistake before correct, 3 if multiple mistakes
      const quality = mistakeCount === 0 ? 5 : (mistakeCount === 1 ? 4 : 3);

      setSubmitting(true);
      try {
        const res = await api.submitReview({
          word_id: currentWord.id,
          quality_rating: quality,
          review_source: 'web',
          review_type: 'typed',
          user_answer: answer,
        });
        setResults((prev) => [...prev, res]);
      } catch (err) {
        console.error('Failed to submit typed review:', err);
      } finally {
        setSubmitting(false);
      }
    } else {
      // 2. XATO: KEYINGISIGA O'TMASIN! Foydalanuvchi yana kiritib urinib ko'rsin
      setInputShaking(true);
      setTimeout(() => setInputShaking(false), 450);
      setMistakeCount((prev) => prev + 1);
      setTypedState('incorrect_try');
      // Inputni qayta fokus qilish
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  };

  // Give up / "Bilmayman" in typed mode -> ONLY then allows advancing
  const handleGiveUpTyped = async () => {
    if (!currentWord || submitting) return;

    setTypedState('revealed');
    handleSpeak(currentWord.english_word);

    setSubmitting(true);
    try {
      const res = await api.submitReview({
        word_id: currentWord.id,
        quality_rating: 1, // marked for repetition
        review_source: 'web',
        review_type: 'typed',
        user_answer: typedInput.trim() || 'bilmayman',
      });
      setResults((prev) => [...prev, res]);
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Load practice words from word bank if queue is empty
  const handlePracticeAllWords = async () => {
    try {
      setLoading(true);
      const words = await api.getWords({ limit: 20 });
      if (words.length > 0) {
        const mappedQueue: DueWordReview[] = words.map((w) => ({
          id: w.id,
          english_word: w.english_word,
          uzbek_translation: w.uzbek_translation,
          part_of_speech: w.part_of_speech,
          phonetic: w.phonetic,
          batch_id: w.batch_id,
          due_date: new Date().toISOString(),
          repetition_number: w.progress?.repetition_number || 0,
          is_weak: w.progress?.is_weak || false,
        }));
        setQueue(mappedQueue);
        setCurrentIndex(0);
        setResults([]);
        setIsCompleted(false);
        setTypedInput('');
        setTypedState('typing');
        setMistakeCount(0);
        await startSession('practice');
      }
    } catch (err) {
      console.error('Failed to load practice words:', err);
    } finally {
      setLoading(false);
    }
  };

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted || loading || queue.length === 0) return;

      if (reviewMode === 'flashcard') {
        if (e.code === 'Space') {
          e.preventDefault();
          handleFlip();
        } else if (isFlipped && !submitting) {
          if (e.key === '0') handleRatingSubmit(0);
          else if (e.key === '1') handleRatingSubmit(1);
          else if (e.key === '2') handleRatingSubmit(2);
          else if (e.key === '3') handleRatingSubmit(3);
          else if (e.key === '4') handleRatingSubmit(4);
          else if (e.key === '5') handleRatingSubmit(5);
        }
      } else if (reviewMode === 'typed') {
        if (e.key === 'Enter') {
          if (typedState === 'correct' || typedState === 'revealed') {
            e.preventDefault();
            proceedToNextWord();
          } else {
            // Typing or incorrect_try: Enter checks answer!
            e.preventDefault();
            handleCheckTyped();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    reviewMode,
    isFlipped,
    isCompleted,
    loading,
    queue.length,
    submitting,
    currentIndex,
    typedState,
    typedInput,
  ]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Takrorlash navbati yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // Empty queue
  if (queue.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-dark-900 border border-dark-800 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-extrabold text-white">Barcha takrorlashlar bajarilgan! 🎉</h3>
          <p className="text-xs text-slate-300">
            Ayni paytda SM-2 navbatida muddati yetgan so'zlar qolmagan. Ammo xohlasangiz, lug'atingizdagi so'zlarni yozma mashq qilishingiz mumkin!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handlePracticeAllWords}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all"
          >
            <PenTool className="w-4 h-4" />
            <span>Lug'atimdan yozma mashq qilish</span>
          </button>
          <button
            onClick={onBackToDashboard}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-300 text-xs font-semibold transition-all"
          >
            Boshqaruv paneliga qaytish
          </button>
        </div>
      </div>
    );
  }

  // Summary View
  if (isCompleted) {
    const correctCount = results.filter((r) => r.is_correct).length;
    const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-dark-900 border border-dark-800 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-violet text-white flex items-center justify-center mx-auto shadow-glow-brand">
          <Award className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl font-black text-white">Mashg'ulot Yakunlandi! 🎉</h3>
          <p className="text-xs text-slate-400">
            Siz muvaffaqiyatli ravishda {queue.length} ta so'zni SM-2 algoritmi bo'yicha takrorladingiz.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-dark-850 border border-dark-800">
          <div>
            <span className="text-[11px] text-slate-500">Takrorlandi</span>
            <p className="text-xl font-bold text-white">{results.length}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500">Aniqlik</span>
            <p className="text-xl font-bold text-emerald-400">{accuracy}%</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500">To'g'ri topildi</span>
            <p className="text-xl font-bold text-brand-400">{correctCount}</p>
          </div>
        </div>

        <button
          onClick={onBackToDashboard}
          className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold shadow-glow-brand transition-all"
        >
          Boshqaruv paneliga qaytish
        </button>
      </div>
    );
  }

  const progressPercent = Math.round((currentIndex / queue.length) * 100);

  return (
    <div className="max-w-2xl mx-auto my-3 sm:my-8 px-3 sm:px-4 space-y-4 sm:space-y-6">
      {/* Top Header: Session Progress & Mode Switcher */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between sm:justify-start">
            <span className="text-xs font-semibold text-slate-400">
              So'z: <strong className="text-white text-sm">{currentIndex + 1}</strong> / {queue.length}
            </span>
            <span className="text-brand-400 font-semibold ml-3 text-xs">{progressPercent}% bajarildi</span>
          </div>

          {/* Responsive Mode Switcher Pill */}
          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center p-1 rounded-xl bg-dark-900 border border-dark-800">
            <button
              onClick={() => {
                setReviewMode('typed');
                setIsFlipped(false);
              }}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                reviewMode === 'typed'
                  ? 'bg-gradient-to-r from-brand-600 to-accent-violet text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Yozma</span>
              <span className="hidden sm:inline">O'zbekcha ➔ Inglizcha (Yozma)</span>
            </button>

            <button
              onClick={() => {
                setReviewMode('flashcard');
                setTypedState('typing');
              }}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                reviewMode === 'flashcard'
                  ? 'bg-gradient-to-r from-brand-600 to-accent-violet text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Karta (3D)</span>
              <span className="hidden sm:inline">Inglizcha ➔ O'zbekcha (Karta)</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 rounded-full bg-dark-900 border border-dark-800 overflow-hidden">
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-gradient-to-r from-brand-600 to-accent-violet rounded-full transition-all duration-300"
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: TYPED RECALL (O'zbekchasi beriladi, Inglizchasi yoziladi) */}
      {/* ========================================================= */}
      {reviewMode === 'typed' && (
        <div
          className={`p-5 sm:p-7 lg:p-9 rounded-2xl sm:rounded-3xl bg-dark-900 border transition-all duration-300 shadow-2xl space-y-5 sm:space-y-6 relative overflow-hidden ${
            typedState === 'correct'
              ? 'border-emerald-500/60 ring-4 ring-emerald-500/20 bg-gradient-to-b from-dark-900 to-emerald-950/20'
              : typedState === 'revealed'
              ? 'border-amber-500/40 bg-gradient-to-b from-dark-900 to-amber-950/15'
              : 'border-dark-750/90'
          }`}
        >
          {/* Subtle Background Glow */}
          <div
            className={`absolute top-0 right-0 w-52 h-52 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
              typedState === 'correct'
                ? 'bg-emerald-500/20'
                : typedState === 'revealed'
                ? 'bg-amber-500/15'
                : 'bg-brand-500/10'
            }`}
          />

          {/* Prompt Header */}
          <div className="flex justify-between items-start relative z-10">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                typedState === 'correct'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-brand-500/15 text-brand-300 border-brand-500/30'
              }`}
            >
              O'zbekcha ma'nosi:
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {currentWord.part_of_speech || "so'z"}
            </span>
          </div>

          {/* Large Uzbek Translation */}
          <div className="text-center py-2 sm:py-3 space-y-1.5 sm:space-y-2 relative z-10">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight break-words">
              {currentWord.uzbek_translation}
            </h2>
            <p className="text-xs text-slate-400">
              {typedState === 'correct'
                ? "Ajoyib natija! So'z muvaffaqiyatli eslandi."
                : typedState === 'revealed'
                ? "To'g'ri javobni eslab qoling:"
                : "Ushbu so'zning inglizcha tarjimasini yozing:"}
            </p>
          </div>

          {/* Input & Feedback Area */}
          {(typedState === 'typing' || typedState === 'incorrect_try') && (
            <div className="space-y-4 relative z-10">
              <div className={`relative ${inputShaking ? 'animate-shake' : ''}`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCheckTyped();
                    }
                  }}
                  disabled={submitting}
                  placeholder="Inglizcha so'zni yozing..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={`w-full px-5 py-4 rounded-2xl bg-dark-950 border text-xl font-bold text-white placeholder-slate-500 outline-none transition-all text-center tracking-wide ${
                    typedState === 'incorrect_try'
                      ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-glow-rose'
                      : 'border-dark-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
                  }`}
                />
              </div>

              {/* Incorrect try warning banner (DOES NOT ADVANCE!) */}
              {typedState === 'incorrect_try' && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 animate-pop-in">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-semibold">
                      Noto'g'ri ("{lastUserAnswer}")! Qayta urinib ko'ring yoki "Bilmayman"ni bosing.
                    </span>
                  </div>

                  {mistakeCount >= 2 && (
                    <span className="text-[11px] font-mono text-amber-300 bg-dark-900/90 px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1.5 shrink-0">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      Maslahat: "{currentWord.english_word.slice(0, 1).toUpperCase()}..." ({currentWord.english_word.length} ta harf)
                    </span>
                  )}
                </div>
              )}

              {/* Actions: Tekshirish & Bilmayman */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCheckTyped}
                  disabled={submitting || !typedInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet disabled:opacity-50 text-white text-sm font-bold shadow-glow-brand transition-all active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Tekshirish [Enter]</span>
                </button>

                <button
                  type="button"
                  onClick={handleGiveUpTyped}
                  disabled={submitting}
                  className="px-5 py-3.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white border border-dark-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Javobni ko'rish va keyingisiga o'tish"
                >
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  <span>Bilmayman</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE: TO'G'RI (Chiroyli effect, bayram, keyingi so'zga o'tish) */}
          {typedState === 'correct' && (
            <div className="p-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 space-y-5 animate-pop-in relative z-10 shadow-glow-emerald">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-emerald-300">
                      To'ppa-to'g'ri! Barakalla! 🎉
                    </h4>
                    <p className="text-xs text-emerald-400/80">
                      So'z SM-2 algoritmi bo'yicha mustahkamlandi
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSpeak(currentWord.english_word)}
                  className="p-3 rounded-full bg-dark-900 hover:bg-dark-800 text-emerald-300 hover:text-white border border-emerald-500/30 transition-colors shadow-md"
                  title="Talaffuzni tinglash"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* English word showcase */}
              <div className="p-4 rounded-xl bg-dark-900/90 border border-emerald-500/30 text-center space-y-1">
                <h3 className="text-3xl font-black text-white tracking-wide">
                  {currentWord.english_word}
                </h3>
                {currentWord.phonetic && (
                  <p className="text-xs font-mono text-emerald-400">{currentWord.phonetic}</p>
                )}
              </div>

              {/* Next Word Button */}
              <button
                type="button"
                onClick={proceedToNextWord}
                autoFocus
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-black shadow-glow-emerald transition-all active:scale-[0.99]"
              >
                <span>Keyingi so'zga o'tish [Enter]</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STATE: REVEALED (Foydalanuvchi "Bilmayman"ni bosganda ko'rinadi) */}
          {typedState === 'revealed' && (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-5 animate-pop-in relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-extrabold text-amber-300">
                    To'g'ri inglizcha tarjimani eslab qoling:
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSpeak(currentWord.english_word)}
                  className="p-2.5 rounded-full bg-dark-900 hover:bg-dark-800 text-slate-300 hover:text-white border border-amber-500/30 transition-colors"
                  title="Talaffuzni tinglash"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* English Word Display */}
              <div className="p-4 rounded-xl bg-dark-950/80 border border-dark-750 text-center space-y-1">
                <h3 className="text-3xl font-black text-white tracking-tight">
                  {currentWord.english_word}
                </h3>
                {currentWord.phonetic && (
                  <p className="text-xs font-mono text-slate-400">{currentWord.phonetic}</p>
                )}
              </div>

              {lastUserAnswer && lastUserAnswer !== 'bilmayman' && (
                <div className="p-2.5 rounded-lg bg-dark-950 border border-dark-800 text-xs text-center">
                  <span className="text-slate-400">Siz yozgan javob: </span>
                  <span className="font-mono text-rose-300 line-through">{lastUserAnswer}</span>
                </div>
              )}

              {/* Next Word Button */}
              <button
                type="button"
                onClick={proceedToNextWord}
                autoFocus
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all active:scale-[0.99]"
              >
                <span>Keyingi so'zga o'tish [Enter]</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: 3D FLASHCARD (Inglizchasi ko'rsatiladi, kartani o'girib baholaydi) */}
      {/* ========================================================= */}
      {reviewMode === 'flashcard' && (
        <>
          <div className="perspective-1000 w-full min-h-[340px]">
            <div
              onClick={handleFlip}
              className={`w-full min-h-[340px] relative transition-transform duration-500 transform-style-3d cursor-pointer rounded-3xl ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* FRONT (English Word) */}
              <div className="absolute inset-0 backface-hidden p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-dark-900 border border-dark-700/80 hover:border-brand-500/50 flex flex-col justify-between shadow-2xl transition-all">
                <div className="flex justify-between items-start">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-dark-800 text-brand-400 border border-dark-700">
                    {currentWord.part_of_speech || "Inglizcha so'z"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak(currentWord.english_word);
                    }}
                    className="p-2.5 rounded-full bg-dark-800 hover:bg-brand-600/30 text-slate-300 hover:text-white transition-colors"
                    title="Talaffuzni tinglash"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center space-y-2 py-4 sm:py-8">
                  <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight break-words">
                    {currentWord.english_word}
                  </h2>
                  {currentWord.phonetic && (
                    <p className="text-xs sm:text-sm font-mono text-slate-400">{currentWord.phonetic}</p>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs text-slate-500">
                  <RotateCw className="w-3.5 h-3.5 animate-spin-slow shrink-0" />
                  <span>Tarjimani ko'rish uchun bosing</span>
                </div>
              </div>

              {/* BACK (Uzbek Translation) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-dark-850 border border-brand-500/40 flex flex-col justify-between shadow-2xl">
                <div className="flex justify-between items-start">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    O'zbekcha ma'nosi
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak(currentWord.english_word);
                    }}
                    className="p-2.5 rounded-full bg-dark-800 hover:bg-brand-600/30 text-slate-300 hover:text-white transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center space-y-3 py-6">
                  <p className="text-sm font-medium text-slate-400">{currentWord.english_word}</p>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                    {currentWord.uzbek_translation}
                  </h2>
                </div>

                <div className="text-center text-xs text-slate-500">
                  Eslashingiz qanday bo'ldi? Quyidagi baholardan birini tanlang:
                </div>
              </div>
            </div>
          </div>

          {/* SM-2 Quality Rating Action Bar */}
          {isFlipped && (
            <div className="p-4 rounded-2xl bg-dark-900 border border-dark-800 space-y-3 animate-fade-in shadow-xl">
              <p className="text-center text-xs font-semibold text-slate-400">
                Eslab qolish darajangizni baholang (Hotkeys: 0 - 5):
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { score: 0, label: 'Unutdim', color: 'hover:bg-rose-600/20 text-rose-400 border-rose-500/30' },
                  { score: 1, label: 'Qiyin', color: 'hover:bg-orange-600/20 text-orange-400 border-orange-500/30' },
                  { score: 2, label: 'Xato qildim', color: 'hover:bg-amber-600/20 text-amber-400 border-amber-500/30' },
                  { score: 3, label: 'Esladim', color: 'hover:bg-sky-600/20 text-sky-400 border-sky-500/30' },
                  { score: 4, label: 'Yaxshi', color: 'hover:bg-brand-600/20 text-brand-300 border-brand-500/30' },
                  { score: 5, label: 'Mukammal', color: 'hover:bg-emerald-600/20 text-emerald-300 border-emerald-500/30' },
                ].map((btn) => (
                  <button
                    key={btn.score}
                    disabled={submitting}
                    onClick={() => handleRatingSubmit(btn.score)}
                    className={`p-2.5 rounded-xl border bg-dark-850 text-xs font-bold flex flex-col items-center gap-1 transition-all active:scale-95 ${btn.color}`}
                  >
                    <span className="text-base font-mono">{btn.score}</span>
                    <span className="text-[10px] font-normal leading-tight">{btn.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
