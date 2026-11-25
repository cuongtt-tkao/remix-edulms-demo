import React from 'react';
import {
  Menu,
  X,
  Trophy,
  BookOpen,
  User,
  Shield,
  ClipboardList,
  RefreshCw,
  LogOut,
  LogIn,
  Sun,
  Moon,
  ChevronRight,
  Users,
  CalendarDays,
  CalendarCheck2,
  GraduationCap,
  BookMarked,
  Lock,
  Bell,
  Clock,
  CheckCircle2,
  ChevronDown,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { UserAccount, ROLE_DISPLAY_META, canAccessAdminPanel } from '../types/edulms';
import { formatAreaScopeLabel } from '../utils/rbac';

export type AppTab =
  | 'ENTRY'
  | 'HONORS'
  | 'DISCIPLES'
  | 'REPORT_OVERVIEW'
  | 'PROFILE'
  | 'JOURNAL_CHEER'
  | 'WORK_SCHEDULE'
  | 'EVENT_HUB'
  | 'EDU_LMS'
  | 'EDU_CMS'
  | 'ADMIN';

interface TopHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenRulesModal: () => void;
  onRefreshUI: () => void;
  onOpenAuthModal: () => void;
  currentUser: UserAccount | null;
  onNavigateProfile: () => void;
  onLogout: () => void;
  onLockPin?: () => void;
  pendingApprovals?: UserAccount[];
  onNavigateAdminRoles?: () => void;
  onNavigateAdmin?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateHome: () => void;
}

