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
    <section id="entry-section" className="max-w-5xl mx-auto w-full space-y-3 sm:space-y-4">
      {/* Compact Active Event Bar */}
      {activeEvent && (
        <div
          className={`px-3.5 py-2.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            isParticipantInActiveEvent
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/50 text-amber-950 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                {activeEvent.title}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                ·{' '}
                <span
                  className={
                    isParticipantInActiveEvent
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }
                >
                  {isParticipantInActiveEvent ? 'Đang dự thi' : 'Ngoài danh sách sự kiện'}
                </span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.('EVENT_HUB')}
            className="text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline shrink-0 cursor-pointer"
          >
            Chi tiết
          </button>
        </div>
      )}

      {/* MAIN BENTO GRID: Daily Report Card + Modern Companion Stack */}
      <div
        className={`grid grid-cols-1 gap-3.5 sm:gap-5 items-start ${
          hasAnyCompanionBlock ? 'lg:grid-cols-12' : 'max-w-2xl mx-auto'
        }`}
      >
        {/* LEFT / PRIMARY COLUMN: DAILY REPORT CARD */}
        <div className={hasAnyCompanionBlock ? 'lg:col-span-7' : 'w-full'}>
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/85 dark:border-slate-800 overflow-hidden"
          >
            {/* Modern Editorial Header */}
            {homeCfg.showHeaderBanner ? (
              <div className="relative px-4 sm:px-5 pt-4 pb-3.5 bg-gradient-to-br from-blue-50/90 via-white to-sky-50/70 dark:from-slate-900 dark:via-blue-950/50 dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-800 overflow-hidden">
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-sky-200/35 dark:bg-blue-500/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-amber-200/25 dark:bg-amber-400/10 blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-sky-400">
                      Hành Thực Lục
                    </div>
                    <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                      Báo cáo hằng ngày
                    </h1>
                    {currentUser ? (
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {currentUser.fullName}
                        </span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span>Sion {currentUser.companyCode}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span>KV {currentUser.areaCode}</span>
                        {currentUser.unitCode && (
                          <>
                            <span className="mx-1.5 text-slate-400">·</span>
                            <span>{currentUser.unitCode}</span>
                          </>
                        )}
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="font-semibold text-blue-700 dark:text-sky-300">
                          {(ROLE_DISPLAY_META[currentUser.role] || ROLE_DISPLAY_META.MEMBER).label}
                        </span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenAuthModal}
                        className="text-xs font-semibold text-blue-700 dark:text-amber-300 hover:underline underline-offset-2 cursor-pointer"
                      >
                        Đăng nhập để lưu &amp; đồng bộ kết quả →
                      </button>
                    )}
                  </div>

                  {/* Period Segmented Switch */}
                  <div className="inline-grid grid-cols-3 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shrink-0 self-start sm:self-center">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Compact Header when Admin hides Header Banner */
              <div className="px-4 py-3 bg-slate-900 dark:bg-slate-950 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
                <div className="font-bold text-sm tracking-tight">Báo cáo hằng ngày</div>
                <div className="inline-flex p-0.5 rounded-xl bg-white/10 gap-0.5">
                  {(['DAY', 'MONTH', 'YEAR'] as PeriodTab[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActivePeriod(id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        activePeriod === id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      {id === 'DAY' ? 'Ngày' : id === 'MONTH' ? 'Tháng' : 'Năm'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date / Period Navigator Strip */}
            {activePeriod === 'DAY' ? (
              <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/35 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
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
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                      aria-label="Ngày trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 px-1.5 tabular-nums">
                      {getWeekdayVi(selectedDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDate((d) => shiftDateStr(d, 1))}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                      aria-label="Ngày sau"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {currentUser && (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1 ${
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

                <div className="inline-flex items-center p-0.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 gap-0.5">
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
                            ? 'bg-blue-700 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Month / Year Navigator */
              <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/35 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[11px] font-medium truncate">
                    Kết quả tự cộng từ báo cáo ngày
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (activePeriod === 'MONTH') setSelectedMonth((m) => shiftMonthStr(m, -1));
                      else setSelectedYear((y) => String((parseInt(y, 10) || 2026) - 1));
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
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
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                    aria-label="Kỳ sau"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Clean Modern 4-Column Metric Table */}
            <div className="px-3 sm:px-4 pt-3 pb-1">
              <div className="grid grid-cols-[minmax(82px,1fr)_minmax(62px,96px)_minmax(62px,96px)_minmax(50px,74px)] gap-2 px-2.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 items-center">
                <div>Hạng mục</div>
                <div className="text-center flex items-center justify-center gap-1">
                  <Target className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
                  <span>Mục tiêu</span>
                </div>
                <div className="text-center flex items-center justify-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0 hidden sm:inline" />
                  <span>Kết quả</span>
                  {activePeriod !== 'DAY' && <Lock className="w-3 h-3 text-slate-400" />}
                </div>
                <div className="text-right flex items-center justify-end gap-1 pr-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 hidden sm:inline" />
                  <span>Tỉ lệ</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-1">
                {DAILY_METRIC_DEFINITIONS.map((metric) => {
                  const goalVal = goalsDraft[metric.key] ?? 0;
                  const resVal = displayedResults[metric.key] ?? 0;
                  const pct =
                    goalVal > 0 ? Math.round((resVal / goalVal) * 100) : resVal > 0 ? 100 : 0;

                  const iconMeta = METRIC_ICON_META[metric.key];
                  const RowIcon = iconMeta.icon;

                  const pctTextCls =
                    pct >= 100
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/50'
                      : pct >= 50
                      ? 'text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/50'
                      : pct > 0
                      ? 'text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/50'
                      : 'text-slate-400 dark:text-slate-500 bg-transparent';

                  return (
                    <div
                      key={metric.key}
                      className="grid grid-cols-[minmax(82px,1fr)_minmax(62px,96px)_minmax(62px,96px)_minmax(50px,74px)] gap-2 items-center px-2 py-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl ${iconMeta.bgCls} flex items-center justify-center shrink-0`}
                        >
                          <RowIcon className={`w-3.5 h-3.5 ${iconMeta.iconCls}`} />
                        </div>
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                          {metric.label}
                        </span>
                      </div>

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
                          className="w-full h-9 text-center text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/70 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 tabular-nums transition"
                        />
                      </div>

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
                            className="w-full h-9 text-center text-xs sm:text-sm font-extrabold rounded-xl border border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/25 text-emerald-900 dark:text-emerald-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 tabular-nums transition"
                          />
                        ) : (
                          <div
                            title="Kết quả tổng hợp tự động từ báo cáo Ngày"
                            className="w-full h-9 flex items-center justify-center text-xs sm:text-sm font-extrabold rounded-xl border border-slate-200/70 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 tabular-nums select-none"
                          >
                            {resVal}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <span
                          className={`inline-flex items-center justify-center min-w-[48px] h-8 px-2 rounded-lg text-xs font-extrabold tabular-nums ${pctTextCls}`}
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
            <div className="px-4 py-3 mt-1 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                    <span className="text-slate-600 dark:text-slate-300">Tiến độ hoàn thành</span>
                    <span className="text-blue-700 dark:text-blue-300 tabular-nums">
                      {overallProgress}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200/90 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, overallProgress)}%` }}
                    />
                  </div>
                </div>

                <div className="text-right shrink-0 pl-3 border-l border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Điểm quy đổi
                  </div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums flex items-center justify-end gap-1 mt-0.5">
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
                    className="h-10 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hôm nay</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-10 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
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
                  className="hover:text-blue-700 dark:hover:text-blue-400 underline underline-offset-2 cursor-pointer"
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

            {/* 2. Modern Editorial Cheer Messages Card */}
            {homeCfg.showCheerTicker && (
              <div
                onMouseEnter={() => setIsCheerPaused(true)}
                onMouseLeave={() => setIsCheerPaused(false)}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/85 dark:border-slate-800 overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-sky-50/80 via-white to-emerald-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          Tin nhắn cổ vũ
                        </h2>
                        {huongKhiList.length > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                            · {cheerRangeLabel}
                          </span>
                        )}
                      </div>
                      {totalCheerPages > 1 && (
                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums">
                          {isCheerPaused ? (
                            <>
                              <Pause className="w-2.5 h-2.5 text-amber-500" />
                              <span>Đang tạm dừng</span>
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
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheerPage((prev) => (prev + 1) % totalCheerPages)}
                          aria-label="Tin nhắn tiếp theo"
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigateTab?.('JOURNAL_CHEER')}
                      className="text-[11px] font-bold text-blue-700 dark:text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                    >
                      <span>Xem thêm</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Editorial Feed Items */}
                {visibleCheers.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {visibleCheers.map((cheer) => {
                      const totalReactions =
                        (cheer.reactions?.like || 0) +
                        (cheer.reactions?.heart || 0) +
                        (cheer.reactions?.pray || 0) +
                        (cheer.reactions?.praise || 0) +
                        (cheer.reactions?.fire || 0) +
                        (cheer.reactions?.blessing || 0);
                      const itemLikes = totalReactions > 0 ? totalReactions : cheer.likesCount || 0;
                      const isLiked = Boolean(cheer.userReaction);
                      const primaryText = cheer.title?.trim() || cheer.content?.trim() || '';
                      const secondaryContent =
                        cheer.title?.trim() &&
                        cheer.content?.trim() &&
                        cheer.content.trim() !== cheer.title.trim()
                          ? cheer.content.trim()
                          : '';

                      return (
                        <div
                          key={cheer.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/35 transition-colors"
                        >
                          {/* Avatar Monogram or Anonymous Shield */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 mt-0.5 ${
                              cheerHideAuthor
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50'
                                : 'bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/60 dark:to-blue-900/60 text-blue-800 dark:text-sky-200 border border-sky-200/70 dark:border-sky-800/60'
                            }`}
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
                            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-1">
                              {primaryText}
                            </p>
                            {secondaryContent && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                                {secondaryContent}
                              </p>
                            )}
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                              {cheerHideAuthor ? (
                                <>
                                  <span className="font-medium text-slate-600 dark:text-slate-300">
                                    Thành viên ẩn danh
                                  </span>
                                  {cheer.date && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="tabular-nums">{cheer.date}</span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
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
                            onClick={() => onReactHuongKhi?.(cheer.id, 'like')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer shrink-0 transition tabular-nums ${
                              isLiked
                                ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-blue-200 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                            title="Gửi lượt cổ vũ"
                          >
                            <ThumbsUp
                              className={`w-3.5 h-3.5 ${
                                isLiked
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-slate-500 dark:text-slate-400'
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
                    className="w-full text-left px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 transition cursor-pointer"
                  >
                    <span>Chưa có Nhật ký cảm tạ nào trong 24h qua.</span>
                    <span className="text-blue-700 dark:text-blue-400 font-bold shrink-0">
                      Viết ngay →
                    </span>
                  </button>
                )}

                {totalCheerPages > 1 && (
                  <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5">
                    {Array.from({ length: totalCheerPages }, (_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCheerPage(idx)}
                        aria-label={`Trang tin nhắn ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          idx === safeCheerPage
                            ? 'w-5 bg-blue-600 dark:bg-sky-400'
                            : 'w-1.5 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
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
