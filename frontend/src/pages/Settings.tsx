import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Send,
  Target,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [cefr, setCefr] = useState(user?.preferred_cefr_level || 'B1');
  const [wordsGoal, setWordsGoal] = useState(user?.daily_words_goal || 20);
  const [reviewGoal, setReviewGoal] = useState(user?.daily_review_goal || 30);
  const [studyMinutesGoal, setStudyMinutesGoal] = useState(
    user?.daily_study_time_minutes || 20
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Telegram link token
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>('smartvocab_bot');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateProfile({
        preferred_cefr_level: cefr,
        daily_words_goal: Number(wordsGoal),
        daily_review_goal: Number(reviewGoal),
        daily_study_time_minutes: Number(studyMinutesGoal),
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Sozlamalarni saqlashda xatolik: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTelegramToken = async () => {
    setTokenLoading(true);
    try {
      const data = await api.getTelegramLinkToken();
      const token = data.link_token || data.token || '';
      setTelegramToken(token);
      const uname = (data.bot_username || 'english_learn_daily_robot').replace(/^@/, '');
      setBotUsername(uname);
    } catch (err: any) {
      alert("Telegram token yaratishda xato: " + (err.message || 'Noma\'lum xatolik'));
    } finally {
      setTokenLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <SettingsIcon className="w-5 sm:w-6 h-5 sm:h-6 text-brand-400" />
          <span>Foydalanuvchi Sozlamalari & Telegram Bot</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          O'quv maqsadlaringiz, CEFR darajasi va Telegram bot bilan sinxronizatsiya
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Study Goals & Preferences */}
        <div className="p-4 sm:p-6 rounded-2xl bg-dark-900 border border-dark-800 space-y-5 sm:space-y-6 shadow-xl">
          <div className="flex items-center gap-2 border-b border-dark-800 pb-3">
            <Target className="w-5 h-5 text-brand-400" />
            <h3 className="text-base font-bold text-white">Kunlik Maqsadlar & CEFR</h3>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                Sozlamalar muvaffaqiyatli saqlandi!
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Maqsad qilingan CEFR darajasi:</label>
              <select
                value={cefr}
                onChange={(e) => setCefr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-brand-500"
              >
                <option value="A1">A1 — Boshlang'ich (Beginner)</option>
                <option value="A2">A2 — Elementar (Elementary)</option>
                <option value="B1">B1 — O'rta (Intermediate)</option>
                <option value="B2">B2 — Yuqori O'rta (Upper-Intermediate)</option>
                <option value="C1">C1 — Ilg'or (Advanced)</option>
                <option value="C2">C2 — Mukammal (Proficiency)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Kunlik yangi so'z maqsadi:</label>
              <input
                type="number"
                min="1"
                max="100"
                value={wordsGoal}
                onChange={(e) => setWordsGoal(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Kunlik takrorlash maqsadi:</label>
              <input
                type="number"
                min="5"
                max="200"
                value={reviewGoal}
                onChange={(e) => setReviewGoal(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Kunlik faol o'qish vaqti (daqiqa):</label>
              <input
                type="number"
                min="5"
                max="240"
                value={studyMinutesGoal}
                onChange={(e) => setStudyMinutesGoal(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-dark-850 border border-dark-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-glow-brand transition-all disabled:opacity-50"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </form>
        </div>

        {/* Telegram Bot Linking */}
        <div className="p-6 rounded-2xl bg-dark-900 border border-dark-800 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-dark-800 pb-3">
              <Send className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">Telegram Bot Sinxronizatsiyasi</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Veb-sayt va Telegram botingiz umumiy bazada ishlaydi. Bot orqali kunlik takrorlashlarni yechish, yangi so'zlarni kiritish va xabarnomalar olishingiz mumkin.
            </p>

            {user?.is_telegram_linked || user?.telegram_username ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Telegram hisobingiz ulangan!
                </p>
                <p className="text-[11px] text-slate-300">
                  Foydalanuvchi: <strong>@{user?.telegram_username || 'Ulangan'}</strong>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  disabled={tokenLoading}
                  onClick={handleGenerateTelegramToken}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Xavfsiz ulanish kodini olish</span>
                </button>

                {telegramToken && (
                  <div className="p-4 rounded-xl bg-dark-850 border border-sky-500/30 space-y-3 animate-fade-in">
                    <p className="text-xs text-slate-300">
                      Botingizga kiring va quyidagi buyruqni yuboring yoki havolani bosing:
                    </p>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-dark-900 border border-dark-700 font-mono text-xs text-sky-300">
                      <span>/link {telegramToken}</span>
                      <button
                        onClick={() => copyToClipboard(`/link ${telegramToken}`)}
                        className="text-slate-400 hover:text-white"
                        title="Nusxa olish"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <a
                      href={`https://t.me/${botUsername}?start=${telegramToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-semibold border border-sky-500/30"
                    >
                      <span>To'g'ridan-to'g'ri Telegramda ochish</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-dark-800 text-[11px] text-slate-500">
            Hisob qaydnomangiz: <strong className="text-slate-400">{user?.email}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
