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
  Shield,
  Pause,
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
  ROLE_DISPLAY_META,
  canAccessAdminPanel,
} from '../types/edulms';
import type { AppTab } from './Navbar';
import { CustomSelect } from './CustomSelect';
import { computeDailyMetricsScore, sumDailyReportMetrics, sanitizeDailyMetrics } from '../utils/scoringEngine';
import { extractFirestoreErrorMessage } from '../utils/firestoreError';

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

  const [goalsDraft, setGoalsDraft] = useState<DailyReportMetrics>({ ...EMPTY_DAILY_METRICS });
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
    const goalObj = existingYearGoal?.goals || EMPTY_DAILY_METRICS;
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
        setGoalsDraft(sanitizeDailyMetrics(existing.goals));
        setResultsDraft(sanitizeDailyMetrics(existing.results));
      } else {
        setGoalsDraft({ ...EMPTY_DAILY_METRICS });
        setResultsDraft({ ...EMPTY_DAILY_METRICS });
      }
    } else if (activePeriod === 'MONTH') {
      const existing = periodGoals.find(
        (g) => g.uid === currentUser?.id && g.periodType === 'MONTH' && g.periodKey === selectedMonth
      );
      setGoalsDraft(
        existing ? sanitizeDailyMetrics(existing.goals) : { ...EMPTY_DAILY_METRICS }
      );
    } else {
      const existing = periodGoals.find(
        (g) => g.uid === currentUser?.id && g.periodType === 'YEAR' && g.periodKey === selectedYear
      );
      setGoalsDraft(
        existing ? sanitizeDailyMetrics(existing.goals) : { ...EMPTY_DAILY_METRICS }
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
    return Math.min(99999, Math.max(0, parseInt(digits, 10) || 0));
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
      const cleanGoals = sanitizeDailyMetrics(goalsDraft);
      const cleanResults = sanitizeDailyMetrics(resultsDraft);
      if (activePeriod === 'DAY') {
        await onSaveDailyReport(selectedDate, cleanGoals, cleanResults);
        onShowNotification(`Đã lưu báo cáo ngày ${selectedDate.split('-').reverse().join('/')}!`);
      } else if (activePeriod === 'MONTH') {
        await onSavePeriodGoal('MONTH', selectedMonth, cleanGoals);
        onShowNotification(`Đã lưu mục tiêu tháng ${selectedMonth.split('-').reverse().join('/')}!`);
      } else {
        await onSavePeriodGoal('YEAR', selectedYear, cleanGoals);
        onShowNotification(`Đã lưu mục tiêu năm ${selectedYear}!`);
      }
    } catch (err: unknown) {
      const msg = extractFirestoreErrorMessage(err);
      onShowNotification(`Lỗi lưu dữ liệu: ${msg}`);
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

  const cheerDisplayCount = Math.max(
    1,
    Math.min(20, Number(homeCfg.cheerDisplayCount) || 5)
  );
  const cheerRotateSeconds = Math.max(
    3,
    Math.min(120, Number(homeCfg.cheerRotateSeconds) || 10)
  );
  const cheerHideAuthor = Boolean(homeCfg.cheerHideAuthor);

  const [cheerPage, setCheerPage] = useState(0);
  const [isCheerPaused, setIsCheerPaused] = useState(false);
  const [justCheeredId, setJustCheeredId] = useState<string | null>(null);

  const totalCheerPages = Math.max(1, Math.ceil(huongKhiList.length / cheerDisplayCount));
  const safeCheerPage = cheerPage % totalCheerPages;

  useEffect(() => {
    setCheerPage(0);
  }, [cheerDisplayCount, huongKhiList.length]);

  useEffect(() => {
    if (huongKhiList.length <= cheerDisplayCount || totalCheerPages <= 1 || isCheerPaused) {
      return;
    }
    const timer = window.setInterval(() => {
      setCheerPage((prev) => (prev + 1) % totalCheerPages);
    }, cheerRotateSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [huongKhiList.length, cheerDisplayCount, totalCheerPages, cheerRotateSeconds, isCheerPaused]);

  const cheerStartIdx = safeCheerPage * cheerDisplayCount;
  const visibleCheers = huongKhiList.slice(cheerStartIdx, cheerStartIdx + cheerDisplayCount);
  const cheerRangeLabel =
    huongKhiList.length > cheerDisplayCount
      ? `${cheerStartIdx + 1}–${Math.min(
          cheerStartIdx + visibleCheers.length,
          huongKhiList.length
        )}/${huongKhiList.length}`
      : `${huongKhiList.length}`;

  // Donut Ring Geometry
  const ringRadius = 32;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCirc - (Math.min(100, yearGoalProgress) / 100) * ringCirc;

  const hasAnyCompanionBlock =
    homeCfg.showQuickShortcuts ||
    homeCfg.showCheerTicker ||
    homeCfg.showProgressShowcase ||
    homeCfg.showFeatureCards;

  const getAuthorInitials = (name?: string) => {
    const clean = (name || '').trim();
    if (!clean) return 'TV';
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  };

  return (
    <section id="entry-section" className="max-w-5xl mx-auto w-full space-y-2.5 sm:space-y-4">
      {/* Compact Event Banner Pill (if active event exists) */}
      {activeEvent && (
        <div
          className={`px-3 py-2 rounded-xl sm:rounded-2xl border text-xs flex items-center justify-between gap-2 ${
            isParticipantInActiveEvent
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold text-[11px] sm:text-xs truncate">{activeEvent.title}</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
              isParticipantInActiveEvent
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
            }`}
          >
            {isParticipantInActiveEvent ? 'Đang dự thi' : 'Ngoài DS sự kiện'}
          </span>
        </div>
      )}

      {/* MAIN GRID: Center/Left Báo cáo hằng ngày + Right/Below Companion Blocks */}
      <div
        className={`grid grid-cols-1 gap-3 sm:gap-5 items-start ${
          hasAnyCompanionBlock ? 'lg:grid-cols-12' : 'max-w-2xl mx-auto'
        }`}
      >
        {/* LEFT/PRIMARY COLUMN: CLASSIC VIBRANT DAILY REPORT CARD */}
        <div className={hasAnyCompanionBlock ? 'lg:col-span-7' : 'w-full'}>
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-md border border-sky-200/90 dark:border-slate-800 overflow-hidden"
          >
            {/* Bright Visual Header Banner (Compact on mobile for single-screen entry) */}
            {homeCfg.showHeaderBanner ? (
              <div className="relative px-3 sm:px-4 pt-2.5 pb-2 sm:pt-3.5 sm:pb-3 bg-gradient-to-b from-sky-400 via-sky-200 to-sky-50 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900 overflow-hidden border-b border-sky-200/80 dark:border-slate-800">
                {/* Soft sunlit sky & green hill accents */}
                <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-amber-200/50 dark:bg-amber-400/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-8 right-0 w-56 h-20 rounded-full bg-emerald-300/35 dark:bg-emerald-500/10 blur-xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-1 sm:space-y-1.5">
                  <div className="hidden sm:inline-block px-3.5 py-0.5 rounded-full bg-blue-900 text-white text-[10px] font-extrabold tracking-wide shadow-xs">
                    Hành Thực Lục
                  </div>

                  <div className="relative inline-flex flex-col items-center">
                    <div className="px-4 sm:px-6 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white text-base sm:text-xl font-black tracking-tight shadow-sm">
                      Báo cáo hằng ngày
                    </div>
                    <div className="w-32 sm:w-40 h-1 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 -mt-0.5 shadow-2xs" />
                  </div>

                  {currentUser ? (
                    <div className="flex flex-col items-center gap-1 max-w-full">
                      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100">
                        <span className="truncate max-w-[160px] sm:max-w-none">{currentUser.fullName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-white/85 dark:bg-slate-800/90 border border-sky-200 dark:border-slate-700 text-blue-800 dark:text-sky-300 text-[10px] font-extrabold">
                          Sion {currentUser.companyCode} · KV {currentUser.areaCode}
                          {currentUser.unitCode ? ` · ${currentUser.unitCode}` : ''}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${
                            (ROLE_DISPLAY_META[currentUser.role] || ROLE_DISPLAY_META.MEMBER).badgeClass
                          }`}
                        >
                          {(ROLE_DISPLAY_META[currentUser.role] || ROLE_DISPLAY_META.MEMBER).label}
                        </span>
                      </div>
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
                <div className="relative z-10 grid grid-cols-3 gap-1 bg-white/80 dark:bg-slate-950/60 p-1 rounded-xl sm:rounded-2xl border border-sky-200 dark:border-white/10 mt-2 max-w-xs sm:max-w-sm mx-auto backdrop-blur-xs">
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
                        className={`py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-extrabold transition cursor-pointer ${
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

            {/* Date Selector Strip */}
            {activePeriod === 'DAY' ? (
              <div className="px-2.5 sm:px-3.5 py-2 bg-sky-50/80 dark:bg-slate-800/40 border-b border-sky-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-sky-300 dark:border-slate-700 rounded-xl px-2 py-1 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="hidden sm:inline text-xs font-extrabold text-blue-900 dark:text-slate-200">
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

                  <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-1 py-0.5">
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
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                        hasReportForSelectedDate
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {hasReportForSelectedDate && <CheckCircle2 className="w-3 h-3" />}
                      <span>{hasReportForSelectedDate ? 'Đã nhập' : 'Chưa nhập'}</span>
                    </span>
                  )}
                </div>

                <div className="inline-flex items-center p-0.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 gap-0.5 shadow-2xs">
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
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
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
              <div className="px-2.5 sm:px-3.5 py-2 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[11px] font-medium truncate">
                    Tự cộng từ báo cáo ngày
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

            {/* 4-Column Vibrant Table Header */}
            <div className="px-2 sm:px-3 pt-2">
              <div className="grid grid-cols-[minmax(76px,1fr)_minmax(58px,90px)_minmax(58px,90px)_minmax(52px,82px)] gap-1.5 px-2 sm:px-2.5 py-2 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white text-[11px] sm:text-xs font-extrabold items-center">
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

              {/* 7 Metric Rows with Colorful Icons & Pill Inputs (h-9 touch targets) */}
              <div className="border-x border-b border-sky-200/80 dark:border-slate-800 rounded-b-xl sm:rounded-b-2xl divide-y divide-sky-100 dark:divide-slate-800/80 bg-sky-50/35 dark:bg-slate-900/60">
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
                      className="grid grid-cols-[minmax(76px,1fr)_minmax(58px,90px)_minmax(58px,90px)_minmax(52px,82px)] gap-1.5 items-center px-2 sm:px-2.5 py-1.5"
                    >
                      {/* Metric Icon + Label (KN, Thăm, GM, ĐT, HH, KT, WS New) */}
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl ${iconMeta.bgCls} flex items-center justify-center shrink-0`}
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
            <div className="px-3 py-2.5 mt-1.5 sm:mt-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2.5 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Tiến độ chung</span>
                    <span className="text-blue-700 dark:text-blue-300 tabular-nums">
                      {overallProgress}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, overallProgress)}%` }}
                    />
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2.5 border-l border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase">
                    Điểm quy đổi
                  </div>
                  <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums flex items-center justify-end gap-1">
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
                    className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hôm nay</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-9 sm:h-10 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
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

        {/* RIGHT / SECONDARY COLUMN: MODERN COMPANION BENTO STACK */}
        {hasAnyCompanionBlock && (
          <div className="lg:col-span-5 space-y-3 sm:space-y-4">
            {/* 1. Quick Shortcut Strip */}
            {homeCfg.showQuickShortcuts && (() => {
              const canOpenAdmin = canAccessAdminPanel(currentUser?.role);
              const isAdminUserRole =
                currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
              const quickItems = [
                {
                  label: 'Xếp hạng',
                  tab: 'HONORS' as AppTab,
                  icon: Trophy,
                  bg: 'bg-sky-50 dark:bg-sky-950/60 border-sky-100 dark:border-sky-900/50',
                  fg: 'text-sky-600 dark:text-sky-400',
                },
                {
                  label: 'Sự kiện',
                  tab: 'EVENT_HUB' as AppTab,
                  icon: Award,
                  bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-100 dark:border-rose-900/50',
                  fg: 'text-rose-500 dark:text-rose-400',
                  badge: Boolean(activeEvent),
                },
                {
                  label: 'MĐ',
                  tab: 'DISCIPLES' as AppTab,
                  icon: Users,
                  bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-900/50',
                  fg: 'text-indigo-600 dark:text-indigo-400',
                },
                {
                  label: 'Edu LMS',
                  tab: 'EDU_LMS' as AppTab,
                  icon: GraduationCap,
                  bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-900/50',
                  fg: 'text-emerald-600 dark:text-emerald-400',
                },
                {
                  label: 'Edu CMS',
                  tab: 'EDU_CMS' as AppTab,
                  icon: BookMarked,
                  bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-100 dark:border-amber-900/50',
                  fg: 'text-amber-600 dark:text-amber-400',
                },
                ...(canOpenAdmin
                  ? [
                      {
                        label: isAdminUserRole ? 'Quản trị' : 'Quản trị ĐV',
                        tab: 'ADMIN' as AppTab,
                        icon: Shield,
                        bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-100 dark:border-purple-900/50',
                        fg: 'text-purple-600 dark:text-purple-400',
                      },
                    ]
                  : []),
              ];
              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/85 dark:border-slate-800">
                  <div className={`grid gap-2 text-center ${canOpenAdmin ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-5'}`}>
                    {quickItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => onNavigateTab?.(item.tab)}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer py-1 rounded-xl hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div
                            className={`relative w-11 h-11 rounded-2xl border ${item.bg} flex items-center justify-center group-hover:-translate-y-0.5 transition-transform duration-150`}
                          >
                            <Icon className={`w-5 h-5 ${item.fg}`} />
                            {item.badge && (
                              <span
                                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900"
                                title="Sự kiện đang diễn ra"
                              />
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
              );
            })()}

            {/* 2. Vibrant Colorful Cheer Messages Card */}
            {homeCfg.showCheerTicker && (
              <div
                onMouseEnter={() => setIsCheerPaused(true)}
                onMouseLeave={() => setIsCheerPaused(false)}
                className="relative bg-gradient-to-b from-sky-50/70 via-white to-emerald-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 rounded-2xl sm:rounded-3xl shadow-md border border-sky-300/90 dark:border-sky-800/70 overflow-hidden"
              >
                {/* Smooth Auto-Rotate Countdown Bar */}
                {totalCheerPages > 1 && visibleCheers.length > 0 && (
                  <div className="h-[3px] w-full bg-blue-950/20 dark:bg-slate-800 overflow-hidden">
                    <div
                      key={`progress-${safeCheerPage}-${cheerRotateSeconds}-${huongKhiList.length}`}
                      className="h-full w-full bg-gradient-to-r from-amber-300 via-yellow-300 to-emerald-300 animate-cheer-progress"
                      style={{
                        animationDuration: `${cheerRotateSeconds}s`,
                        animationPlayState: isCheerPaused ? 'paused' : 'running',
                      }}
                    />
                  </div>
                )}

                {/* Vibrant Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-blue-700 via-sky-600 to-emerald-600 dark:from-blue-950 dark:via-sky-900 dark:to-emerald-950 text-white border-b border-sky-300/40 dark:border-sky-800/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles className="w-4 h-4 animate-cheer-sparkle" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
                          Tin nhắn cổ vũ
                        </h2>
                        {huongKhiList.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-extrabold tabular-nums shrink-0">
                            {cheerRangeLabel}
                          </span>
                        )}
                      </div>
                      {totalCheerPages > 1 && (
                        <div className="text-[10px] font-semibold text-sky-100 flex items-center gap-1 tabular-nums mt-0.5">
                          {isCheerPaused ? (
                            <>
                              <Pause className="w-2.5 h-2.5 text-amber-300" />
                              <span className="text-amber-200">Đang tạm dừng</span>
                            </>
                          ) : (
                            <span>Tự đổi mỗi {cheerRotateSeconds}s</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {totalCheerPages > 1 && (
                      <div className="inline-flex items-center gap-1 mr-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCheerPage((prev) => (prev - 1 + totalCheerPages) % totalCheerPages)
                          }
                          aria-label="Tin nhắn trước"
                          className="w-7 h-7 rounded-lg border border-white/25 bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white cursor-pointer transition"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheerPage((prev) => (prev + 1) % totalCheerPages)}
                          aria-label="Tin nhắn tiếp theo"
                          className="w-7 h-7 rounded-lg border border-white/25 bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white cursor-pointer transition"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigateTab?.('JOURNAL_CHEER')}
                      className="px-2.5 py-1 rounded-lg bg-amber-300 hover:bg-amber-200 text-slate-950 text-[11px] font-extrabold flex items-center gap-0.5 cursor-pointer whitespace-nowrap shadow-xs transition"
                    >
                      <span>Xem thêm</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Colorful Editorial Feed Cards with Staggered Entrance */}
                {visibleCheers.length > 0 ? (
                  <div
                    key={`cheer-page-${safeCheerPage}`}
                    className="p-2.5 sm:p-3 space-y-2"
                  >
                    {visibleCheers.map((cheer, idx) => {
                      const totalReactions =
                        (cheer.reactions?.like || 0) +
                        (cheer.reactions?.heart || 0) +
                        (cheer.reactions?.pray || 0) +
                        (cheer.reactions?.praise || 0) +
                        (cheer.reactions?.fire || 0) +
                        (cheer.reactions?.blessing || 0);
                      const itemLikes = totalReactions > 0 ? totalReactions : cheer.likesCount || 0;
                      const isLiked = Boolean(cheer.userReaction);
                      const isJustCheered = justCheeredId === cheer.id;
                      const primaryText = cheer.title?.trim() || cheer.content?.trim() || '';
                      const secondaryContent =
                        cheer.title?.trim() &&
                        cheer.content?.trim() &&
                        cheer.content.trim() !== cheer.title.trim()
                          ? cheer.content.trim()
                          : '';

                      const ACCENT_STYLES = [
                        {
                          card: 'border-sky-200 dark:border-sky-800/80 bg-sky-50/75 hover:bg-sky-100/75 dark:bg-sky-950/35 dark:hover:bg-sky-950/55',
                          avatar: 'from-blue-600 to-sky-500 text-white shadow-sky-500/20',
                          title: 'text-blue-950 dark:text-sky-100 group-hover:text-blue-700 dark:group-hover:text-sky-300',
                          meta: 'text-blue-700 dark:text-sky-300',
                          btnDefault: 'border-sky-300 dark:border-sky-700 text-blue-700 dark:text-sky-300 hover:bg-blue-600 hover:text-white hover:border-blue-600',
                        },
                        {
                          card: 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/75 hover:bg-emerald-100/75 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/55',
                          avatar: 'from-emerald-600 to-teal-500 text-white shadow-emerald-500/20',
                          title: 'text-emerald-950 dark:text-emerald-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300',
                          meta: 'text-emerald-700 dark:text-emerald-300',
                          btnDefault: 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-600',
                        },
                        {
                          card: 'border-amber-200 dark:border-amber-800/80 bg-amber-50/75 hover:bg-amber-100/75 dark:bg-amber-950/30 dark:hover:bg-amber-950/50',
                          avatar: 'from-amber-500 to-orange-500 text-white shadow-amber-500/20',
                          title: 'text-amber-950 dark:text-amber-100 group-hover:text-amber-700 dark:group-hover:text-amber-300',
                          meta: 'text-amber-800 dark:text-amber-300',
                          btnDefault: 'border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-500 hover:text-white hover:border-amber-500',
                        },
                        {
                          card: 'border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/75 hover:bg-indigo-100/75 dark:bg-indigo-950/35 dark:hover:bg-indigo-950/55',
                          avatar: 'from-indigo-600 to-violet-500 text-white shadow-indigo-500/20',
                          title: 'text-indigo-950 dark:text-indigo-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300',
                          meta: 'text-indigo-700 dark:text-indigo-300',
                          btnDefault: 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-600',
                        },
                        {
                          card: 'border-rose-200 dark:border-rose-800/80 bg-rose-50/75 hover:bg-rose-100/75 dark:bg-rose-950/30 dark:hover:bg-rose-950/50',
                          avatar: 'from-rose-500 to-pink-500 text-white shadow-rose-500/20',
                          title: 'text-rose-950 dark:text-rose-100 group-hover:text-rose-700 dark:group-hover:text-rose-300',
                          meta: 'text-rose-700 dark:text-rose-300',
                          btnDefault: 'border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-500 hover:text-white hover:border-rose-500',
                        },
                      ];
                      const accent = ACCENT_STYLES[idx % ACCENT_STYLES.length];

                      return (
                        <div
                          key={cheer.id}
                          style={{ animationDelay: `${Math.min(idx, 6) * 55}ms` }}
                          className={`animate-cheer-item group flex items-start gap-2.5 px-3 py-2.5 rounded-xl sm:rounded-2xl border shadow-2xs transition-all duration-200 ${accent.card}`}
                        >
                          {/* Colorful Avatar Monogram or Anonymous Shield */}
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${accent.avatar} flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 shadow-xs transition-transform duration-200 group-hover:scale-105`}
                          >
                            {cheerHideAuthor ? (
                              <Shield className="w-3.5 h-3.5" />
                            ) : (
                              <span>{getAuthorInitials(cheer.authorName)}</span>
                            )}
                          </div>

                          <div
                            onClick={() => onNavigateTab?.('JOURNAL_CHEER')}
                            className="min-w-0 flex-1 cursor-pointer space-y-1"
                          >
                            <p className={`text-[13px] font-extrabold transition-colors leading-snug line-clamp-1 ${accent.title}`}>
                              {primaryText}
                            </p>
                            {secondaryContent && (
                              <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed line-clamp-2">
                                {secondaryContent}
                              </p>
                            )}
                            <div className="text-[11px] truncate flex items-center gap-1.5">
                              {cheerHideAuthor ? (
                                <>
                                  <span className={`font-bold ${accent.meta}`}>
                                    Thành viên ẩn danh
                                  </span>
                                  {cheer.date && (
                                    <>
                                      <span aria-hidden="true" className="text-slate-400">·</span>
                                      <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                        {cheer.date}
                                      </span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                                  <span className={`font-bold ${accent.meta}`}>
                                    {cheer.authorName}
                                  </span>
                                  {' · '}
                                  {cheer.companyCode}
                                  {cheer.areaCode ? ` · KV ${cheer.areaCode}` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setJustCheeredId(cheer.id);
                              window.setTimeout(() => {
                                setJustCheeredId((prev) => (prev === cheer.id ? null : prev));
                              }, 360);
                              onReactHuongKhi?.(cheer.id, 'like');
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer shrink-0 transition duration-150 active:scale-95 tabular-nums shadow-2xs ${
                              isJustCheered ? 'animate-cheer-pop ' : ''
                            }${
                              isLiked
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-600 text-white shadow-xs'
                                : `bg-white/95 dark:bg-slate-800/90 ${accent.btnDefault}`
                            }`}
                            title="Gửi lượt cổ vũ"
                          >
                            <ThumbsUp
                              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                                isLiked ? 'scale-110 text-white' : ''
                              }`}
                            />
                            <span>{itemLikes}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('JOURNAL_CHEER')}
                    className="w-full text-left px-4 py-4 hover:bg-sky-50/70 dark:hover:bg-slate-800/40 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2 transition cursor-pointer"
                  >
                    <span>Chưa có Nhật ký cảm tạ nào trong 24h qua.</span>
                    <span className="text-blue-700 dark:text-sky-400 font-extrabold shrink-0">
                      Viết ngay →
                    </span>
                  </button>
                )}

                {totalCheerPages > 1 && (
                  <div className="px-4 py-2 bg-sky-50/80 dark:bg-slate-800/50 border-t border-sky-200/70 dark:border-slate-800 flex items-center justify-center gap-1.5">
                    {Array.from({ length: totalCheerPages }, (_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCheerPage(idx)}
                        aria-label={`Trang tin nhắn ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === safeCheerPage
                            ? 'w-6 bg-gradient-to-r from-blue-600 to-emerald-500 dark:from-sky-400 dark:to-emerald-400'
                            : 'w-1.5 bg-sky-300 dark:bg-slate-600 hover:bg-sky-400'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Progress Showcase with Circular Donut */}
            {homeCfg.showProgressShowcase && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200/85 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div className="flex flex-col items-center justify-center text-center p-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-xs mb-2">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                      {formatNum(periodScore)} đ
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {activePeriod === 'DAY'
                        ? 'Điểm trong ngày'
                        : activePeriod === 'MONTH'
                        ? `Tháng (${dayDaysReportedThisMonth} ngày)`
                        : `Tổng điểm ${selectedYear}`}
                    </div>
                  </div>

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
                          className="text-slate-100 dark:text-slate-800"
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
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1.5 tabular-nums">
                      Mục tiêu {selectedYear}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Feature Shortcut Bento Cards */}
            {homeCfg.showFeatureCards && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('HONORS')}
                  className="group p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/25 border border-slate-200/85 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800/80 text-left transition duration-150 cursor-pointer flex flex-col justify-between min-h-[104px] shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                      Bảng Vinh danh &amp; Top 3
                    </div>
                    <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Xem thứ hạng
                    </span>
                    <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab?.('EDU_LMS')}
                  className="group p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-amber-50/40 dark:hover:bg-amber-950/25 border border-slate-200/85 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800/80 text-left transition duration-150 cursor-pointer flex flex-col justify-between min-h-[104px] shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                      Chủ đề tuần &amp; Giáo trình Edu
                    </div>
                    <GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      Mở LMS / CMS
                    </span>
                    <ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
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
