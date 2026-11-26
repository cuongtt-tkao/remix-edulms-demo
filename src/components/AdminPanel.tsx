import React, { useState, useRef } from 'react';
import {
  Building2,
  MapPin,
  Users2,
  User,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Shield,
  Search,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  FileSpreadsheet,
  Download,
  Upload,
  FileUp,
  FileDown,
  AlertCircle,
  Info,
  Crown,
  Image as ImageIcon,
  Scale,
  Trophy,
  Type,
  Home,
  LayoutGrid,
  BookOpen,
  BarChart3,
  GraduationCap,
  CalendarDays,
  BookOpenCheck,
  Layers,
  MapPinned,
} from 'lucide-react';
import {
  Company,
  Area,
  Region,
  Department,
  Member,
  UserAccount,
  UserRole,
  RoleAssignment,
  OrgCluster,
  SystemClustersConfig,
  SystemBannerConfig,
  FestivalEvent,
  SystemScoringConfig,
  SystemAppearanceConfig,
  DailyReportMetrics,
  DiscipleRecord,
  DailyReportRecord,
  EduWeeklyTopic,
  EduTopicAssignment,
  EduCmsProfile,
  WorkScheduleRecord,
  SystemSecurityConfig,
  OrgDeleteAttachedMode,
  resolveUserApprovalStatus,
  DEFAULT_EVENT_WEIGHTS,
  getRoleLevel,
  ROLE_DISPLAY_META,
  canExportExcel,
} from '../types/edulms';
import {
  canManageOrgRecord,
  canModifyDiscipleRecord,
  canViewEduRecord,
  createDefaultClustersForCompanies,
  getRoleScopedDropdownLabels,
  getScopedAreaOptions,
  getScopedCompanyOptions,
  getScopedMemberOptions,
  isAdminRole,
  isMemberInManagerCluster,
  makeAreaScopeKey,
  normalizeOrgCode,
  cleanRawAreaCode,
  formatAreaDisplayName,
  parseAreaScopeEntry,
  resolveClusterCompanyCodes,
} from '../utils/rbac';
import {
  exportSystemConfigExcel,
  exportMembersAndTargetsExcel,
  exportDisciplesExcel,
  exportEduDataExcel,
  downloadConfigTemplateExcel,
  downloadMembersTemplateExcel,
  parseConfigExcel,
  parseMembersExcel,
} from '../utils/excelManager';
import {
  exportDailyReportsByRbacExcel,
  DailyReportExportPeriod,
} from '../utils/reportExporter';
import {
  exportWorkSchedulesByRbacExcel,
  WorkScheduleExportPeriod,
} from '../utils/workScheduleExporter';
import {
  DEFAULT_VOCABULARY_CONFIG,
  SystemVocabularyConfig,
} from '../utils/wordEncoder';
import { RoleManagementTab } from './RoleManagementTab';
import { AdminBannerEventTab } from './AdminBannerEventTab';
import { AdminScoringAppearanceTab } from './AdminScoringAppearanceTab';
import { AdminVocabularyTab } from './AdminVocabularyTab';
import { CustomSelect } from './CustomSelect';
import { AdminRegionsTab } from './AdminRegionsTab';

export type AdminSectionId =
  | 'SCORING'
  | 'EVENTS'
  | 'BANNER'
  | 'APPEARANCE_FONT'
  | 'APPEARANCE_HOME'
  | 'APPEARANCE_LLV'
  | 'APPEARANCE_HONORS'
  | 'CLUSTERS'
  | 'COMPANIES'
  | 'REGIONS'
  | 'AREAS'
  | 'DEPARTMENTS'
  | 'MEMBERS'
  | 'ROLES'
  | 'VOCABULARY'
  | 'EXCEL_SYNC';

