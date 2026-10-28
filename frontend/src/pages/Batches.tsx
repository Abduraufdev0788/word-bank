import React, { useEffect, useState } from 'react';
import {
  Layers,
  Brain,
  Clock,
  X,
  Volume2,
  Sparkles,
  PlusCircle,
  FolderPlus,
  Trash2,
  AlertCircle,
  Edit3,
  Check,
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

  // Create Batch Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBatchTitle, setNewBatchTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Batch Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<WordBatch | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editIsComplete, setEditIsComplete] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const handleCreateBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newBatchTitle.trim();
    if (!trimmed) {
      setCreateError("Iltimos, to'plam nomini kiriting");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await api.createBatch(trimmed, true);
      setNewBatchTitle('');
      setIsCreateModalOpen(false);
      await fetchBatches();
    } catch (err: any) {
      setCreateError(err.message || "To'plam yaratishda xatolik yuz berdi");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditModal = (batch: WordBatch) => {
    setEditingBatch(batch);
    setEditTitle(batch.title);
    setEditIsComplete(batch.is_complete || false);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveBatchEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingBatch) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditError("Iltimos, to'plam nomini kiriting");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await api.updateBatch(editingBatch.id, {
        title: trimmed,
        is_complete: editIsComplete,
      });
      setIsEditModalOpen(false);
      if (selectedBatch && selectedBatch.id === editingBatch.id) {
        setSelectedBatch(updated);
      }
      await fetchBatches();
    } catch (err: any) {
      setEditError(err.message || "To'plamni tahrirlashda xatolik yuz berdi");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteBatch = async (batch: WordBatch) => {
    const confirmMessage =
      batch.word_count > 0
        ? `«${batch.title}» to'plamida ${batch.word_count} ta so'z bor. Haqiqatan ham ushbu to'plamni o'chirmoqchimisiz?`
        : `«${batch.title}» to'plamini o'chirishni tasdiqlaysizmi?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await api.deleteBatch(batch.id);
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || "To'plamni o'chirib bo'lmadi");
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

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setNewBatchTitle('');
              setIsCreateModalOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Yangi to'plam ochish</span>
          </button>

          <button
            type="button"
            onClick={onOpenImport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-750 text-slate-200 text-xs font-semibold transition-all active:scale-95"
          >
            <span>Fayl yuklash</span>
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl bg-dark-900 border border-dark-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center mx-auto">
            <FolderPlus className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">Hozircha to'plamlar mavjud emas</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              O'zingiz yangi to'plam yarating yoki lug'at faylini (TXT, CSV, XLSX) import qiling.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              onClick={() => {
                setCreateError(null);
                setNewBatchTitle('');
                setIsCreateModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet text-white text-xs font-bold shadow-glow-brand flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Yangi to'plam ochish</span>
            </button>
            <button
              onClick={onOpenImport}
              className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-300 text-xs font-semibold active:scale-95 transition-all"
            >
              Fayl yuklash
            </button>
          </div>
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isFull
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {batch.word_count}/20 so'z
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(batch);
                        }}
                        className="p-1 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-brand-500/15 transition-all opacity-70 group-hover:opacity-100"
                        title="To'plamni tahrirlash"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBatch(batch);
                        }}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition-all opacity-70 group-hover:opacity-100"
                        title="To'plamni o'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(selectedBatch)}
                  className="px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="To'plamni tahrirlash"
                >
                  <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Tahrirlash</span>
                </button>
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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

      {/* Create Batch Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-pop-in">
          <div className="bg-dark-900 border border-dark-700/90 w-full max-w-md rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">Yangi To'plam Yaratish</h3>
                  <p className="text-[11px] text-slate-400">20 talik yangi lug'at to'plami</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200">
                  To'plam nomi <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newBatchTitle}
                  onChange={(e) => setNewBatchTitle(e.target.value)}
                  placeholder="Masalan: IELTS Essential 500, Sayohat iboralari..."
                  autoFocus
                  maxLength={150}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-dark-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>

              {/* Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Tavsiya etilgan mavzular:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'IELTS Essential 500',
                    'Kundalik so\'zlashuv',
                    'IT & Dasturlash',
                    'Biznes & Moliya',
                    'Sayohatchi lug\'ati',
                    'A1-A2 Boshlang\'ich',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewBatchTitle(preset)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-dark-800 hover:bg-brand-500/20 text-slate-300 hover:text-brand-300 border border-dark-700 hover:border-brand-500/40 transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-dark-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={creating || !newBatchTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Yaratilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>To'plam yaratish</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {isEditModalOpen && editingBatch && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-pop-in">
          <div className="bg-dark-900 border border-dark-700/90 w-full max-w-md rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">To'plamni Tahrirlash</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono font-bold text-brand-400">
                      To'plam #{editingBatch.batch_number}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({editingBatch.word_count}/20 so'z)
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatchEdit} className="space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200">
                  To'plam nomi <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="To'plam nomini kiriting..."
                  autoFocus
                  maxLength={150}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-dark-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>

              {/* Status Toggle / Checkbox */}
              <div className="p-3 rounded-xl bg-dark-850 border border-dark-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200">
                    To'plam holati
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {editIsComplete
                      ? "To'plam to'liq yodlangan yoki yakunlangan deb belgilangan"
                      : "To'plam o'rganish va yangi so'zlar qabul qilish jarayonida"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsComplete(!editIsComplete)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    editIsComplete
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-glow-emerald/10'
                      : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-slate-200'
                  }`}
                >
                  {editIsComplete ? "✓ Yakunlangan" : "O'rganilmoqda"}
                </button>
              </div>

              {/* Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Tezkor nomlar:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'IELTS Essential 500',
                    'Kundalik so\'zlashuv',
                    'IT & Dasturlash',
                    'Biznes & Moliya',
                    'Sayohatchi lug\'ati',
                    'A1-A2 Boshlang\'ich',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditTitle(preset)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-dark-800 hover:bg-brand-500/20 text-slate-300 hover:text-brand-300 border border-dark-700 hover:border-brand-500/40 transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-dark-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = editingBatch;
                    setIsEditModalOpen(false);
                    if (toDelete) handleDeleteBatch(toDelete);
                  }}
                  className="px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>O'chirish</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || !editTitle.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-bold shadow-glow-brand transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingEdit ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saqlanmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>O'zgarishlarni saqlash</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
