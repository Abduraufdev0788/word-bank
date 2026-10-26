import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Volume2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Trophy,
  PenTool,
  RotateCw,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { useStudyTime } from '../../context/StudyTimeContext';

interface BatchStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  words: Array<{
    id?: string;
    english_word: string;
    uzbek_translation: string;
    part_of_speech?: string;
    phonetic?: string;
    examples?: Array<{ sentence_en: string; sentence_uz: string }>;
  }>;
}

type StudyPhase = 'flashcard' | 'test' | 'completed';

export const BatchStudyModal: React.FC<BatchStudyModalProps> = ({
  isOpen,
  onClose,
  title,
  words,
}) => {
  const { startSession, endSession } = useStudyTime();
  const [phase, setPhase] = useState<StudyPhase>('flashcard');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Flashcard states
  const [isFlipped, setIsFlipped] = useState(false);
  const [learnedIndices, setLearnedIndices] = useState<Set<number>>(new Set());

  // Written Test states
  const [typedInput, setTypedInput] = useState('');
  const [typedStatus, setTypedStatus] = useState<'typing' | 'correct' | 'revealed' | 'incorrect'>('typing');
  const [inputShaking, setInputShaking] = useState(false);
  const [testMistakes, setTestMistakes] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-start active study time tracking when batch modal is active
  useEffect(() => {
    if (isOpen) {
      startSession(phase === 'test' ? 'batch_written_test' : 'batch_flashcard');
    }
    return () => {
      if (isOpen) {
        endSession();
      }
    };
  }, [isOpen, phase]);

  // Reset when modal opens or words change
  useEffect(() => {
    if (isOpen) {
      setPhase('flashcard');
      setCurrentIndex(0);
      setIsFlipped(false);
      setLearnedIndices(new Set());
      setTypedInput('');
      setTypedStatus('typing');
      setTestMistakes(0);
    }
  }, [isOpen, words]);

  // Focus input when test phase starts or index changes
  useEffect(() => {
    if (phase === 'test' && typedStatus === 'typing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, currentIndex, typedStatus]);

  if (!isOpen || words.length === 0) return null;

  const currentWord = words[currentIndex] || words[0];

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.88;
      window.speechSynthesis.speak(u);
    }
  };

  const triggerCelebration = () => {
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#10b981', '#6366f1', '#ec4899', '#f59e0b'],
    });
  };

  // Flashcard handlers
  const handleNextFlashcard = () => {
    setIsFlipped(false);
    if (currentIndex + 1 < words.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finished all flashcards -> Ready for written test!
      setPhase('test');
      setCurrentIndex(0);
      setTypedInput('');
      setTypedStatus('typing');
      triggerCelebration();
    }
  };

  const handlePrevFlashcard = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleMarkLearned = () => {
    setLearnedIndices((prev) => new Set(prev).add(currentIndex));
    if (currentWord?.id) {
      api.submitReview({
        word_id: currentWord.id,
        quality_rating: 4,
        review_type: 'flashcard',
      }).catch(() => {});
    }
    handleNextFlashcard();
  };

  // Written Test handlers (Strict 100% exact match)
  const handleCheckWritten = () => {
    if (!typedInput.trim() || typedStatus === 'correct' || typedStatus === 'revealed') return;

    const userClean = typedInput.trim().toLowerCase().replace(/\s+/g, ' ');
    const expectedClean = currentWord.english_word.trim().toLowerCase().replace(/\s+/g, ' ');

    const variants = expectedClean
      .split(/[/;,]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const isMatch = userClean === expectedClean || variants.includes(userClean);

    if (currentWord?.id) {
      api.submitReview({
        word_id: currentWord.id,
        quality_rating: isMatch ? 5 : 1,
        review_type: 'typed',
        user_answer: userClean,
      }).catch(() => {});
    }

    if (isMatch) {
      // 100% to'g'ri!
      setTypedStatus('correct');
      triggerCelebration();
      handleSpeak(currentWord.english_word);

      setTimeout(() => {
        if (currentIndex + 1 < words.length) {
          setCurrentIndex((prev) => prev + 1);
          setTypedInput('');
          setTypedStatus('typing');
        } else {
          setPhase('completed');
          triggerCelebration();
        }
      }, 1200);
    } else {
      // Xato!
      setInputShaking(true);
      setTimeout(() => setInputShaking(false), 450);
      setTypedStatus('incorrect');
      setTestMistakes((prev) => prev + 1);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  };

  const handleRevealAnswer = () => {
    setTypedStatus('revealed');
    handleSpeak(currentWord.english_word);
    if (currentWord?.id) {
      api.submitReview({
        word_id: currentWord.id,
        quality_rating: 1,
        review_type: 'typed',
        user_answer: 'revealed',
      }).catch(() => {});
    }
  };

  const handleProceedAfterReveal = () => {
    if (currentIndex + 1 < words.length) {
      setCurrentIndex((prev) => prev + 1);
      setTypedInput('');
      setTypedStatus('typing');
    } else {
      setPhase('completed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-dark-900 border border-dark-750 w-full max-w-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-dark-800 pb-3 sm:pb-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {phase === 'flashcard' ? '1-BOSQICH: FLASHCARD BILAN YODLASH' : phase === 'test' ? '2-BOSQICH: YOZMA TEST (SPELLING)' : 'YAKUNLANDI'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">{title}</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Phase Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 bg-dark-950 p-1.5 rounded-2xl border border-dark-800 text-xs font-bold relative z-10">
          <button
            onClick={() => {
              setPhase('flashcard');
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              phase === 'flashcard'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Flashcard orqali yodlash</span>
          </button>

          <button
            onClick={() => {
              setPhase('test');
              setCurrentIndex(0);
              setTypedInput('');
              setTypedStatus('typing');
            }}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              phase === 'test'
                ? 'bg-gradient-to-r from-brand-600 to-accent-violet text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>2. Yozma test topshirish</span>
          </button>
        </div>

        {/* Progress Bar */}
        {phase !== 'completed' && (
          <div className="space-y-1.5 relative z-10">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>
                So'z: <strong className="text-white">{currentIndex + 1}</strong> / {words.length}
                {phase === 'flashcard' && learnedIndices.size > 0 && (
                  <span className="ml-2 text-emerald-400 font-sans text-[11px] font-semibold">
                    ({learnedIndices.size} ta yodlandi)
                  </span>
                )}
              </span>
              <span>{Math.round(((currentIndex + 1) / words.length) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-dark-950 border border-dark-800 overflow-hidden">
              <div
                style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
                className="h-full bg-gradient-to-r from-brand-500 to-accent-violet rounded-full transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col justify-center relative z-10 min-h-[300px]">
          {/* PHASE 1: FLASHCARD */}
          {phase === 'flashcard' && (
            <div className="space-y-6">
              <div
                onClick={() => setIsFlipped((prev) => !prev)}
                className={`p-8 rounded-3xl border transition-all duration-300 cursor-pointer min-h-[230px] flex flex-col items-center justify-center text-center relative shadow-xl select-none ${
                  isFlipped
                    ? 'bg-dark-850/90 border-emerald-500/40 ring-1 ring-emerald-500/30'
                    : 'bg-dark-850/90 border-brand-500/40 hover:border-brand-500/70 ring-1 ring-brand-500/20'
                }`}
              >
                <span className="absolute top-4 right-4 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                  <RotateCw className="w-3.5 h-3.5" /> Ag'darish uchun bosing
                </span>

                {!isFlipped ? (
                  // Front: English
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-400 bg-brand-500/15 px-2.5 py-1 rounded-md">
                      INGLIZCHA SO'Z
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {currentWord.english_word}
                    </h2>
                    {currentWord.phonetic && (
                      <p className="text-sm font-mono text-slate-400">{currentWord.phonetic}</p>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(currentWord.english_word);
                      }}
                      className="p-2.5 rounded-full bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 mx-auto transition-colors"
                      title="Talaffuzni eshitish"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  // Back: Uzbek Translation & Examples
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-md">
                      O'ZBEKCHA TARJIMASI
                    </span>
                    <h2 className="text-3xl font-black text-emerald-400 tracking-tight">
                      {currentWord.uzbek_translation}
                    </h2>
                    {currentWord.part_of_speech && (
                      <span className="inline-block text-xs font-mono px-2 py-0.5 rounded bg-dark-800 text-slate-400 border border-dark-700">
                        {currentWord.part_of_speech}
                      </span>
                    )}
                    {currentWord.examples && currentWord.examples.length > 0 && (
                      <p className="text-xs text-slate-300 italic max-w-md pt-2 border-t border-dark-800">
                        "{currentWord.examples[0].sentence_en}" — {currentWord.examples[0].sentence_uz}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Flashcard Controls */}
              <div className="flex items-center justify-between gap-3">
                <button
                  disabled={currentIndex === 0}
                  onClick={handlePrevFlashcard}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-300 text-xs font-bold disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Oldingisi</span>
                </button>

                <button
                  onClick={handleMarkLearned}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Yodladim!</span>
                </button>

                <button
                  onClick={handleNextFlashcard}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow-brand transition-all"
                >
                  <span>{currentIndex + 1 === words.length ? 'Yozma testga o\'tish' : 'Keyingisi'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* PHASE 2: WRITTEN TEST (100% exact match) */}
          {phase === 'test' && (
            <div className="space-y-6">
              <div
                className={`p-8 rounded-3xl bg-dark-850/90 border transition-all duration-300 text-center space-y-4 shadow-xl ${
                  typedStatus === 'correct'
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/20'
                    : typedStatus === 'revealed'
                    ? 'border-amber-500/40 bg-amber-950/15'
                    : inputShaking
                    ? 'border-rose-500 animate-shake ring-2 ring-rose-500/30'
                    : 'border-dark-750'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  O'ZBEKCHA MA'NOSI:
                </span>
                <h3 className="text-3xl font-black text-white">{currentWord.uzbek_translation}</h3>

                {/* Input box */}
                {typedStatus !== 'revealed' && (
                  <div className="max-w-md mx-auto space-y-2 pt-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={typedInput}
                      onChange={(e) => {
                        setTypedInput(e.target.value);
                        if (typedStatus === 'incorrect') setTypedStatus('typing');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCheckWritten();
                      }}
                      placeholder="Inglizcha so'zni yozing..."
                      disabled={typedStatus === 'correct'}
                      autoComplete="off"
                      spellCheck="false"
                      className={`w-full px-5 py-3.5 rounded-2xl bg-dark-950 text-white font-mono text-center text-lg font-bold border focus:outline-none transition-all ${
                        typedStatus === 'correct'
                          ? 'border-emerald-500 text-emerald-400'
                          : inputShaking
                          ? 'border-rose-500 text-rose-300'
                          : 'border-dark-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'
                      }`}
                    />

                    {typedStatus === 'incorrect' && (
                      <p className="text-xs text-rose-400 font-semibold animate-pop-in">
                        ❌ Noto'g'ri. 100% to'g'ri yozilishi kerak. Qayta urinib ko'ring!
                      </p>
                    )}
                  </div>
                )}

                {/* Revealed state */}
                {typedStatus === 'revealed' && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-pop-in">
                    <span className="text-xs font-bold text-amber-300">To'g'ri so'z:</span>
                    <h4 className="text-2xl font-black text-white font-mono tracking-wide">
                      {currentWord.english_word}
                    </h4>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3">
                {typedStatus !== 'revealed' ? (
                  <>
                    <button
                      onClick={handleRevealAnswer}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-400 hover:text-amber-300 text-xs font-semibold transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>Bilmayman (Javobni ko'rish)</span>
                    </button>

                    <button
                      onClick={handleCheckWritten}
                      className="flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-black shadow-glow-brand transition-all active:scale-95"
                    >
                      <span>Tekshirish</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleProceedAfterReveal}
                    className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-md"
                  >
                    Tushundim, keyingi so'zga o'tish ➔
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PHASE 3: COMPLETED */}
          {phase === 'completed' && (
            <div className="text-center py-8 space-y-5 animate-pop-in">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
                <Trophy className="w-10 h-10 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-2xl font-black text-white">Ajoyib natija! 🎉</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  Siz <strong>"{title}"</strong> bo'yicha barcha <strong>{words.length} ta so'zni</strong> avval flashcardda yodlab, so'ngra 100% yozma testdan muvaffaqiyatli o'tdingiz!
                </p>
              </div>

              <div className="flex justify-center gap-4 py-2">
                <div className="px-4 py-2 rounded-xl bg-dark-850 border border-dark-800 text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Yodlangan so'zlar</span>
                  <span className="text-base font-bold text-emerald-400">{words.length} / {words.length}</span>
                </div>
                <div className="px-4 py-2 rounded-xl bg-dark-850 border border-dark-800 text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Yozma xatolar</span>
                  <span className="text-base font-bold text-amber-400">{testMistakes} ta</span>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-3">
                <button
                  onClick={() => {
                    setPhase('flashcard');
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  Qaytadan yodlash
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-black shadow-glow-brand transition-all"
                >
                  Yakunlash
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