interface AdminPanelProps {
  initialTab?: AdminSectionId;
  initialTabTrigger?: number;
  companies: Company[];
  areas: Area[];
  regions?: Region[];
  onAddRegion?: (region: Omit<Region, 'id'>) => void;
  onUpdateRegion?: (region: Region) => void;
  onDeleteRegion?: (id: string) => Promise<boolean> | void;
  departments: Department[];
  members: Member[];
  onAddCompany: (company: Omit<Company, 'id'>) => Promise<boolean> | void;
  onUpdateCompany: (company: Company) => Promise<boolean> | void;
  onDeleteCompany: (id: string, attachedMode?: OrgDeleteAttachedMode) => Promise<boolean> | void;
  onAddArea: (area: Omit<Area, 'id'>) => Promise<boolean> | void;
  onUpdateArea: (area: Area) => Promise<boolean> | void;
  onDeleteArea: (id: string, attachedMode?: OrgDeleteAttachedMode) => Promise<boolean> | void;
  onAddDepartment: (department: Omit<Department, 'id'>) => void;
  onUpdateDepartment: (department: Department) => void;
  onDeleteDepartment: (id: string) => Promise<boolean> | void;
  onAddMember: (member: Omit<Member, 'id' | 'code' | 'score' | 'targets' | 'createdAt'>) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onBatchUpdateCompanies?: (companies: Company[], mode?: 'MERGE' | 'REPLACE') => void;
  onBatchUpdateAreas?: (areas: Area[], mode?: 'MERGE' | 'REPLACE') => void;
  onBatchUpdateDepartments?: (departments: Department[], mode?: 'MERGE' | 'REPLACE') => void;
  onBatchUpdateMembers?: (members: Member[], mode?: 'MERGE' | 'REPLACE') => void;
  onResetData: () => void;
  onShowNotification: (msg: string) => void;
  currentUser?: UserAccount | null;
  usersList?: UserAccount[];
  onUpdateUserRole?: (
    targetUserId: string,
    newRole: UserRole,
    targetName: string,
    scope?: {
      managedClusterIds?: string[];
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
      companyCode?: string;
      areaCode?: string;
      unitCode?: string;
    }
  ) => Promise<void>;
  onDeleteUserAccount?: (
    targetUserId: string,
    targetName: string,
    targetEmail?: string
  ) => Promise<void>;
  preAssignedRoles?: RoleAssignment[];
  onPreAssignRole?: (
    email: string,
    role: UserRole,
    note?: string,
    scope?: {
      managedClusterIds?: string[];
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
    }
  ) => Promise<void>;
  onDeletePreAssignedRole?: (email: string) => Promise<void>;
  onResetUserPin?: (targetUserId: string, targetName: string, newPin?: string) => Promise<void>;
  securityConfig?: SystemSecurityConfig | null;
  onSaveSecurityConfig?: (config: SystemSecurityConfig) => Promise<void>;
  onApproveUser?: (
    targetUser: UserAccount,
    options?: {
      role?: UserRole;
      companyCode?: string;
      areaCode?: string;
      unitCode?: string;
      scope?: {
        managedClusterIds?: string[];
        managedCompanyCodes?: string[];
        managedAreaCodes?: string[];
        managedUnitCodes?: string[];
      };
    }
  ) => Promise<void>;
  onRejectUser?: (targetUser: UserAccount, reason?: string) => Promise<void>;
  bannerConfig?: SystemBannerConfig | null;
  events?: FestivalEvent[];
  onSaveBannerConfig?: (config: SystemBannerConfig) => Promise<void>;
  onSaveEvent?: (event: FestivalEvent) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  scoringConfig?: SystemScoringConfig | null;
  appearanceConfig?: SystemAppearanceConfig | null;
  vocabularyConfig?: SystemVocabularyConfig | null;
  clustersConfig?: SystemClustersConfig | null;
  activeEvent?: FestivalEvent | null;
  onSaveScoringConfig?: (weights: DailyReportMetrics) => Promise<void>;
  onSaveAppearanceConfig?: (config: SystemAppearanceConfig) => Promise<void>;
  onSaveVocabularyConfig?: (config: SystemVocabularyConfig) => Promise<void>;
  onSaveClustersConfig?: (config: SystemClustersConfig) => Promise<{ syncedCount: number }>;
  disciples?: DiscipleRecord[];
  dailyReports?: DailyReportRecord[];
  eduTopics?: EduWeeklyTopic[];
  eduAssignments?: EduTopicAssignment[];
  eduCmsProfiles?: EduCmsProfile[];
  workSchedules?: WorkScheduleRecord[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  initialTab,
  initialTabTrigger = 0,
  companies,
  areas,
  regions = [],
  onAddRegion,
  onUpdateRegion,
  onDeleteRegion,
  departments,
  members,
  onAddCompany,
  onUpdateCompany,
  onDeleteCompany,
  onAddArea,
  onUpdateArea,
  onDeleteArea,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onBatchUpdateCompanies,
  onBatchUpdateAreas,
  onBatchUpdateDepartments,
  onBatchUpdateMembers,
  onResetData,
  onShowNotification,
  currentUser,
  usersList,
  onUpdateUserRole,
  onDeleteUserAccount,
  preAssignedRoles,
  onPreAssignRole,
  onDeletePreAssignedRole,
  onResetUserPin,
  securityConfig = null,
  onSaveSecurityConfig,
  onApproveUser,
  onRejectUser,
  bannerConfig = null,
  events = [],
  onSaveBannerConfig,
  onSaveEvent,
  onDeleteEvent,
  scoringConfig = null,
  appearanceConfig = null,
  vocabularyConfig = null,
  clustersConfig = null,
  activeEvent = null,
  onSaveScoringConfig,
  onSaveAppearanceConfig,
  onSaveVocabularyConfig,
  onSaveClustersConfig,
  disciples = [],
  dailyReports = [],
  eduTopics = [],
  eduAssignments = [],
  eduCmsProfiles = [],
  workSchedules = [],
}) => {
  const isAdmin = isAdminRole(currentUser?.role);
  const canDownloadExcel = canExportExcel(currentUser?.role);
  const actorRoleLevel = getRoleLevel(currentUser?.role);
  const supervisorAllowedTabs: AdminSectionId[] = React.useMemo(
    () =>
      canDownloadExcel
        ? ['CLUSTERS', 'COMPANIES', 'REGIONS', 'AREAS', 'DEPARTMENTS', 'MEMBERS', 'ROLES', 'EXCEL_SYNC']
        : ['CLUSTERS', 'COMPANIES', 'REGIONS', 'AREAS', 'DEPARTMENTS', 'MEMBERS', 'ROLES'],
    [canDownloadExcel]
  );

  const [activeTab, setActiveTab] = useState<AdminSectionId>(() => {
    if (initialTab && (isAdmin || supervisorAllowedTabs.includes(initialTab))) {
      return initialTab;
    }
    return isAdmin ? 'SCORING' : 'MEMBERS';
  });

  const pendingApprovalCount = React.useMemo(
    () =>
      isAdmin
        ? (usersList || []).filter((u) => resolveUserApprovalStatus(u) === 'PENDING').length
        : 0,
    [usersList, isAdmin]
  );

  const lastAppliedNavRef = React.useRef<string>(
    `${initialTab || ''}:${initialTabTrigger}`
  );

  React.useEffect(() => {
    const navKey = `${initialTab || ''}:${initialTabTrigger}`;
    if (navKey !== lastAppliedNavRef.current) {
      lastAppliedNavRef.current = navKey;
      if (initialTab && (isAdmin || supervisorAllowedTabs.includes(initialTab))) {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab, initialTabTrigger, isAdmin, supervisorAllowedTabs]);

  React.useEffect(() => {
    if (!isAdmin && !supervisorAllowedTabs.includes(activeTab)) {
      setActiveTab('MEMBERS');
    }
  }, [isAdmin, activeTab, supervisorAllowedTabs]);

  const viewerCompanyScope = React.useMemo(() => {
    const set = new Set<string>();
    (currentUser?.managedCompanyCodes || []).forEach((c) => {
      const n = normalizeOrgCode(c);
      if (n) set.add(n);
    });
    if (set.size === 0 && currentUser?.companyCode) {
      const n = normalizeOrgCode(currentUser.companyCode);
      if (n) set.add(n);
    }
    return set;
  }, [currentUser?.managedCompanyCodes, currentUser?.companyCode]);

  const viewerAreaEntries = React.useMemo(() => {
    const raw = (currentUser?.managedAreaCodes || []).filter((a) => (a || '').trim().length > 0);
    if (raw.length > 0) {
      return raw.map((a) => parseAreaScopeEntry(a)).filter((p) => Boolean(p.areaCode));
    }
    if (currentUser?.areaCode) {
      const p = parseAreaScopeEntry(currentUser.areaCode);
      return p.areaCode ? [p] : [];
    }
    return [];
  }, [currentUser?.managedAreaCodes, currentUser?.areaCode]);

  const matchesViewerArea = React.useCallback(
    (area: { companyCode?: string; code?: string }, requireCompanyIfNoPrefix: boolean) => {
      const aComp = normalizeOrgCode(area.companyCode);
      const aCode = normalizeOrgCode(area.code);
      if (!aCode) return false;
      return viewerAreaEntries.some((entry) => {
        if (entry.areaCode !== aCode) return false;
        if (entry.hasCompanyPrefix) return entry.companyCode === aComp;
        return (
          !requireCompanyIfNoPrefix ||
          viewerCompanyScope.size === 0 ||
          viewerCompanyScope.has(aComp)
        );
      });
    },
    [viewerAreaEntries, viewerCompanyScope]
  );

  const viewerUnitScope = React.useMemo(() => {
    const set = new Set<string>();
    (currentUser?.managedUnitCodes || []).forEach((u) => {
      const n = normalizeOrgCode(u);
      if (n) set.add(n);
    });
    if (currentUser?.unitCode) {
      const n = normalizeOrgCode(currentUser.unitCode);
      if (n) set.add(n);
    }
    if (set.size === 0 && currentUser?.departmentCode) {
      const n = normalizeOrgCode(currentUser.departmentCode);
      if (n) set.add(n);
    }
    return set;
  }, [currentUser?.managedUnitCodes, currentUser?.unitCode, currentUser?.departmentCode]);

  const scopedCompanies = React.useMemo(() => {
    if (isAdmin) return companies;
    return companies.filter((c) => {
      const code = normalizeOrgCode(c.code);
      if (viewerCompanyScope.has(code)) return true;
      if (currentUser?.role === 'MANAGER') {
        return areas.some(
          (a) =>
            normalizeOrgCode(a.companyCode) === code &&
            matchesViewerArea(a, false)
        );
      }
      return false;
    });
  }, [isAdmin, companies, areas, viewerCompanyScope, matchesViewerArea, currentUser?.role]);

  const scopedAreas = React.useMemo(() => {
    if (isAdmin) return areas;
    if (currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER') {
      return areas.filter(
        (a) =>
          viewerCompanyScope.has(normalizeOrgCode(a.companyCode)) ||
          (currentUser.role === 'MANAGER' && matchesViewerArea(a, false))
      );
    }
    return areas.filter((a) => matchesViewerArea(a, true));
  }, [isAdmin, areas, viewerCompanyScope, matchesViewerArea, currentUser?.role]);

  const scopedMembers = React.useMemo(() => {
    if (isAdmin) return members;
    const ownMemberId = currentUser?.memberId || (currentUser ? `m-${currentUser.id}` : '');
    return members.filter(
      (m) =>
        m.id === ownMemberId ||
        m.id === currentUser?.id ||
        canManageOrgRecord(currentUser || null, m) ||
        (currentUser?.role === 'MANAGER' && isMemberInManagerCluster(currentUser, m))
    );
  }, [isAdmin, members, currentUser]);

  const scopedUsers = React.useMemo(() => {
    const list = usersList || [];
    if (isAdmin) return list;
    return list.filter(
      (u) => u.id === currentUser?.id || canManageOrgRecord(currentUser || null, u)
    );
  }, [isAdmin, usersList, currentUser]);

  const scopedDisciples = React.useMemo(() => {
    if (isAdmin) return disciples;
    return disciples.filter((d) => canModifyDiscipleRecord(currentUser || null, d));
  }, [isAdmin, disciples, currentUser]);

  const scopedDailyReports = React.useMemo(() => {
    if (isAdmin) return dailyReports;
    const scopedMemberIds = new Set(scopedMembers.map((m) => m.id));
    const ownMemberId = currentUser?.memberId || (currentUser ? `m-${currentUser.id}` : '');
    return dailyReports.filter((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      return r.uid === currentUser?.id || mId === ownMemberId || scopedMemberIds.has(mId);
    });
  }, [isAdmin, dailyReports, scopedMembers, currentUser]);

  const scopedEduTopics = React.useMemo(() => {
    if (isAdmin) return eduTopics;
    return eduTopics.filter((t) => {
      if (t.companyCode === 'ALL') return true;
      if (t.areaCode === 'ALL' || !t.areaCode) {
        return canManageOrgRecord(currentUser || null, {
          companyCode: t.companyCode,
          areaCode: currentUser?.areaCode,
        });
      }
      return canViewEduRecord(currentUser || null, {
        companyCode: t.companyCode,
        areaCode: t.areaCode,
      });
    });
  }, [isAdmin, eduTopics, currentUser]);

  const scopedEduAssignments = React.useMemo(() => {
    if (isAdmin) return eduAssignments;
    return eduAssignments.filter((a) =>
      canViewEduRecord(currentUser || null, {
        companyCode: a.companyCode,
        areaCode: a.areaCode,
        assignedByUid: a.assignedByUid,
        memberId: a.memberId,
      })
    );
  }, [isAdmin, eduAssignments, currentUser]);

  const scopedEduCms = React.useMemo(() => {
    if (isAdmin) return eduCmsProfiles;
    return eduCmsProfiles.filter((c) =>
      canViewEduRecord(currentUser || null, {
        companyCode: c.companyCode,
        areaCode: c.areaCode,
        ownerUid: c.ownerUid,
      })
    );
  }, [isAdmin, eduCmsProfiles, currentUser]);

  const scopedWorkSchedules = React.useMemo(() => {
    if (isAdmin) return workSchedules;
    const ownMemberId = currentUser?.memberId || (currentUser ? `m-${currentUser.id}` : '');
    return workSchedules.filter(
      (w) =>
        w.ownerUid === currentUser?.id ||
        (w.ownerMemberId && w.ownerMemberId === ownMemberId) ||
        canManageOrgRecord(currentUser || null, {
          companyCode: w.companyCode,
          areaCode: w.areaCode,
          unitCode: w.ownerUnitCode,
        })
    );
  }, [isAdmin, workSchedules, currentUser]);

  const canCreateCompany = isAdmin;
  const canDeleteCompany = isAdmin;
  const canEditCompany = (comp: Company) =>
    isAdmin ||
    ((currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER') &&
      viewerCompanyScope.has(normalizeOrgCode(comp.code)));

  const canCreateArea =
    isAdmin || currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER';
  const canDeleteArea = (area: Area) =>
    isAdmin ||
    ((currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER') &&
      viewerCompanyScope.has(normalizeOrgCode(area.companyCode)));
  const canEditArea = (area: Area) =>
    isAdmin ||
    ((currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER') &&
      viewerCompanyScope.has(normalizeOrgCode(area.companyCode))) ||
    (currentUser?.role === 'AREA_LEADER' && matchesViewerArea(area, true));

  const canModifyDepartments = isAdmin;
  const canModifyMember = (mem: Member) =>
    isAdmin || canManageOrgRecord(currentUser || null, mem);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deleteAttachedMode, setDeleteAttachedMode] =
    useState<OrgDeleteAttachedMode>('PENDING_REASSIGN');
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    title: string;
    hasAttachedOptions?: boolean;
    attachedSummary?: string;
    onConfirm: (mode: OrgDeleteAttachedMode) => Promise<void> | void;
  } | null>(null);
  const [isDeletingConfirm, setIsDeletingConfirm] = useState<boolean>(false);

  // File input refs
  const configFileRef = useRef<HTMLInputElement>(null);
  const memberFileRef = useRef<HTMLInputElement>(null);

  // Excel preview states
  const [configPreview, setConfigPreview] = useState<{
    companies: Company[];
    areas: Area[];
    departments: Department[];
    errors: string[];
    fileName: string;
  } | null>(null);

  const [membersPreview, setMembersPreview] = useState<{
    members: Member[];
    errors: string[];
    fileName: string;
  } | null>(null);

  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');

  // Bộ lọc cho Trung tâm Xuất Excel Admin (3 tầng Sion -> Khu vực -> Cá nhân)
  const [memExportCompany, setMemExportCompany] = useState<string>('ALL');
  const [memExportArea, setMemExportArea] = useState<string>('ALL');
  const [memExportMemberId, setMemExportMemberId] = useState<string>('ALL');

  const [mdExportCompany, setMdExportCompany] = useState<string>('ALL');
  const [mdExportArea, setMdExportArea] = useState<string>('ALL');
  const [mdExportOwnerKey, setMdExportOwnerKey] = useState<string>('ALL');
  const [mdExportStatus, setMdExportStatus] = useState<'ALL' | 'ACTIVE' | 'STOPPED'>('ALL');

  const [adminReportPeriod, setAdminReportPeriod] = useState<DailyReportExportPeriod>('MONTH');
  const [adminReportCompany, setAdminReportCompany] = useState<string>('ALL');
  const [adminReportArea, setAdminReportArea] = useState<string>('ALL');
  const [adminReportMemberId, setAdminReportMemberId] = useState<string>('ALL');

  const [eduExportCompany, setEduExportCompany] = useState<string>('ALL');
  const [eduExportArea, setEduExportArea] = useState<string>('ALL');

  const [wsExportPeriod, setWsExportPeriod] = useState<WorkScheduleExportPeriod>('WEEK');
  const [wsExportDate, setWsExportDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  });
  const [wsExportCompany, setWsExportCompany] = useState<string>('ALL');
  const [wsExportArea, setWsExportArea] = useState<string>('ALL');
  const [wsExportOwnerKey, setWsExportOwnerKey] = useState<string>('ALL');

  // Cụm Sion state
  const clustersList = clustersConfig?.clusters || [];
  const [isClusterFormOpen, setIsClusterFormOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<OrgCluster | null>(null);
  const [clusterCode, setClusterCode] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [clusterDesc, setClusterDesc] = useState('');
  const [clusterCompanyCodes, setClusterCompanyCodes] = useState<string[]>([]);
  const [clusterIsCatchAll, setClusterIsCatchAll] = useState(false);
  const [isSavingCluster, setIsSavingCluster] = useState(false);

  // Modals / Editing state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false);
  const [areaFilterCompany, setAreaFilterCompany] = useState<string>('ALL');
  const [newAreaCode, setNewAreaCode] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaCompany, setNewAreaCompany] = useState(
    scopedCompanies[0]?.code || companies[0]?.code || ''
  );

  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberCompany, setNewMemberCompany] = useState(
    scopedCompanies[0]?.code || companies[0]?.code || ''
  );
  const [newMemberArea, setNewMemberArea] = useState(
    scopedAreas[0]?.code || currentUser?.areaCode || ''
  );
  const [newMemberDept, setNewMemberDept] = useState(departments[0]?.code || 'Thanh Niên Nam');
  const [newMemberUnit, setNewMemberUnit] = useState(
    currentUser?.role === 'UNI_LEADER'
      ? currentUser?.unitCode ||
          currentUser?.managedUnitCodes?.[0] ||
          currentUser?.departmentCode ||
          ''
      : ''
  );

  React.useEffect(() => {
    const compPool = isAdmin ? companies : scopedCompanies;
    if (compPool.length === 0) {
      if (newAreaCompany) setNewAreaCompany('');
      if (newMemberCompany) setNewMemberCompany('');
    } else {
      if (!compPool.some((c) => c.code === newAreaCompany)) {
        setNewAreaCompany(compPool[0].code);
      }
      if (!compPool.some((c) => c.code === newMemberCompany)) {
        setNewMemberCompany(compPool[0].code);
      }
    }

    const memberAreasForComp = (isAdmin ? areas : scopedAreas).filter(
      (a) => !newMemberCompany || normalizeOrgCode(a.companyCode) === normalizeOrgCode(newMemberCompany)
    );
    if (memberAreasForComp.length === 0) {
      if (newMemberArea && !isAdmin) setNewMemberArea('');
      else if (newMemberArea && !(isAdmin ? areas : scopedAreas).some((a) => a.code === newMemberArea)) {
        setNewMemberArea('');
      }
    } else if (!memberAreasForComp.some((a) => a.code === newMemberArea)) {
      setNewMemberArea(memberAreasForComp[0].code);
    }

    if (!isAdmin && currentUser?.role === 'UNI_LEADER') {
      const ownU =
        currentUser.managedUnitCodes?.[0] ||
        currentUser.unitCode ||
        currentUser.departmentCode ||
        '';
      if (ownU && !viewerUnitScope.has(normalizeOrgCode(newMemberUnit))) {
        setNewMemberUnit(ownU);
      }
    }
  }, [
    isAdmin,
    companies,
    areas,
    scopedCompanies,
    scopedAreas,
    newAreaCompany,
    newMemberCompany,
    newMemberArea,
    newMemberUnit,
    currentUser?.role,
    currentUser?.unitCode,
    currentUser?.managedUnitCodes,
    currentUser?.departmentCode,
    viewerUnitScope,
  ]);

  // Handlers for Cụm Sion
  const openCreateClusterForm = () => {
    setEditingCluster(null);
    setClusterCode('');
    setClusterName('');
    setClusterDesc('');
    setClusterCompanyCodes([]);
    setClusterIsCatchAll(false);
    setIsClusterFormOpen(true);
  };

  const openEditClusterForm = (cl: OrgCluster) => {
    setEditingCluster(cl);
    setClusterCode(cl.code);
    setClusterName(cl.name);
    setClusterDesc(cl.description || '');
    setClusterCompanyCodes(cl.companyCodes || []);
    setClusterIsCatchAll(Boolean(cl.isCatchAll));
    setIsClusterFormOpen(true);
  };

  const saveClustersList = async (nextClusters: OrgCluster[], successMsg: string) => {
    if (!onSaveClustersConfig) return;
    setIsSavingCluster(true);
    try {
      const res = await onSaveClustersConfig({
        ...(clustersConfig || {}),
        clusters: nextClusters,
      });
      const syncSuffix =
        res?.syncedCount > 0
          ? ` Đã tự động đồng bộ quyền cho ${res.syncedCount} tài khoản QL Cụm.`
          : '';
      onShowNotification(`${successMsg}${syncSuffix}`);
    } catch (err: any) {
      onShowNotification(`Lỗi lưu Cụm Sion: ${err?.message || 'Thao tác thất bại'}`);
    } finally {
      setIsSavingCluster(false);
    }
  };

  const handleInitDefaultClusters = async () => {
    const defaultClusters = createDefaultClustersForCompanies(companies);
    await saveClustersList(
      defaultClusters,
      'Đã khởi tạo 5 Cụm Sion mẫu (TH1, ÊLI, HBC, PER, YSAC) thành công!'
    );
  };

  const handleSubmitClusterForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = clusterCode.trim();
    const cleanName = clusterName.trim() || cleanCode;
    if (!cleanCode) {
      onShowNotification('Vui lòng nhập Mã Cụm Sion (VD: ÊLI, HBC, PER...).');
      return;
    }
    const normCode = normalizeOrgCode(cleanCode);
    const duplicate = clustersList.find(
      (c) =>
        normalizeOrgCode(c.code) === normCode &&
        (!editingCluster || c.id !== editingCluster.id)
    );
    if (duplicate) {
      onShowNotification(`Mã Cụm "${cleanCode}" đã tồn tại.`);
      return;
    }

    const baseId =
      editingCluster?.id ||
      `cluster-${normCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    const nextCluster: OrgCluster = {
      id: baseId,
      code: cleanCode,
      name: cleanName,
      companyCodes: clusterIsCatchAll ? [] : clusterCompanyCodes,
      isCatchAll: clusterIsCatchAll,
      description: clusterDesc.trim() || undefined,
      active: true,
    };

    const normalizedExisting = clustersList.map((c) =>
      clusterIsCatchAll && c.id !== nextCluster.id && c.isCatchAll
        ? { ...c, isCatchAll: false }
        : c
    );

    const nextClusters = editingCluster
      ? normalizedExisting.map((c) => (c.id === editingCluster.id ? nextCluster : c))
      : [...normalizedExisting, nextCluster];

    await saveClustersList(
      nextClusters,
      editingCluster
        ? `Đã cập nhật Cụm Sion "${cleanName}"!`
        : `Đã tạo Cụm Sion "${cleanName}"!`
    );
    setIsClusterFormOpen(false);
    setEditingCluster(null);
  };

  const toggleClusterCompany = (compCode: string) => {
    const norm = normalizeOrgCode(compCode);
    setClusterCompanyCodes((prev) =>
      prev.some((c) => normalizeOrgCode(c) === norm)
        ? prev.filter((c) => normalizeOrgCode(c) !== norm)
        : [...prev, compCode]
    );
  };

  // Handlers for Company
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCompanyCode.trim();
    const cleanName = newCompanyName.trim();
    if (!cleanCode || !cleanName) {
      onShowNotification('Vui lòng điền đủ mã và tên công ty.');
      return;
    }
    const normCode = normalizeOrgCode(cleanCode);
    if (companies.some((c) => normalizeOrgCode(c.code) === normCode)) {
      onShowNotification(`Mã Sion "${cleanCode}" đã tồn tại.`);
      return;
    }
    const ok = await onAddCompany({
      code: cleanCode,
      name: cleanName,
      active: true,
    });
    if (ok === false) return;
    setNewCompanyCode('');
    setNewCompanyName('');
    setIsAddCompanyOpen(false);
    onShowNotification('Đã thêm công ty mới thành công!');
  };

  const handleUpdateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    const ok = await onUpdateCompany(editingCompany);
    if (ok === false) return;
    setEditingCompany(null);
    onShowNotification('Đã cập nhật công ty thành công!');
  };

  // Handlers for Area (tách độc lập theo từng Sion — cho phép trùng mã/tên giữa các Sion khác nhau)
  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = cleanRawAreaCode(newAreaCode);
    const cleanName = newAreaName.trim() || cleanCode;
    if (!cleanCode) {
      onShowNotification('Vui lòng điền mã/số khu vực (VD: 1.1).');
      return;
    }
    const targetCompNorm = normalizeOrgCode(newAreaCompany);
    const targetCodeNorm = normalizeOrgCode(cleanCode);
    const duplicateInSameSion = areas.find(
      (a) =>
        normalizeOrgCode(a.companyCode) === targetCompNorm &&
        normalizeOrgCode(cleanRawAreaCode(a.code)) === targetCodeNorm
    );
    if (duplicateInSameSion) {
      onShowNotification(
        `Khu vực "${cleanCode}" đã tồn tại bên trong Sion ${newAreaCompany}.`
      );
      return;
    }
    const ok = await onAddArea({
      code: cleanCode,
      name: cleanName,
      companyCode: newAreaCompany,
      active: true,
    });
    if (ok === false) return;
    setNewAreaCode('');
    setNewAreaName('');
    setIsAddAreaOpen(false);
    onShowNotification(`Đã thêm ${formatAreaDisplayName(cleanCode, cleanName)} cho Sion ${newAreaCompany}!`);
  };

  const handleUpdateAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;
    const cleanCode = cleanRawAreaCode(editingArea.code);
    const cleanName = editingArea.name.trim() || cleanCode;
    if (!cleanCode) {
      onShowNotification('Vui lòng điền mã/số khu vực.');
      return;
    }
    const targetCompNorm = normalizeOrgCode(editingArea.companyCode);
    const targetCodeNorm = normalizeOrgCode(cleanCode);
    const duplicateInSameSion = areas.find(
      (a) =>
        a.id !== editingArea.id &&
        normalizeOrgCode(a.companyCode) === targetCompNorm &&
        normalizeOrgCode(cleanRawAreaCode(a.code)) === targetCodeNorm
    );
    if (duplicateInSameSion) {
      onShowNotification(
        `Khu vực "${cleanCode}" đã tồn tại bên trong Sion ${editingArea.companyCode}.`
      );
      return;
    }
    const ok = await onUpdateArea({
      ...editingArea,
      code: cleanCode,
      name: cleanName,
    });
    if (ok === false) return;
    setEditingArea(null);
    onShowNotification('Đã cập nhật khu vực thành công!');
  };

  // Handlers for Department
  const handleSaveDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      onShowNotification('Vui lòng điền tên ban ngành.');
      return;
    }
    onAddDepartment({
      code: newDeptCode.trim() || newDeptName.trim(),
      name: newDeptName.trim(),
      active: true,
    });
    setNewDeptCode('');
    setNewDeptName('');
    setIsAddDepartmentOpen(false);
    onShowNotification('Đã thêm ban ngành mới thành công!');
  };

  const handleUpdateDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDepartment) return;
    onUpdateDepartment(editingDepartment);
    setEditingDepartment(null);
    onShowNotification('Đã cập nhật ban ngành thành công!');
  };

  // Handlers for Member
  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      onShowNotification('Vui lòng điền họ tên cá nhân.');
      return;
    }
    const resolvedMemberUnit =
      newMemberUnit.trim() ||
      (currentUser?.role === 'UNI_LEADER'
        ? currentUser.unitCode ||
          currentUser.managedUnitCodes?.[0] ||
          currentUser.departmentCode ||
          ''
        : '');
    onAddMember({
      fullName: newMemberName.trim(),
      companyCode: newMemberCompany,
      areaCode: newMemberArea,
      departmentCode: newMemberDept,
      unitCode: resolvedMemberUnit || undefined,
      active: true,
      goals: { s1: 10, s2: 8, s3: 5, s4: 4, s5: 4, s6: 2 },
      results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
    });
    setNewMemberName('');
    setNewMemberUnit(
      currentUser?.role === 'UNI_LEADER'
        ? currentUser.unitCode ||
            currentUser.managedUnitCodes?.[0] ||
            currentUser.departmentCode ||
            ''
        : ''
    );
    setIsAddMemberOpen(false);
    onShowNotification('Đã thêm thành viên mới thành công!');
  };

  const handleUpdateMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    onUpdateMember(editingMember);
    setEditingMember(null);
    onShowNotification('Đã cập nhật thông tin thành viên thành công!');
  };

  // Excel Import Handlers
  const handleConfigFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await parseConfigExcel(file);
      setConfigPreview({
        ...res,
        fileName: file.name,
      });
    } catch (err: any) {
      onShowNotification(`Lỗi đọc file Excel: ${err?.message || 'Định dạng không hợp lệ'}`);
    } finally {
      if (configFileRef.current) configFileRef.current.value = '';
    }
  };

  const handleMemberFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await parseMembersExcel(file);
      setMembersPreview({
        ...res,
        fileName: file.name,
      });
    } catch (err: any) {
      onShowNotification(`Lỗi đọc file Excel: ${err?.message || 'Định dạng không hợp lệ'}`);
    } finally {
      if (memberFileRef.current) memberFileRef.current.value = '';
    }
  };

  const handleConfirmConfigImport = () => {
    if (!configPreview) return;
    if (configPreview.companies.length > 0 && onBatchUpdateCompanies) {
      onBatchUpdateCompanies(configPreview.companies, importMode);
    }
    if (configPreview.areas.length > 0 && onBatchUpdateAreas) {
      onBatchUpdateAreas(configPreview.areas, importMode);
    }
    if (configPreview.departments.length > 0 && onBatchUpdateDepartments) {
      onBatchUpdateDepartments(configPreview.departments, importMode);
    }
    onShowNotification(`Đã nhập thành công cấu hình hệ thống từ file ${configPreview.fileName}!`);
    setConfigPreview(null);
  };

  const handleConfirmMembersImport = () => {
    if (!membersPreview) return;
    if (membersPreview.members.length > 0 && onBatchUpdateMembers) {
      onBatchUpdateMembers(membersPreview.members, importMode);
    }
    onShowNotification(`Đã nhập thành công ${membersPreview.members.length} thành viên từ file ${membersPreview.fileName}!`);
    setMembersPreview(null);
  };

  return (
    <section id="admin-section" className="scroll-mt-20 my-10">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={configFileRef}
        onChange={handleConfigFileChange}
        accept=".xlsx,.xls"
        className="hidden"
      />
      <input
        type="file"
        ref={memberFileRef}
        onChange={handleMemberFileChange}
        accept=".xlsx,.xls"
        className="hidden"
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-sm border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 sm:pb-3.5 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <div className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-0.5 rounded-lg mb-1">
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>{isAdmin ? 'Quản trị Hệ thống' : 'Quản trị Đơn vị'}</span>
            </div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600 sm:hidden" />
              <span>
                {isAdmin ? 'Bảng Điều Khiển Quản Trị' : 'Tổ Chức, Nhân Sự & Phân Quyền'}
              </span>
            </h2>
          </div>

          {isAdmin && pendingApprovalCount > 0 && activeTab !== 'ROLES' && (
            <button
              type="button"
              onClick={() => setActiveTab('ROLES')}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>{pendingApprovalCount} đăng ký chờ duyệt →</span>
            </button>
          )}
        </div>

        {(() => {
          const allAdminNavGroups: {
            groupKey: string;
            groupTitle: string;
            shortTitle: string;
            groupIcon: React.ComponentType<{ className?: string }>;
            alertCount?: number;
            items: {
              id: AdminSectionId;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
              badge?: string;
              isAlert?: boolean;
            }[];
          }[] = [
            ...(isAdmin
              ? [
                  {
                    groupKey: 'COMPETITION',
                    groupTitle: '1. Thi đua & Event',
                    shortTitle: 'Thi đua & Event',
                    groupIcon: Trophy,
                    items: [
                      { id: 'SCORING' as AdminSectionId, label: 'Bảng điểm mặc định', icon: Scale, badge: '7 mục' },
                      { id: 'EVENTS' as AdminSectionId, label: 'Quản lý Event', icon: Trophy, badge: `${events.length}` },
                    ],
                  },
                  {
                    groupKey: 'DISPLAY',
                    groupTitle: '2. Giao diện & Hiển thị',
                    shortTitle: 'Giao diện',
                    groupIcon: LayoutGrid,
                    items: [
                      { id: 'BANNER' as AdminSectionId, label: 'Banner Trang chủ', icon: ImageIcon },
                      { id: 'APPEARANCE_FONT' as AdminSectionId, label: 'Font, Cỡ chữ & Logo', icon: Type },
                      { id: 'APPEARANCE_HOME' as AdminSectionId, label: 'Bố cục Trang chủ', icon: Home },
                      { id: 'APPEARANCE_LLV' as AdminSectionId, label: 'Bố cục trang LLV', icon: CalendarDays },
                      { id: 'APPEARANCE_HONORS' as AdminSectionId, label: 'Bảng Vinh danh', icon: LayoutGrid },
                    ],
                  },
                ]
              : []),
            {
              groupKey: 'ORG',
              groupTitle: isAdmin ? '3. Tổ chức & Nhân sự' : '1. Tổ chức & Nhân sự',
              shortTitle: 'Tổ chức & NS',
              groupIcon: Building2,
              items: [
                { id: 'CLUSTERS', label: 'Cụm Sion', icon: Layers, badge: `${clustersList.length}` },
                { id: 'COMPANIES', label: 'Sion / Công ty', icon: Building2, badge: `${scopedCompanies.length}` },
                { id: 'REGIONS', label: 'Địa vực', icon: MapPinned, badge: `${regions.filter((r) => scopedCompanies.some((c) => normalizeOrgCode(c.code) === normalizeOrgCode(r.companyCode))).length}` },
                { id: 'AREAS', label: 'Khu vực', icon: MapPin, badge: `${scopedAreas.length}` },
                { id: 'DEPARTMENTS', label: 'Ban ngành', icon: Users2, badge: `${departments.length}` },
                { id: 'MEMBERS', label: 'Thành viên', icon: User, badge: `${scopedMembers.length}` },
              ],
            },
            {
              groupKey: 'SYSTEM',
              groupTitle: isAdmin ? '4. Hệ thống & Dữ liệu' : '2. Phân quyền & Báo cáo',
              shortTitle: isAdmin ? 'Hệ thống' : 'PQ & Báo cáo',
              groupIcon: Crown,
              alertCount: isAdmin ? pendingApprovalCount : 0,
              items: [
                {
                  id: 'ROLES',
                  label: isAdmin ? 'Phân quyền & Duyệt' : `Phân quyền (≤ Cấp ${Math.max(1, actorRoleLevel - 1)})`,
                  icon: Crown,
                  badge:
                    isAdmin && pendingApprovalCount > 0
                      ? `${pendingApprovalCount} chờ`
                      : usersList
                      ? `${usersList.length}`
                      : undefined,
                  isAlert: isAdmin && pendingApprovalCount > 0,
                },
                ...(canDownloadExcel
                  ? [
                      {
                        id: 'EXCEL_SYNC' as AdminSectionId,
                        label: isAdmin ? 'Nhập / Xuất Excel' : 'Xuất Báo cáo',
                        icon: FileSpreadsheet,
                        badge: isAdmin ? undefined : '5 loại',
                      },
                    ]
                  : []),
                ...(isAdmin
                  ? [
                      {
                        id: 'VOCABULARY' as AdminSectionId,
                        label: 'Từ điển mã hóa',
                        icon: BookOpenCheck,
                        badge: `${vocabularyConfig?.rules?.length || DEFAULT_VOCABULARY_CONFIG.rules.length}`,
                      },
                    ]
                  : []),
              ],
            },
          ];

          const adminNavGroups = allAdminNavGroups;

          const activeGroup =
            adminNavGroups.find((g) => g.items.some((it) => it.id === activeTab)) ||
            adminNavGroups[0];

          return (
            <>
              {/* Mobile / Tablet Menu 2 tầng hiển thị trực tiếp */}
              <div className="lg:hidden mt-2.5 space-y-2 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-2">
                {/* Tầng 1: Nhóm chính */}
                <div className={`grid gap-1.5 ${isAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
                  {adminNavGroups.map((grp, idx) => {
                    const GroupIcon = grp.groupIcon;
                    const isGroupActive = grp.groupKey === activeGroup.groupKey;
                    return (
                      <button
                        key={grp.groupKey}
                        type="button"
                        onClick={() => {
                          if (!grp.items.some((it) => it.id === activeTab)) {
                            setActiveTab(grp.items[0].id);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-left text-xs font-extrabold transition cursor-pointer border ${
                          isGroupActive
                            ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                        }`}
                      >
                        <GroupIcon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isGroupActive ? 'text-amber-300' : 'text-purple-600 dark:text-purple-400'
                          }`}
                        />
                        <span className="truncate">
                          {idx + 1}. {grp.shortTitle}
                        </span>
                        {!!grp.alertCount && grp.alertCount > 0 && (
                          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black leading-none tabular-nums">
                            {grp.alertCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tầng 2: Các tính năng con của nhóm đang chọn */}
                <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80">
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                    {activeGroup.items.map((item) => {
                      const Icon = item.icon;
                      const isItemActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`flex items-center justify-between gap-1.5 px-2.5 h-9 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isItemActive
                              ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Icon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isItemActive ? 'text-amber-300' : 'text-slate-400 dark:text-slate-500'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums shrink-0 ${
                                item.isAlert
                                  ? 'bg-rose-600 text-white'
                                  : isItemActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SaaS Admin Workspace: Grouped Sidebar (Left) + Active Panel (Right) */}
              <div className="mt-3 sm:mt-4 grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-3.5 sm:gap-5 items-start">
                {/* Desktop Grouped Admin Sidebar */}
                <aside className="hidden lg:block sticky top-20 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3 space-y-4">
                  {adminNavGroups.map((grp) => (
                    <div key={grp.groupTitle} className="space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {grp.groupTitle}
                      </div>
                      <div className="space-y-0.5">
                        {grp.items.map((item) => {
                          const Icon = item.icon;
                          const active = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveTab(item.id)}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                                active
                                  ? 'bg-blue-700 text-white shadow-xs'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <Icon
                                  className={`w-4 h-4 shrink-0 ${
                                    active ? 'text-amber-300' : 'text-slate-400 dark:text-slate-500'
                                  }`}
                                />
                                <span className="truncate">{item.label}</span>
                              </span>
                              {item.badge && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums shrink-0 ${
                                    item.isAlert
                                      ? 'bg-rose-600 text-white'
                                      : active
                                      ? 'bg-white/20 text-white'
                                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </aside>

                {/* Main Admin Content Area */}
                <div className="min-w-0">
        {/* TAB 0: CỤM SION */}
        {activeTab === 'CLUSTERS' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Danh sách Cụm Sion ({clustersList.length} cụm)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Gom nhóm các Sion có sẵn thành Cụm. Khi thêm/bớt Sion trong Cụm, quyền của các QL Cụm (MANAGER) gán Cụm đó sẽ tự động đồng bộ.
                </p>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {clustersList.length === 0 ? (
                    <button
                      type="button"
                      disabled={isSavingCluster}
                      onClick={handleInitDefaultClusters}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Khởi tạo 5 cụm mẫu (TH1, ÊLI, HBC, PER, YSAC)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSavingCluster}
                      onClick={() =>
                        setConfirmDeleteTarget({
                          title:
                            'Khôi phục 5 Cụm Sion mẫu (TH1, ÊLI, HBC, PER, YSAC)? Danh sách Cụm hiện tại sẽ được thay thế bằng 5 Cụm mẫu và tự động đồng bộ lại cho các QL Cụm.',
                          onConfirm: () => {
                            void handleInitDefaultClusters();
                          },
                        })
                      }
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Nạp 5 cụm mẫu</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openCreateClusterForm}
                    className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Cụm Sion</span>
                  </button>
                </div>
              )}
            </div>

            {isClusterFormOpen && isAdmin && (
              <form
                onSubmit={handleSubmitClusterForm}
                className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/70 space-y-3 animate-in fade-in"
              >
                <div className="font-bold text-xs text-amber-950 dark:text-amber-200">
                  {editingCluster ? `Chỉnh sửa Cụm Sion: ${editingCluster.name}` : 'Tạo Cụm Sion mới'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Mã Cụm <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={clusterCode}
                      onChange={(e) => setClusterCode(e.target.value)}
                      placeholder="VD: ÊLI, HBC, PER, YSAC..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Tên Cụm <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={clusterName}
                      onChange={(e) => setClusterName(e.target.value)}
                      placeholder="VD: ÊLI"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Mô tả ngắn
                    </label>
                    <input
                      type="text"
                      value={clusterDesc}
                      onChange={(e) => setClusterDesc(e.target.value)}
                      placeholder="Ghi chú phạm vi cụm..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setClusterIsCatchAll((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      clusterIsCatchAll
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {clusterIsCatchAll ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    <span>Cụm "Còn lại" (tự động gom toàn bộ Sion chưa thuộc cụm khác)</span>
                  </button>
                </div>

                {clusterIsCatchAll ? (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-bold text-amber-800 dark:text-amber-300 mb-1">
                      Danh sách Sion tự động thuộc cụm "Còn lại":
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {resolveClusterCompanyCodes(
                        {
                          id: editingCluster?.id || '__draft_catchall__',
                          code: clusterCode || 'YSAC',
                          name: clusterName || 'YSAC',
                          companyCodes: [],
                          isCatchAll: true,
                          active: true,
                        },
                        clustersList.map((c) =>
                          editingCluster && c.id === editingCluster.id
                            ? { ...c, isCatchAll: true }
                            : { ...c, isCatchAll: false }
                        ),
                        companies
                      ).map((code) => (
                        <span
                          key={code}
                          className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[11px]"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      Chọn các Sion có sẵn trực thuộc Cụm này ({clusterCompanyCodes.length} đã chọn):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {companies.map((c) => {
                        const checked = clusterCompanyCodes.some(
                          (cc) => normalizeOrgCode(cc) === normalizeOrgCode(c.code)
                        );
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleClusterCompany(c.code)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                              checked
                                ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 shrink-0" />}
                            <span>
                              {c.code} · {c.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSavingCluster}
                    onClick={() => {
                      setIsClusterFormOpen(false);
                      setEditingCluster(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCluster}
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCluster
                      ? 'Đang lưu & đồng bộ...'
                      : editingCluster
                      ? 'Cập nhật Cụm Sion'
                      : 'Lưu Cụm Sion'}
                  </button>
                </div>
              </form>
            )}

            {clustersList.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2 bg-slate-50/70 dark:bg-slate-900/40">
                <Layers className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="font-bold text-sm text-slate-800 dark:text-white">
                  Chưa có Cụm Sion nào được cấu hình
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {isAdmin
                    ? 'Bấm nút "Khởi tạo 5 cụm mẫu (TH1, ÊLI, HBC, PER, YSAC)" ở góc trên để tạo nhanh cấu hình cụm từ các Sion hiện có, sau đó có thể chỉnh sửa hoặc mở rộng thêm.'
                    : 'Liên hệ Quản trị viên để cấu hình danh sách Cụm Sion.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Mã / Tên Cụm</th>
                      <th className="py-3 px-4">Danh sách Sion trực thuộc</th>
                      <th className="py-3 px-4 text-center">Khu vực</th>
                      <th className="py-3 px-4 text-center">Thành viên</th>
                      <th className="py-3 px-4 text-center">QL Cụm gán</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {clustersList.map((cl) => {
                      const resolvedSions = resolveClusterCompanyCodes(cl, clustersList, companies);
                      const resolvedNorms = new Set(resolvedSions.map(normalizeOrgCode));
                      const clAreasCount = scopedAreas.filter((a) =>
                        resolvedNorms.has(normalizeOrgCode(a.companyCode))
                      ).length;
                      const clMembersCount = scopedMembers.filter((m) =>
                        resolvedNorms.has(normalizeOrgCode(m.companyCode))
                      ).length;
                      const linkedManagers = (usersList || []).filter(
                        (u) =>
                          u.role === 'MANAGER' &&
                          (u.managedClusterIds || []).some(
                            (id) => id === cl.id || normalizeOrgCode(id) === normalizeOrgCode(cl.code)
                          )
                      );

                      return (
                        <tr key={cl.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-amber-700 dark:text-amber-300 text-sm">
                                {cl.name || cl.code}
                              </span>
                              {cl.code !== cl.name && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                  {cl.code}
                                </span>
                              )}
                              {cl.isCatchAll && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold">
                                  Tự động · Còn lại
                                </span>
                              )}
                            </div>
                            {cl.description && (
                              <div className="text-[11px] text-slate-400 mt-0.5">{cl.description}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {resolvedSions.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">Chưa có Sion</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {resolvedSions.map((code) => (
                                  <span
                                    key={code}
                                    className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200/70 dark:border-blue-800/60 font-bold text-[11px]"
                                  >
                                    {code}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">
                            {clAreasCount} KV
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-600 dark:text-slate-300">
                            {clMembersCount} người
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                linkedManagers.length > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                              title={linkedManagers.map((m) => m.fullName).join(', ')}
                            >
                              {linkedManagers.length} QL Cụm · Auto-sync
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openEditClusterForm(cl)}
                                className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition cursor-pointer"
                                title="Chỉnh sửa Cụm Sion"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteTarget({
                                    title: `Xóa Cụm Sion "${cl.name}"? Các Sion bên trong vẫn giữ nguyên trong hệ thống.`,
                                    onConfirm: () => {
                                      const next = clustersList.filter((x) => x.id !== cl.id);
                                      void saveClustersList(
                                        next,
                                        `Đã xóa Cụm Sion "${cl.name}".`
                                      );
                                    },
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa Cụm Sion"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: COMPANIES */}
        {activeTab === 'COMPANIES' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-sm text-slate-800">Danh sách các Sion / Công ty</h3>
              <div className="flex flex-wrap items-center gap-2">
                {canCreateCompany && (
                  <button
                    onClick={() => setIsAddCompanyOpen(true)}
                    className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Công ty</span>
                  </button>
                )}
              </div>
            </div>

            {/* Add Company Form */}
            {isAddCompanyOpen && (
              <form onSubmit={handleSaveCompany} className="mb-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-200 animate-in fade-in">
                <div className="font-bold text-xs text-blue-950 mb-3">Thêm Công ty mới</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã Cty (ví dụ: Th4, HN, ĐN...)</label>
                    <input
                      type="text"
                      value={newCompanyCode}
                      onChange={(e) => setNewCompanyCode(e.target.value)}
                      placeholder="Th4"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên đầy đủ của Công ty</label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Thương Hội 4 (Th4)"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCompanyOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Lưu Công ty
                  </button>
                </div>
              </form>
            )}

            {/* Companies Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Mã Cty</th>
                    <th className="py-3 px-4">Tên Công ty</th>
                    <th className="py-3 px-4 text-center">Số khu vực</th>
                    <th className="py-3 px-4 text-center">Số thành viên</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedCompanies.map((comp) => {
                    const compNorm = normalizeOrgCode(comp.code);
                    const compAreas = scopedAreas.filter(
                      (a) => normalizeOrgCode(a.companyCode) === compNorm
                    );
                    const compMembers = scopedMembers.filter(
                      (m) => normalizeOrgCode(m.companyCode) === compNorm
                    );
                    const canEditThisComp = canEditCompany(comp);

                    return (
                      <tr key={comp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-black text-blue-700 text-sm">{comp.code}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{comp.name}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-600">{compAreas.length} KV</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-600">{compMembers.length} người</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                            comp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {comp.active ? 'Hoạt động' : 'Tạm dừng'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {canEditThisComp ? (
                            <button
                              onClick={() => setEditingCompany(comp)}
                              className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition cursor-pointer"
                              title="Chỉnh sửa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Chỉ xem</span>
                          )}
                          {canDeleteCompany && (
                            <button
                              onClick={() => {
                                const attachedUsersCount = (usersList || []).filter(
                                  (u) =>
                                    resolveUserApprovalStatus(u) !== 'REJECTED' &&
                                    u.id !== currentUser?.id &&
                                    u.role !== 'SUPER_ADMIN' &&
                                    u.role !== 'ADMIN' &&
                                    normalizeOrgCode(u.companyCode) === compNorm
                                ).length;
                                const attachedMembersCount = members.filter(
                                  (m) => normalizeOrgCode(m.companyCode) === compNorm
                                ).length;
                                const childRegionsCount = regions.filter(
                                  (r) => normalizeOrgCode(r.companyCode) === compNorm
                                ).length;
                                const cascadeParts: string[] = [];
                                if (compAreas.length > 0) cascadeParts.push(`${compAreas.length} khu vực`);
                                if (childRegionsCount > 0) cascadeParts.push(`${childRegionsCount} địa vực`);
                                const cascadeNote =
                                  cascadeParts.length > 0
                                    ? ` Sẽ xóa kèm ${cascadeParts.join(' và ')} trực thuộc.`
                                    : '';
                                const hasAttached =
                                  attachedUsersCount > 0 || attachedMembersCount > 0;
                                setDeleteAttachedMode('PENDING_REASSIGN');
                                setConfirmDeleteTarget({
                                  title: `Xóa vĩnh viễn Sion ${comp.name} (${comp.code})?${cascadeNote}`,
                                  hasAttachedOptions: hasAttached,
                                  attachedSummary: hasAttached
                                    ? `Hiện có ${attachedUsersCount} tài khoản và ${attachedMembersCount} thành viên thuộc Sion này.`
                                    : undefined,
                                  onConfirm: async (mode) => {
                                    await onDeleteCompany(comp.id, mode);
                                  },
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Xóa công ty"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Edit Company Modal */}
            {editingCompany && (
              <div
                onClick={() => setEditingCompany(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              >
                <form
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleUpdateCompanySubmit}
                  className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 cursor-default"
                >
                  <h4 className="font-bold text-base text-slate-900 mb-4">Chỉnh sửa Công ty</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Mã Công ty</label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={editingCompany.code}
                        onChange={(e) => setEditingCompany({ ...editingCompany, code: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tên Công ty</label>
                      <input
                        type="text"
                        value={editingCompany.name}
                        onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCompany(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                    >
                      Cập nhật
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AREAS */}
        {activeTab === 'REGIONS' && (
          <AdminRegionsTab
            regions={regions}
            companies={scopedCompanies}
            areas={scopedAreas}
            members={scopedMembers}
            isAdmin={isAdmin}
            canManageCompany={(code: string) =>
              isAdmin ||
              ((currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER') &&
                viewerCompanyScope.has(normalizeOrgCode(code)))
            }
            onAddRegion={(r: Omit<Region, 'id'>) => onAddRegion?.(r)}
            onUpdateRegion={(r: Region) => onUpdateRegion?.(r)}
            onDeleteRegion={(id: string) => onDeleteRegion?.(id)}
            onShowNotification={onShowNotification}
            requestConfirm={setConfirmDeleteTarget}
          />
        )}

        {activeTab === 'AREAS' && (
          <div className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  Danh sách Khu vực theo từng Sion
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mỗi Sion có danh sách Khu vực độc lập (có thể dùng cùng mã/tên KV ở các Sion khác nhau).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <CustomSelect
                    size="sm"
                    searchable={false}
                    value={areaFilterCompany}
                    onChange={setAreaFilterCompany}
                    options={[
                      { value: 'ALL', label: 'Tất cả Sion' },
                      ...scopedCompanies.map((c) => ({
                        value: c.code,
                        label: `${c.code} · ${c.name}`,
                      })),
                    ]}
                  />
                </div>
                {canCreateArea && (
                  <button
                    onClick={() => {
                      if (areaFilterCompany !== 'ALL') {
                        setNewAreaCompany(areaFilterCompany);
                      }
                      setIsAddAreaOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Khu vực</span>
                  </button>
                )}
              </div>
            </div>

            {/* Add Area Form */}
            {isAddAreaOpen && canCreateArea && (
              <form onSubmit={handleSaveArea} className="mb-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-200 animate-in fade-in">
                <div className="font-bold text-xs text-blue-950 mb-3">Thêm Khu vực mới</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Thuộc Sion / Công ty</label>
                    <CustomSelect
                      size="sm"
                      value={newAreaCompany}
                      onChange={setNewAreaCompany}
                      options={(isAdmin ? companies : scopedCompanies).map((c) => ({
                        value: c.code,
                        label: c.name,
                        badge: c.code,
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Số / Mã KV (VD: 1.1, 2.1...)</label>
                    <input
                      type="text"
                      value={newAreaCode}
                      onChange={(e) => setNewAreaCode(e.target.value)}
                      placeholder="1.1"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên riêng (tùy chọn, mặc định = mã KV)</label>
                    <input
                      type="text"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="Để trống sẽ lưu là 1.1 (hiển thị KV 1.1)"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddAreaOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Lưu Khu vực
                  </button>
                </div>
              </form>
            )}

            {/* Areas Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Mã Khu vực</th>
                    <th className="py-3 px-4">Tên Khu vực</th>
                    <th className="py-3 px-4">Trực thuộc Sion</th>
                    <th className="py-3 px-4 text-center">Số thành viên</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedAreas
                    .filter(
                      (area) =>
                        areaFilterCompany === 'ALL' ||
                        normalizeOrgCode(area.companyCode) === normalizeOrgCode(areaFilterCompany)
                    )
                    .map((area) => {
                      const areaMembers = scopedMembers.filter(
                        (m) =>
                          normalizeOrgCode(m.companyCode) === normalizeOrgCode(area.companyCode) &&
                          normalizeOrgCode(m.areaCode) === normalizeOrgCode(area.code)
                      );
                      const editable = canEditArea(area);
                      const deletable = canDeleteArea(area);

                      return (
                        <tr key={area.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-black text-blue-700">{area.code}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {formatAreaDisplayName(area.code, area.name)}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-semibold">{area.companyCode}</td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-600">{areaMembers.length} người</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                                area.active !== false
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {area.active !== false ? 'Hoạt động' : 'Tạm ngừng'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {editable &&
                              (isAdmin ||
                                currentUser?.role === 'MANAGER' ||
                                currentUser?.role === 'SION_LEADER') && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const nextActive = area.active === false;
                                    const ok = await onUpdateArea({ ...area, active: nextActive });
                                    if (ok !== false) {
                                      onShowNotification(
                                        nextActive
                                          ? `Đã kích hoạt lại khu vực ${area.code}.`
                                          : `Đã tạm ngừng hoạt động khu vực ${area.code}.`
                                      );
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 mr-1 transition cursor-pointer"
                                  title={
                                    area.active !== false
                                      ? 'Tạm ngừng hoạt động khu vực'
                                      : 'Kích hoạt lại khu vực'
                                  }
                                >
                                  {area.active !== false ? (
                                    <ToggleRight className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <ToggleLeft className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                              )}
                            {editable ? (
                              <button
                                onClick={() => setEditingArea(area)}
                                className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition cursor-pointer"
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Chỉ xem</span>
                            )}
                            {deletable && (
                              <button
                                onClick={() => {
                                  if (!isAdmin && area.active !== false) {
                                    onShowNotification('Hãy ngừng hoạt động Khu vực trước khi xóa.');
                                    return;
                                  }
                                  const aCompNorm = normalizeOrgCode(area.companyCode);
                                  const aCodeNorm = normalizeOrgCode(cleanRawAreaCode(area.code));
                                  const attachedUsersCount = (usersList || []).filter(
                                    (u) =>
                                      resolveUserApprovalStatus(u) !== 'REJECTED' &&
                                      u.id !== currentUser?.id &&
                                      u.role !== 'SUPER_ADMIN' &&
                                      u.role !== 'ADMIN' &&
                                      normalizeOrgCode(u.companyCode) === aCompNorm &&
                                      normalizeOrgCode(cleanRawAreaCode(u.areaCode)) === aCodeNorm
                                  ).length;
                                  const attachedMembersCount = members.filter(
                                    (m) =>
                                      normalizeOrgCode(m.companyCode) === aCompNorm &&
                                      normalizeOrgCode(cleanRawAreaCode(m.areaCode)) === aCodeNorm
                                  ).length;
                                  const hasAttached =
                                    attachedUsersCount > 0 || attachedMembersCount > 0;
                                  setDeleteAttachedMode('PENDING_REASSIGN');
                                  setConfirmDeleteTarget({
                                    title: `Xóa vĩnh viễn khu vực ${area.name} (${area.companyCode})?`,
                                    hasAttachedOptions: hasAttached,
                                    attachedSummary: hasAttached
                                      ? `Hiện có ${attachedUsersCount} tài khoản và ${attachedMembersCount} thành viên thuộc khu vực này.`
                                      : undefined,
                                    onConfirm: async (mode) => {
                                      await onDeleteArea(area.id, mode);
                                    },
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa khu vực"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Edit Area Modal */}
            {editingArea && (
              <div
                onClick={() => setEditingArea(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              >
                <form
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleUpdateAreaSubmit}
                  className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 cursor-default"
                >
                  <h4 className="font-bold text-base text-slate-900 mb-4">Chỉnh sửa Khu vực</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Trực thuộc Công ty</label>
                      <CustomSelect
                        size="sm"
                        disabled={!isAdmin}
                        value={editingArea.companyCode}
                        onChange={(val) => setEditingArea({ ...editingArea, companyCode: val })}
                        options={(isAdmin ? companies : scopedCompanies).map((c) => ({
                          value: c.code,
                          label: c.name,
                          badge: c.code,
                        }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Mã Khu vực</label>
                      <input
                        type="text"
                        disabled={!isAdmin && currentUser?.role === 'AREA_LEADER'}
                        value={editingArea.code}
                        onChange={(e) => setEditingArea({ ...editingArea, code: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tên Khu vực</label>
                      <input
                        type="text"
                        value={editingArea.name}
                        onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingArea(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                    >
                      Cập nhật
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPARTMENTS */}
        {activeTab === 'DEPARTMENTS' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-800">Danh sách Ban ngành (Tráng Niên, Phụ Nữ, Thanh Niên Nam, Thanh Niên Nữ)</h3>
              {canModifyDepartments && (
                <button
                  onClick={() => setIsAddDepartmentOpen(true)}
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Ban ngành</span>
                </button>
              )}
            </div>

            {/* Add Department Form */}
            {isAddDepartmentOpen && canModifyDepartments && (
              <form onSubmit={handleSaveDepartment} className="mb-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-200 animate-in fade-in">
                <div className="font-bold text-xs text-blue-950 mb-3">Thêm Ban ngành mới</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã Ban ngành</label>
                    <input
                      type="text"
                      value={newDeptCode}
                      onChange={(e) => setNewDeptCode(e.target.value)}
                      placeholder="Ví dụ: Thiếu Nhi, Trung Niên..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên Ban ngành</label>
                    <input
                      type="text"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="Ban Thiếu Nhi"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddDepartmentOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Lưu Ban ngành
                  </button>
                </div>
              </form>
            )}

            {/* Departments Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Tên Ban ngành</th>
                    <th className="py-3 px-4 text-center">Số thành viên</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((dept) => {
                    const deptMembers = scopedMembers.filter((m) => m.departmentCode === dept.code);

                    return (
                      <tr key={dept.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 text-sm">{dept.name}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-600">{deptMembers.length} người</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full font-extrabold text-[10px] bg-emerald-100 text-emerald-800">
                            Hoạt động
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {canModifyDepartments ? (
                            <>
                              <button
                                onClick={() => setEditingDepartment(dept)}
                                className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition cursor-pointer"
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmDeleteTarget({
                                    title: `Xóa ban ngành ${dept.name}?`,
                                    onConfirm: async () => {
                                      const ok = await onDeleteDepartment(dept.id);
                                      if (ok !== false) {
                                        onShowNotification(`Đã xóa ban ngành ${dept.name}.`);
                                      }
                                    },
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa ban ngành"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Danh mục chung</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Edit Department Modal */}
            {editingDepartment && (
              <div
                onClick={() => setEditingDepartment(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              >
                <form
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleUpdateDeptSubmit}
                  className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 cursor-default"
                >
                  <h4 className="font-bold text-base text-slate-900 mb-4">Chỉnh sửa Ban ngành</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tên Ban ngành</label>
                      <input
                        type="text"
                        value={editingDepartment.name}
                        onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingDepartment(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                    >
                      Cập nhật
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEMBERS */}
        {activeTab === 'MEMBERS' && (
          <div className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm họ tên, công ty, khu vực..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Cá nhân / Thành viên</span>
              </button>
            </div>

            {/* Add Member Form */}
            {isAddMemberOpen && (
              <form onSubmit={handleSaveMember} className="mb-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-200 animate-in fade-in">
                <div className="font-bold text-xs text-blue-950 mb-3">Thêm Thành viên mới</div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Họ và tên *</label>
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Nguyễn Văn B"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Sion / Công ty *</label>
                    <CustomSelect
                      size="sm"
                      disabled={!isAdmin && scopedCompanies.length <= 1}
                      value={newMemberCompany}
                      onChange={setNewMemberCompany}
                      options={(isAdmin ? companies : scopedCompanies).map((c) => ({
                        value: c.code,
                        label: c.name,
                        badge: c.code,
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Khu vực *</label>
                    {!isAdmin && actorRoleLevel <= 3 ? (
                      <CustomSelect
                        size="sm"
                        disabled={scopedAreas.length <= 1}
                        value={newMemberArea}
                        onChange={setNewMemberArea}
                        options={(scopedAreas.length > 0
                          ? scopedAreas
                          : [{ id: 'own', code: currentUser?.areaCode || newMemberArea, name: currentUser?.areaCode || newMemberArea, companyCode: newMemberCompany, active: true }]
                        ).map((a) => ({
                          value: a.code,
                          label: formatAreaDisplayName(a.code, a.name),
                          badge: a.code,
                        }))}
                      />
                    ) : (
                      <input
                        type="text"
                        value={newMemberArea}
                        onChange={(e) => setNewMemberArea(e.target.value)}
                        placeholder="1.1, 1.2..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Đội / Uni</label>
                    <input
                      type="text"
                      disabled={currentUser?.role === 'UNI_LEADER'}
                      value={newMemberUnit}
                      onChange={(e) => setNewMemberUnit(e.target.value)}
                      placeholder="Uni 1, Đội A..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Ban ngành *</label>
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={newMemberDept}
                      onChange={setNewMemberDept}
                      options={departments.map((d) => ({
                        value: d.code,
                        label: d.name,
                      }))}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Lưu Thành viên
                  </button>
                </div>
              </form>
            )}

            {/* Members Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Họ và tên</th>
                    <th className="py-3 px-4">Công ty</th>
                    <th className="py-3 px-4">Khu vực</th>
                    <th className="py-3 px-4">Ban ngành</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Tổng điểm</th>
                    <th className="py-3 px-4 text-center">Đối tượng</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedMembers
                    .filter((m) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        (m.fullName || '').toLowerCase().includes(q) ||
                        (m.companyCode || '').toLowerCase().includes(q) ||
                        (m.areaCode || '').toLowerCase().includes(q) ||
                        (m.departmentCode || '').toLowerCase().includes(q)
                      );
                    })
                    .map((mem) => {
                      const canEditThisMem = canModifyMember(mem);
                      const safeScore =
                        typeof mem.score === 'number' && Number.isFinite(mem.score) ? mem.score : 0;
                      return (
                      <tr key={mem.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{mem.fullName || 'Chưa đặt tên'}</div>
                          <div className="text-[10px] text-slate-400">{mem.code || ''}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{mem.companyCode || '-'}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {mem.areaCode ? formatAreaDisplayName(mem.areaCode) : '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{mem.departmentCode || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            disabled={!canEditThisMem}
                            onClick={() => {
                              onUpdateMember({ ...mem, active: !mem.active });
                              onShowNotification(
                                mem.active
                                  ? `Đã tạm dừng tính điểm cho ${mem.fullName || 'thành viên'}.`
                                  : `Đã kích hoạt hoạt động cho ${mem.fullName || 'thành viên'}.`
                              );
                            }}
                            className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-60 ${
                              mem.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}
                            title="Bấm để bật/tắt tính điểm vào mẫu số trung bình"
                          >
                            <span>{mem.active ? 'Đang hoạt động' : 'Tạm dừng'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {safeScore.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-600">
                          {mem.targets?.length || 0}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {canEditThisMem && (
                            <>
                              <button
                                onClick={() => setEditingMember(mem)}
                                className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition cursor-pointer"
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmDeleteTarget({
                                    title: `Xóa thành viên ${mem.fullName}?`,
                                    onConfirm: () => {
                                      onDeleteMember(mem.id);
                                      onShowNotification(`Đã xóa thành viên ${mem.fullName}.`);
                                    },
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa thành viên"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                    })}
                </tbody>
              </table>
            </div>

            {/* Edit Member Modal */}
            {editingMember && (
              <div
                onClick={() => setEditingMember(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              >
                <form
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleUpdateMemberSubmit}
                  className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 cursor-default"
                >
                  <h4 className="font-bold text-base text-slate-900 mb-4">Chỉnh sửa Thành viên</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Họ và tên</label>
                      <input
                        type="text"
                        value={editingMember.fullName}
                        onChange={(e) => setEditingMember({ ...editingMember, fullName: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Sion / Công ty</label>
                        <CustomSelect
                          size="sm"
                          disabled={!isAdmin && scopedCompanies.length <= 1}
                          value={editingMember.companyCode}
                          onChange={(val) => setEditingMember({ ...editingMember, companyCode: val })}
                          options={(isAdmin ? companies : scopedCompanies).map((c) => ({
                            value: c.code,
                            label: c.name,
                            badge: c.code,
                          }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Khu vực</label>
                        <input
                          type="text"
                          disabled={!isAdmin && actorRoleLevel <= 3 && scopedAreas.length <= 1}
                          value={editingMember.areaCode}
                          onChange={(e) => setEditingMember({ ...editingMember, areaCode: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Đội / Uni</label>
                        <input
                          type="text"
                          disabled={currentUser?.role === 'UNI_LEADER'}
                          value={editingMember.unitCode || ''}
                          onChange={(e) => setEditingMember({ ...editingMember, unitCode: e.target.value })}
                          placeholder="Uni 1, Đội A..."
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Ban ngành</label>
                        <CustomSelect
                          size="sm"
                          searchable={false}
                          value={editingMember.departmentCode}
                          onChange={(val) => setEditingMember({ ...editingMember, departmentCode: val })}
                          options={departments.map((d) => ({
                            value: d.code,
                            label: d.name,
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                    >
                      Cập nhật
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB: TRUNG TÂM NHẬP & XUẤT EXCEL / XUẤT BÁO CÁO PHÂN QUYỀN */}
        {activeTab === 'EXCEL_SYNC' && canDownloadExcel && (
          <div className="space-y-5 animate-in fade-in">
            {/* Intro Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-emerald-950 dark:text-white">
                    {isAdmin
                      ? 'Trung Tâm Nhập & Xuất Dữ Liệu Excel'
                      : 'Trung Tâm Xuất Báo Cáo Theo Phân Quyền'}
                  </h3>
                  <p className="hidden sm:block text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    {isAdmin
                      ? 'Đồng bộ danh mục hệ thống, hồ sơ nhân sự mới, danh sách MĐ, báo cáo hằng ngày và dữ liệu Edu.'
                      : `Xuất 5 loại báo cáo chi tiết (bao gồm đủ 7 chỉ số: KN, Thăm, GM, ĐT, HH, KT, WS New) đúng phạm vi ${
                          (currentUser && ROLE_DISPLAY_META[currentUser.role]?.label) || 'quản lý'
                        }.`}
                  </p>
                </div>
              </div>

              <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-xl border border-emerald-200/60 dark:border-emerald-700/60 shrink-0">
                {isAdmin ? (
                  <>
                    Hỗ trợ: <strong>.xlsx, .xls</strong>
                  </>
                ) : (
                  <>
                    Phạm vi:{' '}
                    <strong>
                      {(currentUser && ROLE_DISPLAY_META[currentUser.role]?.codeBadge) || 'Đơn vị'}
                    </strong>{' '}
                    · .xlsx
                  </>
                )}
              </div>
            </div>

            {/* Grid Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
              {/* BLOCK 1: CẤU HÌNH DANH MỤC HỆ THỐNG (Chỉ Cấp 6-7 Admin) */}
              {isAdmin && (
                <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          1. Danh Mục Tổ Chức
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Sion / Công ty, Khu vực và Ban ngành
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md shrink-0">
                      4 Sheets
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Sion</div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {companies.length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Khu vực</div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {areas.length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Ban ngành</div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {departments.length}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Cấu trúc file:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
                      <li><strong>Sion - Công Ty:</strong> Mã Sion, Tên Sion, Mô Tả, Trạng Thái.</li>
                      <li><strong>Khu Vực:</strong> Mã Khu Vực, Tên Khu Vực, Mã Sion Trực Thuộc.</li>
                      <li><strong>Ban Ngành:</strong> Mã Ban Ngành, Tên Ban Ngành, Trạng Thái.</li>
                      <li><strong>Cụm Sion:</strong> Mã Cụm, Tên Cụm, Danh Sách Sion, Tự Động Còn Lại.</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => downloadConfigTemplateExcel()}
                      className="py-2 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Tải mẫu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        exportSystemConfigExcel(companies, areas, departments, clustersList)
                      }
                      className="py-2 px-3 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Xuất Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => configFileRef.current?.click()}
                      className="py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Nhập Excel</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BLOCK 2: HỒ SƠ CÁ NHÂN & NHÂN SỰ THI ĐUA (7 CHỈ SỐ) */}
              {(() => {
                const memCompanies = getScopedCompanyOptions(currentUser || null, companies, scopedMembers);
                const memAreas = getScopedAreaOptions(
                  currentUser || null,
                  areas,
                  memExportCompany,
                  scopedMembers
                );
                const memPersonOptions = getScopedMemberOptions(
                  scopedMembers,
                  memExportCompany,
                  memExportArea
                );
                const memDropdownLabels = getRoleScopedDropdownLabels(currentUser || null, {
                  selectedCompanyCode: memExportCompany,
                  companiesCount: memCompanies.length,
                  singleCompanyCode: memCompanies[0]?.code,
                  areasCount: memAreas.length,
                  singleAreaCode: memAreas[0]?.code,
                  membersCount: memPersonOptions.length,
                });
                return (
              <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {isAdmin ? '2' : '1'}. Hồ Sơ Cá Nhân &amp; Thi Đua
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Đội/Uni, Vai trò 7 cấp &amp; đủ 7 chỉ số chi tiết
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md shrink-0">
                    2 Sheets
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      {isAdmin ? 'Thành viên' : 'Nhân sự trong phạm vi'}
                    </div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {memPersonOptions.length} người
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Tài khoản đối chiếu</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {scopedUsers.length} TK
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={memExportCompany}
                      onChange={(val) => {
                        setMemExportCompany(val);
                        setMemExportArea('ALL');
                        setMemExportMemberId('ALL');
                      }}
                      options={[
                        { value: 'ALL', label: memDropdownLabels.allCompaniesLabel },
                        ...memCompanies.map((c) => ({ value: c.code, label: c.code })),
                      ]}
                      ariaLabel="Chọn Sion xuất hồ sơ"
                    />
                  </div>
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={memExportArea}
                      onChange={(val) => {
                        setMemExportArea(val);
                        setMemExportMemberId('ALL');
                      }}
                      options={[
                        { value: 'ALL', label: memDropdownLabels.allAreasLabel },
                        ...memAreas.map((a) => ({
                          value:
                            memExportCompany === 'ALL'
                              ? makeAreaScopeKey(a.companyCode, a.code)
                              : a.code,
                          label:
                            memExportCompany === 'ALL'
                              ? `${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''} (${a.companyCode})`
                              : `KV ${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''}`,
                        })),
                      ]}
                      ariaLabel="Chọn Khu vực xuất hồ sơ"
                    />
                  </div>
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable
                      value={memExportMemberId}
                      onChange={setMemExportMemberId}
                      options={[
                        { value: 'ALL', label: memDropdownLabels.allMembersLabel },
                        ...memPersonOptions.map((m) => ({
                          value: m.id,
                          label: `${m.fullName} (${m.companyCode}·${m.areaCode})`,
                        })),
                      ]}
                      ariaLabel="Chọn cá nhân xuất hồ sơ"
                    />
                  </div>
                </div>

                {isAdmin ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => downloadMembersTemplateExcel()}
                      className="py-2 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Tải mẫu mới</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const res = exportMembersAndTargetsExcel(
                          members,
                          usersList || [],
                          disciples,
                          {
                            viewer: currentUser,
                            companyCode: memExportCompany,
                            areaCode: memExportArea,
                            memberId: memExportMemberId,
                          }
                        );
                        onShowNotification(
                          `Đã xuất ${res.fileName} (${res.membersCount} thành viên).`
                        );
                      }}
                      className="py-2 px-3 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Xuất Hồ sơ TV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => memberFileRef.current?.click()}
                      className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Nhập Excel</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const res = exportMembersAndTargetsExcel(
                        members,
                        usersList || [],
                        disciples,
                        {
                          viewer: currentUser,
                          companyCode: memExportCompany,
                          areaCode: memExportArea,
                          memberId: memExportMemberId,
                        }
                      );
                      onShowNotification(
                        `Đã xuất ${res.fileName} (${res.membersCount} thành viên trong phạm vi).`
                      );
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Xuất Excel Hồ sơ &amp; 7 Chỉ số</span>
                  </button>
                )}
              </div>
                );
              })()}

              {/* BLOCK 3: XUẤT DANH SÁCH MĐ */}
              {(() => {
                const mdCompanies = getScopedCompanyOptions(currentUser || null, companies, scopedMembers);
                const mdAreas = getScopedAreaOptions(
                  currentUser || null,
                  areas,
                  mdExportCompany,
                  scopedMembers
                );
                const mdOwnerMap = new Map<string, string>();
                getScopedMemberOptions(scopedMembers, mdExportCompany, mdExportArea).forEach((m) => {
                  mdOwnerMap.set(m.id, `${m.fullName} (${m.companyCode}·${m.areaCode})`);
                });
                scopedDisciples
                  .filter(
                    (d) =>
                      mdExportCompany === 'ALL' ||
                      normalizeOrgCode(d.companyCode) === normalizeOrgCode(mdExportCompany)
                  )
                  .filter((d) => {
                    if (mdExportArea === 'ALL') return true;
                    const p = parseAreaScopeEntry(mdExportArea);
                    if (p.hasCompanyPrefix && normalizeOrgCode(d.companyCode) !== p.companyCode) {
                      return false;
                    }
                    return !p.areaCode || normalizeOrgCode(d.areaCode) === p.areaCode;
                  })
                  .forEach((d) => {
                    const key = d.ownerMemberId || d.ownerUid;
                    if (key && !mdOwnerMap.has(key)) {
                      mdOwnerMap.set(key, `${d.ownerName || key} (${d.companyCode}·${d.areaCode})`);
                    }
                  });
                const mdOwnerOptions = Array.from(mdOwnerMap.entries())
                  .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
                  .map(([value, label]) => ({ value, label }));

                const activeMdCount = scopedDisciples.filter(
                  (d) => !d.isStopped && !(d.progress || []).includes('Dừng')
                ).length;
                const stoppedMdCount = scopedDisciples.length - activeMdCount;
                const mdDropdownLabels = getRoleScopedDropdownLabels(currentUser || null, {
                  selectedCompanyCode: mdExportCompany,
                  companiesCount: mdCompanies.length,
                  singleCompanyCode: mdCompanies[0]?.code,
                  areasCount: mdAreas.length,
                  singleAreaCode: mdAreas[0]?.code,
                  membersCount: mdOwnerOptions.length,
                  memberNoun: 'người phụ trách',
                });

                return (
              <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {isAdmin ? '3. Danh Sách MĐ Toàn Hệ Thống' : '2. Danh Sách MĐ (Sổ tay MĐ)'}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        9 bước tiến độ (KN → WS / Dừng) &amp; người phụ trách
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md shrink-0">
                    2 Sheets
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Tổng MĐ</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {scopedDisciples.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-emerald-600 font-semibold uppercase">Đang theo</div>
                    <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                      {activeMdCount}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-rose-500 font-semibold uppercase">Đã dừng</div>
                    <div className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                      {stoppedMdCount}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={mdExportCompany}
                      onChange={(val) => {
                        setMdExportCompany(val);
                        setMdExportArea('ALL');
                        setMdExportOwnerKey('ALL');
                      }}
                      options={[
                        { value: 'ALL', label: mdDropdownLabels.allCompaniesLabel },
                        ...mdCompanies.map((c) => ({ value: c.code, label: c.code })),
                      ]}
                      ariaLabel="Chọn Sion xuất danh sách MĐ"
                    />
                  </div>
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={mdExportArea}
                      onChange={(val) => {
                        setMdExportArea(val);
                        setMdExportOwnerKey('ALL');
                      }}
                      options={[
                        { value: 'ALL', label: mdDropdownLabels.allAreasLabel },
                        ...mdAreas.map((a) => ({
                          value:
                            mdExportCompany === 'ALL'
                              ? makeAreaScopeKey(a.companyCode, a.code)
                              : a.code,
                          label:
                            mdExportCompany === 'ALL'
                              ? `${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''} (${a.companyCode})`
                              : `KV ${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''}`,
                        })),
                      ]}
                      ariaLabel="Chọn Khu vực xuất danh sách MĐ"
                    />
                  </div>
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable
                      value={mdExportOwnerKey}
                      onChange={setMdExportOwnerKey}
                      options={[
                        { value: 'ALL', label: mdDropdownLabels.allMembersLabel },
                        ...mdOwnerOptions,
                      ]}
                      ariaLabel="Chọn người phụ trách xuất danh sách MĐ"
                    />
                  </div>
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={mdExportStatus}
                      onChange={(val) => setMdExportStatus(val as 'ALL' | 'ACTIVE' | 'STOPPED')}
                      options={[
                        { value: 'ALL', label: 'Tất cả trạng thái' },
                        { value: 'ACTIVE', label: 'Đang theo dõi' },
                        { value: 'STOPPED', label: 'Đã dừng' },
                      ]}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const res = exportDisciplesExcel(disciples, {
                      viewer: currentUser,
                      companyCode: mdExportCompany,
                      areaCode: mdExportArea,
                      ownerKey: mdExportOwnerKey,
                      status: mdExportStatus,
                    });
                    onShowNotification(`Đã xuất ${res.fileName} (${res.count} MĐ).`);
                  }}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Xuất Excel Danh sách MĐ</span>
                </button>
              </div>
                );
              })()}

              {/* BLOCK 4: XUẤT BÁO CÁO HẰNG NGÀY (7 CHỈ SỐ CHI TIẾT) */}
              <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {isAdmin
                          ? '4. Báo Cáo Hằng Ngày Toàn Hệ Thống'
                          : '3. Báo Cáo Hằng Ngày & 7 Chỉ Số'}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Tổng hợp TV, Khu vực &amp; Nhật ký đủ 7 chỉ số chi tiết
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md shrink-0">
                    3 Sheets
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      {isAdmin ? 'Tổng phiếu báo cáo' : 'Phiếu báo cáo (phạm vi)'}
                    </div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {scopedDailyReports.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Thang điểm áp dụng</div>
                    <div className="text-xs font-black text-sky-700 dark:text-sky-300 mt-1 truncate">
                      {activeEvent ? activeEvent.title : 'Điểm mặc định HT'}
                    </div>
                  </div>
                </div>

                {(() => {
                  const now = new Date();
                  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
                    now.getDate()
                  ).padStart(2, '0')}`;
                  const monthStr = todayStr.slice(0, 7);
                  const yearStr = todayStr.slice(0, 4);
                  const selectableCompanies = getScopedCompanyOptions(
                    currentUser || null,
                    companies,
                    scopedMembers
                  );
                  const selectableAreas = getScopedAreaOptions(
                    currentUser || null,
                    areas,
                    adminReportCompany,
                    scopedMembers
                  );
                  const selectableMembers = getScopedMemberOptions(
                    scopedMembers,
                    adminReportCompany,
                    adminReportArea
                  );
                  const reportDropdownLabels = getRoleScopedDropdownLabels(currentUser || null, {
                    selectedCompanyCode: adminReportCompany,
                    companiesCount: selectableCompanies.length,
                    singleCompanyCode: selectableCompanies[0]?.code,
                    areasCount: selectableAreas.length,
                    singleAreaCode: selectableAreas[0]?.code,
                    membersCount: selectableMembers.length,
                  });

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={adminReportPeriod}
                            onChange={(val) => setAdminReportPeriod(val as DailyReportExportPeriod)}
                            options={[
                              { value: 'DAY', label: `Hôm nay (${todayStr.split('-').reverse().join('/')})` },
                              { value: 'MONTH', label: `Tháng ${monthStr.split('-').reverse().join('/')}` },
                              { value: 'YEAR', label: `Năm ${yearStr}` },
                              { value: 'ALL', label: 'Tất cả thời gian' },
                            ]}
                          />
                        </div>
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={adminReportCompany}
                            onChange={(val) => {
                              setAdminReportCompany(val);
                              setAdminReportArea('ALL');
                              setAdminReportMemberId('ALL');
                            }}
                            options={[
                              { value: 'ALL', label: reportDropdownLabels.allCompaniesLabel },
                              ...selectableCompanies.map((c) => ({ value: c.code, label: c.code })),
                            ]}
                            ariaLabel="Chọn Sion xuất báo cáo"
                          />
                        </div>
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={adminReportArea}
                            onChange={(val) => {
                              setAdminReportArea(val);
                              setAdminReportMemberId('ALL');
                            }}
                            options={[
                              { value: 'ALL', label: reportDropdownLabels.allAreasLabel },
                              ...selectableAreas.map((a) => ({
                                value:
                                  adminReportCompany === 'ALL'
                                    ? makeAreaScopeKey(a.companyCode, a.code)
                                    : a.code,
                                label:
                                  adminReportCompany === 'ALL'
                                    ? `${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''} (${a.companyCode})`
                                    : `KV ${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''}`,
                              })),
                            ]}
                            ariaLabel="Chọn Khu vực xuất báo cáo"
                          />
                        </div>
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable
                            value={adminReportMemberId}
                            onChange={setAdminReportMemberId}
                            options={[
                              { value: 'ALL', label: reportDropdownLabels.allMembersLabel },
                              ...selectableMembers.map((m) => ({
                                value: m.id,
                                label: `${m.fullName} (${m.companyCode}·${m.areaCode})`,
                              })),
                            ]}
                            ariaLabel="Chọn cá nhân xuất báo cáo"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) return;
                          const weights =
                            activeEvent?.weights || scoringConfig?.weights || DEFAULT_EVENT_WEIGHTS;
                          const res = exportDailyReportsByRbacExcel({
                            viewer: currentUser,
                            dailyReports,
                            members,
                            companies,
                            clusters: clustersConfig?.clusters,
                            regions,
                            weights,
                            period: adminReportPeriod,
                            periodDate: todayStr,
                            periodMonth: monthStr,
                            periodYear: yearStr,
                            filterCompanyCode: adminReportCompany,
                            filterAreaCode: adminReportArea,
                            filterMemberId: adminReportMemberId,
                          });
                          onShowNotification(
                            `Đã xuất ${res.fileName} (${res.reportsCount} báo cáo · ${res.membersCount} nhân sự).`
                          );
                        }}
                        className="w-full py-2.5 px-4 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Xuất Excel Báo cáo hằng ngày</span>
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* BLOCK 5: XUẤT DỮ LIỆU EDU (LMS & CMS) */}
              {(() => {
                const eduCompanies = getScopedCompanyOptions(currentUser || null, companies, scopedMembers);
                const eduAreas = getScopedAreaOptions(
                  currentUser || null,
                  areas,
                  eduExportCompany,
                  scopedMembers
                );
                const eduDropdownLabels = getRoleScopedDropdownLabels(currentUser || null, {
                  selectedCompanyCode: eduExportCompany,
                  companiesCount: eduCompanies.length,
                  singleCompanyCode: eduCompanies[0]?.code,
                  areasCount: eduAreas.length,
                  singleAreaCode: eduAreas[0]?.code,
                });
                return (
              <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {isAdmin ? '5' : '4'}. Dữ Liệu Đào Tạo Edu (LMS &amp; CMS)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Chủ đề tuần, Giáo trình, Phân công TĐ và Lộ trình CMS / NGV
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md shrink-0">
                    3 Sheets
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Chủ đề LMS</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {scopedEduTopics.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Phân công TĐ</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {scopedEduAssignments.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Hồ sơ CMS</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {scopedEduCms.length}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={eduExportCompany}
                      onChange={(val) => {
                        setEduExportCompany(val);
                        setEduExportArea('ALL');
                      }}
                      options={[
                        { value: 'ALL', label: eduDropdownLabels.allCompaniesLabel },
                        ...eduCompanies.map((c) => ({ value: c.code, label: c.code })),
                      ]}
                      ariaLabel="Chọn Sion xuất dữ liệu Edu"
                    />
                  </div>
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={eduExportArea}
                      onChange={setEduExportArea}
                      options={[
                        { value: 'ALL', label: eduDropdownLabels.allAreasLabel },
                        ...eduAreas.map((a) => ({
                          value:
                            eduExportCompany === 'ALL'
                              ? makeAreaScopeKey(a.companyCode, a.code)
                              : a.code,
                          label:
                            eduExportCompany === 'ALL'
                              ? `${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''} (${a.companyCode})`
                              : `KV ${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''}`,
                        })),
                      ]}
                      ariaLabel="Chọn Khu vực xuất dữ liệu Edu"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const res = exportEduDataExcel(eduTopics, eduAssignments, eduCmsProfiles, {
                      viewer: currentUser,
                      companyCode: eduExportCompany,
                      areaCode: eduExportArea,
                    });
                    onShowNotification(
                      `Đã xuất ${res.fileName} (${res.topicsCount} chủ đề, ${res.assignmentsCount} phân công, ${res.cmsCount} CMS).`
                    );
                  }}
                  className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Xuất Excel Edu</span>
                </button>
              </div>
                );
              })()}

              {/* BLOCK 6: XUẤT LỊCH LÀM VIỆC TUẦN (3 BUỔI & WS) */}
              <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {isAdmin ? '6' : '5'}. Lịch Làm Việc Tuần (3 Buổi &amp; WS)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Xuất lịch theo tuần, tháng, phạm vi quản lý hoặc từng nhân sự
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md shrink-0">
                    2–3 Sheets
                  </span>
                </div>

                {(() => {
                  const uniquePeopleCount = new Set(
                    scopedWorkSchedules.map((w) => w.ownerUid || w.ownerMemberId || w.ownerName)
                  ).size;

                  const parsedDate = (() => {
                    const parts = wsExportDate.split('-').map((n) => parseInt(n, 10));
                    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
                      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
                    }
                    return new Date();
                  })();
                  const sunday = new Date(parsedDate);
                  sunday.setDate(sunday.getDate() - sunday.getDay());
                  const weekStartStr = `${sunday.getFullYear()}-${String(
                    sunday.getMonth() + 1
                  ).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
                  const saturday = new Date(sunday);
                  saturday.setDate(saturday.getDate() + 6);
                  const weekLabel = `${String(sunday.getDate()).padStart(2, '0')}/${String(
                    sunday.getMonth() + 1
                  ).padStart(2, '0')} – ${String(saturday.getDate()).padStart(2, '0')}/${String(
                    saturday.getMonth() + 1
                  ).padStart(2, '0')}`;
                  const monthStr = wsExportDate.slice(0, 7);

                  const ownerOptionsMap = new Map<string, string>();
                  getScopedMemberOptions(scopedMembers, wsExportCompany, wsExportArea).forEach((m) => {
                    ownerOptionsMap.set(m.id, `${m.fullName} (${m.companyCode} · ${m.areaCode})`);
                  });
                  scopedWorkSchedules
                    .filter(
                      (w) =>
                        wsExportCompany === 'ALL' ||
                        normalizeOrgCode(w.companyCode) === normalizeOrgCode(wsExportCompany)
                    )
                    .filter((w) => {
                      if (wsExportArea === 'ALL') return true;
                      const p = parseAreaScopeEntry(wsExportArea);
                      if (p.hasCompanyPrefix && normalizeOrgCode(w.companyCode) !== p.companyCode) {
                        return false;
                      }
                      return !p.areaCode || normalizeOrgCode(w.areaCode) === p.areaCode;
                    })
                    .forEach((w) => {
                      const key = w.ownerMemberId || w.ownerUid;
                      if (key && !ownerOptionsMap.has(key)) {
                        ownerOptionsMap.set(
                          key,
                          `${w.ownerName} (${w.companyCode || '—'} · ${w.areaCode || '—'})`
                        );
                      }
                    });

                  const ownerOptions = Array.from(ownerOptionsMap.entries())
                    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
                    .map(([value, label]) => ({ value, label }));
                  const selectableWsCompanies = getScopedCompanyOptions(
                    currentUser || null,
                    companies,
                    scopedMembers
                  );
                  const selectableWsAreas = getScopedAreaOptions(
                    currentUser || null,
                    areas,
                    wsExportCompany,
                    scopedMembers
                  );
                  const wsDropdownLabels = getRoleScopedDropdownLabels(currentUser || null, {
                    selectedCompanyCode: wsExportCompany,
                    companiesCount: selectableWsCompanies.length,
                    singleCompanyCode: selectableWsCompanies[0]?.code,
                    areasCount: selectableWsAreas.length,
                    singleAreaCode: selectableWsAreas[0]?.code,
                    membersCount: ownerOptions.length,
                  });

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">
                            Bản ghi tuần
                          </div>
                          <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                            {scopedWorkSchedules.length}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">
                            Nhân sự có lịch
                          </div>
                          <div className="text-base font-black text-teal-700 dark:text-teal-300 mt-0.5 tabular-nums">
                            {uniquePeopleCount}
                          </div>
                        </div>
                      </div>

                      <div className={`grid grid-cols-1 ${wsExportPeriod === 'WEEK' ? 'sm:grid-cols-2' : ''} gap-2`}>
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={wsExportPeriod}
                            onChange={(val) =>
                              setWsExportPeriod(val as WorkScheduleExportPeriod)
                            }
                            options={[
                              { value: 'WEEK', label: `Tuần (${weekLabel})` },
                              {
                                value: 'MONTH',
                                label: `Tháng ${monthStr.split('-').reverse().join('/')}`,
                              },
                              { value: 'ALL', label: 'Tất cả thời gian' },
                            ]}
                          />
                        </div>
                        {wsExportPeriod === 'WEEK' && (
                          <input
                            type="date"
                            value={wsExportDate}
                            onChange={(e) => e.target.value && setWsExportDate(e.target.value)}
                            aria-label="Chọn ngày thuộc tuần cần xuất"
                            className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={wsExportCompany}
                            onChange={(val) => {
                              setWsExportCompany(val);
                              setWsExportArea('ALL');
                              setWsExportOwnerKey('ALL');
                            }}
                            options={[
                              { value: 'ALL', label: wsDropdownLabels.allCompaniesLabel },
                              ...selectableWsCompanies.map((c) => ({ value: c.code, label: c.code })),
                            ]}
                            ariaLabel="Chọn Sion xuất lịch làm việc"
                          />
                        </div>
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={wsExportArea}
                            onChange={(val) => {
                              setWsExportArea(val);
                              setWsExportOwnerKey('ALL');
                            }}
                            options={[
                              { value: 'ALL', label: wsDropdownLabels.allAreasLabel },
                              ...selectableWsAreas.map((a) => ({
                                value:
                                  wsExportCompany === 'ALL'
                                    ? makeAreaScopeKey(a.companyCode, a.code)
                                    : a.code,
                                label:
                                  wsExportCompany === 'ALL'
                                    ? `${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''} (${a.companyCode})`
                                    : `KV ${a.code}${a.name && a.name !== a.code ? ` · ${a.name}` : ''}`,
                              })),
                            ]}
                            ariaLabel="Chọn Khu vực xuất lịch làm việc"
                          />
                        </div>
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable
                            value={wsExportOwnerKey}
                            onChange={setWsExportOwnerKey}
                            options={[
                              { value: 'ALL', label: wsDropdownLabels.allMembersLabel },
                              ...ownerOptions,
                            ]}
                            ariaLabel="Chọn cá nhân xuất lịch làm việc"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) return;
                          const res = exportWorkSchedulesByRbacExcel({
                            viewer: currentUser,
                            workSchedules,
                            members,
                            period: wsExportPeriod,
                            selectedWeekStart: weekStartStr,
                            targetMonth: monthStr,
                            scopeMode: 'TEAM',
                            filterCompanyCode: wsExportCompany,
                            filterAreaCode: wsExportArea,
                            filterOwnerKey: wsExportOwnerKey,
                            includeWs: appearanceConfig?.llvWidgets?.showWsSection ?? true,
                          });
                          onShowNotification(
                            `Đã xuất ${res.fileName} (${res.recordsCount} tuần · ${res.peopleCount} nhân sự).`
                          );
                        }}
                        className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Xuất Excel Lịch làm việc</span>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* MODAL PREVIEW CONFIG EXCEL */}
        {configPreview && (
          <div
            onClick={() => setConfigPreview(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-6 relative cursor-default space-y-4"
            >
              <button
                onClick={() => setConfigPreview(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900 dark:text-white">
                    Xem Trước Dữ Liệu Cấu Hình Hệ Thống
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Tệp: {configPreview.fileName}
                  </p>
                </div>
              </div>

              {/* Status summary */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                  <div className="text-[10px] text-blue-800 dark:text-blue-300 font-bold uppercase">Công ty</div>
                  <div className="text-xl font-black text-blue-950 dark:text-blue-100 mt-0.5">{configPreview.companies.length}</div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase">Khu vực</div>
                  <div className="text-xl font-black text-emerald-950 dark:text-emerald-100 mt-0.5">{configPreview.areas.length}</div>
                </div>
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800">
                  <div className="text-[10px] text-purple-800 dark:text-purple-300 font-bold uppercase">Ban ngành</div>
                  <div className="text-xl font-black text-purple-950 dark:text-purple-100 mt-0.5">{configPreview.departments.length}</div>
                </div>
              </div>

              {/* Errors if any */}
              {configPreview.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Lưu ý ({configPreview.errors.length} cảnh báo):</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto font-mono text-[11px]">
                    {configPreview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Import mode options */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200">Phương thức cập nhật:</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="cfgMode"
                      checked={importMode === 'MERGE'}
                      onChange={() => setImportMode('MERGE')}
                      className="text-blue-600"
                    />
                    <span>Thêm mới & Cập nhật (Khuyến nghị)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="cfgMode"
                      checked={importMode === 'REPLACE'}
                      onChange={() => setImportMode('REPLACE')}
                      className="text-blue-600"
                    />
                    <span>Ghi đè hoàn toàn danh mục</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfigPreview(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConfigImport}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Xác nhận Nhập vào Hệ thống
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PREVIEW MEMBERS EXCEL */}
        {membersPreview && (
          <div
            onClick={() => setMembersPreview(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-6 relative cursor-default space-y-4"
            >
              <button
                onClick={() => setMembersPreview(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900 dark:text-white">
                    Xem Trước Danh Sách Thành Viên Tải Lên
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Tệp: {membersPreview.fileName}
                  </p>
                </div>
              </div>

              {/* Stat */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-center">
                <div className="text-xs text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider">
                  Số lượng thành viên hợp lệ tìm thấy
                </div>
                <div className="text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
                  {membersPreview.members.length} <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">thành viên</span>
                </div>
              </div>

              {/* Sample list preview */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                    <tr>
                      <th className="p-2">Mã TV</th>
                      <th className="p-2">Họ và Tên</th>
                      <th className="p-2">Sion</th>
                      <th className="p-2">Khu vực</th>
                      <th className="p-2">Ban ngành</th>
                      <th className="p-2">Đội / Uni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {membersPreview.members.slice(0, 10).map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 font-mono font-bold text-blue-700 dark:text-blue-400">{m.code}</td>
                        <td className="p-2 font-bold text-slate-900 dark:text-white">{m.fullName}</td>
                        <td className="p-2 text-slate-700 dark:text-slate-300">{m.companyCode}</td>
                        <td className="p-2 text-slate-700 dark:text-slate-300">{m.areaCode}</td>
                        <td className="p-2 text-slate-700 dark:text-slate-300">{m.departmentCode}</td>
                        <td className="p-2 text-slate-700 dark:text-slate-300">{m.unitCode || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {membersPreview.members.length > 10 && (
                <p className="text-[11px] text-slate-400 italic text-center">
                  Và còn {membersPreview.members.length - 10} thành viên khác...
                </p>
              )}

              {/* Errors if any */}
              {membersPreview.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Lưu ý ({membersPreview.errors.length} cảnh báo):</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto font-mono text-[11px]">
                    {membersPreview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Import mode options */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200">Phương thức cập nhật:</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="memMode"
                      checked={importMode === 'MERGE'}
                      onChange={() => setImportMode('MERGE')}
                      className="text-emerald-600"
                    />
                    <span>Thêm mới & Cập nhật theo Mã TV (Khuyến nghị)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="memMode"
                      checked={importMode === 'REPLACE'}
                      onChange={() => setImportMode('REPLACE')}
                      className="text-emerald-600"
                    />
                    <span>Ghi đè danh sách thành viên</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMembersPreview(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMembersImport}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Xác nhận Nhập {membersPreview.members.length} Thành viên
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: PHÂN QUYỀN (7 CẤP) */}
        {activeTab === 'ROLES' && (
          <div>
            <RoleManagementTab
              currentUser={currentUser || null}
              usersList={usersList || []}
              companies={companies}
              areas={areas}
              departments={departments}
              clusters={clustersList}
              onUpdateUserRole={onUpdateUserRole || (async () => {})}
              onDeleteUserAccount={onDeleteUserAccount}
              preAssignedRoles={preAssignedRoles}
              onPreAssignRole={onPreAssignRole}
              onDeletePreAssignedRole={onDeletePreAssignedRole}
              onResetUserPin={onResetUserPin}
              securityConfig={securityConfig}
              onSaveSecurityConfig={onSaveSecurityConfig}
              onApproveUser={onApproveUser}
              onRejectUser={onRejectUser}
              onShowNotification={onShowNotification}
            />
          </div>
        )}

        {/* TAB: QUẢN LÝ EVENT (NHÓM 1) */}
        {activeTab === 'EVENTS' && (
          <AdminBannerEventTab
            forcedSection="EVENTS"
            bannerConfig={bannerConfig || null}
            events={events}
            members={members}
            companies={companies}
            areas={areas}
            onSaveBannerConfig={onSaveBannerConfig || (async () => {})}
            onSaveEvent={onSaveEvent || (async () => {})}
            onDeleteEvent={onDeleteEvent || (async () => {})}
            onShowNotification={onShowNotification}
            defaultWeights={scoringConfig?.weights}
          />
        )}

        {/* TAB: BANNER TRANG CHỦ (NHÓM 2 - TÁCH RIÊNG KHỎI EVENT) */}
        {activeTab === 'BANNER' && (
          <AdminBannerEventTab
            forcedSection="BANNER"
            bannerConfig={bannerConfig || null}
            events={events}
            members={members}
            companies={companies}
            areas={areas}
            onSaveBannerConfig={onSaveBannerConfig || (async () => {})}
            onSaveEvent={onSaveEvent || (async () => {})}
            onDeleteEvent={onDeleteEvent || (async () => {})}
            onShowNotification={onShowNotification}
            defaultWeights={scoringConfig?.weights}
          />
        )}

        {/* TAB: BẢNG ĐIỂM MẶC ĐỊNH HỆ THỐNG (NHÓM 1 - TÁCH RIÊNG KHỎI GIAO DIỆN) */}
        {activeTab === 'SCORING' && (
          <AdminScoringAppearanceTab
            forcedSection="SCORING"
            scoringConfig={scoringConfig}
            appearanceConfig={appearanceConfig}
            activeEvent={activeEvent}
            onSaveScoringConfig={onSaveScoringConfig || (async () => {})}
            onSaveAppearanceConfig={onSaveAppearanceConfig || (async () => {})}
            onShowNotification={onShowNotification}
          />
        )}

        {/* TAB: FONT & CỠ CHỮ (NHÓM 2) */}
        {activeTab === 'APPEARANCE_FONT' && (
          <AdminScoringAppearanceTab
            forcedSection="TYPOGRAPHY"
            scoringConfig={scoringConfig}
            appearanceConfig={appearanceConfig}
            activeEvent={activeEvent}
            onSaveScoringConfig={onSaveScoringConfig || (async () => {})}
            onSaveAppearanceConfig={onSaveAppearanceConfig || (async () => {})}
            onShowNotification={onShowNotification}
          />
        )}

        {/* TAB: BỐ CỤC TRANG CHỦ (NHÓM 2) */}
        {activeTab === 'APPEARANCE_HOME' && (
          <AdminScoringAppearanceTab
            forcedSection="HOME_LAYOUT"
            scoringConfig={scoringConfig}
            appearanceConfig={appearanceConfig}
            activeEvent={activeEvent}
            onSaveScoringConfig={onSaveScoringConfig || (async () => {})}
            onSaveAppearanceConfig={onSaveAppearanceConfig || (async () => {})}
            onShowNotification={onShowNotification}
          />
        )}

        {/* TAB: BỐ CỤC TRANG LLV (NHÓM 2) */}
        {activeTab === 'APPEARANCE_LLV' && (
          <AdminScoringAppearanceTab
            forcedSection="LLV_LAYOUT"
            scoringConfig={scoringConfig}
            appearanceConfig={appearanceConfig}
            activeEvent={activeEvent}
            onSaveScoringConfig={onSaveScoringConfig || (async () => {})}
            onSaveAppearanceConfig={onSaveAppearanceConfig || (async () => {})}
            onShowNotification={onShowNotification}
          />
        )}

        {/* TAB: BỐ CỤC BẢNG VINH DANH (NHÓM 2) */}
        {activeTab === 'APPEARANCE_HONORS' && (
          <AdminScoringAppearanceTab
            forcedSection="HONORS_LAYOUT"
            scoringConfig={scoringConfig}
            appearanceConfig={appearanceConfig}
            activeEvent={activeEvent}
            onSaveScoringConfig={onSaveScoringConfig || (async () => {})}
            onSaveAppearanceConfig={onSaveAppearanceConfig || (async () => {})}
            onShowNotification={onShowNotification}
          />
        )}

        {/* TAB: TỪ ĐIỂN MÃ HÓA NGÔN TỪ (NHÓM 4) */}
        {activeTab === 'VOCABULARY' && isAdmin && (
          <AdminVocabularyTab
            vocabularyConfig={vocabularyConfig || DEFAULT_VOCABULARY_CONFIG}
            onSaveVocabularyConfig={onSaveVocabularyConfig || (async () => {})}
            onShowNotification={onShowNotification}
          />
        )}
                </div>
              </div>
            </>
          );
        })()}

        {/* IN-APP DELETE CONFIRMATION MODAL */}
        {confirmDeleteTarget && (
          <div
            onClick={() => {
              if (!isDeletingConfirm) setConfirmDeleteTarget(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                Xác nhận thao tác xóa
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {confirmDeleteTarget.title}
              </p>

              {confirmDeleteTarget.hasAttachedOptions && (
                <div className="space-y-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3">
                  {confirmDeleteTarget.attachedSummary && (
                    <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      {confirmDeleteTarget.attachedSummary}
                    </div>
                  )}
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    Cách xử lý tài khoản &amp; thành viên đang trực thuộc:
                  </div>
                  <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded-lg border border-transparent hover:bg-white dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="orgDeleteAttachedMode"
                      checked={deleteAttachedMode === 'PENDING_REASSIGN'}
                      onChange={() => setDeleteAttachedMode('PENDING_REASSIGN')}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        Chuyển sang chờ phân bổ đơn vị
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isAdmin
                          ? 'Chuyển tài khoản thường về trạng thái Chờ duyệt/phân bổ lại đơn vị mới và tạm ngừng hồ sơ thành viên.'
                          : 'Tạm ngừng hồ sơ thành viên trực thuộc để Admin phân bổ lại đơn vị mới.'}
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded-lg border border-transparent hover:bg-white dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="orgDeleteAttachedMode"
                      checked={deleteAttachedMode === 'DELETE_RECORDS'}
                      onChange={() => setDeleteAttachedMode('DELETE_RECORDS')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div>
                      <div className="font-bold text-rose-700 dark:text-rose-300">
                        Xóa luôn hồ sơ liên quan
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {currentUser?.role === 'SUPER_ADMIN'
                          ? 'Xóa vĩnh viễn thành viên và tài khoản thường trực thuộc (giữ an toàn cho Admin/Tổng Quản trị).'
                          : isAdmin
                          ? 'Xóa vĩnh viễn hồ sơ thành viên trực thuộc; tài khoản thường chuyển về Chờ phân bổ đơn vị.'
                          : 'Xóa vĩnh viễn hồ sơ thành viên trực thuộc khỏi danh sách thi đua.'}
                      </div>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingConfirm}
                  onClick={() => setConfirmDeleteTarget(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isDeletingConfirm}
                  onClick={async () => {
                    if (isDeletingConfirm) return;
                    setIsDeletingConfirm(true);
                    try {
                      await confirmDeleteTarget.onConfirm(deleteAttachedMode);
                    } finally {
                      setIsDeletingConfirm(false);
                      setConfirmDeleteTarget(null);
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-60"
                >
                  {isDeletingConfirm ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
