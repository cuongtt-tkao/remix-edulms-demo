import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  GraduationCap,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
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
  EduCurriculumTemplate,
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
  getWeekDateRange,
  isAssignmentCompleted,
  isAssignmentParticipated,
  normalizeEduText,
  parseWeekLabelToIdSuffix,
  shiftWeekLabel,
} from '../utils/eduAnalytics';
import { exportEduLmsTwoSheetsExcel } from '../utils/excelManager';

interface EduLmsPageProps {
  currentUser: UserAccount | null;
  topics: EduWeeklyTopic[];
  assignments: EduTopicAssignment[];
  cmsProfiles?: EduCmsProfile[];
  curriculumTemplates?: EduCurriculumTemplate[];
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
  onSaveCmsProfile?: (profile: Omit<EduCmsProfile, 'id'>, existingId?: string) => Promise<void>;
  onSaveCurriculumTemplate?: (
    template: Omit<EduCurriculumTemplate, 'id'>,
    existingId?: string
  ) => Promise<void>;
  onNavigateToCmsTemplates?: () => void;
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
  curriculumTemplates = [],
  companies,
  areas,
  members,
  isLoading,
  onSaveTopic,
  onDeleteTopic,
  onSaveAssignment,
  onDeleteAssignment,
  onSaveCmsProfile,
  onSaveCurriculumTemplate,
  onNavigateToCmsTemplates,
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
  const [previewTopic, setPreviewTopic] = useState<EduWeeklyTopic | null>(null);

  // Tab 3 (Topics & Curriculum) state
  const [activeTrack, setActiveTrack] = useState<EduTrack>('TD_MOI');
  const [topicWeekFilter, setTopicWeekFilter] = useState<string>('ALL');
  const [expandedLessonIds, setExpandedLessonIds] = useState<Record<string, boolean>>({});

  // Topic & Curriculum Create / Edit Modal (Admin - trọn vẹn ngay tại LMS)
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
  const [tObjectives, setTObjectives] = useState<string>('');
  const [tCurriculum, setTCurriculum] = useState<string>('');
  const [tRefs, setTRefs] = useState<string>('');
  const [tTemplateId, setTTemplateId] = useState<string>('');
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [isSavingTemplateFromTopic, setIsSavingTemplateFromTopic] = useState(false);

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
  const [aCmsProfileId, setACmsProfileId] = useState<string>('');
  const [aStudentName, setAStudentName] = useState<string>('');
  const [aLevel, setALevel] = useState<EduTrack>('TD_MOI');
  const [aParticipated, setAParticipated] = useState<boolean>(true);
  const [aCompleted, setACompleted] = useState<boolean>(false);
  const [aNote, setANote] = useState<string>('');
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // Phương án A + B: Multi-select Thành viên KV & Đồng bộ sang CMS
  const [modalEntryMode, setModalEntryMode] = useState<'MULTI' | 'SINGLE'>('MULTI');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [selectedMembersMap, setSelectedMembersMap] = useState<Record<string, EduTrack>>({});
  const [syncToCmsOnAdd, setSyncToCmsOnAdd] = useState<boolean>(true);

