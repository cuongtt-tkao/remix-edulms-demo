import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Check,
  Lock,
  ShieldCheck,
  Briefcase,
  MessageSquareText,
  Sparkles,
  Clock,
  PauseCircle,
  Loader2,
  FileDown,
} from 'lucide-react';
import {
  UserAccount,
  Area,
  Company,
  DiscipleRecord,
  DiscipleProgressStep,
  DiscipleAgeMode,
  DiscipleAgeRange,
  DISCIPLE_PROGRESS_STEPS,
  DISCIPLE_AGE_RANGES,
  mapAgeToRange,
} from '../types/edulms';
import { CustomSelect } from './CustomSelect';
import {
  formatAreaDisplayName,
  formatAreaScopeLabel,
  getScopedAreaOptions,
  getScopedCompanyOptions,
  isAdminRole,
  isSupervisorRole,
  makeAreaScopeKey,
  normalizeOrgCode,
  parseAreaScopeEntry,
} from '../utils/rbac';
import { exportDisciplesExcel } from '../utils/excelManager';

interface DisciplesPageProps {
  currentUser: UserAccount | null;
  disciples: DiscipleRecord[];
  isLoading: boolean;
  companies: Company[];
  areas: Area[];
  onCreateDisciple: (
    payload: Omit<
      DiscipleRecord,
      'id' | 'ownerUid' | 'ownerMemberId' | 'ownerName' | 'companyCode' | 'areaCode' | 'createdAt' | 'updatedAt' | 'updatedBy'
    >
  ) => Promise<void>;
  onUpdateDiscipleFull: (
    disciple: DiscipleRecord,
    payload: {
      nickname: string;
      ageMode: DiscipleAgeMode;
      ageRange: DiscipleAgeRange;
      exactAge: number | null;
      job: string;
      traits: string;
      progress: DiscipleProgressStep[];
      isStopped: boolean;
      statusNote: string;
    }
  ) => Promise<void>;
  onUpdateDiscipleProgressNote: (
    disciple: DiscipleRecord,
    payload: {
      progress: DiscipleProgressStep[];
      isStopped: boolean;
      statusNote: string;
    }
  ) => Promise<void>;
  onDeleteDisciple: (discipleId: string) => Promise<void>;
  onOpenAuthModal: () => void;
  onShowNotification: (msg: string) => void;
}

type ProgressFilter = 'ALL' | 'ACTIVE' | 'STOPPED' | DiscipleProgressStep;

const PROGRESS_ORDER = DISCIPLE_PROGRESS_STEPS.map((s) => s.key);

function normalizeProgress(list: DiscipleProgressStep[]): DiscipleProgressStep[] {
  const set = new Set(list);
  return PROGRESS_ORDER.filter((step) => set.has(step));
}

function formatShortTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const DisciplesPage: React.FC<DisciplesPageProps> = ({
  currentUser,
  disciples,
  isLoading,
  companies,
  areas,
  onCreateDisciple,
  onUpdateDiscipleFull,
  onUpdateDiscipleProgressNote,
  onDeleteDisciple,
  onOpenAuthModal,
  onShowNotification,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');

  // Form Modal State (Add / Full Edit / Supervisor Quick Progress+Note Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<DiscipleRecord | null>(null);
  const [editMode, setEditMode] = useState<'CREATE' | 'FULL' | 'SUPERVISOR_NOTE'>('CREATE');
  const [isSaving, setIsSaving] = useState(false);

  // Fields
  const [nickname, setNickname] = useState('');
  const [ageMode, setAgeMode] = useState<DiscipleAgeMode>('RANGE');
  const [ageRange, setAgeRange] = useState<DiscipleAgeRange>('18-22');
  const [exactAgeInput, setExactAgeInput] = useState<string>('');
  const [job, setJob] = useState('');
  const [traits, setTraits] = useState('');
  const [progress, setProgress] = useState<DiscipleProgressStep[]>(['KN']);
  const [statusNote, setStatusNote] = useState('');

  // In-app delete confirmation (replaces window.confirm)
  const [deleteCandidate, setDeleteCandidate] = useState<DiscipleRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = isAdminRole(currentUser?.role);
  const isSupervisor = isSupervisorRole(currentUser?.role);

  const scopeLabel = useMemo(() => {
    if (!currentUser) return '';
    switch (currentUser.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return 'HT';
      case 'MANAGER': {
        const compText = currentUser.managedCompanyCodes?.length
          ? currentUser.managedCompanyCodes.join(', ')
          : currentUser.companyCode;
        const formattedAreas = (currentUser.managedAreaCodes || [])
          .map((a) => formatAreaScopeLabel(a))
          .filter(Boolean);
        const areaText = formattedAreas.length ? ` · KV ${formattedAreas.join(', ')}` : '';
        return `QL Cụm · ${compText}${areaText}`;
      }
      case 'SION_LEADER':
        return `TS, NQ · ${currentUser.managedCompanyCodes?.join(', ') || currentUser.companyCode}`;
      case 'AREA_LEADER': {
        const formattedAreas = (currentUser.managedAreaCodes || [])
          .map((a) => formatAreaScopeLabel(a))
          .filter(Boolean);
        return `Gru · KV ${formattedAreas.length ? formattedAreas.join(', ') : currentUser.areaCode}`;
      }
      case 'UNI_LEADER':
        return `Uni · ${currentUser.unitCode || currentUser.departmentCode || `KV ${currentUser.areaCode}`}`;
      default:
        return `TĐ · ${currentUser.companyCode} / KV ${currentUser.areaCode}`;
    }
  }, [currentUser]);

  // 3 tầng lọc liên hoàn (Sion -> Khu vực -> Người phụ trách) tuân thủ RBAC
  const disciplePseudoMembers = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        fullName: string;
        companyCode: string;
        areaCode: string;
        departmentCode: string;
        active: boolean;
        goals: { s1: number; s2: number; s3: number; s4: number; s5: number; s6: number };
        results: { s1: number; s2: number; s3: number; s4: number; s5: number; s6: number };
        score: number;
        targets: never[];
        createdAt: string;
      }
    >();
    disciples.forEach((d) => {
      const key = d.ownerUid || d.ownerMemberId || d.ownerName;
      if (!key || map.has(key)) return;
      map.set(key, {
        id: key,
        code: key,
        fullName: d.ownerName || key,
        companyCode: d.companyCode || '',
        areaCode: d.areaCode || '',
        departmentCode: d.ownerUnitCode || '',
        active: true,
        goals: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
        results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
        score: 0,
        targets: [],
        createdAt: d.createdAt || '',
      });
    });
    return Array.from(map.values());
  }, [disciples]);

  const selectableCompanies = useMemo(() => {
    if (!currentUser || !isSupervisor) return [];
    return getScopedCompanyOptions(currentUser, companies, disciplePseudoMembers);
  }, [currentUser, isSupervisor, companies, disciplePseudoMembers]);

  const selectableAreas = useMemo(() => {
    if (!currentUser || !isSupervisor) return [];
    return getScopedAreaOptions(currentUser, areas, companyFilter, disciplePseudoMembers);
  }, [currentUser, isSupervisor, areas, companyFilter, disciplePseudoMembers]);

  const parsedAreaFilter = useMemo(
    () => (areaFilter !== 'ALL' ? parseAreaScopeEntry(areaFilter) : null),
    [areaFilter]
  );

  const selectableOwners = useMemo(() => {
    if (!isSupervisor) return [];
    return disciplePseudoMembers
      .filter((m) => {
        if (
          companyFilter !== 'ALL' &&
          normalizeOrgCode(m.companyCode) !== normalizeOrgCode(companyFilter)
        ) {
          return false;
        }
        if (parsedAreaFilter) {
          if (
            parsedAreaFilter.hasCompanyPrefix &&
            normalizeOrgCode(m.companyCode) !== parsedAreaFilter.companyCode
          ) {
            return false;
          }
          if (
            parsedAreaFilter.areaCode &&
            normalizeOrgCode(m.areaCode) !== parsedAreaFilter.areaCode
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  }, [isSupervisor, disciplePseudoMembers, companyFilter, parsedAreaFilter]);

  const showCompanyDropdown =
    isSupervisor && (isAdmin || currentUser?.role === 'MANAGER' || selectableCompanies.length > 1);
  const showAreaDropdown =
    isSupervisor &&
    (isAdmin ||
      currentUser?.role === 'MANAGER' ||
      currentUser?.role === 'SION_LEADER' ||
      selectableAreas.length > 1);
  const showOwnerDropdown = isSupervisor && selectableOwners.length > 1;

  // Filtered list
  const filteredDisciples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...disciples]
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .filter((d) => {
        if (
          companyFilter !== 'ALL' &&
          normalizeOrgCode(d.companyCode) !== normalizeOrgCode(companyFilter)
        ) {
          return false;
        }
        if (parsedAreaFilter) {
          if (
            parsedAreaFilter.hasCompanyPrefix &&
            normalizeOrgCode(d.companyCode) !== parsedAreaFilter.companyCode
          ) {
            return false;
          }
          if (
            parsedAreaFilter.areaCode &&
            normalizeOrgCode(d.areaCode) !== parsedAreaFilter.areaCode
          ) {
            return false;
          }
        }
        if (ownerFilter !== 'ALL') {
          const matchesOwner =
            d.ownerUid === ownerFilter ||
            d.ownerMemberId === ownerFilter ||
            (d.ownerUid && `m-${d.ownerUid}` === ownerFilter) ||
            d.ownerName === ownerFilter;
          if (!matchesOwner) return false;
        }

        if (progressFilter === 'ACTIVE' && d.isStopped) return false;
        if (progressFilter === 'STOPPED' && !d.isStopped) return false;
        if (
          progressFilter !== 'ALL' &&
          progressFilter !== 'ACTIVE' &&
          progressFilter !== 'STOPPED' &&
          !(d.progress || []).includes(progressFilter)
        ) {
          return false;
        }

        if (q) {
          const hay = [
            d.nickname,
            d.job,
            d.traits,
            d.statusNote,
            d.ownerName,
            d.areaCode,
            d.companyCode,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [disciples, companyFilter, areaFilter, ownerFilter, progressFilter, searchQuery]);

  // Summary metrics
  const stats = useMemo(() => {
    const total = disciples.length;
    const stopped = disciples.filter((d) => d.isStopped || d.progress?.includes('Dừng')).length;
    const active = total - stopped;
    const advanced = disciples.filter(
      (d) =>
        !d.isStopped &&
        (d.progress?.includes('KT') || d.progress?.includes('WS') || d.progress?.includes('HH'))
    ).length;
    return { total, active, advanced, stopped };
  }, [disciples]);

  const openCreateModal = () => {
    setEditingTarget(null);
    setEditMode('CREATE');
    setNickname('');
    setAgeMode('RANGE');
    setAgeRange('18-22');
    setExactAgeInput('');
    setJob('');
    setTraits('');
    setProgress(['KN']);
    setStatusNote('');
    setIsFormOpen(true);
  };

  const openEditModal = (d: DiscipleRecord, mode: 'FULL' | 'SUPERVISOR_NOTE') => {
    setEditingTarget(d);
    setEditMode(mode);
    setNickname(d.nickname || '');
    setAgeMode(d.ageMode || 'RANGE');
    setAgeRange((d.ageRange as DiscipleAgeRange) || '18-22');
    setExactAgeInput(d.exactAge ? String(d.exactAge) : '');
    setJob(d.job || '');
    setTraits(d.traits || '');
    setProgress(Array.isArray(d.progress) ? [...d.progress] : []);
    setStatusNote(d.statusNote || '');
    setIsFormOpen(true);
  };

  const toggleProgressStep = (step: DiscipleProgressStep) => {
    setProgress((prev) => {
      const exists = prev.includes(step);
      const next = exists ? prev.filter((s) => s !== step) : [...prev, step];
      return normalizeProgress(next);
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const cleanProgress = normalizeProgress(progress);
    const isStopped = cleanProgress.includes('Dừng');
    const cleanNote = statusNote.trim().slice(0, 600);

    setIsSaving(true);
    try {
      if (editMode === 'SUPERVISOR_NOTE' && editingTarget) {
        await onUpdateDiscipleProgressNote(editingTarget, {
          progress: cleanProgress,
          isStopped,
          statusNote: cleanNote,
        });
        onShowNotification(`Đã cập nhật tiến độ & ghi chú cho "${editingTarget.nickname}"!`);
        setIsFormOpen(false);
        return;
      }

      const cleanNickname = nickname.trim().slice(0, 60);
      if (!cleanNickname) {
        onShowNotification('Vui lòng nhập Biệt danh MĐ.');
        setIsSaving(false);
        return;
      }

      let resolvedAgeMode: DiscipleAgeMode = ageMode;
      let resolvedRange: DiscipleAgeRange = ageRange;
      let resolvedExactAge: number | null = null;

      if (ageMode === 'EXACT') {
        const parsed = Number(exactAgeInput);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
          onShowNotification('Vui lòng nhập độ tuổi cụ thể hợp lệ (từ 1 đến 120).');
          setIsSaving(false);
          return;
        }
        resolvedExactAge = Math.round(parsed);
        resolvedRange = mapAgeToRange(resolvedExactAge);
      }

      const payload = {
        nickname: cleanNickname,
        ageMode: resolvedAgeMode,
        ageRange: resolvedRange,
        exactAge: resolvedExactAge,
        job: job.trim().slice(0, 100),
        traits: traits.trim().slice(0, 400),
        progress: cleanProgress,
        isStopped,
        statusNote: cleanNote,
      };

      if (editMode === 'CREATE') {
        await onCreateDisciple(payload);
        onShowNotification(`Đã thêm MĐ "${cleanNickname}" vào sổ tay!`);
      } else if (editingTarget) {
        await onUpdateDiscipleFull(editingTarget, payload);
        onShowNotification(`Đã cập nhật hồ sơ MĐ "${cleanNickname}"!`);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      onShowNotification(`Không thể lưu MĐ: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      await onDeleteDisciple(deleteCandidate.id);
      onShowNotification(`Đã xóa hồ sơ MĐ "${deleteCandidate.nickname}".`);
      setDeleteCandidate(null);
    } catch (err: any) {
      onShowNotification(`Không thể xóa: ${err?.message || 'Thiếu quyền hoặc mất kết nối'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md mx-auto text-center border border-slate-200 dark:border-slate-800 my-10">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="font-extrabold text-lg text-slate-900 dark:text-white mb-1">
          Trang thông tin MĐ
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          Vui lòng đăng nhập để ghi chép sổ tay MĐ cá nhân hoặc theo dõi danh sách MĐ theo phân quyền khu vực.
        </p>
        <button
          type="button"
          onClick={onOpenAuthModal}
          className="w-full py-2.5 min-h-[44px] bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Đăng nhập / Đăng ký ngay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* Header & Scope Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">Trang thông tin MĐ</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">{scopeLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!currentUser) return;
                const statusOpt =
                  progressFilter === 'ACTIVE' || progressFilter === 'STOPPED'
                    ? progressFilter
                    : 'ALL';
                const res = exportDisciplesExcel(filteredDisciples, {
                  viewer: currentUser,
                  companyCode: companyFilter,
                  areaCode: areaFilter,
                  ownerKey: ownerFilter,
                  status: statusOpt,
                });
                onShowNotification(
                  `Đã xuất ${res.fileName} (${res.count} MĐ theo phạm vi phân quyền).`
                );
              }}
              title="Xuất Excel Sổ tay MĐ theo phân quyền hiện tại"
              className="px-2.5 sm:px-3.5 h-9 sm:h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">Xuất Excel</span>
              <span className="xs:hidden">Excel</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="px-3 sm:px-4 h-9 sm:h-10 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm MĐ</span>
            </button>
          </div>
        </div>

        {/* 4 Compact KPI Metrics in 1 Horizontal Row */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 mt-2.5 sm:mt-4 pt-2.5 sm:pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/70">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              Tổng MĐ
            </div>
            <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {stats.total}
            </div>
          </div>

          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30">
            <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">
              Đang theo
            </div>
            <div className="text-base sm:text-xl font-black text-emerald-800 dark:text-emerald-200 tabular-nums mt-0.5">
              {stats.active}
            </div>
          </div>

          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30">
            <div className="text-[10px] sm:text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 truncate">
              HH/KT/WS
            </div>
            <div className="text-base sm:text-xl font-black text-indigo-800 dark:text-indigo-200 tabular-nums mt-0.5">
              {stats.advanced}
            </div>
          </div>

          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-50/70 dark:bg-rose-950/30">
            <div className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-300 truncate">
              Tạm dừng
            </div>
            <div className="text-base sm:text-xl font-black text-rose-800 dark:text-rose-200 tabular-nums mt-0.5">
              {stats.stopped}
            </div>
          </div>
        </div>
      </div>

      {/* Search + 3-Tier Cascading Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 sm:p-3.5 border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm biệt danh MĐ, công việc, đặc điểm, ghi chú..."
              className="w-full pl-9 pr-3 h-9 sm:h-10 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="w-full sm:w-56 shrink-0">
            <CustomSelect
              size="sm"
              ariaLabel="Lọc theo tiến độ MĐ"
              value={progressFilter}
              onChange={(val) => setProgressFilter(val as ProgressFilter)}
              options={[
                { value: 'ALL', label: `Tiến độ: Tất cả`, badge: String(stats.total) },
                { value: 'ACTIVE', label: `Đang đồng hành`, badge: String(stats.active) },
                { value: 'STOPPED', label: `Đã Dừng`, badge: String(stats.stopped) },
                ...DISCIPLE_PROGRESS_STEPS.map((st) => ({
                  value: st.key,
                  label: `Có mốc: ${st.label}`,
                  group: 'Lọc theo mốc cụ thể',
                })),
              ]}
            />
          </div>
        </div>

        {(showCompanyDropdown || showAreaDropdown || showOwnerDropdown) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {showCompanyDropdown && (
              <CustomSelect
                size="sm"
                ariaLabel="Lọc theo Sion / Công ty"
                searchable={false}
                value={companyFilter}
                onChange={(val) => {
                  setCompanyFilter(val);
                  setAreaFilter('ALL');
                  setOwnerFilter('ALL');
                }}
                options={[
                  { value: 'ALL', label: isAdmin ? 'Tất cả Sion' : 'Tất cả Sion (phạm vi)' },
                  ...selectableCompanies.map((c) => ({
                    value: c.code,
                    label: c.name || c.code,
                  })),
                ]}
              />
            )}

            {showAreaDropdown && (
              <CustomSelect
                size="sm"
                ariaLabel="Lọc theo khu vực"
                searchable={false}
                value={areaFilter}
                onChange={(val) => {
                  setAreaFilter(val);
                  setOwnerFilter('ALL');
                }}
                options={[
                  { value: 'ALL', label: 'Mọi khu vực', badge: String(selectableAreas.length) },
                  ...selectableAreas.map((a) => ({
                    value:
                      companyFilter === 'ALL'
                        ? makeAreaScopeKey(a.companyCode, a.code)
                        : a.code,
                    label:
                      companyFilter === 'ALL'
                        ? `${formatAreaDisplayName(a.code, a.name)} (${a.companyCode})`
                        : formatAreaDisplayName(a.code, a.name),
                  })),
                ]}
              />
            )}

            {showOwnerDropdown && (
              <CustomSelect
                size="sm"
                ariaLabel="Lọc theo cá nhân phụ trách MĐ"
                searchable
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={[
                  { value: 'ALL', label: `Tất cả người phụ trách (${selectableOwners.length})` },
                  ...selectableOwners.map((o) => ({
                    value: o.id,
                    label: o.fullName,
                    badge: o.areaCode ? `KV ${o.areaCode}` : o.companyCode,
                  })),
                ]}
              />
            )}
          </div>
        )}
      </div>

      {/* Loading / Empty / List */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
          <span className="text-xs font-semibold">Đang đồng bộ danh sách MĐ từ máy chủ...</span>
        </div>
      ) : filteredDisciples.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 text-center border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            {disciples.length === 0
              ? 'Chưa có hồ sơ MĐ nào trong sổ tay'
              : 'Không tìm thấy MĐ phù hợp bộ lọc'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 max-w-sm mx-auto">
            {disciples.length === 0
              ? 'Nhấn nút bên dưới để thêm hồ sơ MĐ đầu tiên với Biệt danh, Độ tuổi, Công việc và Tiến độ.'
              : 'Thử xóa từ khóa tìm kiếm hoặc chọn "Tiến độ: Tất cả".'}
          </p>
          {disciples.length === 0 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2.5 min-h-[42px] bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm MĐ đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5">
          {filteredDisciples.map((d) => {
            const isOwner = d.ownerUid === currentUser.id;
            const canFullEdit = isOwner || isAdmin;
            const canQuickNote = canFullEdit || isSupervisor;
            const ageText =
              d.ageMode === 'EXACT' && d.exactAge
                ? `${d.exactAge} tuổi`
                : `Nhóm ${d.ageRange}`;
            const compName = companies.find((c) => c.code === d.companyCode)?.code || d.companyCode;

            return (
              <article
                key={d.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border transition flex flex-col justify-between gap-2.5 ${
                  d.isStopped
                    ? 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  {/* Card Title & Unboxed Metadata */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                        {d.nickname}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                          {ageText}
                        </span>
                        {d.job && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                              <Briefcase className="w-3 h-3 shrink-0" />
                              {d.job}
                            </span>
                          </>
                        )}
                        {!isOwner && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-blue-700 dark:text-blue-400 font-semibold">
                              {compName} / KV {d.areaCode} ({d.ownerName})
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {d.isStopped && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                        <PauseCircle className="w-3.5 h-3.5" />
                        <span>Dừng</span>
                      </span>
                    )}
                  </div>

                  {/* Đặc điểm */}
                  {d.traits && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Đặc điểm:{' '}
                      </span>
                      {d.traits}
                    </p>
                  )}

                  {/* 9-Step Progress Strip (Compact Visual Overview) */}
                  <div className="grid grid-cols-5 sm:grid-cols-9 gap-1 pt-0.5">
                    {DISCIPLE_PROGRESS_STEPS.map((st) => {
                      const active = (d.progress || []).includes(st.key);
                      const isStopBtn = st.isStop;
                      return (
                        <div
                          key={st.key}
                          className={`text-center py-1 px-1 rounded-lg text-[10px] font-bold border truncate ${
                            active
                              ? isStopBtn
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 border-slate-200/70 dark:border-slate-700/60'
                          }`}
                        >
                          {st.label}
                        </div>
                      );
                    })}
                  </div>

                  {/* Ghi chú tình trạng */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareText className="w-3 h-3" />
                        Ghi chú tình trạng
                      </span>
                      {d.updatedAt && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums">
                          <Clock className="w-2.5 h-2.5" />
                          {formatShortTime(d.updatedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                      {d.statusNote ? (
                        d.statusNote
                      ) : (
                        <span className="italic text-slate-400">Chưa có ghi chú tình trạng</span>
                      )}
                    </p>
                    {d.updatedBy && d.updatedBy !== d.ownerName && (
                      <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                        Cập nhật hỗ trợ bởi: {d.updatedBy}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {canQuickNote && (
                    <button
                      type="button"
                      onClick={() => openEditModal(d, canFullEdit ? 'FULL' : 'SUPERVISOR_NOTE')}
                      className="flex-1 py-2 px-3 min-h-[40px] rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{canFullEdit ? 'Cập nhật MĐ' : 'Sửa tiến độ / ghi chú'}</span>
                    </button>
                  )}

                  {canFullEdit && (
                    <button
                      type="button"
                      onClick={() => setDeleteCandidate(d)}
                      aria-label={`Xóa ${d.nickname}`}
                      className="p-2 min-w-[40px] min-h-[40px] rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Thêm / Cập nhật MĐ */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {editMode === 'CREATE'
                    ? 'Thêm MĐ mới'
                    : editMode === 'SUPERVISOR_NOTE'
                    ? `Hỗ trợ cập nhật: ${editingTarget?.nickname}`
                    : `Cập nhật MĐ: ${editingTarget?.nickname}`}
                </h2>
                {editMode === 'SUPERVISOR_NOTE' && (
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                    Chế độ cấp trên: Chỉ chỉnh sửa Tiến độ &amp; Ghi chú tình trạng
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-5 space-y-4">
              {editMode !== 'SUPERVISOR_NOTE' && (
                <>
                  {/* Biệt danh MĐ */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Biệt danh MĐ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={60}
                      required
                      placeholder="VD: Bạn Minh ĐH, Em Lan Q7..."
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* Độ tuổi: Chọn khoảng tuổi hoặc Nhập cụ thể */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Độ tuổi
                      </label>
                      <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold border border-slate-200/70 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setAgeMode('RANGE')}
                          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                            ageMode === 'RANGE'
                              ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-300 shadow-xs'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Khoảng tuổi
                        </button>
                        <button
                          type="button"
                          onClick={() => setAgeMode('EXACT')}
                          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                            ageMode === 'EXACT'
                              ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-300 shadow-xs'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Nhập cụ thể
                        </button>
                      </div>
                    </div>

                    {ageMode === 'RANGE' ? (
                      <div className="grid grid-cols-5 gap-1.5">
                        {DISCIPLE_AGE_RANGES.map((range) => (
                          <button
                            key={range}
                            type="button"
                            onClick={() => setAgeRange(range)}
                            className={`py-2 min-h-[42px] rounded-xl text-xs font-extrabold border transition cursor-pointer tabular-nums ${
                              ageRange === range
                                ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                            }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={120}
                          inputMode="numeric"
                          value={exactAgeInput}
                          onChange={(e) => setExactAgeInput(e.target.value)}
                          placeholder="Nhập số tuổi (VD: 22)"
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        {exactAgeInput && Number(exactAgeInput) > 0 && (
                          <span className="text-xs font-bold text-slate-500 shrink-0">
                            Nhóm: {mapAgeToRange(Number(exactAgeInput))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Công việc */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Công việc
                    </label>
                    <input
                      type="text"
                      value={job}
                      onChange={(e) => setJob(e.target.value)}
                      maxLength={100}
                      placeholder="VD: Sinh viên IT, Kế toán, Tự do..."
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* Đặc điểm */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Đặc điểm
                    </label>
                    <textarea
                      value={traits}
                      onChange={(e) => setTraits(e.target.value)}
                      maxLength={400}
                      rows={2}
                      placeholder="Tính cách, sở thích, hoàn cảnh gia đình, lưu ý..."
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </>
              )}

              {/* Tiến độ: Lưới 3x3 Tích chọn 1 chạm */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tiến độ (chạm để chọn nhiều)
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                    Đã chọn {progress.length}/9
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DISCIPLE_PROGRESS_STEPS.map((st) => {
                    const selected = progress.includes(st.key);
                    const isStopBtn = st.isStop;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => toggleProgressStep(st.key)}
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-extrabold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          selected
                            ? isStopBtn
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : isStopBtn
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100/70'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ghi chú tình trạng */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú tình trạng
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="Diễn biến hiện tại, lịch hẹn tiếp theo, lý do tạm dừng..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-900 pb-1">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-extrabold text-white bg-blue-700 hover:bg-blue-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Lưu thông tin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa MĐ */}
      {deleteCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Xóa hồ sơ MĐ?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bạn chắc chắn muốn xóa hồ sơ của <strong>{deleteCandidate.nickname}</strong>? Thao tác
              này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
