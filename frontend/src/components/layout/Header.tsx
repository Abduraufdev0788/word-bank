import React from 'react';
import { Plus, Send, Activity, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudyTime } from '../../context/StudyTimeContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenAddWord: () => void;
  onNavigateToSettings: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenAddWord,
  onNavigateToSettings,
  onToggleMobileMenu,
}) => {
  const { user } = useAuth();
  const { isStudying, activeSecondsToday } = useStudyTime();

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <header className="h-16 shrink-0 px-3 sm:px-6 lg:px-8 border-b border-dark-800 bg-dark-900/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mobile Hamburger Menu Toggle Button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 -ml-1 rounded-xl text-slate-300 hover:text-white hover:bg-dark-800 active:scale-95 transition-all"
          title="Menyuni ochish"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="truncate">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live Study Status Pill (Adaptive on mobile) */}
        <div
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            isStudying
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-glow-emerald'
              : 'bg-dark-850 border-dark-700 text-slate-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isStudying ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
            }`}
          />
          <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[11px] sm:text-xs">
            <span className="hidden md:inline">
              {isStudying ? "Faol o'rganishda: " : "Bugun o'qildi: "}
            </span>
            <strong className="font-mono text-slate-100">{formatSeconds(activeSecondsToday)}</strong>
          </span>
        </div>

        {/* Telegram bot status button */}
        <button
          onClick={onNavigateToSettings}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs text-sky-400 hover:text-sky-300 transition-colors"
          title="Telegram bot ulanish holati"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{user?.telegram_username ? `@${user.telegram_username}` : 'Botni ulash'}</span>
        </button>

        {/* Add Word Quick Action */}
        <button
          onClick={onOpenAddWord}
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-glow-brand transition-all active:scale-95"
          title="Yangi so'z qo'shish"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">So'z qo'shish</span>
        </button>
      </div>
    </header>
  );
};
