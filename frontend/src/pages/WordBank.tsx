import React, { useEffect, useState } from 'react';
import {
  Search,
  Volume2,
  Trash2,
  BookOpen,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { api } from '../api/client';
import { Word } from '../types';

interface WordBankProps {
  onOpenAddWord: () => void;
  initialFilterMastered?: boolean;
}

export const WordBank: React.FC<WordBankProps> = ({
  onOpenAddWord,
  initialFilterMastered = false,
}) => {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCefr, setSelectedCefr] = useState<string>('');
  const [filterWeak, setFilterWeak] = useState<boolean | undefined>(undefined);
  const [filterMastered, setFilterMastered] = useState<boolean | undefined>(
    initialFilterMastered ? true : undefined
  );

  useEffect(() => {
    setFilterMastered(initialFilterMastered ? true : undefined);
    setFilterWeak(undefined);
  }, [initialFilterMastered]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const data = await api.getWords({
        search: search || undefined,
        cefr_level: selectedCefr || undefined,
        is_weak: filterWeak,
        is_mastered: filterMastered,
        limit: 100,
      });
      setWords(data);
    } catch (err) {
      console.error('Failed to load words:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWords();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCefr, filterWeak, filterMastered]);

  const handleDelete = async (id: string, word: string) => {
    if (!window.confirm(`"${word}" so'zini lug'atdan o'chirishga ishonchingiz komilmi?`)) return;
    try {
      await api.deleteWord(id);
      setWords((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      alert("So'zni o'chirib bo'lmadi");
    }
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            {filterMastered === true ? (
              <>
                <CheckCircle className="w-5 sm:w-6 h-5 sm:h-6 text-emerald-400" />
                <span>O'zlashtirilgan So'zlar</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                  {words.length} ta so'z
                </span>
              </>
            ) : (
              <>
                <BookOpen className="w-5 sm:w-6 h-5 sm:h-6 text-brand-400" />
                <span>Mening Lug'at Bankim</span>
              </>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filterMastered === true
              ? "Ketma-ket kamida 3 marta to'g'ri topilib, uzoq muddatli xotiraga muhrlangan so'zlar"
              : "Shaxsiy lug'at boyligingiz, izlash, filtrlash va talaffuzni tinglash"}
          </p>
        </div>

        <button
          onClick={onOpenAddWord}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-glow-brand transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi so'z qo'shish</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-dark-900 border border-dark-800 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Search input */}
        <div className="w-full md:flex-1 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Inglizcha so'z yoki o'zbekcha tarjimasi bo'yicha qidiring..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-850 border border-dark-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Filters Wrapper */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* CEFR Level filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-xs text-slate-400 hidden sm:inline">Daraja:</span>
            <select
              value={selectedCefr}
              onChange={(e) => setSelectedCefr(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">Barcha darajalar</option>
              <option value="A1">A1 — Boshlang'ich</option>
              <option value="A2">A2 — Elementar</option>
              <option value="B1">B1 — O'rta (Intermediate)</option>
              <option value="B2">B2 — Yuqori o'rta</option>
              <option value="C1">C1 — Ilg'or</option>
              <option value="C2">C2 — Mukammal</option>
            </select>
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1 bg-dark-850 p-1 rounded-xl border border-dark-700 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => {
                setFilterWeak(undefined);
                setFilterMastered(undefined);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterWeak === undefined && filterMastered === undefined
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hammasi
            </button>
            <button
              onClick={() => {
                setFilterWeak(true);
                setFilterMastered(undefined);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterWeak === true
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Zaif so'zlar
            </button>
            <button
              onClick={() => {
                setFilterMastered(true);
                setFilterWeak(undefined);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterMastered === true
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              O'zlashtirilgan
            </button>
          </div>
        </div>
      </div>


      {/* Words Grid / List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Lug'at yuklanmoqda...</div>
      ) : words.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-dark-900 border border-dark-800 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-white">Hech qanday so'z topilmadi</h4>
          <p className="text-xs text-slate-400">
            Qidiruv so'zini o'zgartirib ko'ring yoki yangi so'z qo'shing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {words.map((word) => {
            const isWeak = word.progress?.is_weak;
            const isMastered = word.progress?.is_mastered;

            return (
              <div
                key={word.id}
                className="p-5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-dark-700 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white group-hover:text-brand-300 transition-colors">
                        {word.english_word}
                      </h3>
                      {word.cefr_level && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 font-mono font-bold">
                          {word.cefr_level}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSpeak(word.english_word)}
                        className="p-1.5 rounded-lg bg-dark-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 transition-colors"
                        title="Talaffuzni tinglash"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(word.id, word.english_word)}
                        className="p-1.5 rounded-lg bg-dark-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-emerald-400">
                    {word.uzbek_translation}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {word.phonetic && <span className="font-mono">{word.phonetic}</span>}
                    {word.part_of_speech && (
                      <span className="italic text-slate-500">({word.part_of_speech})</span>
                    )}
                  </div>

                  {word.examples && word.examples.length > 0 && (
                    <div className="pt-2 border-t border-dark-800 space-y-1">
                      <p className="text-xs text-slate-300 font-medium">
                        "{word.examples[0].sentence_en}"
                      </p>
                      <p className="text-[11px] text-slate-400">
                        "{word.examples[0].sentence_uz}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom learning status */}
                <div className="pt-3 border-t border-dark-800 flex items-center justify-between text-[11px]">
                  {isWeak ? (
                    <span className="flex items-center gap-1 text-rose-400 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> Zaif so'z
                    </span>
                  ) : isMastered ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" /> O'zlashtirilgan
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" /> O'rganilmoqda
                    </span>
                  )}

                  <span className="text-slate-500 font-mono">
                    {word.progress?.times_reviewed || 0} marta takrorlangan
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
