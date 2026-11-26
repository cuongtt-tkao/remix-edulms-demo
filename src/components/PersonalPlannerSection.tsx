import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Save,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  RotateCcw,
  Lock,
  Check,
  X,
} from 'lucide-react';
import {
  DayThreeSessions,
  PersonalPlannerRecord,
  UserAccount,
  WORK_WEEK_DAYS,
  WeekDayKey,
  createEmptyWeekSessionsMap,
} from '../types/edulms';

interface PersonalPlannerSectionProps {
  currentUser: UserAccount;
  personalPlanners: PersonalPlannerRecord[];
  onSavePersonalPlanner: (planner: PersonalPlannerRecord) => Promise<void>;
  onShowNotification: (msg: string) => void;
}

const pad2 = (n: number): string => n.toString().padStart(2, '0');

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseLocalDate = (dateStr: string): Date => {
  const parts = dateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date();
};

const getSundayOfWeek = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toDateStr(d);
};

const addDays = (dateStr: string, offset: number): string => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + offset);
  return toDateStr(d);
};

const formatDayMonthVN = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

const formatDateVN = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const cloneWeekSessions = (
  src?: Record<WeekDayKey, DayThreeSessions> | null
): Record<WeekDayKey, DayThreeSessions> => {
  const base = createEmptyWeekSessionsMap();
  if (!src) return base;
  WORK_WEEK_DAYS.forEach(({ key }) => {
    const entry = src[key];
    if (entry) {
      base[key] = {
        morning: entry.morning || '',
        afternoon: entry.afternoon || '',
        evening: entry.evening || '',
      };
    }
  });
  return base;
};

