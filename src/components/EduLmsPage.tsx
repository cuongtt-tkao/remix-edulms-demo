import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  BookOpen,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Lock,
  ExternalLink,
} from 'lucide-react';
import {
  EduTrack,
  EDU_TRACK_LABELS,
  EduWeeklyTopic,
  EduTopicAssignment,
  EduAssignmentStatus,
  EDU_ASSIGNMENT_STATUS_LABELS,
  UserAccount,
  Company,
  Area,
  Member,
} from '../types/edulms';
import { CustomSelect } from './CustomSelect';
import { canModifyEduRecord, isAdminRole } from '../utils/rbac';

interface EduLmsPageProps {
  currentUser: UserAccount | null;
  topics: EduWeeklyTopic[];
  assignments: EduTopicAssignment[];
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

const getISOWeekInfo = (date: Date = new Date()): { week: number; year: number } => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
};

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

export const EduLmsPage: React.FC<EduLmsPageProps> = ({
  currentUser,
  topics,
  assignments,
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
  const [activeTrack, setActiveTrack] = useState<EduTrack>('TD_I');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [weekFilter, setWeekFilter] = useState<string>('ALL');
  const [expandedLessonIds, setExpandedLessonIds] = useState<Record<string, boolean>>({});

  // Topic Create / Edit Modal (Admin)
  const defaultWeek = useMemo(() => getISOWeekInfo(), []);
  const defaultDates = useMemo(() => getDefaultWeekDates(), []);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [tTrack, setTTrack] = useState<EduTrack>('TD_I');
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

  // Assignment Modal (Admin / KV / Thành viên gán Tên KV + Tên TĐ)
  const [assignTargetTopic, setAssignTargetTopic] = useState<EduWeeklyTopic | null>(null);
  const [editingAssignId, setEditingAssignId] = useState<string | null>(null);
  const [aCompanyCode, setACompanyCode] = useState<string>(
    currentUser?.companyCode || companies[0]?.code || 'Th1'
  );
  const [aAreaCode, setAAreaCode] = useState<string>(
    currentUser?.areaCode || areas[0]?.code || '1.1'
  );
  const [aMemberId, setAMemberId] = useState<string>('');
  const [aStudentName, setAStudentName] = useState<string>('');
  const [aStatus, setAStatus] = useState<EduAssignmentStatus>('REGISTERED');
  const [aNote, setANote] = useState<string>('');
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // In-app delete confirm modal
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const trackCounts = useMemo(() => {
    return {
      TD_I: topics.filter((t) => t.track === 'TD_I').length,
      TD_II: topics.filter((t) => t.track === 'TD_II').length,
      NGV: topics.filter((t) => t.track === 'NGV').length,
    };
  }, [topics]);

  const weekOptions = useMemo(() => {
    const set = new Set<string>();
    topics
      .filter((t) => t.track === activeTrack)
      .forEach((t) => set.add(t.weekLabel));
    return Array.from(set);
  }, [topics, activeTrack]);

  const filteredTopics = useMemo(() => {
    return topics
      .filter((t) => t.track === activeTrack)
      .filter((t) => {
        if (weekFilter !== 'ALL' && t.weekLabel !== weekFilter) return false;
        if (companyFilter !== 'ALL' && t.companyCode !== 'ALL' && t.companyCode !== companyFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchingAssigns = assignments.some(
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
  }, [topics, assignments, activeTrack, weekFilter, companyFilter, searchQuery]);

  const canModifyAssignment = (a: EduTopicAssignment): boolean =>
    canModifyEduRecord(currentUser, a);

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

  const openAssignModal = (topic: EduWeeklyTopic, existing?: EduTopicAssignment) => {
    setAssignTargetTopic(topic);
    if (existing) {
      setEditingAssignId(existing.id);
      setACompanyCode(existing.companyCode);
      setAAreaCode(existing.areaCode);
      setAMemberId(existing.memberId || '');
      setAStudentName(existing.studentName);
      setAStatus(existing.status);
      setANote(existing.note || '');
    } else {
      setEditingAssignId(null);
      const defComp =
        topic.companyCode !== 'ALL'
          ? topic.companyCode
          : currentUser?.companyCode || companies[0]?.code || 'Th1';
      const defArea =
        topic.areaCode !== 'ALL'
          ? topic.areaCode
          : currentUser?.areaCode ||
            areas.find((a) => a.companyCode === defComp)?.code ||
            areas[0]?.code ||
            '1.1';
      setACompanyCode(defComp);
      setAAreaCode(defArea);
      setAMemberId('');
      setAStudentName(currentUser?.role === 'MEMBER' ? currentUser.fullName : '');
      setAStatus('REGISTERED');
      setANote('');
    }
  };

  const handleSaveAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetTopic || !currentUser) return;
    if (!aAreaCode.trim() || !aStudentName.trim()) {
      onShowNotification('Vui lòng nhập đầy đủ Tên KV và Tên TĐ.');
      return;
    }
    setIsSavingAssign(true);
    try {
      const existing = editingAssignId
        ? assignments.find((a) => a.id === editingAssignId)
        : null;
      const nowIso = new Date().toISOString();
      await onSaveAssignment(
        {
          topicId: assignTargetTopic.id,
          track: assignTargetTopic.track,
          weekLabel: assignTargetTopic.weekLabel,
          topicTitle: assignTargetTopic.topicTitle,
          companyCode: aCompanyCode,
          areaCode: aAreaCode.trim(),
          memberId: aMemberId || undefined,
          studentName: aStudentName.trim(),
          assignedByUid: existing?.assignedByUid || currentUser.id,
          assignedByName: existing?.assignedByName || currentUser.fullName,
          status: aStatus,
          note: aNote.trim(),
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        },
        editingAssignId || undefined
      );
      setAssignTargetTopic(null);
      onShowNotification(
        editingAssignId ? 'Đã cập nhật thông tin gán TĐ!' : 'Đã gán Tên KV & Tên TĐ vào Chủ đề tuần!'
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu thông tin gán: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingAssign(false);
    }
  };

  const handleQuickStatusChange = async (
    topic: EduWeeklyTopic,
    assign: EduTopicAssignment,
    nextStatus: EduAssignmentStatus
  ) => {
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
          studentName: assign.studentName,
          assignedByUid: assign.assignedByUid,
          assignedByName: assign.assignedByName,
          status: nextStatus,
          note: assign.note,
          createdAt: assign.createdAt,
          updatedAt: new Date().toISOString(),
        },
        assign.id
      );
      onShowNotification(`Đã cập nhật trạng thái của "${assign.studentName}".`);
    } catch (err: any) {
      onShowNotification(`Lỗi cập nhật trạng thái: ${err?.message || 'Thử lại sau'}`);
    }
  };

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
          Xem chủ đề đào tạo theo tuần (TĐ-I, TĐ-II, NGV), đọc giáo trình bài học và gán Tên KV + Tên TĐ.
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

  const areaOptionsForAssign = areas.filter((a) => a.companyCode === aCompanyCode);
  const memberCandidatesForAssign = members.filter(
    (m) =>
      (!aCompanyCode || m.companyCode === aCompanyCode) &&
      (!aAreaCode || m.areaCode === aAreaCode)
  );

  return (
    <div className="space-y-5">
      {/* Header & Track Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Edu LMS — Chủ đề theo Tuần &amp; Thực hành</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Phân theo 3 đối tượng <strong>TĐ-I</strong>, <strong>TĐ-II</strong>, <strong>NGV</strong> • Chọn chủ đề tuần để xem giáo trình và gán <strong>Tên KV + Tên TĐ</strong>.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateTopic}
              className="px-4 py-2.5 min-h-[42px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Chủ đề Tuần</span>
            </button>
          )}
        </div>

        {/* 3 User Track Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
          {(['TD_I', 'TD_II', 'NGV'] as EduTrack[]).map((tr) => {
            const active = activeTrack === tr;
            return (
              <button
                key={tr}
                type="button"
                onClick={() => {
                  setActiveTrack(tr);
                  setWeekFilter('ALL');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{EDU_TRACK_LABELS[tr]}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {trackCounts[tr]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm Tên Chủ đề, Tên KV, Tên TĐ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-4">
            <CustomSelect
              size="sm"
              value={weekFilter}
              onChange={setWeekFilter}
              options={[
                { value: 'ALL', label: 'Tất cả các Tuần' },
                ...weekOptions.map((w) => ({ value: w, label: w })),
              ]}
              ariaLabel="Lọc theo Tuần"
            />
          </div>

          <div className="sm:col-span-3">
            <CustomSelect
              size="sm"
              value={companyFilter}
              onChange={setCompanyFilter}
              options={[
                { value: 'ALL', label: 'Tất cả Sion / Công ty' },
                ...companies.map((c) => ({
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

      {/* Topic List */}
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
                ? 'Admin hãy tạo Chủ đề tuần mới để các Khu vực và Thành viên gán Tên KV + Tên TĐ vào học.'
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
        <div className="space-y-5">
          {filteredTopics.map((topic) => {
            const topicAssigns = assignments.filter((a) => a.topicId === topic.id);
            const isLessonOpen = !!expandedLessonIds[topic.id];
            const hasLesson = Boolean(topic.curriculumContent?.trim());

            return (
              <div
                key={topic.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs"
              >
                {/* Topic Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black border border-emerald-200/70 dark:border-emerald-800/60">
                        {EDU_TRACK_LABELS[topic.track]}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3 h-3" />
                        {topic.weekLabel}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px] tabular-nums">
                        ({topic.startDate.split('-').reverse().join('/')} –{' '}
                        {topic.endDate.split('-').reverse().join('/')})
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {topic.companyCode === 'ALL'
                          ? 'Toàn hệ thống'
                          : topic.areaCode === 'ALL'
                          ? `${topic.companyCode} • Tất cả KV`
                          : `${topic.companyCode} • KV ${topic.areaCode}`}
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
                        setExpandedLessonIds((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))
                      }
                      className={`px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
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
                      onClick={() => openAssignModal(topic)}
                      className="px-3.5 py-2 min-h-[38px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Gán Tên KV &amp; TĐ</span>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditTopic(topic)}
                          className="p-2 min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-slate-600 dark:text-slate-300 hover:text-blue-700 transition cursor-pointer"
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
                          className="p-2 min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer"
                          title="Xóa Chủ đề tuần"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable Curriculum / Lesson Viewer */}
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

                {/* Assigned Roster Table: Tên KV | Tên TĐ | Tên Chủ đề */}
                <div className="p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Danh sách KV &amp; TĐ đã gán ({topicAssigns.length})</span>
                    </span>
                  </div>

                  {topicAssigns.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500 dark:text-slate-400">
                      Chưa có KV hoặc thành viên nào gán Tên TĐ vào chủ đề này. Bấm{' '}
                      <strong>“Gán Tên KV &amp; TĐ”</strong> để đăng ký tham gia.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Mobile Cards */}
                      <div className="md:hidden space-y-2.5">
                        {topicAssigns.map((a) => {
                          const canEdit = canModifyAssignment(a);
                          return (
                            <div
                              key={a.id}
                              className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900 dark:text-white truncate">
                                    {a.studentName}
                                  </div>
                                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                    {a.companyCode} • KV {a.areaCode}
                                  </div>
                                </div>
                                {canEdit && (
                                  <div className="inline-flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openAssignModal(topic, a)}
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
                              </div>

                              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                Chủ đề: <span className="font-semibold">{topic.topicTitle}</span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                {canEdit ? (
                                  <div className="w-40 shrink-0">
                                    <CustomSelect
                                      size="sm"
                                      value={a.status}
                                      onChange={(val) =>
                                        handleQuickStatusChange(
                                          topic,
                                          a,
                                          val as EduAssignmentStatus
                                        )
                                      }
                                      options={(
                                        ['REGISTERED', 'IN_PROGRESS', 'COMPLETED'] as EduAssignmentStatus[]
                                      ).map((st) => ({
                                        value: st,
                                        label: EDU_ASSIGNMENT_STATUS_LABELS[st],
                                      }))}
                                      menuMinWidth={160}
                                      ariaLabel="Cập nhật trạng thái"
                                    />
                                  </div>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      a.status === 'COMPLETED'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                        : a.status === 'IN_PROGRESS'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                    }`}
                                  >
                                    {EDU_ASSIGNMENT_STATUS_LABELS[a.status]}
                                  </span>
                                )}
                                {a.note && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-full">
                                    {a.note}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3">Tên KV</th>
                              <th className="py-2.5 px-3">Tên TĐ</th>
                              <th className="py-2.5 px-3">Tên Chủ đề</th>
                              <th className="py-2.5 px-3">Trạng thái</th>
                              <th className="py-2.5 px-3">Ghi chú</th>
                              <th className="py-2.5 px-3 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {topicAssigns.map((a) => {
                              const canEdit = canModifyAssignment(a);
                              return (
                                <tr
                                  key={a.id}
                                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                                >
                                  <td className="py-2.5 px-3 font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                    {a.companyCode} • KV {a.areaCode}
                                  </td>
                                  <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white">
                                    {a.studentName}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                    {topic.topicTitle}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {canEdit ? (
                                      <div className="w-36">
                                        <CustomSelect
                                          size="sm"
                                          value={a.status}
                                          onChange={(val) =>
                                            handleQuickStatusChange(
                                              topic,
                                              a,
                                              val as EduAssignmentStatus
                                            )
                                          }
                                          options={(
                                            ['REGISTERED', 'IN_PROGRESS', 'COMPLETED'] as EduAssignmentStatus[]
                                          ).map((st) => ({
                                            value: st,
                                            label: EDU_ASSIGNMENT_STATUS_LABELS[st],
                                          }))}
                                          menuMinWidth={160}
                                          ariaLabel="Cập nhật trạng thái"
                                        />
                                      </div>
                                    ) : (
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          a.status === 'COMPLETED'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                            : a.status === 'IN_PROGRESS'
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                        }`}
                                      >
                                        {EDU_ASSIGNMENT_STATUS_LABELS[a.status]}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-[220px] truncate">
                                    {a.note || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    {canEdit && (
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => openAssignModal(topic, a)}
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
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
                  Nhóm đối tượng
                </label>
                <CustomSelect
                  size="sm"
                  value={tTrack}
                  onChange={(val) => setTTrack(val as EduTrack)}
                  options={[
                    { value: 'TD_I', label: 'TĐ-I' },
                    { value: 'TD_II', label: 'TĐ-II' },
                    { value: 'NGV', label: 'NGV' },
                  ]}
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
                Nội dung Giáo trình / Bài học nhanh (có thể soạn đầy đủ hơn ở mục CMS)
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

      {/* MODAL: ASSIGN TEN KV & TEN TD TO TOPIC */}
      {assignTargetTopic && (
        <div
          onClick={() => setAssignTargetTopic(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveAssignSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {editingAssignId ? 'Cập nhật Tên KV & Tên TĐ' : 'Gán Tên KV & Tên TĐ vào Chủ đề'}
                </h3>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                  {assignTargetTopic.weekLabel} • {assignTargetTopic.topicTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignTargetTopic(null)}
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
                  value={aCompanyCode}
                  onChange={(nextComp) => {
                    setACompanyCode(nextComp);
                    const firstArea = areas.find((a) => a.companyCode === nextComp)?.code;
                    if (firstArea) setAAreaCode(firstArea);
                  }}
                  options={companies.map((c) => ({
                    value: c.code,
                    label: c.name,
                    badge: c.code,
                  }))}
                  ariaLabel="Chọn Công ty"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên Khu vực (KV) <span className="text-rose-500">*</span>
                </label>
                {areaOptionsForAssign.length > 0 ? (
                  <CustomSelect
                    size="sm"
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
                    value={aAreaCode}
                    onChange={(e) => setAAreaCode(e.target.value)}
                    placeholder="Ví dụ: 1.1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                )}
              </div>
            </div>

            {memberCandidatesForAssign.length > 0 && (
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

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên TĐ / Học viên tham gia <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nhập họ tên hoặc bí danh TĐ..."
                value={aStudentName}
                onChange={(e) => setAStudentName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Trạng thái
                </label>
                <CustomSelect
                  size="sm"
                  value={aStatus}
                  onChange={(val) => setAStatus(val as EduAssignmentStatus)}
                  options={[
                    { value: 'REGISTERED', label: 'Đã gán' },
                    { value: 'IN_PROGRESS', label: 'Đang học' },
                    { value: 'COMPLETED', label: 'Hoàn thành' },
                  ]}
                  menuMinWidth={160}
                  ariaLabel="Chọn trạng thái"
                />
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
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAssignTargetTopic(null)}
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
                <span>{isSavingAssign ? 'Đang lưu...' : 'Xác nhận Gán'}</span>
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
