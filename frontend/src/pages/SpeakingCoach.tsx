import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Trophy,
  BookOpen,
  Briefcase,
  Plane,
  Utensils,
  Sun,
  Cpu,
  Compass,
  HelpCircle,
  Copy,
  Check,
  ShieldAlert,
  Keyboard,
  X,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../api/client';
import {
  SpeakingSessionResponse,
  SpeakingPresetTopic,
  AnalyzeSpeakingResponse,
  SpeakingSentenceItem,
} from '../types';

interface SpeakingCoachProps {
  onBackToDashboard?: () => void;
}

export const SpeakingCoach: React.FC<SpeakingCoachProps> = ({ onBackToDashboard }) => {
  // Navigation / Phase
  const [phase, setPhase] = useState<'setup' | 'practicing' | 'summary'>('setup');

  // Input Mode & Microphone Help State
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [manualSpokenInput, setManualSpokenInput] = useState<string>('');
  const [showMicHelpModal, setShowMicHelpModal] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [micStatus, setMicStatus] = useState<'idle' | 'checking' | 'granted' | 'denied'>('idle');

  // Setup options
  const [presetTopics, setPresetTopics] = useState<SpeakingPresetTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [cefrLevel, setCefrLevel] = useState<string>('B1');
  const [includeUserWords, setIncludeUserWords] = useState<boolean>(true);
  const [sentenceCount, setSentenceCount] = useState<number>(5);
  const [generating, setGenerating] = useState<boolean>(false);

  // Active Session
  const [session, setSession] = useState<SpeakingSessionResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionResults, setSessionResults] = useState<
    Array<{ sentenceId: number; accuracy: number; text: string }>
  >([]);

  // Audio Playback (TTS)
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);

  // Speech Recognition (STT)
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  const [recognitionSupported, setRecognitionSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  // Sentence Analysis
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalyzeSpeakingResponse | null>(null);

  // Study Session Tracker
  const studySessionIdRef = useRef<string | null>(null);

  // Load preset topics on mount
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const topics = await api.getSpeakingTopics();
        setPresetTopics(topics);
        if (topics.length > 0) {
          setSelectedTopic(topics[0].prompt);
        }
      } catch (err) {
        console.warn('Failed to load preset topics:', err);
      }
    };
    fetchTopics();

    // Check speech recognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionSupported(false);
    }
  }, []);

  // Study tracker management
  useEffect(() => {
    let heartbeatInterval: any = null;

    if (phase === 'practicing') {
      api
        .startStudySession('speaking')
        .then((res) => {
          studySessionIdRef.current = res.session_id;
          heartbeatInterval = setInterval(() => {
            if (studySessionIdRef.current) {
              api.sendHeartbeat(studySessionIdRef.current).catch(() => {});
            }
          }, 30000);
        })
        .catch(() => {});
    }

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (studySessionIdRef.current) {
        api.endStudySession(studySessionIdRef.current).catch(() => {});
        studySessionIdRef.current = null;
      }
    };
  }, [phase]);

  // Audio synthesizer
  const playSentenceAudio = (text: string, rate: number = 1.0) => {
    if (!('speechSynthesis' in window)) {
      alert("Brauzeringiz ovozli o'qish (SpeechSynthesis) imkoniyatini qo'llab-quvvatlamaydi.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;

    // Try finding a natural English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  // Check and test microphone permission
  const checkMicPermission = async () => {
    setMicStatus('checking');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicStatus('denied');
      setShowMicHelpModal(true);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus('granted');
      return true;
    } catch (err: any) {
      console.warn('Microphone permission check failed:', err);
      setMicStatus('denied');
      setShowMicHelpModal(true);
      return false;
    }
  };

  // Start Speech Recognition
  const startRecording = async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setShowMicHelpModal(true);
      return;
    }

    // Proactively verify permission if possible
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && micStatus !== 'granted') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicStatus('granted');
      } catch (err: any) {
        console.warn('Microphone permission was not granted:', err);
        setMicStatus('denied');
        setShowMicHelpModal(true);
        return;
      }
    }

    try {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      setSpeechTranscript('');
      setCurrentAnalysis(null);
      setIsRecording(true);

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript;
        }
        setSpeechTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicStatus('denied');
          setShowMicHelpModal(true);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Error starting recognition:', err);
      setIsRecording(false);
      setShowMicHelpModal(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Evaluate attempt
  const handleEvaluate = async (spokenTextToEval?: string) => {
    const textToAnalyze = spokenTextToEval || speechTranscript;
    if (!textToAnalyze.trim() || !session) return;

    const currentSentence = session.sentences[currentIndex];
    setEvaluating(true);

    try {
      const res = await api.analyzeSpeakingAttempt({
        original_text: currentSentence.text_en,
        spoken_text: textToAnalyze,
        cefr_level: session.cefr_level,
      });
      setCurrentAnalysis(res);

      // Record result
      setSessionResults((prev) => {
        const filtered = prev.filter((r) => r.sentenceId !== currentSentence.id);
        return [
          ...filtered,
          {
            sentenceId: currentSentence.id,
            accuracy: res.accuracy_score,
            text: currentSentence.text_en,
          },
        ];
      });
    } catch (err: any) {
      alert("Tahlil qilishda xatolik yuz berdi: " + (err.message || "Noma'lum"));
    } finally {
      setEvaluating(false);
    }
  };

  // Generate new session
  const handleGenerateSession = async () => {
    const topicToUse = customTopic.trim() || selectedTopic;
    if (!topicToUse) {
      alert('Iltimos, mavzu tanlang yoki ozingiz yozing.');
      return;
    }

    setGenerating(true);
    try {
      const data = await api.generateSpeakingSession({
        topic: topicToUse,
        cefr_level: cefrLevel,
        include_user_words: includeUserWords,
        sentence_count: sentenceCount,
      });
      setSession(data);
      setCurrentIndex(0);
      setSessionResults([]);
      setCurrentAnalysis(null);
      setSpeechTranscript('');
      setManualSpokenInput('');
      setPhase('practicing');
    } catch (err: any) {
      alert("Mashg'ulot yaratishda xatolik: " + (err.message || "Noma'lum xatolik"));
    } finally {
      setGenerating(false);
    }
  };

  // Next / Previous sentence
  const handleNextSentence = () => {
    if (!session) return;
    if (currentIndex < session.sentences.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentAnalysis(null);
      setSpeechTranscript('');
      setManualSpokenInput('');
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      setPhase('summary');
    }
  };

  // Average accuracy calculation
  const averageAccuracy =
    sessionResults.length > 0
      ? Math.round(
          sessionResults.reduce((acc, curr) => acc + curr.accuracy, 0) / sessionResults.length
        )
      : 0;

  // Preset topic icon renderer
  const renderTopicIcon = (iconName: string) => {
    switch (iconName) {
      case 'Briefcase':
        return <Briefcase className="w-5 h-5 text-indigo-400" />;
      case 'Plane':
        return <Plane className="w-5 h-5 text-sky-400" />;
      case 'Utensils':
        return <Utensils className="w-5 h-5 text-amber-400" />;
      case 'Sun':
        return <Sun className="w-5 h-5 text-yellow-400" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-emerald-400" />;
      case 'Compass':
        return <Compass className="w-5 h-5 text-rose-400" />;
      default:
        return <BookOpen className="w-5 h-5 text-brand-400" />;
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-800 pb-5">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-750 text-slate-300 hover:text-white transition-all shadow-sm shrink-0"
              title="Bosh sahifaga qaytish"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                <Mic className="w-5 h-5" />
              </span>
              <span>AI Speaking & Talaffuz Murabbiyi</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Mavzu tanlang, gaplarni tinglang va mikrofon yoki yozma rejim orqali nutqingizni rivojlantiring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowMicHelpModal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Mikrofon yordami</span>
          </button>

          {phase === 'practicing' && session && (
            <button
              onClick={() => {
                if (window.confirm("Mashg'ulotni to'xtatib, bosh sahifaga qaytmoqchimisiz?")) {
                  setPhase('setup');
                  window.speechSynthesis.cancel();
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs font-semibold text-slate-300 hover:text-white transition-all"
            >
              Mavzuni o'zgartirish
            </button>
          )}
        </div>
      </div>

      {/* PHASE 1: SETUP & TOPIC SELECTION */}
      {phase === 'setup' && (
        <div className="space-y-6">
          {/* Topic selection card */}
          <div className="p-5 sm:p-7 rounded-2xl bg-dark-900 border border-dark-800 space-y-6 shadow-xl">
            <div className="flex items-center gap-2 border-b border-dark-800 pb-3">
              <Sparkles className="w-5 h-5 text-brand-400" />
              <h2 className="text-base font-bold text-white">1. Mavzu va Parametrlarni Tanlang</h2>
            </div>

            {/* Microphone Status & Readiness Helper */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-dark-850 border border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg border ${
                  micStatus === 'granted'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-brand-500/10 border-brand-500/30 text-brand-300'
                }`}>
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-white">
                    {!recognitionSupported
                      ? "Ovozni aniqlash cheklangan"
                      : micStatus === 'granted'
                      ? "Mikrofon ruxsati faol"
                      : "Mikrofon va ovoz holati"}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {!recognitionSupported
                      ? "Ushbu brauzerda nutqni aniqlash mavjud emas, Yozma rejimdan foydalanishingiz mumkin"
                      : micStatus === 'granted'
                      ? "Ovoz orqali gapirib tekshirishga tayyorsiz"
                      : "Google Chrome yoki Yozma rejim (diktovka) orqali mashq qilishingiz mumkin"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={checkMicPermission}
                  className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-300 hover:text-white font-medium transition-colors"
                >
                  {micStatus === 'checking' ? "Tekshirilmoqda..." : "Mikrofonni sinash"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMicHelpModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold transition-colors"
                >
                  Yo'riqnoma
                </button>
              </div>
            </div>

            {/* Ready Preset Topics */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300">
                Tavsiya etilgan mashhur mavzular:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {presetTopics.map((item) => {
                  const isSelected = selectedTopic === item.prompt && !customTopic.trim();
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(item.prompt);
                        setCustomTopic('');
                        setCefrLevel(item.recommended_level);
                      }}
                      className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-brand-600/15 border-brand-500 shadow-glow-brand ring-1 ring-brand-500'
                          : 'bg-dark-850 hover:bg-dark-800/80 border-dark-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        {renderTopicIcon(item.icon)}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-dark-800 text-slate-300 border border-dark-700">
                          {item.recommended_level}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white leading-snug">{item.title}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Topic Input */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-300">
                Yoki o'zingiz xohlagan mavzuni yozing:
              </label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Masalan: Talking about my favorite movie, Weekend plans, Artificial intelligence..."
                className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-all"
              />
            </div>

            {/* Level & Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* CEFR Level */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">CEFR Qiyinchilik darajasi:</label>
                <select
                  value={cefrLevel}
                  onChange={(e) => setCefrLevel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="A1">A1 — Boshlang'ich (Beginner)</option>
                  <option value="A2">A2 — Elementar (Elementary)</option>
                  <option value="B1">B1 — O'rta (Intermediate)</option>
                  <option value="B2">B2 — Yuqori O'rta (Upper-Intermediate)</option>
                  <option value="C1">C1 — Ilg'or (Advanced)</option>
                  <option value="C2">C2 — Mukammal (Proficiency)</option>
                </select>
              </div>

              {/* Sentence Count */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Gaplar soni:</label>
                <select
                  value={sentenceCount}
                  onChange={(e) => setSentenceCount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-dark-850 border border-dark-700 text-white text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="3">3 ta gap (Qisqa va tez)</option>
                  <option value="5">5 ta gap (Standart)</option>
                  <option value="7">7 ta gap (To'liq nutq)</option>
                </select>
              </div>

              {/* Include User Words Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Lug'atdagi so'zlar:</label>
                <button
                  type="button"
                  onClick={() => setIncludeUserWords(!includeUserWords)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    includeUserWords
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-dark-850 border-dark-700 text-slate-400'
                  }`}
                >
                  <span>Mening so'zlarimni kiritish</span>
                  <CheckCircle2
                    className={`w-4 h-4 ${includeUserWords ? 'text-emerald-400' : 'text-slate-600'}`}
                  />
                </button>
              </div>
            </div>

            {/* Start Button */}
            <button
              disabled={generating}
              onClick={handleGenerateSession}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-glow-brand transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>AI Nutq matnini tayyorlamoqda...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Speaking Mashg'ulotini Boshlash</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: INTERACTIVE PRACTICE */}
      {phase === 'practicing' && session && (
        <div className="space-y-6">
          {/* Progress bar & Header */}
          <div className="p-4 rounded-2xl bg-dark-900 border border-dark-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                {session.title}
              </span>
              <p className="text-xs text-slate-300">{session.overview_uz}</p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-mono font-bold text-white bg-dark-850 px-3 py-1.5 rounded-lg border border-dark-700">
                {currentIndex + 1} / {session.sentences.length}
              </span>
            </div>
          </div>

          {/* Stepper Progress Line */}
          <div className="w-full bg-dark-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-500 h-full transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / session.sentences.length) * 100}%`,
              }}
            />
          </div>

          {/* Current Sentence Card */}
          {(() => {
            const currentSentence: SpeakingSentenceItem = session.sentences[currentIndex];

            return (
              <div className="p-6 sm:p-8 rounded-2xl bg-dark-900 border border-dark-800 space-y-6 shadow-2xl relative">
                {/* English Text Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Inglizcha gap (Ovoz chiqarib o'qing):
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                      {session.cefr_level}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed tracking-wide">
                    {currentSentence.text_en}
                  </h3>
                </div>

                {/* Uzbek translation */}
                <div className="p-3.5 rounded-xl bg-dark-850 border border-dark-750 text-xs text-slate-300">
                  <strong className="text-slate-400">Tarjimasi: </strong>
                  {currentSentence.text_uz}
                </div>

                {/* Phonetic tips */}
                {currentSentence.phonetic_tips && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Talaffuz maslahati: </strong>
                      {currentSentence.phonetic_tips}
                    </span>
                  </div>
                )}

                {/* Controls: Listen (TTS) & Mode Switch (Voice / Text) */}
                <div className="pt-4 border-t border-dark-800 flex flex-wrap items-center justify-between gap-4">
                  {/* TTS Audio Listen Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => playSentenceAudio(currentSentence.text_en, audioSpeed)}
                      disabled={isPlayingAudio || isRecording}
                      className="px-4 py-2.5 rounded-xl bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{isPlayingAudio ? "O'qilmoqda..." : "Tinglash (Audio)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const newSpeed = audioSpeed === 1.0 ? 0.75 : 1.0;
                        setAudioSpeed(newSpeed);
                        playSentenceAudio(currentSentence.text_en, newSpeed);
                      }}
                      className="px-2.5 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 border border-dark-700 text-xs font-mono font-bold"
                      title="Tezlikni o'zgartirish"
                    >
                      {audioSpeed}x
                    </button>
                  </div>

                  {/* Mode switcher and Voice button */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center p-1 bg-dark-850 rounded-xl border border-dark-750 text-xs">
                      <button
                        type="button"
                        onClick={() => setInputMode('voice')}
                        className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                          inputMode === 'voice'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Mikrofon</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode('text')}
                        className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                          inputMode === 'text'
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Yozma / Diktovka</span>
                      </button>
                    </div>

                    {inputMode === 'voice' && (
                      isRecording ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-2 animate-pulse shadow-lg shadow-rose-900/40"
                        >
                          <MicOff className="w-4 h-4" />
                          <span>To'xtatish</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          disabled={isPlayingAudio}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30"
                        >
                          <Mic className="w-4 h-4" />
                          <span>🎙 Gapirish</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Text / Keyboard Dictation Fallback Mode */}
                {inputMode === 'text' && (
                  <div className="p-4 rounded-xl bg-dark-850 border border-dark-700 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <Keyboard className="w-4 h-4 text-brand-400" />
                        <span>Aytgan gapingizni yozing yoki klaviatura mikrofonidan foydalaning:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMicHelpModal(true)}
                        className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Mikrofon yo'riqnomasi</span>
                      </button>
                    </div>

                    <textarea
                      value={manualSpokenInput}
                      onChange={(e) => setManualSpokenInput(e.target.value)}
                      placeholder="Masalan: The weather is warm and sunny today..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white text-sm focus:border-brand-500 focus:outline-none resize-none font-medium"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <p className="text-[11px] text-slate-400">
                        Maslahat: Telefon klaviaturasidagi 🎙 tugmasi orqali brauzer ruxsatisiz ham ovoz bilan yozishingiz mumkin.
                      </p>
                      <button
                        type="button"
                        disabled={evaluating || !manualSpokenInput.trim()}
                        onClick={() => handleEvaluate(manualSpokenInput)}
                        className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{evaluating ? "Baholanmoqda..." : "AI Baholasin"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Real-time speech transcript box */}
                {(isRecording || speechTranscript) && (
                  <div className="p-4 rounded-xl bg-dark-850 border border-dark-700 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        {isRecording ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            <span>Eshitilmoqda... Ovoz chiqarib gapiring:</span>
                          </>
                        ) : (
                          <span>Siz aytgan matn:</span>
                        )}
                      </span>

                      {!isRecording && speechTranscript && !currentAnalysis && (
                        <button
                          disabled={evaluating}
                          onClick={() => handleEvaluate()}
                          className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-bold"
                        >
                          {evaluating ? "Tekshirilmoqda..." : "Tekshirish va Baholash"}
                        </button>
                      )}
                    </div>

                    <p className="text-sm font-medium text-white italic">
                      "{speechTranscript || 'Hali hech narsa aytilmadi...'}"
                    </p>
                  </div>
                )}

                {/* Analysis Feedback Result */}
                {currentAnalysis && (
                  <div className="p-5 rounded-xl bg-dark-850 border border-brand-500/30 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-dark-750 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Talaffuz Aniqligi:
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`text-2xl font-black ${
                              currentAnalysis.accuracy_score >= 80
                                ? 'text-emerald-400'
                                : currentAnalysis.accuracy_score >= 50
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {currentAnalysis.accuracy_score}%
                          </span>
                          <span className="text-xs text-slate-400">aniqlik ko'rsatkichi</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentAnalysis(null);
                            setSpeechTranscript('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Qayta aytish</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleNextSentence}
                          className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                        >
                          <span>Keyingisi</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Word-by-word comparison highlight */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">
                        So'zma-so'z tahlil:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {currentAnalysis.word_comparisons.map((item, idx) => {
                          let colorClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
                          if (item.status === 'mispronounced') {
                            colorClass = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
                          } else if (item.status === 'missed') {
                            colorClass = 'bg-rose-500/15 border-rose-500/40 text-rose-300 line-through opacity-75';
                          }

                          return (
                            <span
                              key={idx}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${colorClass}`}
                              title={
                                item.status === 'mispronounced'
                                  ? `Aytilgan: ${item.spoken_word}`
                                  : item.status === 'missed'
                                  ? "Tushib qolgan so'z"
                                  : "To'g'ri talaffuz"
                              }
                            >
                              {item.word}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Feedback message */}
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {currentAnalysis.feedback_uz}
                    </p>

                    {/* Pronunciation suggestions */}
                    {currentAnalysis.suggestions.length > 0 && (
                      <div className="pt-2 border-t border-dark-750 text-[11px] text-slate-400 space-y-1">
                        {currentAnalysis.suggestions.map((sug, i) => (
                          <p key={i}>• {sug}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Key Vocabulary Highlights Card */}
          {session.vocabulary_highlights && session.vocabulary_highlights.length > 0 && (
            <div className="p-5 rounded-2xl bg-dark-900 border border-dark-800 space-y-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-400" />
                <span>Ushbu nutqdagi asosiy so'zlar:</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {session.vocabulary_highlights.map((vh, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-dark-850 border border-dark-750 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{vh.word}</span>
                      {vh.pronunciation && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {vh.pronunciation}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300">{vh.translation_uz}</p>
                    {vh.tip && <p className="text-[10px] text-slate-400 italic">{vh.tip}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: SUMMARY & CELEBRATION */}
      {phase === 'summary' && session && (
        <div className="p-6 sm:p-10 rounded-2xl bg-dark-900 border border-dark-800 text-center space-y-6 shadow-2xl animate-fade-in max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-glow-emerald">
            <Trophy className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white">Tabriklaymiz! Mashg'ulot yakunlandi 🎉</h2>
            <p className="text-xs text-slate-400">
              Siz "{session.topic}" mavzusi bo'yicha {session.sentences.length} ta gapni muvaffaqiyatli mashq qildingiz.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-dark-800">
            <div className="p-4 rounded-xl bg-dark-850 border border-dark-700">
              <span className="text-[11px] font-semibold text-slate-400">O'rtacha Aniqlik:</span>
              <p
                className={`text-3xl font-black mt-1 ${
                  averageAccuracy >= 80
                    ? 'text-emerald-400'
                    : averageAccuracy >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {averageAccuracy}%
              </p>
            </div>

            <div className="p-4 rounded-xl bg-dark-850 border border-dark-700">
              <span className="text-[11px] font-semibold text-slate-400">Bajarilgan gaplar:</span>
              <p className="text-3xl font-black text-brand-400 mt-1">
                {sessionResults.length} / {session.sentences.length}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setSessionResults([]);
                setCurrentAnalysis(null);
                setSpeechTranscript('');
                setPhase('practicing');
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Shu mavzuni qayta mashq qilish</span>
            </button>

            <button
              onClick={() => {
                setPhase('setup');
                setSession(null);
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-glow-brand"
            >
              <Sparkles className="w-4 h-4" />
              <span>Yangi mavzu tanlash</span>
            </button>
          </div>
        </div>
      )}
      {/* Microphone Permission Instructions Modal */}
      {showMicHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-900 border border-dark-750 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowMicHelpModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Mikrofonga Ruxsat Yo'riqnomasi</h3>
                <p className="text-xs text-slate-400">Brauzeringizda mikrofonni 1 daqiqada yoqish</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-dark-850 border border-dark-750 space-y-1.5">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Nega ruxsat berish talab etiladi?</span>
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Saytga IP-manzil (HTTP) orqali ulanganda, Google Chrome va Edge brauzerlari xavfsizlik siyosatiga ko'ra mikrofonga to'g'ridan-to'g'ri ruxsat bermaydi.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-extrabold text-white text-sm">Chrome brauzerida yoqish bosqichlari:</p>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1 leading-relaxed">
                  <li>
                    Yangi tabda ushbu manzilni oching:
                    <div className="mt-1 p-2 rounded-lg bg-dark-950 font-mono text-[11px] text-brand-300 border border-dark-800 select-all">
                      chrome://flags/#unsafely-treat-insecure-origin-as-secure
                    </div>
                  </li>
                  <li>
                    Ochilgan sahifadagi qatorga joriy sayt manzilini yozing:
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 p-2 rounded-lg bg-dark-950 font-mono text-[11px] text-cyan-300 border border-dark-800 truncate">
                        {typeof window !== 'undefined' ? window.location.origin : 'http://...'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          setCopiedUrl(true);
                          setTimeout(() => setCopiedUrl(false), 2000);
                        }}
                        className="px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 border border-dark-700"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedUrl ? "Nusxalandi!" : "Nusxalash"}</span>
                      </button>
                    </div>
                  </li>
                  <li>
                    O'ng tarafdagi holatni <strong className="text-emerald-400">"Enabled"</strong> qiling va pastdagi <strong className="text-brand-400">"Relaunch"</strong> tugmasini bosing.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 space-y-1">
                <p className="font-bold">Oson muqobil usul:</p>
                <p className="text-slate-400">
                  Bayroqni sozlamasdan turib ham, <strong>"Yozma rejim"</strong> orqali gaplarni yozishingiz yoki telefoningiz klaviaturasidagi diktovka mikrofonidan erkin foydalanishingiz mumkin.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setInputMode('text');
                  setShowMicHelpModal(false);
                }}
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-glow-brand"
              >
                <Keyboard className="w-4 h-4" />
                <span>Yozma rejimga o'tish</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMicHelpModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