export const PersonalPlannerSection: React.FC<PersonalPlannerSectionProps> = ({
  currentUser,
  personalPlanners,
  onSavePersonalPlanner,
  onShowNotification,
}) => {
  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const currentWeekSunday = useMemo(() => getSundayOfWeek(todayStr), [todayStr]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(currentWeekSunday);

  const selectedWeekEnd = useMemo(() => addDays(selectedWeekStart, 6), [selectedWeekStart]);
  const prevWeekStart = useMemo(() => addDays(selectedWeekStart, -7), [selectedWeekStart]);

  const existingPlanner = useMemo(
    () =>
      personalPlanners.find(
        (p) => p.ownerUid === currentUser.id && p.weekStart === selectedWeekStart
      ) || null,
    [personalPlanners, currentUser.id, selectedWeekStart]
  );

  const previousWeekPlanner = useMemo(
    () =>
      personalPlanners.find(
        (p) => p.ownerUid === currentUser.id && p.weekStart === prevWeekStart
      ) || null,
    [personalPlanners, currentUser.id, prevWeekStart]
  );

  const [sessionsDraft, setSessionsDraft] = useState<Record<WeekDayKey, DayThreeSessions>>(() =>
    createEmptyWeekSessionsMap()
  );
  const [reflectionNote, setReflectionNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);

  useEffect(() => {
    if (existingPlanner) {
      setSessionsDraft(cloneWeekSessions(existingPlanner.sessions));
      setReflectionNote(existingPlanner.reflectionNote || '');
    } else {
      setSessionsDraft(createEmptyWeekSessionsMap());
      setReflectionNote('');
    }
    setHasUnsavedChanges(false);
  }, [existingPlanner, selectedWeekStart]);

  const handleCellChange = (
    dayKey: WeekDayKey,
    sessionKey: keyof DayThreeSessions,
    value: string
  ) => {
    setSessionsDraft((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [sessionKey]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleCopyFromPreviousWeek = () => {
    if (!previousWeekPlanner) {
      onShowNotification(
        `Chưa có kế hoạch đã lưu ở tuần trước (${formatDayMonthVN(prevWeekStart)} – ${formatDayMonthVN(
          addDays(prevWeekStart, 6)
        )}).`
      );
      return;
    }
    setSessionsDraft(cloneWeekSessions(previousWeekPlanner.sessions));
    if (previousWeekPlanner.reflectionNote && !reflectionNote.trim()) {
      setReflectionNote(previousWeekPlanner.reflectionNote);
    }
    setHasUnsavedChanges(true);
    onShowNotification('Đã sao chép kế hoạch từ tuần trước. Bấm "Lưu" để xác nhận!');
  };

  const handleResetDraft = () => {
    if (existingPlanner) {
      setSessionsDraft(cloneWeekSessions(existingPlanner.sessions));
      setReflectionNote(existingPlanner.reflectionNote || '');
    } else {
      setSessionsDraft(createEmptyWeekSessionsMap());
      setReflectionNote('');
    }
    setHasUnsavedChanges(false);
  };

  const filledSessionsCount = useMemo(() => {
    let count = 0;
    WORK_WEEK_DAYS.forEach(({ key }) => {
      const d = sessionsDraft[key];
      if (d?.morning?.trim()) count += 1;
      if (d?.afternoon?.trim()) count += 1;
      if (d?.evening?.trim()) count += 1;
    });
    return count;
  }, [sessionsDraft]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const plannerId = existingPlanner?.id || `${currentUser.id}_${selectedWeekStart}`;
      await onSavePersonalPlanner({
        id: plannerId,
        ownerUid: currentUser.id,
        ownerName: currentUser.fullName,
        companyCode: currentUser.companyCode || '',
        areaCode: currentUser.areaCode || '',
        weekStart: selectedWeekStart,
        weekEnd: selectedWeekEnd,
        sessions: cloneWeekSessions(sessionsDraft),
        reflectionNote: reflectionNote.trim().slice(0, 800),
        createdAt: existingPlanner?.createdAt || nowIso,
        updatedAt: nowIso,
      });
      setHasUnsavedChanges(false);
      onShowNotification(
        `Đã lưu Kế hoạch LLV tuần (${formatDayMonthVN(selectedWeekStart)} – ${formatDateVN(
          selectedWeekEnd
        )})!`
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu kế hoạch: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isThisWeek = selectedWeekStart === currentWeekSunday;
  const isNextWeek = selectedWeekStart === addDays(currentWeekSunday, 7);
  const isPrevWeek = selectedWeekStart === addDays(currentWeekSunday, -7);

  const sessionConfigs: Array<{
    key: keyof DayThreeSessions;
    label: string;
    timeHint: string;
    icon: React.ComponentType<{ className?: string }>;
    colHeaderCls: string;
    colTintCls: string;
    iconCls: string;
    focusRingCls: string;
  }> = [
    {
      key: 'morning',
      label: 'Sáng',
      timeHint: '06:00–11:59',
      icon: Sun,
      colHeaderCls: 'bg-amber-50/75 dark:bg-amber-950/25 text-amber-950 dark:text-amber-100',
      colTintCls: 'bg-amber-50/10 dark:bg-amber-950/5',
      iconCls: 'text-amber-600 dark:text-amber-400',
      focusRingCls:
        'focus-within:bg-amber-50/40 dark:focus-within:bg-amber-950/20 focus-within:ring-2 focus-within:ring-inset focus-within:ring-amber-500/60',
    },
    {
      key: 'afternoon',
      label: 'Chiều',
      timeHint: '12:00–17:59',
      icon: Sunset,
      colHeaderCls: 'bg-sky-50/85 dark:bg-sky-950/30 text-sky-950 dark:text-sky-100',
      colTintCls: 'bg-sky-50/15 dark:bg-sky-950/5',
      iconCls: 'text-sky-600 dark:text-sky-400',
      focusRingCls:
        'focus-within:bg-sky-50/45 dark:focus-within:bg-sky-950/25 focus-within:ring-2 focus-within:ring-inset focus-within:ring-sky-500/60',
    },
    {
      key: 'evening',
      label: 'Tối',
      timeHint: '18:00–22:59',
      icon: Moon,
      colHeaderCls: 'bg-indigo-50/75 dark:bg-indigo-950/25 text-indigo-950 dark:text-indigo-100',
      colTintCls: 'bg-indigo-50/10 dark:bg-indigo-950/5',
      iconCls: 'text-indigo-600 dark:text-indigo-400',
      focusRingCls:
        'focus-within:bg-indigo-50/40 dark:focus-within:bg-indigo-950/20 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500/60',
    },
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Ultra-Compact Single-Row Workspace Toolbar */}
      <div className="px-2.5 py-2 sm:px-4 sm:py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Title + inline status metadata */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              Kế hoạch LLV
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <Lock className="w-2.5 h-2.5 shrink-0 hidden sm:inline" />
              <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                {filledSessionsCount}/21 buổi
              </span>
              {hasUnsavedChanges ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    Chưa lưu
                  </span>
                </>
              ) : existingPlanner ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Check className="w-3 h-3" />
                    <span className="hidden sm:inline">Đã lưu</span>
                  </span>
                </>
              ) : null}
            </span>
          </div>
        </div>

        {/* Center: Week Stepper & Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))}
              className="h-7 w-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition"
              aria-label="Tuần trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="h-7 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-flex items-center text-[11px] font-bold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">
              {formatDayMonthVN(selectedWeekStart)} – {formatDayMonthVN(selectedWeekEnd)}
            </span>

            <button
              type="button"
              onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))}
              className="h-7 w-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition"
              aria-label="Tuần sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden md:inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-0.5">
            {[
              { label: 'Trước', active: isPrevWeek, target: addDays(currentWeekSunday, -7) },
              { label: 'Tuần này', active: isThisWeek, target: currentWeekSunday },
              { label: 'Sau', active: isNextWeek, target: addDays(currentWeekSunday, 7) },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setSelectedWeekStart(item.target)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition whitespace-nowrap shrink-0 ${
                  item.active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={selectedWeekStart}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedWeekStart(getSundayOfWeek(e.target.value));
              }
            }}
            aria-label="Chọn tuần theo ngày"
            className="hidden sm:block h-7 px-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyFromPreviousWeek}
            className="h-7 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0"
            title="Sao chép từ tuần trước"
          >
            <Copy className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Chép tuần trước</span>
            <span className="sm:hidden">Chép</span>
          </button>

          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="h-7 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0"
              title="Hoàn tác"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">Hoàn tác</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`h-7 px-3 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 transition whitespace-nowrap shrink-0 ${
              hasUnsavedChanges
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white'
            }`}
          >
            <Save className="w-3 h-3" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
          </button>
        </div>
      </div>

      {/* Single-Screen 7-Row x 3-Column Sheet Matrix (CN -> T7 rows, Sáng / Chiều / Tối columns) */}
      <div className="w-full">
        {/* Column Headers: Ngày | Sáng | Chiều | Tối */}
        <div className="grid grid-cols-[44px_repeat(3,minmax(0,1fr))] sm:grid-cols-[72px_repeat(3,minmax(0,1fr))] border-b border-slate-300 dark:border-slate-700">
          <div className="px-1 py-1.5 sm:px-2 bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Ngày
          </div>
          {sessionConfigs.map((sess) => {
            const SessIcon = sess.icon;
            return (
              <div
                key={sess.key}
                className={`px-1.5 py-1.5 sm:px-3 border-l border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1.5 ${sess.colHeaderCls}`}
              >
                <SessIcon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${sess.iconCls}`} />
                <span className="text-[11px] sm:text-xs font-bold tracking-tight">
                  {sess.label}
                </span>
                <span className="hidden lg:inline text-[10px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {sess.timeHint}
                </span>
              </div>
            );
          })}
        </div>

        {/* 7 Day Rows (CN -> T7) — Sized to fit 100% on 1 viewport without scrolling */}
        <div className="divide-y divide-slate-300 dark:divide-slate-700">
          {WORK_WEEK_DAYS.map((day, idx) => {
            const dateStr = addDays(selectedWeekStart, idx);
            const isToday = dateStr === todayStr;
            const isSunday = day.key === 'sun';

            return (
              <div
                key={day.key}
                className={`grid grid-cols-[44px_repeat(3,minmax(0,1fr))] sm:grid-cols-[72px_repeat(3,minmax(0,1fr))] items-stretch transition-colors ${
                  isToday
                    ? 'bg-indigo-50/35 dark:bg-indigo-950/20'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                {/* Compact Left Day Cell */}
                <div
                  className={`px-0.5 py-1 sm:px-1.5 flex flex-col items-center justify-center text-center select-none ${
                    isToday
                      ? 'bg-indigo-100/75 dark:bg-indigo-950/55'
                      : isSunday
                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                      : 'bg-slate-50/75 dark:bg-slate-800/35'
                  }`}
                >
                  <span
                    className={`text-[11px] sm:text-xs font-extrabold leading-tight ${
                      isToday
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : isSunday
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {day.shortLabel}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums leading-tight mt-0.5">
                    {formatDayMonthVN(dateStr)}
                  </span>
                  {isToday && (
                    <span className="text-[8px] sm:text-[9px] font-extrabold text-indigo-600 dark:text-indigo-300 leading-none mt-0.5">
                      Nay
                    </span>
                  )}
                </div>

                {/* 3 Compact Ruled Session Cells: Sáng | Chiều | Tối */}
                {sessionConfigs.map((sess) => {
                  const cellVal = sessionsDraft[day.key]?.[sess.key] || '';

                  return (
                    <div
                      key={`${day.key}-${sess.key}`}
                      className={`relative border-l border-slate-300 dark:border-slate-700 transition-colors ${
                        isToday ? '' : sess.colTintCls
                      } ${sess.focusRingCls}`}
                    >
                      {/* 3 ruled lines inside compact cell: 16px on mobile, 18px on desktop */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-[2px] flex flex-col"
                      >
                        <div className="h-[16px] sm:h-[18px] border-b border-dotted border-slate-300/80 dark:border-slate-700/80" />
                        <div className="h-[16px] sm:h-[18px] border-b border-dotted border-slate-300/80 dark:border-slate-700/80" />
                      </div>

                      <textarea
                        rows={3}
                        value={cellVal}
                        onChange={(e) => handleCellChange(day.key, sess.key, e.target.value)}
                        aria-label={`${day.fullLabel} (${formatDayMonthVN(dateStr)}) - Buổi ${sess.label}`}
                        placeholder="Nhập việc..."
                        className="relative z-10 block w-full h-[52px] sm:h-[58px] px-1.5 sm:px-2.5 py-[2px] bg-transparent text-[11px] sm:text-xs font-medium text-slate-800 dark:text-slate-100 leading-[16px] sm:leading-[18px] resize-none overflow-y-auto focus:outline-none placeholder:text-slate-400/0 focus:placeholder:text-slate-400/80 dark:focus:placeholder:text-slate-500/80"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Slim 1-Line Footer for Weekly Reflection Note (opens modal so grid never shifts/scrolls) */}
      <div className="px-3 py-1.5 sm:px-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsReflectionModalOpen(true)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition min-w-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="shrink-0">Trọng tâm &amp; cầu nguyện tuần:</span>
          <span className="font-normal text-slate-500 dark:text-slate-400 truncate">
            {reflectionNote.trim() || 'Chạm để ghi chú trọng tâm hoặc câu Kinh Thánh khích lệ...'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsReflectionModalOpen(true)}
          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
        >
          {reflectionNote.trim() ? 'Sửa ghi chú' : 'Thêm ghi chú'}
        </button>
      </div>

      {/* Modal Editor for Weekly Reflection Note */}
      {isReflectionModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsReflectionModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 sm:p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Lời cầu nguyện &amp; Trọng tâm tuần ({formatDayMonthVN(selectedWeekStart)} –{' '}
                  {formatDayMonthVN(selectedWeekEnd)})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsReflectionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={4}
              maxLength={800}
              value={reflectionNote}
              onChange={(e) => {
                setReflectionNote(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Ghi chú câu Kinh Thánh khích lệ, mục tiêu ưu tiên hoặc lời tạ ơn cho tuần mới..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400 tabular-nums">
                {reflectionNote.length}/800 ký tự
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReflectionModalOpen(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleSave();
                    setIsReflectionModalOpen(false);
                  }}
                  disabled={isSaving}
                  className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu & Đóng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