/**
 * Header tối giản, hài hòa:
 * Sau khi đăng nhập: bỏ nút "Tài khoản", thay bằng hồ sơ cá nhân + nút Đăng xuất trực tiếp.
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onOpenRulesModal,
  onRefreshUI,
  onOpenAuthModal,
  currentUser,
  onNavigateProfile,
  onLogout,
  onLockPin,
  pendingApprovals = [],
  onNavigateAdminRoles,
  onNavigateAdmin,
  isDarkMode,
  onToggleDarkMode,
  onNavigateHome,
}) => {
  const [isSpinning, setIsSpinning] = React.useState(false);
  const [isBellOpen, setIsBellOpen] = React.useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = React.useState(false);
  const bellWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const accountMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isBellOpen && !isAccountMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (isBellOpen && bellWrapperRef.current && !bellWrapperRef.current.contains(e.target as Node)) {
        setIsBellOpen(false);
      }
      if (
        isAccountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsBellOpen(false);
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBellOpen, isAccountMenuOpen]);

  const isAdminViewer =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const canAccessAdmin = canAccessAdminPanel(currentUser?.role);

  const handleRefreshClick = () => {
    setIsSpinning(true);
    onRefreshUI();
    setTimeout(() => setIsSpinning(false), 500);
  };

  const roleMeta = currentUser
    ? ROLE_DISPLAY_META[currentUser.role] || ROLE_DISPLAY_META.MEMBER
    : null;

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/90 dark:border-slate-800 sticky top-0 z-40 h-16 px-2.5 sm:px-5 flex items-center justify-between gap-2 backdrop-blur-md shadow-2xs transition-colors">
      {/* Left: Sidebar Toggle + Brand Name */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Thu gọn thanh điều hướng' : 'Mở thanh điều hướng'}
          className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-sm ring-1 ring-amber-300/60 shrink-0 group-hover:scale-105 transition-transform">
            <div className="w-full h-full rounded-[10px] bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 2L13.5 5.5L17 6L14.5 8.5L15 12L12 10.2L9 12L9.5 8.5L7 6L10.5 5.5L12 2Z"
                  fill="currentColor"
                  fillOpacity="0.9"
                  strokeWidth="0.5"
                  stroke="#fef08a"
                />
                <path
                  d="M4 19.5C5.5 18 8 18 12 19C16 18 18.5 18 20 19.5V8.5C18.5 7 16 7 12 8C8 7 5.5 7 4 8.5V19.5Z"
                  fill="#fef3c7"
                  fillOpacity="0.22"
                  stroke="#fde047"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <line x1="12" y1="8" x2="12" y2="19" stroke="#fde047" strokeWidth="1.2" />
              </svg>
            </div>
          </div>

          <div className="min-w-0">
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white font-cinzel truncate block whitespace-nowrap">
              Hành Thực Lục
            </span>
          </div>
        </button>
      </div>

      {/* Right: Utility buttons + Unified Account Mini Menu */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenRulesModal}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-700/60 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          title="Xem thể lệ & quy đổi điểm"
          aria-label="Xem thể lệ & quy đổi điểm"
        >
          <BookOpen className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden md:inline">Thể lệ</span>
        </button>

        <button
          type="button"
          onClick={handleRefreshClick}
          className="hidden sm:flex p-2 min-w-[38px] min-h-[38px] items-center justify-center rounded-xl text-slate-500 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Làm mới giao diện"
          aria-label="Làm mới giao diện"
        >
          <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-500 hover:text-amber-500 dark:text-slate-300 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title={isDarkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
          aria-label="Chuyển đổi giao diện Sáng / Tối"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {isAdminViewer && (
          <div className="relative" ref={bellWrapperRef}>
            <button
              type="button"
              onClick={() => {
                setIsAccountMenuOpen(false);
                setIsBellOpen((v) => !v);
              }}
              aria-label="Thông báo phê duyệt đăng ký mới"
              title={
                pendingApprovals.length > 0
                  ? `${pendingApprovals.length} đăng ký mới đang chờ phê duyệt`
                  : 'Thông báo phê duyệt đăng ký'
              }
              className={`relative p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border transition cursor-pointer ${
                pendingApprovals.length > 0
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100'
                  : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Bell className={`w-4 h-4 ${pendingApprovals.length > 0 ? 'animate-pulse' : ''}`} />
              {pendingApprovals.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-slate-900 tabular-nums">
                  {pendingApprovals.length > 99 ? '99+' : pendingApprovals.length}
                </span>
              )}
            </button>

            {isBellOpen && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 w-[min(92vw,340px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 z-50 space-y-2.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Đăng ký chờ duyệt ({pendingApprovals.length})</span>
                  </div>
                  {onNavigateAdminRoles && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsBellOpen(false);
                        onNavigateAdminRoles();
                      }}
                      className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Mở trang duyệt →
                    </button>
                  )}
                </div>

                {pendingApprovals.length === 0 ? (
                  <div className="py-5 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Không có yêu cầu chờ duyệt
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Hệ thống sẽ báo ngay khi có thành viên mới đăng ký.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {pendingApprovals.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setIsBellOpen(false);
                          onNavigateAdminRoles?.();
                        }}
                        className="w-full text-left p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/50 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {u.fullName}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 shrink-0">
                            {u.companyCode} · KV {u.areaCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {u.email}
                          {u.unitCode ? ` · ${u.unitCode}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentUser ? (
          <div className="relative pl-1 sm:pl-1.5 border-l border-slate-200 dark:border-slate-700" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsBellOpen(false);
                setIsAccountMenuOpen((v) => !v);
              }}
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
              aria-label="Mở menu tài khoản"
              title={`${currentUser.fullName || 'Tài khoản'} (${currentUser.companyCode || ''} · KV ${currentUser.areaCode || ''})`}
              className={`flex items-center gap-1.5 sm:gap-2 pl-1.5 pr-2 py-1 min-h-[38px] rounded-xl border transition cursor-pointer max-w-[140px] sm:max-w-[240px] ${
                isAccountMenuOpen
                  ? 'bg-blue-50 dark:bg-slate-800 border-blue-300 dark:border-blue-600 shadow-xs'
                  : 'bg-slate-100/90 dark:bg-slate-800/90 hover:bg-blue-50 dark:hover:bg-slate-700 border-slate-200/80 dark:border-slate-700'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-[11px] flex items-center justify-center shrink-0 overflow-hidden">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (currentUser.fullName || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 text-left hidden sm:block">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                  {currentUser.fullName || 'Tài khoản'}
                </div>
                <div className="text-[10px] font-bold text-blue-700 dark:text-amber-300 truncate leading-tight">
                  {currentUser.companyCode} · KV {currentUser.areaCode} · {roleMeta?.codeBadge || 'TĐ'}
                </div>
              </div>
              <span className="sm:hidden text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                {(currentUser.fullName || 'Menu').trim().split(/\s+/).slice(-1)[0]}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-150 ${
                  isAccountMenuOpen ? 'rotate-180 text-blue-600 dark:text-amber-300' : ''
                }`}
              />
            </button>

            {isAccountMenuOpen && (
              <div
                role="menu"
                className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 w-[min(92vw,272px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-1"
              >
                {/* Account Summary Card */}
                <div className="px-3 py-2.5 mb-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {currentUser.fullName || 'Thành viên'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.email}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {roleMeta && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${roleMeta.badgeClass}`}
                      >
                        {roleMeta.label}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {currentUser.companyCode} · KV {currentUser.areaCode}
                      {currentUser.unitCode ? ` · ${currentUser.unitCode}` : ''}
                    </span>
                  </div>
                </div>

                {/* Menu Actions */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onNavigateProfile();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer text-left"
                  >
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Hồ sơ cá nhân</span>
                  </button>

                  {canAccessAdmin && onNavigateAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onNavigateAdmin();
                      }}
                      className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="truncate">
                          {isAdminViewer ? 'Quản trị Hệ thống' : 'Quản trị Đơn vị'}
                        </span>
                      </span>
                      {isAdminViewer && pendingApprovals.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none tabular-nums shrink-0">
                          {pendingApprovals.length}
                        </span>
                      )}
                    </button>
                  )}

                  {onLockPin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onLockPin();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer text-left"
                    >
                      <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Khóa màn hình (Mã PIN)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      handleRefreshClick();
                    }}
                    className="sm:hidden w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left"
                  >
                    <RefreshCw className={`w-4 h-4 text-slate-500 shrink-0 ${isSpinning ? 'animate-spin text-blue-600' : ''}`} />
                    <span>Làm mới giao diện</span>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
            title="Mở cửa sổ đăng nhập"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đăng nhập</span>
          </button>
        )}
      </div>
    </header>
  );
};

