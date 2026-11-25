import React, { useState, useMemo } from 'react';
import {
  Crown,
  Shield,
  User,
  Search,
  CheckCircle2,
  UserCheck,
  Mail,
  Sparkles,
  HelpCircle,
  Plus,
  Trash2,
  ShieldCheck,
  Building2,
  MapPin,
  X,
  Check,
  SlidersHorizontal,
  AlertTriangle,
  KeyRound,
  Clock,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Bell,
} from 'lucide-react';
import {
  UserAccount,
  UserRole,
  RoleAssignment,
  Company,
  Area,
  Department,
  ROLE_DISPLAY_META,
  ROLE_ORDER,
  SystemSecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  ApprovalStatus,
  resolveUserApprovalStatus,
  formatCompanyDisplayName,
  getRoleLevel,
  getMaxAssignableRoleLevel,
} from '../types/edulms';
import { BOOTSTRAP_SUPER_ADMIN_EMAILS } from '../firebase';
import { CustomSelect } from './CustomSelect';
import { canAssignTargetRole, canManageOrgRecord, normalizeOrgCode } from '../utils/rbac';
import { isValidPersonalPin } from '../utils/pinSecurity';

interface ScopeSelection {
  managedCompanyCodes?: string[];
  managedAreaCodes?: string[];
  managedUnitCodes?: string[];
}

interface RoleManagementTabProps {
  currentUser: UserAccount | null;
  usersList: UserAccount[];
  companies: Company[];
  areas: Area[];
  departments: Department[];
  onUpdateUserRole: (
    targetUserId: string,
    newRole: UserRole,
    targetName: string,
    scope?: ScopeSelection
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
    scope?: ScopeSelection
  ) => Promise<void>;
  onDeletePreAssignedRole?: (email: string) => Promise<void>;
  onResetUserPin?: (
    targetUserId: string,
    targetName: string,
    newPin?: string
  ) => Promise<void>;
  securityConfig?: SystemSecurityConfig | null;
  onSaveSecurityConfig?: (config: SystemSecurityConfig) => Promise<void>;
  onApproveUser?: (
    targetUser: UserAccount,
    options?: {
      role?: UserRole;
      companyCode?: string;
      areaCode?: string;
      unitCode?: string;
      scope?: ScopeSelection;
    }
  ) => Promise<void>;
  onRejectUser?: (targetUser: UserAccount, reason?: string) => Promise<void>;
  onShowNotification: (msg: string) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: ROLE_DISPLAY_META.SUPER_ADMIN.label,
  ADMIN: ROLE_DISPLAY_META.ADMIN.label,
  MANAGER: ROLE_DISPLAY_META.MANAGER.label,
  SION_LEADER: ROLE_DISPLAY_META.SION_LEADER.label,
  AREA_LEADER: ROLE_DISPLAY_META.AREA_LEADER.label,
  UNI_LEADER: ROLE_DISPLAY_META.UNI_LEADER.label,
  MEMBER: ROLE_DISPLAY_META.MEMBER.label,
};

const SCOPE_ENABLED_ROLES: UserRole[] = ['MANAGER', 'SION_LEADER', 'AREA_LEADER', 'UNI_LEADER'];

