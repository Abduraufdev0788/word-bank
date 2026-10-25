import React, { useState } from 'react';
import { Sparkles, X, Plus, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { WordBatch } from '../../types';

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWordAdded: () => void;
  batches?: WordBatch[];
}

export const AddWordModal: React.FC<AddWordModalProps> = ({
  isOpen,
  onClose,
  onWordAdded,
  batches = [],
}) => {
  const [englishWord, setEnglishWord] = useState('');
  const [uzbekTranslation, setUzbekTranslation] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [cefrLevel, setCefrLevel] = useState('B1');
  const [exampleEn, setExampleEn] = useState('');
  const [exampleUz, setExampleUz] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEnrichWithAI = async () => {
    if (!englishWord.trim()) {
      setError("Iltimos, avval inglizcha so'zni yozing");
      return;
    }

    setEnriching(true);
    setError(null);
    try {
      const result = await api.enrichWord(englishWord.trim());
      setUzbekTranslation(result.uzbek_translation || '');
      setPartOfSpeech(result.part_of_speech || '');
      setPhonetic(result.phonetic || '');
      setCefrLevel(result.cefr_level || 'B1');

      if (result.examples && result.examples.length > 0) {
        setExampleEn(result.examples[0].sentence_en || '');
        setExampleUz(result.examples[0].sentence_uz || '');
      }
    } catch (err: any) {
      setError("AI tarjimasida xatolik yuz berdi. Qo'lda to'ldirishingiz mumkin.");
    } finally {
      setEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!englishWord.trim() || !uzbekTranslation.trim()) {
      setError("Inglizcha so'z va o'zbekcha tarjima majburiy");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const examples =
        exampleEn.trim() && exampleUz.trim()
          ? [{ sentence_en: exampleEn.trim(), sentence_uz: exampleUz.trim() }]
          : undefined;

      await api.createWord({
        english_word: englishWord.trim(),
        uzbek_translation: uzbekTranslation.trim(),
        part_of_speech: partOfSpeech.trim() || undefined,
        phonetic: phonetic.trim() || undefined,
        cefr_level: cefrLevel,
        batch_id: selectedBatchId || undefined,
        examples,
      });

      onWordAdded();
      onClose();
      // Reset form
      setEnglishWord('');
      setUzbekTranslation('');
      setPartOfSpeech('');
      setPhonetic('');
      setExampleEn('');
      setExampleUz('');
    } catch (err: any) {
      setError(err.message || "So'zni saqlashda xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-dark-900 border border-dark-750 w-full max-w-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-dark-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-white">Yangi Lug'at So'zi Qo'shish</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* English word & AI button */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Inglizcha so'z yoki ibora *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={englishWord}
                onChange={(e) => setEnglishWord(e.target.value)}
                placeholder="Masalan: serendipity, resilient, embrace"
                className="flex-1 px-4 py-2.5 rounded-xl bg-dark-850 border border-dark-700 text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                disabled={enriching || !englishWord.trim()}
                onClick={handleEnrichWithAI}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600/20 hover:bg-brand-600 border border-brand-500/30 text-brand-300 hover:text-white text-xs font-bold transition-all disabled:opacity-50"
                title="Google Gemini AI orqali avtomatik tarjima va misollar olish"
              >
                {enriching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">AI bilan to'ldirish</span>
              </button>
            </div>
          </div>

          {/* Uzbek translation */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              O'zbekcha tarjimasi *
            </label>
            <input
              type="text"
              required
              value={uzbekTranslation}
              onChange={(e) => setUzbekTranslation(e.target.value)}
              placeholder="Masalan: kutilmagan baxtli topilma, bardoshli"
              className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-dark-700 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Details row: Part of speech, phonetic, CEFR */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">So'z turkumi</label>
              <input
                type="text"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="noun, verb..."
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Transkripsiya</label>
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="/.../"
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Daraja</label>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Example Sentence */}
          <div className="space-y-2 p-3 rounded-xl bg-dark-850 border border-dark-800">
            <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">
              Misol Jumla (Ixtiyoriy)
            </span>
            <input
              type="text"
              value={exampleEn}
              onChange={(e) => setExampleEn(e.target.value)}
              placeholder="Inglizcha misol: Finding the book was pure serendipity."
              className="w-full px-3 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
            <input
              type="text"
              value={exampleUz}
              onChange={(e) => setExampleUz(e.target.value)}
              placeholder="O'zbekcha tarjimasi: Kitobni topish kutilmagan baxtli tasodif bo'ldi."
              className="w-full px-3 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Destination batch */}
          {batches.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">To'plamga biriktirish:</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="">Avtomatik (navbatdagi to'liq bo'lmagan to'plamga)</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    To'plam #{b.batch_number}: {b.title} ({b.word_count}/20)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-4 border-t border-dark-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-semibold"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow-brand transition-all disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : "Lug'atga saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
