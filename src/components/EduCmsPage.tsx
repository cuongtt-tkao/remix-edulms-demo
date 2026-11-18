import React, { useState, useMemo, useEffect } from 'react';
import {
  BookMarked,
  Users,
  Award,
  FileText,
  Plus,
  Search,
  ArrowRight,
  Pencil,
  Trash2,
  Save,
  CheckCircle2,
  X,
  Lock,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import {
  EduCmsProfile,
  EduCmsStage,
  EDU_CMS_STAGE_LABELS,
  EduWeeklyTopic,
  EDU_TRACK_LABELS,
  EduTrack,
  UserAccount,
  Company,
  Area,
} from '../types/edulms';

interface EduCmsPageProps {
  currentUser: UserAccount | null;
  cmsProfiles: EduCmsProfile[];
  topics: EduWeeklyTopic[];
  companies: Company[];
  areas: Area[];
  initialSubTab?: 'PROGRESSION' | 'NGV' | 'CURRICULUM';
  initialTopicId?: string | null;
  onSaveCmsProfile: (profile: Omit<EduCmsProfile, 'id'>, existingId?: string) => Promise<void>;
  onDeleteCmsProfile: (profileId: string) => Promise<void>;
  onSaveTopicCurriculum: (topic: EduWeeklyTopic) => Promise<void>;
  onOpenAuthModal: () => void;
  onShowNotification: (msg: string) => void;
}

export const EduCmsPage: React.FC<EduCmsPageProps> = ({
  currentUser,
  cmsProfiles,
  topics,
  companies,
  areas,
  initialSubTab = 'PROGRESSION',
  initialTopicId = null,
  onSaveCmsProfile,
  onDeleteCmsProfile,
  onSaveTopicCurriculum,
  onOpenAuthModal,
  onShowNotification,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [subTab, setSubTab] = useState<'PROGRESSION' | 'NGV' | 'CURRICULUM'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // ---------- Filters for Progression & NGV ----------
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'ALL' | 'TD_MOI' | 'TD_I' | 'TD_II'>('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  // Profile Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [pFullName, setPFullName] = useState('');
  const [pCompanyCode, setPCompanyCode] = useState(
    currentUser?.companyCode || companies[0]?.code || 'Th1'
  );
  const [pAreaCode, setPAreaCode] = useState(
    currentUser?.areaCode || areas[0]?.code || '1.1'
  );
  const [pStage, setPStage] = useState<EduCmsStage>('TD_MOI');
  const [pNgvName, setPNgvName] = useState('');
  const [pSpecialty, setPSpecialty] = useState('');
  const [pTopicId, setPTopicId] = useState('');
  const [pNote, setPNote] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // ---------- Curriculum Authoring State ----------
  const [trackFilter, setTrackFilter] = useState<'ALL' | EduTrack>('ALL');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId || '');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftObjectives, setDraftObjectives] = useState('');
  const [draftCurriculum, setDraftCurriculum] = useState('');
  const [draftRefs, setDraftRefs] = useState('');
  const [isSavingLesson, setIsSavingLesson] = useState(false);

  const sortedTopics = useMemo(() => {
    return [...topics]
      .filter((t) => trackFilter === 'ALL' || t.track === trackFilter)
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      });
  }, [topics, trackFilter]);

  useEffect(() => {
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    } else if (!selectedTopicId && sortedTopics.length > 0) {
      setSelectedTopicId(sortedTopics[0].id);
    }
  }, [initialTopicId, sortedTopics, selectedTopicId]);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) || null,
    [topics, selectedTopicId]
  );

  useEffect(() => {
    if (activeTopic) {
      setDraftTitle(activeTopic.topicTitle || '');
      setDraftSummary(activeTopic.summary || '');
      setDraftObjectives(activeTopic.learningObjectives || '');
      setDraftCurriculum(activeTopic.curriculumContent || '');
      setDraftRefs(activeTopic.referenceLinks || '');
    }
  }, [activeTopic]);

  const learnersList = useMemo(
    () => cmsProfiles.filter((p) => p.stage !== 'NGV'),
    [cmsProfiles]
  );
  const ngvList = useMemo(
    () => cmsProfiles.filter((p) => p.stage === 'NGV'),
    [cmsProfiles]
  );

  const filteredLearners = useMemo(() => {
    return learnersList.filter((p) => {
      if (stageFilter !== 'ALL' && p.stage !== stageFilter) return false;
      if (companyFilter !== 'ALL' && p.companyCode !== companyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.ngvName?.toLowerCase().includes(q) ||
          p.areaCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [learnersList, stageFilter, companyFilter, searchQuery]);

  const filteredNgvs = useMemo(() => {
    return ngvList.filter((p) => {
      if (companyFilter !== 'ALL' && p.companyCode !== companyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.specialty?.toLowerCase().includes(q) ||
          p.areaCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ngvList, companyFilter, searchQuery]);

  const canModifyProfile = (p: EduCmsProfile): boolean => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    if (p.ownerUid === currentUser.id) return true;
    if (
      currentUser.role === 'AREA_LEADER' &&
      currentUser.companyCode === p.companyCode &&
      currentUser.areaCode === p.areaCode
    ) {
      return true;
    }
    if (
      currentUser.role === 'MANAGER' &&
      (currentUser.managedAreaCodes?.includes(p.areaCode) ||
        currentUser.managedCompanyCodes?.includes(p.companyCode))
    ) {
      return true;
    }
    return false;
  };

  const openCreateModal = (defaultStage: EduCmsStage) => {
    setEditingProfileId(null);
    setPFullName('');
    setPCompanyCode(currentUser?.companyCode || companies[0]?.code || 'Th1');
    setPAreaCode(currentUser?.areaCode || areas[0]?.code || '1.1');
    setPStage(defaultStage);
    setPNgvName('');
    setPSpecialty('');
    setPTopicId('');
    setPNote('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: EduCmsProfile) => {
    setEditingProfileId(p.id);
    setPFullName(p.fullName);
    setPCompanyCode(p.companyCode);
    setPAreaCode(p.areaCode);
    setPStage(p.stage);
    setPNgvName(p.ngvName || '');
    setPSpecialty(p.specialty || '');
    setPTopicId(p.currentTopicId || '');
    setPNote(p.note || '');
    setIsModalOpen(true);
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !pFullName.trim()) {
      onShowNotification('Vui lòng nhập họ tên.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const existing = editingProfileId
        ? cmsProfiles.find((x) => x.id === editingProfileId)
        : null;
      const chosenTopic = topics.find((t) => t.id === pTopicId);
      const nowIso = new Date().toISOString();
      await onSaveCmsProfile(
        {
          fullName: pFullName.trim(),
          companyCode: pCompanyCode,
          areaCode: pAreaCode,
          stage: pStage,
          ngvName: pStage === 'NGV' ? pFullName.trim() : pNgvName.trim(),
          specialty: pSpecialty.trim(),
          currentTopicId: chosenTopic?.id || undefined,
          currentTopicTitle: chosenTopic?.topicTitle || undefined,
          note: pNote.trim(),
          ownerUid: existing?.ownerUid || currentUser.id,
          updatedBy: currentUser.fullName,
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        },
        editingProfileId || undefined
      );
      setIsModalOpen(false);
      onShowNotification(
        editingProfileId ? 'Đã cập nhật hồ sơ CMS!' : 'Đã thêm hồ sơ CMS mới!'
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu CMS: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePromoteStage = async (p: EduCmsProfile, nextStage: EduCmsStage) => {
    if (!currentUser) return;
    try {
      await onSaveCmsProfile(
        {
          fullName: p.fullName,
          companyCode: p.companyCode,
          areaCode: p.areaCode,
          stage: nextStage,
          ngvName: p.ngvName,
          specialty: p.specialty,
          currentTopicId: p.currentTopicId,
          currentTopicTitle: p.currentTopicTitle,
          note: p.note,
          ownerUid: p.ownerUid,
          updatedBy: currentUser.fullName,
          createdAt: p.createdAt,
          updatedAt: new Date().toISOString(),
        },
        p.id
      );
      onShowNotification(
        `Đã chuyển cấp "${p.fullName}" sang ${EDU_CMS_STAGE_LABELS[nextStage]}!`
      );
    } catch (err: any) {
      onShowNotification(`Lỗi chuyển cấp: ${err?.message || 'Thử lại sau'}`);
    }
  };

  const handleSaveCurriculumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTopic || !isAdmin) return;
    if (!draftTitle.trim()) {
      onShowNotification('Tên Chủ đề không được để trống.');
      return;
    }
    setIsSavingLesson(true);
    try {
      await onSaveTopicCurriculum({
        ...activeTopic,
        topicTitle: draftTitle.trim(),
        summary: draftSummary.trim(),
        learningObjectives: draftObjectives.trim(),
        curriculumContent: draftCurriculum,
        referenceLinks: draftRefs.trim(),
        updatedAt: new Date().toISOString(),
      });
      onShowNotification('Đã lưu Giáo trình / Bài học đồng bộ sang LMS!');
    } catch (err: any) {
      onShowNotification(`Lỗi lưu giáo trình: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingLesson(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md mx-auto text-center shadow-sm border border-slate-200 dark:border-slate-800 my-10">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
          Đăng nhập để truy cập Edu CMS
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Quản lý lộ trình TĐ Mới → TĐ-II, danh sách NGV và hệ thống giáo trình bài học LMS.
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

  const areaOptions = areas.filter((a) => a.companyCode === pCompanyCode);

  return (
    <div className="space-y-5">
      {/* Header & Sub-tab Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Edu CMS — Lộ trình Đào tạo &amp; Soạn Giáo trình</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Theo dõi chuyển cấp <strong>TĐ Mới → TĐ-II</strong>, phân công <strong>NGV</strong> và biên soạn nội dung giáo trình cho các chủ đề LMS.
            </p>
          </div>

          {subTab !== 'CURRICULUM' && (
            <button
              type="button"
              onClick={() => openCreateModal(subTab === 'NGV' ? 'NGV' : 'TD_MOI')}
              className="px-4 py-2.5 min-h-[42px] bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{subTab === 'NGV' ? 'Thêm NGV' : 'Thêm Học viên (TĐ Mới→TĐ-II)'}</span>
            </button>
          )}
        </div>

        {/* 3 Sub-tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setSubTab('PROGRESSION')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              subTab === 'PROGRESSION'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>TĐ Mới → TĐ-II ({learnersList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('NGV')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              subTab === 'NGV'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>NGV ({ngvList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('CURRICULUM')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              subTab === 'CURRICULUM'
                ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Soạn Giáo trình LMS ({topics.length})</span>
          </button>
        </div>

        {/* Filters for Progression & NGV */}
        {subTab !== 'CURRICULUM' && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
            <div className="sm:col-span-5 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm họ tên, NGV phụ trách, khu vực..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {subTab === 'PROGRESSION' && (
              <div className="sm:col-span-4">
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  <option value="ALL">Tất cả giai đoạn (TĐ Mới → TĐ-II)</option>
                  <option value="TD_MOI">TĐ Mới</option>
                  <option value="TD_I">TĐ-I</option>
                  <option value="TD_II">TĐ-II</option>
                </select>
              </div>
            )}

            <div className={subTab === 'PROGRESSION' ? 'sm:col-span-3' : 'sm:col-span-7'}>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              >
                <option value="ALL">Tất cả Công ty</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* SUB-TAB 1: TĐ MỚI -> TĐ-II PROGRESSION */}
      {subTab === 'PROGRESSION' && (
        <div className="space-y-4">
          {/* Pipeline KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { key: 'TD_MOI', label: 'TĐ Mới', color: 'text-sky-600 dark:text-sky-400' },
                { key: 'TD_I', label: 'TĐ-I', color: 'text-emerald-600 dark:text-emerald-400' },
                { key: 'TD_II', label: 'TĐ-II', color: 'text-amber-600 dark:text-amber-400' },
              ] as const
            ).map((st) => (
              <div
                key={st.key}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-center"
              >
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {st.label}
                </div>
                <div className={`text-2xl font-black tabular-nums mt-1 ${st.color}`}>
                  {learnersList.filter((l) => l.stage === st.key).length}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {filteredLearners.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có học viên nào trong danh sách lộ trình TĐ Mới → TĐ-II.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Tên TĐ</th>
                      <th className="py-3 px-4">Khu vực</th>
                      <th className="py-3 px-4">Giai đoạn</th>
                      <th className="py-3 px-4">NGV phụ trách</th>
                      <th className="py-3 px-4">Chủ đề / Ghi chú</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLearners.map((p) => {
                      const canEdit = canModifyProfile(p);
                      const nextStage: EduCmsStage | null =
                        p.stage === 'TD_MOI' ? 'TD_I' : p.stage === 'TD_I' ? 'TD_II' : null;
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                        >
                          <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white">
                            {p.fullName}
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                            {p.companyCode} • KV {p.areaCode}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                p.stage === 'TD_II'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                  : p.stage === 'TD_I'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300'
                              }`}
                            >
                              {EDU_CMS_STAGE_LABELS[p.stage]}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {p.ngvName || 'Chưa phân công'}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[240px] truncate">
                            {p.currentTopicTitle ? `[${p.currentTopicTitle}] ` : ''}
                            {p.note || '—'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {canEdit && nextStage && (
                                <button
                                  type="button"
                                  onClick={() => handlePromoteStage(p, nextStage)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                  title={`Chuyển lên ${EDU_CMS_STAGE_LABELS[nextStage]}`}
                                >
                                  <span>Lên {EDU_CMS_STAGE_LABELS[nextStage]}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(p)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                                    title="Chỉnh sửa"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDelete({
                                        title: `Xóa hồ sơ "${p.fullName}" khỏi CMS?`,
                                        onConfirm: () => onDeleteCmsProfile(p.id),
                                      })
                                    }
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
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
      )}

      {/* SUB-TAB 2: NGV DIRECTORY */}
      {subTab === 'NGV' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {filteredNgvs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Chưa có hồ sơ NGV nào được thêm.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {filteredNgvs.map((ngv) => {
                const menteeCount = learnersList.filter(
                  (l) => l.ngvName?.toLowerCase() === ngv.fullName.toLowerCase()
                ).length;
                const canEdit = canModifyProfile(ngv);
                return (
                  <div
                    key={ngv.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                          NGV
                        </span>
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                          {ngv.companyCode} • KV {ngv.areaCode}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {ngv.fullName}
                      </h3>
                      {ngv.specialty && (
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Chuyên trách: <strong>{ngv.specialty}</strong>
                        </p>
                      )}
                      {ngv.note && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{ngv.note}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        Đang kèm: {menteeCount} TĐ
                      </span>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(ngv)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                title: `Xóa NGV "${ngv.fullName}"?`,
                                onConfirm: () => onDeleteCmsProfile(ngv.id),
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* SUB-TAB 3: CURRICULUM / LESSON AUTHORING LINKED TO LMS TOPICS */}
      {subTab === 'CURRICULUM' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Topic Selector */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Chọn Chủ đề LMS ({sortedTopics.length})
              </h3>
              <select
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value as any)}
                className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
              >
                <option value="ALL">Tất cả nhóm</option>
                <option value="TD_I">TĐ-I</option>
                <option value="TD_II">TĐ-II</option>
                <option value="NGV">NGV</option>
              </select>
            </div>

            {sortedTopics.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Chưa có Chủ đề tuần nào. Admin hãy tạo chủ đề ở tab <strong>LMS</strong> trước.
              </div>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {sortedTopics.map((t) => {
                  const selected = t.id === activeTopic?.id;
                  const hasContent = Boolean(t.curriculumContent?.trim());
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTopicId(t.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer ${
                        selected
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
                        <span className="font-black text-emerald-700 dark:text-emerald-300">
                          {EDU_TRACK_LABELS[t.track]} • {t.weekLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            hasContent
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {hasContent ? 'Đã có bài' : 'Trống'}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                        {t.topicTitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Curriculum Authoring Studio */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800">
            {!activeTopic ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chọn một Chủ đề bên trái để xem hoặc soạn nội dung giáo trình.
              </div>
            ) : (
              <form onSubmit={handleSaveCurriculumSubmit} className="space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-700 dark:text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {EDU_TRACK_LABELS[activeTopic.track]} • {activeTopic.weekLabel}
                      </span>
                    </div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white mt-0.5">
                      {isAdmin ? 'Biên soạn Giáo trình / Bài học LMS' : 'Nội dung Giáo trình / Bài học'}
                    </h3>
                  </div>

                  {!isAdmin && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                      Chế độ chỉ đọc (Admin biên soạn)
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên Chủ đề
                  </label>
                  <input
                    type="text"
                    readOnly={!isAdmin}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tóm tắt nội dung tuần
                    </label>
                    <textarea
                      rows={3}
                      readOnly={!isAdmin}
                      value={draftSummary}
                      onChange={(e) => setDraftSummary(e.target.value)}
                      placeholder="Ý chính của buổi học..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mục tiêu học tập &amp; thực hành
                    </label>
                    <textarea
                      rows={3}
                      readOnly={!isAdmin}
                      value={draftObjectives}
                      onChange={(e) => setDraftObjectives(e.target.value)}
                      placeholder="Sau bài học, TĐ nắm vững điều gì..."
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
                    rows={12}
                    readOnly={!isAdmin}
                    value={draftCurriculum}
                    onChange={(e) => setDraftCurriculum(e.target.value)}
                    placeholder="I. Lời dẫn nhập&#10;II. Nội dung trọng tâm & Kinh Thánh nền tảng&#10;III. Câu hỏi thảo luận & Thực hành trong tuần..."
                    className="w-full px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 leading-relaxed text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tài liệu / Link tham khảo (tùy chọn)
                  </label>
                  <input
                    type="text"
                    readOnly={!isAdmin}
                    value={draftRefs}
                    onChange={(e) => setDraftRefs(e.target.value)}
                    placeholder="Link slide, video hoặc tên sách tham khảo..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                {isAdmin && (
                  <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={isSavingLesson}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingLesson ? 'Đang lưu...' : 'Lưu Giáo trình vào Chủ đề LMS'}</span>
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT CMS PROFILE */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveProfileSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {editingProfileId
                  ? 'Chỉnh sửa Hồ sơ CMS'
                  : pStage === 'NGV'
                  ? 'Thêm NGV Mới'
                  : 'Thêm Học viên (TĐ Mới → TĐ-II)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Họ và Tên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={pFullName}
                onChange={(e) => setPFullName(e.target.value)}
                placeholder={pStage === 'NGV' ? 'Tên NGV...' : 'Tên TĐ...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Công ty
                </label>
                <select
                  value={pCompanyCode}
                  onChange={(e) => {
                    const nextC = e.target.value;
                    setPCompanyCode(nextC);
                    const firstArea = areas.find((a) => a.companyCode === nextC)?.code;
                    if (firstArea) setPAreaCode(firstArea);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Khu vực
                </label>
                {areaOptions.length > 0 ? (
                  <select
                    value={pAreaCode}
                    onChange={(e) => setPAreaCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    {areaOptions.map((a) => (
                      <option key={a.id} value={a.code}>
                        KV {a.code}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={pAreaCode}
                    onChange={(e) => setPAreaCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cấp độ
                </label>
                <select
                  value={pStage}
                  onChange={(e) => setPStage(e.target.value as EduCmsStage)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  <option value="TD_MOI">TĐ Mới</option>
                  <option value="TD_I">TĐ-I</option>
                  <option value="TD_II">TĐ-II</option>
                  <option value="NGV">NGV</option>
                </select>
              </div>
            </div>

            {pStage === 'NGV' ? (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nhóm / Nội dung phụ trách
                </label>
                <input
                  type="text"
                  value={pSpecialty}
                  onChange={(e) => setPSpecialty(e.target.value)}
                  placeholder="Ví dụ: Phụ trách nhóm TĐ-I, TĐ-II hoặc chủ đề tuần..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    NGV phụ trách
                  </label>
                  <input
                    type="text"
                    list="cms-ngv-suggestions"
                    value={pNgvName}
                    onChange={(e) => setPNgvName(e.target.value)}
                    placeholder="Tên NGV phụ trách..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <datalist id="cms-ngv-suggestions">
                    {ngvList.map((n) => (
                      <option key={n.id} value={n.fullName} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chủ đề LMS hiện tại (tùy chọn)
                  </label>
                  <select
                    value={pTopicId}
                    onChange={(e) => setPTopicId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">-- Chưa chọn --</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.weekLabel}: {t.topicTitle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú tiến độ
              </label>
              <textarea
                rows={2}
                value={pNote}
                onChange={(e) => setPNote(e.target.value)}
                placeholder="Ghi chú tình hình học tập hoặc lịch học..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingProfile ? 'Đang lưu...' : 'Lưu Hồ Sơ'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* IN-APP DELETE CONFIRM */}
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
