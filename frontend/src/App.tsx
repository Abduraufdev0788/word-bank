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
import { Settings } from './pages/Settings';
import { Auth } from './pages/Auth';
import { AddWordModal } from './components/modals/AddWordModal';
import { ImportModal } from './components/modals/ImportModal';
import { api } from './api/client';
import { WordBatch } from './types';
import {
  LayoutDashboard,
  Sparkles,
  Layers,
  BrainCircuit,
  Menu,
} from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [dueCount, setDueCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [batches, setBatches] = useState<WordBatch[]>([]);

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
      case 'batches':
        return { title: "Lug'at To'plamlari", subtitle: '20 talik qulay to\'plamlar' };
      case 'words':
        return { title: "Mening Lug'at Bankim", subtitle: 'Qidiruv, audio talaffuz va filtrlash' };
      case 'stories':
        return { title: 'AI Mini Hikoyalar', subtitle: 'Google Gemini orqali kontekstual o\'qish' };
      case 'weak':
        return { title: "Zaif So'zlar Laboratoriyasi", subtitle: 'Eng ko\'p adashilgan so\'zlar tahlili' };
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

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-20 md:pb-8">
          {currentTab === 'dashboard' && (
            <Dashboard
              onStartReview={() => handleSelectTab('review')}
              onOpenAddWord={() => setIsAddWordOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
              onNavigateToBatches={() => handleSelectTab('batches')}
              onNavigateToWeakWords={() => handleSelectTab('weak')}
              onNavigateToStories={() => handleSelectTab('stories')}
            />
          )}

          {currentTab === 'review' && (
            <DailyReview onBackToDashboard={() => handleSelectTab('dashboard')} />
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
            <WordBank onOpenAddWord={() => setIsAddWordOpen(true)} />
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

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur-lg border-t border-dark-800 px-3 py-1.5 flex items-center justify-around select-none shadow-2xl">
        <button
          onClick={() => handleSelectTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            currentTab === 'dashboard'
              ? 'text-brand-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Asosiy</span>
        </button>

        <button
          onClick={() => handleSelectTab('review')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl relative transition-all ${
            currentTab === 'review'
              ? 'text-brand-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px]">Takrorlash</span>
          {dueCount > 0 && (
            <span className="absolute top-0 right-1 w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse ring-2 ring-dark-900" />
          )}
        </button>

        <button
          onClick={() => handleSelectTab('stories')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            currentTab === 'stories'
              ? 'text-brand-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BrainCircuit className="w-5 h-5" />
          <span className="text-[10px]">Hikoyalar</span>
        </button>

        <button
          onClick={() => handleSelectTab('batches')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
            currentTab === 'batches'
              ? 'text-brand-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">To'plam</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">Menyu</span>
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
