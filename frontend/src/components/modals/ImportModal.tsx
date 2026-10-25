import React, { useState } from 'react';
import {
  FileUp,
  X,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api/client';
import { ImportPreviewResponse } from '../../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setPreview(null);
    setSuccessMessage(null);
    setLoadingPreview(true);

    try {
      const res = await api.previewImport(selectedFile);
      setPreview(res);
    } catch (err: any) {
      setError(err.message || "Faylni tahlil qilishda xatolik yuz berdi");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview) return;

    setCommitting(true);
    setError(null);
    try {
      const res = await api.commitImport(file, {
        en_column: preview.detected_en_column,
        uz_column: preview.detected_uz_column,
        skip_duplicates: true,
        fill_incomplete_batch: true,
      });

      setSuccessMessage(
        `Muvaffaqiyatli import qilindi: ${res.total_imported} ta so'z, ${res.batches_created} ta yangi to'plam yaratildi!`
      );
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Importni tasdiqlashda xatolik");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-dark-900 border border-dark-700 w-full max-w-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-dark-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
              <FileUp className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-white">Lug'at Faylini Yuklash (Import)</h3>
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

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {/* Dropzone */}
          <label className="border-2 border-dashed border-dark-700 hover:border-brand-500/50 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-3 cursor-pointer bg-dark-850/50 transition-colors">
            <input
              type="file"
              accept=".txt,.csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />
            <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center text-brand-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Faylni bu yerga tashlang yoki tanlash uchun bosing
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Qo'llab-quvvatlanadi: TXT (word - tarjima), CSV, XLSX (Excel)
              </p>
            </div>
            {file && (
              <span className="text-xs font-mono font-medium text-brand-300 bg-brand-500/15 px-3 py-1 rounded-full border border-brand-500/30">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </label>

          {/* Loading indicator */}
          {loadingPreview && (
            <div className="py-8 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-brand-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Fayl tahlil qilinmoqda...</p>
            </div>
          )}

          {/* Preview analysis */}
          {preview && !loadingPreview && (
            <div className="space-y-4 animate-fade-in">
              {/* Batch breakdown notice */}
              <div className="p-4 rounded-xl bg-dark-850 border border-dark-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">Tahlil natijasi:</span>
                  <span className="text-brand-400 font-mono">
                    {preview.valid_rows_count} ta to'g'ri so'z
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-dark-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500">Aniqlangan qatorlar</span>
                    <p className="text-sm font-bold text-white font-mono">{preview.total_detected_rows}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Dublikatlar</span>
                    <p className="text-sm font-bold text-amber-400 font-mono">
                      {preview.duplicate_candidates_count}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">20 talik to'plamlar</span>
                    <p className="text-sm font-bold text-emerald-400 font-mono">
                      {preview.batches_to_create} ta
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample preview rows */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400">
                  Dastlabki namunaviy so'zlar (Preview):
                </span>
                <div className="rounded-xl border border-dark-800 divide-y divide-dark-800 overflow-hidden text-xs">
                  {preview.preview_rows.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="p-3 bg-dark-850 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-mono">{idx + 1}.</span>
                        <strong className="text-white">{row.english_word}</strong>
                        <span className="text-slate-400">—</span>
                        <span className="text-emerald-400">{row.uzbek_translation}</span>
                      </div>
                      {row.is_duplicate && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Dublikat
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-dark-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-semibold"
          >
            Yopish
          </button>
          <button
            type="button"
            disabled={!preview || committing}
            onClick={handleCommit}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow-brand transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {committing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Import qilinmoqda...</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                <span>20 talik to'plamlarga import qilish</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
