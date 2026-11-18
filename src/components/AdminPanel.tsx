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
} from 'lucide-react';
import {
  Company,
  Area,
  Department,
  Member,
  UserAccount,
  UserRole,
  RoleAssignment,
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
  DEFAULT_EVENT_WEIGHTS,
} from '../types/edulms';
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
import { RoleManagementTab } from './RoleManagementTab';
import { AdminBannerEventTab } from './AdminBannerEventTab';
import { AdminScoringAppearanceTab } from './AdminScoringAppearanceTab';
import { CustomSelect } from './CustomSelect';

export type AdminSectionId =
  | 'SCORING'
  | 'EVENTS'
  | 'BANNER'
  | 'APPEARANCE_FONT'
  | 'APPEARANCE_HOME'
  | 'APPEARANCE_HONORS'
  | 'COMPANIES'
  | 'AREAS'
  | 'DEPARTMENTS'
  | 'MEMBERS'
  | 'ROLES'
  | 'EXCEL_SYNC';

interface AdminPanelProps {
  initialTab?: AdminSectionId;
  companies: Company[];
  areas: Area[];
  departments: Department[];
  members: Member[];
  onAddCompany: (company: Omit<Company, 'id'>) => void;
  onUpdateCompany: (company: Company) => void;
  onDeleteCompany: (id: string) => void;
  onAddArea: (area: Omit<Area, 'id'>) => void;
  onUpdateArea: (area: Area) => void;
  onDeleteArea: (id: string) => void;
  onAddDepartment: (department: Omit<Department, 'id'>) => void;
  onUpdateDepartment: (department: Department) => void;
  onDeleteDepartment: (id: string) => void;
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
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
    }
  ) => Promise<void>;
  preAssignedRoles?: RoleAssignment[];
  onPreAssignRole?: (
    email: string,
    role: UserRole,
    note?: string,
    scope?: {
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
    }
  ) => Promise<void>;
  onDeletePreAssignedRole?: (email: string) => Promise<void>;
  bannerConfig?: SystemBannerConfig | null;
  events?: FestivalEvent[];
  onSaveBannerConfig?: (config: SystemBannerConfig) => Promise<void>;
  onSaveEvent?: (event: FestivalEvent) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  scoringConfig?: SystemScoringConfig | null;
  appearanceConfig?: SystemAppearanceConfig | null;
  activeEvent?: FestivalEvent | null;
  onSaveScoringConfig?: (weights: DailyReportMetrics) => Promise<void>;
  onSaveAppearanceConfig?: (config: SystemAppearanceConfig) => Promise<void>;
  disciples?: DiscipleRecord[];
  dailyReports?: DailyReportRecord[];
  eduTopics?: EduWeeklyTopic[];
  eduAssignments?: EduTopicAssignment[];
  eduCmsProfiles?: EduCmsProfile[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  initialTab,
  companies,
  areas,
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
  preAssignedRoles,
  onPreAssignRole,
  onDeletePreAssignedRole,
  bannerConfig = null,
  events = [],
  onSaveBannerConfig,
  onSaveEvent,
  onDeleteEvent,
  scoringConfig = null,
  appearanceConfig = null,
  activeEvent = null,
  onSaveScoringConfig,
  onSaveAppearanceConfig,
  disciples = [],
  dailyReports = [],
  eduTopics = [],
  eduAssignments = [],
  eduCmsProfiles = [],
}) => {
  const [activeTab, setActiveTab] = useState<AdminSectionId>(initialTab || 'SCORING');

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    title: string;
    onConfirm: () => void;
  } | null>(null);

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

  // Bộ lọc cho Trung tâm Xuất Excel Admin
  const [mdExportCompany, setMdExportCompany] = useState<string>('ALL');
  const [mdExportStatus, setMdExportStatus] = useState<'ALL' | 'ACTIVE' | 'STOPPED'>('ALL');
  const [adminReportPeriod, setAdminReportPeriod] = useState<DailyReportExportPeriod>('MONTH');
  const [adminReportCompany, setAdminReportCompany] = useState<string>('ALL');
  const [adminReportArea, setAdminReportArea] = useState<string>('ALL');
  const [eduExportCompany, setEduExportCompany] = useState<string>('ALL');

  // Modals / Editing state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false);
  const [newAreaCode, setNewAreaCode] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaCompany, setNewAreaCompany] = useState(companies[0]?.code || 'Th1');

  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberCompany, setNewMemberCompany] = useState(companies[0]?.code || 'Th1');
  const [newMemberArea, setNewMemberArea] = useState('1.1');
  const [newMemberDept, setNewMemberDept] = useState(departments[0]?.code || 'Thanh Niên Nam');
  const [newMemberUnit, setNewMemberUnit] = useState('');

  // Handlers for Company
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyCode.trim() || !newCompanyName.trim()) {
      onShowNotification('Vui lòng điền đủ mã và tên công ty.');
      return;
    }
    onAddCompany({
      code: newCompanyCode.trim(),
      name: newCompanyName.trim(),
      active: true,
    });
    setNewCompanyCode('');
    setNewCompanyName('');
    setIsAddCompanyOpen(false);
    onShowNotification('Đã thêm công ty mới thành công!');
  };

  const handleUpdateCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    onUpdateCompany(editingCompany);
    setEditingCompany(null);
    onShowNotification('Đã cập nhật công ty thành công!');
  };

  // Handlers for Area
  const handleSaveArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaCode.trim() || !newAreaName.trim()) {
      onShowNotification('Vui lòng điền đủ mã và tên khu vực.');
      return;
    }
    onAddArea({
      code: newAreaCode.trim(),
      name: newAreaName.trim(),
      companyCode: newAreaCompany,
      active: true,
    });
    setNewAreaCode('');
    setNewAreaName('');
    setIsAddAreaOpen(false);
    onShowNotification('Đã thêm khu vực mới thành công!');
  };

  const handleUpdateAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;
    onUpdateArea(editingArea);
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
    onAddMember({
      fullName: newMemberName.trim(),
      companyCode: newMemberCompany,
      areaCode: newMemberArea,
      departmentCode: newMemberDept,
      unitCode: newMemberUnit.trim() || undefined,
      active: true,
      goals: { s1: 10, s2: 8, s3: 5, s4: 4, s5: 4, s6: 2 },
      results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
    });
    setNewMemberName('');
    setNewMemberUnit('');
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

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-3 py-1 rounded-lg mb-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Quản trị Hệ thống</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Bảng Điều Khiển Quản Trị
            </h2>
          </div>
        </div>

        {(() => {
          const adminNavGroups: {
            groupKey: string;
            groupTitle: string;
            shortTitle: string;
            groupIcon: React.ComponentType<{ className?: string }>;
            items: {
              id: AdminSectionId;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
              badge?: string;
            }[];
          }[] = [
            {
              groupKey: 'COMPETITION',
              groupTitle: '1. Thi đua & Event',
              shortTitle: 'Thi đua & Event',
              groupIcon: Trophy,
              items: [
                { id: 'SCORING', label: 'Bảng điểm mặc định', icon: Scale, badge: '7 mục' },
                { id: 'EVENTS', label: 'Quản lý Event', icon: Trophy, badge: `${events.length}` },
              ],
            },
            {
              groupKey: 'DISPLAY',
              groupTitle: '2. Giao diện & Hiển thị',
              shortTitle: 'Giao diện',
              groupIcon: LayoutGrid,
              items: [
                { id: 'BANNER', label: 'Banner Trang chủ', icon: ImageIcon },
                { id: 'APPEARANCE_FONT', label: 'Font & Cỡ chữ', icon: Type },
                { id: 'APPEARANCE_HOME', label: 'Bố cục Trang chủ', icon: Home },
                { id: 'APPEARANCE_HONORS', label: 'Bảng Vinh danh', icon: LayoutGrid },
              ],
            },
            {
              groupKey: 'ORG',
              groupTitle: '3. Tổ chức & Nhân sự',
              shortTitle: 'Tổ chức & NS',
              groupIcon: Building2,
              items: [
                { id: 'COMPANIES', label: 'Sion / Công ty', icon: Building2, badge: `${companies.length}` },
                { id: 'AREAS', label: 'Khu vực', icon: MapPin, badge: `${areas.length}` },
                { id: 'DEPARTMENTS', label: 'Ban ngành', icon: Users2, badge: `${departments.length}` },
                { id: 'MEMBERS', label: 'Thành viên', icon: User, badge: `${members.length}` },
              ],
            },
            {
              groupKey: 'SYSTEM',
              groupTitle: '4. Hệ thống & Dữ liệu',
              shortTitle: 'Hệ thống',
              groupIcon: Crown,
              items: [
                {
                  id: 'ROLES',
                  label: 'Phân quyền (7 cấp)',
                  icon: Crown,
                  badge: usersList ? `${usersList.length}` : undefined,
                },
                { id: 'EXCEL_SYNC', label: 'Nhập / Xuất Excel', icon: FileSpreadsheet },
              ],
            },
          ];

          const activeGroup =
            adminNavGroups.find((g) => g.items.some((it) => it.id === activeTab)) ||
            adminNavGroups[0];

          return (
            <>
              {/* Mobile / Tablet Menu 2 tầng hiển thị trực tiếp (Phương án A - Không ẩn dropdown) */}
              <div className="lg:hidden mt-4 space-y-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3">
                {/* Tầng 1: 4 Nhóm chính (2x2 mobile, 4 cột sm/md) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-left text-xs font-extrabold transition cursor-pointer border ${
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
                      </button>
                    );
                  })}
                </div>

                {/* Tầng 2: Các tính năng con của nhóm đang chọn */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 px-0.5">
                    {activeGroup.groupTitle}
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                    {activeGroup.items.map((item) => {
                      const Icon = item.icon;
                      const isItemActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
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
                                isItemActive
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
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-6 items-start">
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
                                    active
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
        {/* TAB 1: COMPANIES */}
        {activeTab === 'COMPANIES' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-800">Danh sách các Công ty (Th1, Th2, Th3, HT, NC, QN...)</h3>
              <button
                onClick={() => setIsAddCompanyOpen(true)}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Công ty</span>
              </button>
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
                  {companies.map((comp) => {
                    const compAreas = areas.filter((a) => a.companyCode === comp.code);
                    const compMembers = members.filter((m) => m.companyCode === comp.code);

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
                          <button
                            onClick={() => setEditingCompany(comp)}
                            className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDeleteTarget({
                                title: `Xóa công ty ${comp.name}?`,
                                onConfirm: () => {
                                  onDeleteCompany(comp.id);
                                  onShowNotification(`Đã xóa công ty ${comp.name}.`);
                                },
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa công ty"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                        value={editingCompany.code}
                        onChange={(e) => setEditingCompany({ ...editingCompany, code: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
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
        {activeTab === 'AREAS' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-800">Danh sách Khu vực (1.1, 1.2, 2.1, 2.2...)</h3>
              <button
                onClick={() => setIsAddAreaOpen(true)}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Khu vực</span>
              </button>
            </div>

            {/* Add Area Form */}
            {isAddAreaOpen && (
              <form onSubmit={handleSaveArea} className="mb-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-200 animate-in fade-in">
                <div className="font-bold text-xs text-blue-950 mb-3">Thêm Khu vực mới</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Thuộc Công ty</label>
                    <CustomSelect
                      size="sm"
                      value={newAreaCompany}
                      onChange={setNewAreaCompany}
                      options={companies.map((c) => ({
                        value: c.code,
                        label: c.name,
                        badge: c.code,
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã KV (ví dụ: 1.3, 2.3...)</label>
                    <input
                      type="text"
                      value={newAreaCode}
                      onChange={(e) => setNewAreaCode(e.target.value)}
                      placeholder="1.3"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên Khu vực</label>
                    <input
                      type="text"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="Khu vực 1.3"
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
                    <th className="py-3 px-4">Trực thuộc Cty</th>
                    <th className="py-3 px-4 text-center">Số thành viên</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {areas.map((area) => {
                    const areaMembers = members.filter((m) => m.areaCode === area.code);

                    return (
                      <tr key={area.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-black text-blue-700">{area.code}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{area.name}</td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{area.companyCode}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-600">{areaMembers.length} người</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full font-extrabold text-[10px] bg-emerald-100 text-emerald-800">
                            Hoạt động
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditingArea(area)}
                            className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDeleteTarget({
                                title: `Xóa khu vực ${area.name}?`,
                                onConfirm: () => {
                                  onDeleteArea(area.id);
                                  onShowNotification(`Đã xóa khu vực ${area.name}.`);
                                },
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa khu vực"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                        value={editingArea.companyCode}
                        onChange={(val) => setEditingArea({ ...editingArea, companyCode: val })}
                        options={companies.map((c) => ({
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
                        value={editingArea.code}
                        onChange={(e) => setEditingArea({ ...editingArea, code: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
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
              <button
                onClick={() => setIsAddDepartmentOpen(true)}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Ban ngành</span>
              </button>
            </div>

            {/* Add Department Form */}
            {isAddDepartmentOpen && (
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
                    const deptMembers = members.filter((m) => m.departmentCode === dept.code);

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
                          <button
                            onClick={() => setEditingDepartment(dept)}
                            className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDeleteTarget({
                                title: `Xóa ban ngành ${dept.name}?`,
                                onConfirm: () => {
                                  onDeleteDepartment(dept.id);
                                  onShowNotification(`Đã xóa ban ngành ${dept.name}.`);
                                },
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa ban ngành"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                      value={newMemberCompany}
                      onChange={setNewMemberCompany}
                      options={companies.map((c) => ({
                        value: c.code,
                        label: c.name,
                        badge: c.code,
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Khu vực *</label>
                    <input
                      type="text"
                      value={newMemberArea}
                      onChange={(e) => setNewMemberArea(e.target.value)}
                      placeholder="1.1, 1.2..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Đội / Uni</label>
                    <input
                      type="text"
                      value={newMemberUnit}
                      onChange={(e) => setNewMemberUnit(e.target.value)}
                      placeholder="Uni 1, Đội A..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
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
                  {members
                    .filter((m) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        m.fullName.toLowerCase().includes(q) ||
                        m.companyCode.toLowerCase().includes(q) ||
                        m.areaCode.toLowerCase().includes(q) ||
                        m.departmentCode.toLowerCase().includes(q)
                      );
                    })
                    .map((mem) => (
                      <tr key={mem.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{mem.fullName}</div>
                          <div className="text-[10px] text-slate-400">{mem.code}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{mem.companyCode}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{mem.areaCode}</td>
                        <td className="py-3 px-4 text-slate-600">{mem.departmentCode}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              onUpdateMember({ ...mem, active: !mem.active });
                              onShowNotification(
                                mem.active
                                  ? `Đã tạm dừng tính điểm cho ${mem.fullName}.`
                                  : `Đã kích hoạt hoạt động cho ${mem.fullName}.`
                              );
                            }}
                            className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1 transition ${
                              mem.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}
                            title="Bấm để bật/tắt tính điểm vào mẫu số trung bình"
                          >
                            <span>{mem.active ? 'Đang hoạt động' : 'Tạm dừng'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {mem.score.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-600">
                          {mem.targets?.length || 0}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditingMember(mem)}
                            className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition"
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
                        </td>
                      </tr>
                    ))}
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
                          value={editingMember.companyCode}
                          onChange={(val) => setEditingMember({ ...editingMember, companyCode: val })}
                          options={companies.map((c) => ({
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
                          value={editingMember.areaCode}
                          onChange={(e) => setEditingMember({ ...editingMember, areaCode: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Đội / Uni</label>
                        <input
                          type="text"
                          value={editingMember.unitCode || ''}
                          onChange={(e) => setEditingMember({ ...editingMember, unitCode: e.target.value })}
                          placeholder="Uni 1, Đội A..."
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
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

        {/* TAB: TRUNG TÂM NHẬP & XUẤT EXCEL */}
        {activeTab === 'EXCEL_SYNC' && (
          <div className="space-y-5 animate-in fade-in">
            {/* Intro Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-emerald-950 dark:text-white">
                    Trung Tâm Nhập &amp; Xuất Dữ Liệu Excel
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    Đồng bộ danh mục hệ thống, hồ sơ nhân sự mới, danh sách MĐ, báo cáo hằng ngày và dữ liệu Edu.
                  </p>
                </div>
              </div>

              <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl border border-emerald-200/60 dark:border-emerald-700/60 shrink-0">
                Hỗ trợ: <strong>.xlsx, .xls</strong>
              </div>
            </div>

            {/* Grid Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* BLOCK 1: CẤU HÌNH DANH MỤC HỆ THỐNG */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-4">
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
                    3 Sheets
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
                    onClick={() => exportSystemConfigExcel(companies, areas, departments)}
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

              {/* BLOCK 2: HỒ SƠ CÁ NHÂN & NHÂN SỰ THI ĐUA (CẤU TRÚC MỚI) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        2. Hồ Sơ Cá Nhân &amp; Thi Đua
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Cấu trúc mới: Đội/Uni, Vai trò 7 cấp &amp; 7 chỉ số
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md shrink-0">
                    2 Sheets
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Thành viên</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {members.length} người
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Tài khoản đối chiếu</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {usersList?.length || 0} TK
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Cấu trúc cập nhật mới:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
                    <li>
                      <strong>Hồ Sơ &amp; Thi Đua TV:</strong> Mã TV, Họ Tên, Username, Email, Vai trò, Phạm vi, Sion, KV, Ban, Đội/Uni, 7 chỉ số (KN..WS New) &amp; số MĐ.
                    </li>
                    <li>
                      <strong>Tổng Hợp Sion &amp; KV:</strong> Điểm TB, tổng 7 chỉ số và MĐ theo từng Khu vực.
                    </li>
                  </ul>
                </div>

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
                        disciples
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
              </div>

              {/* BLOCK 3: XUẤT DANH SÁCH MĐ */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        3. Danh Sách MĐ Toàn Hệ Thống
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

                {(() => {
                  const activeMdCount = disciples.filter(
                    (d) => !d.isStopped && !d.progress.includes('Dừng')
                  ).length;
                  const stoppedMdCount = disciples.length - activeMdCount;
                  return (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Tổng MĐ</div>
                        <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                          {disciples.length}
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
                  );
                })()}

                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={mdExportCompany}
                      onChange={setMdExportCompany}
                      options={[
                        { value: 'ALL', label: 'Tất cả Sion' },
                        ...companies.map((c) => ({ value: c.code, label: c.name })),
                      ]}
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
                      companyCode: mdExportCompany,
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

              {/* BLOCK 4: XUẤT BÁO CÁO HẰNG NGÀY TOÀN HỆ THỐNG */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        4. Báo Cáo Hằng Ngày Toàn Hệ Thống
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Tổng hợp TV, Khu vực &amp; Nhật ký theo từng ngày
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md shrink-0">
                    3 Sheets
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Tổng phiếu báo cáo</div>
                    <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {dailyReports.length}
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

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            }}
                            options={[
                              { value: 'ALL', label: 'Tất cả Sion' },
                              ...companies.map((c) => ({ value: c.code, label: c.name })),
                            ]}
                          />
                        </div>
                        <div className="min-w-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={adminReportArea}
                            onChange={setAdminReportArea}
                            options={[
                              { value: 'ALL', label: 'Tất cả KV' },
                              ...areas
                                .filter((a) => adminReportCompany === 'ALL' || a.companyCode === adminReportCompany)
                                .map((a) => ({ value: a.code, label: `KV ${a.code}` })),
                            ]}
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
                            weights,
                            period: adminReportPeriod,
                            periodDate: todayStr,
                            periodMonth: monthStr,
                            periodYear: yearStr,
                            filterCompanyCode: adminReportCompany,
                            filterAreaCode: adminReportArea,
                          });
                          onShowNotification(
                            `Đã xuất ${res.fileName} (${res.reportsCount} báo cáo).`
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
              <div className="xl:col-span-2 p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        5. Dữ Liệu Đào Tạo Edu (LMS &amp; CMS)
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

                <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-center">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Chủ đề LMS</div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {eduTopics.length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Phân công TĐ</div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {eduAssignments.length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Hồ sơ CMS/NGV</div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {eduCmsProfiles.length}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={eduExportCompany}
                      onChange={setEduExportCompany}
                      options={[
                        { value: 'ALL', label: 'Tất cả Sion' },
                        ...companies.map((c) => ({ value: c.code, label: c.name })),
                      ]}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const res = exportEduDataExcel(eduTopics, eduAssignments, eduCmsProfiles, {
                        companyCode: eduExportCompany,
                      });
                      onShowNotification(
                        `Đã xuất ${res.fileName} (${res.topicsCount} chủ đề, ${res.assignmentsCount} phân công, ${res.cmsCount} CMS).`
                      );
                    }}
                    className="py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Xuất Excel Edu</span>
                  </button>
                </div>
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
              onUpdateUserRole={onUpdateUserRole || (async () => {})}
              preAssignedRoles={preAssignedRoles}
              onPreAssignRole={onPreAssignRole}
              onDeletePreAssignedRole={onDeletePreAssignedRole}
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
                </div>
              </div>
            </>
          );
        })()}

        {/* IN-APP DELETE CONFIRMATION MODAL */}
        {confirmDeleteTarget && (
          <div
            onClick={() => setConfirmDeleteTarget(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                Xác nhận thao tác xóa
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {confirmDeleteTarget.title}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTarget(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDeleteTarget.onConfirm();
                    setConfirmDeleteTarget(null);
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
    </section>
  );
};
