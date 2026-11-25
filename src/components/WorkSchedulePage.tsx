import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Save,
  Trash2,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Users,
  User as UserIcon,
  Search,
  Check,
  Lock,
  FileText,
  AlertTriangle,
  RotateCcw,
  Eye,
  X,
  FileDown,
} from 'lucide-react';
import {
  Area,
  Company,
  DayThreeSessions,
  DEFAULT_WS_ACTIVE_DAYS,
  Member,
  UserAccount,
  WeekDayKey,
  WORK_WEEK_DAYS,
  WorkScheduleRecord,
  createEmptyWeekSessionsMap,
} from '../types/edulms';
import {
  canViewMemberDetail,
  getMemberUnitCode,
  isAdminRole,
  isMemberInManagerCluster,
  isSupervisorRole,
  normalizeOrgCode,
} from '../utils/rbac';
import {
  exportWorkSchedulesByRbacExcel,
  WorkScheduleExportPeriod,
} from '../utils/workScheduleExporter';
import { db } from '../firebase';

interface WorkSchedulePageProps {
  currentUser: UserAccount | null;
  workSchedules: WorkScheduleRecord[];
  isLoading?: boolean;
  readError?: string | null;
  members: Member[];
  companies: Company[];
  areas: Area[];
  onSaveWorkSchedule: (schedule: WorkScheduleRecord) => Promise<void>;
  onDeleteWorkSchedule: (scheduleId: string) => Promise<void>;
  onOpenAuthModal: () => void;
  onShowNotification: (msg: string) => void;
  showWsSection?: boolean;
}

type ScheduleViewMode = 'MY_SCHEDULE' | 'TEAM_SCHEDULES';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDateStr(dateStr: string): Date {
  const parts = dateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date();
}

function getSundayOfWeek(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? parseLocalDateStr(dateInput) : new Date(dateInput);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0 = Chủ Nhật
  d.setDate(d.getDate() - day);
  return toLocalDateStr(d);
}

function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  const d = parseLocalDateStr(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toLocalDateStr(d);
}