interface SideNavigationProps {
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  currentUser: UserAccount | null;
  pendingApprovalCount?: number;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

interface NavGroupItem {
  id: AppTab;
  label: string;
  subLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  visible: boolean;
  badgeCount?: number;
}

interface NavGroup {
  key: string;
  title: string;
  items: NavGroupItem[];
}

function getRoleSubtitle(user: UserAccount): string {
  switch (user.role) {
    case 'SUPER_ADMIN':
      return 'Tổng Quản trị · HT';
    case 'ADMIN':
      return 'Admin · HT';
    case 'MANAGER':
      return `QL Cụm · ${
        user.managedCompanyCodes?.length
          ? user.managedCompanyCodes.join(', ')
          : user.managedAreaCodes?.length
          ? `${user.managedAreaCodes.length} KV`
          : user.companyCode
      }`;
    case 'SION_LEADER':
      return `TS, NQ · Sion ${user.managedCompanyCodes?.join(', ') || user.companyCode}`;
    case 'AREA_LEADER': {
      const areaLabels = (user.managedAreaCodes || [])
        .map((a) => formatAreaScopeLabel(a))
        .filter(Boolean);
      return `Gru · KV ${areaLabels.length ? areaLabels.join(', ') : user.areaCode}`;
    }
    case 'UNI_LEADER':
      return `Uni · ${user.unitCode || user.departmentCode || `KV ${user.areaCode}`}`;
    default:
      return `TĐ · ${user.companyCode} · KV ${user.areaCode}`;
  }
}

/**
 * Menu dọc chia thành 5 Nhóm Chính:
 * 1. Turbo (Báo cáo hằng ngày, Bảng Xếp hạng thi đua, Trang thông tin MĐ)
 * 2. Công Việc (Hồ sơ cá nhân, Nhật Ký & Cổ Vũ, Lịch làm việc)
 * 3. Event (Trang Event)
 * 4. Edu (Giáo dục: LMS & CMS)
 * 5. Quản trị (Quản trị Tổng - tách riêng khỏi Event)
 */
export const SideNavigation: React.FC<SideNavigationProps> = ({
  isDesktopOpen,
  isMobileOpen,
  onCloseMobile,
  activeTab,
  setActiveTab,
  currentUser,
  pendingApprovalCount = 0,
  onOpenAuthModal,
  onLogout,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const canAccessAdmin = canAccessAdminPanel(currentUser?.role);

  const navGroups: NavGroup[] = [
    {
      key: 'turbo',
      title: 'Turbo',
      items: [
        {
          id: 'ENTRY',
          label: 'Báo cáo hằng ngày',
          subLabel: 'Ngày / Tháng / Năm',
          icon: ClipboardList,
          accent: 'text-emerald-400',
          visible: true,
        },
        {
          id: 'HONORS',
          label: 'Bảng Xếp hạng thi đua',
          subLabel: 'Vinh danh & Top 3',
          icon: Trophy,
          accent: 'text-amber-400',
          visible: true,
        },
        {
          id: 'DISCIPLES',
          label: 'Trang thông tin MĐ',
          subLabel: 'Sổ tay & Tiến độ MĐ',
          icon: Users,
          accent: 'text-teal-400',
          visible: true,
        },
        {
          id: 'REPORT_OVERVIEW',
          label: 'Tổng quan Báo cáo',
          subLabel: 'Kết quả 7 cấp & 7 chỉ số',
          icon: BarChart3,
          accent: 'text-sky-400',
          visible: true,
        },
      ],
    },
    {
      key: 'work',
      title: 'Công Việc',
      items: [
        {
          id: 'PROFILE',
          label: 'Hồ sơ cá nhân',
          subLabel: 'Bài viết & KH LLV',
          icon: User,
          accent: 'text-sky-400',
          visible: true,
        },
        {
          id: 'JOURNAL_CHEER',
          label: 'Nhật Ký & Cổ Vũ',
          subLabel: 'Cảm tạ 24h & cổ vũ',
          icon: Sparkles,
          accent: 'text-amber-400',
          visible: true,
        },
        {
          id: 'WORK_SCHEDULE',
          label: 'Lịch làm việc',
          subLabel: 'Lịch Làm Việc',
          icon: CalendarCheck2,
          accent: 'text-emerald-400',
          visible: true,
        },
      ],
    },
    {
      key: 'event',
      title: 'Event',
      items: [
        {
          id: 'EVENT_HUB',
          label: 'Trang Event',
          subLabel: 'Chiến dịch & Thể lệ',
          icon: CalendarDays,
          accent: 'text-amber-300',
          visible: true,
        },
      ],
    },
    {
      key: 'edu',
      title: 'Edu (Giáo dục)',
      items: [
        {
          id: 'EDU_LMS',
          label: 'LMS',
          subLabel: 'TĐ-I · TĐ-II · NGV',
          icon: GraduationCap,
          accent: 'text-emerald-400',
          visible: true,
        },
        {
          id: 'EDU_CMS',
          label: 'CMS',
          subLabel: 'TĐ Mới→TĐ-II · NGV · Giáo trình',
          icon: BookMarked,
          accent: 'text-amber-300',
          visible: true,
        },
      ],
    },
    {
      key: 'admin',
      title: 'Quản trị',
      items: [
        {
          id: 'ADMIN',
          label:
            currentUser?.role === 'SUPER_ADMIN'
              ? 'Quản trị Tổng'
              : isAdmin
              ? 'Quản trị Hệ thống'
              : 'Quản trị Đơn vị',
          subLabel: isAdmin
            ? 'Điểm, Banner, Nhân sự & Quyền'
            : 'Tổ chức, Nhân sự & Phân quyền',
          icon: Shield,
          accent: 'text-purple-400',
          visible: canAccessAdmin,
          badgeCount: isAdmin ? pendingApprovalCount : 0,
        },
      ],
    },
  ];

  const handleSelect = (tab: AppTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const renderMenuBody = (compactDesktop: boolean) => (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-950 via-[#0d1936] to-slate-950 text-white select-none">
      {/* Mobile Drawer Top Header */}
      <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-sm">
            H
          </div>
          <div>
            <div className="font-cinzel font-black text-sm text-white">Hành Thực Lục</div>
            <div className="text-[10px] text-amber-300/80">Menu điều hướng</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          aria-label="Đóng menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2.5">
        {navGroups.map((group, groupIdx) => {
          const visibleItems = group.items.filter((i) => i.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div
              key={group.key}
              className={groupIdx > 0 ? 'pt-2 border-t border-white/10' : ''}
            >
              {!compactDesktop && (
                <div className="px-3 pb-1 text-[10px] font-bold tracking-wide text-amber-300/90 uppercase">
                  {group.title}
                </div>
              )}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isAdminItem = item.id === 'ADMIN';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      title={compactDesktop ? `${group.title}: ${item.label}` : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 min-h-[40px] rounded-xl transition-all duration-150 cursor-pointer text-left ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/50 ring-1 ring-white/20'
                          : isAdminItem
                          ? 'bg-purple-500/15 border border-purple-400/30 text-purple-100 hover:bg-purple-500/25 hover:text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      } ${compactDesktop ? 'justify-center px-2' : ''}`}
                    >
                      <div
                        className={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-white/15'
                            : isAdminItem
                            ? 'bg-purple-500/20'
                            : 'bg-white/5'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.accent}`} />
                        {compactDesktop && !!item.badgeCount && item.badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-slate-950">
                            {item.badgeCount}
                          </span>
                        )}
                      </div>

                      {!compactDesktop && (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold truncate">{item.label}</span>
                              {!!item.badgeCount && item.badgeCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none shrink-0 tabular-nums">
                                  {item.badgeCount}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-300/75 truncate">
                              {item.subLabel}
                            </div>
                          </div>
                          {isActive && <ChevronRight className="w-4 h-4 text-white/80 shrink-0" />}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom User Card (inside Sidebar) */}
      <div className="p-2.5 border-t border-white/10 bg-black/20">
        {currentUser ? (
          <div className="space-y-2.5">
            {!compactDesktop ? (
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 overflow-hidden">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (currentUser.fullName || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-white truncate">
                    {currentUser.fullName || 'Thành viên'}
                  </div>
                  <div className="text-[10px] text-amber-300/90 truncate">
                    {getRoleSubtitle(currentUser)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center" title={currentUser.fullName || 'Thành viên'}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-indigo-600 flex items-center justify-center text-white font-black text-xs overflow-hidden">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (currentUser.fullName || 'U').charAt(0).toUpperCase()
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onLogout();
                onCloseMobile();
              }}
              title="Đăng xuất"
              className={`w-full py-2 px-3 min-h-[40px] rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-400/20 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                compactDesktop ? 'px-2' : ''
              }`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!compactDesktop && <span>Đăng xuất</span>}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onOpenAuthModal();
              onCloseMobile();
            }}
            className={`w-full py-2.5 px-3 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              compactDesktop ? 'px-2' : ''
            }`}
          >
            <LogIn className="w-4 h-4 shrink-0" />
            {!compactDesktop && <span>Đăng nhập / Đăng ký</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Vertical Sidebar Column */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-16 h-[calc(100vh-4rem)] border-r border-slate-800/70 transition-all duration-200 z-30 ${
          isDesktopOpen ? 'w-64' : 'w-[74px]'
        }`}
      >
        {renderMenuBody(!isDesktopOpen)}
      </aside>

      {/* Mobile Slide-Over Side Drawer */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs animate-in fade-in"
          />
          <aside className="relative w-72 max-w-[82vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderMenuBody(false)}
          </aside>
        </div>
      )}
    </>
  );
};

interface MobileBottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenMobileDrawer: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMobileDrawer,
}) => {
  const handleCenterAction = () => {
    if (activeTab !== 'ENTRY') {
      onSelectTab('ENTRY');
    } else if (typeof document !== 'undefined') {
      document.getElementById('entry-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      aria-label="Điều hướng nhanh di động"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_20px_-6px_rgba(15,23,42,0.12)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto px-1 relative">
        <button
          type="button"
          onClick={() => onSelectTab('WORK_SCHEDULE')}
          aria-label="Lịch làm việc"
          title="Lịch làm việc"
          className={`flex flex-col items-center justify-center gap-0.5 py-1 cursor-pointer transition-colors ${
            activeTab === 'WORK_SCHEDULE'
              ? 'text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CalendarCheck2 className="w-5 h-5" />
          <span className="text-[10px] leading-tight">Lịch LV</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('HONORS')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 cursor-pointer transition-colors ${
            activeTab === 'HONORS'
              ? 'text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] leading-tight">Xếp hạng</span>
        </button>

        {/* Center primary circular action button (Image 2 style) */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleCenterAction}
            aria-label="Nhập báo cáo hằng ngày"
            className="-mt-5 w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/35 ring-4 ring-white dark:ring-slate-900 flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <ClipboardList className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('EDU_LMS')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 cursor-pointer transition-colors ${
            activeTab === 'EDU_LMS' || activeTab === 'EDU_CMS'
              ? 'text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-[10px] leading-tight">Giáo dục</span>
        </button>

        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="flex flex-col items-center justify-center gap-0.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] leading-tight">Toàn thể</span>
        </button>
      </div>
    </nav>
  );
};
