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
  ExternalLink,
  Check,
} from 'lucide-react';
import {
  EduCmsProfile,
  EduCmsStage,
  EDU_CMS_STAGE_LABELS,
  EduCurriculumTemplate,
  EduWeeklyTopic,
  EDU_TRACK_LABELS,
  EDU_TRACK_ORDER,
  EduTrack,
  Member,
  UserAccount,
  Company,
  Area,
} from '../types/edulms';
import { CustomSelect } from './CustomSelect';
import {
  canModifyEduRecord,
  canViewEduRecord,
  getScopedAreaOptions,
  getScopedCompanyOptions,
  getScopedMemberOptions,
  isAdminRole,
  normalizeOrgCode,
} from '../utils/rbac';
import { normalizeEduText } from '../utils/eduAnalytics';

interface EduCmsPageProps {
  currentUser: UserAccount | null;
  cmsProfiles: EduCmsProfile[];
  topics: EduWeeklyTopic[];
  curriculumTemplates?: EduCurriculumTemplate[];
  companies: Company[];
  areas: Area[];
  members?: Member[];
  initialSubTab?: 'PROGRESSION' | 'NGV' | 'TEMPLATES';
  onSaveCmsProfile: (profile: Omit<EduCmsProfile, 'id'>, existingId?: string) => Promise<void>;
  onDeleteCmsProfile: (profileId: string) => Promise<void>;
  onSaveCurriculumTemplate?: (
    template: Omit<EduCurriculumTemplate, 'id'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteCurriculumTemplate?: (templateId: string) => Promise<void>;
  onNavigateToLmsTopics?: () => void;
  onOpenAuthModal: () => void;
  onShowNotification: (msg: string) => void;
}

export const EduCmsPage: React.FC<EduCmsPageProps> = ({
  currentUser,
  cmsProfiles,
  topics,
  curriculumTemplates = [],
  companies,
  areas,
  members = [],
  initialSubTab = 'PROGRESSION',
  onSaveCmsProfile,
  onDeleteCmsProfile,
  onSaveCurriculumTemplate,
  onDeleteCurriculumTemplate,
  onNavigateToLmsTopics,
  onOpenAuthModal,
  onShowNotification,
}) => {
  const isAdmin = isAdminRole(currentUser?.role);
  const [subTab, setSubTab] = useState<'PROGRESSION' | 'NGV' | 'TEMPLATES'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // ---------- Filters for Progression & NGV ----------
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'ALL' | 'TD_MOI' | 'TD_I' | 'TD_II'>('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [areaFilter, setAreaFilter] = useState('ALL');

  // ---------- Profile Modal (Multi-select KV + Single/Edit) ----------
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [modalEntryMode, setModalEntryMode] = useState<'MULTI' | 'SINGLE'>('MULTI');
  const [pFullName, setPFullName] = useState('');
  const [pCompanyCode, setPCompanyCode] = useState(
    currentUser?.companyCode || companies[0]?.code || ''
  );
  const [pAreaCode, setPAreaCode] = useState(
    currentUser?.areaCode || areas[0]?.code || ''
  );
  const [pStage, setPStage] = useState<EduCmsStage>('TD_MOI');
  const [pNgvName, setPNgvName] = useState('');
  const [pSpecialty, setPSpecialty] = useState('');
  const [pTopicId, setPTopicId] = useState('');
  const [pNote, setPNote] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Record<string, boolean>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // ---------- Master Curriculum Template Library State ----------
  const [trackFilter, setTrackFilter] = useState<'ALL' | EduTrack>('ALL');
  const [tplSearchQuery, setTplSearchQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [tplTrack, setTplTrack] = useState<EduTrack>('TD_MOI');
  const [tplLessonCode, setTplLessonCode] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplSummary, setTplSummary] = useState('');
  const [tplObjectives, setTplObjectives] = useState('');
  const [tplCurriculum, setTplCurriculum] = useState('');
  const [tplRefs, setTplRefs] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const sortedTemplates = useMemo(() => {
    const q = normalizeEduText(tplSearchQuery);
    return [...curriculumTemplates]
      .filter((t) => {
        if (trackFilter !== 'ALL' && t.track !== trackFilter) return false;
        if (q) {
          const hay = `${t.lessonCode || ''} ${t.title} ${t.summary || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const trackOrderA = EDU_TRACK_ORDER.indexOf(a.track);
        const trackOrderB = EDU_TRACK_ORDER.indexOf(b.track);
        if (trackOrderA !== trackOrderB) return trackOrderA - trackOrderB;
        const codeCmp = (a.lessonCode || '').localeCompare(b.lessonCode || '', 'vi', {
          numeric: true,
        });
        if (codeCmp !== 0) return codeCmp;
        return a.title.localeCompare(b.title, 'vi');
      });
  }, [curriculumTemplates, trackFilter, tplSearchQuery]);

  useEffect(() => {
    if (isCreatingTemplate) return;
    if (sortedTemplates.length === 0) {
      if (selectedTemplateId) setSelectedTemplateId('');
      return;
    }
    if (!selectedTemplateId || !sortedTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(sortedTemplates[0].id);
    }
  }, [sortedTemplates, selectedTemplateId, isCreatingTemplate]);

  const activeTemplate = useMemo(
    () =>
      isCreatingTemplate
        ? null
        : curriculumTemplates.find((t) => t.id === selectedTemplateId) || null,
    [curriculumTemplates, selectedTemplateId, isCreatingTemplate]
  );

  useEffect(() => {
    if (isCreatingTemplate) return;
    if (activeTemplate) {
      setTplTrack(activeTemplate.track);
      setTplLessonCode(activeTemplate.lessonCode || '');
      setTplTitle(activeTemplate.title || '');
      setTplSummary(activeTemplate.summary || '');
      setTplObjectives(activeTemplate.learningObjectives || '');
      setTplCurriculum(activeTemplate.curriculumContent || '');
      setTplRefs(activeTemplate.referenceLinks || '');
    } else {
      setTplLessonCode('');
      setTplTitle('');
      setTplSummary('');
      setTplObjectives('');
      setTplCurriculum('');
      setTplRefs('');
    }
  }, [activeTemplate, isCreatingTemplate]);

  const startCreateTemplate = () => {
    if (!isAdmin) return;
    setIsCreatingTemplate(true);
    setSelectedTemplateId('');
    setTplTrack(trackFilter !== 'ALL' ? trackFilter : 'TD_MOI');
    setTplLessonCode('');
    setTplTitle('');
    setTplSummary('');
    setTplObjectives('');
    setTplCurriculum('');
    setTplRefs('');
  };

  const handleSelectTemplate = (tplId: string) => {
    setIsCreatingTemplate(false);
    setSelectedTemplateId(tplId);
  };

  const handleSaveTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !onSaveCurriculumTemplate || !currentUser) return;
    if (!tplTitle.trim()) {
      onShowNotification('Vui lòng nhập Tên Giáo trình / Bài học.');
      return;
    }
    setIsSavingTemplate(true);
    try {
      const nowIso = new Date().toISOString();
      const existing = !isCreatingTemplate && activeTemplate ? activeTemplate : null;
      await onSaveCurriculumTemplate(
        {
          track: tplTrack,
          lessonCode: tplLessonCode.trim().slice(0, 30),
          title: tplTitle.trim().slice(0, 200),
          summary: tplSummary.trim().slice(0, 1000),
          learningObjectives: tplObjectives.trim().slice(0, 1000),
          curriculumContent: tplCurriculum.trim().slice(0, 20000),
          referenceLinks: tplRefs.trim().slice(0, 1000),
          createdBy: existing?.createdBy || currentUser.fullName.slice(0, 100),
          updatedBy: currentUser.fullName.slice(0, 100),
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        },
        existing?.id
      );
      setIsCreatingTemplate(false);
      onShowNotification(
        existing
          ? 'Đã cập nhật Giáo trình chuẩn trong Kho!'
          : 'Đã thêm Giáo trình mới vào Kho chuẩn!'
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu giáo trình: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // ---------- RBAC Scoped Filters & Data ----------
  const scopedFilterCompanies = useMemo(
    () => getScopedCompanyOptions(currentUser, companies, members),
    [currentUser, companies, members]
  );

  const scopedFilterAreas = useMemo(
    () =>
      getScopedAreaOptions(
        currentUser,
        areas,
        companyFilter === 'ALL' ? '' : companyFilter,
        members
      ),
    [currentUser, areas, companyFilter, members]
  );

  useEffect(() => {
    if (
      companyFilter !== 'ALL' &&
      !scopedFilterCompanies.some(
        (c) => normalizeOrgCode(c.code) === normalizeOrgCode(companyFilter)
      )
    ) {
      setCompanyFilter('ALL');
      setAreaFilter('ALL');
    }
  }, [scopedFilterCompanies, companyFilter]);

  useEffect(() => {
    if (
      areaFilter !== 'ALL' &&
      !scopedFilterAreas.some((a) => normalizeOrgCode(a.code) === normalizeOrgCode(areaFilter))
    ) {
      setAreaFilter('ALL');
    }
  }, [scopedFilterAreas, areaFilter]);

  const scopedCmsProfiles = useMemo(
    () => cmsProfiles.filter((p) => canViewEduRecord(currentUser, p)),
    [cmsProfiles, currentUser]
  );

  const learnersList = useMemo(
    () => scopedCmsProfiles.filter((p) => p.stage !== 'NGV'),
    [scopedCmsProfiles]
  );
  const ngvList = useMemo(
    () => scopedCmsProfiles.filter((p) => p.stage === 'NGV'),
    [scopedCmsProfiles]
  );

  const orgScopedLearners = useMemo(() => {
    return learnersList.filter((p) => {
      if (
        companyFilter !== 'ALL' &&
        normalizeOrgCode(p.companyCode) !== normalizeOrgCode(companyFilter)
      ) {
        return false;
      }
      if (
        areaFilter !== 'ALL' &&
        normalizeOrgCode(p.areaCode) !== normalizeOrgCode(areaFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [learnersList, companyFilter, areaFilter]);

  const filteredLearners = useMemo(() => {
    return orgScopedLearners.filter((p) => {
      if (stageFilter !== 'ALL' && p.stage !== stageFilter) return false;
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
  }, [orgScopedLearners, stageFilter, searchQuery]);

  const filteredNgvs = useMemo(() => {
    return ngvList.filter((p) => {
      if (
        companyFilter !== 'ALL' &&
        normalizeOrgCode(p.companyCode) !== normalizeOrgCode(companyFilter)
      ) {
        return false;
      }
      if (
        areaFilter !== 'ALL' &&
        normalizeOrgCode(p.areaCode) !== normalizeOrgCode(areaFilter)
      ) {
        return false;
      }
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
  }, [ngvList, companyFilter, areaFilter, searchQuery]);

  const canModifyProfile = (p: EduCmsProfile): boolean =>
    canModifyEduRecord(currentUser, p);

  const scopedCompanyOptions = useMemo(
    () => getScopedCompanyOptions(currentUser, companies, members),
    [currentUser, companies, members]
  );

  const scopedAreaOptions = useMemo(
    () => getScopedAreaOptions(currentUser, areas, pCompanyCode, members),
    [currentUser, areas, pCompanyCode, members]
  );

  const scopedMembersForModal = useMemo(
    () =>
      members.filter((m) =>
        canViewEduRecord(currentUser, {
          companyCode: m.companyCode,
          areaCode: m.areaCode,
          memberId: m.id,
        })
      ),
    [members, currentUser]
  );

  const modalMemberCandidates = useMemo(
    () => getScopedMemberOptions(scopedMembersForModal, pCompanyCode, pAreaCode),
    [scopedMembersForModal, pCompanyCode, pAreaCode]
  );

  const filteredModalMemberCandidates = useMemo(() => {
    const q = normalizeEduText(memberSearchQuery);
    if (!q) return modalMemberCandidates;
    return modalMemberCandidates.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.code || '').toLowerCase().includes(q) ||
        (m.areaCode || '').toLowerCase().includes(q)
    );
  }, [modalMemberCandidates, memberSearchQuery]);

  const existingCmsStageMap = useMemo(() => {
    const map = new Map<string, EduCmsStage>();
    cmsProfiles.forEach((p) => {
      const k = `${normalizeOrgCode(p.companyCode)}|${normalizeOrgCode(
        p.areaCode
      )}|${normalizeEduText(p.fullName)}`;
      if (!map.has(k)) {
        map.set(k, p.stage);
      }
    });
    return map;
  }, [cmsProfiles]);

  const ngvSuggestionsForModal = useMemo(() => {
    const normComp = normalizeOrgCode(pCompanyCode);
    return ngvList.filter((n) => !normComp || normalizeOrgCode(n.companyCode) === normComp);
  }, [ngvList, pCompanyCode]);

  const openCreateModal = (defaultStage: EduCmsStage) => {
    setEditingProfileId(null);
    setPFullName('');
    const prefComp =
      companyFilter !== 'ALL'
        ? companyFilter
        : currentUser?.companyCode || scopedCompanyOptions[0]?.code || companies[0]?.code || '';
    const defComp =
      scopedCompanyOptions.find((c) => normalizeOrgCode(c.code) === normalizeOrgCode(prefComp))
        ?.code ||
      scopedCompanyOptions[0]?.code ||
      prefComp;
    const defAreas = getScopedAreaOptions(currentUser, areas, defComp, members);
    const prefArea =
      areaFilter !== 'ALL' ? areaFilter : currentUser?.areaCode || defAreas[0]?.code || '';
    const defArea =
      defAreas.find((a) => normalizeOrgCode(a.code) === normalizeOrgCode(prefArea))?.code ||
      defAreas[0]?.code ||
      prefArea ||
      areas[0]?.code ||
      '';
    setPCompanyCode(defComp);
    setPAreaCode(defArea);
    setPStage(defaultStage);
    setPNgvName('');
    setPSpecialty('');
    setPTopicId('');
    setPNote('');
    setMemberSearchQuery('');
    setSelectedMemberIds({});
    setModalEntryMode(currentUser?.role !== 'MEMBER' ? 'MULTI' : 'SINGLE');
    setIsModalOpen(true);
  };

  const openEditModal = (p: EduCmsProfile) => {
    setEditingProfileId(p.id);
    setModalEntryMode('SINGLE');
    setPFullName(p.fullName);
    setPCompanyCode(p.companyCode);
    setPAreaCode(p.areaCode);
    setPStage(p.stage);
    setPNgvName(p.ngvName || '');
    setPSpecialty(p.specialty || '');
    setPTopicId(p.currentTopicId || '');
    setPNote(p.note || '');
    setSelectedMemberIds({});
    setIsModalOpen(true);
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!editingProfileId && modalEntryMode === 'MULTI' && currentUser.role !== 'MEMBER') {
      const chosenIds = Object.keys(selectedMemberIds).filter((id) => selectedMemberIds[id]);
      if (chosenIds.length === 0) {
        onShowNotification('Vui lòng tích chọn ít nhất 1 thành viên trong danh sách.');
        return;
      }
      const chosenMembers = chosenIds
        .map((id) => members.find((m) => m.id === id))
        .filter((m): m is Member => Boolean(m));

      if (chosenMembers.length === 0) {
        onShowNotification('Không tìm thấy thông tin thành viên đã chọn.');
        return;
      }

      setIsSavingProfile(true);
      try {
        const nowIso = new Date().toISOString();
        const chosenTopic = topics.find((t) => t.id === pTopicId);
        await Promise.all(
          chosenMembers.map((m) => {
            const comp = (pCompanyCode || m.companyCode || currentUser.companyCode || 'HT').slice(
              0,
              30
            );
            const area = (pAreaCode || m.areaCode || currentUser.areaCode || 'Chung')
              .trim()
              .slice(0, 40);
            const fullName = m.fullName.trim().slice(0, 120);
            return onSaveCmsProfile({
              fullName,
              companyCode: comp,
              areaCode: area,
              stage: pStage,
              ngvName: (pStage === 'NGV' ? fullName : pNgvName.trim()).slice(0, 120),
              specialty: pSpecialty.trim().slice(0, 200),
              currentTopicId: chosenTopic?.id || undefined,
              currentTopicTitle: chosenTopic?.topicTitle || undefined,
              note: pNote.trim().slice(0, 500),
              ownerUid: currentUser.id,
              updatedBy: currentUser.fullName.slice(0, 100),
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          })
        );
        setIsModalOpen(false);
        setSelectedMemberIds({});
        onShowNotification(
          `Đã thêm ${chosenMembers.length} hồ sơ (${EDU_CMS_STAGE_LABELS[pStage]}) vào CMS!`
        );
      } catch (err: any) {
        onShowNotification(`Lỗi lưu CMS hàng loạt: ${err?.message || 'Thử lại sau'}`);
      } finally {
        setIsSavingProfile(false);
      }
      return;
    }

    if (!pFullName.trim()) {
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
      const safeName = pFullName.trim().slice(0, 120);
      await onSaveCmsProfile(
        {
          fullName: safeName,
          companyCode: pCompanyCode.slice(0, 30),
          areaCode: pAreaCode.trim().slice(0, 40),
          stage: pStage,
          ngvName: (pStage === 'NGV' ? safeName : pNgvName.trim()).slice(0, 120),
          specialty: pSpecialty.trim().slice(0, 200),
          currentTopicId: chosenTopic?.id || undefined,
          currentTopicTitle: chosenTopic?.topicTitle || undefined,
          note: pNote.trim().slice(0, 500),
          ownerUid: existing?.ownerUid || currentUser.id,
          updatedBy: currentUser.fullName.slice(0, 100),
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
          updatedBy: currentUser.fullName.slice(0, 100),
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
          Quản lý lộ trình TĐ Mới → TĐ-II, danh sách NGV và Kho Giáo trình chuẩn dùng chung cho LMS.
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
    <div className="space-y-2.5 sm:space-y-4">
      {/* Header & Sub-tab Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-2.5 sm:space-y-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
              <BookMarked className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
              <span className="truncate">Edu CMS — Lộ trình &amp; Kho Giáo trình</span>
            </h1>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Theo dõi chuyển cấp <strong>TĐ Mới → TĐ-II</strong>, phân công <strong>NGV</strong> và quản trị <strong>Kho Giáo trình chuẩn</strong> để nạp nhanh sang LMS.
            </p>
          </div>

          {subTab !== 'TEMPLATES' && currentUser.role !== 'MEMBER' && (
            <button
              type="button"
              onClick={() => openCreateModal(subTab === 'NGV' ? 'NGV' : 'TD_MOI')}
              className="px-3 sm:px-4 h-9 sm:h-10 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{subTab === 'NGV' ? 'Thêm NGV' : 'Thêm TĐ'}</span>
            </button>
          )}

          {subTab === 'TEMPLATES' && isAdmin && (
            <button
              type="button"
              onClick={startCreateTemplate}
              className="px-3 sm:px-4 h-9 sm:h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Giáo trình mẫu</span>
            </button>
          )}
        </div>

        {/* 3 Sub-tabs always 1 horizontal row */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2 p-1 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setSubTab('PROGRESSION')}
            className={`h-9 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 sm:gap-2 transition cursor-pointer ${
              subTab === 'PROGRESSION'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate sm:hidden">Lộ trình ({learnersList.length})</span>
            <span className="truncate hidden sm:inline">
              TĐ Mới → TĐ-II ({learnersList.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('NGV')}
            className={`h-9 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 sm:gap-2 transition cursor-pointer ${
              subTab === 'NGV'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Award className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">NGV ({ngvList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('TEMPLATES')}
            className={`h-9 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 sm:gap-2 transition cursor-pointer ${
              subTab === 'TEMPLATES'
                ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate sm:hidden">
              Giáo trình ({curriculumTemplates.length})
            </span>
            <span className="truncate hidden sm:inline">
              Kho Giáo trình chuẩn ({curriculumTemplates.length})
            </span>
          </button>
        </div>

        {/* Filters for Progression & NGV */}
        {subTab !== 'TEMPLATES' && (
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 text-xs">
            <div
              className={
                subTab === 'PROGRESSION'
                  ? 'col-span-2 sm:col-span-4 relative'
                  : 'col-span-2 sm:col-span-6 relative'
              }
            >
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm họ tên, NGV phụ trách, khu vực..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {subTab === 'PROGRESSION' && (
              <div className="col-span-2 sm:col-span-2">
                <CustomSelect
                  size="sm"
                  value={stageFilter}
                  onChange={(val) => setStageFilter(val as any)}
                  options={[
                    { value: 'ALL', label: 'Tất cả giai đoạn' },
                    { value: 'TD_MOI', label: 'TĐ Mới' },
                    { value: 'TD_I', label: 'TĐ-I' },
                    { value: 'TD_II', label: 'TĐ-II' },
                  ]}
                  ariaLabel="Lọc giai đoạn"
                />
              </div>
            )}

            <div className="col-span-1 sm:col-span-3">
              <CustomSelect
                size="sm"
                value={companyFilter}
                onChange={(nextComp) => {
                  setCompanyFilter(nextComp);
                  setAreaFilter('ALL');
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả Sion' },
                  ...scopedFilterCompanies.map((c) => ({
                    value: c.code,
                    label: c.name,
                    badge: c.code,
                  })),
                ]}
                ariaLabel="Lọc Công ty"
              />
            </div>

            <div className="col-span-1 sm:col-span-3">
              <CustomSelect
                size="sm"
                value={areaFilter}
                onChange={setAreaFilter}
                options={[
                  { value: 'ALL', label: 'Tất cả KV' },
                  ...scopedFilterAreas.map((a) => ({
                    value: a.code,
                    label: `KV ${a.code}`,
                    badge: a.companyCode,
                  })),
                ]}
                ariaLabel="Lọc Khu vực"
              />
            </div>
          </div>
        )}
      </div>

      {/* SUB-TAB 1: TĐ MỚI -> TĐ-II PROGRESSION */}
      {subTab === 'PROGRESSION' && (
        <div className="space-y-2.5 sm:space-y-4">
          {/* Pipeline KPI Row */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {(
              [
                { key: 'TD_MOI', label: 'TĐ Mới', color: 'text-sky-600 dark:text-sky-400' },
                { key: 'TD_I', label: 'TĐ-I', color: 'text-emerald-600 dark:text-emerald-400' },
                { key: 'TD_II', label: 'TĐ-II', color: 'text-amber-600 dark:text-amber-400' },
              ] as const
            ).map((st) => (
              <div
                key={st.key}
                className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 border border-slate-200 dark:border-slate-800 text-center"
              >
                <div className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
                  {st.label}
                </div>
                <div className={`text-lg sm:text-2xl font-black tabular-nums mt-0.5 ${st.color}`}>
                  {orgScopedLearners.filter((l) => l.stage === st.key).length}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {filteredLearners.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có học viên nào khớp bộ lọc trong lộ trình TĐ Mới → TĐ-II.
              </div>
            ) : (
              <>
                {/* Mobile Card List */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLearners.map((p) => {
                    const canEdit = canModifyProfile(p);
                    const nextStage: EduCmsStage | null =
                      p.stage === 'TD_MOI' ? 'TD_I' : p.stage === 'TD_I' ? 'TD_II' : null;
                    return (
                      <div key={p.id} className="p-3.5 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {p.fullName}
                            </div>
                            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                              {p.companyCode} • KV {p.areaCode}
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                              p.stage === 'TD_II'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                : p.stage === 'TD_I'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                : 'bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300'
                            }`}
                          >
                            {EDU_CMS_STAGE_LABELS[p.stage]}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          NGV phụ trách: <strong>{p.ngvName || 'Chưa phân công'}</strong>
                        </div>
                        {(p.currentTopicTitle || p.note) && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {p.currentTopicTitle ? `[${p.currentTopicTitle}] ` : ''}
                            {p.note || ''}
                          </div>
                        )}

                        {canEdit && (
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            {nextStage && (
                              <button
                                type="button"
                                onClick={() => handlePromoteStage(p, nextStage)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <span>Lên {EDU_CMS_STAGE_LABELS[nextStage]}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
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
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
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
              </>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: NGV DIRECTORY */}
      {subTab === 'NGV' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {filteredNgvs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Chưa có hồ sơ NGV nào khớp bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {filteredNgvs.map((ngv) => {
                const menteeCount = learnersList.filter(
                  (l) =>
                    normalizeOrgCode(l.companyCode) === normalizeOrgCode(ngv.companyCode) &&
                    normalizeEduText(l.ngvName) === normalizeEduText(ngv.fullName)
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
                            title="Chỉnh sửa"
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
                            title="Xóa"
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

      {/* SUB-TAB 3: KHO GIÁO TRÌNH CHUẨN (STANDALONE TEMPLATE LIBRARY) */}
      {subTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Library List */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Kho Giáo trình ({sortedTemplates.length})
              </h3>
              <div className="w-36 shrink-0">
                <CustomSelect
                  size="sm"
                  value={trackFilter}
                  onChange={(val) => setTrackFilter(val as any)}
                  options={[
                    { value: 'ALL', label: 'Tất cả Level' },
                    { value: 'TD_MOI', label: 'TĐM' },
                    { value: 'TD_I', label: 'TĐ1' },
                    { value: 'TD_II', label: 'TĐ2' },
                    { value: 'NGV', label: 'NGV' },
                  ]}
                  menuMinWidth={150}
                  align="right"
                  ariaLabel="Lọc Level giáo trình"
                />
              </div>
            </div>

            <div className="relative text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm mã bài, tên giáo trình..."
                value={tplSearchQuery}
                onChange={(e) => setTplSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {sortedTemplates.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2.5">
                <p>
                  {curriculumTemplates.length === 0
                    ? 'Kho Giáo trình chuẩn chưa có bài học mẫu nào.'
                    : 'Không tìm thấy giáo trình mẫu phù hợp bộ lọc.'}
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={startCreateTemplate}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo Giáo trình mẫu đầu tiên</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {sortedTemplates.map((tpl) => {
                  const selected = !isCreatingTemplate && tpl.id === activeTemplate?.id;
                  const hasContent = Boolean(tpl.curriculumContent?.trim());
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer ${
                        selected
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
                        <span className="font-black text-emerald-700 dark:text-emerald-300 truncate">
                          {EDU_TRACK_LABELS[tpl.track]}
                          {tpl.lessonCode ? ` · ${tpl.lessonCode}` : ''}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            hasContent
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {hasContent ? 'Đầy đủ' : 'Nháp'}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                        {tpl.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {onNavigateToLmsTopics && (
              <button
                type="button"
                onClick={onNavigateToLmsTopics}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở LMS để gắn vào Chủ đề tuần</span>
              </button>
            )}
          </div>

          {/* Right Template Editor / Reader */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800">
            {!isCreatingTemplate && !activeTemplate ? (
              <div className="p-10 text-center text-xs text-slate-500 space-y-3">
                <p>
                  Chọn một Giáo trình mẫu bên trái để xem/chỉnh sửa, hoặc tạo mới để dùng chung khi mở Chủ đề tuần ở <strong>Edu LMS</strong>.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={startCreateTemplate}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tạo Giáo trình mẫu</span>
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveTemplateSubmit} className="space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-700 dark:text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {isCreatingTemplate
                          ? 'Soạn Giáo trình mẫu mới'
                          : `${EDU_TRACK_LABELS[tplTrack]}${
                              tplLessonCode ? ` · ${tplLessonCode}` : ''
                            }`}
                      </span>
                    </div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white mt-0.5">
                      {isAdmin
                        ? isCreatingTemplate
                          ? 'Thêm Giáo trình vào Kho chuẩn'
                          : 'Biên soạn Giáo trình mẫu'
                        : 'Xem Giáo trình chuẩn'}
                    </h3>
                  </div>

                  {!isAdmin && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                      Chế độ chỉ đọc (Admin biên soạn)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Level đối tượng
                    </label>
                    <CustomSelect
                      size="sm"
                      disabled={!isAdmin}
                      value={tplTrack}
                      onChange={(val) => setTplTrack(val as EduTrack)}
                      options={EDU_TRACK_ORDER.map((lv) => ({
                        value: lv,
                        label: EDU_TRACK_LABELS[lv],
                      }))}
                      ariaLabel="Chọn Level giáo trình"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mã bài (tùy chọn)
                    </label>
                    <input
                      type="text"
                      readOnly={!isAdmin}
                      maxLength={30}
                      value={tplLessonCode}
                      onChange={(e) => setTplLessonCode(e.target.value)}
                      placeholder="VD: Bài 01"
                      className="w-full px-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tên Giáo trình / Bài học <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={!isAdmin}
                      maxLength={200}
                      value={tplTitle}
                      onChange={(e) => setTplTitle(e.target.value)}
                      placeholder="VD: Đức tin và Sự cầu nguyện trong đời sống"
                      className="w-full px-3.5 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tóm tắt trọng tâm
                    </label>
                    <textarea
                      rows={3}
                      readOnly={!isAdmin}
                      maxLength={1000}
                      value={tplSummary}
                      onChange={(e) => setTplSummary(e.target.value)}
                      placeholder="Ý chính của bài học..."
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
                      maxLength={1000}
                      value={tplObjectives}
                      onChange={(e) => setTplObjectives(e.target.value)}
                      placeholder="Sau bài học, TĐ nắm vững điều gì..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Nội dung Giáo trình chi tiết</span>
                  </label>
                  <textarea
                    rows={12}
                    readOnly={!isAdmin}
                    maxLength={20000}
                    value={tplCurriculum}
                    onChange={(e) => setTplCurriculum(e.target.value)}
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
                    maxLength={1000}
                    value={tplRefs}
                    onChange={(e) => setTplRefs(e.target.value)}
                    placeholder="Link slide, video hoặc tên sách tham khảo..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      {!isCreatingTemplate && activeTemplate && onDeleteCurriculumTemplate && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              title: `Xóa giáo trình mẫu "${activeTemplate.title}" khỏi Kho?`,
                              onConfirm: async () => {
                                await onDeleteCurriculumTemplate(activeTemplate.id);
                                setSelectedTemplateId('');
                              },
                            })
                          }
                          className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa mẫu</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {isCreatingTemplate && sortedTemplates.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingTemplate(false);
                            setSelectedTemplateId(sortedTemplates[0].id);
                          }}
                          className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Hủy
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isSavingTemplate}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        <Save className="w-4 h-4" />
                        <span>
                          {isSavingTemplate
                            ? 'Đang lưu...'
                            : isCreatingTemplate
                            ? 'Lưu Giáo trình mới'
                            : 'Cập nhật Giáo trình mẫu'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT CMS PROFILE (MULTI-SELECT KV + SINGLE) */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveProfileSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {editingProfileId
                  ? 'Chỉnh sửa Hồ sơ CMS'
                  : modalEntryMode === 'MULTI'
                  ? 'Chọn nhiều thành viên thêm vào CMS'
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

            {!editingProfileId && currentUser.role !== 'MEMBER' && (
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
                  Chọn nhiều từ KV ({modalMemberCandidates.length})
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
                  Nhập thủ công (1 người)
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sion / Công ty
                </label>
                <CustomSelect
                  size="sm"
                  disabled={!isAdmin && scopedCompanyOptions.length <= 1}
                  value={pCompanyCode}
                  onChange={(nextC) => {
                    setPCompanyCode(nextC);
                    const allowedAreas = getScopedAreaOptions(currentUser, areas, nextC, members);
                    if (allowedAreas[0]?.code) setPAreaCode(allowedAreas[0].code);
                    setSelectedMemberIds({});
                  }}
                  options={scopedCompanyOptions.map((c) => ({
                    value: c.code,
                    label: c.name,
                    badge: c.code,
                  }))}
                  menuMinWidth={180}
                  ariaLabel="Chọn Công ty"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Khu vực (KV)
                </label>
                {scopedAreaOptions.length > 0 ? (
                  <CustomSelect
                    size="sm"
                    disabled={
                      !isAdmin &&
                      currentUser.role !== 'MANAGER' &&
                      currentUser.role !== 'SION_LEADER' &&
                      scopedAreaOptions.length <= 1
                    }
                    value={pAreaCode}
                    onChange={(nextA) => {
                      setPAreaCode(nextA);
                      setSelectedMemberIds({});
                    }}
                    options={scopedAreaOptions.map((a) => ({
                      value: a.code,
                      label: `KV ${a.code}`,
                      description: a.name,
                    }))}
                    menuMinWidth={180}
                    ariaLabel="Chọn Khu vực"
                  />
                ) : (
                  <input
                    type="text"
                    disabled={currentUser.role === 'UNI_LEADER'}
                    value={pAreaCode}
                    onChange={(e) => setPAreaCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold disabled:opacity-60"
                  />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cấp độ / Giai đoạn
                </label>
                <CustomSelect
                  size="sm"
                  value={pStage}
                  onChange={(val) => setPStage(val as EduCmsStage)}
                  options={[
                    { value: 'TD_MOI', label: 'TĐ Mới' },
                    { value: 'TD_I', label: 'TĐ-I' },
                    { value: 'TD_II', label: 'TĐ-II' },
                    { value: 'NGV', label: 'NGV' },
                  ]}
                  menuMinWidth={150}
                  align="right"
                  ariaLabel="Chọn Cấp độ"
                />
              </div>
            </div>

            {!editingProfileId && modalEntryMode === 'MULTI' && currentUser.role !== 'MEMBER' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={`Tìm thành viên trong KV ${pAreaCode || '...'}...`}
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    Đã chọn:{' '}
                    <strong className="text-blue-700 dark:text-blue-300">
                      {Object.values(selectedMemberIds).filter(Boolean).length}
                    </strong>{' '}
                    / {filteredModalMemberCandidates.length} thành viên hiển thị
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next: Record<string, boolean> = { ...selectedMemberIds };
                        filteredModalMemberCandidates.forEach((m) => {
                          const k = `${normalizeOrgCode(
                            pCompanyCode || m.companyCode
                          )}|${normalizeOrgCode(pAreaCode || m.areaCode)}|${normalizeEduText(
                            m.fullName
                          )}`;
                          if (!existingCmsStageMap.has(k)) {
                            next[m.id] = true;
                          }
                        });
                        setSelectedMemberIds(next);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 cursor-pointer"
                    >
                      Chọn tất cả chưa có
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds({})}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="max-h-[240px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredModalMemberCandidates.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                      Không tìm thấy thành viên nào thuộc KV {pAreaCode || 'đang chọn'}. Bạn có thể chuyển sang tab{' '}
                      <strong>Nhập thủ công</strong>.
                    </div>
                  ) : (
                    filteredModalMemberCandidates.map((m) => {
                      const k = `${normalizeOrgCode(
                        pCompanyCode || m.companyCode
                      )}|${normalizeOrgCode(pAreaCode || m.areaCode)}|${normalizeEduText(
                        m.fullName
                      )}`;
                      const existingStage = existingCmsStageMap.get(k);
                      const alreadyExists = Boolean(existingStage);
                      const isChecked = Boolean(selectedMemberIds[m.id]);

                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={alreadyExists}
                          onClick={() =>
                            setSelectedMemberIds((prev) => ({
                              ...prev,
                              [m.id]: !prev[m.id],
                            }))
                          }
                          className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left transition ${
                            alreadyExists
                              ? 'bg-slate-50/80 dark:bg-slate-800/30 opacity-65 cursor-not-allowed'
                              : isChecked
                              ? 'bg-blue-50/60 dark:bg-blue-950/30 cursor-pointer'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                isChecked
                                  ? 'bg-blue-700 border-blue-700 text-white'
                                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3" />}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {m.fullName}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {m.companyCode} · KV {m.areaCode}
                                {m.unitCode ? ` · Uni ${m.unitCode}` : ''}
                              </div>
                            </div>
                          </div>

                          {existingStage ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold shrink-0">
                              Đã có ({EDU_CMS_STAGE_LABELS[existingStage]})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
                              → {EDU_CMS_STAGE_LABELS[pStage]}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và Tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={pFullName}
                  onChange={(e) => setPFullName(e.target.value)}
                  placeholder={pStage === 'NGV' ? 'Tên NGV...' : 'Tên TĐ...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                />
              </div>
            )}

            {pStage === 'NGV' ? (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nhóm / Nội dung phụ trách
                </label>
                <input
                  type="text"
                  maxLength={200}
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
                    maxLength={120}
                    list="cms-ngv-suggestions"
                    value={pNgvName}
                    onChange={(e) => setPNgvName(e.target.value)}
                    placeholder="Tên NGV phụ trách..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <datalist id="cms-ngv-suggestions">
                    {ngvSuggestionsForModal.map((n) => (
                      <option key={n.id} value={n.fullName} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chủ đề LMS hiện tại (tùy chọn)
                  </label>
                  <CustomSelect
                    size="sm"
                    value={pTopicId}
                    onChange={setPTopicId}
                    options={[
                      { value: '', label: '-- Chưa chọn --' },
                      ...topics.map((t) => ({
                        value: t.id,
                        label: t.topicTitle,
                        badge: t.weekLabel,
                      })),
                    ]}
                    searchable
                    ariaLabel="Chọn chủ đề LMS"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú tiến độ
              </label>
              <textarea
                rows={2}
                maxLength={500}
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
                <span>
                  {isSavingProfile
                    ? 'Đang lưu...'
                    : !editingProfileId && modalEntryMode === 'MULTI'
                    ? `Lưu (${Object.values(selectedMemberIds).filter(Boolean).length} người)`
                    : 'Lưu Hồ Sơ'}
                </span>
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
