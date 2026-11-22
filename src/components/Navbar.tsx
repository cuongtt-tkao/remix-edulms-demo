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
} from 'lucide-react';
import { UserAccount, ROLE_DISPLAY_META } from '../types/edulms';

export type AppTab =
  | 'ENTRY'
  | 'HONORS'
  | 'DISCIPLES'
  | 'PROFILE'
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
  isDarkMode,
  onToggleDarkMode,
  onNavigateHome,
}) => {
  const [isSpinning, setIsSpinning] = React.useState(false);

  const handleRefreshClick = () => {
    setIsSpinning(true);
    onRefreshUI();
    setTimeout(() => setIsSpinning(false), 500);
  };

  const roleMeta = currentUser
    ? ROLE_DISPLAY_META[currentUser.role] || ROLE_DISPLAY_META.MEMBER
    : null;

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/90 dark:border-slate-800 sticky top-0 z-40 h-16 px-3 sm:px-5 flex items-center justify-between gap-2 backdrop-blur-md shadow-2xs transition-colors">
      {/* Left: Sidebar Toggle + Brand Name */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
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

      {/* Right: Utility buttons + Profile / Logout */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenRulesModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-700/60 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          title="Xem thể lệ & quy đổi điểm"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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

        {currentUser ? (
          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onNavigateProfile}
              title={`Hồ sơ cá nhân · ${currentUser.fullName} (Sion ${currentUser.companyCode} · KV ${currentUser.areaCode})`}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 min-h-[38px] rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer max-w-[170px] sm:max-w-[230px]"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-[11px] flex items-center justify-center shrink-0 overflow-hidden">
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
              <div className="min-w-0 text-left hidden sm:block">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] font-bold text-blue-700 dark:text-amber-300 truncate leading-tight">
                  {currentUser.companyCode} · KV {currentUser.areaCode} · {roleMeta?.codeBadge || 'TĐ'}
                </div>
              </div>
              <span className="sm:hidden text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                {currentUser.fullName.split(' ').slice(-1)[0]}
              </span>
            </button>

            {onLockPin && (
              <button
                type="button"
                onClick={onLockPin}
                title="Khóa màn hình bằng Mã cá nhân"
                aria-label="Khóa màn hình bằng Mã cá nhân"
                className="p-2 min-w-[36px] min-h-[38px] flex items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 transition cursor-pointer shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              title="Đăng xuất tài khoản"
              aria-label="Đăng xuất tài khoản"
              className="flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
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
      return `Ts, Nq · Sion ${user.managedCompanyCodes?.join(', ') || user.companyCode}`;
    case 'AREA_LEADER':
      return `Gru · KV ${user.managedAreaCodes?.join(', ') || user.areaCode}`;
    case 'UNI_LEADER':
      return `Uni · ${user.unitCode || user.departmentCode || `KV ${user.areaCode}`}`;
    default:
      return `TĐ · ${user.companyCode} · KV ${user.areaCode}`;
  }
}

/**
 * Menu dọc chia thành 5 Nhóm Chính:
 * 1. Turbo (Báo cáo hằng ngày, Bảng Xếp hạng thi đua, Trang thông tin MĐ)
 * 2. Công Việc (Hồ sơ cá nhân & Hương khí)
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
  onOpenAuthModal,
  onLogout,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

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
      ],
    },
    {
      key: 'work',
      title: 'Công Việc',
      items: [
        {
          id: 'PROFILE',
          label: 'Hồ sơ cá nhân',
          subLabel: 'Thông tin & Hương khí',
          icon: User,
          accent: 'text-sky-400',
          visible: true,
        },
        {
          id: 'WORK_SCHEDULE',
          label: 'Lịch làm việc',
          subLabel: 'Hoạt động buổi & WS',
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
          label: currentUser?.role === 'SUPER_ADMIN' ? 'Quản trị Tổng' : 'Quản trị Hệ thống',
          subLabel: 'Điểm, Banner, Nhân sự & Quyền',
          icon: Shield,
          accent: 'text-purple-400',
          visible: isAdmin,
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

      {/* Navigation Groups (3 Mục Chính: Turbo, Công Việc, Event) */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {navGroups.map((group, groupIdx) => {
          const visibleItems = group.items.filter((i) => i.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div
              key={group.key}
              className={groupIdx > 0 ? 'pt-3 border-t border-white/10' : ''}
            >
              {!compactDesktop && (
                <div className="px-3 pb-1.5 text-[11px] font-bold tracking-wide text-amber-300/90">
                  {group.title}
                </div>
              )}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      title={compactDesktop ? `${group.title}: ${item.label}` : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-2xl transition-all duration-150 cursor-pointer text-left ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/50 ring-1 ring-white/20'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      } ${compactDesktop ? 'justify-center px-2' : ''}`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-white/15' : 'bg-white/5'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.accent}`} />
                      </div>

                      {!compactDesktop && (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold truncate">{item.label}</div>
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
      <div className="p-3 border-t border-white/10 bg-black/20">
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
                    currentUser.fullName.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-white truncate">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-amber-300/90 truncate">
                    {getRoleSubtitle(currentUser)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center" title={currentUser.fullName}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-indigo-600 flex items-center justify-center text-white font-black text-xs overflow-hidden">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    currentUser.fullName.charAt(0)
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
