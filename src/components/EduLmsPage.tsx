import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  GraduationCap,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Table2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  Company,
  EDU_TRACK_FULL_LABELS,
  EDU_TRACK_LABELS,
  EDU_TRACK_ORDER,
  EduCmsProfile,
  EduTopicAssignment,
  EduTrack,
  EduWeeklyTopic,
  Member,
  UserAccount,
  canExportExcel,
} from '../types/edulms';
import { CustomSelect } from './CustomSelect';
import {
  canModifyEduRecord,
  canViewEduRecord,
  canViewMemberDetail,
  getScopedAreaOptions,
  getScopedCompanyOptions,
  isAdminRole,
  normalizeOrgCode,
} from '../utils/rbac';
import {
  EduRatingResult,
  EduRatingTier,
  LmsManagementRow,
  buildLmsAnalyticsSummary,
  buildLmsAreaAnalytics,
  buildLmsManagementRows,
  deriveAssignmentStatus,
  formatEduPercent,
  getISOWeekInfo,
  isAssignmentCompleted,
  isAssignmentParticipated,
  parseWeekLabelToIdSuffix,
} from '../utils/eduAnalytics';
import { exportEduLmsTwoSheetsExcel } from '../utils/excelManager';

interface EduLmsPageProps {
  currentUser: UserAccount | null;
  topics: EduWeeklyTopic[];
  assignments: EduTopicAssignment[];
  cmsProfiles?: EduCmsProfile[];
  companies: Company[];
  areas: Area[];
  members: Member[];
  isLoading: boolean;
  onSaveTopic: (topic: Omit<EduWeeklyTopic, 'id'>, existingId?: string) => Promise<void>;
  onDeleteTopic: (topicId: string) => Promise<void>;
  onSaveAssignment: (
    assignment: Omit<EduTopicAssignment, 'id'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteAssignment: (assignmentId: string) => Promise<void>;
  onNavigateToCmsCurriculum: (topicId: string) => void;
  onOpenAuthModal: () => void;
  onShowNotification: (msg: string) => void;
}

type LmsWorkspaceTab = 'MANAGEMENT' | 'ANALYTICS' | 'TOPICS';

const getDefaultWeekDates = (): { start: string; end: string } => {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  return { start: fmt(mon), end: fmt(sun) };
};

const RATING_BADGE_STYLES: Record<EduRatingTier, string> = {
  CHUA_CO:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  YEU:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
  TRUNG_BINH:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
  KHA:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70',
  TOT:
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/70',
  XUAT_SAC:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
  SIEU_XUAT_SAC:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70',
};

const RATING_BAR_STYLES: Record<EduRatingTier, string> = {
  CHUA_CO: 'bg-slate-300 dark:bg-slate-600',
  YEU: 'bg-rose-500',
  TRUNG_BINH: 'bg-amber-500',
  KHA: 'bg-sky-500',
  TOT: 'bg-teal-500',
  XUAT_SAC: 'bg-emerald-500',
  SIEU_XUAT_SAC: 'bg-indigo-600 dark:bg-indigo-500',
};

const LEVEL_BADGE_STYLES: Record<EduTrack, string> = {
  TD_MOI:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
  TD_I:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  TD_II:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
  NGV:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
};

const RatingBadge: React.FC<{ rating: EduRatingResult }> = ({ rating }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
      RATING_BADGE_STYLES[rating.tier]
    }`}
  >
    {rating.label}
  </span>
);

export const EduLmsPage: React.FC<EduLmsPageProps> = ({
  currentUser,
  topics,
  assignments,
  cmsProfiles = [],
  companies,
  areas,
  members,
  isLoading,
  onSaveTopic,
  onDeleteTopic,
  onSaveAssignment,
  onDeleteAssignment,
  onNavigateToCmsCurriculum,
  onOpenAuthModal,
  onShowNotification,
}) => {
  const isAdmin = isAdminRole(currentUser?.role);
  const canDownloadExcel = canExportExcel(currentUser?.role);
  const defaultWeek = useMemo(() => getISOWeekInfo(), []);
  const defaultDates = useMemo(() => getDefaultWeekDates(), []);

  // Workspace tabs: Sheet 1 (MANAGEMENT), Sheet 2 (ANALYTICS), Weekly Topics (TOPICS)
  const [workspaceTab, setWorkspaceTab] = useState<LmsWorkspaceTab>('MANAGEMENT');

  // Shared filters for Sheet 1 & Sheet 2
  const [sheetWeekFilter, setSheetWeekFilter] = useState<string>(defaultWeek.weekLabel);
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<'ALL' | EduTrack>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savingRowKeys, setSavingRowKeys] = useState<Record<string, boolean>>({});
  const [showWeekCurriculumPreview, setShowWeekCurriculumPreview] = useState(false);

  // Tab 3 (Topics & Curriculum) state
  const [activeTrack, setActiveTrack] = useState<EduTrack>('TD_MOI');
  const [topicWeekFilter, setTopicWeekFilter] = useState<string>('ALL');
  const [expandedLessonIds, setExpandedLessonIds] = useState<Record<string, boolean>>({});

  // Topic Create / Edit Modal (Admin)
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [tTrack, setTTrack] = useState<EduTrack>('TD_MOI');
  const [tWeekNum, setTWeekNum] = useState<number>(defaultWeek.week);
  const [tYear, setTYear] = useState<number>(defaultWeek.year);
  const [tStartDate, setTStartDate] = useState<string>(defaultDates.start);
  const [tEndDate, setTEndDate] = useState<string>(defaultDates.end);
  const [tCompanyCode, setTCompanyCode] = useState<string>('ALL');
  const [tAreaCode, setTAreaCode] = useState<string>('ALL');
  const [tTitle, setTTitle] = useState<string>('');
  const [tSummary, setTSummary] = useState<string>('');
  const [tCurriculum, setTCurriculum] = useState<string>('');
  const [isSavingTopic, setIsSavingTopic] = useState(false);

  // Manual Row / Topic Assignment Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualTargetTopic, setManualTargetTopic] = useState<EduWeeklyTopic | null>(null);
  const [editingAssignId, setEditingAssignId] = useState<string | null>(null);
  const [aCompanyCode, setACompanyCode] = useState<string>(
    currentUser?.companyCode || companies[0]?.code || ''
  );
  const [aAreaCode, setAAreaCode] = useState<string>(
    currentUser?.areaCode || areas[0]?.code || ''
  );
  const [aMemberId, setAMemberId] = useState<string>('');
  const [aStudentName, setAStudentName] = useState<string>('');
  const [aLevel, setALevel] = useState<EduTrack>('TD_MOI');
  const [aParticipated, setAParticipated] = useState<boolean>(true);
  const [aCompleted, setACompleted] = useState<boolean>(false);
  const [aNote, setANote] = useState<string>('');
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // In-app delete confirm modal
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const scopedCompanies = useMemo(
    () => getScopedCompanyOptions(currentUser, companies, members),
    [currentUser, companies, members]
  );

  const scopedAreasForFilter = useMemo(
    () =>
      getScopedAreaOptions(
        currentUser,
        areas,
        companyFilter === 'ALL' ? '' : companyFilter,
        members
      ),
    [currentUser, areas, companyFilter, members]
  );

  const allSheetWeekOptions = useMemo(() => {
    const map = new Map<string, number>();
    const parseSortScore = (wl: string): number => {
      const m = wl.match(/(\d+)\s*\/\s*(\d{4})/);
      if (!m) return 0;
      return Number(m[2]) * 100 + Number(m[1]);
    };
    map.set(defaultWeek.weekLabel, parseSortScore(defaultWeek.weekLabel));
    topics.forEach((t) => {
      if (t.weekLabel) map.set(t.weekLabel, parseSortScore(t.weekLabel));
    });
    assignments.forEach((a) => {
      if (a.weekLabel) map.set(a.weekLabel, parseSortScore(a.weekLabel));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label]) => label);
  }, [topics, assignments, defaultWeek.weekLabel]);

  // Rows for Sheet 1 (Quản lý) and Sheet 2 (Phân tích)
  const managementRows = useMemo(
    () =>
      buildLmsManagementRows({
        viewer: currentUser,
        cmsProfiles,
        assignments,
        topics,
        filters: {
          weekFilter: sheetWeekFilter,
          companyFilter,
          areaFilter,
          levelFilter,
          searchQuery,
        },
      }),
    [currentUser, cmsProfiles, assignments, topics, sheetWeekFilter, companyFilter, areaFilter, levelFilter, searchQuery]
  );

  const analyticsSummary = useMemo(
    () => buildLmsAnalyticsSummary(managementRows),
    [managementRows]
  );

  const areaAnalyticsRows = useMemo(
    () => buildLmsAreaAnalytics(managementRows),
    [managementRows]
  );

  const matchingWeekTopics = useMemo(() => {
    if (sheetWeekFilter === 'ALL') return [];
    return topics.filter((t) => {
      if (t.weekLabel !== sheetWeekFilter) return false;
      if (levelFilter !== 'ALL' && t.track !== levelFilter) return false;
      if (
        companyFilter !== 'ALL' &&
        t.companyCode !== 'ALL' &&
        normalizeOrgCode(t.companyCode) !== normalizeOrgCode(companyFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [topics, sheetWeekFilter, levelFilter, companyFilter]);

  // Tab 3 (Topics & Curriculum) computed lists
  const trackCounts = useMemo(() => {
    return {
      TD_MOI: topics.filter((t) => t.track === 'TD_MOI').length,
      TD_I: topics.filter((t) => t.track === 'TD_I').length,
      TD_II: topics.filter((t) => t.track === 'TD_II').length,
      NGV: topics.filter((t) => t.track === 'NGV').length,
    };
  }, [topics]);

  const topicWeekOptions = useMemo(() => {
    const set = new Set<string>();
    topics
      .filter((t) => t.track === activeTrack)
      .forEach((t) => set.add(t.weekLabel));
    return Array.from(set);
  }, [topics, activeTrack]);

  const visibleAssignments = useMemo(
    () => assignments.filter((a) => canViewEduRecord(currentUser, a)),
    [assignments, currentUser]
  );

  const filteredTopics = useMemo(() => {
    return topics
      .filter((t) => t.track === activeTrack)
      .filter((t) => {
        if (topicWeekFilter !== 'ALL' && t.weekLabel !== topicWeekFilter) return false;
        if (companyFilter !== 'ALL' && t.companyCode !== 'ALL' && t.companyCode !== companyFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchingAssigns = visibleAssignments.some(
            (a) =>
              a.topicId === t.id &&
              (a.studentName.toLowerCase().includes(q) ||
                a.areaCode.toLowerCase().includes(q) ||
                a.companyCode.toLowerCase().includes(q))
          );
          return (
            t.topicTitle.toLowerCase().includes(q) ||
            t.weekLabel.toLowerCase().includes(q) ||
            t.summary?.toLowerCase().includes(q) ||
            matchingAssigns
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      });
  }, [topics, visibleAssignments, activeTrack, topicWeekFilter, companyFilter, searchQuery]);

  const resolveTopicForTrackAndWeek = (
    track: EduTrack,
    weekLabel: string,
    compCode: string,
    areaCode: string
  ): { topicId: string; weekLabel: string; topicTitle: string } => {
    const matched =
      topics.find(
        (t) =>
          t.track === track &&
          t.weekLabel === weekLabel &&
          (t.companyCode === 'ALL' || normalizeOrgCode(t.companyCode) === normalizeOrgCode(compCode)) &&
          (t.areaCode === 'ALL' || normalizeOrgCode(t.areaCode) === normalizeOrgCode(areaCode))
      ) ||
      topics.find((t) => t.track === track && t.weekLabel === weekLabel) ||
      topics.find((t) => t.weekLabel === weekLabel);

    if (matched) {
      return {
        topicId: matched.id,
        weekLabel: matched.weekLabel,
        topicTitle: matched.topicTitle,
      };
    }

    return {
      topicId: `lms_${parseWeekLabelToIdSuffix(weekLabel)}_${track}`,
      weekLabel,
      topicTitle: `Đào tạo ${EDU_TRACK_LABELS[track]} · ${weekLabel}`,
    };
  };

  const canModifyRow = (row: LmsManagementRow): boolean => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    if (currentUser.role === 'MEMBER') {
      return Boolean(
        (row.assignment?.assignedByUid && row.assignment.assignedByUid === currentUser.id) ||
          (row.assignment?.memberId &&
            currentUser.memberId &&
            row.assignment.memberId === currentUser.memberId) ||
          (row.name.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase() &&
            normalizeOrgCode(row.areaCode) === normalizeOrgCode(currentUser.areaCode))
      );
    }
    return canModifyEduRecord(currentUser, {
      companyCode: row.companyCode,
      areaCode: row.areaCode,
      assignedByUid: row.assignment?.assignedByUid,
      memberId: row.assignment?.memberId,
    });
  };

  const canModifyAssignment = (a: EduTopicAssignment): boolean =>
    canModifyEduRecord(currentUser, a);

  const handleToggleRowCheck = async (
    row: LmsManagementRow,
    field: 'participated' | 'completed'
  ) => {
    if (!currentUser || !canModifyRow(row)) {
      onShowNotification('Bạn không có quyền cập nhật trạng thái cho nhân sự này.');
      return;
    }
    if (savingRowKeys[row.rowKey]) return;

    const nextParticipatedRaw =
      field === 'participated' ? !row.participated : !row.completed ? true : row.participated;
    const nextCompletedRaw =
      field === 'completed' ? !row.completed : !nextParticipatedRaw ? false : row.completed;

    const { participated, completed, status } = deriveAssignmentStatus(
      nextParticipatedRaw,
      nextCompletedRaw
    );

    setSavingRowKeys((prev) => ({ ...prev, [row.rowKey]: true }));
    try {
      const existing = row.assignment;
      const nowIso = new Date().toISOString();
      const targetWeekLabel =
        existing?.weekLabel ||
        (sheetWeekFilter !== 'ALL' ? sheetWeekFilter : defaultWeek.weekLabel);

      const resolvedCompany =
        existing?.companyCode || row.companyCode || currentUser.companyCode || 'HT';
      const resolvedArea =
        existing?.areaCode || row.areaCode || currentUser.areaCode || 'Chung';

      const topicMeta = existing
        ? {
            topicId: existing.topicId,
            weekLabel: existing.weekLabel,
            topicTitle: existing.topicTitle,
          }
        : resolveTopicForTrackAndWeek(
            row.level,
            targetWeekLabel,
            resolvedCompany,
            resolvedArea
          );

      await onSaveAssignment(
        {
          topicId: topicMeta.topicId,
          track: row.level,
          weekLabel: topicMeta.weekLabel,
          topicTitle: topicMeta.topicTitle,
          companyCode: resolvedCompany,
          areaCode: resolvedArea,
          memberId:
            existing?.memberId ||
            (currentUser.role === 'MEMBER' ? currentUser.memberId || `m-${currentUser.id}` : undefined),
          cmsProfileId: existing?.cmsProfileId || row.cmsProfileId,
          studentName: existing?.studentName || row.name,
          assignedByUid: existing?.assignedByUid || currentUser.id,
          assignedByName: existing?.assignedByName || currentUser.fullName,
          status,
          participated,
          completed,
          note: existing?.note || '',
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        },
        existing?.id
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu dấu tích: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setSavingRowKeys((prev) => {
        const next = { ...prev };
        delete next[row.rowKey];
        return next;
      });
    }
  };

  const handleToggleTopicAssignmentCheck = async (
    topic: EduWeeklyTopic,
    assign: EduTopicAssignment,
    field: 'participated' | 'completed'
  ) => {
    const curPart = isAssignmentParticipated(assign);
    const curComp = isAssignmentCompleted(assign);
    const nextPartRaw = field === 'participated' ? !curPart : !curComp ? true : curPart;
    const nextCompRaw = field === 'completed' ? !curComp : !nextPartRaw ? false : curComp;
    const { participated, completed, status } = deriveAssignmentStatus(nextPartRaw, nextCompRaw);

    try {
      await onSaveAssignment(
        {
          topicId: topic.id,
          track: assign.track,
          weekLabel: assign.weekLabel,
          topicTitle: topic.topicTitle,
          companyCode: assign.companyCode,
          areaCode: assign.areaCode,
          memberId: assign.memberId,
          cmsProfileId: assign.cmsProfileId,
          studentName: assign.studentName,
          assignedByUid: assign.assignedByUid,
          assignedByName: assign.assignedByName,
          status,
          participated,
          completed,
          note: assign.note,
          createdAt: assign.createdAt,
          updatedAt: new Date().toISOString(),
        },
        assign.id
      );
    } catch (err: any) {
      onShowNotification(`Lỗi cập nhật trạng thái: ${err?.message || 'Thử lại sau'}`);
    }
  };

  const openCreateTopic = () => {
    setEditingTopicId(null);
    setTTrack(activeTrack);
    setTWeekNum(defaultWeek.week);
    setTYear(defaultWeek.year);
    setTStartDate(defaultDates.start);
    setTEndDate(defaultDates.end);
    setTCompanyCode('ALL');
    setTAreaCode('ALL');
    setTTitle('');
    setTSummary('');
    setTCurriculum('');
    setIsTopicModalOpen(true);
  };

  const openEditTopic = (topic: EduWeeklyTopic) => {
    setEditingTopicId(topic.id);
    setTTrack(topic.track);
    setTWeekNum(topic.weekNumber);
    setTYear(topic.year);
    setTStartDate(topic.startDate);
    setTEndDate(topic.endDate);
    setTCompanyCode(topic.companyCode || 'ALL');
    setTAreaCode(topic.areaCode || 'ALL');
    setTTitle(topic.topicTitle);
    setTSummary(topic.summary || '');
    setTCurriculum(topic.curriculumContent || '');
    setIsTopicModalOpen(true);
  };

  const handleSaveTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim()) {
      onShowNotification('Vui lòng nhập Tên Chủ đề.');
      return;
    }
    setIsSavingTopic(true);
    try {
      const existing = editingTopicId ? topics.find((t) => t.id === editingTopicId) : null;
      const nowIso = new Date().toISOString();
      await onSaveTopic(
        {
          weekNumber: Math.max(1, Math.min(53, Number(tWeekNum) || 1)),
          year: Number(tYear) || defaultWeek.year,
          weekLabel: `Tuần ${String(Math.max(1, Math.min(53, Number(tWeekNum) || 1))).padStart(
            2,
            '0'
          )} / ${Number(tYear) || defaultWeek.year}`,
          startDate: tStartDate,
          endDate: tEndDate,
          track: tTrack,
          companyCode: tCompanyCode,
          areaCode: tCompanyCode === 'ALL' ? 'ALL' : tAreaCode,
          topicTitle: tTitle.trim(),
          summary: tSummary.trim(),
          learningObjectives: existing?.learningObjectives || '',
          curriculumContent: tCurriculum.trim(),
          referenceLinks: existing?.referenceLinks || '',
          createdBy: existing?.createdBy || currentUser?.fullName || 'Admin',
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        },
        editingTopicId || undefined
      );
      setIsTopicModalOpen(false);
      onShowNotification(editingTopicId ? 'Đã cập nhật Chủ đề tuần!' : 'Đã tạo Chủ đề tuần mới!');
    } catch (err: any) {
      onShowNotification(`Lỗi lưu chủ đề: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingTopic(false);
    }
  };

  const openManualModal = (options?: {
    topic?: EduWeeklyTopic | null;
    existing?: EduTopicAssignment;
    row?: LmsManagementRow;
  }) => {
    const topic = options?.topic || null;
    const existing = options?.existing || options?.row?.assignment;
    const row = options?.row;

    setManualTargetTopic(topic);
    if (existing) {
      setEditingAssignId(existing.id);
      setACompanyCode(existing.companyCode);
      setAAreaCode(existing.areaCode);
      setAMemberId(existing.memberId || '');
      setAStudentName(existing.studentName);
      setALevel(existing.track);
      setAParticipated(isAssignmentParticipated(existing));
      setACompleted(isAssignmentCompleted(existing));
      setANote(existing.note || '');
    } else if (row) {
      setEditingAssignId(null);
      setACompanyCode(row.companyCode || currentUser?.companyCode || companies[0]?.code || '');
      setAAreaCode(row.areaCode || currentUser?.areaCode || areas[0]?.code || '');
      setAMemberId('');
      setAStudentName(row.name);
      setALevel(row.level);
      setAParticipated(row.participated);
      setACompleted(row.completed);
      setANote(row.note || '');
    } else {
      setEditingAssignId(null);
      const isMemberOnly = currentUser?.role === 'MEMBER';
      const defComp = isMemberOnly
        ? currentUser.companyCode
        : topic && topic.companyCode !== 'ALL'
        ? topic.companyCode
        : companyFilter !== 'ALL'
        ? companyFilter
        : currentUser?.companyCode || scopedCompanies[0]?.code || companies[0]?.code || '';
      const defArea = isMemberOnly
        ? currentUser.areaCode
        : topic && topic.areaCode !== 'ALL'
        ? topic.areaCode
        : areaFilter !== 'ALL'
        ? areaFilter
        : currentUser?.areaCode ||
          areas.find((a) => a.companyCode === defComp)?.code ||
          areas[0]?.code ||
          '';
      setACompanyCode(defComp);
      setAAreaCode(defArea);
      setAMemberId(isMemberOnly ? currentUser.memberId || `m-${currentUser.id}` : '');
      setAStudentName(isMemberOnly ? currentUser.fullName : '');
      setALevel(topic?.track || (levelFilter !== 'ALL' ? levelFilter : 'TD_MOI'));
      setAParticipated(true);
      setACompleted(false);
      setANote('');
    }
    setIsManualModalOpen(true);
  };

  const handleSaveManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!aAreaCode.trim() || !aStudentName.trim()) {
      onShowNotification('Vui lòng nhập đầy đủ Khu vực (KV) và Họ tên (Name).');
      return;
    }

    setIsSavingAssign(true);
    try {
      const existing = editingAssignId
        ? assignments.find((a) => a.id === editingAssignId)
        : null;
      const nowIso = new Date().toISOString();
      const { participated, completed, status } = deriveAssignmentStatus(aParticipated, aCompleted);

      const targetWeekLabel =
        manualTargetTopic?.weekLabel ||
        existing?.weekLabel ||
        (sheetWeekFilter !== 'ALL' ? sheetWeekFilter : defaultWeek.weekLabel);

      const topicMeta = manualTargetTopic
        ? {
            topicId: manualTargetTopic.id,
            weekLabel: manualTargetTopic.weekLabel,
            topicTitle: manualTargetTopic.topicTitle,
          }
        : existing
        ? {
            topicId: existing.topicId,
            weekLabel: existing.weekLabel,
            topicTitle: existing.topicTitle,
          }
        : resolveTopicForTrackAndWeek(aLevel, targetWeekLabel, aCompanyCode, aAreaCode);

      await onSaveAssignment(
        {
          topicId: topicMeta.topicId,
          track: aLevel,
          weekLabel: topicMeta.weekLabel,
          topicTitle: topicMeta.topicTitle,
          companyCode: aCompanyCode,
          areaCode: aAreaCode.trim(),
          memberId: aMemberId || existing?.memberId || undefined,
          cmsProfileId: existing?.cmsProfileId,
          studentName: aStudentName.trim(),
          assignedByUid: existing?.assignedByUid || currentUser.id,
          assignedByName: existing?.assignedByName || currentUser.fullName,
          status,
          participated,
          completed,
          note: aNote.trim(),
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        },
        editingAssignId || undefined
      );

      setIsManualModalOpen(false);
      setManualTargetTopic(null);
      onShowNotification(
        editingAssignId ? 'Đã cập nhật thông tin LMS!' : 'Đã thêm dòng dữ liệu LMS mới!'
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu dữ liệu: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingAssign(false);
    }
  };

  const handleExportExcel = () => {
    if (!currentUser || !canDownloadExcel) {
      onShowNotification('Chỉ tài khoản từ cấp TS, NQ trở lên mới được xuất Excel.');
      return;
    }
    try {
      const res = exportEduLmsTwoSheetsExcel({
        viewer: currentUser,
        rows: managementRows,
        weekLabel: sheetWeekFilter === 'ALL' ? 'Tất cả tuần (Tổng hợp)' : sheetWeekFilter,
        companyCode: companyFilter,
        areaCode: areaFilter,
      });
      onShowNotification(`Đã xuất ${res.fileName} (2 Sheet: Quản lý & Phân tích · ${res.rowsCount} dòng).`);
    } catch (err: any) {
      onShowNotification(`Lỗi xuất Excel: ${err?.message || 'Thử lại sau'}`);
    }
  };

  const scopedCompanyOptionsForAssign = useMemo(
    () => getScopedCompanyOptions(currentUser, companies, members),
    [currentUser, companies, members]
  );

  const areaOptionsForAssign = useMemo(
    () => getScopedAreaOptions(currentUser, areas, aCompanyCode, members),
    [currentUser, areas, aCompanyCode, members]
  );

  const memberCandidatesForAssign = useMemo(
    () =>
      members.filter(
        (m) =>
          canViewMemberDetail(currentUser, m) &&
          (!aCompanyCode || m.companyCode === aCompanyCode) &&
          (!aAreaCode || m.areaCode === aAreaCode)
      ),
    [members, currentUser, aCompanyCode, aAreaCode]
  );

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md mx-auto text-center shadow-sm border border-slate-200 dark:border-slate-800 my-10">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
          Đăng nhập để truy cập Edu LMS
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Quản lý tham gia &amp; hoàn thành theo 4 cấp độ (TĐM, TĐ1, TĐ2, NGV) và xem bảng phân tích tỷ lệ đạt chuẩn.
        </p>
        <button
          type="button"
          onClick={onOpenAuthModal}
          className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Đăng nhập / Đăng ký ngay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header & Workspace Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Edu LMS — Quản lý &amp; Phân tích</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Theo dõi 4 cấp độ <strong>TĐM</strong>, <strong>TĐ1</strong>, <strong>TĐ2</strong>,{' '}
              <strong>NGV</strong> · Nạp sẵn nhân sự CMS để tick nhanh và tự động chấm đánh giá.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {canDownloadExcel && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 h-9 sm:h-10 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Xuất Excel (2 Sheet)</span>
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={openCreateTopic}
                className="px-3.5 h-9 sm:h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Chủ đề</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary 2-Sheet Switcher + Curriculum Tab */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2 p-1 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setWorkspaceTab('MANAGEMENT')}
            className={`h-9 sm:h-10 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              workspaceTab === 'MANAGEMENT'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Table2 className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">Sheet 1: Quản lý ({managementRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceTab('ANALYTICS')}
            className={`h-9 sm:h-10 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              workspaceTab === 'ANALYTICS'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">Sheet 2: Phân tích</span>
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceTab('TOPICS')}
            className={`h-9 sm:h-10 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              workspaceTab === 'TOPICS'
                ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">Chủ đề &amp; Giáo trình ({topics.length})</span>
          </button>
        </div>

        {/* Shared Filter Bar for Sheet 1 & Sheet 2 */}
        {workspaceTab !== 'TOPICS' && (
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 text-xs">
            <div className="col-span-2 sm:col-span-3 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm Name, KV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="col-span-1 sm:col-span-3">
              <CustomSelect
                size="sm"
                value={sheetWeekFilter}
                onChange={setSheetWeekFilter}
                options={[
                  { value: 'ALL', label: 'Tất cả tuần (Tổng hợp)' },
                  ...allSheetWeekOptions.map((w) => ({
                    value: w,
                    label: w === defaultWeek.weekLabel ? `${w} (Hiện tại)` : w,
                  })),
                ]}
                ariaLabel="Chọn Tuần"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <CustomSelect
                size="sm"
                value={levelFilter}
                onChange={(val) => setLevelFilter(val as 'ALL' | EduTrack)}
                options={[
                  { value: 'ALL', label: 'Tất cả Level' },
                  ...EDU_TRACK_ORDER.map((lv) => ({
                    value: lv,
                    label: EDU_TRACK_LABELS[lv],
                  })),
                ]}
                ariaLabel="Lọc theo Level"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <CustomSelect
                size="sm"
                value={companyFilter}
                onChange={(val) => {
                  setCompanyFilter(val);
                  setAreaFilter('ALL');
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả Sion' },
                  ...scopedCompanies.map((c) => ({
                    value: c.code,
                    label: c.name,
                    badge: c.code,
                  })),
                ]}
                ariaLabel="Lọc theo Sion"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <CustomSelect
                size="sm"
                value={areaFilter}
                onChange={setAreaFilter}
                options={[
                  { value: 'ALL', label: 'Tất cả KV' },
                  ...scopedAreasForFilter.map((a) => ({
                    value: a.code,
                    label: `KV ${a.code}`,
                    badge: a.companyCode,
                  })),
                ]}
                ariaLabel="Lọc theo Khu vực"
              />
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SHEET 1 - QUẢN LÝ (Name | KV | Level | Tham gia | Hoàn thành)   */}
      {/* ===================================================================== */}
      {workspaceTab === 'MANAGEMENT' && (
        <div className="space-y-3">
          {/* Clean Metadata Bar & Quick Manual Add */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:px-5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              <span className="font-bold text-slate-900 dark:text-white">
                {sheetWeekFilter === 'ALL' ? 'Tổng hợp tất cả tuần' : sheetWeekFilter}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                SL: <strong className="text-slate-900 dark:text-white">{analyticsSummary.totalRow.totalCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Tham gia:{' '}
                <strong className="text-blue-700 dark:text-blue-300">
                  {analyticsSummary.totalRow.participatedCount} (
                  {formatEduPercent(analyticsSummary.totalRow.participatedRate)})
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Hoàn thành:{' '}
                <strong className="text-emerald-700 dark:text-emerald-300">
                  {analyticsSummary.totalRow.completedCount} (
                  {formatEduPercent(analyticsSummary.totalRow.completedRate)})
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {matchingWeekTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWeekCurriculumPreview((p) => !p)}
                  className="px-3 h-9 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Chủ đề tuần ({matchingWeekTopics.length})</span>
                  {showWeekCurriculumPreview ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => openManualModal()}
                className="px-3.5 h-9 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Thêm thủ công</span>
              </button>
            </div>
          </div>

          {/* Optional Week Topic Quick Drawer */}
          {showWeekCurriculumPreview && matchingWeekTopics.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Chủ đề đào tạo {sheetWeekFilter}
                </span>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('TOPICS')}
                  className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Mở tab Chủ đề &amp; Giáo trình
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {matchingWeekTopics.map((t) => (
                  <div key={t.id} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {EDU_TRACK_LABELS[t.track]} · {t.topicTitle}
                      </div>
                      {t.summary && (
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {t.summary}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTrack(t.track);
                        setTopicWeekFilter(t.weekLabel);
                        setExpandedLessonIds((prev) => ({ ...prev, [t.id]: true }));
                        setWorkspaceTab('TOPICS');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold shrink-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Đọc bài
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Management Table / List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : managementRows.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Users className="w-10 h-10 text-slate-400 mx-auto" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Chưa có nhân sự nào trong phạm vi đang lọc
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Danh sách tự động nạp nhân sự từ mục <strong>CMS</strong> theo bộ lọc Sion / Khu vực / Level, hoặc bạn có thể thêm thủ công từng dòng.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openManualModal()}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng thủ công</span>
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Card List */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {managementRows.map((row, idx) => {
                    const editable = canModifyRow(row);
                    const isSaving = Boolean(savingRowKeys[row.rowKey]);
                    return (
                      <div key={row.rowKey} className="p-3.5 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                #{idx + 1}
                              </span>
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                {row.name}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <span className="font-bold text-blue-700 dark:text-blue-300">
                                {row.companyCode ? `${row.companyCode} · ` : ''}KV {row.areaCode || '—'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                  LEVEL_BADGE_STYLES[row.level]
                                }`}
                              >
                                {EDU_TRACK_LABELS[row.level]}
                              </span>
                            </div>
                          </div>

                          {editable && (
                            <div className="inline-flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openManualModal({ row })}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                                title="Sửa / Ghi chú"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {row.assignment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDelete({
                                      title: `Xóa trạng thái LMS tuần của "${row.name}"?`,
                                      onConfirm: () => onDeleteAssignment(row.assignment!.id),
                                    })
                                  }
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Xóa bản ghi LMS"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {row.note && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Ghi chú: {row.note}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={!editable || isSaving}
                            onClick={() => handleToggleRowCheck(row, 'participated')}
                            aria-pressed={row.participated}
                            className={`min-h-[44px] px-3 rounded-xl border font-bold flex items-center justify-between transition cursor-pointer disabled:opacity-60 ${
                              row.participated
                                ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-200'
                                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>Tham gia</span>
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                row.participated
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {row.participated && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={!editable || isSaving}
                            onClick={() => handleToggleRowCheck(row, 'completed')}
                            aria-pressed={row.completed}
                            className={`min-h-[44px] px-3 rounded-xl border font-bold flex items-center justify-between transition cursor-pointer disabled:opacity-60 ${
                              row.completed
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200'
                                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>Hoàn thành</span>
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                row.completed
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {row.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table: STT | Name | KV | Level | Tham gia | Hoàn thành | Ghi chú | Thao tác */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-12">STT</th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">KV</th>
                        <th className="py-3 px-4">Level</th>
                        <th className="py-3 px-4 text-center w-28">Tham gia</th>
                        <th className="py-3 px-4 text-center w-28">Hoàn thành</th>
                        <th className="py-3 px-4">Ghi chú</th>
                        <th className="py-3 px-4 text-right w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {managementRows.map((row, idx) => {
                        const editable = canModifyRow(row);
                        const isSaving = Boolean(savingRowKeys[row.rowKey]);
                        return (
                          <tr
                            key={row.rowKey}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                          >
                            <td className="py-2.5 px-4 font-mono text-slate-400 tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {row.name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {row.source === 'MANUAL' ? 'Thêm thủ công' : 'CMS'}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                              {row.companyCode ? `${row.companyCode} · ` : ''}KV {row.areaCode || '—'}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${
                                  LEVEL_BADGE_STYLES[row.level]
                                }`}
                              >
                                {EDU_TRACK_LABELS[row.level]}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                disabled={!editable || isSaving}
                                onClick={() => handleToggleRowCheck(row, 'participated')}
                                aria-label={`Đánh dấu Tham gia cho ${row.name}`}
                                aria-pressed={row.participated}
                                className={`w-7 h-7 mx-auto rounded-lg border flex items-center justify-center transition cursor-pointer disabled:opacity-50 ${
                                  row.participated
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-blue-400'
                                }`}
                              >
                                {row.participated && <Check className="w-4 h-4 stroke-[3]" />}
                              </button>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                disabled={!editable || isSaving}
                                onClick={() => handleToggleRowCheck(row, 'completed')}
                                aria-label={`Đánh dấu Hoàn thành cho ${row.name}`}
                                aria-pressed={row.completed}
                                className={`w-7 h-7 mx-auto rounded-lg border flex items-center justify-center transition cursor-pointer disabled:opacity-50 ${
                                  row.completed
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                                }`}
                              >
                                {row.completed && <Check className="w-4 h-4 stroke-[3]" />}
                              </button>
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 max-w-[220px] truncate">
                              {row.note || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              {editable && (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openManualModal({ row })}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                                    title="Chỉnh sửa / Ghi chú"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  {row.assignment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDelete({
                                          title: `Xóa bản ghi LMS của "${row.name}"?`,
                                          onConfirm: () => onDeleteAssignment(row.assignment!.id),
                                        })
                                      }
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                      title="Xóa bản ghi"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SHEET 2 - PHÂN TÍCH (TĐM, TĐ1, TĐ2, NGV + 2 Đánh giá riêng)   */}
      {/* ===================================================================== */}
      {workspaceTab === 'ANALYTICS' && (
        <div className="space-y-4">
          {/* Top 3 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Tổng SL nhân sự trong phạm vi
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-1">
                {analyticsSummary.totalRow.totalCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {analyticsSummary.levelRows
                  .map((r) => `${r.label}: ${r.totalCount}`)
                  .join(' · ')}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Tham gia / SL (%)
                </div>
                <div className="text-2xl font-black text-blue-700 dark:text-blue-300 tabular-nums mt-1">
                  {formatEduPercent(analyticsSummary.totalRow.participatedRate)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {analyticsSummary.totalRow.participatedCount} / {analyticsSummary.totalRow.totalCount} nhân sự
                </div>
              </div>
              <RatingBadge rating={analyticsSummary.totalRow.participatedRating} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Hoàn thành / SL (%)
                </div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums mt-1">
                  {formatEduPercent(analyticsSummary.totalRow.completedRate)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {analyticsSummary.totalRow.completedCount} / {analyticsSummary.totalRow.totalCount} nhân sự
                </div>
              </div>
              <RatingBadge rating={analyticsSummary.totalRow.completedRating} />
            </div>
          </div>

          {/* Primary Level Breakdown Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Bảng Phân tích theo 4 Level (TĐM · TĐ1 · TĐ2 · NGV)
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {sheetWeekFilter === 'ALL' ? 'Tổng hợp tất cả tuần' : sheetWeekFilter}
              </span>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {[...analyticsSummary.levelRows, analyticsSummary.totalRow].map((item) => {
                const isTotal = item.level === 'TOTAL';
                return (
                  <div
                    key={item.level}
                    className={`p-4 space-y-3 text-xs ${
                      isTotal ? 'bg-slate-50/90 dark:bg-slate-800/50 font-bold' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {item.label}
                      </span>
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        SL: <strong>{item.totalCount}</strong>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                          Tham gia: <strong>{item.participatedCount}/{item.totalCount}</strong> (
                          {formatEduPercent(item.participatedRate)})
                        </span>
                        <RatingBadge rating={item.participatedRating} />
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${RATING_BAR_STYLES[item.participatedRating.tier]}`}
                          style={{ width: `${Math.min(100, item.participatedRate || 0)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                          Hoàn thành: <strong>{item.completedCount}/{item.totalCount}</strong> (
                          {formatEduPercent(item.completedRate)})
                        </span>
                        <RatingBadge rating={item.completedRating} />
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${RATING_BAR_STYLES[item.completedRating.tier]}`}
                          style={{ width: `${Math.min(100, item.completedRate || 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4 text-right">SL</th>
                    <th className="py-3 px-4">Tham gia / SL (%)</th>
                    <th className="py-3 px-4">Đánh giá (Tham gia)</th>
                    <th className="py-3 px-4">Hoàn thành / SL (%)</th>
                    <th className="py-3 px-4">Đánh giá (Hoàn thành)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...analyticsSummary.levelRows, analyticsSummary.totalRow].map((item) => {
                    const isTotal = item.level === 'TOTAL';
                    return (
                      <tr
                        key={item.level}
                        className={
                          isTotal
                            ? 'bg-slate-50 dark:bg-slate-800/60 font-extrabold border-t-2 border-slate-200 dark:border-slate-700'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition'
                        }
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isTotal ? (
                            <span className="font-black text-slate-900 dark:text-white">
                              Tổng cộng
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${
                                LEVEL_BADGE_STYLES[item.level as EduTrack]
                              }`}
                            >
                              {item.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {item.totalCount}
                        </td>
                        <td className="py-3.5 px-4 min-w-[180px]">
                          <div className="flex items-center justify-between gap-2 tabular-nums">
                            <span className="text-slate-600 dark:text-slate-300">
                              {item.participatedCount} / {item.totalCount}
                            </span>
                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                              {formatEduPercent(item.participatedRate)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${RATING_BAR_STYLES[item.participatedRating.tier]}`}
                              style={{ width: `${Math.min(100, item.participatedRate || 0)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <RatingBadge rating={item.participatedRating} />
                        </td>
                        <td className="py-3.5 px-4 min-w-[180px]">
                          <div className="flex items-center justify-between gap-2 tabular-nums">
                            <span className="text-slate-600 dark:text-slate-300">
                              {item.completedCount} / {item.totalCount}
                            </span>
                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                              {formatEduPercent(item.completedRate)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${RATING_BAR_STYLES[item.completedRating.tier]}`}
                              style={{ width: `${Math.min(100, item.completedRate || 0)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <RatingBadge rating={item.completedRating} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rating Scale Legend */}
            <div className="px-4 sm:px-5 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-200">Thang đánh giá:</span>
              <span>&lt; 50%: Yếu</span>
              <span aria-hidden="true">·</span>
              <span>50–59%: Trung bình</span>
              <span aria-hidden="true">·</span>
              <span>60–69%: Khá</span>
              <span aria-hidden="true">·</span>
              <span>70–79%: Tốt</span>
              <span aria-hidden="true">·</span>
              <span>80–89%: Xuất sắc</span>
              <span aria-hidden="true">·</span>
              <span>90–100%: Siêu xuất sắc</span>
            </div>
          </div>

          {/* Breakdown by Khu vực (KV) */}
          {areaAnalyticsRows.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Phân tích chi tiết theo Khu vực (KV)
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {areaAnalyticsRows.length} khu vực
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Khu vực</th>
                      <th className="py-2.5 px-4 text-right">SL</th>
                      <th className="py-2.5 px-4">Tham gia / SL (%)</th>
                      <th className="py-2.5 px-4">Đánh giá (Tham gia)</th>
                      <th className="py-2.5 px-4">Hoàn thành / SL (%)</th>
                      <th className="py-2.5 px-4">Đánh giá (Hoàn thành)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {areaAnalyticsRows.map((ar) => (
                      <tr
                        key={`${ar.companyCode}_${ar.areaCode}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                      >
                        <td className="py-2.5 px-4 font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                          {ar.companyCode} · KV {ar.areaCode}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {ar.totalCount}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                          {ar.participatedCount}/{ar.totalCount} ({formatEduPercent(ar.participatedRate)})
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <RatingBadge rating={ar.participatedRating} />
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                          {ar.completedCount}/{ar.totalCount} ({formatEduPercent(ar.completedRate)})
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <RatingBadge rating={ar.completedRating} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CHỦ ĐỀ & GIÁO TRÌNH (4 Cấp độ TĐM, TĐ1, TĐ2, NGV)              */}
      {/* ===================================================================== */}
      {workspaceTab === 'TOPICS' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            {/* 4 Track Tabs */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2 p-1 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800/80">
              {EDU_TRACK_ORDER.map((tr) => {
                const active = activeTrack === tr;
                return (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => {
                      setActiveTrack(tr);
                      setTopicWeekFilter('ALL');
                    }}
                    className={`h-9 px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="truncate">{EDU_TRACK_LABELS[tr]}</span>
                    <span className="text-[10px] opacity-75 tabular-nums">({trackCounts[tr]})</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 text-xs">
              <div className="col-span-2 sm:col-span-5 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm Tên Chủ đề, Tên KV, Tên TĐ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="col-span-1 sm:col-span-4">
                <CustomSelect
                  size="sm"
                  value={topicWeekFilter}
                  onChange={setTopicWeekFilter}
                  options={[
                    { value: 'ALL', label: 'Tất cả Tuần' },
                    ...topicWeekOptions.map((w) => ({ value: w, label: w })),
                  ]}
                  ariaLabel="Lọc theo Tuần"
                />
              </div>

              <div className="col-span-1 sm:col-span-3">
                <CustomSelect
                  size="sm"
                  value={companyFilter}
                  onChange={setCompanyFilter}
                  options={[
                    { value: 'ALL', label: 'Tất cả Sion' },
                    ...scopedCompanies.map((c) => ({
                      value: c.code,
                      label: c.name,
                      badge: c.code,
                    })),
                  ]}
                  ariaLabel="Lọc theo Công ty"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <GraduationCap className="w-10 h-10 text-emerald-500 mx-auto" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Chưa có Chủ đề tuần nào cho nhóm {EDU_TRACK_LABELS[activeTrack]}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isAdmin
                    ? 'Admin hãy tạo Chủ đề tuần mới để đồng bộ giáo trình với bảng Quản lý & Phân tích.'
                    : 'Chủ đề tuần cho nhóm này sẽ xuất hiện ngay khi Admin khởi tạo.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={openCreateTopic}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  + Tạo Chủ đề đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredTopics.map((topic) => {
                const topicAssigns = visibleAssignments.filter((a) => a.topicId === topic.id);
                const isLessonOpen = !!expandedLessonIds[topic.id];
                const hasLesson = Boolean(topic.curriculumContent?.trim());

                return (
                  <div
                    key={topic.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    {/* Topic Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${
                              LEVEL_BADGE_STYLES[topic.track]
                            }`}
                          >
                            {EDU_TRACK_LABELS[topic.track]}
                          </span>
                          <span className="font-bold text-blue-700 dark:text-blue-300 inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3.5 h-3.5" />
                            {topic.weekLabel}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums">
                            ({topic.startDate.split('-').reverse().join('/')} –{' '}
                            {topic.endDate.split('-').reverse().join('/')})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <MapPin className="w-3 h-3" />
                            {topic.companyCode === 'ALL'
                              ? 'Toàn hệ thống'
                              : topic.areaCode === 'ALL'
                              ? `${topic.companyCode} · Tất cả KV`
                              : `${topic.companyCode} · KV ${topic.areaCode}`}
                          </span>
                        </div>

                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          {topic.topicTitle}
                        </h2>

                        {topic.summary && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {topic.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLessonIds((prev) => ({
                              ...prev,
                              [topic.id]: !prev[topic.id],
                            }))
                          }
                          className={`px-3 h-9 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                            hasLesson
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{hasLesson ? 'Đọc Giáo trình' : 'Chưa có giáo trình'}</span>
                          {isLessonOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openManualModal({ topic })}
                          className="px-3.5 h-9 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Gán Tên KV &amp; TĐ</span>
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditTopic(topic)}
                              className="p-2 min-w-[36px] min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-slate-600 dark:text-slate-300 hover:text-blue-700 transition cursor-pointer"
                              title="Sửa Chủ đề tuần"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  title: `Xóa chủ đề "${topic.topicTitle}" (${topic.weekLabel})?`,
                                  onConfirm: () => onDeleteTopic(topic.id),
                                })
                              }
                              className="p-2 min-w-[36px] min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer"
                              title="Xóa Chủ đề tuần"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expandable Curriculum Viewer */}
                    {isLessonOpen && (
                      <div className="p-5 bg-amber-50/40 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4" />
                            <span>Giáo trình / Nội dung Bài học gắn với Chủ đề</span>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onNavigateToCmsCurriculum(topic.id)}
                              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 hover:bg-amber-50 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Soạn chi tiết trong CMS</span>
                            </button>
                          )}
                        </div>

                        {topic.learningObjectives && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-700 text-xs">
                            <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                              Mục tiêu bài học:
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                              {topic.learningObjectives}
                            </div>
                          </div>
                        )}

                        {hasLesson ? (
                          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                            {topic.curriculumContent}
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                            Chưa có nội dung bài học chi tiết cho chủ đề này.
                            {isAdmin && ' Bấm "Soạn chi tiết trong CMS" để viết giáo trình.'}
                          </div>
                        )}

                        {topic.referenceLinks && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            <strong>Tài liệu tham khảo:</strong>{' '}
                            <span className="break-all">{topic.referenceLinks}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Topic Roster */}
                    <div className="p-4 sm:p-5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Danh sách KV &amp; TĐ đã gán ({topicAssigns.length})</span>
                        </span>
                      </div>

                      {topicAssigns.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500 dark:text-slate-400">
                          Chưa có bản ghi nào gắn vào chủ đề này. Bạn có thể tick ở tab{' '}
                          <strong>Sheet 1: Quản lý</strong> hoặc bấm{' '}
                          <strong>“Gán Tên KV &amp; TĐ”</strong>.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
                              <tr>
                                <th className="py-2.5 px-3">KV</th>
                                <th className="py-2.5 px-3">Name</th>
                                <th className="py-2.5 px-3 text-center">Tham gia</th>
                                <th className="py-2.5 px-3 text-center">Hoàn thành</th>
                                <th className="py-2.5 px-3">Ghi chú</th>
                                <th className="py-2.5 px-3 text-right">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {topicAssigns.map((a) => {
                                const canEdit = canModifyAssignment(a);
                                const part = isAssignmentParticipated(a);
                                const comp = isAssignmentCompleted(a);
                                return (
                                  <tr
                                    key={a.id}
                                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                                  >
                                    <td className="py-2.5 px-3 font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                      {a.companyCode} · KV {a.areaCode}
                                    </td>
                                    <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">
                                      {a.studentName}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <button
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() =>
                                          handleToggleTopicAssignmentCheck(topic, a, 'participated')
                                        }
                                        className={`w-6 h-6 mx-auto rounded-md border flex items-center justify-center cursor-pointer disabled:opacity-50 ${
                                          part
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                                        }`}
                                      >
                                        {part && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                      </button>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <button
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() =>
                                          handleToggleTopicAssignmentCheck(topic, a, 'completed')
                                        }
                                        className={`w-6 h-6 mx-auto rounded-md border flex items-center justify-center cursor-pointer disabled:opacity-50 ${
                                          comp
                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                                        }`}
                                      >
                                        {comp && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                      </button>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                                      {a.note || '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                      {canEdit && (
                                        <div className="inline-flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => openManualModal({ topic, existing: a })}
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                                            title="Chỉnh sửa"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setConfirmDelete({
                                                title: `Gỡ "${a.studentName}" (KV ${a.areaCode}) khỏi chủ đề này?`,
                                                onConfirm: () => onDeleteAssignment(a.id),
                                              })
                                            }
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                            title="Xóa"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADMIN CREATE / EDIT WEEKLY TOPIC */}
      {isTopicModalOpen && (
        <div
          onClick={() => setIsTopicModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveTopicSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {editingTopicId ? 'Chỉnh sửa Chủ đề Tuần' : 'Tạo Chủ đề Tuần Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTopicModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Level / Nhóm đối tượng
                </label>
                <CustomSelect
                  size="sm"
                  value={tTrack}
                  onChange={(val) => setTTrack(val as EduTrack)}
                  options={EDU_TRACK_ORDER.map((tr) => ({
                    value: tr,
                    label: EDU_TRACK_FULL_LABELS[tr],
                  }))}
                  menuMinWidth={160}
                  ariaLabel="Chọn nhóm đối tượng"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tuần thứ
                </label>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={tWeekNum}
                  onChange={(e) => setTWeekNum(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Năm
                </label>
                <input
                  type="number"
                  min={2024}
                  max={2099}
                  value={tYear}
                  onChange={(e) => setTYear(Number(e.target.value) || defaultWeek.year)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  required
                  value={tStartDate}
                  onChange={(e) => setTStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  required
                  value={tEndDate}
                  onChange={(e) => setTEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phạm vi Sion / Công ty
                </label>
                <CustomSelect
                  size="sm"
                  value={tCompanyCode}
                  onChange={(val) => {
                    setTCompanyCode(val);
                    setTAreaCode('ALL');
                  }}
                  options={[
                    { value: 'ALL', label: 'Toàn hệ thống (Tất cả)' },
                    ...companies.map((c) => ({
                      value: c.code,
                      label: c.name,
                      badge: c.code,
                    })),
                  ]}
                  ariaLabel="Chọn phạm vi Công ty"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phạm vi Khu vực
                </label>
                <CustomSelect
                  size="sm"
                  value={tAreaCode}
                  disabled={tCompanyCode === 'ALL'}
                  onChange={setTAreaCode}
                  options={[
                    { value: 'ALL', label: 'Tất cả KV thuộc Công ty' },
                    ...areas
                      .filter((a) => a.companyCode === tCompanyCode)
                      .map((a) => ({
                        value: a.code,
                        label: `KV ${a.code} — ${a.name}`,
                        badge: a.code,
                      })),
                  ]}
                  ariaLabel="Chọn phạm vi Khu vực"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên Chủ đề <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Bài 04 — Đức tin và Sự cầu nguyện trong đời sống..."
                value={tTitle}
                onChange={(e) => setTTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tóm tắt trọng tâm tuần
              </label>
              <textarea
                rows={2}
                placeholder="Ghi chú ngắn mục đích, yêu cầu thực hành của tuần..."
                value={tSummary}
                onChange={(e) => setTSummary(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nội dung Giáo trình / Bài học nhanh
              </label>
              <textarea
                rows={4}
                placeholder="Nhập dàn ý bài học hoặc nội dung giáo trình..."
                value={tCurriculum}
                onChange={(e) => setTCurriculum(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsTopicModalOpen(false)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingTopic}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingTopic ? 'Đang lưu...' : 'Lưu Chủ đề Tuần'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD / EDIT MANUAL ROW OR TOPIC ASSIGNMENT */}
      {isManualModalOpen && (
        <div
          onClick={() => setIsManualModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveManualSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {editingAssignId ? 'Cập nhật thông tin LMS' : 'Thêm dòng LMS thủ công'}
                </h3>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                  {manualTargetTopic
                    ? `${manualTargetTopic.weekLabel} · ${manualTargetTopic.topicTitle}`
                    : sheetWeekFilter === 'ALL'
                    ? defaultWeek.weekLabel
                    : sheetWeekFilter}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sion / Công ty
                </label>
                <CustomSelect
                  size="sm"
                  disabled={!isAdmin && scopedCompanyOptionsForAssign.length <= 1}
                  value={aCompanyCode}
                  onChange={(nextComp) => {
                    setACompanyCode(nextComp);
                    const allowedAreas = getScopedAreaOptions(currentUser, areas, nextComp, members);
                    if (allowedAreas[0]?.code) setAAreaCode(allowedAreas[0].code);
                  }}
                  options={scopedCompanyOptionsForAssign.map((c) => ({
                    value: c.code,
                    label: c.name,
                    badge: c.code,
                  }))}
                  ariaLabel="Chọn Sion"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Khu vực (KV) <span className="text-rose-500">*</span>
                </label>
                {areaOptionsForAssign.length > 0 ? (
                  <CustomSelect
                    size="sm"
                    disabled={
                      !isAdmin &&
                      currentUser.role !== 'MANAGER' &&
                      currentUser.role !== 'SION_LEADER' &&
                      areaOptionsForAssign.length <= 1
                    }
                    value={aAreaCode}
                    onChange={setAAreaCode}
                    options={areaOptionsForAssign.map((a) => ({
                      value: a.code,
                      label: `KV ${a.code} (${a.name})`,
                      badge: a.code,
                    }))}
                    ariaLabel="Chọn Khu vực"
                  />
                ) : (
                  <input
                    type="text"
                    required
                    disabled={currentUser.role === 'MEMBER' || currentUser.role === 'UNI_LEADER'}
                    value={aAreaCode}
                    onChange={(e) => setAAreaCode(e.target.value)}
                    placeholder="Ví dụ: 1.1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold disabled:opacity-60"
                  />
                )}
              </div>
            </div>

            {memberCandidatesForAssign.length > 0 && !editingAssignId && (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn nhanh từ danh sách thành viên KV {aAreaCode} (tùy chọn)
                </label>
                <CustomSelect
                  size="sm"
                  value={aMemberId}
                  onChange={(id) => {
                    setAMemberId(id);
                    const found = members.find((m) => m.id === id);
                    if (found) setAStudentName(found.fullName);
                  }}
                  options={[
                    { value: '', label: '-- Nhập thủ công hoặc chọn từ danh sách --' },
                    ...memberCandidatesForAssign.map((m) => ({
                      value: m.id,
                      label: m.fullName,
                      badge: m.unitCode || m.departmentCode,
                    })),
                  ]}
                  searchable
                  ariaLabel="Chọn nhanh thành viên"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Name (Họ tên) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập họ tên..."
                  value={aStudentName}
                  onChange={(e) => setAStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Level <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  size="sm"
                  disabled={Boolean(manualTargetTopic)}
                  value={aLevel}
                  onChange={(val) => setALevel(val as EduTrack)}
                  options={EDU_TRACK_ORDER.map((lv) => ({
                    value: lv,
                    label: EDU_TRACK_LABELS[lv],
                  }))}
                  menuMinWidth={140}
                  ariaLabel="Chọn Level"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = !aParticipated;
                  setAParticipated(next);
                  if (!next) setACompleted(false);
                }}
                className={`min-h-[42px] px-3 rounded-xl border font-bold flex items-center justify-between cursor-pointer ${
                  aParticipated
                    ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-200'
                    : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Tham gia</span>
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    aParticipated
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {aParticipated && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !aCompleted;
                  setACompleted(next);
                  if (next) setAParticipated(true);
                }}
                className={`min-h-[42px] px-3 rounded-xl border font-bold flex items-center justify-between cursor-pointer ${
                  aCompleted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200'
                    : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Hoàn thành</span>
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    aCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {aCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </span>
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú
              </label>
              <input
                type="text"
                placeholder="Ghi chú buổi học / giờ học..."
                value={aNote}
                onChange={(e) => setANote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingAssign}
                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingAssign ? 'Đang lưu...' : 'Lưu thông tin'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* IN-APP DELETE CONFIRMATION */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="font-extrabold text-sm text-slate-900 dark:text-white">
              Xác nhận thao tác xóa
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">{confirmDelete.title}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  await confirmDelete.onConfirm();
                  setConfirmDelete(null);
                  onShowNotification('Đã xóa dữ liệu thành công.');
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
