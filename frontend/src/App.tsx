import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudyTimeProvider } from './context/StudyTimeContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { DailyReview } from './pages/DailyReview';
import { Batches } from './pages/Batches';
import { WordBank } from './pages/WordBank';
import { MiniStories } from './pages/MiniStories';
import { WeakWords } from './pages/WeakWords';
import { SpeakingCoach } from './pages/SpeakingCoach';
import { Settings } from './pages/Settings';
import { PracticeQuiz } from './pages/PracticeQuiz';
import { Auth } from './pages/Auth';
import { AddWordModal } from './components/modals/AddWordModal';
import { ImportModal } from './components/modals/ImportModal';
import { api } from './api/client';
import { WordBatch } from './types';
import {
  LayoutDashboard,
  Sparkles,
  Trophy,
  Layers,
  Menu,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useFullscreen } from './hooks/useFullscreen';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [dueCount, setDueCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [batches, setBatches] = useState<WordBatch[]>([]);
  const [quizInitialMode, setQuizInitialMode] = useState<'mastered_50' | 'all_50' | 'weak'>('mastered_50');

  // Mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals state
  const [isAddWordOpen, setIsAddWordOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [storyBatchId, setStoryBatchId] = useState<string | undefined>(undefined);

  const fetchGlobalStats = async () => {
    if (!user) return;
    try {
      const [dueWords, batchList, dashboardStats] = await Promise.all([
        api.getDueReviews().catch(() => []),
        api.getBatches().catch(() => []),
        api.getDashboardStats().catch(() => null),
      ]);
      setDueCount(dueWords.length);
      setBatches(batchList);
      if (dashboardStats) {
        setStreakDays(dashboardStats.streak_days);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchGlobalStats();
    }
  }, [user, currentTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">SmartVocab AI yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const getPageMeta = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Boshqaruv Paneli', subtitle: "O'quv ko'rsatkichlari va kunlik rejalar" };
      case 'review':
        return { title: 'Kunlik Takrorlash (SRS)', subtitle: 'Spaced Repetition SM-2 xotira pleyeri' };
      case 'practice':
        return {
          title: "50 talik Test & Mustahkamlash",
          subtitle: "Bilgan so'zlar va barcha so'zlar bo'yicha intensiv viktorina",
        };
      case 'batches':
        return { title: "Lug'at To'plamlari", subtitle: '20 talik qulay to\'plamlar' };
      case 'words':
        return { title: "Mening Lug'at Bankim", subtitle: 'Qidiruv, audio talaffuz va filtrlash' };
      case 'mastered':
        return {
          title: "O'zlashtirilgan So'zlar",
          subtitle: "3 marta ketma-ket to'g'ri topilib to'liq mustahkamlangan so'zlar",
        };
      case 'stories':
        return { title: 'AI Mini Hikoyalar', subtitle: 'Google Gemini orqali kontekstual o\'qish' };
      case 'weak':
        return { title: "Zaif So'zlar Laboratoriyasi", subtitle: 'Eng ko\'p adashilgan so\'zlar tahlili' };
      case 'speaking':
        return {
          title: 'AI Speaking & Talaffuz Murabbiyi',
          subtitle: 'Mavzular asosida real vaqtda ovozli mashq qilish',
        };
      case 'settings':
        return { title: 'Sozlamalar & Telegram Bot', subtitle: 'Shaxsiy parametrlar va hisobni ulash' };
      default:
        return { title: 'SmartVocab AI', subtitle: '' };
    }
  };

  const meta = getPageMeta();

  const handleSelectTab = (tab: string) => {
    setStoryBatchId(undefined);
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="h-full w-full bg-dark-950 flex flex-row text-slate-100 overflow-hidden select-none">
      {/* Responsive Sidebar Drawer */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={handleSelectTab}
        dueCount={dueCount}
        streakDays={streakDays}
        onOpenAddWord={() => setIsAddWordOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onOpenAddWord={() => setIsAddWordOpen(true)}
          onNavigateToSettings={() => handleSelectTab('settings')}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-28 lg:pb-8">
          {currentTab === 'dashboard' && (
            <Dashboard
              onStartReview={() => handleSelectTab('review')}
              onOpenAddWord={() => setIsAddWordOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
              onNavigateToBatches={() => handleSelectTab('batches')}
              onNavigateToWeakWords={() => handleSelectTab('weak')}
              onNavigateToStories={() => handleSelectTab('stories')}
              onNavigateToMasteredWords={() => handleSelectTab('mastered')}
              onNavigateToWords={() => handleSelectTab('words')}
              onNavigateToSpeaking={() => handleSelectTab('speaking')}
              onStartPracticeQuiz={(mode) => {
                setQuizInitialMode(mode || 'mastered_50');
                handleSelectTab('practice');
              }}
            />
          )}

          {currentTab === 'review' && (
            <DailyReview onBackToDashboard={() => handleSelectTab('dashboard')} />
          )}

          {currentTab === 'practice' && (
            <PracticeQuiz
              initialMode={quizInitialMode}
              onBackToDashboard={() => handleSelectTab('dashboard')}
              onNavigateToWeakWords={() => handleSelectTab('weak')}
            />
          )}

          {currentTab === 'speaking' && (
            <SpeakingCoach onBackToDashboard={() => handleSelectTab('dashboard')} />
          )}

          {currentTab === 'batches' && (
            <Batches
              onOpenImport={() => setIsImportOpen(true)}
              onStartBatchStory={(batchId) => {
                setStoryBatchId(batchId);
                handleSelectTab('stories');
              }}
            />
          )}

          {currentTab === 'words' && (
            <WordBank
              onOpenAddWord={() => setIsAddWordOpen(true)}
              initialFilterMastered={false}
            />
          )}

          {currentTab === 'mastered' && (
            <WordBank
              onOpenAddWord={() => setIsAddWordOpen(true)}
              initialFilterMastered={true}
            />
          )}

          {currentTab === 'stories' && (
            <MiniStories
              initialBatchId={storyBatchId}
              onClearInitialBatch={() => setStoryBatchId(undefined)}
            />
          )}

          {currentTab === 'weak' && (
            <WeakWords onStartTargetedReview={() => handleSelectTab('review')} />
          )}

          {currentTab === 'settings' && <Settings />}
        </main>
      </div>

      {/* Mobile & Tablet Pro Floating Bottom Dock (< 1024px) */}
      <nav className="lg:hidden fixed bottom-2 left-2.5 right-2.5 z-40 bg-dark-900/92 backdrop-blur-2xl border border-dark-750/90 rounded-2xl px-1.5 py-1 flex items-center justify-between select-none shadow-[0_12px_40px_rgba(0,0,0,0.75)] pb-[max(env(safe-area-inset-bottom),0.375rem)] transition-all">
        {/* Asosiy */}
        <button
          onClick={() => handleSelectTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
            currentTab === 'dashboard'
              ? 'text-white bg-gradient-to-b from-brand-500/25 to-brand-600/10 border border-brand-500/35 shadow-glow-brand/20'
              : 'text-slate-400 hover:text-slate-200 active:scale-95'
          }`}
        >
          <LayoutDashboard className={`w-4 sm:w-5 h-4 sm:h-5 ${currentTab === 'dashboard' ? 'text-brand-400' : ''}`} />
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Asosiy</span>
          {currentTab === 'dashboard' && (
            <span className="w-1 h-1 rounded-full bg-brand-400 absolute bottom-0.5 shadow-glow-brand" />
          )}
        </button>

        {/* Takrorlash */}
        <button
          onClick={() => handleSelectTab('review')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl relative transition-all ${
            currentTab === 'review'
              ? 'text-white bg-gradient-to-b from-brand-500/25 to-brand-600/10 border border-brand-500/35 shadow-glow-brand/20'
              : 'text-slate-400 hover:text-slate-200 active:scale-95'
          }`}
        >
          <div className="relative">
            <Sparkles className={`w-4 sm:w-5 h-4 sm:h-5 ${currentTab === 'review' ? 'text-brand-400' : ''}`} />
            {dueCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-3.5 text-[8px] font-black rounded-full bg-brand-500 text-white flex items-center justify-center ring-2 ring-dark-900 animate-pulse">
                {dueCount > 99 ? '99+' : dueCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Takror</span>
          {currentTab === 'review' && (
            <span className="w-1 h-1 rounded-full bg-brand-400 absolute bottom-0.5 shadow-glow-brand" />
          )}
        </button>

        {/* Test 50 */}
        <button
          onClick={() => handleSelectTab('practice')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
            currentTab === 'practice'
              ? 'text-white bg-gradient-to-b from-brand-500/25 to-brand-600/10 border border-brand-500/35 shadow-glow-brand/20'
              : 'text-slate-400 hover:text-slate-200 active:scale-95'
          }`}
        >
          <Trophy className={`w-4 sm:w-5 h-4 sm:h-5 ${currentTab === 'practice' ? 'text-amber-400' : ''}`} />
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Test 50</span>
          {currentTab === 'practice' && (
            <span className="w-1 h-1 rounded-full bg-amber-400 absolute bottom-0.5 shadow-glow-brand" />
          )}
        </button>

        {/* To'plamlar */}
        <button
          onClick={() => handleSelectTab('batches')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
            currentTab === 'batches'
              ? 'text-white bg-gradient-to-b from-brand-500/25 to-brand-600/10 border border-brand-500/35 shadow-glow-brand/20'
              : 'text-slate-400 hover:text-slate-200 active:scale-95'
          }`}
        >
          <Layers className={`w-4 sm:w-5 h-4 sm:h-5 ${currentTab === 'batches' ? 'text-cyan-400' : ''}`} />
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight">To'plam</span>
          {currentTab === 'batches' && (
            <span className="w-1 h-1 rounded-full bg-cyan-400 absolute bottom-0.5 shadow-glow-brand" />
          )}
        </button>

        {/* To'liq Ekran (Fullscreen Toggle) */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative active:scale-95 ${
            isFullscreen
              ? 'text-brand-300 bg-brand-500/20 border border-brand-500/40 shadow-glow-brand/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title={isFullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran rejimi"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 sm:w-5 h-4 sm:h-5 text-brand-400 animate-pop-in" />
          ) : (
            <Maximize2 className="w-4 sm:w-5 h-4 sm:h-5" />
          )}
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight">
            {isFullscreen ? 'Kichrayt' : 'Ekran'}
          </span>
          {isFullscreen && (
            <span className="w-1 h-1 rounded-full bg-brand-400 absolute bottom-0.5 shadow-glow-brand" />
          )}
        </button>

        {/* Menyu */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-400 hover:text-slate-200 transition-all active:scale-95"
        >
          <Menu className="w-4 sm:w-5 h-4 sm:h-5" />
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Menyu</span>
        </button>
      </nav>

      {/* Modals */}
      <AddWordModal
        isOpen={isAddWordOpen}
        onClose={() => setIsAddWordOpen(false)}
        batches={batches}
        onWordAdded={() => {
          fetchGlobalStats();
        }}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => {
          fetchGlobalStats();
          handleSelectTab('batches');
        }}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <StudyTimeProvider>
        <MainApp />
      </StudyTimeProvider>
    </AuthProvider>
  );
}

export default App;
