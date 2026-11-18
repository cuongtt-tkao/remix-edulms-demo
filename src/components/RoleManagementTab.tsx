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
} from 'lucide-react';
import { UserAccount, UserRole, RoleAssignment, Company, Area, Department } from '../types/edulms';
import { BOOTSTRAP_SUPER_ADMIN_EMAILS } from '../firebase';

interface ScopeSelection {
  managedCompanyCodes?: string[];
  managedAreaCodes?: string[];
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
  preAssignedRoles?: RoleAssignment[];
  onPreAssignRole?: (
    email: string,
    role: UserRole,
    note?: string,
    scope?: ScopeSelection
  ) => Promise<void>;
  onDeletePreAssignedRole?: (email: string) => Promise<void>;
  onShowNotification: (msg: string) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Quản trị Tổng',
  ADMIN: 'Ban Quản Trị',
  MANAGER: 'Nhà quản lý',
  AREA_LEADER: 'Khu vực trưởng',
  MEMBER: 'Thành viên',
};

export const RoleManagementTab: React.FC<RoleManagementTabProps> = ({
  currentUser,
  usersList,
  companies,
  areas,
  onUpdateUserRole,
  preAssignedRoles = [],
  onPreAssignRole,
  onDeletePreAssignedRole,
  onShowNotification,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Quick Pre-Grant Form States
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('AREA_LEADER');
  const [newNote, setNewNote] = useState('');
  const [newManagedCompanies, setNewManagedCompanies] = useState<string[]>([]);
  const [newManagedAreas, setNewManagedAreas] = useState<string[]>([]);
  const [isSubmittingPreGrant, setIsSubmittingPreGrant] = useState(false);

  // Scope Config Modal for MANAGER / AREA_LEADER
  const [scopeModalUser, setScopeModalUser] = useState<UserAccount | null>(null);
  const [modalRole, setModalRole] = useState<UserRole>('MANAGER');
  const [modalCompanies, setModalCompanies] = useState<string[]>([]);
  const [modalAreas, setModalAreas] = useState<string[]>([]);

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
    if (u.role === 'AREA_LEADER' || pre?.role === 'AREA_LEADER') return 'AREA_LEADER';
    return 'MEMBER';
  };

  // Statistics
  const stats = useMemo(() => {
    let superAdminsCount = 0;
    let adminsCount = 0;
    let leadersAndManagersCount = 0;
    let membersCount = 0;

    usersList.forEach((u) => {
      const r = resolveEffectiveRole(u);
      if (r === 'SUPER_ADMIN') superAdminsCount++;
      else if (r === 'ADMIN') adminsCount++;
      else if (r === 'MANAGER' || r === 'AREA_LEADER') leadersAndManagersCount++;
      else membersCount++;
    });

    return {
      totalUsers: usersList.length,
      superAdminsCount,
      adminsCount,
      leadersAndManagersCount,
      membersCount,
    };
  }, [usersList, preAssignedRoles]);

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const effectiveRole = resolveEffectiveRole(u);
      if (roleFilter !== 'ALL' && effectiveRole !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = u.fullName?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchCompany = u.companyCode?.toLowerCase().includes(q);
        const matchArea = u.areaCode?.toLowerCase().includes(q);
        return matchName || matchEmail || matchCompany || matchArea;
      }
      return true;
    });
  }, [usersList, roleFilter, searchQuery, preAssignedRoles]);

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
  };

  const handleRoleChange = async (targetUser: UserAccount, targetRole: UserRole) => {
    if (!isSuperAdmin) {
      onShowNotification('Chỉ Quản trị viên tổng (Super Admin) mới có quyền thay đổi vai trò!');
      return;
    }

    if (targetUser.id === currentUser?.id && targetRole !== 'SUPER_ADMIN') {
      onShowNotification('Không thể tự hạ quyền của chính mình.');
      return;
    }

    // Nếu chọn Nhà quản lý -> mở modal chọn các Khu vực / Công ty phụ trách
    if (targetRole === 'MANAGER') {
      openScopeModal(targetUser, 'MANAGER');
      return;
    }

    const defaultScope: ScopeSelection =
      targetRole === 'AREA_LEADER'
        ? {
            managedCompanyCodes: targetUser.companyCode ? [targetUser.companyCode] : [],
            managedAreaCodes: targetUser.areaCode ? [targetUser.areaCode] : [],
          }
        : {
            managedCompanyCodes: [],
            managedAreaCodes: [],
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
    if (modalRole === 'MANAGER' && modalCompanies.length === 0 && modalAreas.length === 0) {
      onShowNotification('Vui lòng chọn ít nhất 1 Công ty hoặc Khu vực phụ trách cho Nhà quản lý.');
      return;
    }
    setIsUpdating(scopeModalUser.id);
    try {
      await onUpdateUserRole(scopeModalUser.id, modalRole, scopeModalUser.fullName, {
        managedCompanyCodes: modalCompanies,
        managedAreaCodes: modalAreas,
      });
      setScopeModalUser(null);
    } catch (err: any) {
      onShowNotification(`Lỗi lưu phạm vi quản lý: ${err?.message || 'Thất bại'}`);
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

    const scope: ScopeSelection | undefined =
      newRole === 'MANAGER'
        ? { managedCompanyCodes: newManagedCompanies, managedAreaCodes: newManagedAreas }
        : newRole === 'AREA_LEADER'
        ? { managedCompanyCodes: newManagedCompanies, managedAreaCodes: newManagedAreas }
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
    } catch (err: any) {
      onShowNotification(`Lỗi cấp quyền: ${err?.message || 'Không thể cấp quyền'}`);
    } finally {
      setIsSubmittingPreGrant(false);
    }
  };

  const toggleItem = (list: string[], code: string, setter: (next: string[]) => void) => {
    setter(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-500/30 p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-4 h-4" />
              <span>Hệ thống Phân quyền 5 Cấp · Hành Thực Lục</span>
            </div>
            <h3 className="text-xl font-black text-white">
              Quản Lý Vai Trò &amp; Phạm Vi Khu Vực
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Phân quyền rõ ràng từ Thành viên → Khu vực trưởng → Nhà quản lý → Ban Quản trị → Quản trị Tổng. Dữ liệu MĐ và báo cáo tự động giới hạn đúng theo phạm vi cấp bậc.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 shrink-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950">
              {isSuperAdmin ? <Crown className="w-5 h-5" /> : <Shield className="w-5 h-5 text-white" />}
            </div>
            <div>
              <div className="text-[10px] text-purple-200 uppercase font-bold">Vai trò hiện tại</div>
              <div className="font-extrabold text-sm text-white">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500">Tổng tài khoản</span>
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {stats.totalUsers}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-purple-200 dark:border-purple-800/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
              Tổng &amp; Admin
            </span>
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-purple-900 dark:text-purple-100 tabular-nums">
            {stats.superAdminsCount + stats.adminsCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-teal-200 dark:border-teal-800/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
              Quản lý &amp; KV Trưởng
            </span>
            <MapPin className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-900 dark:text-teal-100 tabular-nums">
            {stats.leadersAndManagersCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500">Thành viên</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {stats.membersCount}
          </div>
        </div>
      </div>

      {/* Quick Pre-Grant Form */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-600" />
              <span>Cấp Quyền Nhanh Bằng Email</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="AREA_LEADER">Khu vực trưởng</option>
                  <option value="MANAGER">Nhà quản lý</option>
                  <option value="ADMIN">Ban Quản Trị</option>
                  <option value="SUPER_ADMIN">Quản Trị Tổng</option>
                  <option value="MEMBER">Thành Viên</option>
                </select>
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

            {/* Scope selector for MANAGER or AREA_LEADER */}
            {(newRole === 'MANAGER' || newRole === 'AREA_LEADER') && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Chọn phạm vi phụ trách (Công ty / Khu vực):
                </div>
                {newRole === 'MANAGER' && companies.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500">Theo Công ty:</div>
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
                {areas.length > 0 && (
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
                        onClick={() => onDeletePreAssignedRole(pa.email)}
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
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
              Danh sách Tài khoản &amp; Phân quyền ({filteredUsers.length})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Thay đổi vai trò và phạm vi khu vực có hiệu lực ngay trên toàn hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm tên, email, khu vực..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 w-48 sm:w-56"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Tất cả cấp</option>
              <option value="SUPER_ADMIN">Quản trị Tổng</option>
              <option value="ADMIN">Ban Quản Trị</option>
              <option value="MANAGER">Nhà quản lý</option>
              <option value="AREA_LEADER">Khu vực trưởng</option>
              <option value="MEMBER">Thành viên</option>
            </select>
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
                  const isSelf = user.id === currentUser?.id;
                  const companyObj = companies.find((c) => c.code === user.companyCode);
                  const scopeParts = [
                    ...(user.managedCompanyCodes || []).map((c) => `CT ${c}`),
                    ...(user.managedAreaCodes || []).map((a) => `KV ${a}`),
                  ];

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                        isSelf ? 'bg-purple-50/40 dark:bg-purple-950/20' : ''
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
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {user.fullName} {isSelf ? '(Bạn)' : ''}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">
                          {companyObj?.code || user.companyCode} · KV {user.areaCode}
                        </div>
                        {scopeParts.length > 0 && (
                          <div className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold mt-0.5">
                            Phụ trách: {scopeParts.join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block font-bold text-xs ${
                            effectiveRole === 'SUPER_ADMIN'
                              ? 'text-purple-700 dark:text-purple-300'
                              : effectiveRole === 'ADMIN'
                              ? 'text-blue-700 dark:text-blue-300'
                              : effectiveRole === 'MANAGER'
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : effectiveRole === 'AREA_LEADER'
                              ? 'text-teal-700 dark:text-teal-300'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {ROLE_LABELS[effectiveRole]}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        {isSuperAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <select
                              value={effectiveRole}
                              disabled={isUpdating === user.id}
                              onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white cursor-pointer"
                            >
                              <option value="MEMBER">Thành viên</option>
                              <option value="AREA_LEADER">Khu vực trưởng</option>
                              <option value="MANAGER">Nhà quản lý</option>
                              <option value="ADMIN">Ban Quản Trị</option>
                              <option value="SUPER_ADMIN">Quản trị Tổng</option>
                            </select>

                            {(effectiveRole === 'MANAGER' || effectiveRole === 'AREA_LEADER') && (
                              <button
                                type="button"
                                onClick={() => openScopeModal(user, effectiveRole)}
                                className="p-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 cursor-pointer"
                                title="Chọn các khu vực / công ty phụ trách"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Chỉ Quản trị Tổng được sửa
                          </span>
                        )}
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
        <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
          <ShieldCheck className="w-4 h-4" />
          <span>Ma trận Phân quyền 5 Cấp</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                <th className="py-2 px-2">Chức năng</th>
                <th className="py-2 px-2 text-center">Tổng</th>
                <th className="py-2 px-2 text-center">Admin</th>
                <th className="py-2 px-2 text-center">Quản lý</th>
                <th className="py-2 px-2 text-center">KV Trưởng</th>
                <th className="py-2 px-2 text-center">TV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-2 px-2 font-medium">Báo cáo hằng ngày &amp; Sổ tay MĐ cá nhân</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Xem &amp; sửa hộ tiến độ/ghi chú MĐ khu vực mình</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">Toàn bộ</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">Toàn bộ</td>
                <td className="py-2 px-2 text-center text-teal-600 font-bold">KV được giao</td>
                <td className="py-2 px-2 text-center text-teal-600 font-bold">1 KV</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-medium">Quản lý Banner, Event, Nhân sự, Excel</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-2 font-bold text-purple-700 dark:text-purple-300">
                  Phân quyền các cấp &amp; Phạm vi quản lý
                </td>
                <td className="py-2 px-2 text-center text-purple-700 font-black">✓</td>
                <td className="py-2 px-2 text-center text-slate-400">Chỉ xem</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
                <td className="py-2 px-2 text-center text-slate-300">✗</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chọn phạm vi Công ty / Khu vực cho Nhà quản lý & Khu vực trưởng */}
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

            {companies.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Chọn toàn Công ty phụ trách (nếu quản lý cả công ty):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {companies.map((c) => {
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

            {areas.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <span>Chọn từng Khu vực phụ trách:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {areas.map((a) => {
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
    </div>
  );
};
