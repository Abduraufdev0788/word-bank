import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Flame,
  Trophy,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { api } from '../../api/client';
import { ActivityHeatmapData, ActivityHeatmapDay } from '../../types';

interface ActivityHeatmapProps {
  initialDays?: number;
}

const MONTH_NAMES_UZ = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyun',
  'Iyul',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

const DAY_LABELS = [
  { idx: 0, label: 'Du' },
  { idx: 1, label: '' },
  { idx: 2, label: 'Ch' },
  { idx: 3, label: '' },
  { idx: 4, label: 'Ju' },
  { idx: 5, label: '' },
  { idx: 6, label: 'Ya' },
];

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ initialDays = 180 }) => {
  const [selectedRange, setSelectedRange] = useState<number>(initialDays);
  const [data, setData] = useState<ActivityHeatmapData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{
    day: ActivityHeatmapDay;
    x: number;
    y: number;
  } | null>(null);

  const fetchHeatmap = async (days: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getActivityHeatmap(days);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Faollik ma'lumotlarini yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap(selectedRange);
  }, [selectedRange]);

  // Transform flat list of days into GitHub week columns (Mon-Sun: 0 to 6)
  const { weeks, monthLabels } = useMemo(() => {
    if (!data || !data.days || data.days.length === 0) {
      return { weeks: [], monthLabels: [] };
    }

    const dayMap = new Map<string, ActivityHeatmapDay>();
    data.days.forEach((d) => dayMap.set(d.date, d));

    const startDate = new Date(data.days[0].date);
    const endDate = new Date(data.days[data.days.length - 1].date);

    // Adjust start to previous Monday
    // getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
    const startDayOfWeek = (startDate.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const alignedStart = new Date(startDate);
    alignedStart.setDate(alignedStart.getDate() - startDayOfWeek);

    const weekCols: (ActivityHeatmapDay | null)[][] = [];
    const months: { label: string; weekIndex: number }[] = [];

    const curr = new Date(alignedStart);
    let currentWeek: (ActivityHeatmapDay | null)[] = [];
    let lastMonth = -1;

    while (curr <= endDate || currentWeek.length > 0) {
      const dayOfWeek = (curr.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const isoStr = curr.toISOString().split('T')[0];

      if (dayOfWeek === 0 && currentWeek.length === 0) {
        // Check if new month started in this week
        const m = curr.getMonth();
        if (m !== lastMonth) {
          months.push({
            label: MONTH_NAMES_UZ[m],
            weekIndex: weekCols.length,
          });
          lastMonth = m;
        }
      }

      if (curr < startDate || curr > endDate) {
        currentWeek.push(null);
      } else {
        const found = dayMap.get(isoStr);
        currentWeek.push(
          found || {
            date: isoStr,
            count: 0,
            words_learned: 0,
            words_reviewed: 0,
            active_minutes: 0,
            level: 0,
          }
        );
      }

      if (currentWeek.length === 7) {
        weekCols.push(currentWeek);
        currentWeek = [];
      }

      curr.setDate(curr.getDate() + 1);
      if (curr > endDate && currentWeek.length === 0) {
        break;
      }
    }

    return { weeks: weekCols, monthLabels: months };
  }, [data]);

  // Color generator for GitHub squares
  const getSquareColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-[#0e4429] border-[#006d32]/40 hover:border-emerald-400';
      case 2:
        return 'bg-[#006d32] border-[#26a641]/50 hover:border-emerald-300';
      case 3:
        return 'bg-[#26a641] border-[#39d353]/60 hover:border-white shadow-sm';
      case 4:
        return 'bg-[#39d353] border-white/80 shadow-md shadow-[#39d353]/40 animate-pulse';
      case 0:
      default:
        return 'bg-dark-950 border-dark-800/80 hover:border-dark-700';
    }
  };

  const formatTooltipDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading && !data) {
    return (
      <div className="p-7 rounded-3xl bg-dark-900 border border-dark-800 animate-pulse space-y-4">
        <div className="h-6 w-56 bg-dark-800 rounded-md" />
        <div className="h-32 bg-dark-800/60 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-dark-900 via-dark-850 to-dark-950 border border-dark-750/90 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header: Title + Streak Pills + Timeframe Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                O'quv Faolligi Kalendari
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GitHub Contribution Grid
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Har bir yashil katak sizning o'rganish va takrorlash kunlaringizni ifodalaydi
              </p>
            </div>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 bg-dark-950/80 p-1 rounded-xl border border-dark-800 self-start md:self-auto">
          {[
            { days: 90, label: '3 oy' },
            { days: 180, label: '6 oy' },
            { days: 365, label: '1 yil' },
          ].map((r) => (
            <button
              key={r.days}
              onClick={() => setSelectedRange(r.days)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedRange === r.days
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Pills Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 relative z-10">
        {/* Total Active Days */}
        <div className="p-3.5 rounded-2xl bg-dark-950/60 border border-dark-800/90 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-white font-mono">{data.total_active_days} kun</div>
            <div className="text-[11px] text-slate-400 font-medium">Faol kunlar</div>
          </div>
        </div>

        {/* Current Streak */}
        <div className="p-3.5 rounded-2xl bg-dark-950/60 border border-dark-800/90 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
            <Flame className="w-4 h-4 fill-amber-400" />
          </div>
          <div>
            <div className="text-lg font-black text-amber-400 font-mono">{data.current_streak} kun</div>
            <div className="text-[11px] text-slate-400 font-medium">Joriy seriya</div>
          </div>
        </div>

        {/* Longest Streak */}
        <div className="p-3.5 rounded-2xl bg-dark-950/60 border border-dark-800/90 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/15 text-violet-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-violet-300 font-mono">{data.longest_streak} kun</div>
            <div className="text-[11px] text-slate-400 font-medium">Eng uzun seriya</div>
          </div>
        </div>

        {/* Total Contributions */}
        <div className="p-3.5 rounded-2xl bg-dark-950/60 border border-dark-800/90 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-accent-cyan font-mono">{data.total_contributions} ta</div>
            <div className="text-[11px] text-slate-400 font-medium">Jami faoliyatlar</div>
          </div>
        </div>
      </div>

      {/* GitHub-style Heatmap Grid */}
      <div className="relative z-10 p-5 rounded-2xl bg-dark-950/70 border border-dark-800/90 shadow-inner overflow-x-auto">
        <div className="min-w-fit space-y-2">
          {/* Month Header row */}
          <div className="flex text-[11px] font-mono text-slate-400 pl-7 h-4 relative">
            {monthLabels.map((m, idx) => (
              <span
                key={idx}
                style={{ marginLeft: `${m.weekIndex * 15}px`, position: 'absolute' }}
                className="font-bold text-slate-300"
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid rows */}
          <div className="flex gap-1.5 items-start">
            {/* Day of Week labels (Du, Ch, Ju) */}
            <div className="flex flex-col gap-1 text-[9px] font-mono font-bold text-slate-500 pr-1.5 pt-0.5 select-none">
              {DAY_LABELS.map((d, idx) => (
                <div key={idx} className="h-3 w-4 flex items-center justify-end leading-none">
                  {d.label}
                </div>
              ))}
            </div>

            {/* Weeks columns */}
            <div className="flex gap-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.map((day, dIdx) => {
                    if (!day) {
                      return (
                        <div
                          key={dIdx}
                          className="w-3 h-3 rounded-[3px] opacity-0 pointer-events-none"
                        />
                      );
                    }

                    const isToday =
                      day.date === new Date().toISOString().split('T')[0];

                    return (
                      <div
                        key={dIdx}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredDay({
                            day,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredDay((prev) =>
                            prev?.day.date === day.date
                              ? null
                              : {
                                  day,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                }
                          );
                        }}
                        className={`w-3 h-3 rounded-[3px] border transition-transform duration-150 cursor-pointer hover:scale-125 ${getSquareColor(
                          day.level
                        )} ${
                          isToday
                            ? 'ring-1 ring-emerald-400 ring-offset-1 ring-offset-dark-900'
                            : ''
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Legend */}
          <div className="flex items-center justify-between pt-3 text-[11px] text-slate-400 border-t border-dark-800/60 mt-3">
            <span className="text-[11px] text-slate-500">
              Oxirgi {selectedRange} kun davomidagi mashg'ulotlar
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Kamroq</span>
              <div className="w-2.5 h-2.5 rounded-[2px] bg-dark-950 border border-dark-800" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#0e4429] border border-[#006d32]/40" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#006d32] border border-[#26a641]/50" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#26a641] border border-[#39d353]/60" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#39d353] border border-white" />
              <span className="text-[10px] text-slate-500">Ko'proq</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Interactive Tooltip */}
      {hoveredDay && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredDay.x}px`,
            top: `${hoveredDay.y - 12}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="p-3 rounded-xl bg-dark-900/95 border border-emerald-500/40 text-white shadow-2xl text-xs space-y-1 min-w-[200px] backdrop-blur-md animate-pop-in"
        >
          <div className="font-bold text-slate-200 capitalize flex items-center justify-between border-b border-dark-800 pb-1 mb-1">
            <span>{formatTooltipDate(hoveredDay.day.date)}</span>
            {hoveredDay.day.level > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>

          {hoveredDay.day.count > 0 || hoveredDay.day.active_minutes > 0 ? (
            <div className="space-y-0.5 text-[11px] text-slate-300">
              <div className="text-emerald-400 font-bold">
                Jami: {hoveredDay.day.count} ta faollik
              </div>
              {hoveredDay.day.words_reviewed > 0 && (
                <div>• {hoveredDay.day.words_reviewed} ta so'z takrorlangan</div>
              )}
              {hoveredDay.day.words_learned > 0 && (
                <div>• {hoveredDay.day.words_learned} ta yangi so'z o'rganilgan</div>
              )}
              {hoveredDay.day.active_minutes > 0 && (
                <div className="flex items-center gap-1 text-cyan-300">
                  <Clock className="w-3 h-3" /> {hoveredDay.day.active_minutes} daqiqa o'qish
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic">
              Bu kunda faoliyat qayd etilmagan
            </div>
          )}
        </div>
      )}
    </div>
  );
};
