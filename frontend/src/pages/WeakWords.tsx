import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Volume2,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { WeakWord } from '../types';

interface WeakWordsProps {
  onStartTargetedReview: () => void;
}

export const WeakWords: React.FC<WeakWordsProps> = ({ onStartTargetedReview }) => {
  const [weakWords, setWeakWords] = useState<WeakWord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeakWords = async () => {
      try {
        setLoading(true);
        const data = await api.getWeakWords(50);
        setWeakWords(data);
      } catch (err) {
        console.error('Failed to load weak words:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWeakWords();
  }, []);

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4 animate-pulse">
        <div className="h-28 rounded-2xl bg-dark-900 border border-dark-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-dark-900 border border-dark-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Top Banner */}
      <div className="p-4 sm:p-6 lg:p-8 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-rose-950/30 border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 shadow-xl">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Shaxsiy Tahlil
            </span>
            <span className="text-xs text-slate-400">
              {weakWords.length} ta e'tibor talab qiluvchi so'z
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Zaif So'zlar Laboratoriyasi</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Takrorlashlar va testlarda eng ko'p adashilgan yoki unutilgan so'zlar ro'yxati. Bu so'zlarga alohida e'tibor qaratish orqali xotiradagi bo'shliqlarni to'ldirasiz.
          </p>
        </div>

        {weakWords.length > 0 && (
          <button
            onClick={onStartTargetedReview}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-glow-rose transition-all shrink-0 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Zaif so'zlarni mustahkamlash</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Words Grid */}
      {weakWords.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-dark-900 border border-dark-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">Ajoyib natija! Zaif so'zlar topilmadi</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Hozircha sizda qiyinchilik tug'dirayotgan so'zlar yo'q yoki barcha takrorlangan so'zlar yuqori aniqlikda o'zlashtirilgan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weakWords.map((word) => (
            <div
              key={word.id}
              className="p-5 rounded-2xl bg-dark-900 border border-dark-800 hover:border-rose-500/40 transition-all space-y-3 group shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white group-hover:text-rose-300 transition-colors">
                    {word.english_word}
                  </h3>
                  {word.cefr_level && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-800 text-slate-400 border border-dark-700 font-mono font-bold">
                      {word.cefr_level}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleSpeak(word.english_word)}
                  className="p-1.5 rounded-lg bg-dark-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
                  title="Talaffuz"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm font-semibold text-rose-400">
                {word.uzbek_translation}
              </p>

              <div className="pt-2 border-t border-dark-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-rose-400 font-medium">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {word.times_incorrect} marta xato ({word.accuracy_percent}%)
                </span>
                <span className="text-[11px] text-slate-500">
                  Jami: {word.times_reviewed} takrorlash
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