export const RoleManagementTab: React.FC<RoleManagementTabProps> = ({
  currentUser,
  usersList,
  companies,
  areas,
  onUpdateUserRole,
  onDeleteUserAccount,
  preAssignedRoles = [],
  onPreAssignRole,
  onDeletePreAssignedRole,
  onResetUserPin,
  securityConfig,
  onSaveSecurityConfig,
  onApproveUser,
  onRejectUser,
  onShowNotification,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | ApprovalStatus>('ALL');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingDrafts, setPendingDrafts] = useState<
    Record<string, { role: UserRole; companyCode: string; areaCode: string }>
  >({});
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: 'USER'; user: UserAccount; effectiveRole: UserRole }
    | { type: 'PRE_ASSIGN'; email: string; role: UserRole }
    | { type: 'RESET_PIN'; user: UserAccount }
    | { type: 'REJECT_USER'; user: UserAccount }
    | null
  >(null);
  const [pinActionMode, setPinActionMode] = useState<'SET_NEW' | 'CLEAR'>('SET_NEW');
  const [newPinInput, setNewPinInput] = useState('');

  // Quick Pre-Grant Form States
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('AREA_LEADER');
  const [newNote, setNewNote] = useState('');
  const [newManagedCompanies, setNewManagedCompanies] = useState<string[]>([]);
  const [newManagedAreas, setNewManagedAreas] = useState<string[]>([]);
  const [newManagedUnitsText, setNewManagedUnitsText] = useState('');
  const [isSubmittingPreGrant, setIsSubmittingPreGrant] = useState(false);

  // Scope Config Modal for MANAGER / SION_LEADER / AREA_LEADER / UNI_LEADER
  const [scopeModalUser, setScopeModalUser] = useState<UserAccount | null>(null);
  const [modalRole, setModalRole] = useState<UserRole>('MANAGER');
  const [modalCompanies, setModalCompanies] = useState<string[]>([]);
  const [modalAreas, setModalAreas] = useState<string[]>([]);
  const [modalUnitsText, setModalUnitsText] = useState<string>('');

  const isSuperAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    const cleanEmail = (currentUser.email || '').toLowerCase().trim();
    if (BOOTSTRAP_SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === cleanEmail)) return true;
    if (preAssignedRoles.some((p) => p.email.toLowerCase() === cleanEmail && p.role === 'SUPER_ADMIN')) {
      return true;
    }
    return false;
  }, [currentUser, preAssignedRoles]);

  const isAdminOrSuperAdmin = isSuperAdmin || currentUser?.role === 'ADMIN';
  const maxAssignableLevel = getMaxAssignableRoleLevel(currentUser?.role);
  const canAssignAnyRole = maxAssignableLevel > 0;

  const viewerCompanyScope = useMemo(() => {
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

  const viewerAreaScope = useMemo(() => {
    const set = new Set<string>();
    (currentUser?.managedAreaCodes || []).forEach((a) => {
      const n = normalizeOrgCode(a);
      if (n) set.add(n);
    });
    if (set.size === 0 && currentUser?.areaCode) {
      const n = normalizeOrgCode(currentUser.areaCode);
      if (n) set.add(n);
    }
    return set;
  }, [currentUser?.managedAreaCodes, currentUser?.areaCode]);

  const scopedCompaniesForActor = useMemo(() => {
    if (isAdminOrSuperAdmin) return companies;
    return companies.filter((c) => viewerCompanyScope.has(normalizeOrgCode(c.code)));
  }, [isAdminOrSuperAdmin, companies, viewerCompanyScope]);

  const scopedAreasForActor = useMemo(() => {
    if (isAdminOrSuperAdmin) return areas;
    if (currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER') {
      return areas.filter(
        (a) =>
          viewerCompanyScope.has(normalizeOrgCode(a.companyCode)) ||
          (currentUser.role === 'MANAGER' && viewerAreaScope.has(normalizeOrgCode(a.code)))
      );
    }
    return areas.filter(
      (a) =>
        (viewerCompanyScope.size === 0 || viewerCompanyScope.has(normalizeOrgCode(a.companyCode))) &&
        viewerAreaScope.has(normalizeOrgCode(a.code))
    );
  }, [isAdminOrSuperAdmin, areas, viewerCompanyScope, viewerAreaScope, currentUser?.role]);

  const effectiveSecurity: SystemSecurityConfig = {
    requireRegistrationApproval:
      securityConfig?.requireRegistrationApproval ??
      DEFAULT_SECURITY_CONFIG.requireRegistrationApproval,
    autoApprovePreAssigned:
      securityConfig?.autoApprovePreAssigned ?? DEFAULT_SECURITY_CONFIG.autoApprovePreAssigned,
  };

  const resolveEffectiveRole = (u: UserAccount): UserRole => {
    const uEmail = (u.email || '').toLowerCase().trim();
    if (
      u.role === 'SUPER_ADMIN' ||
      BOOTSTRAP_SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === uEmail) ||
      preAssignedRoles.some((p) => p.email.toLowerCase() === uEmail && p.role === 'SUPER_ADMIN')
    ) {
      return 'SUPER_ADMIN';
    }
    const pre = preAssignedRoles.find((p) => p.email.toLowerCase() === uEmail);
    if (u.role === 'ADMIN' || pre?.role === 'ADMIN') return 'ADMIN';
    if (u.role === 'MANAGER' || pre?.role === 'MANAGER') return 'MANAGER';
    if (u.role === 'SION_LEADER' || pre?.role === 'SION_LEADER') return 'SION_LEADER';
    if (u.role === 'AREA_LEADER' || pre?.role === 'AREA_LEADER') return 'AREA_LEADER';
    if (u.role === 'UNI_LEADER' || pre?.role === 'UNI_LEADER') return 'UNI_LEADER';
    return 'MEMBER';
  };

  const visibleUsersForActor = useMemo(() => {
    if (isAdminOrSuperAdmin) return usersList;
    return usersList.filter(
      (u) => u.id === currentUser?.id || canManageOrgRecord(currentUser || null, u)
    );
  }, [usersList, isAdminOrSuperAdmin, currentUser]);

  const pendingUsers = useMemo(
    () =>
      visibleUsersForActor
        .filter((u) => resolveUserApprovalStatus(u) === 'PENDING')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [visibleUsersForActor]
  );

  const rejectedUsersCount = useMemo(
    () => visibleUsersForActor.filter((u) => resolveUserApprovalStatus(u) === 'REJECTED').length,
    [visibleUsersForActor]
  );

  // Statistics
  const stats = useMemo(() => {
    let superAdminsCount = 0;
    let adminsCount = 0;
    let leadersAndManagersCount = 0;
    let membersCount = 0;

    visibleUsersForActor.forEach((u) => {
      const r = resolveEffectiveRole(u);
      if (r === 'SUPER_ADMIN') superAdminsCount++;
      else if (r === 'ADMIN') adminsCount++;
      else if (SCOPE_ENABLED_ROLES.includes(r)) leadersAndManagersCount++;
      else membersCount++;
    });

    return {
      totalUsers: visibleUsersForActor.length,
      superAdminsCount,
      adminsCount,
      leadersAndManagersCount,
      membersCount,
    };
  }, [visibleUsersForActor, preAssignedRoles]);

  const filteredUsers = useMemo(() => {
    return visibleUsersForActor.filter((u) => {
      const effectiveRole = resolveEffectiveRole(u);
      if (roleFilter !== 'ALL' && effectiveRole !== roleFilter) return false;

      const status = resolveUserApprovalStatus(u);
      if (approvalFilter !== 'ALL' && status !== approvalFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = u.fullName?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchCompany = u.companyCode?.toLowerCase().includes(q);
        const matchArea = u.areaCode?.toLowerCase().includes(q);
        const matchUnit = (u.unitCode || u.departmentCode)?.toLowerCase().includes(q);
        return matchName || matchEmail || matchCompany || matchArea || matchUnit;
      }
      return true;
    });
  }, [visibleUsersForActor, roleFilter, approvalFilter, searchQuery, preAssignedRoles]);

  const parseUnitList = (raw: string): string[] =>
    raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const openScopeModal = (user: UserAccount, targetRole?: UserRole) => {
    const roleToEdit = targetRole || resolveEffectiveRole(user);
    setScopeModalUser(user);
    setModalRole(roleToEdit);
    setModalCompanies(user.managedCompanyCodes || (user.companyCode ? [user.companyCode] : []));
    setModalAreas(
      user.managedAreaCodes?.length
        ? user.managedAreaCodes
        : user.areaCode
        ? [user.areaCode]
        : []
    );
    const defaultUnits = user.managedUnitCodes?.length
      ? user.managedUnitCodes
      : user.unitCode
      ? [user.unitCode]
      : [];
    setModalUnitsText(defaultUnits.join(', '));
  };

  const handleRoleChange = async (targetUser: UserAccount, targetRole: UserRole) => {
    if (!canAssignAnyRole) {
      onShowNotification('Bạn không có quyền phân quyền tài khoản!');
      return;
    }

    if (targetUser.id === currentUser?.id && targetRole !== currentUser?.role) {
      onShowNotification('Không thể tự thay đổi quyền của chính mình.');
      return;
    }

    const currentTargetRole = resolveEffectiveRole(targetUser);
    if (!canAssignTargetRole(currentUser?.role, currentTargetRole, targetRole)) {
      onShowNotification(
        `Bạn chỉ được phân quyền cho tài khoản cấp độ ${maxAssignableLevel} trở xuống.`
      );
      return;
    }

    // Nếu chọn QL Cụm -> mở modal chọn các Sion / Khu vực phụ trách
    if (targetRole === 'MANAGER') {
      openScopeModal(targetUser, 'MANAGER');
      return;
    }

    const defaultScope: ScopeSelection =
      targetRole === 'SION_LEADER'
        ? {
            managedCompanyCodes: targetUser.companyCode ? [targetUser.companyCode] : [],
            managedAreaCodes: [],
            managedUnitCodes: [],
          }
        : targetRole === 'AREA_LEADER'
        ? {
            managedCompanyCodes: targetUser.companyCode ? [targetUser.companyCode] : [],
            managedAreaCodes: targetUser.areaCode ? [targetUser.areaCode] : [],
            managedUnitCodes: targetUser.managedUnitCodes || [],
          }
        : targetRole === 'UNI_LEADER'
        ? {
            managedCompanyCodes: targetUser.companyCode ? [targetUser.companyCode] : [],
            managedAreaCodes: targetUser.areaCode ? [targetUser.areaCode] : [],
            managedUnitCodes: targetUser.managedUnitCodes?.length
              ? targetUser.managedUnitCodes
              : targetUser.unitCode
              ? [targetUser.unitCode]
              : targetUser.departmentCode
              ? [targetUser.departmentCode]
              : [],
          }
        : {
            managedCompanyCodes: [],
            managedAreaCodes: [],
            managedUnitCodes: [],
          };

    setIsUpdating(targetUser.id);
    try {
      await onUpdateUserRole(targetUser.id, targetRole, targetUser.fullName, defaultScope);
      onShowNotification(`Đã cập nhật "${targetUser.fullName}" thành ${ROLE_LABELS[targetRole]}!`);
    } catch (err: any) {
      onShowNotification(`Lỗi phân quyền: ${err?.message || 'Thao tác thất bại'}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleSaveScopeModal = async () => {
    if (!scopeModalUser) return;
    const currentTargetRole = resolveEffectiveRole(scopeModalUser);
    if (!canAssignTargetRole(currentUser?.role, currentTargetRole, modalRole)) {
      onShowNotification(
        `Bạn chỉ được cấu hình cho tài khoản cấp độ ${maxAssignableLevel} trở xuống.`
      );
      return;
    }
    const parsedUnits = parseUnitList(modalUnitsText);
    if (modalRole === 'MANAGER' && modalCompanies.length === 0 && modalAreas.length === 0) {
      onShowNotification('Vui lòng chọn ít nhất 1 Sion hoặc Khu vực phụ trách cho QL Cụm.');
      return;
    }
    setIsUpdating(scopeModalUser.id);
    try {
      await onUpdateUserRole(scopeModalUser.id, modalRole, scopeModalUser.fullName, {
        managedCompanyCodes: modalCompanies,
        managedAreaCodes: modalAreas,
        managedUnitCodes: parsedUnits,
      });
      setScopeModalUser(null);
    } catch (err: any) {
      onShowNotification(`Lỗi lưu phạm vi quản lý: ${err?.message || 'Thao tác thất bại'}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handlePreGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = newEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      onShowNotification('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (!isSuperAdmin) {
      onShowNotification('Chỉ Quản trị viên tổng mới có quyền cấp quyền.');
      return;
    }

    const parsedUnits = parseUnitList(newManagedUnitsText);
    const scope: ScopeSelection | undefined = SCOPE_ENABLED_ROLES.includes(newRole)
      ? {
          managedCompanyCodes: newManagedCompanies,
          managedAreaCodes: newManagedAreas,
          managedUnitCodes: parsedUnits,
        }
      : undefined;

    setIsSubmittingPreGrant(true);
    try {
      const existing = usersList.find((u) => u.email?.toLowerCase() === emailClean);
      if (existing) {
        await onUpdateUserRole(existing.id, newRole, existing.fullName, scope);
      }
      if (onPreAssignRole) {
        await onPreAssignRole(emailClean, newRole, newNote.trim(), scope);
      }

      onShowNotification(`Đã cấp quyền ${ROLE_LABELS[newRole]} cho ${emailClean}`);
      setNewEmail('');
      setNewNote('');
      setNewManagedCompanies([]);
      setNewManagedAreas([]);
      setNewManagedUnitsText('');
    } catch (err: any) {
      onShowNotification(`Lỗi cấp quyền: ${err?.message || 'Không thể cấp quyền'}`);
    } finally {
      setIsSubmittingPreGrant(false);
    }
  };

  const toggleItem = (list: string[], code: string, setter: (next: string[]) => void) => {
    setter(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  };

  const handleToggleSecurityFlag = async (
    key: 'requireRegistrationApproval' | 'autoApprovePreAssigned'
  ) => {
    if (!isAdminOrSuperAdmin || !onSaveSecurityConfig) return;
    setIsSavingSecurity(true);
    try {
      await onSaveSecurityConfig({
        ...effectiveSecurity,
        [key]: !effectiveSecurity[key],
      });
    } catch (err: any) {
      onShowNotification(`Không lưu được cấu hình phê duyệt: ${err?.message || 'Lỗi'}`);
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const getPendingDraft = (u: UserAccount) =>
    pendingDrafts[u.id] || {
      role: resolveEffectiveRole(u),
      companyCode: u.companyCode,
      areaCode: u.areaCode,
    };

  const updatePendingDraft = (
    u: UserAccount,
    patch: Partial<{ role: UserRole; companyCode: string; areaCode: string }>
  ) => {
    const current = getPendingDraft(u);
    const nextCompany = patch.companyCode ?? current.companyCode;
    let nextArea = patch.areaCode ?? current.areaCode;
    if (patch.companyCode && patch.companyCode !== current.companyCode) {
      const matchingAreas = areas.filter(
        (a) => a.companyCode === nextCompany && a.active !== false
      );
      if (matchingAreas.length > 0 && !matchingAreas.some((a) => a.code === nextArea)) {
        nextArea = matchingAreas[0].code;
      }
    }
    setPendingDrafts((prev) => ({
      ...prev,
      [u.id]: {
        role: patch.role ?? current.role,
        companyCode: nextCompany,
        areaCode: nextArea,
      },
    }));
  };

  const handleApproveClick = async (u: UserAccount) => {
    if (!isAdminOrSuperAdmin || !onApproveUser) return;
    const draft = getPendingDraft(u);
    const roleToGrant: UserRole =
      !isSuperAdmin && draft.role === 'SUPER_ADMIN' ? 'MEMBER' : draft.role;
    setIsUpdating(u.id);
    try {
      await onApproveUser(u, {
        role: roleToGrant,
        companyCode: draft.companyCode,
        areaCode: draft.areaCode,
      });
    } catch (err: any) {
      onShowNotification(`Lỗi phê duyệt: ${err?.message || 'Thao tác thất bại'}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'REJECT_USER') {
      if (!isAdminOrSuperAdmin || !onRejectUser) {
        setConfirmDelete(null);
        return;
      }
      setIsDeleting(true);
      try {
        await onRejectUser(confirmDelete.user, rejectReason.trim() || undefined);
        setRejectReason('');
        setConfirmDelete(null);
      } catch (err: any) {
        onShowNotification(`Lỗi từ chối: ${err?.message || 'Thao tác thất bại'}`);
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    if (confirmDelete.type === 'RESET_PIN') {
      const targetRole = resolveEffectiveRole(confirmDelete.user);
      if (!isAdminOrSuperAdmin || (!isSuperAdmin && targetRole === 'SUPER_ADMIN')) {
        onShowNotification('Chỉ Admin (Cấp 6) và Tổng Quản trị (Cấp 7) mới có quyền đổi Mã PIN!');
        setConfirmDelete(null);
        return;
      }
      if (pinActionMode === 'SET_NEW') {
        const cleanPin = newPinInput.trim();
        if (!isValidPersonalPin(cleanPin)) {
          onShowNotification('Vui lòng nhập đủ 6 chữ số cho Mã cá nhân mới.');
          return;
        }
        setIsDeleting(true);
        try {
          if (onResetUserPin) {
            await onResetUserPin(confirmDelete.user.id, confirmDelete.user.fullName, cleanPin);
          }
          setNewPinInput('');
          setConfirmDelete(null);
        } catch (err: any) {
          onShowNotification(`Lỗi đổi Mã PIN: ${err?.message || 'Thao tác thất bại'}`);
        } finally {
          setIsDeleting(false);
        }
        return;
      }
      setIsDeleting(true);
      try {
        if (onResetUserPin) {
          await onResetUserPin(confirmDelete.user.id, confirmDelete.user.fullName);
        }
        setNewPinInput('');
        setConfirmDelete(null);
      } catch (err: any) {
        onShowNotification(`Lỗi đặt lại Mã PIN: ${err?.message || 'Thao tác thất bại'}`);
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    if (!isSuperAdmin) {
      onShowNotification('Chỉ Quản trị viên tổng (Super Admin) mới có quyền thao tác mục này!');
      setConfirmDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      if (confirmDelete.type === 'USER') {
        if (!onDeleteUserAccount) return;
        const { user } = confirmDelete;
        await onDeleteUserAccount(user.id, user.fullName, user.email);
      } else {
        if (!onDeletePreAssignedRole) return;
        await onDeletePreAssignedRole(confirmDelete.email);
      }
      setConfirmDelete(null);
    } catch (err: any) {
      let msg = 'Thao tác thất bại. Vui lòng kiểm tra quyền Quản trị Tổng.';
      try {
        const parsed = JSON.parse(err?.message || '');
        if (parsed?.error) msg = parsed.error;
      } catch {
        if (err?.message) msg = err.message;
      }
      onShowNotification(`Lỗi thao tác: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-500/30 p-3.5 sm:p-5 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Phân quyền theo cấp độ · HT → QL Cụm → TS, NQ → Gru → Uni → TĐ</span>
            </div>
            <h3 className="text-base sm:text-xl font-black text-white">
              Quản Lý Vai Trò &amp; Phạm Vi Quyền Xem
            </h3>
            <p className="hidden sm:block text-xs text-slate-300 leading-relaxed">
              Quy tắc chung: Mọi cấp đều xem được BXH 15 người đầu tiên. Phạm vi chi tiết và dữ liệu được phân tách chặt chẽ theo Sion, Khu vực và Đội/Uni.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shrink-0 flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950">
              {isSuperAdmin ? <Crown className="w-4 h-4 sm:w-5 sm:h-5" /> : <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
            </div>
            <div>
              <div className="text-[10px] text-purple-200 uppercase font-bold">Vai trò hiện tại</div>
              <div className="font-extrabold text-xs sm:text-sm text-white">
                {currentUser ? ROLE_LABELS[currentUser.role] : 'Khách'}
              </div>
              <div className="text-[11px] text-slate-300 truncate max-w-[190px]">
                {currentUser?.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-800/80 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Tổng TK</span>
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0 hidden sm:inline" />
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {stats.totalUsers}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-purple-200 dark:border-purple-800/60">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] sm:text-xs font-bold text-purple-700 dark:text-purple-300 truncate">
              Tổng/Admin
            </span>
            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0 hidden sm:inline" />
          </div>
          <div className="text-base sm:text-2xl font-black text-purple-900 dark:text-purple-100 tabular-nums">
            {stats.superAdminsCount + stats.adminsCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-teal-200 dark:border-teal-800/60">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] sm:text-xs font-bold text-teal-700 dark:text-teal-300 truncate">
              QL &amp; KV
            </span>
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 shrink-0 hidden sm:inline" />
          </div>
          <div className="text-base sm:text-2xl font-black text-teal-900 dark:text-teal-100 tabular-nums">
            {stats.leadersAndManagersCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Thành viên</span>
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0 hidden sm:inline" />
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {stats.membersCount}
          </div>
        </div>
      </div>

      {/* Chế độ Phê duyệt Đăng ký mới (Admin & Tổng Quản trị) */}
      {isAdminOrSuperAdmin && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  effectiveSecurity.requireRegistrationApproval
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Chế độ Phê duyệt Đăng ký mới</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      effectiveSecurity.requireRegistrationApproval
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {effectiveSecurity.requireRegistrationApproval ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {effectiveSecurity.requireRegistrationApproval
                    ? 'Tài khoản mới đăng ký phải chờ Admin hoặc Tổng Quản trị duyệt mới được xem dữ liệu.'
                    : 'Đang mở tự do: thành viên mới tạo mã PIN 6 số xong sẽ vào trực tiếp với quyền TĐ.'}
                </p>
              </div>
            </div>

            {onSaveSecurityConfig && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSavingSecurity}
                  onClick={() => handleToggleSecurityFlag('requireRegistrationApproval')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer disabled:opacity-50 ${
                    effectiveSecurity.requireRegistrationApproval
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {effectiveSecurity.requireRegistrationApproval ? (
                    <ToggleRight className="w-4 h-4" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                  <span>
                    {effectiveSecurity.requireRegistrationApproval
                      ? 'Đang bật phê duyệt'
                      : 'Bật phê duyệt'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSavingSecurity || !effectiveSecurity.requireRegistrationApproval}
                  onClick={() => handleToggleSecurityFlag('autoApprovePreAssigned')}
                  title="Email có sẵn trong danh sách Cấp quyền trước sẽ tự động duyệt ngay khi đăng nhập lần đầu"
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold border transition cursor-pointer disabled:opacity-45 ${
                    effectiveSecurity.autoApprovePreAssigned
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Tự duyệt Email cấp trước:{' '}
                    {effectiveSecurity.autoApprovePreAssigned ? 'Bật' : 'Tắt'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hàng đợi Phê duyệt Đăng ký mới (Real-time) */}
      {isAdminOrSuperAdmin && pendingUsers.length > 0 && (
        <div className="bg-amber-50/75 dark:bg-amber-950/25 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border-2 border-amber-300 dark:border-amber-700/70 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Yêu cầu Chờ Phê duyệt Đăng ký ({pendingUsers.length})</span>
                </h4>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
                  Kiểm tra Sion, Khu vực và chọn vai trò phù hợp trước khi bấm Phê duyệt.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {pendingUsers.map((u) => {
              const draft = getPendingDraft(u);
              const areasForDraftCompany = areas.filter(
                (a) => a.companyCode === draft.companyCode && a.active !== false
              );
              const roleChoices = ROLE_ORDER.filter((r) => isSuperAdmin || getRoleLevel(r) <= 5);
              return (
                <div
                  key={u.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-amber-200 dark:border-amber-800/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-xs flex items-center justify-center shrink-0 overflow-hidden">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (u.fullName || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {u.fullName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 text-[10px] font-bold">
                          Chờ duyệt
                        </span>
                        {u.createdAt && (
                          <span className="text-[10px] text-slate-400">· {u.createdAt}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {u.email}
                      </div>
                      <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
                        Khai báo: Sion {u.companyCode} · KV {u.areaCode} · {u.departmentCode}
                        {u.unitCode ? ` · ${u.unitCode}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="w-32">
                      <CustomSelect
                        size="sm"
                        searchable={false}
                        value={draft.companyCode}
                        onChange={(val) => updatePendingDraft(u, { companyCode: val })}
                        options={companies.map((c) => ({
                          value: c.code,
                          label: formatCompanyDisplayName(c.name, c.code),
                          badge: c.code,
                        }))}
                        ariaLabel="Sion"
                      />
                    </div>
                    <div className="w-28">
                      <CustomSelect
                        size="sm"
                        searchable={false}
                        value={draft.areaCode}
                        onChange={(val) => updatePendingDraft(u, { areaCode: val })}
                        options={
                          areasForDraftCompany.length > 0
                            ? areasForDraftCompany.map((a) => ({
                                value: a.code,
                                label: a.name || `KV ${a.code}`,
                                badge: a.code,
                              }))
                            : [{ value: draft.areaCode, label: `KV ${draft.areaCode}` }]
                        }
                        ariaLabel="Khu vực"
                      />
                    </div>
                    <div className="w-40">
                      <CustomSelect
                        size="sm"
                        searchable={false}
                        menuMinWidth={220}
                        value={draft.role}
                        onChange={(val) => updatePendingDraft(u, { role: val as UserRole })}
                        options={roleChoices.map((r) => ({
                          value: r,
                          label: ROLE_DISPLAY_META[r].shortLabel,
                          badge: ROLE_DISPLAY_META[r].codeBadge,
                        }))}
                        ariaLabel="Vai trò khi duyệt"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isUpdating === u.id}
                      onClick={() => handleApproveClick(u)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Phê duyệt</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUpdating === u.id}
                      onClick={() => {
                        setRejectReason('');
                        setConfirmDelete({ type: 'REJECT_USER', user: u });
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Từ chối</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Pre-Grant Form */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-700 space-y-3">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-600" />
              <span>Cấp Quyền Nhanh Bằng Email</span>
            </h4>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Áp dụng ngay cho tài khoản đã đăng ký hoặc tự động kích hoạt khi email này đăng nhập lần đầu.
            </p>
          </div>

          <form onSubmit={handlePreGrantSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email tài khoản <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="vd: truongkv1@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vai trò cấp
                </label>
                <CustomSelect
                  size="sm"
                  searchable={false}
                  value={newRole}
                  onChange={(val) => setNewRole(val as UserRole)}
                  menuMinWidth={250}
                  options={ROLE_ORDER.map((r) => ({
                    value: r,
                    label: ROLE_DISPLAY_META[r].label,
                    badge: ROLE_DISPLAY_META[r].codeBadge,
                    description: ROLE_DISPLAY_META[r].scopeSummary,
                  }))}
                />
              </div>

              <div className="sm:col-span-4 flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ghi chú đơn vị..."
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={isSubmittingPreGrant}
                  className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cấp quyền</span>
                </button>
              </div>
            </div>

            {/* Scope selector for MANAGER / SION_LEADER / AREA_LEADER / UNI_LEADER */}
            {SCOPE_ENABLED_ROLES.includes(newRole) && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Chọn phạm vi phụ trách (Sion / Khu vực / Đội Uni):
                </div>
                {(newRole === 'MANAGER' || newRole === 'SION_LEADER' || newRole === 'AREA_LEADER') &&
                  companies.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500">Theo Sion / Công ty:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {companies.map((c) => {
                          const checked = newManagedCompanies.includes(c.code);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                toggleItem(newManagedCompanies, c.code, setNewManagedCompanies)
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                checked
                                  ? 'bg-blue-700 text-white border-blue-700'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {c.code} · {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                {(newRole === 'MANAGER' || newRole === 'AREA_LEADER') && areas.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500">Theo Khu vực:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {areas.map((a) => {
                        const checked = newManagedAreas.includes(a.code);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => toggleItem(newManagedAreas, a.code, setNewManagedAreas)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              checked
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {a.companyCode} / KV {a.code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {(newRole === 'AREA_LEADER' || newRole === 'UNI_LEADER') && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">
                      Đội / Uni quản lý (cách nhau bởi dấu phẩy):
                    </div>
                    <input
                      type="text"
                      value={newManagedUnitsText}
                      onChange={(e) => setNewManagedUnitsText(e.target.value)}
                      placeholder="VD: Uni 1, Đội Sứ Đồ 2..."
                      className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}
          </form>

          {preAssignedRoles.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                Danh sách cấp quyền trước ({preAssignedRoles.length}):
              </div>
              <div className="flex flex-wrap gap-2">
                {preAssignedRoles.map((pa) => (
                  <div
                    key={pa.email}
                    className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200"
                  >
                    <span className="font-semibold">{pa.email}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-700 text-white">
                      {ROLE_LABELS[pa.role] || pa.role}
                    </span>
                    {(pa.managedAreaCodes?.length || pa.managedCompanyCodes?.length) ? (
                      <span className="text-[10px] text-slate-500">
                        ({[...(pa.managedCompanyCodes || []), ...(pa.managedAreaCodes || [])].join(', ')})
                      </span>
                    ) : null}
                    {onDeletePreAssignedRole && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            type: 'PRE_ASSIGN',
                            email: pa.email,
                            role: pa.role,
                          })
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Thu hồi quyền"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User List Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Danh sách Tài khoản &amp; Phân quyền ({filteredUsers.length})
            </h4>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Thay đổi vai trò và phạm vi khu vực có hiệu lực ngay trên toàn hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdminOrSuperAdmin && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {(
                  [
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'APPROVED', label: 'Đã duyệt' },
                    { id: 'PENDING', label: `Chờ duyệt${pendingUsers.length ? ` (${pendingUsers.length})` : ''}` },
                    { id: 'REJECTED', label: `Từ chối${rejectedUsersCount ? ` (${rejectedUsersCount})` : ''}` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setApprovalFilter(tab.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      approvalFilter === tab.id
                        ? tab.id === 'PENDING' && pendingUsers.length > 0
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm tên, email, khu vực..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 w-44 sm:w-52"
              />
            </div>

            <div className="w-44">
              <CustomSelect
                size="sm"
                searchable={false}
                value={roleFilter}
                onChange={(val) => setRoleFilter(val as 'ALL' | UserRole)}
                menuMinWidth={240}
                options={[
                  { value: 'ALL', label: 'Tất cả cấp bậc' },
                  ...ROLE_ORDER.map((r) => ({
                    value: r,
                    label: ROLE_DISPLAY_META[r].label,
                    badge: ROLE_DISPLAY_META[r].codeBadge,
                  })),
                ]}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                <th className="py-3 px-3">Tài khoản</th>
                <th className="py-3 px-3">Đơn vị / Phạm vi quản lý</th>
                <th className="py-3 px-3">Vai trò hiện tại</th>
                <th className="py-3 px-3 text-right">Thao tác phân quyền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    Không tìm thấy tài khoản nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const effectiveRole = resolveEffectiveRole(user);
                  const roleMeta = ROLE_DISPLAY_META[effectiveRole];
                  const isSelf = user.id === currentUser?.id;
                  const isBootstrapSuperAdmin = BOOTSTRAP_SUPER_ADMIN_EMAILS.some(
                    (e) => e.toLowerCase() === (user.email || '').toLowerCase().trim()
                  );
                  const companyObj = companies.find((c) => c.code === user.companyCode);
                  const scopeParts = [
                    ...(user.managedCompanyCodes || []).map((c) => `Sion ${c}`),
                    ...(user.managedAreaCodes || []).map((a) => `KV ${a}`),
                    ...(user.managedUnitCodes || []).map((u) => `Uni ${u}`),
                  ];

                  const approvalStatus = resolveUserApprovalStatus(user);
                  const canModifyThisUserRole =
                    !isSelf &&
                    canAssignTargetRole(currentUser?.role, effectiveRole, effectiveRole);
                  const assignableRoleOptions = ROLE_ORDER.filter(
                    (r) => getRoleLevel(r) <= maxAssignableLevel
                  );
                  const canChangeThisUserPin =
                    Boolean(onResetUserPin) &&
                    isAdminOrSuperAdmin &&
                    (isSuperAdmin || effectiveRole !== 'SUPER_ADMIN');

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                        isSelf
                          ? 'bg-purple-50/40 dark:bg-purple-950/20'
                          : approvalStatus === 'PENDING'
                          ? 'bg-amber-50/50 dark:bg-amber-950/15'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (user.fullName || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              <span className="truncate">
                                {user.fullName} {isSelf ? '(Bạn)' : ''}
                              </span>
                              {approvalStatus === 'PENDING' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold shrink-0">
                                  Chờ duyệt
                                </span>
                              )}
                              {approvalStatus === 'REJECTED' && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/70 text-rose-700 dark:text-rose-200 text-[10px] font-extrabold shrink-0">
                                  Đã từ chối
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">
                          {companyObj?.code || user.companyCode} · KV {user.areaCode}
                          {user.unitCode ? ` · ${user.unitCode}` : ''}
                        </div>
                        {scopeParts.length > 0 && (
                          <div className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold mt-0.5">
                            Phụ trách: {scopeParts.join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${roleMeta.badgeClass}`}
                        >
                          <span>{roleMeta.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdminOrSuperAdmin && approvalStatus !== 'APPROVED' && onApproveUser && (
                            <button
                              type="button"
                              disabled={isUpdating === user.id}
                              onClick={() => handleApproveClick(user)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                              title={
                                approvalStatus === 'REJECTED'
                                  ? 'Phê duyệt lại tài khoản này'
                                  : 'Phê duyệt đăng ký'
                              }
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{approvalStatus === 'REJECTED' ? 'Duyệt lại' : 'Duyệt'}</span>
                            </button>
                          )}

                          {isAdminOrSuperAdmin && approvalStatus === 'PENDING' && onRejectUser && (
                            <button
                              type="button"
                              disabled={isUpdating === user.id}
                              onClick={() => {
                                setRejectReason('');
                                setConfirmDelete({ type: 'REJECT_USER', user });
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold cursor-pointer shrink-0 disabled:opacity-50"
                              title="Từ chối đăng ký"
                            >
                              Từ chối
                            </button>
                          )}

                          {canModifyThisUserRole ? (
                            <>
                              <div className="w-44">
                                <CustomSelect
                                  size="sm"
                                  align="right"
                                  searchable={false}
                                  menuMinWidth={240}
                                  disabled={isUpdating === user.id}
                                  value={effectiveRole}
                                  onChange={(val) => handleRoleChange(user, val as UserRole)}
                                  options={assignableRoleOptions.map((r) => ({
                                    value: r,
                                    label: ROLE_DISPLAY_META[r].label,
                                    badge: ROLE_DISPLAY_META[r].codeBadge,
                                  }))}
                                />
                              </div>

                              {SCOPE_ENABLED_ROLES.includes(effectiveRole) && (
                                <button
                                  type="button"
                                  onClick={() => openScopeModal(user, effectiveRole)}
                                  className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 cursor-pointer shrink-0"
                                  title="Chọn Sion / Khu vực / Uni phụ trách"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            !isSelf &&
                            approvalStatus === 'APPROVED' && (
                              <span className="text-[11px] text-slate-400 italic">
                                Cấp ngang/cao hơn
                              </span>
                            )
                          )}

                          {canChangeThisUserPin && (
                            <button
                              type="button"
                              disabled={isUpdating === user.id}
                              onClick={() => {
                                setPinActionMode('SET_NEW');
                                setNewPinInput('');
                                setConfirmDelete({
                                  type: 'RESET_PIN',
                                  user,
                                });
                              }}
                              className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 cursor-pointer shrink-0 disabled:opacity-50"
                              title="Thay đổi hoặc đặt lại Mã cá nhân 6 số"
                              aria-label={`Đổi Mã PIN cho ${user.fullName}`}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isSuperAdmin && onDeleteUserAccount && !isSelf && !isBootstrapSuperAdmin && (
                            <button
                              type="button"
                              disabled={isUpdating === user.id}
                              onClick={() =>
                                setConfirmDelete({
                                  type: 'USER',
                                  user,
                                  effectiveRole,
                                })
                              }
                              className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 cursor-pointer shrink-0 disabled:opacity-50"
                              title="Xóa tài khoản khỏi danh sách phân quyền"
                              aria-label={`Xóa tài khoản ${user.fullName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
            <ShieldCheck className="w-4 h-4" />
            <span>Ma trận Phân quyền Theo Cấp Độ (HT → QL Cụm → TS, NQ → Gru → Uni → TĐ)</span>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Chung: Xem được BXH 15 người đầu tiên
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                <th className="py-2 px-2">Phạm vi / Chức năng</th>
                <th className="py-2 px-2 text-center">HT (Cấp 6-7)</th>
                <th className="py-2 px-2 text-center">QL Cụm (Cấp 5)</th>
                <th className="py-2 px-2 text-center">TS, NQ (Cấp 4)</th>
                <th className="py-2 px-2 text-center">Gru (Cấp 3)</th>
                <th className="py-2 px-2 text-center">Uni (Cấp 2)</th>
                <th className="py-2 px-2 text-center">TĐ (Cấp 1)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-2 px-2 font-medium">Xem BXH 15 người đầu tiên (Chung)</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Xem BXH chi tiết &amp; Dữ liệu tổng hợp</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">Toàn bộ</td>
                <td className="py-2 px-2 text-center text-amber-600 font-bold">Tổng các Sion trong cụm</td>
                <td className="py-2 px-2 text-center text-purple-600 font-bold">Thành viên Sion</td>
                <td className="py-2 px-2 text-center text-teal-600 font-bold">Uni &amp; TV quản lý</td>
                <td className="py-2 px-2 text-center text-sky-600 font-bold">TV đội mình</td>
                <td className="py-2 px-2 text-center text-slate-600 font-bold">Chỉ KQ của mình</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Xem &amp; hỗ trợ Sổ tay MĐ</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">Toàn bộ</td>
                <td className="py-2 px-2 text-center text-amber-600 font-bold">Cụm quản lý</td>
                <td className="py-2 px-2 text-center text-purple-600 font-bold">Sion mình</td>
                <td className="py-2 px-2 text-center text-teal-600 font-bold">KV quản lý</td>
                <td className="py-2 px-2 text-center text-sky-600 font-bold">Đội Uni mình</td>
                <td className="py-2 px-2 text-center text-slate-600 font-bold">Cá nhân</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Trang Quản trị: Tổ chức &amp; Nhân sự</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">Toàn bộ</td>
                <td className="py-2 px-2 text-center text-amber-600 font-bold">Trong cụm</td>
                <td className="py-2 px-2 text-center text-purple-600 font-bold">Trong Sion</td>
                <td className="py-2 px-2 text-center text-teal-600 font-bold">Trong KV</td>
                <td className="py-2 px-2 text-center text-sky-600 font-bold">Trong Uni</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Phân quyền người dùng cấp dưới</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">≤ Cấp 5 (Tổng: 7)</td>
                <td className="py-2 px-2 text-center text-amber-600 font-bold">≤ Cấp 4</td>
                <td className="py-2 px-2 text-center text-purple-600 font-bold">≤ Cấp 3</td>
                <td className="py-2 px-2 text-center text-teal-600 font-bold">≤ Cấp 2</td>
                <td className="py-2 px-2 text-center text-sky-600 font-bold">≤ Cấp 1</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Thay đổi / đặt lại Mã PIN 6 số</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓ (Cấp 6–7)</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Cấu hình Hệ thống, Điểm, Banner, Duyệt ĐK</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chọn phạm vi Sion / Khu vực / Uni cho QL Cụm, TS/NQ, Gru, Uni */}
      {scopeModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Cấu hình phạm vi cho {scopeModalUser.fullName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vai trò: <strong>{ROLE_LABELS[modalRole]}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScopeModalUser(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scopedCompaniesForActor.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Chọn Sion / Công ty phụ trách:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scopedCompaniesForActor.map((c) => {
                    const selected = modalCompanies.includes(c.code);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleItem(modalCompanies, c.code, setModalCompanies)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 cursor-pointer ${
                          selected
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <span>
                          {c.code} · {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {scopedAreasForActor.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <span>Chọn từng Khu vực phụ trách:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {scopedAreasForActor.map((a) => {
                    const selected = modalAreas.includes(a.code);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleItem(modalAreas, a.code, setModalAreas)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                          selected
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 shrink-0" />}
                        <span className="truncate">
                          {a.companyCode} · KV {a.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(modalRole === 'AREA_LEADER' || modalRole === 'UNI_LEADER') && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mã Đội / Uni quản lý (cách nhau bởi dấu phẩy):
                </label>
                <input
                  type="text"
                  value={modalUnitsText}
                  onChange={(e) => setModalUnitsText(e.target.value)}
                  placeholder="VD: Uni 1, Đội Sứ Đồ 1 (để trống nếu quản cả khu vực)"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setScopeModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isUpdating === scopeModalUser.id}
                onClick={handleSaveScopeModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Lưu phân quyền</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa tài khoản / thu hồi quyền */}
      {confirmDelete && (
        <div
          onClick={() => {
            if (!isDeleting) setConfirmDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmDelete.type === 'RESET_PIN'
                    ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
                    : 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400'
                }`}
              >
                {confirmDelete.type === 'RESET_PIN' ? (
                  <KeyRound className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {confirmDelete.type === 'USER'
                    ? 'Xác nhận xóa tài khoản khỏi phân quyền'
                    : confirmDelete.type === 'RESET_PIN'
                    ? 'Thay đổi / Đặt lại Mã cá nhân 6 số'
                    : confirmDelete.type === 'REJECT_USER'
                    ? 'Xác nhận từ chối yêu cầu đăng ký'
                    : 'Xác nhận thu hồi cấp quyền trước'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {confirmDelete.type === 'USER'
                    ? 'Tài khoản này sẽ bị xóa khỏi danh sách phân quyền và mất vai trò truy cập hiện tại. Dữ liệu báo cáo hoặc thành viên cũ (nếu có) không bị mất.'
                    : confirmDelete.type === 'RESET_PIN'
                    ? 'Admin (Cấp 6) & Tổng Quản trị (Cấp 7) có thể đặt trực tiếp Mã PIN 6 số mới cho tài khoản này hoặc xóa PIN cũ để người dùng tự đặt lại.'
                    : confirmDelete.type === 'REJECT_USER'
                    ? 'Người dùng này sẽ không thể truy cập vào dữ liệu hệ thống và sẽ thấy thông báo chưa được duyệt khi đăng nhập.'
                    : 'Email này sẽ bị xóa khỏi danh sách cấp quyền trước và không còn tự động nhận vai trò khi đăng nhập.'}
                </p>
              </div>
            </div>

            {confirmDelete.type === 'USER' ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {confirmDelete.user.fullName}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${
                      ROLE_DISPLAY_META[confirmDelete.effectiveRole].badgeClass
                    }`}
                  >
                    {ROLE_LABELS[confirmDelete.effectiveRole]}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {confirmDelete.user.email}
                </div>
              </div>
            ) : confirmDelete.type === 'RESET_PIN' || confirmDelete.type === 'REJECT_USER' ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {confirmDelete.user.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {confirmDelete.user.email} · {confirmDelete.user.companyCode} · KV{' '}
                    {confirmDelete.user.areaCode}
                  </div>
                </div>
                {confirmDelete.type === 'RESET_PIN' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setPinActionMode('SET_NEW')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          pinActionMode === 'SET_NEW'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Đổi Mã PIN mới
                      </button>
                      <button
                        type="button"
                        onClick={() => setPinActionMode('CLEAR')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          pinActionMode === 'CLEAR'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Xóa PIN cũ (Đặt lại)
                      </button>
                    </div>

                    {pinActionMode === 'SET_NEW' ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Nhập Mã cá nhân 6 chữ số mới
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="VD: 123456"
                          className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold tracking-[0.35em] text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                        Mã PIN hiện tại sẽ bị xóa. Người dùng sẽ được yêu cầu tự tạo Mã 6 số mới khi đăng nhập lại.
                      </div>
                    )}
                  </div>
                )}
                {confirmDelete.type === 'REJECT_USER' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Lý do từ chối (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="VD: Chưa đúng Sion / Khu vực sinh hoạt..."
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {confirmDelete.email}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-700 text-white shrink-0">
                  {ROLE_LABELS[confirmDelete.role] || confirmDelete.role}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  confirmDelete.type === 'RESET_PIN'
                    ? pinActionMode === 'CLEAR'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmDelete.type === 'RESET_PIN' ? (
                  <KeyRound className="w-3.5 h-3.5" />
                ) : confirmDelete.type === 'REJECT_USER' ? (
                  <XCircle className="w-3.5 h-3.5" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {isDeleting
                    ? 'Đang xử lý...'
                    : confirmDelete.type === 'USER'
                    ? 'Xóa tài khoản'
                    : confirmDelete.type === 'RESET_PIN'
                    ? pinActionMode === 'SET_NEW'
                      ? 'Lưu Mã PIN mới'
                      : 'Xóa PIN cũ'
                    : confirmDelete.type === 'REJECT_USER'
                    ? 'Từ chối đăng ký'
                    : 'Thu hồi quyền'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
