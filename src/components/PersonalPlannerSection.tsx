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
  const [showReflectionBox, setShowReflectionBox] = useState(false);

  useEffect(() => {
    if (existingPlanner) {
      setSessionsDraft(cloneWeekSessions(existingPlanner.sessions));
      setReflectionNote(existingPlanner.reflectionNote || '');
      if (existingPlanner.reflectionNote?.trim()) {
        setShowReflectionBox(true);
      }
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
      setShowReflectionBox(true);
    }
    setHasUnsavedChanges(true);
    onShowNotification('Đã sao chép kế hoạch từ tuần trước. Bấm "Lưu kế hoạch" để xác nhận!');
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
      timeHint: '06:00 – 11:59',
      icon: Sun,
      colHeaderCls:
        'bg-amber-50/75 dark:bg-amber-950/25 text-amber-950 dark:text-amber-100',
      colTintCls:
        'bg-amber-50/10 dark:bg-amber-950/5',
      iconCls: 'text-amber-600 dark:text-amber-400',
      focusRingCls:
        'focus-within:bg-amber-50/40 dark:focus-within:bg-amber-950/20 focus-within:ring-2 focus-within:ring-inset focus-within:ring-amber-500/60',
    },
    {
      key: 'afternoon',
      label: 'Chiều',
      timeHint: '12:00 – 17:59',
      icon: Sunset,
      colHeaderCls:
        'bg-sky-50/85 dark:bg-sky-950/30 text-sky-950 dark:text-sky-100',
      colTintCls:
        'bg-sky-50/15 dark:bg-sky-950/5',
      iconCls: 'text-sky-600 dark:text-sky-400',
      focusRingCls:
        'focus-within:bg-sky-50/45 dark:focus-within:bg-sky-950/25 focus-within:ring-2 focus-within:ring-inset focus-within:ring-sky-500/60',
    },
    {
      key: 'evening',
      label: 'Tối',
      timeHint: '18:00 – 22:59',
      icon: Moon,
      colHeaderCls:
        'bg-indigo-50/75 dark:bg-indigo-950/25 text-indigo-950 dark:text-indigo-100',
      colTintCls:
        'bg-indigo-50/10 dark:bg-indigo-950/5',
      iconCls: 'text-indigo-600 dark:text-indigo-400',
      focusRingCls:
        'focus-within:bg-indigo-50/40 dark:focus-within:bg-indigo-950/20 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500/60',
    },
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Compact Workspace Header & Week Bar */}
      <div className="p-3.5 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Kế hoạch LLV cá nhân
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Lock className="w-3 h-3 shrink-0" />
                  <span>Riêng tư</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                    {filledSessionsCount}/21 buổi
                  </span>
                  {hasUnsavedChanges ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        Chưa lưu thay đổi
                      </span>
                    </>
                  ) : existingPlanner ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="w-3 h-3" />
                        <span>Đã đồng bộ</span>
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyFromPreviousWeek}
              className="h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Chép tuần trước</span>
            </button>

            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleResetDraft}
                className="h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hoàn tác</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition whitespace-nowrap shrink-0 ${
                hasUnsavedChanges
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu kế hoạch'}</span>
            </button>
          </div>
        </div>

        {/* Compact Week Navigation Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))}
              className="h-8 w-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition"
              aria-label="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-flex items-center text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">
              CN {formatDayMonthVN(selectedWeekStart)} – T7 {formatDateVN(selectedWeekEnd)}
            </span>

            <button
              type="button"
              onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))}
              className="h-8 w-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition"
              aria-label="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={selectedWeekStart}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedWeekStart(getSundayOfWeek(e.target.value));
                }
              }}
              aria-label="Chọn tuần theo ngày"
              className="h-8 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-0.5">
            {[
              { label: 'Tuần trước', active: isPrevWeek, target: addDays(currentWeekSunday, -7) },
              { label: 'Tuần này', active: isThisWeek, target: currentWeekSunday },
              { label: 'Tuần sau', active: isNextWeek, target: addDays(currentWeekSunday, 7) },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setSelectedWeekStart(item.target)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition whitespace-nowrap shrink-0 ${
                  item.active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 7-Row x 3-Column Sheet Matrix (CN -> T7 rows, Sáng / Chiều / Tối columns) */}
      <div className="w-full">
        {/* Column Headers: Sáng | Chiều | Tối */}
        <div className="grid grid-cols-[48px_repeat(3,minmax(0,1fr))] sm:grid-cols-[84px_repeat(3,minmax(0,1fr))] border-b border-slate-300 dark:border-slate-700">
          <div className="px-1.5 py-2 sm:px-3 sm:py-2.5 bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Ngày
          </div>
          {sessionConfigs.map((sess) => {
            const SessIcon = sess.icon;
            return (
              <div
                key={sess.key}
                className={`px-2 py-2 sm:px-3 sm:py-2.5 border-l border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 ${sess.colHeaderCls}`}
              >
                <div className="inline-flex items-center gap-1.5">
                  <SessIcon className={`w-3.5 h-3.5 shrink-0 ${sess.iconCls}`} />
                  <span className="text-xs sm:text-sm font-bold tracking-tight">
                    {sess.label}
                  </span>
                </div>
                <span className="hidden md:inline text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {sess.timeHint}
                </span>
              </div>
            );
          })}
        </div>

        {/* 7 Day Rows (CN -> T7) */}
        <div className="divide-y divide-slate-300 dark:divide-slate-700">
          {WORK_WEEK_DAYS.map((day, idx) => {
            const dateStr = addDays(selectedWeekStart, idx);
            const isToday = dateStr === todayStr;
            const isSunday = day.key === 'sun';

            return (
              <div
                key={day.key}
                className={`grid grid-cols-[48px_repeat(3,minmax(0,1fr))] sm:grid-cols-[84px_repeat(3,minmax(0,1fr))] items-stretch transition-colors ${
                  isToday
                    ? 'bg-indigo-50/35 dark:bg-indigo-950/20'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                {/* Left Day Cell */}
                <div
                  className={`px-1 py-2 sm:px-2.5 sm:py-2 flex flex-col items-center justify-center text-center select-none ${
                    isToday
                      ? 'bg-indigo-100/70 dark:bg-indigo-950/50'
                      : isSunday
                      ? 'bg-amber-50/55 dark:bg-amber-950/15'
                      : 'bg-slate-50/75 dark:bg-slate-800/35'
                  }`}
                >
                  <span
                    className={`text-xs sm:text-sm font-extrabold tracking-tight ${
                      isToday
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : isSunday
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {day.shortLabel}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    {formatDayMonthVN(dateStr)}
                  </span>
                  {isToday && (
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-indigo-600 dark:text-indigo-300 mt-0.5">
                      Hôm nay
                    </span>
                  )}
                </div>

                {/* 3 Ruled Session Cells: Sáng | Chiều | Tối */}
                {sessionConfigs.map((sess) => {
                  const cellVal = sessionsDraft[day.key]?.[sess.key] || '';
                  const lineCount = Math.max(3, Math.min(7, (cellVal.match(/\n/g)?.length || 0) + 1));

                  return (
                    <div
                      key={`${day.key}-${sess.key}`}
                      className={`relative border-l border-slate-300 dark:border-slate-700 transition-colors ${
                        isToday ? '' : sess.colTintCls
                      } ${sess.focusRingCls}`}
                    >
                      {/* Subtle ruled dotted lines matching the reference sheet */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-1.5 bottom-1.5 flex flex-col"
                      >
                        {Array.from({ length: lineCount - 1 }).map((_, lineIdx) => (
                          <div
                            key={lineIdx}
                            className="h-[22px] shrink-0 border-b border-dotted border-slate-300/80 dark:border-slate-700/80"
                          />
                        ))}
                      </div>

                      <textarea
                        rows={lineCount}
                        value={cellVal}
                        onChange={(e) => handleCellChange(day.key, sess.key, e.target.value)}
                        aria-label={`${day.fullLabel} (${formatDayMonthVN(dateStr)}) - Buổi ${sess.label}`}
                        placeholder="Nhập việc..."
                        className="relative z-10 w-full h-full min-h-[78px] px-1.5 sm:px-3 py-1.5 bg-transparent text-[11px] sm:text-xs font-medium text-slate-800 dark:text-slate-100 leading-[22px] resize-none focus:outline-none placeholder:text-slate-400/0 focus:placeholder:text-slate-400/80 dark:focus:placeholder:text-slate-500/80"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact Collapsible Reflection Footer */}
      <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowReflectionBox((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Lời cầu nguyện &amp; Trọng tâm tuần này</span>
            {reflectionNote.trim() && !showReflectionBox && (
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-md">
                · {reflectionNote.trim()}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowReflectionBox((prev) => !prev)}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            {showReflectionBox ? 'Thu gọn' : 'Mở ghi chú'}
          </button>
        </div>

        {showReflectionBox && (
          <div className="mt-2 space-y-1">
            <textarea
              rows={2}
              maxLength={800}
              value={reflectionNote}
              onChange={(e) => {
                setReflectionNote(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Ghi chú câu Kinh Thánh khích lệ, mục tiêu ưu tiên hoặc lời tạ ơn cho tuần mới..."
              className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <div className="flex justify-end text-[10px] text-slate-400 tabular-nums">
              {reflectionNote.length}/800
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
