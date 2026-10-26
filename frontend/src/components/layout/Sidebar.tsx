import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Layers,
  BookOpen,
  FileUp,
  AlertCircle,
  Settings,
  LogOut,
  Flame,
  Clock,
  PlusCircle,
  BrainCircuit,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudyTime } from '../../context/StudyTimeContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  dueCount?: number;
  streakDays?: number;
  onOpenAddWord: () => void;
  onOpenImport: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  dueCount = 0,
  streakDays = 0,
  onOpenAddWord,
  onOpenImport,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const { activeSecondsToday, isStudying } = useStudyTime();

  const formatStudyTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = (mins / 60).toFixed(1);
      return `${hrs} soat`;
    }
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const navItems = [
    { id: 'dashboard', label: 'Boshqaruv Paneli', icon: LayoutDashboard },
    {
      id: 'review',
      label: 'Kunlik Takrorlash',
      icon: Sparkles,
      badge: dueCount > 0 ? dueCount : undefined,
      badgeColor: 'bg-brand-500 text-white',
    },
    { id: 'batches', label: "To'plamlar (20 talik)", icon: Layers },
    { id: 'words', label: "So'zlar Banki", icon: BookOpen },
    { id: 'mastered', label: "O'zlashtirilgan So'zlar", icon: CheckCircle2 },
    { id: 'stories', label: 'AI Mini Hikoyalar', icon: BrainCircuit },
    { id: 'weak', label: "Zaif So'zlar", icon: AlertCircle },
    { id: 'settings', label: 'Sozlamalar & Bot', icon: Settings },
  ];

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleAddWordClick = () => {
    onOpenAddWord();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleImportClick = () => {
    onOpenImport();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-dark-900 border-r border-dark-800 flex flex-col justify-between shrink-0 h-full select-none transform transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:w-64 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="overflow-y-auto flex-1">
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-dark-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-accent-violet to-accent-fuchsia flex items-center justify-center shadow-glow-brand">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  SmartVocab{' '}
                  <span className="text-xs px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-mono font-semibold border border-brand-500/30">
                    AI
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">SRS & Gemini Platform</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
              title="Menyuni yopish"
            >
              <LogOut className="w-5 h-5 rotate-180" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="px-4 pt-4 pb-2 space-y-2">
            <button
              onClick={handleAddWordClick}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet text-white text-xs font-semibold shadow-glow-brand transition-all active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Yangi so'z qo'shish</span>
            </button>
            <button
              onClick={handleImportClick}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
            >
              <FileUp className="w-4 h-4 text-brand-400" />
              <span>Fayl import qilish</span>
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-850'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User & Activity Widget */}
        <div className="p-4 border-t border-dark-800 space-y-3 bg-dark-900 shrink-0">
          {/* Active Study Time pill */}
          <div className="p-2.5 rounded-xl bg-dark-850 border border-dark-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isStudying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">Bugungi faol vaqt:</span>
            </div>
            <span className="text-xs font-mono font-bold text-brand-300">
              {formatStudyTime(activeSecondsToday)}
            </span>
          </div>

          {/* Streak indicator */}
          <div className="flex items-center justify-between px-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Flame className="w-4 h-4 fill-amber-400" />
              <span>{streakDays} kunlik seriya</span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-dark-800 text-slate-400 border border-dark-700">
              {user?.preferred_cefr_level || 'B1'}
            </span>
          </div>

          {/* User profile & logout */}
          <div className="pt-2 border-t border-dark-800 flex items-center justify-between">
            <div className="truncate mr-2">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.full_name || user?.email.split('@')[0]}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Tizimdan chiqish"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
