import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  Save,
  Sparkles,
  CheckCircle2,
  Trophy,
  RotateCcw,
  Award,
  AlertCircle,
} from 'lucide-react';
import {
  UserAccount,
  Member,
  DailyMetricKey,
  DailyReportMetrics,
  DailyReportRecord,
  PeriodGoalRecord,
  FestivalEvent,
  DAILY_METRIC_DEFINITIONS,
  EMPTY_DAILY_METRICS,
  DEFAULT_DAILY_GOALS,
  DEFAULT_EVENT_WEIGHTS,
} from '../types/edulms';
import { computeDailyMetricsScore, sumDailyReportMetrics } from '../utils/scoringEngine';

interface DailyReportSectionProps {
  currentUser: UserAccount | null;
  currentMember: Member | null;
  dailyReports: DailyReportRecord[];
  periodGoals: PeriodGoalRecord[];
  activeEvent: FestivalEvent | null;
  defaultWeights?: DailyReportMetrics;
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

  const userReports = useMemo(() => {
    if (!currentUser) return [];
    return dailyReports.filter((r) => r.uid === currentUser.id);
  }, [dailyReports, currentUser?.id]);

  // Kết quả tổng hợp tháng (từ báo cáo theo ngày)
  const monthAggregatedResults = useMemo(() => {
    const matched = userReports.filter((r) => r.month === selectedMonth || r.date.startsWith(selectedMonth));
    return sumDailyReportMetrics(matched);
  }, [userReports, selectedMonth]);

  // Kết quả tổng hợp năm (từ báo cáo theo ngày)
  const yearAggregatedResults = useMemo(() => {
    const matched = userReports.filter((r) => r.year === selectedYear || r.date.startsWith(selectedYear));
    return sumDailyReportMetrics(matched);
  }, [userReports, selectedYear]);

