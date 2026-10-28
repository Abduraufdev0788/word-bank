import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  RotateCcw,
  Volume2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Target,
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { Word } from '../types';
import { api } from '../api/client';
import { useStudyTime } from '../context/StudyTimeContext';

type QuizMode = 'mastered_50' | 'all_50' | 'weak';
type InputMode = 'choice' | 'typed';
type QuizDirection = 'uz_to_en' | 'en_to_uz';

interface PracticeQuizProps {
  initialMode?: QuizMode;
  onBackToDashboard: () => void;
  onNavigateToWeakWords?: () => void;
}

export const PracticeQuiz: React.FC<PracticeQuizProps> = ({
  initialMode = 'mastered_50',
  onBackToDashboard,
  onNavigateToWeakWords,
}) => {
  const [selectedMode, setSelectedMode] = useState<QuizMode>(initialMode);
  const [inputMode, setInputMode] = useState<InputMode>('typed');
  const [direction, setDirection] = useState<QuizDirection>('uz_to_en');
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Question state
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<'answering' | 'correct' | 'incorrect'>('answering');
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSynonymMatch, setIsSynonymMatch] = useState(false);
  const [synonymNote, setSynonymNote] = useState<string | null>(null);

  // Session stats
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, weakAdded: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const { startSession, endSession } = useStudyTime();

  // Load words when mode changes
  const loadWords = async (mode: QuizMode) => {
    try {
      setLoading(true);
      setError(null);
      setIsCompleted(false);
      setCurrentIndex(0);
      setUserInput('');
      setStatus('answering');
      setSelectedOption(null);
      setIsSynonymMatch(false);
      setSynonymNote(null);
      setStats({ correct: 0, incorrect: 0, weakAdded: 0 });

      let data: Word[] = [];
      if (mode === 'mastered_50') {
        data = await api.getMasteredPracticeWords(50);
      } else if (mode === 'all_50') {
        data = await api.getAllPracticeWords(50);
      } else {
        const weakData = await api.getWeakWords(20);
        data = weakData.map((w) => ({
          ...w,
          order_in_batch: 0,
          created_at: '',
          updated_at: '',
          examples: [],
        }));
      }

      if (data.length === 0) {
        if (mode === 'mastered_50') {
          // If no mastered words, fallback to all words
          data = await api.getAllPracticeWords(50);
        }
      }

      if (data.length === 0) {
        setError("Ushbu bo'lim bo'yicha lug'atingizda hali so'zlar mavjud emas. Avval so'z yoki fayl yuklang.");
      } else {
        setWords(data);
      }
    } catch (err: any) {
      console.error('Failed to load practice words:', err);
      setError(err.message || "So'zlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialMode && initialMode !== selectedMode) {
      setSelectedMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    loadWords(selectedMode);
    startSession('quiz');
    return () => {
      endSession();
    };
  }, [selectedMode]);

  const currentWord = words[currentIndex];

  // Prepare multiple choice options when mode is 'choice'
  useEffect(() => {
    if (!currentWord || words.length === 0) return;
    if (inputMode === 'choice') {
      const isUzToEn = direction === 'uz_to_en';
      const correct = isUzToEn ? currentWord.english_word.trim() : currentWord.uzbek_translation.trim();
      const otherWords = words.filter((w) => w.id !== currentWord.id);
      const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
      
      const distractors = isUzToEn
        ? shuffledOthers.slice(0, 3).map((w) => w.english_word.trim())
        : shuffledOthers.slice(0, 3).map((w) => w.uzbek_translation.trim());

      const fallbackDistractors = isUzToEn
        ? ["success", "experience", "development", "confidence", "patience", "courage", "knowledge", "effort"]
        : ["Muvaffaqiyat", "Imkoniyat", "Tushuncha", "Tajriba", "Rivojlanish", "Ishonch", "Kechiktirmoq", "Yetishmoq"];

      let fallbackIdx = 0;
      while (distractors.length < 3) {
        const fb = fallbackDistractors[fallbackIdx % fallbackDistractors.length];
        if (fb.toLowerCase() !== correct.toLowerCase() && !distractors.includes(fb)) {
          distractors.push(fb);
        }
        fallbackIdx++;
      }

      const allOptions = [correct, ...distractors.slice(0, 3)].sort(() => 0.5 - Math.random());
      setOptions(allOptions);
    }
  }, [currentIndex, inputMode, direction, words]);

  useEffect(() => {
    if (status === 'answering' && inputRef.current && inputMode === 'typed') {
      inputRef.current.focus();
    }
  }, [currentIndex, status, inputMode, direction]);

  // Audio pronunciation helper
  const handleSpeak = (text: string, rate = 0.9) => {
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
      .replace(/[\(\)\[\]\,\.\;\:\!\?\'\"\`\-\_\/\\]/g, '')
      .replace(/\s+/g, ' ');

  const checkAnswerCorrectness = (input: string, target: string) => {
    const cleanIn = cleanText(input);
    const cleanTarget = cleanText(target);
    if (cleanIn === cleanTarget) return true;

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

    let isCorrect = false;
    let isSynonym = false;
    let note: string | null = null;

    if (direction === 'uz_to_en') {
      const cleanIn = cleanText(answerToEvaluate);
      const cleanTargetEn = cleanText(currentWord.english_word);

      // 1. Direct match with english_word
      if (cleanIn === cleanTargetEn) {
        isCorrect = true;
      } else {
        // 2. Multi-word / split match in target (e.g. "begin / start")
        const splits = currentWord.english_word.split(/[,;\/]/).map(cleanText).filter(Boolean);
        if (splits.includes(cleanIn)) {
          isCorrect = true;
          isSynonym = true;
          note = `"${answerToEvaluate}" so'zi to'g'ri sinonim sifatida qabul qilindi.`;
        } else {
          // 3. User vocabulary match: another word in user's dictionary with same Uzbek translation
          const cleanTargetUz = cleanText(currentWord.uzbek_translation);
          const sameMeaningWord = words.find((w) => {
            const wEn = cleanText(w.english_word);
            const wUz = cleanText(w.uzbek_translation);
            return wEn === cleanIn && (wUz === cleanTargetUz || wUz.includes(cleanTargetUz) || cleanTargetUz.includes(wUz));
          });
          if (sameMeaningWord) {
            isCorrect = true;
            isSynonym = true;
            note = `Lug'atingizdagi "${answerToEvaluate}" so'zi ham "${currentWord.uzbek_translation}" ma'nosiga ega.`;
          }
        }
      }

      // 4. If still not matched, check with backend API for synonyms
      if (!isCorrect) {
        try {
          const verifyRes = await api.verifyAnswer(currentWord.id, answerToEvaluate);
          if (verifyRes.is_correct) {
            isCorrect = true;
            isSynonym = verifyRes.is_synonym_match;
            note = verifyRes.explanation || `"${answerToEvaluate}" to'g'ri sinonim sifatida qabul qilindi.`;
          }
        } catch (vErr) {
          console.error("Synonym verification error:", vErr);
        }
      }
    } else {
      isCorrect = checkAnswerCorrectness(answerToEvaluate, currentWord.uzbek_translation);
    }

    setStatus(isCorrect ? 'correct' : 'incorrect');
    setSelectedOption(answerToEvaluate);
    setIsSynonymMatch(isSynonym);
    setSynonymNote(note);

    if (isCorrect) {
      setStats((prev) => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      // Mistake made: immediately added to weak words
      setStats((prev) => ({
        ...prev,
        incorrect: prev.incorrect + 1,
        weakAdded: prev.weakAdded + 1,
      }));
    }

    try {
      // Record review on backend (quality=5 if correct, quality=1 if wrong -> sets is_weak=True, is_mastered=False, due_date=now)
      await api.submitReview({
        word_id: currentWord.id,
        quality_rating: isCorrect ? 5 : 1,
        review_type: selectedMode,
        review_source: 'web',
        user_answer: answerToEvaluate,
        time_spent_ms: 1500,
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
      setIsSynonymMatch(false);
      setSynonymNote(null);
      setStatus('answering');
    } else {
      setIsCompleted(true);
      triggerConfetti();
    }
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // fallback
    }
  };

  // Keyboard shortcut listener (1-4 for options, Enter for next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status === 'answering' && inputMode === 'choice') {
        if (['1', '2', '3', '4'].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (options[idx]) {
            handleSubmitAnswer(undefined, options[idx]);
          }
        }
      } else if (status !== 'answering' && e.key === 'Enter') {
        handleNextWord();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, inputMode, options, currentIndex, words]);

  const totalWords = words.length;
  const progressPercent =
    totalWords > 0
      ? Math.round(((currentIndex + (status !== 'answering' ? 1 : 0)) / totalWords) * 100)
      : 0;

  return (
    <div className="p-3.5 sm:p-6 lg:p-10 space-y-6 max-w-5xl mx-auto pb-24">
      {/* Top Navigation Bar & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 rounded-xl bg-dark-900 hover:bg-dark-800 border border-dark-800 text-slate-300 hover:text-white transition-all shadow-sm"
            title="Boshqaruv paneliga qaytish"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-brand-400" />
              <span>50 talik Test & Mustahkamlash</span>
            </h1>
            <p className="text-xs text-slate-400">
              O'zlashtirilgan yoki butun lug'at banki bo'yicha intensiv mashq
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-dark-900 border border-dark-800 self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setSelectedMode('mastered_50')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedMode === 'mastered_50'
                ? 'bg-brand-600 text-white shadow-glow-brand'
                : 'text-slate-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bilgan so'zlar (50 ta)</span>
          </button>

          <button
            onClick={() => setSelectedMode('all_50')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedMode === 'all_50'
                ? 'bg-brand-600 text-white shadow-glow-brand'
                : 'text-slate-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Barcha so'zlar (50 ta)</span>
          </button>

          <button
            onClick={() => setSelectedMode('weak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedMode === 'weak'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Zaif so'zlar</span>
          </button>
        </div>
      </div>

      {/* Mode Information & Rules Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-brand-950/40 via-dark-900 to-dark-850 border border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/35">
              {selectedMode === 'mastered_50'
                ? "Bilgan so'zlar testi (50 ta)"
                : selectedMode === 'all_50'
                ? "Barcha so'zlar testi (50 ta)"
                : "Zaif so'zlar laboratoriyasi"}
            </span>
            <span className="text-xs text-slate-400">• Savollar: {totalWords} ta</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200">
            {selectedMode === 'mastered_50' ? (
              <>
                🎯 <strong>Muhim qoida:</strong> Test davomida qaysi so'zda xato qilsangiz, u
                darhol <span className="text-rose-400 font-bold">«Zaif so'zlar» (bilmaganlar)</span> ro'yxatiga
                qo'shiladi va qayta takrorlashga kiritiladi!
              </>
            ) : selectedMode === 'all_50' ? (
              <>
                📚 Butun lug'at bazangizdagi so'zlar tasodifiy tartibda sinovdan o'tkaziladi. Xato
                qilingan so'zlar zaiflar ro'yxatiga o'tadi.
              </>
            ) : (
              <>
                ⚠️ Eng ko'p adashilgan va xato qilingan so'zlarni mustahkamlash sessiyasi.
              </>
            )}
          </p>
        </div>

        {/* Control Toggles: Direction and Input Format */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {/* Direction toggle */}
          <div className="flex items-center gap-1 p-1 bg-dark-950 rounded-xl border border-dark-800 shrink-0">
            <button
              onClick={() => {
                setDirection('uz_to_en');
                setStatus('answering');
                setUserInput('');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                direction === 'uz_to_en'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="O'zbekcha so'z beriladi, inglizchasini kiritasiz"
            >
              🇺🇿 ➔ 🇬🇧 O'zbekcha ➔ Inglizcha
            </button>
            <button
              onClick={() => {
                setDirection('en_to_uz');
                setStatus('answering');
                setUserInput('');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                direction === 'en_to_uz'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Inglizcha so'z beriladi, o'zbekchasini kiritasiz"
            >
              🇬🇧 ➔ 🇺🇿 Inglizcha ➔ O'zbekcha
            </button>
          </div>

          {/* Input format toggle (Choice vs Typed) */}
          <div className="flex items-center gap-1 p-1 bg-dark-950 rounded-xl border border-dark-800 shrink-0">
            <button
              onClick={() => setInputMode('choice')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                inputMode === 'choice'
                  ? 'bg-dark-800 text-brand-300 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Variantli
            </button>
            <button
              onClick={() => setInputMode('typed')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                inputMode === 'typed'
                  ? 'bg-dark-800 text-brand-300 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Yozma
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center space-y-4 rounded-3xl bg-dark-900 border border-dark-800">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">
            Test savollari yuklanmoqda...
          </p>
        </div>
      ) : error ? (
        <div className="p-10 text-center space-y-4 rounded-3xl bg-dark-900 border border-dark-800 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-sm text-slate-300">{error}</p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => setSelectedMode('all_50')}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all"
            >
              Barcha so'zlardan sinab ko'rish
            </button>
            <button
              onClick={onBackToDashboard}
              className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold transition-all"
            >
              Ortga qaytish
            </button>
          </div>
        </div>
      ) : isCompleted ? (
        /* Completion graduation screen */
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-dark-900 border border-brand-500/30 space-y-6 shadow-2xl animate-scaleUp max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-brand-500 to-accent-violet p-0.5 mx-auto shadow-glow-brand animate-bounce">
            <div className="w-full h-full bg-dark-900 rounded-[22px] flex items-center justify-center text-amber-400">
              <Trophy className="w-10 h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Tabriklaymiz, Test Yakunlandi! 🎉
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Barcha 50 ta so'z bo'yicha mashg'ulot yakunlandi va natijalaringiz hisobingizga
              muhrlandi.
            </p>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
            <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750">
              <p className="text-xs text-slate-400">To'g'ri topildi</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {stats.correct} / {totalWords}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {Math.round((stats.correct / totalWords) * 100)}% aniqlik
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750">
              <p className="text-xs text-slate-400">Xato qilingan</p>
              <p className="text-2xl font-black text-rose-400 mt-1">{stats.incorrect}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Qayta ishlash kerak</p>
            </div>

            <div className="p-4 rounded-2xl bg-dark-850 border border-rose-500/30">
              <p className="text-xs text-rose-300 font-bold">Zaif so'zlarga</p>
              <p className="text-2xl font-black text-rose-400 mt-1">+{stats.weakAdded}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Ro'yxatga tushdi</p>
            </div>
          </div>

          {/* Next Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <button
              onClick={() => loadWords(selectedMode)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Yana 50 ta so'z bilan boshlash</span>
            </button>

            {stats.weakAdded > 0 && onNavigateToWeakWords && (
              <button
                onClick={onNavigateToWeakWords}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Target className="w-4 h-4 text-rose-400" />
                <span>Zaif so'zlarni ko'rish ({stats.weakAdded})</span>
              </button>
            )}

            <button
              onClick={onBackToDashboard}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-200 text-xs font-semibold transition-all"
            >
              Asosiy menyuga qaytish
            </button>
          </div>
        </div>
      ) : currentWord ? (
        /* Active Question Card */
        <div className="rounded-3xl bg-dark-900 border border-dark-800 shadow-2xl overflow-hidden flex flex-col space-y-0">
          {/* Progress Header */}
          <div className="p-4 sm:p-5 border-b border-dark-800 bg-dark-950 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs sm:text-sm font-black text-brand-300 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/30">
                {currentIndex + 1} / {totalWords}
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Aniqlik: {Math.round((stats.correct / Math.max(1, currentIndex)) * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-32 sm:w-48 h-2 rounded-full bg-dark-850 overflow-hidden border border-dark-750">
                <div
                  style={{ width: `${progressPercent}%` }}
                  className="h-full bg-gradient-to-r from-brand-600 via-accent-violet to-accent-cyan rounded-full transition-all duration-300"
                />
              </div>
              <span className="font-mono text-xs font-bold text-slate-300">
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* Word Prompt Section */}
          <div className="p-6 sm:p-10 text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                {direction === 'uz_to_en' ? currentWord.uzbek_translation : currentWord.english_word}
              </h2>
              <button
                type="button"
                onClick={() => handleSpeak(currentWord.english_word)}
                className="p-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-brand-400 border border-dark-700 hover:border-brand-500/30 transition-all shadow-sm active:scale-95"
                title="Talaffuzni tinglash (Inglizcha)"
              >
                <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {direction === 'en_to_uz' && currentWord.phonetic && (
              <p className="font-mono text-sm sm:text-base text-slate-400">
                {currentWord.phonetic}
              </p>
            )}

            {currentWord.part_of_speech && (
              <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold bg-dark-800 text-slate-300 border border-dark-750">
                {currentWord.part_of_speech}
              </span>
            )}

            <p className="text-xs text-slate-400 pt-1">
              {direction === 'uz_to_en'
                ? "To'g'ri inglizcha tarjimani yozing (sinonimlar ham to'g'ri hisoblanadi):"
                : "To'g'ri o'zbekcha tarjimani tanlang yoki yozing:"}
            </p>
          </div>

          {/* Interactive Answer Area */}
          <div className="p-4 sm:p-8 border-t border-dark-800 bg-dark-950/50 space-y-5">
            {inputMode === 'choice' ? (
              /* Multiple Choice 2x2 Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {options.map((opt, idx) => {
                  let btnStyle =
                    'bg-dark-850 hover:bg-dark-800 border-dark-750/90 text-slate-200 hover:border-brand-500/40';

                  const targetAnswer = direction === 'uz_to_en' ? currentWord.english_word : currentWord.uzbek_translation;

                  if (status !== 'answering') {
                    const isTarget =
                      cleanText(opt) === cleanText(targetAnswer);
                    const isSelected = selectedOption === opt;

                    if (isTarget) {
                      btnStyle =
                        'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-glow-emerald';
                    } else if (isSelected && !isTarget) {
                      btnStyle = 'bg-rose-950/40 border-rose-500 text-rose-200 animate-shake';
                    } else {
                      btnStyle = 'bg-dark-900 border-dark-800 text-slate-500 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={status !== 'answering'}
                      onClick={() => handleSubmitAnswer(undefined, opt)}
                      className={`p-4 rounded-2xl border text-left font-bold text-sm sm:text-base transition-all flex items-center justify-between gap-3 active:scale-98 ${btnStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-dark-900 border border-dark-750 text-slate-400 text-xs flex items-center justify-center font-mono shrink-0">
                          {idx + 1}
                        </span>
                        <span className="capitalize">{opt}</span>
                      </div>
                      {status !== 'answering' && (
                        <div>
                          {cleanText(opt) === cleanText(targetAnswer) ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          ) : selectedOption === opt ? (
                            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          ) : null}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Typed Input Field */
              <form onSubmit={handleSubmitAnswer} className="max-w-xl mx-auto space-y-3">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    disabled={status !== 'answering'}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={
                      direction === 'uz_to_en'
                        ? "Inglizcha tarjimasini yozing (masalan: large, big)..."
                        : "O'zbekcha tarjimasini yozing..."
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500 text-sm sm:text-base font-semibold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                  {status === 'answering' && (
                    <button
                      type="submit"
                      disabled={!userInput.trim()}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-glow-brand"
                    >
                      Tekshirish
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Feedback & Weak Word Notification Banner */}
            {status !== 'answering' && (
              <div
                className={`p-4 sm:p-5 rounded-2xl border transition-all animate-pop-in max-w-2xl mx-auto space-y-2 ${
                  status === 'correct'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {status === 'correct' ? (
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base">
                        {status === 'correct'
                          ? isSynonymMatch
                            ? "✨ To'g'ri! Sinonim qabul qilindi!"
                            : "To'g'ri javob! Barakalla! 🎉"
                          : "Noto'g'ri javob!"}
                      </h4>

                      {isSynonymMatch && synonymNote && (
                        <p className="text-xs sm:text-sm text-emerald-200 mt-1 font-semibold">
                          💡 {synonymNote}
                        </p>
                      )}

                      <p className="text-xs sm:text-sm mt-0.5 opacity-90">
                        {direction === 'uz_to_en' ? (
                          <>
                            Asosiy so'z: <strong className="text-white">{currentWord.english_word}</strong> = <strong>{currentWord.uzbek_translation}</strong>
                          </>
                        ) : (
                          <>
                            To'g'ri tarjima: <strong>{currentWord.uzbek_translation}</strong> (Inglizcha: {currentWord.english_word})
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleNextWord}
                    className="px-5 py-2.5 rounded-xl bg-white text-dark-950 hover:bg-slate-100 font-extrabold text-xs shadow-lg transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <span>Keyingisi</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {status === 'incorrect' && (
                  <div className="pt-2 border-t border-rose-500/30 flex items-center gap-2 text-xs font-semibold text-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping shrink-0" />
                    <span>
                      ⚠️ Ushbu so'z xato qilingani sababli «Zaif so'zlar» (bilmaganlar) ro'yxatiga
                      qo'shildi va takrorlashga kiritildi!
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