function formatDayMonth(dateStr: string): string {
  const d = parseLocalDateStr(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function formatFullDateVN(dateStr: string): string {
  const d = parseLocalDateStr(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function getWeekDayDates(weekStart: string, todayStr: string) {
  const start = parseLocalDateStr(weekStart);
  return WORK_WEEK_DAYS.map((dayMeta, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    const dateStr = toLocalDateStr(d);
    return {
      ...dayMeta,
      dateStr,
      displayDate: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
      isToday: dateStr === todayStr,
    };
  });
}

function cloneSessionsMap(
  source?: Partial<Record<WeekDayKey, Partial<DayThreeSessions>>> | null
): Record<WeekDayKey, DayThreeSessions> {
  const base = createEmptyWeekSessionsMap();
  if (!source) return base;
  WORK_WEEK_DAYS.forEach(({ key }) => {
    const src = source[key];
    if (src) {
      base[key] = {
        morning: typeof src.morning === 'string' ? src.morning : '',
        afternoon: typeof src.afternoon === 'string' ? src.afternoon : '',
        evening: typeof src.evening === 'string' ? src.evening : '',
      };
    }
  });
  return base;
}

function resolveWsActiveDays(
  savedActiveDays?: WeekDayKey[],
  wsMap?: Partial<Record<WeekDayKey, Partial<DayThreeSessions>>>
): WeekDayKey[] {
  const activeSet = new Set<WeekDayKey>(
    Array.isArray(savedActiveDays) && savedActiveDays.length > 0
      ? savedActiveDays
      : DEFAULT_WS_ACTIVE_DAYS
  );
  if (wsMap) {
    WORK_WEEK_DAYS.forEach(({ key }) => {
      const entry = wsMap[key];
      if (
        entry &&
        ((entry.morning || '').trim() ||
          (entry.afternoon || '').trim() ||
          (entry.evening || '').trim())
      ) {
        activeSet.add(key);
      }
    });
  }
  return WORK_WEEK_DAYS.map((d) => d.key).filter((k) => activeSet.has(k));
}

function countFilledSessions(sessions?: Record<WeekDayKey, DayThreeSessions>): number {
  if (!sessions) return 0;
  return WORK_WEEK_DAYS.reduce((sum, { key }) => {
    const d = sessions[key];
    if (!d) return sum;
    return (
      sum +
      (d.morning.trim() ? 1 : 0) +
      (d.afternoon.trim() ? 1 : 0) +
      (d.evening.trim() ? 1 : 0)
    );
  }, 0);
}

function countFilledWs(
  ws?: Record<WeekDayKey, DayThreeSessions>,
  activeDays?: WeekDayKey[]
): number {
  if (!ws) return 0;
  const days = activeDays && activeDays.length > 0 ? activeDays : WORK_WEEK_DAYS.map((d) => d.key);
  return days.reduce((sum, key) => {
    const d = ws[key];
    if (!d) return sum;
    return (
      sum +
      (d.morning.trim() ? 1 : 0) +
      (d.afternoon.trim() ? 1 : 0) +
      (d.evening.trim() ? 1 : 0)
    );
  }, 0);
}

function sanitizeNumericCode(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, 12);
}

const SESSION_ROWS: Array<{
  key: keyof DayThreeSessions;
  label: string;
  timeHint: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
}> = [
  {
    key: 'morning',
    label: 'Sáng',
    timeHint: '06:00 – 11:59',
    icon: Sun,
    badgeColor: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-200/70 dark:border-amber-800/50',
  },
  {
    key: 'afternoon',
    label: 'Chiều',
    timeHint: '12:00 – 17:59',
    icon: Sunset,
    badgeColor: 'text-orange-500 bg-orange-50 dark:bg-orange-950/50 border-orange-200/70 dark:border-orange-800/50',
  },
  {
    key: 'evening',
    label: 'Tối',
    timeHint: '18:00 – 22:59',
    icon: Moon,
    badgeColor: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200/70 dark:border-indigo-800/50',
  },
];

export const WorkSchedulePage: React.FC<WorkSchedulePageProps> = ({
  currentUser,
  workSchedules,
  isLoading = false,
  readError = null,
  members,
  companies,
  areas,
  onSaveWorkSchedule,
  onDeleteWorkSchedule,
  onOpenAuthModal,
  onShowNotification,
  showWsSection = true,
}) => {
  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const currentWeekStart = useMemo(() => getSundayOfWeek(new Date()), []);

  const canViewTeamSchedules = useMemo(
    () => (currentUser ? isSupervisorRole(currentUser.role) : false),
    [currentUser]
  );

  const [viewMode, setViewMode] = useState<ScheduleViewMode>('MY_SCHEDULE');
  const [mobileSectionTab, setMobileSectionTab] = useState<'SESSIONS' | 'WS'>('SESSIONS');
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(currentWeekStart);

  // Tự đưa về tab Lịch 3 buổi trên mobile nếu Admin tắt mục WS
  useEffect(() => {
    if (!showWsSection && mobileSectionTab === 'WS') {
      setMobileSectionTab('SESSIONS');
    }
  }, [showWsSection, mobileSectionTab]);

  // Draft states for My Schedule
  const [draftSessions, setDraftSessions] = useState<Record<WeekDayKey, DayThreeSessions>>(() =>
    createEmptyWeekSessionsMap()
  );
  const [draftWsActiveDays, setDraftWsActiveDays] = useState<WeekDayKey[]>([
    ...DEFAULT_WS_ACTIVE_DAYS,
  ]);
  const [draftWs, setDraftWs] = useState<Record<WeekDayKey, DayThreeSessions>>(() =>
    createEmptyWeekSessionsMap()
  );
  const [draftNoteLegend, setDraftNoteLegend] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLegendBox, setShowLegendBox] = useState<boolean>(false);
  const lastSyncedRef = React.useRef<{ week: string; updatedAt: string }>({
    week: '',
    updatedAt: '',
  });

  // In-app dialogs (never window.confirm / window.alert)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
  const [pendingWeekSwitch, setPendingWeekSwitch] = useState<string | null>(null);

  // Team viewer states
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [teamFilterCompany, setTeamFilterCompany] = useState<string>('ALL');
  const [teamFilterArea, setTeamFilterArea] = useState<string>('ALL');
  const [teamStatusFilter, setTeamStatusFilter] = useState<'ALL' | 'FILLED' | 'EMPTY'>('ALL');
  const [expandedMemberKey, setExpandedMemberKey] = useState<string | null>(null);
  const [exportPeriod, setExportPeriod] = useState<WorkScheduleExportPeriod>('WEEK');
  const datePickerRef = React.useRef<HTMLInputElement>(null);

  const weekDays = useMemo(
    () => getWeekDayDates(selectedWeekStart, todayStr),
    [selectedWeekStart, todayStr]
  );
  const weekEndStr = weekDays[6].dateStr;
  const isCurrentWeek = selectedWeekStart === currentWeekStart;
  const selectedMonthStr = selectedWeekStart.slice(0, 7);
  const isSelectedMonthCurrent = selectedMonthStr === todayStr.slice(0, 7);
  const monthOptionLabel = isSelectedMonthCurrent
    ? 'Tháng này'
    : `Tháng ${selectedMonthStr.slice(5, 7)}/${selectedMonthStr.slice(0, 4)}`;

  const existingMyRecord = useMemo(() => {
    if (!currentUser) return null;
    return (
      workSchedules.find(
        (w) => w.ownerUid === currentUser.id && w.weekStart === selectedWeekStart
      ) || null
    );
  }, [workSchedules, currentUser, selectedWeekStart]);

  // Sync draft when week changes or server record updates (without wiping unsaved edits)
  useEffect(() => {
    const serverUpdatedAt = existingMyRecord?.updatedAt || '';
    const weekChanged = lastSyncedRef.current.week !== selectedWeekStart;
    const recordChanged = lastSyncedRef.current.updatedAt !== serverUpdatedAt;

    if (!weekChanged && (!recordChanged || isDirty)) {
      return;
    }

    lastSyncedRef.current = { week: selectedWeekStart, updatedAt: serverUpdatedAt };
    setSaveError(null);

    if (existingMyRecord) {
      setDraftSessions(cloneSessionsMap(existingMyRecord.sessions));
      setDraftWs(cloneSessionsMap(existingMyRecord.ws));
      setDraftWsActiveDays(
        resolveWsActiveDays(existingMyRecord.wsActiveDays, existingMyRecord.ws)
      );
      const legend = existingMyRecord.noteLegend || '';
      setDraftNoteLegend(legend);
      setShowLegendBox(legend.trim().length > 0);
    } else {
      setDraftSessions(createEmptyWeekSessionsMap());
      setDraftWs(createEmptyWeekSessionsMap());
      setDraftWsActiveDays([...DEFAULT_WS_ACTIVE_DAYS]);
      setDraftNoteLegend('');
      setShowLegendBox(false);
    }
    setIsDirty(false);
  }, [existingMyRecord, selectedWeekStart, isDirty]);

  // Ensure default viewMode resets if user logs out or switches to non-supervisor role
  useEffect(() => {
    if (!canViewTeamSchedules && viewMode === 'TEAM_SCHEDULES') {
      setViewMode('MY_SCHEDULE');
    }
  }, [canViewTeamSchedules, viewMode]);

  const myFilledSessionsCount = useMemo(() => countFilledSessions(draftSessions), [draftSessions]);
  const myFilledWsCount = useMemo(
    () => countFilledWs(draftWs, draftWsActiveDays),
    [draftWs, draftWsActiveDays]
  );

  const handleRequestWeekChange = (targetWeekStart: string) => {
    if (targetWeekStart === selectedWeekStart) return;
    if (viewMode === 'MY_SCHEDULE' && isDirty) {
      setPendingWeekSwitch(targetWeekStart);
      return;
    }
    setSelectedWeekStart(targetWeekStart);
  };

  const handleSessionChange = (
    dayKey: WeekDayKey,
    sessionKey: keyof DayThreeSessions,
    rawVal: string
  ) => {
    const cleanVal = sanitizeNumericCode(rawVal);
    setDraftSessions((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [sessionKey]: cleanVal,
      },
    }));
    setIsDirty(true);
  };

  const handleWsValueChange = (
    dayKey: WeekDayKey,
    sessionKey: keyof DayThreeSessions,
    rawVal: string
  ) => {
    const cleanVal = sanitizeNumericCode(rawVal);
    setDraftWs((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [sessionKey]: cleanVal,
      },
    }));
    setIsDirty(true);
  };

  const handleToggleWsDay = (dayKey: WeekDayKey) => {
    setDraftWsActiveDays((prev) => {
      const exists = prev.includes(dayKey);
      const nextSet = new Set<WeekDayKey>(prev);
      if (exists) {
        nextSet.delete(dayKey);
      } else {
        nextSet.add(dayKey);
      }
      return WORK_WEEK_DAYS.map((d) => d.key).filter((k) => nextSet.has(k));
    });
    setIsDirty(true);
  };

  const handleCopyPreviousWeek = () => {
    if (!currentUser) return;
    const prevWeekStart = shiftWeekStart(selectedWeekStart, -1);
    const prevRecord = workSchedules.find(
      (w) => w.ownerUid === currentUser.id && w.weekStart === prevWeekStart
    );
    if (!prevRecord) {
      onShowNotification('Tuần trước chưa có dữ liệu lịch làm việc để sao chép.');
      return;
    }
    setDraftSessions(cloneSessionsMap(prevRecord.sessions));
    setDraftWs(cloneSessionsMap(prevRecord.ws));
    setDraftWsActiveDays(resolveWsActiveDays(prevRecord.wsActiveDays, prevRecord.ws));
    if (prevRecord.noteLegend) {
      setDraftNoteLegend(prevRecord.noteLegend);
      setShowLegendBox(true);
    }
    setIsDirty(true);
    onShowNotification('Đã nạp dữ liệu từ tuần trước. Nhấn "Lưu lịch" để lưu lại!');
  };

  const handleSave = async (): Promise<boolean> => {
    if (!currentUser) {
      onOpenAuthModal();
      return false;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const now = new Date().toISOString();
      const compactWeekKey = selectedWeekStart.replace(/-/g, '');
      const scheduleId = `${currentUser.id}_${compactWeekKey}`;
      const ownerUnitCode = (currentUser.unitCode || currentUser.departmentCode || '')
        .trim()
        .slice(0, 50);

      const record: WorkScheduleRecord = {
        id: scheduleId,
        ownerUid: currentUser.id,
        ownerMemberId: currentUser.memberId || `m-${currentUser.id}`,
        ownerName: currentUser.fullName.trim().slice(0, 100) || 'Thành viên',
        companyCode: (currentUser.companyCode || '').trim().slice(0, 30),
        areaCode: (currentUser.areaCode || '').trim().slice(0, 30),
        ...(ownerUnitCode ? { ownerUnitCode } : {}),
        weekStart: selectedWeekStart,
        weekEnd: weekEndStr,
        sessions: cloneSessionsMap(draftSessions),
        wsActiveDays: [...draftWsActiveDays],
        ws: cloneSessionsMap(draftWs),
        ...(draftNoteLegend.trim()
          ? { noteLegend: draftNoteLegend.trim().slice(0, 600) }
          : {}),
        createdAt: existingMyRecord?.createdAt || now,
        updatedAt: now,
      };

      await onSaveWorkSchedule(record);
      lastSyncedRef.current = { week: selectedWeekStart, updatedAt: now };
      setIsDirty(false);
      onShowNotification(
        `Đã lưu lịch làm việc tuần ${formatDayMonth(selectedWeekStart)} – ${formatDayMonth(weekEndStr)}!`
      );
      return true;
    } catch (err: any) {
      const rawMsg = err?.message || String(err || '');
      const projectId = db.app.options.projectId || 'unknown';
      const dbId = (db as any)?._databaseId?.database || '(default)';
      const isPermError =
        rawMsg.includes('Missing or insufficient permissions') ||
        rawMsg.includes('permission-denied');
      const friendlyMsg = isPermError
        ? `Thiếu quyền ghi trên Project "${projectId}" · Database "${dbId}" (tài liệu: ${currentUser.id}_${selectedWeekStart.replace(/-/g, '')}). ${
            readError
              ? 'Cả đọc (list) và ghi (write) đều bị từ chối → Database này chưa nhận được rule work_schedules.'
              : 'Đọc thành công nhưng ghi bị từ chối → Rule đã có nhưng payload/điều kiện ghi chưa khớp.'
          }`
        : `Không lưu được lịch làm việc: ${rawMsg}`;
      setSaveError(friendlyMsg);
      onShowNotification(
        isPermError
          ? 'Lỗi phân quyền Firestore khi lưu lịch làm việc!'
          : 'Không lưu được lịch làm việc!'
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteWeek = async () => {
    if (!currentUser) return;
    setIsConfirmDeleteOpen(false);
    setSaveError(null);
    if (existingMyRecord) {
      setIsSaving(true);
      try {
        await onDeleteWorkSchedule(existingMyRecord.id);
        onShowNotification(
          `Đã xóa lịch tuần ${formatDayMonth(selectedWeekStart)} – ${formatDayMonth(weekEndStr)}.`
        );
      } catch (err: any) {
        const rawMsg = err?.message || String(err || '');
        setSaveError(`Không xóa được lịch: ${rawMsg}`);
        onShowNotification('Không xóa được lịch làm việc!');
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }
    lastSyncedRef.current = { week: selectedWeekStart, updatedAt: '' };
    setDraftSessions(createEmptyWeekSessionsMap());
    setDraftWs(createEmptyWeekSessionsMap());
    setDraftWsActiveDays([...DEFAULT_WS_ACTIVE_DAYS]);
    setDraftNoteLegend('');
    setShowLegendBox(false);
    setIsDirty(false);
  };

  const handleExportExcel = (scopeMode: 'SELF' | 'TEAM', specificOwnerKey?: string) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    const res = exportWorkSchedulesByRbacExcel({
      viewer: currentUser,
      workSchedules,
      members,
      period: exportPeriod,
      selectedWeekStart,
      targetMonth: selectedMonthStr,
      scopeMode,
      filterCompanyCode: scopeMode === 'TEAM' ? teamFilterCompany : undefined,
      filterAreaCode: scopeMode === 'TEAM' ? teamFilterArea : undefined,
      filterOwnerKey: specificOwnerKey || 'ALL',
      includeWs: showWsSection,
    });
    if (res.recordsCount === 0) {
      onShowNotification(
        `Đã tạo ${res.fileName} (chưa có lịch đã lưu trong kỳ chọn — nếu vừa nhập hãy bấm "Lưu lịch" trước).`
      );
    } else {
      onShowNotification(
        `Đã xuất ${res.fileName} (${res.recordsCount} tuần · ${res.peopleCount} nhân sự).`
      );
    }
  };

  // ---------- Team Schedule Roster (RBAC Scoped) ----------
  interface ScopedMemberRow {
    rowKey: string;
    fullName: string;
    companyCode: string;
    areaCode: string;
    unitCode: string;
    schedule: WorkScheduleRecord | null;
    filledSessions: number;
    filledWs: number;
    isSelf: boolean;
  }

  const teamRoster = useMemo<ScopedMemberRow[]>(() => {
    if (!currentUser || !canViewTeamSchedules) return [];

    const weekRecords = workSchedules.filter((w) => w.weekStart === selectedWeekStart);
    const byOwnerMemberId = new Map<string, WorkScheduleRecord>();
    const byOwnerUid = new Map<string, WorkScheduleRecord>();
    weekRecords.forEach((rec) => {
      if (rec.ownerMemberId) byOwnerMemberId.set(rec.ownerMemberId, rec);
      byOwnerUid.set(rec.ownerUid, rec);
    });

    const inScopeMembers = members.filter((m) => {
      if (!m.active) return false;
      if (isAdminRole(currentUser.role)) return true;
      if (currentUser.role === 'MANAGER') {
        return isMemberInManagerCluster(currentUser, m) || canViewMemberDetail(currentUser, m);
      }
      return canViewMemberDetail(currentUser, m);
    });

    const matchedScheduleIds = new Set<string>();
    const rows: ScopedMemberRow[] = inScopeMembers.map((m) => {
      const uidFromId = m.id.startsWith('m-') ? m.id.slice(2) : '';
      const schedule =
        byOwnerMemberId.get(m.id) || (uidFromId ? byOwnerUid.get(uidFromId) : undefined) || null;
      if (schedule) matchedScheduleIds.add(schedule.id);

      const filledSessions = schedule ? countFilledSessions(schedule.sessions) : 0;
      const filledWs = schedule ? countFilledWs(schedule.ws, schedule.wsActiveDays) : 0;
      const isSelf =
        m.id === (currentUser.memberId || `m-${currentUser.id}`) || m.id === currentUser.id;

      return {
        rowKey: m.id,
        fullName: m.fullName,
        companyCode: m.companyCode,
        areaCode: m.areaCode,
        unitCode: getMemberUnitCode(m),
        schedule,
        filledSessions,
        filledWs,
        isSelf,
      };
    });

    // Include any visible workSchedule records whose owner doesn't have a matching Member record
    weekRecords.forEach((rec) => {
      if (matchedScheduleIds.has(rec.id)) return;
      rows.push({
        rowKey: `uid-${rec.ownerUid}`,
        fullName: rec.ownerName,
        companyCode: rec.companyCode,
        areaCode: rec.areaCode,
        unitCode: rec.ownerUnitCode || '',
        schedule: rec,
        filledSessions: countFilledSessions(rec.sessions),
        filledWs: countFilledWs(rec.ws, rec.wsActiveDays),
        isSelf: rec.ownerUid === currentUser.id,
      });
    });

    return rows.sort((a, b) => {
      // Filled schedules first, then self, then alphabetical
      const aHas = a.filledSessions + (showWsSection ? a.filledWs : 0) > 0 ? 1 : 0;
      const bHas = b.filledSessions + (showWsSection ? b.filledWs : 0) > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
  }, [currentUser, canViewTeamSchedules, members, workSchedules, selectedWeekStart, showWsSection]);

  const availableTeamCompanies = useMemo(() => {
    const codes = Array.from(new Set(teamRoster.map((r) => r.companyCode).filter(Boolean))).sort();
    return codes.map((code) => ({
      code,
      name: companies.find((c) => normalizeOrgCode(c.code) === normalizeOrgCode(code))?.name || code,
    }));
  }, [teamRoster, companies]);

  const availableTeamAreas = useMemo(() => {
    const filtered =
      teamFilterCompany === 'ALL'
        ? teamRoster
        : teamRoster.filter((r) => normalizeOrgCode(r.companyCode) === normalizeOrgCode(teamFilterCompany));
    const codes = Array.from(new Set(filtered.map((r) => r.areaCode).filter(Boolean))).sort();
    return codes.map((code) => ({
      code,
      name: areas.find((a) => normalizeOrgCode(a.code) === normalizeOrgCode(code))?.name || code,
    }));
  }, [teamRoster, teamFilterCompany, areas]);

  const filteredTeamRoster = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return teamRoster.filter((row) => {
      if (
        teamFilterCompany !== 'ALL' &&
        normalizeOrgCode(row.companyCode) !== normalizeOrgCode(teamFilterCompany)
      ) {
        return false;
      }
      if (
        teamFilterArea !== 'ALL' &&
        normalizeOrgCode(row.areaCode) !== normalizeOrgCode(teamFilterArea)
      ) {
        return false;
      }
      const hasData = row.filledSessions + (showWsSection ? row.filledWs : 0) > 0;
      if (teamStatusFilter === 'FILLED' && !hasData) return false;
      if (teamStatusFilter === 'EMPTY' && hasData) return false;
      if (q) {
        const hay = `${row.fullName} ${row.companyCode} ${row.areaCode} ${row.unitCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [teamRoster, teamFilterCompany, teamFilterArea, teamStatusFilter, teamSearch, showWsSection]);

  const teamStats = useMemo(() => {
    const total = teamRoster.length;
    const updatedCount = teamRoster.filter(
      (r) => r.filledSessions + (showWsSection ? r.filledWs : 0) > 0
    ).length;
    const totalSessions = teamRoster.reduce((acc, r) => acc + r.filledSessions, 0);
    const totalWs = teamRoster.reduce((acc, r) => acc + r.filledWs, 0);
    return { total, updatedCount, totalSessions, totalWs };
  }, [teamRoster, showWsSection]);

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md mx-auto text-center shadow-sm border border-slate-100 dark:border-slate-800 my-10">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
          Vui lòng đăng nhập
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          {showWsSection
            ? 'Đăng nhập tài khoản để nhập Lịch làm việc tuần (3 buổi & WS) của bạn.'
            : 'Đăng nhập tài khoản để nhập Lịch làm việc tuần (3 buổi) của bạn.'}
        </p>
        <button
          type="button"
          onClick={onOpenAuthModal}
          className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          Đăng nhập / Đăng ký ngay
        </button>
      </div>
    );
  }

  const updatedTimeLabel = existingMyRecord?.updatedAt
    ? `Cập nhật: ${new Date(existingMyRecord.updatedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })}`
    : 'Chưa lưu tuần này';

  return (
    <div className="space-y-2.5 sm:space-y-3.5 pb-16 md:pb-5">
      {/* Compact Header & Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2.5 sm:p-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Lịch làm việc tuần
                </h1>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500">
                  · CN → T7
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {showWsSection
                  ? 'Nhập 1 số đại diện mỗi buổi · Tách riêng 3 buổi và WS'
                  : 'Nhập 1 số đại diện mỗi buổi · Sáng / Chiều / Tối'}
              </p>
            </div>
          </div>

          {canViewTeamSchedules && (
            <div className="grid grid-cols-2 sm:inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('MY_SCHEDULE')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                  viewMode === 'MY_SCHEDULE'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Lịch của tôi</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TEAM_SCHEDULES')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                  viewMode === 'TEAM_SCHEDULES'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Lịch Thành viên</span>
                <span className="text-[10px] sm:text-[11px] font-extrabold text-blue-600 dark:text-blue-300 tabular-nums">
                  {teamStats.updatedCount}/{teamStats.total}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Week Selector + Secondary Utilities */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          {/* Free Week Picker */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-0.5">
              <button
                type="button"
                onClick={() => handleRequestWeekChange(shiftWeekStart(selectedWeekStart, -1))}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Tuần trước"
                aria-label="Tuần trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                onClick={() => datePickerRef.current?.showPicker?.()}
                className="relative px-2.5 py-1 flex items-center gap-1.5 text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 rounded-lg hover:bg-white dark:hover:bg-slate-700/80 transition cursor-pointer"
                title="Bấm để chọn ngày / tuần bất kỳ"
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="tabular-nums whitespace-nowrap">
                  {formatDayMonth(selectedWeekStart)} – {formatFullDateVN(weekEndStr)}
                </span>
                {isCurrentWeek && (
                  <span className="hidden sm:inline text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    · Tuần này
                  </span>
                )}
                <input
                  ref={datePickerRef}
                  type="date"
                  value={selectedWeekStart}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleRequestWeekChange(getSundayOfWeek(e.target.value));
                    }
                  }}
                  aria-label="Chọn tuần bất kỳ"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => handleRequestWeekChange(shiftWeekStart(selectedWeekStart, 1))}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Tuần sau"
                aria-label="Tuần sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => handleRequestWeekChange(currentWeekStart)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tuần này</span>
              </button>
            )}

            {viewMode === 'MY_SCHEDULE' && isDirty && (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 px-1.5">
                · Chưa lưu
              </span>
            )}
          </div>

          {/* Action Toolbar: Copy, Clear & Export Excel */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {viewMode === 'MY_SCHEDULE' && (
              <>
                <button
                  type="button"
                  onClick={handleCopyPreviousWeek}
                  disabled={isSaving}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Chép tuần trước</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  disabled={
                    isSaving ||
                    (!existingMyRecord &&
                      myFilledSessionsCount === 0 &&
                      myFilledWsCount === 0 &&
                      !draftNoteLegend.trim())
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/70 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa tuần</span>
                </button>
              </>
            )}

            {/* Quick Excel Export (Tuần đang chọn / Tháng / Tất cả) */}
            <div className="inline-flex items-center rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 p-0.5">
              <select
                value={exportPeriod}
                onChange={(e) => setExportPeriod(e.target.value as WorkScheduleExportPeriod)}
                aria-label="Kỳ xuất báo cáo lịch làm việc"
                className="bg-transparent pl-2 pr-1 py-1 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 outline-none cursor-pointer"
              >
                <option value="WEEK" className="bg-white dark:bg-slate-900">
                  Tuần chọn
                </option>
                <option value="MONTH" className="bg-white dark:bg-slate-900">
                  {monthOptionLabel}
                </option>
                <option value="ALL" className="bg-white dark:bg-slate-900">
                  Tất cả tuần
                </option>
              </select>
              <button
                type="button"
                onClick={() =>
                  handleExportExcel(viewMode === 'TEAM_SCHEDULES' ? 'TEAM' : 'SELF')
                }
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer"
                title={
                  viewMode === 'TEAM_SCHEDULES'
                    ? 'Xuất Excel LLV theo phạm vi quản lý'
                    : 'Xuất Excel LLV cá nhân của bạn'
                }
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{viewMode === 'TEAM_SCHEDULES' ? 'Xuất Excel TV' : 'Xuất LLV'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================== VIEW 1: MY SCHEDULE ================== */}
      {viewMode === 'MY_SCHEDULE' && (
        <div className="space-y-2.5 sm:space-y-3.5">
          {saveError && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 p-3 flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold">Không thể lưu lịch làm việc</div>
                  <p className="mt-0.5">{saveError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer shrink-0"
                aria-label="Đóng thông báo lỗi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile Tab Switcher: Tách 3 Buổi | WS Tuần trên màn hình điện thoại để vừa 1 màn hình */}
          {showWsSection && (
            <div className="md:hidden grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMobileSectionTab('SESSIONS')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileSectionTab === 'SESSIONS'
                    ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>1. 3 Buổi</span>
                <span className="text-[11px] font-black tabular-nums text-sky-600 dark:text-sky-400">
                  {myFilledSessionsCount}/21
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMobileSectionTab('WS')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileSectionTab === 'WS'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>2. WS Tuần</span>
                <span className="text-[11px] font-black tabular-nums text-indigo-600 dark:text-indigo-400">
                  {myFilledWsCount}
                </span>
              </button>
            </div>
          )}

          {/* KHỐI 1: LỊCH HOẠT ĐỘNG 3 BUỔI (CN -> T7) */}
          <section
            className={`${
              !showWsSection || mobileSectionTab === 'SESSIONS' ? 'block' : 'hidden md:block'
            } bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2.5 sm:p-4 shadow-2xs`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 sm:mb-3">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-extrabold text-slate-900 dark:text-white flex flex-wrap items-baseline gap-x-1.5">
                  <span>1. Lịch 3 buổi</span>
                  <span className="text-[11px] sm:text-xs font-bold text-sky-700 dark:text-sky-300 tabular-nums">
                    · {myFilledSessionsCount}/21
                  </span>
                </h2>
                <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Nhập trực tiếp 1 số đại diện vào ô tương ứng (để trống nếu chưa có lịch).
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                  {updatedTimeLabel}
                </span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-60 ${
                    isDirty
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Lưu...' : isDirty ? 'Lưu thay đổi' : 'Lưu lịch'}</span>
                </button>
              </div>
            </div>

            {/* Desktop Matrix (md+) */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4 text-left text-xs font-extrabold text-slate-600 dark:text-slate-300 w-40">
                      Khung giờ
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.key}
                        className={`py-2.5 px-2 text-center border-l border-slate-200/70 dark:border-slate-700/70 ${
                          day.isToday
                            ? 'bg-sky-50/90 dark:bg-sky-950/50'
                            : day.key === 'sun'
                            ? 'bg-amber-50/50 dark:bg-amber-950/20'
                            : ''
                        }`}
                      >
                        <div
                          className={`text-xs font-extrabold ${
                            day.isToday
                              ? 'text-sky-700 dark:text-sky-300'
                              : day.key === 'sun'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {day.fullLabel}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                          <span>{day.displayDate}</span>
                          {day.isToday && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-600 text-white text-[9px] font-bold">
                              Nay
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {SESSION_ROWS.map((sessionRow) => {
                    const Icon = sessionRow.icon;
                    return (
                      <tr
                        key={sessionRow.key}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-left bg-slate-50/40 dark:bg-slate-800/30">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${sessionRow.badgeColor}`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                                {sessionRow.label}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                {sessionRow.timeHint}
                              </div>
                            </div>
                          </div>
                        </td>

                        {weekDays.map((day) => {
                          const val = draftSessions[day.key]?.[sessionRow.key] ?? '';
                          return (
                            <td
                              key={`${day.key}-${sessionRow.key}`}
                              className={`p-2 border-l border-slate-200/70 dark:border-slate-800 ${
                                day.isToday ? 'bg-sky-50/40 dark:bg-sky-950/20' : ''
                              }`}
                            >
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={12}
                                value={val}
                                placeholder="—"
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) =>
                                  handleSessionChange(day.key, sessionRow.key, e.target.value)
                                }
                                aria-label={`${sessionRow.label} ${day.fullLabel} (${day.displayDate})`}
                                className={`w-full h-10 text-center rounded-xl border text-sm font-extrabold tracking-wide outline-none transition ${
                                  val
                                    ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-slate-900 dark:text-white'
                                    : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600'
                                } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact Matrix (7 rows x 3 cols, fits 1 screen without scrolling) */}
            <div className="md:hidden rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
              <div className="grid grid-cols-[64px_1fr_1fr_1fr] gap-1.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 text-center">
                <div className="text-left pl-0.5">Ngày</div>
                {SESSION_ROWS.map((sr) => (
                  <div key={sr.key}>{sr.label}</div>
                ))}
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {weekDays.map((day) => {
                  const dSessions = draftSessions[day.key];
                  return (
                    <div
                      key={day.key}
                      className={`grid grid-cols-[64px_1fr_1fr_1fr] gap-1.5 px-2 py-1 items-center ${
                        day.isToday
                          ? 'bg-sky-50/80 dark:bg-sky-950/35'
                          : day.key === 'sun'
                          ? 'bg-amber-50/40 dark:bg-amber-950/15'
                          : ''
                      }`}
                    >
                      <div className="leading-tight min-w-0">
                        <div
                          className={`text-[11px] font-extrabold truncate ${
                            day.isToday
                              ? 'text-sky-700 dark:text-sky-300'
                              : day.key === 'sun'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {day.shortLabel}
                          {day.isToday ? ' · Nay' : ''}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                          {day.displayDate}
                        </div>
                      </div>

                      {SESSION_ROWS.map((sessionRow) => {
                        const val = dSessions[sessionRow.key] ?? '';
                        return (
                          <input
                            key={sessionRow.key}
                            type="text"
                            inputMode="numeric"
                            maxLength={12}
                            value={val}
                            placeholder="—"
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              handleSessionChange(day.key, sessionRow.key, e.target.value)
                            }
                            aria-label={`${sessionRow.label} ${day.fullLabel}`}
                            className={`w-full h-9 text-center rounded-lg border text-xs font-extrabold outline-none transition tabular-nums ${
                              val
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700 text-slate-900 dark:text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600'
                            } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* KHỐI 2: LỊCH WS TUẦN (TÁCH RIÊNG + THANH TÍCH CHỌN NGÀY) */}
          {showWsSection && (
            <section
              className={`${
                mobileSectionTab === 'WS' ? 'block' : 'hidden md:block'
              } bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/70 p-2.5 sm:p-4 shadow-2xs`}
            >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-extrabold text-slate-900 dark:text-white flex flex-wrap items-baseline gap-x-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0" />
                    <span>2. Lịch WS Tuần</span>
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                    · {myFilledWsCount} buổi
                  </span>
                </h2>
                <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Mặc định T3 &amp; T7 · Bật thêm ngày WS khác khi có lịch đặc biệt.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                  {updatedTimeLabel}
                </span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-60 ${
                    isDirty
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Lưu...' : isDirty ? 'Lưu thay đổi' : 'Lưu lịch'}</span>
                </button>
              </div>
            </div>

            {/* Thanh tích chọn ngày WS (1 hàng 7 cột gọn trên mobile) */}
            <div className="mb-2.5 pb-2.5 border-b border-indigo-100/80 dark:border-indigo-900/50 grid grid-cols-7 sm:flex sm:flex-wrap gap-1 sm:gap-1.5">
              {weekDays.map((day) => {
                const isActive = draftWsActiveDays.includes(day.key);
                const hasWsData =
                  (draftWs[day.key]?.morning.trim() || '') !== '' ||
                  (draftWs[day.key]?.afternoon.trim() || '') !== '' ||
                  (draftWs[day.key]?.evening.trim() || '') !== '';
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => handleToggleWsDay(day.key)}
                    className={`py-1.5 sm:px-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold border flex items-center justify-center gap-0.5 transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                    title={`Bật/tắt WS ${day.fullLabel} (${day.displayDate})`}
                  >
                    {isActive && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 hidden sm:inline" />}
                    <span>{day.shortLabel}</span>
                    {!isActive && hasWsData && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400"
                        title="Có dữ liệu WS đang ẩn"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {draftWsActiveDays.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa chọn ngày nào cho lịch WS tuần này. Bấm chọn ngày phía trên (ví dụ <strong>T3</strong> hoặc <strong>T7</strong>).
              </div>
            ) : (
              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 overflow-hidden">
                <div className="grid grid-cols-[64px_1fr_1fr_1fr] sm:grid-cols-[120px_1fr_1fr_1fr_32px] gap-1.5 px-2 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/50 border-b border-indigo-100 dark:border-indigo-900/60 text-[11px] font-extrabold text-indigo-800 dark:text-indigo-200 text-center">
                  <div className="text-left pl-0.5">WS Ngày</div>
                  {SESSION_ROWS.map((sr) => (
                    <div key={sr.key}>{sr.label}</div>
                  ))}
                  <div className="hidden sm:block" />
                </div>
                <div className="divide-y divide-indigo-100/70 dark:divide-indigo-900/50 bg-indigo-50/25 dark:bg-indigo-950/15">
                  {weekDays
                    .filter((day) => draftWsActiveDays.includes(day.key))
                    .map((day) => {
                      const wsEntry = draftWs[day.key];
                      return (
                        <div
                          key={day.key}
                          className="grid grid-cols-[64px_1fr_1fr_1fr] sm:grid-cols-[120px_1fr_1fr_1fr_32px] gap-1.5 px-2 py-1.5 items-center"
                        >
                          <div className="leading-tight min-w-0">
                            <div className="text-[11px] sm:text-xs font-extrabold text-indigo-950 dark:text-indigo-200 truncate">
                              {day.shortLabel}
                              {day.isToday ? ' · Nay' : ''}
                            </div>
                            <div className="text-[10px] font-semibold text-indigo-600/80 dark:text-indigo-400 tabular-nums">
                              {day.displayDate}
                            </div>
                          </div>

                          {SESSION_ROWS.map((sessionRow) => {
                            const val = wsEntry?.[sessionRow.key] ?? '';
                            return (
                              <input
                                key={sessionRow.key}
                                type="text"
                                inputMode="numeric"
                                maxLength={12}
                                value={val}
                                placeholder="—"
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) =>
                                  handleWsValueChange(day.key, sessionRow.key, e.target.value)
                                }
                                aria-label={`WS ${sessionRow.label} ${day.fullLabel}`}
                                className={`w-full h-9 text-center rounded-lg border text-xs sm:text-sm font-extrabold outline-none transition tabular-nums ${
                                  val
                                    ? 'bg-indigo-100/70 dark:bg-indigo-900/50 border-indigo-400 dark:border-indigo-500 text-indigo-950 dark:text-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600'
                                } focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`}
                              />
                            );
                          })}

                          <button
                            type="button"
                            onClick={() => handleToggleWsDay(day.key)}
                            className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer justify-center"
                            title={`Ẩn ngày WS ${day.fullLabel}`}
                            aria-label={`Ẩn ngày WS ${day.fullLabel}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            </section>
          )}

          {/* GHI CHÚ CÁ NHÂN (TÙY CHỌN, GỌN NHẸ) */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowLegendBox((p) => !p)}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Ghi chú quy ước số cá nhân</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLegendBox((p) => !p)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
              >
                {showLegendBox ? 'Thu gọn' : 'Mở'}
              </button>
            </div>

            {showLegendBox && (
              <div className="mt-2">
                <textarea
                  rows={2}
                  maxLength={600}
                  value={draftNoteLegend}
                  onChange={(e) => {
                    setDraftNoteLegend(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Ví dụ cá nhân: 127 = Thăm KV | 203 = Cà phê KN | 201 = Họp Uni..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}
          </section>
        </div>
      )}

      {/* ================== VIEW 2: TEAM SCHEDULES (SUPERVISORS) ================== */}
      {viewMode === 'TEAM_SCHEDULES' && canViewTeamSchedules && (
        <div className="space-y-2.5 sm:space-y-3.5">
          {/* Summary Strip + Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 shadow-2xs space-y-2.5">
            <div className={`grid gap-1.5 sm:gap-2.5 ${showWsSection ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 p-2 sm:p-2.5">
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                  Phạm vi
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {teamStats.total} TV
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 p-2 sm:p-2.5">
                <div className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold truncate">
                  Đã nhập
                </div>
                <div className="text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5 tabular-nums">
                  {teamStats.updatedCount}/{teamStats.total}
                </div>
              </div>
              <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60 p-2 sm:p-2.5">
                <div className="text-[10px] sm:text-[11px] text-sky-700 dark:text-sky-300 font-semibold truncate">
                  Buổi thường
                </div>
                <div className="text-sm sm:text-base font-extrabold text-sky-800 dark:text-sky-200 mt-0.5 tabular-nums">
                  {teamStats.totalSessions}
                </div>
              </div>
              {showWsSection && (
                <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 p-2 sm:p-2.5">
                  <div className="text-[10px] sm:text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold truncate">
                    Buổi WS
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-indigo-800 dark:text-indigo-200 mt-0.5 tabular-nums">
                    {teamStats.totalWs}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Tìm tên thành viên, Uni..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              {availableTeamCompanies.length > 1 && (
                <select
                  value={teamFilterCompany}
                  onChange={(e) => {
                    setTeamFilterCompany(e.target.value);
                    setTeamFilterArea('ALL');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="ALL">Tất cả Sion</option>
                  {availableTeamCompanies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              {availableTeamAreas.length > 1 && (
                <select
                  value={teamFilterArea}
                  onChange={(e) => setTeamFilterArea(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="ALL">Tất cả Khu vực</option>
                  {availableTeamAreas.map((a) => (
                    <option key={a.code} value={a.code}>
                      KV {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={teamStatusFilter}
                onChange={(e) => setTeamStatusFilter(e.target.value as 'ALL' | 'FILLED' | 'EMPTY')}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="FILLED">Đã điền lịch</option>
                <option value="EMPTY">Chưa điền lịch</option>
              </select>
            </div>
          </div>

          {/* Roster List with Expandable Read-Only Schedule Detail */}
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
              Đang tải dữ liệu lịch làm việc...
            </div>
          ) : filteredTeamRoster.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Không có thành viên nào khớp bộ lọc trong phạm vi quản lý của bạn.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTeamRoster.map((row) => {
                const isExpanded = expandedMemberKey === row.rowKey;
                const hasData = row.filledSessions + (showWsSection ? row.filledWs : 0) > 0;
                const rec = row.schedule;
                const recWsDays = rec
                  ? resolveWsActiveDays(rec.wsActiveDays, rec.ws)
                  : DEFAULT_WS_ACTIVE_DAYS;

                return (
                  <div
                    key={row.rowKey}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMemberKey((prev) => (prev === row.rowKey ? null : row.rowKey))
                      }
                      className="w-full px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            hasData
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                        >
                          {row.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                            <span className="truncate">{row.fullName}</span>
                            {row.isSelf && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold shrink-0">
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {row.companyCode} · KV {row.areaCode}
                            {row.unitCode ? ` · ${row.unitCode}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        {hasData ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[11px] font-bold">
                              {row.filledSessions}/21 buổi
                            </span>
                            {showWsSection && (
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                                {row.filledWs} WS
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                            Chưa nhập lịch
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 px-2">
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isExpanded ? 'Ẩn' : 'Xem'}</span>
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                        {!rec ? (
                          <div className="text-center py-4 text-xs text-slate-500 dark:text-slate-400">
                            Thành viên chưa cập nhật lịch tuần {formatDayMonth(selectedWeekStart)} –{' '}
                            {formatDayMonth(weekEndStr)}.
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Cập nhật:{' '}
                                {rec.updatedAt
                                  ? new Date(rec.updatedAt).toLocaleString('vi-VN')
                                  : '—'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleExportExcel('TEAM', rec.ownerUid)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                                <span>Xuất LLV cá nhân</span>
                              </button>
                            </div>
                            {/* Read-only Desktop Matrix */}
                            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                              <table className="w-full border-collapse text-center text-xs">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-2 px-3 text-left font-bold text-slate-600 dark:text-slate-300 w-28">
                                      Buổi
                                    </th>
                                    {weekDays.map((day) => (
                                      <th
                                        key={day.key}
                                        className="py-2 px-2 font-bold text-slate-700 dark:text-slate-200 border-l border-slate-200/70 dark:border-slate-700"
                                      >
                                        <div>{day.shortLabel}</div>
                                        <div className="text-[10px] font-normal text-slate-400">
                                          {day.displayDate}
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {SESSION_ROWS.map((sr) => (
                                    <tr key={sr.key}>
                                      <td className="py-2 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                                        {sr.label}
                                      </td>
                                      {weekDays.map((day) => {
                                        const val = rec.sessions?.[day.key]?.[sr.key] || '';
                                        return (
                                          <td
                                            key={day.key}
                                            className="py-2 px-2 border-l border-slate-100 dark:border-slate-800 font-extrabold"
                                          >
                                            {val ? (
                                              <span className="inline-block min-w-[36px] px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                {val}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 dark:text-slate-600">
                                                —
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Read-only Mobile Cards */}
                            <div className="md:hidden grid grid-cols-1 gap-2">
                              {weekDays.map((day) => {
                                const ds = rec.sessions?.[day.key];
                                return (
                                  <div
                                    key={day.key}
                                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 flex items-center justify-between gap-2"
                                  >
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                                      {day.shortLabel} · {day.displayDate}
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                                      {SESSION_ROWS.map((sr) => {
                                        const val = ds?.[sr.key] || '';
                                        return (
                                          <div
                                            key={sr.key}
                                            className={`px-2 py-1 rounded-lg border min-w-[52px] ${
                                              val
                                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 font-extrabold text-emerald-700 dark:text-emerald-300'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200/70 dark:border-slate-700 text-slate-400'
                                            }`}
                                          >
                                            <span className="text-[9px] block font-normal text-slate-400">
                                              {sr.label}
                                            </span>
                                            {val || '—'}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Read-only WS block */}
                            {showWsSection && (
                              <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-3">
                                <div className="text-[11px] font-extrabold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Lịch WS Tuần</span>
                                </div>
                                <div className="space-y-1.5">
                                  {weekDays
                                    .filter((day) => recWsDays.includes(day.key))
                                    .map((day) => {
                                      const wsDay = rec.ws?.[day.key];
                                      return (
                                        <div
                                          key={day.key}
                                          className="flex items-center justify-between gap-2 text-xs bg-white/80 dark:bg-slate-900/80 rounded-lg px-2.5 py-1.5 border border-indigo-100 dark:border-indigo-900/50"
                                        >
                                          <span className="font-bold text-indigo-900 dark:text-indigo-200">
                                            {day.fullLabel} ({day.displayDate})
                                          </span>
                                          <div className="flex items-center gap-2">
                                            {SESSION_ROWS.map((sr) => {
                                              const val = wsDay?.[sr.key] || '';
                                              return (
                                                <span
                                                  key={sr.key}
                                                  className={`px-2 py-0.5 rounded text-[11px] ${
                                                    val
                                                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-extrabold'
                                                      : 'text-slate-400 dark:text-slate-600'
                                                  }`}
                                                >
                                                  {sr.label}: {val || '—'}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {rec.noteLegend && (
                              <div className="text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-600 dark:text-slate-300">
                                <strong className="text-slate-800 dark:text-slate-100">Ghi chú: </strong>
                                {rec.noteLegend}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* IN-APP CONFIRM DELETE MODAL */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Xóa lịch tuần này?
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tuần {formatDayMonth(selectedWeekStart)} – {formatFullDateVN(weekEndStr)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Toàn bộ mã số 3 buổi và lịch WS của tuần này sẽ bị xóa. Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWeek}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP UNSAVED CHANGES MODAL WHEN SWITCHING WEEK */}
      {pendingWeekSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Có thay đổi chưa lưu
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bạn đang chỉnh sửa lịch tuần {formatDayMonth(selectedWeekStart)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Bạn muốn lưu lịch hiện tại trước khi chuyển sang tuần khác không?
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingWeekSwitch(null)}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Ở lại
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingWeekSwitch;
                  setPendingWeekSwitch(null);
                  setIsDirty(false);
                  setSelectedWeekStart(target);
                }}
                className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold cursor-pointer"
              >
                Bỏ thay đổi
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = pendingWeekSwitch;
                  const ok = await handleSave();
                  if (ok) {
                    setPendingWeekSwitch(null);
                    setSelectedWeekStart(target);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Lưu & chuyển tuần
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
