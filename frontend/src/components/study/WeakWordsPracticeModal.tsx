import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Volume2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
  BrainCircuit,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { useStudyTime } from '../../context/StudyTimeContext';
import { WeakWord } from '../../types';

interface WeakWordsPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;
}

export const WeakWordsPracticeModal: React.FC<WeakWordsPracticeModalProps> = ({
  isOpen,
  onClose,
  onFinished,
}) => {
  const { startSession, endSession } = useStudyTime();
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<WeakWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answering state
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<'answering' | 'correct' | 'incorrect' | 'revealed'>('answering');
  const [justMastered, setJustMastered] = useState(false);
  const [stats, setStats] = useState({
    correct: 0,
    incorrect: 0,
    mastered: 0,
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start study session when modal is opened
  useEffect(() => {
    if (isOpen) {
      loadPracticeWords();
      startSession('weak_words_practice');
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
      setJustMastered(false);
      setStats({ correct: 0, incorrect: 0, mastered: 0 });

      // Fetch 20 randomized weak words
      const data = await api.getWeakWords(20, true);
      setWords(data);
    } catch (err) {
      console.error('Failed to load weak words for practice:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentWord = words[currentIndex];

  useEffect(() => {
    if (status === 'answering' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, status]);

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const cleanText = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[\(\)\[\]\,\.\;\:\!\?\'\"\`\-\_]/g, '')
      .replace(/\s+/g, ' ');

  const handleSubmitAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentWord || status !== 'answering') return;

    const userClean = cleanText(userInput);
    const expectedClean = cleanText(currentWord.english_word);

    // Also accept variations without articles (a, an, the, to)
    const variants = [
      expectedClean,
      expectedClean.replace(/^(to|a|an|the)\s+/, ''),
    ];

    const isMatch = userClean === expectedClean || variants.includes(userClean);

    try {
      const res = await api.submitReview({
        word_id: currentWord.id,
        quality_rating: isMatch ? 5 : 1,
        review_type: 'typed',
        user_answer: userInput,
      });

      const wordMastered = Boolean(res.is_mastered);
      setJustMastered(wordMastered);

      if (isMatch) {
        setStatus('correct');
        handleSpeak(currentWord.english_word);
        setStats((prev) => ({
          ...prev,
          correct: prev.correct + 1,
          mastered: wordMastered ? prev.mastered + 1 : prev.mastered,
        }));
      } else {
        setStatus('incorrect');
        setStats((prev) => ({
          ...prev,
          incorrect: prev.incorrect + 1,
        }));
      }
    } catch (err) {
      console.error('Review submission error:', err);
      // Fallback local status
      setStatus(isMatch ? 'correct' : 'incorrect');
    }
  };

  const handleRevealAnswer = () => {
    setStatus('revealed');
    handleSpeak(currentWord.english_word);
    api.submitReview({
      word_id: currentWord.id,
      quality_rating: 1,
      review_type: 'typed',
      user_answer: 'revealed',
    }).catch(() => {});
    setStats((prev) => ({
      ...prev,
      incorrect: prev.incorrect + 1,
    }));
  };

  const handleNextWord = () => {
    if (currentIndex + 1 < words.length) {
      setCurrentIndex((prev) => prev + 1);
      setUserInput('');
      setStatus('answering');
      setJustMastered(false);
    } else {
      setIsCompleted(true);
      endSession();
      if (onFinished) {
        onFinished();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-fadeIn">
      <div className="relative w-full max-w-xl bg-dark-900 border border-dark-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-dark-800 flex items-center justify-between bg-dark-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>Zaif So'zlarni Mustahkamlash</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
                  20 ta tasodifiy
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                3 marta ketma-ket to'g'ri topsangiz — so'z to'liq o'zlashtiriladi!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-mono">Tasodifiy zaif so'zlar tayyorlanmoqda...</p>
            </div>
          ) : words.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Zaif so'zlar topilmadi!</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Barcha so'zlaringiz mustahkam xotirada yoki hali yetarli mashqlar bajarilmagan.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-5 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-semibold"
              >
                Yopish
              </button>
            </div>
          ) : isCompleted ? (
            /* Practice Completion Screen */
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 via-accent-violet to-emerald-500 flex items-center justify-center mx-auto text-white shadow-glow-brand animate-bounce">
                <Trophy className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl sm:text-2xl font-black text-white">
                  Mashg'ulot Muvaffaqiyatli Yakunlandi!
                </h4>
                <p className="text-xs sm:text-sm text-slate-300">
                  Faol vaqt bugungi statistikangizga qo'shildi.
                </p>
              </div>

              {/* Stats badges */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-md mx-auto pt-2">
                <div className="p-3 rounded-2xl bg-dark-850 border border-dark-750 text-center">
                  <p className="text-[11px] text-slate-400">Jami so'raldi</p>
                  <p className="text-xl font-black text-white">{words.length}</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center">
                  <p className="text-[11px] text-emerald-400">To'g'ri topildi</p>
                  <p className="text-xl font-black text-emerald-300">{stats.correct}</p>
                </div>
                <div className="p-3 rounded-2xl bg-brand-500/10 border border-brand-500/25 text-center">
                  <p className="text-[11px] text-brand-300">O'zlashtirildi</p>
                  <p className="text-xl font-black text-brand-200">+{stats.mastered}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-4">
                <button
                  onClick={loadPracticeWords}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-200 text-xs font-semibold"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Yana 20 tasini mashq qilish</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand"
                >
                  Tugatish
                </button>
              </div>
            </div>
          ) : (
            /* Active Question Screen */
            <div className="space-y-5">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">
                    So'z {currentIndex + 1} / {words.length}
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-400 font-bold">{stats.correct} to'g'ri</span>
                    {stats.mastered > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-bold">
                        🎉 {stats.mastered} o'zlashtirildi
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-brand-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="p-6 rounded-2xl bg-dark-850 border border-dark-750 text-center space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-dark-800 text-slate-400 border border-dark-700 font-mono">
                    O'zbekcha ma'nosi:
                  </span>
                  {currentWord?.cefr_level && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30 font-bold">
                      {currentWord.cefr_level}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {currentWord?.uzbek_translation}
                </h2>

                {currentWord?.part_of_speech && (
                  <p className="text-xs text-slate-400 italic">
                    So'z turkumi: {currentWord.part_of_speech}
                  </p>
                )}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmitAnswer} className="space-y-3">
                <label className="block text-xs text-slate-400 font-medium">
                  Ushbu so'zning inglizcha yozilishini kiriting:
                </label>

                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    disabled={status !== 'answering'}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Inglizcha so'zni yozing..."
                    className={`w-full px-4 py-3 rounded-xl bg-dark-850 border text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none transition-all ${
                      status === 'correct'
                        ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-200'
                        : status === 'incorrect' || status === 'revealed'
                        ? 'border-rose-500/80 bg-rose-500/10 text-rose-200'
                        : 'border-dark-700 focus:border-brand-500'
                    }`}
                  />

                  {status !== 'answering' && (
                    <button
                      type="button"
                      onClick={() => handleSpeak(currentWord.english_word)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white"
                      title="Talaffuzni tinglash"
                    >
                      <Volume2 className="w-4 h-4 text-brand-400" />
                    </button>
                  )}
                </div>

                {/* Feedback state */}
                {status === 'answering' && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRevealAnswer}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Javobni ko'rsatish</span>
                    </button>

                    <button
                      type="submit"
                      disabled={!userInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-glow-rose transition-all flex items-center gap-2 active:scale-95"
                    >
                      <span>Tekshirish</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {status === 'correct' && (
                  <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/35 space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>Barakalla! 100% to'g'ri topdingiz!</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300 pl-7">
                      <span className="font-mono text-emerald-300 font-bold text-sm">
                        {currentWord.english_word}
                      </span>
                      {currentWord.phonetic && (
                        <span className="text-slate-400 font-mono">[{currentWord.phonetic}]</span>
                      )}
                    </div>

                    {justMastered && (
                      <div className="mt-2 p-2.5 rounded-lg bg-brand-500/20 border border-brand-500/40 text-brand-200 text-xs font-bold flex items-center gap-2 animate-pulse">
                        <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
                        <span>
                          🎉 Ushbu so'z 3 marta ketma-ket to'g'ri topildi va rasman O'ZLASHTIRILDI!
                        </span>
                      </div>
                    )}

                    <div className="pt-2 text-right">
                      <button
                        type="button"
                        onClick={handleNextWord}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 ml-auto active:scale-95 shadow-sm"
                      >
                        <span>Keyingisi</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {(status === 'incorrect' || status === 'revealed') && (
                  <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/35 space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-xs sm:text-sm">
                      <XCircle className="w-5 h-5 shrink-0" />
                      <span>To'g'ri javob quyidagicha:</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pl-7">
                      <span className="font-mono text-rose-200 font-bold text-base">
                        {currentWord.english_word}
                      </span>
                      {currentWord.phonetic && (
                        <span className="text-slate-400 font-mono">[{currentWord.phonetic}]</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 pl-7">
                      Ushbu so'zni yodda saqlang va keyingi safar qayta sinab ko'ring.
                    </p>

                    <div className="pt-2 text-right">
                      <button
                        type="button"
                        onClick={handleNextWord}
                        className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 ml-auto active:scale-95 shadow-sm"
                      >
                        <span>Tushundim, davom etamiz</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
