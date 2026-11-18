import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  Save,
  CheckCircle2,
  Trophy,
  RotateCcw,
  Award,
  AlertCircle,
  Users,
  Home,
  Megaphone,
  Handshake,
  Heart,
  TrendingUp,
  Star,
  Target,
  Check,
  GraduationCap,
  BookMarked,
  ClipboardList,
  ThumbsUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  UserAccount,
  Member,
  DailyMetricKey,
  DailyReportMetrics,
  DailyReportRecord,
  PeriodGoalRecord,
  FestivalEvent,
  SystemAppearanceConfig,
  DEFAULT_HOME_WIDGET_VISIBILITY,
  HuongKhiItem,
  DAILY_METRIC_DEFINITIONS,
  EMPTY_DAILY_METRICS,
  DEFAULT_DAILY_GOALS,
  DEFAULT_EVENT_WEIGHTS,
} from '../types/edulms';
import type { AppTab } from './Navbar';
import { CustomSelect } from './CustomSelect';
import { computeDailyMetricsScore, sumDailyReportMetrics } from '../utils/scoringEngine';

interface DailyReportSectionProps {
  currentUser: UserAccount | null;
  currentMember: Member | null;
  dailyReports: DailyReportRecord[];
  periodGoals: PeriodGoalRecord[];
  activeEvent: FestivalEvent | null;
  defaultWeights?: DailyReportMetrics;
  appearanceConfig?: SystemAppearanceConfig | null;
  huongKhiList?: HuongKhiItem[];
  onReactHuongKhi?: (id: string, type: 'like' | 'heart' | 'pray' | 'praise' | 'fire' | 'blessing') => void;
  onNavigateTab?: (tab: AppTab) => void;
  onSaveDailyReport: (
    date: string,
    goals: DailyReportMetrics,
    results: DailyReportMetrics
  ) => Promise<void>;
  onSavePeriodGoal: (
    periodType: 'MONTH' | 'YEAR',
    periodKey: string,
    goals: DailyReportMetrics
  ) => Promise<void>;
  onOpenAuthModal: () => void;
  onOpenRules: () => void;
  onShowNotification: (msg: string) => void;
}

type PeriodTab = 'DAY' | 'MONTH' | 'YEAR';

const METRIC_ICON_META: Record<
  DailyMetricKey,
  { icon: React.ComponentType<{ className?: string }>; bgCls: string; iconCls: string }
> = {
  kn: {
    icon: Users,
    bgCls: 'bg-sky-100 dark:bg-sky-950/70',
    iconCls: 'text-sky-600 dark:text-sky-400',
  },
  tham: {
    icon: Home,
    bgCls: 'bg-emerald-100 dark:bg-emerald-950/70',
    iconCls: 'text-emerald-600 dark:text-emerald-400',
  },
  gm: {
    icon: Megaphone,
    bgCls: 'bg-amber-100 dark:bg-amber-950/70',
    iconCls: 'text-amber-600 dark:text-amber-400',
  },
  dt: {
    icon: Handshake,
    bgCls: 'bg-indigo-100 dark:bg-indigo-950/70',
    iconCls: 'text-indigo-600 dark:text-indigo-400',
  },
  hh: {
    icon: Heart,
    bgCls: 'bg-rose-100 dark:bg-rose-950/70',
    iconCls: 'text-rose-500 dark:text-rose-400',
  },
  kt: {
    icon: TrendingUp,
    bgCls: 'bg-emerald-100 dark:bg-emerald-950/70',
    iconCls: 'text-emerald-600 dark:text-emerald-400',
  },
  wsNew: {
    icon: Star,
    bgCls: 'bg-amber-100 dark:bg-amber-950/70',
    iconCls: 'text-amber-500 dark:text-amber-400',
  },
};

const getTodayStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const shiftDateStr = (dateStr: string, deltaDays: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
};

