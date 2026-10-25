import React, { useEffect, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  BrainCircuit,
  Sparkles,
  HelpCircle,
  Volume2,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Search,
  BookOpen,
  Clock,
  ArrowLeft,
  Trash2,
  Plus,
  Flame,
} from 'lucide-react';
import { api } from '../api/client';
import { MiniStory, WordBatch } from '../types';
import { useStudyTime } from '../context/StudyTimeContext';
import { BatchStudyModal } from '../components/study/BatchStudyModal';

interface MiniStoriesProps {
  initialBatchId?: string;
  onClearInitialBatch?: () => void;
}

interface ToastMessage {
  text: string;
  type: 'loading' | 'success' | 'info' | 'error';
}

type ViewMode = 'library' | 'reader';

export const MiniStories: React.FC<MiniStoriesProps> = ({
  initialBatchId,
  onClearInitialBatch,
}) => {
  const { startSession, endSession } = useStudyTime();
  const [stories, setStories] = useState<MiniStory[]>([]);
  const [batches, setBatches] = useState<WordBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // View state: 'library' (catalog/browser) or 'reader' (reading active story)
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [activeStory, setActiveStory] = useState<MiniStory | null>(null);
  const [showUzbek, setShowUzbek] = useState(false);

  // Generation Modal & Form state
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedCefr, setSelectedCefr] = useState('B1');
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || '');
  const [generating, setGenerating] = useState(false);

  // Library Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCefr, setFilterCefr] = useState<string>('ALL');

  // Comprehension test states
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  // Word double-click addition state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [storyWords, setStoryWords] = useState<Array<{
    english_word: string;
    uzbek_translation: string;
    phonetic?: string;
    part_of_speech?: string;
  }>>([]);
  const [addedWordSet, setAddedWordSet] = useState<Set<string>>(new Set());

  // Batch Study Modal state (Flashcard -> Written test)
  const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
  const [storyBatchId, setStoryBatchId] = useState<string | null>(null);

  // Fetch all stories and batches on mount
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [storyList, batchList] = await Promise.all([
        api.getStories({ limit: 100 }).catch(() => []),
        api.getBatches().catch(() => []),
      ]);

      // Ensure stories are sorted strictly newest first
      const sorted = [...storyList].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      setStories(sorted);
      setBatches(batchList);

      if (initialBatchId) {
        setSelectedBatchId(initialBatchId);
        setIsGeneratorOpen(true);
      } else if (sorted.length > 0 && !activeStory) {
        setActiveStory(sorted[0]);
      }
    } catch (err) {
      console.error('Failed to load stories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (activeStory && viewMode === 'reader') {
      setStoryBatchId(null);
      startSession('story');
      loadStoryWords(activeStory);
    }
    return () => {
      endSession();
    };
  }, [activeStory, viewMode]);

  // Load existing words for active story batch
  const loadStoryWords = async (story: MiniStory) => {
    try {
      const storyBatchTitle = `Hikoya: ${story.title_en}`;
      const allBatches = await api.getBatches();
      const existingBatch = allBatches.find(
        (b) => b.title.toLowerCase() === storyBatchTitle.toLowerCase()
      );

      const items: Array<{
        english_word: string;
        uzbek_translation: string;
        phonetic?: string;
        part_of_speech?: string;
      }> = [];

      if (existingBatch) {
        setStoryBatchId(existingBatch.id);
        const detail = await api.getBatchDetail(existingBatch.id);
        if (detail.words) {
          detail.words.forEach((w) => {
            items.push({
              english_word: w.english_word,
              uzbek_translation: w.uzbek_translation,
              phonetic: w.phonetic,
              part_of_speech: w.part_of_speech,
            });
            setAddedWordSet((prev) => new Set(prev).add(w.english_word.toLowerCase()));
          });
        }
      } else {
        // Pre-create batch in background so first double click has zero delay
        api.createBatch(storyBatchTitle).then((b) => setStoryBatchId(b.id)).catch(() => {});
      }

      // If story has target words, include them
      if (story.used_target_words) {
        story.used_target_words.forEach((tw) => {
          if (!items.some((i) => i.english_word.toLowerCase() === tw.toLowerCase())) {
            items.push({
              english_word: tw.toLowerCase(),
              uzbek_translation: "nishon so'z",
            });
          }
        });
      }

      setStoryWords(items);
    } catch {
      // ignore
    }
  };

  // Generate new story with Google Gemini
  const handleGenerateStory = async () => {
    setGenerating(true);
    setSelectedAnswers({});
    setShowQuizResults(false);
    try {
      const newStory = await api.generateStory({
        cefr_level: selectedCefr,
        batch_id: selectedBatchId || undefined,
      });

      // Insert at the VERY BEGINNING (Newest First)
      setStories((prev) => [newStory, ...prev]);
      setActiveStory(newStory);
      setIsGeneratorOpen(false);
      setViewMode('reader');

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
      });

      if (onClearInitialBatch) {
        onClearInitialBatch();
      }
    } catch (err: any) {
      alert(`Hikoya yaratishda xatolik: ${err.message || "Gemini AI bilan bog'lanishda xato"}`);
    } finally {
      setGenerating(false);
    }
  };

  // Delete a saved story
  const handleDeleteStory = async (storyId?: string, title?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!storyId) return;

    if (!window.confirm(`"${title || 'Ushbu'}" hikoyani o'chirishga ishonchingiz komilmi?`)) {
      return;
    }

    try {
      await api.deleteStory(storyId);
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      if (activeStory?.id === storyId) {
        const remaining = stories.filter((s) => s.id !== storyId);
        setActiveStory(remaining.length > 0 ? remaining[0] : null);
        if (remaining.length === 0) {
          setViewMode('library');
        }
      }
      setToast({ text: "Hikoya muvaffaqiyatli o'chirildi", type: 'info' });
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      alert(`Hikoyani o'chirishda xatolik: ${err.message}`);
    }
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.88;
      window.speechSynthesis.speak(u);
    }
  };

  // Double click word saving
  const handleWordDoubleClick = async (rawWord: string) => {
    if (!activeStory) return;

    const clean = rawWord.replace(/[^a-zA-Z'-]/g, '').trim().toLowerCase();
    if (clean.length < 2) return;

    handleSpeak(clean);

    if (addedWordSet.has(clean)) {
      setToast({
        text: `ℹ️ "${clean}" allaqachon to'plamga qo'shilgan!`,
        type: 'info',
      });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setAddedWordSet((prev) => new Set(prev).add(clean));
    const storyBatchTitle = `Hikoya: ${activeStory.title_en}`;
    setToast({ text: `"${clean}" so'zi saqlanmoqda...`, type: 'loading' });

    try {
      let targetBatchId = storyBatchId;
      if (!targetBatchId) {
        const batch = await api.createBatch(storyBatchTitle);
        targetBatchId = batch.id;
        setStoryBatchId(batch.id);
      }

      const sentences = activeStory.content_en.match(/[^.!?\n]+[.!?\n]+/g) || [activeStory.content_en];
      const cleanRegex = new RegExp(`\\b${clean}\\b`, 'i');
      const surroundingSentence = sentences.find((s) => cleanRegex.test(s))?.trim().slice(0, 160) || undefined;

      let translation = clean;
      try {
        const quick = await api.quickTranslate(clean);
        if (quick.translated_text && quick.translated_text.toLowerCase() !== clean.toLowerCase()) {
          translation = quick.translated_text;
        } else {
          const enrich = await api.enrichWord(clean, surroundingSentence);
          translation = enrich.uzbek_translation || clean;
        }
      } catch {
        try {
          const enrich = await api.enrichWord(clean, surroundingSentence);
          translation = enrich.uzbek_translation || clean;
        } catch {
          translation = clean;
        }
      }

      await api.createWord({
        english_word: clean,
        uzbek_translation: translation,
        batch_id: targetBatchId,
        phonetic: '',
        part_of_speech: '',
        cefr_level: activeStory.cefr_level || selectedCefr,
        examples: [],
      });

      setStoryWords((prev) => [
        ...prev.filter((w) => w.english_word.toLowerCase() !== clean),
        { english_word: clean, uzbek_translation: translation },
      ]);

      setToast({
        text: `✨ "${clean}" (${translation}) to'plamga saqlandi!`,
        type: 'success',
      });
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      if (err.message && err.message.includes('mavjud')) {
        setToast({
          text: `ℹ️ "${clean}" so'zi allaqachon lug'atingizda mavjud!`,
          type: 'info',
        });
      } else {
        setAddedWordSet((prev) => {
          const next = new Set(prev);
          next.delete(clean);
          return next;
        });
        setToast({
          text: `Xatolik: ${err.message || "So'zni qo'shib bo'lmadi"}`,
          type: 'error',
        });
      }
      setTimeout(() => setToast(null), 3500);
    }
  };

  const renderEnglishText = (content: string, targetWords: string[] = []) => {
    const lowerTargetWords = targetWords.map((w) => w.toLowerCase());
    const tokens = content.split(/(\s+|[.,!?;:"])/);

    return tokens.map((token, index) => {
      const cleanToken = token.replace(/[^a-zA-Z'-]/g, '').trim().toLowerCase();
      const isTarget = lowerTargetWords.includes(cleanToken);
      const isAdded = addedWordSet.has(cleanToken);

      if (cleanToken.length >= 2) {
        return (
          <span
            key={index}
            onMouseDown={(e) => {
              if (e.detail > 1) e.preventDefault();
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              if (window.getSelection) {
                window.getSelection()?.removeAllRanges();
              }
              handleWordDoubleClick(cleanToken);
            }}
            className={`cursor-pointer transition-colors duration-150 touch-manipulation inline select-none ${
              isTarget
                ? 'text-brand-300 font-semibold underline underline-offset-4 decoration-brand-400 decoration-2'
                : isAdded
                ? 'text-emerald-400 font-semibold underline underline-offset-4 decoration-emerald-400 decoration-2'
                : 'hover:text-brand-300'
            }`}
            title="Lug'at to'plamiga qo'shish uchun so'z ustiga 2 marta bosing (double-click)"
          >
            {token}
          </span>
        );
      }
      return token;
    });
  };

  // Filtered stories in library view
  const filteredStories = useMemo(() => {
    return stories.filter((s) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        s.title_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.title_uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content_en.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCefr =
        filterCefr === 'ALL' ||
        (s.cefr_level || 'B1').toUpperCase() === filterCefr.toUpperCase();

      return matchesSearch && matchesCefr;
    });
  }, [stories, searchQuery, filterCefr]);

  // Total metrics
  const totalTargetWords = useMemo(() => {
    return stories.reduce((sum, s) => sum + (s.used_target_words?.length || 0), 0);
  }, [stories]);

  const formatStoryDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return `Bugun, ${d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const getCefrBadgeStyle = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'A1':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'A2':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'B1':
        return 'bg-brand-500/20 text-brand-300 border-brand-500/40';
      case 'B2':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'C1':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'C2':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-brand-500/20 text-brand-300 border-brand-500/30';
    }
  };

  const handleOpenReader = (story: MiniStory) => {
    setActiveStory(story);
    setSelectedAnswers({});
    setShowQuizResults(false);
    setViewMode('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Toast Notification for Word Addition (Above mobile bottom nav) */}
      {toast && (
        <div
          style={{ zIndex: 9999 }}
          className={`fixed bottom-20 md:bottom-6 right-3 sm:right-6 max-w-[90vw] sm:max-w-md p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center gap-2.5 sm:gap-3 text-xs font-bold border backdrop-blur-md animate-pop-in ${
            toast.type === 'loading'
              ? 'bg-dark-900/95 border-brand-500/40 text-brand-300'
              : toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/30'
              : toast.type === 'info'
              ? 'bg-dark-900/95 border-cyan-500/40 text-cyan-300'
              : 'bg-rose-950/95 border-rose-500/50 text-rose-300'
          }`}
        >
          {toast.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-brand-400 shrink-0" />}
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'info' && <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span className="truncate">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navigation & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-dark-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-violet text-white flex items-center justify-center shadow-glow-brand">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>AI Mini Hikoyalar</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  GEMINI AI
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Kontekstual lug'at o'rganish, so'z ustiga 2 marta bosish va CEFR tushunish testi
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Pills & Yangi Hikoya Button */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center p-1 rounded-xl bg-dark-900 border border-dark-800 text-xs font-bold flex-1 sm:flex-initial">
            <button
              onClick={() => setViewMode('library')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                viewMode === 'library'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Kutubxona ({stories.length})</span>
            </button>

            <button
              onClick={() => {
                if (!activeStory && stories.length > 0) {
                  setActiveStory(stories[0]);
                }
                setViewMode('reader');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                viewMode === 'reader'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>O'qish Zali</span>
            </button>
          </div>

          <button
            onClick={() => setIsGeneratorOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Yangi Hikoya</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: HIKOYALAR KUTUBXONASI / RO'YXATI (LIBRARY VIEW - NEWEST FIRST)     */}
      {/* ========================================================================= */}
      {viewMode === 'library' && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Metrics & Overview Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-dark-900 border border-dark-800 shadow-md">
              <span className="text-[11px] font-bold text-slate-400">Jami hikoyalar</span>
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                {stories.length}
              </p>
              <p className="text-[10px] text-brand-400 mt-1 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Eng so'nggilari tepada
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-dark-900 border border-dark-800 shadow-md">
              <span className="text-[11px] font-bold text-slate-400">Qamrab olingan so'zlar</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight mt-0.5">
                {totalTargetWords}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Kontekstda yodlangan</p>
            </div>

            <div className="p-4 rounded-2xl bg-dark-900 border border-dark-800 shadow-md col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-400">CEFR Qamrovi</span>
              <p className="text-2xl sm:text-3xl font-black text-violet-300 tracking-tight mt-0.5 font-mono">
                A1 — C2
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Barcha darajalarda</p>
            </div>
          </div>

          {/* Search Bar & CEFR Level Filter Row */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-dark-900 border border-dark-800 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Hikoya nomi yoki matni bo'yicha qidiring..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-dark-850 border border-dark-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* CEFR Level filter chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-mono font-bold select-none">
                <button
                  onClick={() => setFilterCefr('ALL')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    filterCefr === 'ALL'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-750'
                  }`}
                >
                  Barchasi ({stories.length})
                </button>
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => {
                  const count = stories.filter((s) => (s.cefr_level || 'B1').toUpperCase() === lvl).length;
                  return (
                    <button
                      key={lvl}
                      onClick={() => setFilterCefr(lvl)}
                      className={`px-2.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        filterCefr === lvl
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-750'
                      }`}
                    >
                      {lvl} {count > 0 && <span className="opacity-75 text-[10px]">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stories Catalog Grid (Newest First) */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-56 rounded-2xl bg-dark-900 border border-dark-800" />
              ))}
            </div>
          ) : filteredStories.length === 0 ? (
            <div className="p-10 sm:p-14 text-center rounded-3xl bg-dark-900 border border-dark-800 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto shadow-inner">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Hikoyalar topilmadi</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {searchQuery || filterCefr !== 'ALL'
                    ? "Tanlangan qidiruv yoki daraja bo'yicha hikoyalar mavjud emas. Filtrlarni tozalab ko'ring."
                    : "Hozircha saqlangan mini hikoyalaringiz yo'q. Birinchi hikoyangizni Gemini AI orqali yarating!"}
                </p>
              </div>
              <button
                onClick={() => setIsGeneratorOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow-brand transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Yangi Hikoya Yaratish</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredStories.map((story, index) => {
                const isLatest = index === 0 && !searchQuery && filterCefr === 'ALL';
                const dateStr = formatStoryDate(story.created_at);
                const snippet = story.content_en.slice(0, 125).trim() + '...';

                return (
                  <div
                    key={story.id || index}
                    onClick={() => handleOpenReader(story)}
                    className={`p-5 rounded-2xl sm:rounded-3xl bg-dark-900 border transition-all duration-300 shadow-xl flex flex-col justify-between group cursor-pointer relative overflow-hidden ${
                      isLatest
                        ? 'border-brand-500/50 bg-gradient-to-b from-dark-900 via-dark-850 to-brand-950/20 ring-1 ring-brand-500/30 hover:border-brand-400 shadow-glow-brand'
                        : 'border-dark-800 hover:border-brand-500/40 hover:bg-dark-850'
                    }`}
                  >
                    {/* Top Status Bar */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getCefrBadgeStyle(
                              story.cefr_level
                            )}`}
                          >
                            {story.cefr_level || 'B1'} LEVEL
                          </span>
                          {isLatest && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                              <Flame className="w-3 h-3 fill-amber-400" /> Eng so'nggi
                            </span>
                          )}
                        </div>

                        {dateStr && (
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-600" /> {dateStr}
                          </span>
                        )}
                      </div>

                      {/* Titles */}
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-white group-hover:text-brand-300 transition-colors line-clamp-1">
                          {story.title_en}
                        </h3>
                        <p className="text-xs text-slate-400 italic line-clamp-1 mt-0.5 font-serif">
                          {story.title_uz}
                        </p>
                      </div>

                      {/* Content Snippet */}
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-serif">
                        {snippet}
                      </p>

                      {/* Target Words & Questions Metadata Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-300 text-[10px] font-medium border border-brand-500/20">
                          {story.used_target_words?.length || 0} ta nishon so'z
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-dark-800 text-slate-400 text-[10px] font-medium border border-dark-700">
                          {story.comprehension_questions?.length || 0} ta test savoli
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Bottom Strip */}
                    <div className="pt-4 border-t border-dark-800/80 mt-4 flex items-center justify-between gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReader(story);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>O'qish</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveStory(story);
                          setIsStudyModalOpen(true);
                        }}
                        className="py-2 px-3 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Ushbu hikoya so'zlarini Flashcard va yozma testda yodlash"
                      >
                        <Layers className="w-3.5 h-3.5 text-brand-400" />
                        <span className="hidden sm:inline">Yodlash</span>
                      </button>

                      {story.id && (
                        <button
                          onClick={(e) => handleDeleteStory(story.id, story.title_en, e)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Hikoyani o'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: HIKOYANI O'QISH ZALI (INTERACTIVE STORY READER)                    */}
      {/* ========================================================================= */}
      {viewMode === 'reader' && activeStory && (
        <div className="space-y-6 animate-fade-in">
          {/* Reader Top Bar (Back to Library + Story Switcher Carousel) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-dark-900 border border-dark-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
            <button
              onClick={() => setViewMode('library')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white text-xs font-bold border border-dark-700 transition-all self-start"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Barcha hikoyalar ({stories.length})</span>
            </button>

            {/* Quick Story Switcher Carousel (Sorted Newest First) */}
            {stories.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 md:pb-0">
                <span className="text-slate-500 font-semibold whitespace-nowrap text-[11px] mr-1">
                  Tezkor tanlash:
                </span>
                {stories.map((s, idx) => {
                  const isActive = activeStory.title_en === s.title_en;
                  const isLatest = idx === 0;

                  return (
                    <button
                      key={s.id || idx}
                      onClick={() => {
                        setActiveStory(s);
                        setSelectedAnswers({});
                        setShowQuizResults(false);
                      }}
                      className={`px-3 py-1 rounded-lg whitespace-nowrap font-medium transition-all text-xs flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-brand-600 text-white font-bold shadow-sm'
                          : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-750'
                      }`}
                    >
                      {isLatest && <Flame className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className="truncate max-w-[140px] sm:max-w-[180px]">{s.title_en}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reader Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Story Text Card (2 Columns) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl bg-dark-900 border border-dark-800 space-y-5 sm:space-y-6 shadow-2xl relative">
                {/* Story Title & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-800 pb-4 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getCefrBadgeStyle(
                          activeStory.cefr_level
                        )}`}
                      >
                        {activeStory.cefr_level || 'B1'} LEVEL
                      </span>
                      {formatStoryDate(activeStory.created_at) && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          {formatStoryDate(activeStory.created_at)}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">{activeStory.title_en}</h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-400 italic font-serif">
                      {activeStory.title_uz}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setIsStudyModalOpen(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                      title="Ushbu hikoya so'zlarini Flashcardda yodlash va yozma test topshirish"
                    >
                      <Layers className="w-4 h-4" />
                      <span>🎴 Flashcard ➔ ✍️ Yozma Test</span>
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleSpeak(activeStory.content_en)}
                        className="p-2 rounded-xl bg-dark-800 hover:bg-brand-600/30 text-slate-300 hover:text-white transition-colors"
                        title="Hikoyani to'liq tinglash"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => setShowUzbek((prev) => !prev)}
                        className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          showUzbek
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-dark-850 text-slate-300 border-dark-700 hover:text-white'
                        }`}
                      >
                        {showUzbek ? "Tarjimani yopish" : "O'zbekcha tarjima"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Word Double-Click Tip Banner */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
                    <span>
                      💡 Matndagi bilmagan so'z ustiga <strong>2 marta bosing</strong> — u avtomatik tarzda <strong>"Hikoya: {activeStory.title_en}"</strong> to'plamiga qo'shiladi!
                    </span>
                  </div>
                </div>

                {/* Target Words Pill Strip */}
                {activeStory.used_target_words && activeStory.used_target_words.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-dark-850 border border-dark-800 text-xs">
                    <span className="text-slate-400 font-semibold mr-1">O'rganilayotgan so'zlar:</span>
                    {activeStory.used_target_words.map((w, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-300 font-mono font-medium"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                )}

                {/* English Story Body with interactive tokens */}
                <div className="text-base sm:text-lg leading-relaxed text-slate-200 font-serif tracking-normal space-y-4 touch-manipulation">
                  <p className="touch-manipulation">{renderEnglishText(activeStory.content_en, activeStory.used_target_words)}</p>
                </div>

                {/* Parallel Uzbek Translation Box */}
                {showUzbek && (
                  <div className="p-5 rounded-2xl bg-dark-850 border border-dark-700/80 space-y-2 animate-fade-in">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      O'zbekcha matn:
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-300 font-serif">
                      {activeStory.content_uz}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Comprehension Quiz & Target Words (1 Column) */}
            <div className="space-y-6">
              <div className="p-5 sm:p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-6 shadow-xl sticky top-24">
                <div className="flex items-center gap-2 border-b border-dark-800 pb-3">
                  <HelpCircle className="w-5 h-5 text-brand-400" />
                  <h4 className="text-base font-bold text-white">Tushunish Testi (3 ta savol)</h4>
                </div>

                <div className="space-y-5">
                  {activeStory.comprehension_questions?.map((q, qIndex) => {
                    const userAnswer = selectedAnswers[qIndex];
                    const isCorrect = userAnswer === q.correct_option_index;

                    return (
                      <div key={qIndex} className="space-y-2.5">
                        <p className="text-xs font-semibold text-slate-200 leading-snug">
                          {qIndex + 1}. {q.question}
                        </p>

                        <div className="space-y-1.5">
                          {q.options.map((opt, optIndex) => {
                            const isSelected = userAnswer === optIndex;
                            let btnStyle = 'bg-dark-850 border-dark-750 text-slate-300 hover:border-brand-500/50';

                            if (showQuizResults) {
                              if (optIndex === q.correct_option_index) {
                                btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold';
                              } else if (isSelected && !isCorrect) {
                                btnStyle = 'bg-rose-950/60 border-rose-500 text-rose-300';
                              }
                            } else if (isSelected) {
                              btnStyle = 'bg-brand-600/30 border-brand-500 text-white font-bold';
                            }

                            return (
                              <button
                                key={optIndex}
                                disabled={showQuizResults}
                                onClick={() => {
                                  setSelectedAnswers((prev) => ({
                                    ...prev,
                                    [qIndex]: optIndex,
                                  }));
                                }}
                                className={`w-full p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {showQuizResults && optIndex === q.correct_option_index && (
                                  <span className="text-[10px] font-bold text-emerald-400">✓ To'g'ri</span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {showQuizResults && (
                          <p className="text-[11px] text-slate-400 italic bg-dark-950 p-2.5 rounded-lg border border-dark-800">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!showQuizResults ? (
                  <button
                    disabled={
                      Object.keys(selectedAnswers).length <
                      (activeStory.comprehension_questions?.length || 3)
                    }
                    onClick={() => setShowQuizResults(true)}
                    className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-bold shadow-glow-brand transition-all"
                  >
                    Javoblarni Tekshirish
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedAnswers({});
                      setShowQuizResults(false);
                    }}
                    className="w-full py-3 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-bold transition-all"
                  >
                    Qayta urinish
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: YANGI HIKOYA YARATISH MODALI (GEMINI GENERATOR MODAL)           */}
      {/* ========================================================================= */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-dark-900 border border-dark-750 w-full max-w-xl rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dark-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-glow-brand">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Yangi AI Mini Hikoya Yaratish</h3>
                  <p className="text-xs text-slate-400">Google Gemini tanlangan daraja va so'zlar bo'yicha hikoya tuzadi</p>
                </div>
              </div>

              <button
                onClick={() => setIsGeneratorOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Level selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">CEFR Darajasini tanlang:</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { lvl: 'A1', desc: 'Boshlang\'ich' },
                  { lvl: 'A2', desc: 'Elementar' },
                  { lvl: 'B1', desc: 'O\'rta' },
                  { lvl: 'B2', desc: 'Yuqori o\'rta' },
                  { lvl: 'C1', desc: 'Ilg\'or' },
                  { lvl: 'C2', desc: 'Mukammal' },
                ].map((item) => (
                  <button
                    key={item.lvl}
                    type="button"
                    onClick={() => setSelectedCefr(item.lvl)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      selectedCefr === item.lvl
                        ? 'bg-brand-600 border-brand-500 text-white font-black shadow-glow-brand'
                        : 'bg-dark-850 border-dark-750 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-mono text-sm">{item.lvl}</div>
                    <div className="text-[9px] text-slate-400">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Batch selector (Optional) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">So'zlar manbasi:</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-dark-700 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">Tasodifiy yangi hikoya ({selectedCefr} darajasidagi saralangan so'zlar)</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    To'plam #{b.batch_number}: {b.title} ({b.word_count} ta so'z)
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                disabled={generating}
                onClick={handleGenerateStory}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-accent-violet to-brand-600 hover:from-brand-500 hover:to-accent-violet text-white text-xs sm:text-sm font-bold shadow-glow-brand transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Google Gemini hikoyani yozmoqda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Hikoyani Yaratish va O'qish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FLASHCARD VA YOZMA TEST BOSQICHI (BATCH STUDY MODAL)             */}
      {/* ========================================================================= */}
      {isStudyModalOpen && activeStory && (
        <BatchStudyModal
          isOpen={isStudyModalOpen}
          onClose={() => setIsStudyModalOpen(false)}
          title={`Hikoya: ${activeStory.title_en}`}
          words={
            storyWords.length > 0
              ? storyWords
              : (activeStory.used_target_words || []).map((w) => ({
                  english_word: w,
                  uzbek_translation: "nishon so'z",
                }))
          }
        />
      )}
    </div>
  );
};