  // Đồng bộ form khi đổi tab hoặc ngày/tháng/năm
  useEffect(() => {
    if (activePeriod === 'DAY') {
      const existing = userReports.find((r) => r.date === selectedDate);
      if (existing) {
        setGoalsDraft({ ...EMPTY_DAILY_METRICS, ...existing.goals });
        setResultsDraft({ ...EMPTY_DAILY_METRICS, ...existing.results });
      } else {
        // Kế thừa mục tiêu của báo cáo gần nhất nếu có, hoặc mặc định
        const latest = [...userReports].sort((a, b) => b.date.localeCompare(a.date))[0];
        setGoalsDraft(latest ? { ...DEFAULT_DAILY_GOALS, ...latest.goals } : { ...DEFAULT_DAILY_GOALS });
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

  // Kết quả hiển thị hiện tại theo tab
  const displayedResults: DailyReportMetrics =
    activePeriod === 'DAY'
      ? resultsDraft
      : activePeriod === 'MONTH'
      ? monthAggregatedResults
      : yearAggregatedResults;

  // Trọng số điểm từ Event đang kích hoạt hoặc Bảng điểm mặc định hệ thống
  const activeWeights = activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS;
  const periodScore = useMemo(
    () => computeDailyMetricsScore(displayedResults, activeWeights),
    [displayedResults, activeWeights]
  );

  // Tổng % hoàn thành trung bình của 7 chỉ số
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

  // Kiểm tra trạng thái tham gia Event
  const isParticipantInActiveEvent = useMemo(() => {
    if (!activeEvent) return true;
    if (!activeEvent.restrictParticipants) return true;
    if (!currentMember) return false;
    return activeEvent.participantIds.includes(currentMember.id);
  }, [activeEvent, currentMember]);

  const handleGoalChange = (key: DailyMetricKey, raw: string) => {
    const num = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
    setGoalsDraft((prev) => ({ ...prev, [key]: num }));
  };

  const handleResultChange = (key: DailyMetricKey, raw: string) => {
    if (activePeriod !== 'DAY') return; // Khóa nhập kết quả ở tab Tháng & Năm
    const num = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
    setResultsDraft((prev) => ({ ...prev, [key]: num }));
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

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
          Báo cáo hằng ngày
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Vui lòng đăng nhập tài khoản cá nhân để nhập mục tiêu và kết quả hằng ngày.
        </p>
        <button
          onClick={onOpenAuthModal}
          className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <section id="entry-section" className="max-w-lg mx-auto w-full">
      {/* Compact Event Banner Pill (if active event exists) */}
      {activeEvent && (
        <div
          className={`mb-2.5 px-3 py-2 rounded-2xl border text-[11px] flex items-center justify-between gap-2 ${
            isParticipantInActiveEvent
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold truncate">{activeEvent.title}</span>
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

      {/* Main Single-Screen Mobile Card */}
      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-md border border-slate-200/80 dark:border-slate-800 overflow-hidden"
      >
        {/* Top Compact Bar: Title + Period Navigator */}
        <div className="px-3.5 pt-3 pb-2.5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black tracking-tight truncate">Báo cáo hằng ngày</h2>
                <p className="text-[10px] text-blue-200/80 truncate">
                  {currentUser.fullName} • {currentUser.companyCode}
                </p>
              </div>
            </div>

            {/* Period Navigator */}
            <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-xl px-1 py-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (activePeriod === 'DAY') setSelectedDate((d) => shiftDateStr(d, -1));
                  else if (activePeriod === 'MONTH') setSelectedMonth((m) => shiftMonthStr(m, -1));
                  else setSelectedYear((y) => String((parseInt(y, 10) || 2026) - 1));
                }}
                className="p-1 rounded-lg hover:bg-white/15 transition cursor-pointer"
                aria-label="Lùi thời gian"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {activePeriod === 'DAY' ? (
                <span className="px-1.5 text-[11px] font-bold tabular-nums flex items-center gap-1">
                  <span className="text-amber-300">{getWeekdayVi(selectedDate)}</span>
                  <span>{formatDisplayDate(selectedDate)}</span>
                </span>
              ) : activePeriod === 'MONTH' ? (
                <span className="px-1.5 text-[11px] font-bold tabular-nums">
                  {formatDisplayMonth(selectedMonth)}
                </span>
              ) : (
                <span className="px-2 text-[11px] font-bold tabular-nums">Năm {selectedYear}</span>
              )}

              <button
                type="button"
                onClick={() => {
                  if (activePeriod === 'DAY') setSelectedDate((d) => shiftDateStr(d, 1));
                  else if (activePeriod === 'MONTH') setSelectedMonth((m) => shiftMonthStr(m, 1));
                  else setSelectedYear((y) => String((parseInt(y, 10) || 2026) + 1));
                }}
                className="p-1 rounded-lg hover:bg-white/15 transition cursor-pointer"
                aria-label="Tiến thời gian"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3 Thẻ: Ngày / Tháng / Năm */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950/45 p-1 rounded-xl border border-white/10">
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
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Free Date Selection Strip for Tab Ngày */}
        {activePeriod === 'DAY' && (
          <div className="px-3 py-2 bg-slate-50/90 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="relative flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDate(e.target.value);
                  }}
                  aria-label="Chọn ngày báo cáo"
                  className="bg-transparent text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer tabular-nums"
                />
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                  hasReportForSelectedDate
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                {hasReportForSelectedDate ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Đã nhập</span>
                  </>
                ) : (
                  <span>Chưa nhập</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1">
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
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notice on Month / Year locked result mode */}
        {activePeriod !== 'DAY' && (
          <div className="px-3.5 py-1.5 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between gap-2 text-[10px] text-blue-800 dark:text-blue-200 font-medium">
            <span className="flex items-center gap-1 min-w-0">
              <Lock className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">
                Kết quả {activePeriod === 'MONTH' ? 'tháng' : 'năm'} tự cộng từ các ngày đã nhập
              </span>
            </span>
            {activePeriod === 'MONTH' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  aria-label="Chọn tháng"
                  className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-200 cursor-pointer"
                />
                <span className="font-bold text-blue-700 dark:text-blue-300">
                  {dayDaysReportedThisMonth} ngày
                </span>
              </div>
            ) : (
              <span className="font-bold text-blue-700 dark:text-blue-300 shrink-0">
                Năm {selectedYear}
              </span>
            )}
          </div>
        )}

        {/* Table Header: Chỉ số | Mục tiêu | Kết quả | Tiến độ (%) */}
        <div className="grid grid-cols-[1fr_76px_76px_66px] sm:grid-cols-[1fr_92px_92px_76px] gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <div>Hạng mục</div>
          <div className="text-center">Mục tiêu</div>
          <div className="text-center flex items-center justify-center gap-1">
            <span>Kết quả</span>
            {activePeriod !== 'DAY' && <Lock className="w-2.5 h-2.5 text-slate-400" />}
          </div>
          <div className="text-right">Tiến độ</div>
        </div>

        {/* 7 Compact Rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 px-3">
          {DAILY_METRIC_DEFINITIONS.map((metric) => {
            const goalVal = goalsDraft[metric.key] ?? 0;
            const resVal = displayedResults[metric.key] ?? 0;
            const pct = goalVal > 0 ? Math.round((resVal / goalVal) * 100) : resVal > 0 ? 100 : 0;

            const pctColor =
              pct >= 100
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : pct >= 50
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                : pct > 0
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';

            return (
              <div
                key={metric.key}
                className="grid grid-cols-[1fr_76px_76px_66px] sm:grid-cols-[1fr_92px_92px_76px] gap-1.5 items-center py-2"
              >
                {/* Metric Label (abbreviation only) */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${metric.dotColor}`} />
                  <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                    {metric.label}
                  </span>
                </div>

                {/* Goal Input */}
                <div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={goalVal === 0 ? '' : goalVal}
                    placeholder="0"
                    onChange={(e) => handleGoalChange(metric.key, e.target.value)}
                    aria-label={`Mục tiêu ${metric.label}`}
                    className="w-full h-8 text-center text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 tabular-nums"
                  />
                </div>

                {/* Result Input (Editable in DAY, Locked in MONTH/YEAR) */}
                <div>
                  {activePeriod === 'DAY' ? (
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={resVal === 0 ? '' : resVal}
                      placeholder="0"
                      onChange={(e) => handleResultChange(metric.key, e.target.value)}
                      aria-label={`Kết quả ${metric.label}`}
                      className="w-full h-8 text-center text-xs sm:text-sm font-extrabold rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 tabular-nums"
                    />
                  ) : (
                    <div
                      title="Kết quả tổng hợp tự động từ báo cáo Ngày"
                      className="w-full h-8 flex items-center justify-center text-xs sm:text-sm font-extrabold rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 tabular-nums select-none"
                    >
                      {resVal}
                    </div>
                  )}
                </div>

                {/* Progress (%) */}
                <div className="flex justify-end">
                  <span
                    className={`inline-flex items-center justify-center min-w-[54px] h-7 px-1.5 rounded-lg text-[11px] font-black border tabular-nums ${pctColor}`}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary & Save Footer (Fits cleanly in single mobile screen) */}
        <div className="px-3.5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          {/* Progress Bar + Event Points */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-slate-600 dark:text-slate-300">Tiến độ chung</span>
                <span className="text-blue-700 dark:text-blue-300 tabular-nums">{overallProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, overallProgress)}%` }}
                />
              </div>
            </div>

            <div className="text-right shrink-0 pl-2 border-l border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Điểm quy đổi</div>
              <div className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums flex items-center justify-end gap-1">
                <Trophy className="w-3.5 h-3.5" />
                <span>{formatNum(periodScore)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {activePeriod === 'DAY' && selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shrink-0 flex items-center gap-1"
                title="Quay về ngày hôm nay"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hôm nay</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs sm:text-sm font-extrabold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Đang lưu...'
                  : activePeriod === 'DAY'
                  ? 'Lưu báo cáo ngày'
                  : activePeriod === 'MONTH'
                  ? 'Lưu mục tiêu tháng'
                  : 'Lưu mục tiêu năm'}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Subtle footer helper link */}
      <div className="mt-2.5 flex items-center justify-between px-2 text-[11px] text-slate-500 dark:text-slate-400">
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
            <span>Liên hệ Admin để duyệt dự thi</span>
          </span>
        )}
      </div>
    </section>
  );
};
