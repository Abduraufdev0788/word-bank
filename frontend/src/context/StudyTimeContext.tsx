import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

interface StudyTimeContextType {
  isStudying: boolean;
  activeSecondsToday: number;
  currentSessionSeconds: number;
  startSession: (activityType?: string) => Promise<void>;
  endSession: () => Promise<void>;
  refreshSummary: () => Promise<void>;
}

const StudyTimeContext = createContext<StudyTimeContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle detection
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds heartbeat

export const StudyTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isStudying, setIsStudying] = useState(false);
  const [activeSecondsToday, setActiveSecondsToday] = useState(0);
  const [currentSessionSeconds, setCurrentSessionSeconds] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<any>(null);
  const secondTimerRef = useRef<any>(null);
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const isPageVisibleRef = useRef<boolean>(!document.hidden);
  const isIdleRef = useRef<boolean>(false);

  const refreshSummary = async () => {
    if (!user) return;
    try {
      const summary = await api.getStudyTimeSummary();
      setActiveSecondsToday(summary.today_active_seconds);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      refreshSummary();
    } else {
      setActiveSecondsToday(0);
    }
  }, [user]);

  // Activity listeners to reset idle timer
  useEffect(() => {
    const handleUserActivity = () => {
      lastActiveTimestampRef.current = Date.now();
      if (isIdleRef.current) {
        isIdleRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      if (document.hidden && sessionIdRef.current) {
        // Pausing heartbeat when hidden
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const sendHeartbeat = async () => {
    if (!sessionIdRef.current) return;
    // Check if idle or hidden
    const now = Date.now();
    if (now - lastActiveTimestampRef.current > IDLE_TIMEOUT_MS) {
      isIdleRef.current = true;
      return; // Do not send heartbeat if user is idle
    }
    if (!isPageVisibleRef.current) {
      return; // Do not send heartbeat if tab is hidden
    }

    try {
      await api.sendHeartbeat(sessionIdRef.current);
    } catch {
      // heartbeat failed
    }
  };

  const startSession = async (activityType = 'review') => {
    if (sessionIdRef.current) return;
    try {
      const res = await api.startStudySession(activityType);
      sessionIdRef.current = res.session_id;
      setIsStudying(true);
      setCurrentSessionSeconds(0);
      lastActiveTimestampRef.current = Date.now();

      // Start local second tick
      if (secondTimerRef.current) clearInterval(secondTimerRef.current);
      secondTimerRef.current = setInterval(() => {
        const now = Date.now();
        if (
          isPageVisibleRef.current &&
          !isIdleRef.current &&
          now - lastActiveTimestampRef.current <= IDLE_TIMEOUT_MS
        ) {
          setCurrentSessionSeconds((prev) => prev + 1);
          setActiveSecondsToday((prev) => prev + 1);
        }
      }, 1000);

      // Start periodic heartbeat
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    } catch (e) {
      console.error('Failed to start study session:', e);
    }
  };

  const endSession = async () => {
    if (secondTimerRef.current) {
      clearInterval(secondTimerRef.current);
      secondTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (sessionIdRef.current) {
      try {
        await api.endStudySession(sessionIdRef.current);
      } catch {
        // ignore
      }
      sessionIdRef.current = null;
    }

    setIsStudying(false);
    setCurrentSessionSeconds(0);
    refreshSummary();
  };

  // Cleanup on unmount or logout
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        api.endStudySession(sessionIdRef.current).catch(() => {});
      }
      if (secondTimerRef.current) clearInterval(secondTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, []);

  return (
    <StudyTimeContext.Provider
      value={{
        isStudying,
        activeSecondsToday,
        currentSessionSeconds,
        startSession,
        endSession,
        refreshSummary,
      }}
    >
      {children}
    </StudyTimeContext.Provider>
  );
};

export const useStudyTime = () => {
  const ctx = useContext(StudyTimeContext);
  if (!ctx) throw new Error('useStudyTime must be used within StudyTimeProvider');
  return ctx;
};
