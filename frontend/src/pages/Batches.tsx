import React, { useEffect, useState } from 'react';
import {
  Layers,
  Brain,
  Clock,
  X,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { WordBatch, Word } from '../types';
import { BatchStudyModal } from '../components/study/BatchStudyModal';

interface BatchesProps {
  onStartBatchStory: (batchId: string) => void;
  onOpenImport: () => void;
}

export const Batches: React.FC<BatchesProps> = ({ onStartBatchStory, onOpenImport }) => {
  const [batches, setBatches] = useState<WordBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<WordBatch | null>(null);
  const [batchWords, setBatchWords] = useState<Word[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);

  // 2-Step Study Modal State (Flashcard -> Written test)
  const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
  const [studyTitle, setStudyTitle] = useState('');
  const [studyWords, setStudyWords] = useState<Word[]>([]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const data = await api.getBatches();
      setBatches(data);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleInspectBatch = async (batch: WordBatch) => {
    setSelectedBatch(batch);
    setLoadingWords(true);
    try {
      const detail = await api.getBatchDetail(batch.id);
      setBatchWords(detail.words || []);
    } catch (err) {
      console.error('Failed to fetch batch words:', err);
    } finally {
      setLoadingWords(false);
    }
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const handleStartStudy = async (batch: WordBatch) => {
    try {
      setLoading(true);
      const detail = await api.getBatchDetail(batch.id);
      const words = detail.words || [];
      if (words.length === 0) {
        alert("Ushbu to'plamda hali so'zlar mavjud emas!");
        return;
      }
      setStudyTitle(batch.title);
      setStudyWords(words);
      setIsStudyModalOpen(true);
    } catch (err) {
      console.error('Failed to start batch study:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-dark-900 border border-dark-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Layers className="w-5 sm:w-6 h-5 sm:h-6 text-brand-400" />
            <span>Lug'at To'plamlari (20 talik)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Barcha so'zlaringiz xotirani zo'riqtirmaslik uchun avtomatik 20 talik ixcham to'plamlarga ajratilgan.
          </p>
        </div>

        <button
          onClick={onOpenImport}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-glow-brand transition-all text-center justify-center"
        >
          Yangi fayl yuklash
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl bg-dark-900 border border-dark-800 space-y-3">
          <Layers className="w-10 h-10 text-slate-500 mx-auto" />
          <h4 className="text-base font-bold text-white">Hozircha to'plamlar mavjud emas</h4>
          <p className="text-xs text-slate-400">
            Fayl import qiling yoki so'z qo'shing, tizim avtomatik 20 talik to'plamlarni yaratadi.
          </p>
          <button
            onClick={onOpenImport}
            className="mt-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold"
          >
            Fayl yuklash
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {batches.map((batch) => {
            const isFull = batch.word_count >= 20;

            return (
              <div
                key={batch.id}
                className="p-5 sm:p-6 rounded-2xl bg-dark-900 border border-dark-800 hover:border-brand-500/40 transition-all shadow-lg flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-brand-500/15 text-brand-400 border border-brand-500/30">
                      To'plam #{batch.batch_number}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isFull
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {batch.word_count}/20 so'z
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">
                      {batch.title}
                    </h3>
                    {batch.source_file_name && (
                      <p className="text-[11px] text-slate-500 truncate">
                        Manba: {batch.source_file_name}
                      </p>
                    )}
                  </div>

                  {batch.due_count !== undefined && batch.due_count > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{batch.due_count} ta so'z takrorlashga tayyor</span>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-dark-800 mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleStartStudy(batch)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-glow-brand transition-all active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>🎴 Flashcard ➔ ✍️ Yozma Test</span>
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleInspectBatch(batch)}
                      className="flex-1 py-2 px-3 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-200 text-xs font-semibold transition-colors text-center"
                    >
                      So'zlar ro'yxati
                    </button>
                    <button
                      onClick={() => onStartBatchStory(batch.id)}
                      className="py-2 px-3 rounded-lg bg-brand-600/20 hover:bg-brand-600 text-brand-300 hover:text-white border border-brand-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                      title="Ushbu to'plamdagi barcha so'zlar ishtirokida hikoya yaratish"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>AI Hikoya</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Word Inspection Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-700 w-full max-w-3xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-dark-800 pb-4">
              <div>
                <span className="text-xs font-mono text-brand-400 font-bold">
                  To'plam #{selectedBatch.batch_number}
                </span>
                <h3 className="text-xl font-black text-white">{selectedBatch.title}</h3>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {loadingWords ? (
                <div className="py-12 text-center text-slate-400 text-xs">Yuklanmoqda...</div>
              ) : batchWords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Ushbu to'plamda hali so'zlar mavjud emas.
                </div>
              ) : (
                batchWords.map((word, idx) => (
                  <div
                    key={word.id}
                    className="p-4 rounded-xl bg-dark-850 border border-dark-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {idx + 1}.
                        </span>
                        <h4 className="text-base font-bold text-white">{word.english_word}</h4>
                        {word.phonetic && (
                          <span className="text-xs font-mono text-slate-400">
                            {word.phonetic}
                          </span>
                        )}
                        {word.part_of_speech && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-800 text-slate-400 border border-dark-700">
                            {word.part_of_speech}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-emerald-400">
                        {word.uzbek_translation}
                      </p>
                      {word.examples && word.examples.length > 0 && (
                        <p className="text-[11px] text-slate-400 italic pt-1">
                          "{word.examples[0].sentence_en}" — {word.examples[0].sentence_uz}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleSpeak(word.english_word)}
                      className="p-2 rounded-xl bg-dark-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 transition-colors"
                      title="Tinglash"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-dark-800 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setSelectedBatch(null)}
                className="px-5 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-semibold"
              >
                Yopish
              </button>
              <button
                onClick={() => {
                  const b = selectedBatch;
                  const words = batchWords;
                  setSelectedBatch(null);
                  if (words.length > 0) {
                    setStudyTitle(b.title);
                    setStudyWords(words);
                    setIsStudyModalOpen(true);
                  }
                }}
                disabled={batchWords.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-glow-brand flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🎴 Flashcard & Yozma Test</span>
              </button>
              <button
                onClick={() => {
                  const bId = selectedBatch.id;
                  setSelectedBatch(null);
                  onStartBatchStory(bId);
                }}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
              >
                AI Hikoya Yaratish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-Step Study Modal (Flashcard -> Written test) */}
      <BatchStudyModal
        isOpen={isStudyModalOpen}
        onClose={() => setIsStudyModalOpen(false)}
        title={studyTitle}
        words={studyWords}
      />
    </div>
  );
};
