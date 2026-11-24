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
    placeholder: string;
    icon: React.ComponentType<{ className?: string }>;
    headerBadgeCls: string;
    cellSurfaceCls: string;
  }> = [
    {
      key: 'morning',
      label: 'Sáng',
      timeHint: '06:00 – 11:59',
      placeholder: '• Học lời & cầu nguyện\n• Công việc / gặp gỡ\n• ...',
      icon: Sun,
      headerBadgeCls:
        'bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border-amber-200/70 dark:border-amber-800/60',
      cellSurfaceCls:
        'bg-gradient-to-b from-amber-50/70 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border-amber-200/70 dark:border-amber-900/40 focus-within:border-amber-400 focus-within:ring-amber-200/60',
    },
    {
      key: 'afternoon',
      label: 'Chiều',
      timeHint: '12:00 – 17:59',
      placeholder: '• Kết nối / Thăm\n• Đào tạo / Học tập\n• ...',
      icon: Sunset,
      headerBadgeCls:
        'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-200/70 dark:border-emerald-800/60',
      cellSurfaceCls:
        'bg-gradient-to-b from-emerald-50/60 via-white to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 border-emerald-200/70 dark:border-emerald-900/40 focus-within:border-emerald-400 focus-within:ring-emerald-200/60',
    },
    {
      key: 'evening',
      label: 'Tối',
      timeHint: '18:00 – 22:59',
      placeholder: '• Nhóm / Tổng kết\n• Chăm sóc cá nhân\n• ...',
      icon: Moon,
      headerBadgeCls:
        'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 border-indigo-200/70 dark:border-indigo-800/60',
      cellSurfaceCls:
        'bg-gradient-to-b from-indigo-50/60 via-white to-white dark:from-indigo-950/25 dark:via-slate-900 dark:to-slate-900 border-indigo-200/70 dark:border-indigo-900/40 focus-within:border-indigo-400 focus-within:ring-indigo-200/60',
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Serene Grace Banner & Week Controls */}
      <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-sky-50 via-indigo-50/70 to-amber-50/70 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 border border-sky-200/80 dark:border-indigo-900/60 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Lập Kế Hoạch LLV Cá Nhân
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300">
                  <Lock className="w-3 h-3" />
                  <span>Không gian riêng tư</span>
                </span>
                {hasUnsavedChanges && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-[10px] font-bold">
                    Chưa lưu thay đổi
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                Sắp xếp nhịp sống ân huệ từ Chủ Nhật đến Thứ Bảy · Sáng, Chiều, Tối ({filledSessionsCount}/21 buổi đã lên lịch).
              </p>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyFromPreviousWeek}
              className="h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700 text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép từ tuần trước</span>
            </button>

            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleResetDraft}
                className="h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hoàn tác</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu kế hoạch'}</span>
            </button>
          </div>
        </div>

        {/* Week Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-sky-200/70 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))}
              className="h-8 w-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              aria-label="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="h-8 px-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white tabular-nums shadow-2xs">
              <span>
                CN {formatDayMonthVN(selectedWeekStart)} → T7 {formatDateVN(selectedWeekEnd)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))}
              className="h-8 w-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
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
              className="h-8 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            />
          </div>

          <div className="inline-flex p-0.5 rounded-xl bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-0.5">
            {[
              { label: 'Tuần trước', active: isPrevWeek, target: addDays(currentWeekSunday, -7) },
              { label: 'Tuần này', active: isThisWeek, target: currentWeekSunday },
              { label: 'Tuần sau', active: isNextWeek, target: addDays(currentWeekSunday, 7) },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setSelectedWeekStart(item.target)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                  item.active
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop 7-Column Weekly Matrix (CN -> T7, Sáng / Chiều / Tối with 3-4 line graceful cells) */}
      <div className="hidden lg:block overflow-x-auto pb-1">
        <div className="min-w-[980px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* 7 Day Columns Header */}
          <div className="grid grid-cols-[110px_repeat(7,minmax(0,1fr))] bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
            <div className="p-3 flex items-center justify-center text-[11px] font-black uppercase tracking-wider text-slate-400">
              Buổi / Ngày
            </div>
            {WORK_WEEK_DAYS.map((day, idx) => {
              const dateStr = addDays(selectedWeekStart, idx);
              const isToday = dateStr === todayStr;
              const isSunday = day.key === 'sun';
              return (
                <div
                  key={day.key}
                  className={`p-2.5 text-center border-l border-slate-200/80 dark:border-slate-800 ${
                    isToday
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/50'
                      : isSunday
                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                      : ''
                  }`}
                >
                  <div
                    className={`text-xs font-black ${
                      isToday
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : isSunday
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {day.fullLabel}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums mt-0.5 flex items-center justify-center gap-1">
                    <span>{formatDayMonthVN(dateStr)}</span>
                    {isToday && (
                      <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[9px] font-black">
                        Nay
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3 Session Rows (Sáng, Chiều, Tối) */}
          {sessionConfigs.map((sess, rowIdx) => {
            const SessIcon = sess.icon;
            return (
              <div
                key={sess.key}
                className={`grid grid-cols-[110px_repeat(7,minmax(0,1fr))] ${
                  rowIdx > 0 ? 'border-t border-slate-200/80 dark:border-slate-800' : ''
                }`}
              >
                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-extrabold ${sess.headerBadgeCls}`}
                  >
                    <SessIcon className="w-3.5 h-3.5" />
                    <span>{sess.label}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                    {sess.timeHint}
                  </span>
                </div>

                {WORK_WEEK_DAYS.map((day, idx) => {
                  const dateStr = addDays(selectedWeekStart, idx);
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={`${day.key}-${sess.key}`}
                      className={`p-2 border-l border-slate-200/80 dark:border-slate-800 ${
                        isToday ? 'bg-indigo-50/25 dark:bg-indigo-950/15' : ''
                      }`}
                    >
                      <div
                        className={`rounded-2xl border p-2 transition ring-0 focus-within:ring-2 ${sess.cellSurfaceCls}`}
                      >
                        <textarea
                          rows={4}
                          value={sessionsDraft[day.key]?.[sess.key] || ''}
                          onChange={(e) => handleCellChange(day.key, sess.key, e.target.value)}
                          placeholder={sess.placeholder}
                          className="w-full bg-transparent text-xs font-medium text-slate-700 dark:text-slate-100 placeholder-slate-400/75 leading-relaxed resize-y focus:outline-none min-h-[84px]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile & Tablet Day Cards (CN -> T7) */}
      <div className="lg:hidden space-y-3">
        {WORK_WEEK_DAYS.map((day, idx) => {
          const dateStr = addDays(selectedWeekStart, idx);
          const isToday = dateStr === todayStr;
          const isSunday = day.key === 'sun';
          return (
            <div
              key={day.key}
              className={`rounded-2xl bg-white dark:bg-slate-900 border p-3.5 shadow-xs space-y-2.5 ${
                isToday
                  ? 'border-indigo-400 dark:border-indigo-700 ring-1 ring-indigo-300/60'
                  : 'border-slate-200/90 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                      isToday
                        ? 'bg-indigo-600 text-white'
                        : isSunday
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {day.fullLabel}
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatDateVN(dateStr)}
                  </span>
                </div>
                {isToday && (
                  <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                    Hôm nay
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {sessionConfigs.map((sess) => {
                  const SessIcon = sess.icon;
                  return (
                    <div
                      key={`${day.key}-mob-${sess.key}`}
                      className={`rounded-2xl border p-2.5 transition ring-0 focus-within:ring-2 ${sess.cellSurfaceCls}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-extrabold ${sess.headerBadgeCls}`}
                        >
                          <SessIcon className="w-3 h-3" />
                          <span>{sess.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {sess.timeHint}
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={sessionsDraft[day.key]?.[sess.key] || ''}
                        onChange={(e) => handleCellChange(day.key, sess.key, e.target.value)}
                        placeholder={sess.placeholder}
                        className="w-full bg-transparent text-xs font-medium text-slate-700 dark:text-slate-100 placeholder-slate-400/75 leading-relaxed resize-y focus:outline-none min-h-[80px]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Grace / Focus Reflection Note */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-50/70 via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-slate-800 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Lời cầu nguyện &amp; Trọng tâm tuần này</span>
          </label>
          <span className="text-[10px] text-slate-400">{reflectionNote.length}/800</span>
        </div>
        <textarea
          rows={2}
          maxLength={800}
          value={reflectionNote}
          onChange={(e) => {
            setReflectionNote(e.target.value);
            setHasUnsavedChanges(true);
          }}
          placeholder="Ghi chú câu Kinh Thánh khích lệ, mục tiêu ưu tiên hoặc lời tạ ơn cho tuần mới..."
          className="w-full p-3 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
    </div>
  );
};