const shiftMonthStr = (monthStr: string, deltaMonths: number): string => {
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

export const DailyReportSection: React.FC<DailyReportSectionProps> = ({
  currentUser,
  currentMember,
  dailyReports,
  periodGoals,
  activeEvent,
  defaultWeights,
  appearanceConfig,
  huongKhiList = [],
  onReactHuongKhi,
  onNavigateTab,
  onSaveDailyReport,
  onSavePeriodGoal,
  onOpenAuthModal,
  onOpenRules,
  onShowNotification,
}) => {
  const todayStr = useMemo(() => getTodayStr(), []);
  const [activePeriod, setActivePeriod] = useState<PeriodTab>('DAY');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(todayStr.slice(0, 4));

  const [goalsDraft, setGoalsDraft] = useState<DailyReportMetrics>({ ...DEFAULT_DAILY_GOALS });
  const [resultsDraft, setResultsDraft] = useState<DailyReportMetrics>({ ...EMPTY_DAILY_METRICS });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const homeCfg = useMemo(
    () => ({
      ...DEFAULT_HOME_WIDGET_VISIBILITY,
      ...(appearanceConfig?.homeWidgets || {}),
    }),
    [appearanceConfig?.homeWidgets]
  );

  const userReports = useMemo(() => {
    if (!currentUser) return [];
    return dailyReports.filter((r) => r.uid === currentUser.id);
  }, [dailyReports, currentUser?.id]);

  // Kết quả tổng hợp tháng (từ báo cáo theo ngày)
  const monthAggregatedResults = useMemo(() => {
    const matched = userReports.filter(
      (r) => r.month === selectedMonth || r.date.startsWith(selectedMonth)
    );
    return sumDailyReportMetrics(matched);
  }, [userReports, selectedMonth]);

  // Kết quả tổng hợp năm (từ báo cáo theo ngày)
  const yearAggregatedResults = useMemo(() => {
    const matched = userReports.filter(
      (r) => r.year === selectedYear || r.date.startsWith(selectedYear)
    );
    return sumDailyReportMetrics(matched);
  }, [userReports, selectedYear]);

  // Tiến độ năm cho vòng tròn Donut (Image 2)
  const yearGoalProgress = useMemo(() => {
    const existingYearGoal = periodGoals.find(
      (g) => g.uid === currentUser?.id && g.periodType === 'YEAR' && g.periodKey === selectedYear
    );
    const goalObj = existingYearGoal?.goals || {
      kn: DEFAULT_DAILY_GOALS.kn * 300,
      tham: DEFAULT_DAILY_GOALS.tham * 240,
      gm: DEFAULT_DAILY_GOALS.gm * 180,
      dt: DEFAULT_DAILY_GOALS.dt * 240,
      hh: DEFAULT_DAILY_GOALS.hh * 240,
      kt: DEFAULT_DAILY_GOALS.kt * 300,
      wsNew: DEFAULT_DAILY_GOALS.wsNew * 48,
    };
    let tGoal = 0;
    let tDone = 0;
    DAILY_METRIC_DEFINITIONS.forEach(({ key }) => {
      const g = Number(goalObj[key]) || 0;
      const r = Number(yearAggregatedResults[key]) || 0;
      if (g > 0) {
        tGoal += g;
        tDone += Math.min(r, g);
      }
    });
    return tGoal > 0 ? Math.min(100, Math.round((tDone / tGoal) * 100)) : 0;
  }, [periodGoals, currentUser?.id, selectedYear, yearAggregatedResults]);

  // Đồng bộ form khi đổi tab hoặc ngày/tháng/năm
  useEffect(() => {
    if (activePeriod === 'DAY') {
      const existing = userReports.find((r) => r.date === selectedDate);
      if (existing) {
        setGoalsDraft({ ...EMPTY_DAILY_METRICS, ...existing.goals });
        setResultsDraft({ ...EMPTY_DAILY_METRICS, ...existing.results });
      } else {
        const latest = [...userReports].sort((a, b) => b.date.localeCompare(a.date))[0];
        setGoalsDraft(
          latest ? { ...DEFAULT_DAILY_GOALS, ...latest.goals } : { ...DEFAULT_DAILY_GOALS }
        );
        setResultsDraft({ ...EMPTY_DAILY_METRICS });
      }
    } else if (activePeriod === 'MONTH') {
      const existing = periodGoals.find(
        (g) => g.uid === currentUser?.id && g.periodType === 'MONTH' && g.periodKey === selectedMonth
      );
      setGoalsDraft(
        existing
          ? { ...EMPTY_DAILY_METRICS, ...existing.goals }
          : {
              kn: DEFAULT_DAILY_GOALS.kn * 25,
              tham: DEFAULT_DAILY_GOALS.tham * 20,
              gm: DEFAULT_DAILY_GOALS.gm * 15,
              dt: DEFAULT_DAILY_GOALS.dt * 20,
              hh: DEFAULT_DAILY_GOALS.hh * 20,
              kt: DEFAULT_DAILY_GOALS.kt * 25,
              wsNew: DEFAULT_DAILY_GOALS.wsNew * 4,
            }
      );
    } else {
      const existing = periodGoals.find(
        (g) => g.uid === currentUser?.id && g.periodType === 'YEAR' && g.periodKey === selectedYear
      );
      setGoalsDraft(
        existing
          ? { ...EMPTY_DAILY_METRICS, ...existing.goals }
          : {
              kn: DEFAULT_DAILY_GOALS.kn * 300,
              tham: DEFAULT_DAILY_GOALS.tham * 240,
              gm: DEFAULT_DAILY_GOALS.gm * 180,
              dt: DEFAULT_DAILY_GOALS.dt * 240,
              hh: DEFAULT_DAILY_GOALS.hh * 240,
              kt: DEFAULT_DAILY_GOALS.kt * 300,
              wsNew: DEFAULT_DAILY_GOALS.wsNew * 48,
            }
      );
    }
  }, [activePeriod, selectedDate, selectedMonth, selectedYear, userReports, periodGoals, currentUser?.id]);

  const displayedResults: DailyReportMetrics =
    activePeriod === 'DAY'
      ? resultsDraft
      : activePeriod === 'MONTH'
      ? monthAggregatedResults
      : yearAggregatedResults;

  const activeWeights = activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS;
  const periodScore = useMemo(
    () => computeDailyMetricsScore(displayedResults, activeWeights),
    [displayedResults, activeWeights]
  );

  const overallProgress = useMemo(() => {
    let totalGoal = 0;
    let totalDone = 0;
    DAILY_METRIC_DEFINITIONS.forEach(({ key }) => {
      const g = Number(goalsDraft[key]) || 0;
      const r = Number(displayedResults[key]) || 0;
      if (g > 0) {
        totalGoal += g;
        totalDone += Math.min(r, g);
      }
    });
    if (totalGoal === 0) return 0;
    return Math.round((totalDone / totalGoal) * 100);
  }, [goalsDraft, displayedResults]);

  const isParticipantInActiveEvent = useMemo(() => {
    if (!activeEvent) return true;
    if (!activeEvent.restrictParticipants) return true;
    if (!currentMember) return false;
    return activeEvent.participantIds.includes(currentMember.id);
  }, [activeEvent, currentMember]);

  const sanitizeNumericInput = (raw: string): number => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return 0;
    return Math.max(0, parseInt(digits, 10) || 0);
  };

  const handleGoalChange = (key: DailyMetricKey, raw: string) => {
    setGoalsDraft((prev) => ({ ...prev, [key]: sanitizeNumericInput(raw) }));
  };

  const handleResultChange = (key: DailyMetricKey, raw: string) => {
    if (activePeriod !== 'DAY') return;
    setResultsDraft((prev) => ({ ...prev, [key]: sanitizeNumericInput(raw) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    setIsSaving(true);
    try {
      if (activePeriod === 'DAY') {
        await onSaveDailyReport(selectedDate, goalsDraft, resultsDraft);
        onShowNotification(`Đã lưu báo cáo ngày ${selectedDate.split('-').reverse().join('/')}!`);
      } else if (activePeriod === 'MONTH') {
        await onSavePeriodGoal('MONTH', selectedMonth, goalsDraft);
        onShowNotification(`Đã lưu mục tiêu tháng ${selectedMonth.split('-').reverse().join('/')}!`);
      } else {
        await onSavePeriodGoal('YEAR', selectedYear, goalsDraft);
        onShowNotification(`Đã lưu mục tiêu năm ${selectedYear}!`);
      }
    } catch (err: any) {
      onShowNotification(`Lỗi lưu dữ liệu: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDisplayDate = (d: string) => d.split('-').reverse().join('/');
  const formatDisplayMonth = (m: string) => {
    const [y, mm] = m.split('-');
    return `Tháng ${mm}/${y}`;
  };
  const getWeekdayVi = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return labels[dt.getDay()] || '';
  };

  const yesterdayStr = useMemo(() => shiftDateStr(todayStr, -1), [todayStr]);
  const dayBeforeYesterdayStr = useMemo(() => shiftDateStr(todayStr, -2), [todayStr]);
  const hasReportForSelectedDate = useMemo(
    () => userReports.some((r) => r.date === selectedDate),
    [userReports, selectedDate]
  );

  const formatNum = (n: number) => (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dayDaysReportedThisMonth = useMemo(() => {
    return userReports.filter((r) => r.month === selectedMonth).length;
  }, [userReports, selectedMonth]);

  const latestCheer = huongKhiList[0] || null;
  const cheerLikes =
    (latestCheer?.reactions?.like || 0) +
    (latestCheer?.reactions?.heart || 0) +
    (latestCheer?.likesCount || 0);

  // Donut Ring Geometry
  const ringRadius = 32;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCirc - (Math.min(100, yearGoalProgress) / 100) * ringCirc;

  const hasAnyCompanionBlock =
    homeCfg.showQuickShortcuts ||
    homeCfg.showCheerTicker ||
    homeCfg.showProgressShowcase ||
    homeCfg.showFeatureCards;

  return (
    <section id="entry-section" className="max-w-5xl mx-auto w-full space-y-5">
      {/* Compact Event Banner Pill (if active event exists) */}
      {activeEvent && (
        <div
          className={`px-3.5 py-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
            isParticipantInActiveEvent
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold truncate">{activeEvent.title}</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
              isParticipantInActiveEvent
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
            }`}
          >
            {isParticipantInActiveEvent ? 'Đang dự thi' : 'Ngoài DS sự kiện'}
          </span>
        </div>
      )}

      {/* MAIN GRID: Center/Left Báo cáo hằng ngày (Ảnh 1) + Right/Below Companion Blocks (Ảnh 2) */}
      <div
        className={`grid grid-cols-1 gap-5 items-start ${
          hasAnyCompanionBlock ? 'lg:grid-cols-12' : 'max-w-2xl mx-auto'
        }`}
      >
        {/* LEFT/PRIMARY COLUMN: DAILY REPORT CARD (INSPIRED BY IMAGE 1) */}
        <div className={hasAnyCompanionBlock ? 'lg:col-span-7' : 'w-full'}>
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-md border border-sky-200/90 dark:border-slate-800 overflow-hidden"
          >
            {/* Bright Visual Header Banner (Image 1 Style, No Bible Verse) */}
            {homeCfg.showHeaderBanner ? (
              <div className="relative px-4 pt-4 pb-3 bg-gradient-to-b from-sky-400 via-sky-200 to-sky-50 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900 overflow-hidden border-b border-sky-200/80 dark:border-slate-800">
                {/* Soft sunlit sky & green hill accents */}
                <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-amber-200/50 dark:bg-amber-400/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-8 right-0 w-56 h-20 rounded-full bg-emerald-300/35 dark:bg-emerald-500/10 blur-xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                  <div className="px-4 py-0.5 rounded-full bg-blue-900 text-white text-[11px] font-extrabold tracking-wide shadow-xs">
                    Hành Thực Lục
                  </div>

                  <div className="relative inline-flex flex-col items-center">
                    <div className="px-6 py-1.5 rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white text-lg sm:text-2xl font-black tracking-tight shadow-md">
                      Báo cáo hằng ngày
                    </div>
                    <div className="w-44 h-1.5 -mt-0.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 shadow-2xs" />
                  </div>

                  {currentUser ? (
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {currentUser.fullName} · {currentUser.companyCode}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenAuthModal}
                      className="text-[11px] font-bold text-blue-800 dark:text-amber-300 underline underline-offset-2 cursor-pointer"
                    >
                      Đăng nhập để lưu &amp; đồng bộ kết quả
                    </button>
                  )}
                </div>

                {/* 3 Period Tabs: Ngày / Tháng / Năm */}
                <div className="relative z-10 grid grid-cols-3 gap-1.5 bg-white/80 dark:bg-slate-950/60 p-1 rounded-2xl border border-sky-200 dark:border-white/10 mt-3 max-w-sm mx-auto backdrop-blur-xs">
                  {(
                    [
                      { id: 'DAY', label: 'Ngày' },
                      { id: 'MONTH', label: 'Tháng' },
                      { id: 'YEAR', label: 'Năm' },
                    ] as { id: PeriodTab; label: string }[]
                  ).map((tab) => {
                    const isActive = activePeriod === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActivePeriod(tab.id)}
                        className={`py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                          isActive
                            ? 'bg-blue-700 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-sky-100/70 dark:hover:bg-white/10'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Compact Header when Admin hides Header Banner */
              <div className="px-4 py-3 bg-gradient-to-r from-blue-800 to-indigo-800 text-white flex flex-wrap items-center justify-between gap-2">
                <div className="font-black text-sm">Báo cáo hằng ngày</div>
                <div className="inline-flex p-0.5 rounded-xl bg-white/15 gap-1">
                  {(['DAY', 'MONTH', 'YEAR'] as PeriodTab[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActivePeriod(id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        activePeriod === id ? 'bg-amber-400 text-slate-950' : 'text-white/85'
                      }`}
                    >
                      {id === 'DAY' ? 'Ngày' : id === 'MONTH' ? 'Tháng' : 'Năm'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Selector Strip (Image 1 Style: 📅 Ngày: __/__/____ + Quick Navigation) */}
            {activePeriod === 'DAY' ? (
              <div className="px-3.5 py-2.5 bg-sky-50/80 dark:bg-slate-800/40 border-b border-sky-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-sky-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs font-extrabold text-blue-900 dark:text-slate-200">
                      Ngày:
                    </span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) setSelectedDate(e.target.value);
                      }}
                      aria-label="Chọn ngày báo cáo"
                      className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer tabular-nums"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedDate((d) => shiftDateStr(d, -1))}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      aria-label="Ngày trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-1 tabular-nums">
                      {getWeekdayVi(selectedDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDate((d) => shiftDateStr(d, 1))}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      aria-label="Ngày sau"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {currentUser && (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        hasReportForSelectedDate
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {hasReportForSelectedDate && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{hasReportForSelectedDate ? 'Đã nhập' : 'Chưa nhập'}</span>
                    </span>
                  )}
                </div>

                <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 gap-1 shadow-2xs">
                  {[
                    { label: 'Hôm kia', value: dayBeforeYesterdayStr },
                    { label: 'Hôm qua', value: yesterdayStr },
                    { label: 'Hôm nay', value: todayStr },
                  ].map((preset) => {
                    const isSelected = selectedDate === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setSelectedDate(preset.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Month / Year Navigator with CustomSelect Presets & Locked Result Notice */
              <div className="px-3.5 py-2.5 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[11px] font-medium truncate">
                    Kết quả {activePeriod === 'MONTH' ? 'tháng' : 'năm'} tự cộng từ báo cáo ngày
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (activePeriod === 'MONTH') setSelectedMonth((m) => shiftMonthStr(m, -1));
                      else setSelectedYear((y) => String((parseInt(y, 10) || 2026) - 1));
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 hover:bg-blue-100/60 cursor-pointer"
                    aria-label="Kỳ trước"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {activePeriod === 'MONTH' ? (
                    <div className="w-[155px]">
                      <CustomSelect
                        size="sm"
                        searchable={false}
                        value={selectedMonth}
                        onChange={setSelectedMonth}
                        menuMinWidth={195}
                        options={Array.from({ length: 12 }, (_, idx) => {
                          const y = selectedMonth.split('-')[0] || String(new Date().getFullYear());
                          const mm = String(idx + 1).padStart(2, '0');
                          const val = `${y}-${mm}`;
                          return {
                            value: val,
                            label: `Tháng ${mm}/${y}`,
                            badge: val === selectedMonth ? `${dayDaysReportedThisMonth} ngày` : undefined,
                          };
                        })}
                      />
                    </div>
                  ) : (
                    <div className="w-[120px]">
                      <CustomSelect
                        size="sm"
                        searchable={false}
                        value={selectedYear}
                        onChange={setSelectedYear}
                        menuMinWidth={145}
                        options={['2024', '2025', '2026', '2027', '2028', '2029'].map((yr) => ({
                          value: yr,
                          label: `Năm ${yr}`,
                        }))}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (activePeriod === 'MONTH') setSelectedMonth((m) => shiftMonthStr(m, 1));
                      else setSelectedYear((y) => String((parseInt(y, 10) || 2026) + 1));
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 hover:bg-blue-100/60 cursor-pointer"
                    aria-label="Kỳ sau"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 4-Column Vibrant Table Header (Image 1 Style) */}
            <div className="px-2.5 sm:px-3 pt-2.5">
              <div className="grid grid-cols-[minmax(80px,1fr)_minmax(62px,92px)_minmax(62px,92px)_minmax(58px,88px)] gap-1.5 px-2.5 py-2.5 rounded-t-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white text-[11px] sm:text-xs font-extrabold items-center">
                <div className="pl-1">Hạng mục</div>
                <div className="text-center flex items-center justify-center gap-1">
                  <Target className="w-3.5 h-3.5 text-rose-300 shrink-0 hidden sm:inline" />
                  <span>Mục tiêu</span>
                </div>
                <div className="text-center flex items-center justify-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-200 shrink-0 hidden sm:inline" />
                  <span>Kết quả</span>
                  {activePeriod !== 'DAY' && <Lock className="w-3 h-3 text-blue-200" />}
                </div>
                <div className="text-right flex items-center justify-end gap-1 pr-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0 hidden sm:inline" />
                  <span className="sm:hidden">Tỉ lệ</span>
                  <span className="hidden sm:inline">Tỉ lệ HT</span>
                </div>
              </div>

              {/* 7 Metric Rows with Colorful Icons & Pill Inputs (Preserving ĐT / HH labels) */}
              <div className="border-x border-b border-sky-200/80 dark:border-slate-800 rounded-b-2xl divide-y divide-sky-100 dark:divide-slate-800/80 bg-sky-50/35 dark:bg-slate-900/60">
                {DAILY_METRIC_DEFINITIONS.map((metric) => {
                  const goalVal = goalsDraft[metric.key] ?? 0;
                  const resVal = displayedResults[metric.key] ?? 0;
                  const pct =
                    goalVal > 0 ? Math.round((resVal / goalVal) * 100) : resVal > 0 ? 100 : 0;

                  const iconMeta = METRIC_ICON_META[metric.key];
                  const RowIcon = iconMeta.icon;

                  const pctColor =
                    pct >= 100
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : pct >= 50
                      ? 'bg-sky-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-sky-200 dark:border-blue-800'
                      : pct > 0
                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';

                  return (
                    <div
                      key={metric.key}
                      className="grid grid-cols-[minmax(80px,1fr)_minmax(62px,92px)_minmax(62px,92px)_minmax(58px,88px)] gap-1.5 items-center px-2.5 py-2"
                    >
                      {/* Metric Icon + Label (KN, Thăm, GM, ĐT, HH, KT, WS New) */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl ${iconMeta.bgCls} flex items-center justify-center shrink-0`}
                        >
                          <RowIcon className={`w-3.5 h-3.5 ${iconMeta.iconCls}`} />
                        </div>
                        <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                          {metric.label}:
                        </span>
                      </div>

                      {/* Goal Pill Input */}
                      <div>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={goalVal === 0 ? '' : String(goalVal)}
                          placeholder="0"
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => handleGoalChange(metric.key, e.target.value)}
                          aria-label={`Mục tiêu ${metric.label}`}
                          className="w-full h-9 text-center text-xs sm:text-sm font-bold rounded-full border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums shadow-2xs"
                        />
                      </div>

                      {/* Result Pill Input */}
                      <div>
                        {activePeriod === 'DAY' ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={resVal === 0 ? '' : String(resVal)}
                            placeholder="0"
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => handleResultChange(metric.key, e.target.value)}
                            aria-label={`Kết quả ${metric.label}`}
                            className="w-full h-9 text-center text-xs sm:text-sm font-extrabold rounded-full border border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 tabular-nums shadow-2xs"
                          />
                        ) : (
                          <div
                            title="Kết quả tổng hợp tự động từ báo cáo Ngày"
                            className="w-full h-9 flex items-center justify-center text-xs sm:text-sm font-extrabold rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 tabular-nums select-none"
                          >
                            {resVal}
                          </div>
                        )}
                      </div>

                      {/* Completion % Pill */}
                      <div className="flex justify-end">
                        <span
                          className={`inline-flex items-center justify-center w-full max-w-[74px] h-9 px-2 rounded-full text-xs font-black border tabular-nums ${pctColor}`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary & Save Footer */}
            <div className="px-3.5 py-3.5 mt-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Tiến độ chung</span>
                    <span className="text-blue-700 dark:text-blue-300 tabular-nums">
                      {overallProgress}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, overallProgress)}%` }}
                    />
                  </div>
                </div>

                <div className="text-right shrink-0 pl-3 border-l border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase">
                    Điểm quy đổi
                  </div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums flex items-center justify-end gap-1">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>{formatNum(periodScore)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activePeriod === 'DAY' && selectedDate !== todayStr && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hôm nay</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {!currentUser
                      ? 'Đăng nhập để lưu báo cáo'
                      : isSaving
                      ? 'Đang lưu...'
                      : activePeriod === 'DAY'
                      ? `Lưu báo cáo (${formatDisplayDate(selectedDate)})`
                      : activePeriod === 'MONTH'
                      ? 'Lưu mục tiêu tháng'
                      : 'Lưu mục tiêu năm'}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={onOpenRules}
                  className="hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2 cursor-pointer"
                >
                  Xem thể lệ quy đổi điểm
                </button>
                {!isParticipantInActiveEvent && activeEvent && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    <span>Liên hệ Admin duyệt dự thi</span>
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT / SECONDARY COLUMN: IMAGE 2 COMPANION BLOCKS (ADMIN CONFIGURABLE) */}
        {hasAnyCompanionBlock && (
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Quick 5-Icon Shortcut Strip (Image 2 Style) */}
            {homeCfg.showQuickShortcuts && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {(
                    [
                      {
                        label: 'Xếp hạng',
                        tab: 'HONORS' as AppTab,
                        icon: Trophy,
                        bg: 'bg-sky-100 dark:bg-sky-950/60',
                        fg: 'text-sky-600 dark:text-sky-400',
                      },
                      {
                        label: 'Sự kiện',
                        tab: 'EVENT_HUB' as AppTab,
                        icon: Award,
                        bg: 'bg-rose-100 dark:bg-rose-950/60',
                        fg: 'text-rose-500 dark:text-rose-400',
                        badge: Boolean(activeEvent),
                      },
                      {
                        label: 'MĐ',
                        tab: 'DISCIPLES' as AppTab,
                        icon: Users,
                        bg: 'bg-indigo-100 dark:bg-indigo-950/60',
                        fg: 'text-indigo-600 dark:text-indigo-400',
                      },
                      {
                        label: 'Edu LMS',
                        tab: 'EDU_LMS' as AppTab,
                        icon: GraduationCap,
                        bg: 'bg-emerald-100 dark:bg-emerald-950/60',
                        fg: 'text-emerald-600 dark:text-emerald-400',
                      },
                      {
                        label: 'Edu CMS',
                        tab: 'EDU_CMS' as AppTab,
                        icon: BookMarked,
                        bg: 'bg-amber-100 dark:bg-amber-950/60',
                        fg: 'text-amber-600 dark:text-amber-400',
                      },
                    ]
                  ).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => onNavigateTab?.(item.tab)}
                        className="flex flex-col items-center gap-1.5 group cursor-pointer"
                      >
                        <div
                          className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${item.bg} flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs`}
                        >
                          <Icon className={`w-5 h-5 ${item.fg}`} />
                          {item.badge && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                              N
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight line-clamp-2">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Cheer Message Bar ("Tin nhắn cổ vũ" — Image 2 Style) */}
            {homeCfg.showCheerTicker && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Tin nhắn cổ vũ</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('HONORS')}
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Xem thêm</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {latestCheer ? (
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/25">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                        {latestCheer.title || latestCheer.content}
                      </p>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {latestCheer.authorName} · {latestCheer.companyCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onReactHuongKhi?.(latestCheer.id, 'like')}
                      className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 text-slate-600 dark:text-slate-300 cursor-pointer shrink-0 transition"
                      title="Gửi lượt cổ vũ"
                    >
                      <ThumbsUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] font-black tabular-nums mt-0.5">
                        {cheerLikes}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                    Chưa có bài cổ vũ mới. Hãy vào Bảng Vinh danh để chia sẻ Hương Khí!
                  </div>
                )}
              </div>
            )}

            {/* 3. Progress Showcase with Circular Donut (Image 2 Style) */}
            {homeCfg.showProgressShowcase && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-3 items-center">
                  {/* Left: Personal Streak & Points */}
                  <div className="flex flex-col items-center justify-center text-center p-3 rounded-2xl bg-sky-50/70 dark:bg-slate-800/70">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm mb-2">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                      {formatNum(periodScore)} đ
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {activePeriod === 'DAY'
                        ? 'Điểm trong ngày'
                        : activePeriod === 'MONTH'
                        ? `Tháng (${dayDaysReportedThisMonth} ngày)`
                        : `Tổng điểm ${selectedYear}`}
                    </div>
                  </div>

                  {/* Right: Circular Donut % Ring (Image 2) */}
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle
                          cx="40"
                          cy="40"
                          r={ringRadius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="7"
                          className="text-slate-200 dark:text-slate-800"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={ringRadius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={ringCirc}
                          strokeDashoffset={ringDashOffset}
                          className="text-emerald-500 transition-all duration-700"
                        />
                      </svg>
                      <span className="absolute text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        {yearGoalProgress}%
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
                      Mục tiêu {selectedYear}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Two Pastel Feature Shortcut Cards (Image 2 Style) */}
            {homeCfg.showFeatureCards && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('HONORS')}
                  className="p-4 rounded-3xl bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/55 border border-emerald-200/70 dark:border-emerald-800/60 text-left transition cursor-pointer flex flex-col justify-between min-h-[108px]"
                >
                  <div className="font-extrabold text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 leading-snug">
                    Bảng Vinh danh &amp; Top 3
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Xem thứ hạng
                    </span>
                    <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab?.('EDU_LMS')}
                  className="p-4 rounded-3xl bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/35 dark:hover:bg-amber-950/55 border border-amber-200/70 dark:border-amber-800/60 text-left transition cursor-pointer flex flex-col justify-between min-h-[108px]"
                >
                  <div className="font-extrabold text-xs sm:text-sm text-amber-950 dark:text-amber-200 leading-snug">
                    Chủ đề tuần &amp; Giáo trình Edu
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Mở LMS / CMS
                    </span>
                    <ArrowRight className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
