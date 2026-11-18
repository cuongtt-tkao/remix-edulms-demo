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
  GraduationCap,
  BookMarked,
} from 'lucide-react';
import { UserAccount } from '../types/edulms';

export type AppTab =
  | 'ENTRY'
  | 'HONORS'
  | 'DISCIPLES'
  | 'PROFILE'
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
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateHome: () => void;
}

/**
 * Header tối giản, hài hòa:
 * Chỉ hiển thị các nút thao tác giao diện KHÔNG phụ thuộc vào dữ liệu Database.
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onOpenRulesModal,
  onRefreshUI,
  onOpenAuthModal,
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

      {/* Right: Non-DB-dependent UI utility buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenRulesModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-700/60 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          title="Xem thể lệ & quy đổi điểm"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">Thể lệ</span>
        </button>

        <button
          type="button"
          onClick={handleRefreshClick}
          className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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

        <button
          type="button"
          onClick={onOpenAuthModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
          title="Mở cửa sổ đăng nhập / chuyển tài khoản"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tài khoản</span>
        </button>
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
      return 'Quản trị Tổng';
    case 'ADMIN':
      return 'Ban Quản trị';
    case 'MANAGER':
      return `Nhà quản lý • ${
        user.managedAreaCodes?.length
          ? `${user.managedAreaCodes.length} KV`
          : user.managedCompanyCodes?.join(', ') || user.companyCode
      }`;
    case 'AREA_LEADER':
      return `Khu vực trưởng • KV ${user.areaCode}`;
    default:
      return `${user.companyCode} • KV ${user.areaCode}`;
  }
}

/**
 * Menu dọc chia thành 4 Mục Chính:
 * 1. Turbo (Báo cáo hằng ngày, Bảng Xếp hạng thi đua, Trang thông tin MĐ)
 * 2. Công Việc (Hồ sơ cá nhân & Hương khí)
 * 3. Event (Chiến dịch & Thể lệ, Quản trị Hệ thống)
 * 4. Edu (Giáo dục: LMS & CMS)
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
      ],
    },
    {
      key: 'event',
      title: 'Event',
      items: [
        {
          id: 'EVENT_HUB',
          label: 'Chiến dịch & Thể lệ',
          subLabel: 'Sự kiện & Quy đổi điểm',
          icon: CalendarDays,
          accent: 'text-amber-300',
          visible: true,
        },
        {
          id: 'ADMIN',
          label: currentUser?.role === 'SUPER_ADMIN' ? 'Quản trị Tổng' : 'Quản trị Hệ thống',
          subLabel: 'Điểm, Giao diện & Phân quyền',
          icon: Shield,
          accent: 'text-purple-400',
          visible: isAdmin,
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