  // Phương án C: Tick nhanh theo KV đang lọc (có hộp xác nhận an toàn)
  const [bulkTickConfirm, setBulkTickConfirm] = useState<{
    field: 'participated' | 'completed';
    areaLabel: string;
    targetRows: LmsManagementRow[];
  } | null>(null);
  const [isBulkTicking, setIsBulkTicking] = useState(false);

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
    if (sheetWeekFilter && sheetWeekFilter !== 'ALL') {
      map.set(sheetWeekFilter, parseSortScore(sheetWeekFilter));
    }
    topics.forEach((t) => {
      if (t.weekLabel) map.set(t.weekLabel, parseSortScore(t.weekLabel));
    });
    assignments.forEach((a) => {
      if (a.weekLabel) map.set(a.weekLabel, parseSortScore(a.weekLabel));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label]) => label);
  }, [topics, assignments, defaultWeek.weekLabel, sheetWeekFilter]);

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

  const sortedTemplatesForModal = useMemo(() => {
    return [...curriculumTemplates].sort((a, b) => {
      const aMatch = a.track === tTrack ? 0 : 1;
      const bMatch = b.track === tTrack ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return (a.lessonCode || a.title).localeCompare(b.lessonCode || b.title, 'vi', {
        numeric: true,
      });
    });
  }, [curriculumTemplates, tTrack]);

  const applyTemplateToTopicDraft = (tplId: string) => {
    setTTemplateId(tplId);
    if (!tplId) return;
    const tpl = curriculumTemplates.find((item) => item.id === tplId);
    if (!tpl) return;
    setTTitle(tpl.title);
    setTSummary(tpl.summary || '');
    setTObjectives(tpl.learningObjectives || '');
    setTCurriculum(tpl.curriculumContent || '');
    setTRefs(tpl.referenceLinks || '');
    onShowNotification(`Đã nạp nội dung từ giáo trình "${tpl.title}".`);
  };

  const openCreateTopic = () => {
    setEditingTopicId(null);
    const activeMatch =
      sheetWeekFilter !== 'ALL' ? sheetWeekFilter.match(/(\d+)\s*\/\s*(\d{4})/) : null;
    const initWeek = activeMatch ? Number(activeMatch[1]) : defaultWeek.week;
    const initYear = activeMatch ? Number(activeMatch[2]) : defaultWeek.year;
    const initRange = getWeekDateRange(initWeek, initYear);

    setTTrack(workspaceTab === 'TOPICS' ? activeTrack : levelFilter !== 'ALL' ? levelFilter : 'TD_MOI');
    setTWeekNum(initWeek);
    setTYear(initYear);
    setTStartDate(initRange.start);
    setTEndDate(initRange.end);
    setTCompanyCode('ALL');
    setTAreaCode('ALL');
    setTTitle('');
    setTSummary('');
    setTObjectives('');
    setTCurriculum('');
    setTRefs('');
    setTTemplateId('');
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
    setTObjectives(topic.learningObjectives || '');
    setTCurriculum(topic.curriculumContent || '');
    setTRefs(topic.referenceLinks || '');
    setTTemplateId(topic.templateId || '');
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
      const safeWeek = Math.max(1, Math.min(53, Number(tWeekNum) || 1));
      const safeYear = Number(tYear) || defaultWeek.year;
      await onSaveTopic(
        {
          weekNumber: safeWeek,
          year: safeYear,
          weekLabel: `Tuần ${String(safeWeek).padStart(2, '0')} / ${safeYear}`,
          startDate: tStartDate,
          endDate: tEndDate,
          track: tTrack,
          companyCode: tCompanyCode,
          areaCode: tCompanyCode === 'ALL' ? 'ALL' : tAreaCode,
          topicTitle: tTitle.trim(),
          summary: tSummary.trim(),
          learningObjectives: tObjectives.trim(),
          curriculumContent: tCurriculum.trim(),
          referenceLinks: tRefs.trim(),
          templateId: tTemplateId || undefined,
          createdBy: existing?.createdBy || currentUser?.fullName || 'Admin',
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        },
        editingTopicId || undefined
      );
      setIsTopicModalOpen(false);
      onShowNotification(
        editingTopicId ? 'Đã cập nhật Chủ đề & Giáo trình!' : 'Đã tạo Chủ đề & Giáo trình tuần mới!'
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu chủ đề: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingTopic(false);
    }
  };

  const handleSaveTopicAsTemplate = async () => {
    if (!onSaveCurriculumTemplate || !isAdmin) return;
    if (!tTitle.trim()) {
      onShowNotification('Vui lòng nhập Tên Chủ đề trước khi lưu vào Kho giáo trình.');
      return;
    }
    setIsSavingTemplateFromTopic(true);
    try {
      const nowIso = new Date().toISOString();
      await onSaveCurriculumTemplate({
        track: tTrack,
        lessonCode: '',
        title: tTitle.trim(),
        summary: tSummary.trim(),
        learningObjectives: tObjectives.trim(),
        curriculumContent: tCurriculum.trim(),
        referenceLinks: tRefs.trim(),
        createdBy: currentUser?.fullName || 'Admin',
        updatedBy: currentUser?.fullName || 'Admin',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      onShowNotification(`Đã lưu "${tTitle.trim()}" vào Kho Giáo trình chuẩn (CMS)!`);
    } catch (err: any) {
      onShowNotification(`Lỗi lưu vào Kho CMS: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingTemplateFromTopic(false);
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
      setACmsProfileId(existing.cmsProfileId || row?.cmsProfileId || '');
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
      setACmsProfileId(row.cmsProfileId || '');
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
      setACmsProfileId('');
      setAStudentName(isMemberOnly ? currentUser.fullName : '');
      setALevel(topic?.track || (levelFilter !== 'ALL' ? levelFilter : 'TD_MOI'));
      setAParticipated(true);
      setACompleted(false);
      setANote('');
    }
    setMemberSearchQuery('');
    setSelectedMembersMap({});
    setSyncToCmsOnAdd(true);
    setModalEntryMode(
      existing || row || currentUser?.role === 'MEMBER' ? 'SINGLE' : 'MULTI'
    );
    setIsManualModalOpen(true);
  };

  const upsertSingleAssignment = async (params: {
    companyCode: string;
    areaCode: string;
    studentName: string;
    level: EduTrack;
    participated: boolean;
    completed: boolean;
    note: string;
    memberId?: string;
    cmsProfileId?: string;
    existing?: EduTopicAssignment | null;
    topicOverride?: EduWeeklyTopic | null;
  }) => {
    if (!currentUser) return;
    const {
      companyCode,
      areaCode,
      studentName,
      level,
      participated: pRaw,
      completed: cRaw,
      note,
      memberId,
      cmsProfileId,
      existing,
      topicOverride,
    } = params;
    const nowIso = new Date().toISOString();
    const { participated, completed, status } = deriveAssignmentStatus(pRaw, cRaw);

    const targetWeekLabel =
      topicOverride?.weekLabel ||
      existing?.weekLabel ||
      (sheetWeekFilter !== 'ALL' ? sheetWeekFilter : defaultWeek.weekLabel);

    const topicMeta = topicOverride
      ? {
          topicId: topicOverride.id,
          weekLabel: topicOverride.weekLabel,
          topicTitle: topicOverride.topicTitle,
        }
      : existing
      ? {
          topicId: existing.topicId,
          weekLabel: existing.weekLabel,
          topicTitle: existing.topicTitle,
        }
      : resolveTopicForTrackAndWeek(level, targetWeekLabel, companyCode, areaCode);

    await onSaveAssignment(
      {
        topicId: topicMeta.topicId,
        track: level,
        weekLabel: topicMeta.weekLabel,
        topicTitle: topicMeta.topicTitle,
        companyCode,
        areaCode: areaCode.trim(),
        memberId: memberId || existing?.memberId || undefined,
        cmsProfileId: cmsProfileId || existing?.cmsProfileId,
        studentName: studentName.trim(),
        assignedByUid: existing?.assignedByUid || currentUser.id,
        assignedByName: existing?.assignedByName || currentUser.fullName,
        status,
        participated,
        completed,
        note: note.trim(),
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      },
      existing?.id
    );
  };

  const syncMissingToCmsIfEnabled = async (
    items: Array<{ fullName: string; companyCode: string; areaCode: string; level: EduTrack; note?: string }>
  ): Promise<number> => {
    if (!syncToCmsOnAdd || !onSaveCmsProfile || !currentUser || currentUser.role === 'MEMBER') {
      return 0;
    }
    const existingKeys = new Set(
      cmsProfiles.map(
        (p) =>
          `${normalizeOrgCode(p.companyCode)}|${normalizeOrgCode(p.areaCode)}|${normalizeEduText(
            p.fullName
          )}`
      )
    );
    const toCreate = items.filter((item) => {
      const k = `${normalizeOrgCode(item.companyCode)}|${normalizeOrgCode(
        item.areaCode
      )}|${normalizeEduText(item.fullName)}`;
      if (existingKeys.has(k)) return false;
      existingKeys.add(k);
      return true;
    });
    if (toCreate.length === 0) return 0;

    const nowIso = new Date().toISOString();
    await Promise.all(
      toCreate.map((item) =>
        onSaveCmsProfile({
          fullName: item.fullName.trim(),
          companyCode: item.companyCode,
          areaCode: item.areaCode.trim(),
          stage: item.level,
          ngvName: '',
          specialty: '',
          note: (item.note || '').trim(),
          ownerUid: currentUser.id,
          updatedBy: currentUser.fullName,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
      )
    );
    return toCreate.length;
  };

  const handleSaveManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Phương án A: Lưu hàng loạt nhiều thành viên đã tích
    if (!editingAssignId && modalEntryMode === 'MULTI' && currentUser.role !== 'MEMBER') {
      const selectedEntries = Object.entries(selectedMembersMap);
      if (selectedEntries.length === 0) {
        onShowNotification('Vui lòng tích chọn ít nhất 1 thành viên trong danh sách.');
        return;
      }
      setIsSavingAssign(true);
      try {
        const chosenMembers = selectedEntries
          .map(([id, lv]) => ({
            member: members.find((m) => m.id === id),
            level: manualTargetTopic ? manualTargetTopic.track : lv,
          }))
          .filter((item): item is { member: Member; level: EduTrack } => Boolean(item.member));

        await Promise.all(
          chosenMembers.map(({ member, level }) =>
            upsertSingleAssignment({
              companyCode: aCompanyCode || member.companyCode,
              areaCode: aAreaCode || member.areaCode || 'Chung',
              studentName: member.fullName,
              level,
              participated: aParticipated,
              completed: aCompleted,
              note: aNote,
              memberId: member.id,
              topicOverride: manualTargetTopic,
            })
          )
        );

        const cmsAddedCount = await syncMissingToCmsIfEnabled(
          chosenMembers.map(({ member, level }) => ({
            fullName: member.fullName,
            companyCode: aCompanyCode || member.companyCode,
            areaCode: aAreaCode || member.areaCode || 'Chung',
            level,
            note: aNote,
          }))
        );

        setIsManualModalOpen(false);
        setManualTargetTopic(null);
        setSelectedMembersMap({});
        onShowNotification(
          `Đã thêm ${chosenMembers.length} thành viên vào LMS${
            cmsAddedCount > 0 ? ` & đồng bộ ${cmsAddedCount} hồ sơ sang CMS` : ''
          }!`
        );
      } catch (err: any) {
        onShowNotification(`Lỗi lưu hàng loạt: ${err?.message || 'Thử lại sau'}`);
      } finally {
        setIsSavingAssign(false);
      }
      return;
    }

    // Nhập tay / Chỉnh sửa 1 dòng
    if (!aAreaCode.trim() || !aStudentName.trim()) {
      onShowNotification('Vui lòng nhập đầy đủ Khu vực (KV) và Họ tên (Name).');
      return;
    }

    setIsSavingAssign(true);
    try {
      const existing = editingAssignId
        ? assignments.find((a) => a.id === editingAssignId)
        : null;

      await upsertSingleAssignment({
        companyCode: aCompanyCode,
        areaCode: aAreaCode,
        studentName: aStudentName,
        level: aLevel,
        participated: aParticipated,
        completed: aCompleted,
        note: aNote,
        memberId: aMemberId || undefined,
        cmsProfileId: aCmsProfileId || existing?.cmsProfileId,
        existing,
        topicOverride: manualTargetTopic,
      });

      // Nếu dòng đang liên kết với CMS và quản lý đổi Level -> đồng bộ sang CMS để không tách thành 2 dòng
      if (aCmsProfileId && onSaveCmsProfile && currentUser.role !== 'MEMBER') {
        const linkedCms = cmsProfiles.find((p) => p.id === aCmsProfileId);
        if (
          linkedCms &&
          linkedCms.stage !== aLevel &&
          canModifyEduRecord(currentUser, linkedCms)
        ) {
          await onSaveCmsProfile(
            {
              fullName: linkedCms.fullName,
              companyCode: linkedCms.companyCode,
              areaCode: linkedCms.areaCode,
              stage: aLevel,
              ngvName: linkedCms.ngvName,
              specialty: linkedCms.specialty,
              currentTopicId: linkedCms.currentTopicId,
              currentTopicTitle: linkedCms.currentTopicTitle,
              note: linkedCms.note,
              ownerUid: linkedCms.ownerUid,
              updatedBy: currentUser.fullName,
              createdAt: linkedCms.createdAt,
              updatedAt: new Date().toISOString(),
            },
            linkedCms.id
          );
        }
      }

      const cmsAddedCount = !editingAssignId && !aCmsProfileId
        ? await syncMissingToCmsIfEnabled([
            {
              fullName: aStudentName,
              companyCode: aCompanyCode,
              areaCode: aAreaCode,
              level: aLevel,
              note: aNote,
            },
          ])
        : 0;

      setIsManualModalOpen(false);
      setManualTargetTopic(null);
      onShowNotification(
        editingAssignId || aCmsProfileId
          ? 'Đã cập nhật thông tin LMS!'
          : `Đã thêm dòng dữ liệu LMS mới${cmsAddedCount > 0 ? ' & đồng bộ sang CMS' : ''}!`
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu dữ liệu: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingAssign(false);
    }
  };

  const handleBulkTickConfirmSubmit = async () => {
    if (!bulkTickConfirm || !currentUser) return;
    const { field, areaLabel, targetRows } = bulkTickConfirm;
    if (targetRows.length === 0) {
      setBulkTickConfirm(null);
      return;
    }
    setIsBulkTicking(true);
    try {
      await Promise.all(
        targetRows.map((row) =>
          upsertSingleAssignment({
            companyCode:
              row.assignment?.companyCode || row.companyCode || currentUser.companyCode || 'HT',
            areaCode: row.assignment?.areaCode || row.areaCode || currentUser.areaCode || 'Chung',
            studentName: row.assignment?.studentName || row.name,
            level: row.level,
            participated: field === 'participated' ? true : true,
            completed: field === 'completed' ? true : row.completed,
            note: row.assignment?.note || '',
            memberId: row.assignment?.memberId,
            cmsProfileId: row.assignment?.cmsProfileId || row.cmsProfileId,
            existing: row.assignment || null,
          })
        )
      );
      setBulkTickConfirm(null);
      onShowNotification(
        `Đã tick nhanh ${field === 'participated' ? 'Tham gia' : 'Hoàn thành'} cho ${
          targetRows.length
        } nhân sự (${areaLabel})!`
      );
    } catch (err: any) {
      onShowNotification(`Lỗi tick nhanh hàng loạt: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsBulkTicking(false);
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
      members
        .filter(
          (m) =>
            canViewMemberDetail(currentUser, m) &&
            (!aCompanyCode || normalizeOrgCode(m.companyCode) === normalizeOrgCode(aCompanyCode)) &&
            (!aAreaCode || normalizeOrgCode(m.areaCode) === normalizeOrgCode(aAreaCode))
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    [members, currentUser, aCompanyCode, aAreaCode]
  );

  // Tập nhân sự đã tồn tại trong Tuần / Chủ đề đang thao tác (để chống trùng khi chọn nhiều)
  const existingKeysInModalScope = useMemo(() => {
    const keys = new Set<string>();
    const memberIds = new Set<string>();
    const existingLevelMap = new Map<string, EduTrack>();

    if (manualTargetTopic) {
      assignments
        .filter((a) => a.topicId === manualTargetTopic.id)
        .forEach((a) => {
          const k = `${normalizeOrgCode(a.companyCode)}|${normalizeOrgCode(
            a.areaCode
          )}|${normalizeEduText(a.studentName)}`;
          keys.add(k);
          existingLevelMap.set(k, a.track);
          if (a.memberId) memberIds.add(a.memberId);
        });
    } else {
      const allRowsForWeek = buildLmsManagementRows({
        viewer: currentUser,
        cmsProfiles,
        assignments,
        topics,
        filters: { weekFilter: sheetWeekFilter },
      });
      allRowsForWeek.forEach((r) => {
        const k = `${normalizeOrgCode(r.companyCode)}|${normalizeOrgCode(
          r.areaCode
        )}|${normalizeEduText(r.name)}`;
        keys.add(k);
        existingLevelMap.set(k, r.level);
        if (r.assignment?.memberId) memberIds.add(r.assignment.memberId);
      });
    }
    return { keys, memberIds, existingLevelMap };
  }, [manualTargetTopic, assignments, currentUser, cmsProfiles, topics, sheetWeekFilter]);

  const filteredModalMemberCandidates = useMemo(() => {
    const q = normalizeEduText(memberSearchQuery);
    return memberCandidatesForAssign.filter((m) => {
      if (!q) return true;
      return (
        normalizeEduText(m.fullName).includes(q) ||
        normalizeEduText(m.unitCode).includes(q) ||
        normalizeEduText(m.departmentCode).includes(q)
      );
    });
  }, [memberCandidatesForAssign, memberSearchQuery]);

  // Phương án C: Kiểm tra bảng Sheet 1 có đang lọc trên 1 KV cụ thể không
  const areaFocusInfo = useMemo(() => {
    const distinctKeys = new Set<string>();
    managementRows.forEach((r) => {
      distinctKeys.add(`${normalizeOrgCode(r.companyCode)}|${normalizeOrgCode(r.areaCode)}`);
    });
    const isSingleAreaFocused =
      managementRows.length > 0 && (areaFilter !== 'ALL' || distinctKeys.size === 1);

    const firstRow = managementRows[0];
    const areaLabel =
      areaFilter !== 'ALL'
        ? `${companyFilter !== 'ALL' ? `${companyFilter} · ` : ''}KV ${areaFilter}`
        : firstRow
        ? `${firstRow.companyCode ? `${firstRow.companyCode} · ` : ''}KV ${firstRow.areaCode || '—'}`
        : 'KV đang lọc';

    const editableUnparticipated = managementRows.filter(
      (r) => canModifyRow(r) && !r.participated
    );
    const editableUncompleted = managementRows.filter(
      (r) => canModifyRow(r) && !r.completed
    );

    return {
      isSingleAreaFocused,
      areaLabel,
      editableUnparticipated,
      editableUncompleted,
    };
  }, [managementRows, areaFilter, companyFilter, currentUser, isAdmin]);

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

            <div className="col-span-1 sm:col-span-3 flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setSheetWeekFilter((prev) =>
                    prev === 'ALL' ? defaultWeek.weekLabel : shiftWeekLabel(prev, -1)
                  )
                }
                title="Tuần trước"
                aria-label="Chuyển sang tuần trước"
                className="w-8 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
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
              <button
                type="button"
                onClick={() =>
                  setSheetWeekFilter((prev) =>
                    prev === 'ALL' ? defaultWeek.weekLabel : shiftWeekLabel(prev, 1)
                  )
                }
                title="Tuần sau"
                aria-label="Chuyển sang tuần sau"
                className="w-8 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
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
                {sheetWeekFilter === 'ALL' ? 'Tổng hợp theo đầu người (các tuần)' : sheetWeekFilter}
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

              {/* Phương án C: Tick nhanh theo KV đang lọc (chỉ mở khóa khi đang lọc 1 KV cụ thể) */}
              {currentUser.role !== 'MEMBER' && managementRows.length > 0 && (
                areaFocusInfo.isSingleAreaFocused ? (
                  <>
                    <button
                      type="button"
                      disabled={areaFocusInfo.editableUnparticipated.length === 0}
                      onClick={() =>
                        setBulkTickConfirm({
                          field: 'participated',
                          areaLabel: areaFocusInfo.areaLabel,
                          targetRows: areaFocusInfo.editableUnparticipated,
                        })
                      }
                      className="px-3 h-9 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
                      title={`Đánh dấu Tham gia cho các nhân sự chưa tick thuộc ${areaFocusInfo.areaLabel}`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>
                        Tick Tham gia ({areaFocusInfo.editableUnparticipated.length})
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={areaFocusInfo.editableUncompleted.length === 0}
                      onClick={() =>
                        setBulkTickConfirm({
                          field: 'completed',
                          areaLabel: areaFocusInfo.areaLabel,
                          targetRows: areaFocusInfo.editableUncompleted,
                        })
                      }
                      className="px-3 h-9 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
                      title={`Đánh dấu Hoàn thành cho các nhân sự chưa tick thuộc ${areaFocusInfo.areaLabel}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Tick Hoàn thành ({areaFocusInfo.editableUncompleted.length})
                      </span>
                    </button>
                  </>
                ) : (
                  <span className="px-3 h-9 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[11px] font-semibold inline-flex items-center whitespace-nowrap">
                    Chọn 1 KV để tick nhanh
                  </span>
                )
              )}

              <button
                type="button"
                onClick={() => openManualModal()}
                className="px-3.5 h-9 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {currentUser.role === 'MEMBER' ? 'Tự đăng ký' : 'Thêm thành viên'}
                </span>
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
                      onClick={() => setPreviewTopic(t)}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openEditTopic(topic)}
                                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Sửa Chủ đề &amp; Giáo trình</span>
                              </button>
                              {onNavigateToCmsTemplates && (
                                <button
                                  type="button"
                                  onClick={onNavigateToCmsTemplates}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 hover:bg-slate-50 cursor-pointer"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Kho Giáo trình CMS</span>
                                </button>
                              )}
                            </div>
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
                            {isAdmin && ' Bấm "Sửa Chủ đề & Giáo trình" để biên soạn hoặc nạp từ Kho CMS.'}
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

      {/* MODAL: ADMIN CREATE / EDIT WEEKLY TOPIC & FULL CURRICULUM */}
      {isTopicModalOpen && (
        <div
          onClick={() => setIsTopicModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveTopicSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {editingTopicId
                    ? 'Chỉnh sửa Chủ đề & Giáo trình Tuần'
                    : 'Tạo Chủ đề & Soạn Giáo trình Tuần'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Biên soạn đầy đủ chủ đề, mục tiêu và bài học ngay tại LMS hoặc nạp nhanh từ Kho Giáo trình CMS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTopicModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nạp nhanh từ Kho Giáo trình chuẩn (CMS) */}
            {curriculumTemplates.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Nạp nhanh từ Kho Giáo trình chuẩn (CMS)</span>
                  </label>
                  {onNavigateToCmsTemplates && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTopicModalOpen(false);
                        onNavigateToCmsTemplates();
                      }}
                      className="text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                    >
                      Quản lý kho CMS →
                    </button>
                  )}
                </div>
                <CustomSelect
                  size="sm"
                  value={tTemplateId}
                  onChange={applyTemplateToTopicDraft}
                  options={[
                    { value: '', label: '-- Tự soạn hoặc chọn 1 bài học mẫu từ Kho CMS --' },
                    ...sortedTemplatesForModal.map((tpl) => ({
                      value: tpl.id,
                      label: tpl.lessonCode ? `${tpl.lessonCode} · ${tpl.title}` : tpl.title,
                      badge: EDU_TRACK_LABELS[tpl.track],
                    })),
                  ]}
                  searchable
                  ariaLabel="Nạp từ Kho Giáo trình CMS"
                />
              </div>
            )}

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
                  onChange={(e) => {
                    const nextW = Math.max(1, Math.min(53, Number(e.target.value) || 1));
                    setTWeekNum(nextW);
                    if (!editingTopicId) {
                      const r = getWeekDateRange(nextW, tYear);
                      setTStartDate(r.start);
                      setTEndDate(r.end);
                    }
                  }}
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
                  onChange={(e) => {
                    const nextY = Number(e.target.value) || defaultWeek.year;
                    setTYear(nextY);
                    if (!editingTopicId && nextY >= 2020 && nextY <= 2100) {
                      const r = getWeekDateRange(tWeekNum, nextY);
                      setTStartDate(r.start);
                      setTEndDate(r.end);
                    }
                  }}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tóm tắt trọng tâm tuần
                </label>
                <textarea
                  rows={3}
                  placeholder="Ý chính của buổi học..."
                  value={tSummary}
                  onChange={(e) => setTSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mục tiêu học tập &amp; thực hành
                </label>
                <textarea
                  rows={3}
                  placeholder="Sau bài học, TĐ nắm vững điều gì..."
                  value={tObjectives}
                  onChange={(e) => setTObjectives(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                <span>Nội dung Giáo trình / Bài học chi tiết</span>
              </label>
              <textarea
                rows={8}
                placeholder="I. Lời dẫn nhập&#10;II. Nội dung trọng tâm & Kinh Thánh nền tảng&#10;III. Câu hỏi thảo luận & Thực hành trong tuần..."
                value={tCurriculum}
                onChange={(e) => setTCurriculum(e.target.value)}
                className="w-full px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 leading-relaxed text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tài liệu / Link tham khảo (tùy chọn)
              </label>
              <input
                type="text"
                placeholder="Link slide, video hoặc tên sách tham khảo..."
                value={tRefs}
                onChange={(e) => setTRefs(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                {onSaveCurriculumTemplate && isAdmin && (
                  <button
                    type="button"
                    disabled={isSavingTemplateFromTopic || !tTitle.trim()}
                    onClick={handleSaveTopicAsTemplate}
                    className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>
                      {isSavingTemplateFromTopic
                        ? 'Đang lưu mẫu...'
                        : 'Lưu thành mẫu vào Kho CMS'}
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
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
                  <span>{isSavingTopic ? 'Đang lưu...' : 'Lưu Chủ đề & Giáo trình'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD / EDIT MANUAL ROW OR TOPIC ASSIGNMENT (PHƯƠNG ÁN A + B) */}
      {isManualModalOpen && (
        <div
          onClick={() => setIsManualModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveManualSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {editingAssignId
                    ? 'Cập nhật thông tin LMS'
                    : modalEntryMode === 'MULTI'
                    ? 'Chọn nhiều thành viên thêm vào LMS'
                    : 'Thêm dòng LMS thủ công'}
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

            {/* Mode Switcher when Adding as Manager */}
            {!editingAssignId && currentUser.role !== 'MEMBER' && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setModalEntryMode('MULTI')}
                  className={`h-8.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    modalEntryMode === 'MULTI'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Chọn nhiều từ Thành viên ({memberCandidatesForAssign.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalEntryMode('SINGLE')}
                  className={`h-8.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    modalEntryMode === 'SINGLE'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Nhập tên thủ công (1 dòng)
                </button>
              </div>
            )}

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
                    setSelectedMembersMap({});
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
                    onChange={(nextArea) => {
                      setAAreaCode(nextArea);
                      setSelectedMembersMap({});
                    }}
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

            {/* PHƯƠNG ÁN A: MULTI-SELECT CHECKLIST */}
            {!editingAssignId && modalEntryMode === 'MULTI' && currentUser.role !== 'MEMBER' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-6 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={`Tìm thành viên KV ${aAreaCode}...`}
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-6 flex items-center gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        size="sm"
                        disabled={Boolean(manualTargetTopic)}
                        value={aLevel}
                        onChange={(val) => {
                          const nextLv = val as EduTrack;
                          setALevel(nextLv);
                          setSelectedMembersMap((prev) => {
                            const updated: Record<string, EduTrack> = {};
                            Object.keys(prev).forEach((k) => {
                              updated[k] = nextLv;
                            });
                            return updated;
                          });
                        }}
                        options={EDU_TRACK_ORDER.map((lv) => ({
                          value: lv,
                          label: `Level chung: ${EDU_TRACK_LABELS[lv]}`,
                        }))}
                        menuMinWidth={160}
                        ariaLabel="Level chung cho nhóm đang chọn"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Select / Clear Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    Đã chọn:{' '}
                    <strong className="text-blue-700 dark:text-blue-300">
                      {Object.keys(selectedMembersMap).length}
                    </strong>{' '}
                    / {filteredModalMemberCandidates.length} thành viên hiển thị
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next: Record<string, EduTrack> = { ...selectedMembersMap };
                        filteredModalMemberCandidates.forEach((m) => {
                          const k = `${normalizeOrgCode(
                            aCompanyCode || m.companyCode
                          )}|${normalizeOrgCode(aAreaCode || m.areaCode)}|${normalizeEduText(
                            m.fullName
                          )}`;
                          const alreadyExists =
                            existingKeysInModalScope.keys.has(k) ||
                            existingKeysInModalScope.memberIds.has(m.id);
                          if (!alreadyExists) {
                            next[m.id] = manualTargetTopic ? manualTargetTopic.track : aLevel;
                          }
                        });
                        setSelectedMembersMap(next);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 cursor-pointer"
                    >
                      Chọn tất cả chưa có
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMembersMap({})}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Scrollable Checklist */}
                <div className="max-h-[250px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredModalMemberCandidates.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                      Không tìm thấy thành viên nào thuộc KV {aAreaCode}. Bạn có thể chuyển sang tab{' '}
                      <strong>Nhập tên thủ công</strong> ở trên.
                    </div>
                  ) : (
                    filteredModalMemberCandidates.map((m) => {
                      const k = `${normalizeOrgCode(
                        aCompanyCode || m.companyCode
                      )}|${normalizeOrgCode(aAreaCode || m.areaCode)}|${normalizeEduText(
                        m.fullName
                      )}`;
                      const alreadyExists =
                        existingKeysInModalScope.keys.has(k) ||
                        existingKeysInModalScope.memberIds.has(m.id);
                      const existingLv = existingKeysInModalScope.existingLevelMap.get(k);
                      const isChecked = Object.prototype.hasOwnProperty.call(
                        selectedMembersMap,
                        m.id
                      );
                      const memberLv =
                        selectedMembersMap[m.id] ||
                        (manualTargetTopic ? manualTargetTopic.track : aLevel);

                      return (
                        <div
                          key={m.id}
                          className={`px-3 py-2.5 flex items-center justify-between gap-2 transition ${
                            alreadyExists
                              ? 'bg-slate-50/80 dark:bg-slate-800/30 opacity-65'
                              : isChecked
                              ? 'bg-blue-50/50 dark:bg-blue-950/25'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={alreadyExists}
                            onClick={() => {
                              setSelectedMembersMap((prev) => {
                                const next = { ...prev };
                                if (Object.prototype.hasOwnProperty.call(next, m.id)) {
                                  delete next[m.id];
                                } else {
                                  next[m.id] = manualTargetTopic
                                    ? manualTargetTopic.track
                                    : aLevel;
                                }
                                return next;
                              });
                            }}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer disabled:cursor-not-allowed"
                          >
                            <span
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                alreadyExists
                                  ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-500'
                                  : isChecked
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {(alreadyExists || isChecked) && (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {m.fullName}
                              </div>
                              {(m.unitCode || m.departmentCode) && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Đội / Tổ: {m.unitCode || m.departmentCode}
                                </div>
                              )}
                            </div>
                          </button>

                          {alreadyExists ? (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
                              Đã có{existingLv ? ` · ${EDU_TRACK_LABELS[existingLv]}` : ''}
                            </span>
                          ) : isChecked && !manualTargetTopic ? (
                            <div className="inline-flex items-center gap-1 shrink-0">
                              {EDU_TRACK_ORDER.map((lv) => (
                                <button
                                  key={lv}
                                  type="button"
                                  onClick={() =>
                                    setSelectedMembersMap((prev) => ({
                                      ...prev,
                                      [m.id]: lv,
                                    }))
                                  }
                                  className={`px-2 py-1 rounded-md text-[10px] font-extrabold border transition cursor-pointer ${
                                    memberLv === lv
                                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {EDU_TRACK_LABELS[lv]}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* SINGLE / MANUAL ROW MODE */
              <>
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
              </>
            )}

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

            {/* PHƯƠNG ÁN B: TỰ ĐỘNG ĐỒNG BỘ SANG CMS ĐỂ TUẦN SAU TỰ HIỆN SẴN */}
            {!editingAssignId && currentUser.role !== 'MEMBER' && onSaveCmsProfile && (
              <button
                type="button"
                onClick={() => setSyncToCmsOnAdd((v) => !v)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    Tự động lưu hồ sơ sang CMS (nếu chưa có)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Từ tuần sau danh sách sẽ tự động nạp sẵn trên Sheet 1, không cần chọn lại.
                  </div>
                </div>
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    syncToCmsOnAdd
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {syncToCmsOnAdd && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </span>
              </button>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú {modalEntryMode === 'MULTI' && !editingAssignId ? '(áp dụng chung)' : ''}
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
                disabled={
                  isSavingAssign ||
                  (!editingAssignId &&
                    modalEntryMode === 'MULTI' &&
                    currentUser.role !== 'MEMBER' &&
                    Object.keys(selectedMembersMap).length === 0)
                }
                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSavingAssign
                    ? 'Đang lưu...'
                    : !editingAssignId &&
                      modalEntryMode === 'MULTI' &&
                      currentUser.role !== 'MEMBER'
                    ? `Thêm ${Object.keys(selectedMembersMap).length} thành viên`
                    : 'Lưu thông tin'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PHƯƠNG ÁN C: HỘP XÁC NHẬN AN TOÀN KHI TICK NHANH THEO KV */}
      {bulkTickConfirm && (
        <div
          onClick={() => !isBulkTicking && setBulkTickConfirm(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
          >
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Xác nhận tick nhanh hàng loạt
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Bạn sắp đánh dấu{' '}
                <strong
                  className={
                    bulkTickConfirm.field === 'completed'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-blue-700 dark:text-blue-300'
                  }
                >
                  {bulkTickConfirm.field === 'participated'
                    ? 'Đã Tham gia (✓)'
                    : 'Đã Hoàn thành (✓ kèm Tham gia ✓)'}
                </strong>{' '}
                cho <strong>{bulkTickConfirm.targetRows.length}</strong> nhân sự thuộc{' '}
                <strong>{bulkTickConfirm.areaLabel}</strong> (
                {sheetWeekFilter === 'ALL' ? defaultWeek.weekLabel : sheetWeekFilter}).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="font-bold text-slate-700 dark:text-slate-200">
                Danh sách áp dụng ({bulkTickConfirm.targetRows.length} người):
              </div>
              <div className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {bulkTickConfirm.targetRows
                  .slice(0, 6)
                  .map((r) => `${r.name} (${EDU_TRACK_LABELS[r.level]})`)
                  .join(', ')}
                {bulkTickConfirm.targetRows.length > 6 &&
                  ` và ${bulkTickConfirm.targetRows.length - 6} người khác...`}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isBulkTicking}
                onClick={() => setBulkTickConfirm(null)}
                className="px-3.5 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isBulkTicking}
                onClick={handleBulkTickConfirmSubmit}
                className={`px-4 py-2 rounded-xl font-extrabold text-white cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5 ${
                  bulkTickConfirm.field === 'completed'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isBulkTicking
                    ? 'Đang cập nhật...'
                    : `Xác nhận tick (${bulkTickConfirm.targetRows.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CURRICULUM READER MODAL (XEM NHANH TẠI SHEET 1) */}
      {previewTopic && (
        <div
          onClick={() => setPreviewTopic(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  {EDU_TRACK_LABELS[previewTopic.track]} · {previewTopic.weekLabel}
                </div>
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white mt-0.5">
                  {previewTopic.topicTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTopic(null)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewTopic.summary && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 leading-relaxed">
                <div className="font-bold text-slate-900 dark:text-white mb-1">Tóm tắt tuần:</div>
                {previewTopic.summary}
              </div>
            )}

            {previewTopic.learningObjectives && (
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                <div className="font-bold text-amber-900 dark:text-amber-200 mb-1">
                  Mục tiêu học tập &amp; thực hành:
                </div>
                {previewTopic.learningObjectives}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
              {previewTopic.curriculumContent?.trim()
                ? previewTopic.curriculumContent
                : 'Chủ đề này chưa có nội dung giáo trình chi tiết.'}
            </div>

            {previewTopic.referenceLinks && (
              <div className="text-[11px] text-slate-600 dark:text-slate-300 break-all">
                <strong>Tài liệu tham khảo:</strong> {previewTopic.referenceLinks}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const target = previewTopic;
                    setPreviewTopic(null);
                    openEditTopic(target);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Sửa giáo trình này</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const target = previewTopic;
                  setPreviewTopic(null);
                  setActiveTrack(target.track);
                  setTopicWeekFilter(target.weekLabel);
                  setExpandedLessonIds((prev) => ({ ...prev, [target.id]: true }));
                  setWorkspaceTab('TOPICS');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
              >
                Mở tab Chủ đề
              </button>
              <button
                type="button"
                onClick={() => setPreviewTopic(null)}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
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
