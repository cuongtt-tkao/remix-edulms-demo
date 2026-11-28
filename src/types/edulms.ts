export interface KpiSummary {
  totalTeams: number;
  totalMembers: number;
  totalTargets: number;
  totalPoints: number;
  lastUpdated: string;
}

export interface Company {
  id: string;
  code: string; // Th1, Th2, Th3, HT, NC, QN,...
  name: string;
  description?: string;
  active: boolean;
}

export interface Area {
  id: string;
  code: string; // 1.1, 1.2, 2.1,...
  name: string;
  companyCode: string;
  active: boolean;
}

/**
 * Địa vực: cấp nằm giữa Sion và Khu vực (Sion -> Địa vực -> Khu vực -> Thành viên).
 * areaCodes là danh sách mã Khu vực (trong cùng Sion) thuộc địa vực này.
 * Rule Firestore không phụ thuộc vào regions; Gru vẫn được cấp phạm vi bằng managedAreaCodes.
 */
export interface Region {
  id: string;
  code: string;
  name: string;
  companyCode: string;
  areaCodes: string[];
  active: boolean;
}

export interface OrgCluster {
  id: string;
  code: string; // TH1, ELI, HBC, PER, YSAC
  name: string; // TH1, ÊLI, HBC, PER, YSAC
  companyCodes: string[]; // Danh sách mã Sion thuộc cụm
  isCatchAll?: boolean; // Cụm "Còn lại" (tự động bao gồm các Sion chưa thuộc cụm khác)
  description?: string;
  active?: boolean;
}

export interface SystemClustersConfig {
  id?: string;
  clusters: OrgCluster[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface SystemOrgSyncConfig {
  id?: string;
  orgInitialized?: boolean;
  deletedCompanyCodes: string[];
  deletedAreaKeys: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export type OrgDeleteAttachedMode = 'PENDING_REASSIGN' | 'DELETE_RECORDS';

export interface Department {
  id: string;
  code: string;
  name: string; // Tráng Niên, Phụ Nữ, Thanh Niên Nam, Thanh Niên Nữ
  active: boolean;
}

export interface TargetSteps {
  s1: boolean; // Kết bạn (5đ)
  s2: boolean; // Tương tác (2đ)
  s3: boolean; // Gặp (50đ)
  s4: boolean; // Thăm (100đ)
  s5: boolean; // Cơm (100đ)
  s6: boolean; // Gợi mở (500đ)
}

export interface StepDates {
  s1?: string; // YYYY-MM-DD
  s2?: string;
  s3?: string;
  s4?: string;
  s5?: string;
  s6?: string;
}

export type TargetScoreStatus =
  | 'NOT_STARTED'
  | 'ELIMINATED'
  | 'CANCELLED_LACK_STEPS'
  | 'PENALIZED_MISSING'
  | 'SEQUENTIAL_PROGRESS'
  | 'FULL_COMPLETED';

export interface TargetRecord {
  id: string;
  memberId: string;
  targetName: string;
  steps: TargetSteps;
  stepDates?: StepDates;
  score: number;
  status: TargetScoreStatus;
  explanation: string;
  recordedAt: string;
}

export interface StepMetric {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  points: number;
}

export interface MemberGoals {
  s1: number; // Kết bạn
  s2: number; // Tương tác
  s3: number; // Gặp
  s4: number; // Thăm
  s5: number; // Cơm
  s6: number; // Gợi mở
}

export interface MemberResults {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;
}

export interface Member {
  id: string;
  code: string;
  fullName: string;
  companyCode: string;
  areaCode: string;
  departmentCode: string;
  unitCode?: string; // Mã Đội / Uni
  active: boolean;
  score: number;
  rank?: number;
  rankDelta?: number;
  goals: MemberGoals;
  results: MemberResults;
  targets: TargetRecord[];
  createdAt: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  dailyResults?: DailyReportMetrics;
  dailyGoals?: DailyReportMetrics;
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'SION_LEADER'
  | 'AREA_LEADER'
  | 'UNI_LEADER'
  | 'MEMBER';

export interface RoleDisplayMeta {
  role: UserRole;
  codeBadge: string;
  label: string;
  shortLabel: string;
  scopeSummary: string;
  badgeClass: string;
  level: number;
}

export const ROLE_DISPLAY_META: Record<UserRole, RoleDisplayMeta> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    codeBadge: 'HT',
    label: 'Quản trị Tổng (HT)',
    shortLabel: 'Tổng Quản trị · HT',
    scopeSummary: 'Toàn quyền cấu hình hệ thống & xem toàn bộ dữ liệu HT',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
    level: 7,
  },
  ADMIN: {
    role: 'ADMIN',
    codeBadge: 'HT',
    label: 'Admin (HT)',
    shortLabel: 'Admin · HT',
    scopeSummary: 'Quản trị toàn bộ dữ liệu các Sion, Khu vực, Uni & MĐ',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700',
    level: 6,
  },
  MANAGER: {
    role: 'MANAGER',
    codeBadge: 'QL Cụm',
    label: 'Quản lý Cụm (QL Cụm)',
    shortLabel: 'QL Cụm',
    scopeSummary: 'Xem tổng hợp các Sion & Khu vực trong cụm phụ trách + BXH Top 15',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    level: 5,
  },
  SION_LEADER: {
    role: 'SION_LEADER',
    codeBadge: 'TS, NQ',
    label: 'TS, NQ',
    shortLabel: 'TS, NQ',
    scopeSummary: 'Quản lý tổ chức, nhân sự & xem dữ liệu Sion phụ trách + BXH Top 15',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700',
    level: 4,
  },
  AREA_LEADER: {
    role: 'AREA_LEADER',
    codeBadge: 'Gru',
    label: 'Quản lý Khu vực (Gru)',
    shortLabel: 'Gru',
    scopeSummary: 'Xem các Uni & thành viên trong khu vực quản lý + BXH Top 15',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
    level: 3,
  },
  UNI_LEADER: {
    role: 'UNI_LEADER',
    codeBadge: 'Uni',
    label: 'Trưởng Đội / Uni (Uni)',
    shortLabel: 'Uni',
    scopeSummary: 'Xem thành viên thuộc đội/nhóm Uni của mình + BXH Top 15',
    badgeClass: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700',
    level: 2,
  },
  MEMBER: {
    role: 'MEMBER',
    codeBadge: 'TĐ',
    label: 'Thành viên (TĐ)',
    shortLabel: 'TĐ',
    scopeSummary: 'Xem kết quả cá nhân của mình & BXH Top 15 chung',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    level: 1,
  },
};

export const ROLE_ORDER: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'SION_LEADER',
  'AREA_LEADER',
  'UNI_LEADER',
  'MEMBER',
];

export function getRoleLevel(role?: UserRole | null): number {
  if (!role) return 1;
  return ROLE_DISPLAY_META[role]?.level || 1;
}

/**
 * Cấp độ tối đa mà vai trò hiện tại được phép phân quyền cho người khác:
 * - Cấp 7 (SUPER_ADMIN): 7 trở xuống (toàn bộ)
 * - Cấp 6 (ADMIN): 5 trở xuống
 * - Cấp 5 (MANAGER): 4 trở xuống
 * - Cấp 4 (SION_LEADER - TS, NQ): 3 trở xuống
 * - Cấp 3 (AREA_LEADER - Gru): 2 trở xuống
 * - Cấp 2 (UNI_LEADER - Uni): 1 trở xuống
 * - Cấp 1 (MEMBER - TĐ): 0 (không được phân quyền)
 */
export function getMaxAssignableRoleLevel(actorRole?: UserRole | null): number {
  const lvl = getRoleLevel(actorRole);
  if (lvl >= 7) return 7;
  if (lvl >= 2) return lvl - 1;
  return 0;
}

export function canAccessAdminPanel(role?: UserRole | null): boolean {
  return getRoleLevel(role) >= 2;
}

export function canExportExcel(role?: UserRole | null): boolean {
  return getRoleLevel(role) >= 4;
}

export interface RoleAssignment {
  email: string;
  role: UserRole;
  grantedBy: string;
  grantedAt: string;
  note?: string;
  managedClusterIds?: string[];
  managedCompanyCodes?: string[];
  managedAreaCodes?: string[];
  managedUnitCodes?: string[];
  updatedAt?: string;
}

export interface SystemRolesConfig {
  superAdmins: string[];
  admins: string[];
  assignments?: RoleAssignment[];
  updatedAt?: string;
  updatedBy?: string;
}

export type ThemeMode = 'light' | 'dark';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SystemSecurityConfig {
  id?: string;
  requireRegistrationApproval: boolean;
  autoApprovePreAssigned: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_SECURITY_CONFIG: SystemSecurityConfig = {
  requireRegistrationApproval: true,
  autoApprovePreAssigned: true,
};

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  password?: string;
  fullName: string;
  role: UserRole;
  memberId?: string;
  companyCode: string;
  areaCode: string;
  departmentCode: string;
  unitCode?: string; // Đội / Uni cá nhân
  managedClusterIds?: string[];
  managedCompanyCodes?: string[];
  managedAreaCodes?: string[];
  managedUnitCodes?: string[];
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  emailVerified?: boolean;
  verificationCode?: string;
  pinHash?: string;
  pinUpdatedAt?: string;
  onboardingCompleted?: boolean;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  roleUpdatedAt?: string;
  createdAt: string;
}

export function resolveUserApprovalStatus(
  user?: Pick<UserAccount, 'approvalStatus'> | null
): ApprovalStatus {
  if (!user) return 'PENDING';
  if (user.approvalStatus === 'PENDING' || user.approvalStatus === 'REJECTED') {
    return user.approvalStatus;
  }
  return 'APPROVED';
}

export type ReactionType = 'heart' | 'pray' | 'praise' | 'fire' | 'blessing' | 'like';

export interface ReactionCounts {
  heart: number;
  pray: number;
  praise: number;
  fire: number;
  blessing: number;
  like: number;
}

export interface HuongKhiComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  companyCode?: string;
  areaCode?: string;
  content: string;
  createdAt: string;
}

export interface HuongKhiItem {
  id: string;
  authorId: string;
  authorUid?: string;
  authorName: string;
  authorAvatar?: string;
  companyCode: string;
  areaCode: string;
  departmentCode?: string;
  title: string;
  content: string;
  category: 'THAM_VIENG' | 'LAM_CHUNG' | 'BAP_TEM' | 'COM_YEU_THUONG' | 'CAU_NGUYEN' | 'GIUP_DO' | 'GRATITUDE';
  journalType?: 'GRATITUDE' | 'TURBO';
  date: string;
  createdAtIso?: string;
  expiresAtIso?: string;
  likesCount: number;
  reactions?: ReactionCounts;
  userReaction?: ReactionType; // chỉ dùng để hiển thị (tính từ userReactions của người đang đăng nhập)
  userReactions?: Record<string, ReactionType>; // uid -> cảm xúc đã chọn (lưu chung trên Firestore)
  comments?: HuongKhiComment[];
  imageUrl?: string;
  isFeatured?: boolean;
}

export interface TurboJournalItem {
  id: string;
  authorUid: string;
  authorMemberId?: string;
  authorName: string;
  authorAvatar?: string;
  companyCode: string;
  areaCode: string;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD hoặc dd/mm/yyyy hiển thị
  createdAtIso: string;
  updatedAtIso?: string;
}

export interface InAppNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: 'LIKE' | 'COMMENT' | 'RANK_UP' | 'BADGE' | 'SYSTEM';
  read: boolean;
  createdAt: string;
  linkTab?: 'HONORS' | 'ENTRY' | 'PROFILE';
}

export interface MilestoneBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  progressText?: string;
}

export interface CompanyRankItem {
  companyCode: string;
  companyName: string;
  activeMembersCount: number;
  totalScore: number;
  averageScore: number;
  rank: number;
  rankDelta: number;
}

export interface AreaRankItem {
  areaCode: string;
  areaName: string;
  companyCode: string;
  activeMembersCount: number;
  totalScore: number;
  averageScore: number;
  rank: number;
  rankDelta: number;
  color?: string;
}

export interface FestivalRule {
  ruleId: string;
  ruleName: string;
  category: string;
  points: number;
  description: string;
  isElimination?: boolean;
}

export interface DailyVerse {
  verse: string;
  reference: string;
  theme: string;
  reflection?: string;
}

export type DailyMetricKey = 'kn' | 'tham' | 'gm' | 'dt' | 'hh' | 'kt' | 'wsNew';

export interface DailyReportMetrics {
  kn: number;
  tham: number;
  gm: number;
  dt: number;
  hh: number;
  kt: number;
  wsNew: number;
}

export const EMPTY_DAILY_METRICS: DailyReportMetrics = {
  kn: 0,
  tham: 0,
  gm: 0,
  dt: 0,
  hh: 0,
  kt: 0,
  wsNew: 0,
};

export const DEFAULT_DAILY_GOALS: DailyReportMetrics = {
  kn: 0,
  tham: 0,
  gm: 0,
  dt: 0,
  hh: 0,
  kt: 0,
  wsNew: 0,
};

export const DEFAULT_EVENT_WEIGHTS: DailyReportMetrics = {
  kn: 5,
  tham: 50,
  gm: 200,
  dt: 20,
  hh: 15,
  kt: 10,
  wsNew: 300,
};

export interface DailyMetricDefinition {
  key: DailyMetricKey;
  label: string;
  colorClass: string;
  dotColor: string;
}

export const DAILY_METRIC_DEFINITIONS: DailyMetricDefinition[] = [
  { key: 'kn', label: 'KN', colorClass: 'text-sky-600 dark:text-sky-400', dotColor: 'bg-sky-500' },
  { key: 'tham', label: 'Thăm', colorClass: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  { key: 'gm', label: 'GM', colorClass: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
  { key: 'dt', label: 'ĐT', colorClass: 'text-indigo-600 dark:text-indigo-400', dotColor: 'bg-indigo-500' },
  { key: 'hh', label: 'HH', colorClass: 'text-rose-600 dark:text-rose-400', dotColor: 'bg-rose-500' },
  { key: 'kt', label: 'KT', colorClass: 'text-purple-600 dark:text-purple-400', dotColor: 'bg-purple-500' },
  { key: 'wsNew', label: 'WS New', colorClass: 'text-teal-600 dark:text-teal-400', dotColor: 'bg-teal-500' },
];

export interface DailyReportRecord {
  id: string; // `${uid}_${date}`
  uid: string;
  memberId: string;
  companyCode?: string;
  areaCode?: string;
  unitCode?: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  year: string; // YYYY
  goals: DailyReportMetrics;
  results: DailyReportMetrics;
  updatedAt: string;
}

export interface PeriodGoalRecord {
  id: string; // `${uid}_${periodType}_${periodKey}`
  uid: string;
  periodType: 'MONTH' | 'YEAR';
  periodKey: string; // YYYY-MM or YYYY
  goals: DailyReportMetrics;
  updatedAt: string;
}

export interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface BannerVisibilityConfig {
  showHighlight: boolean;
  showDescription: boolean;
  showActionStrip: boolean;
  showRightCard: boolean;
  showSlideControls: boolean;
}

export const DEFAULT_BANNER_VISIBILITY: BannerVisibilityConfig = {
  showHighlight: true,
  showDescription: false,
  showActionStrip: true,
  showRightCard: true,
  showSlideControls: true,
};

export interface SystemBannerConfig {
  id?: string;
  mainTitle: string;
  highlightTitle: string;
  description: string;
  tagline: string;
  actionStripLabel?: string;
  visibility?: BannerVisibilityConfig;
  slides: BannerSlide[];
  autoSlideSeconds?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export function formatCompanyDisplayName(name?: string | null, fallbackCode?: string): string {
  const raw = (name || '').trim();
  if (!raw) return fallbackCode || '';
  const cleaned = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return cleaned || raw;
}

export interface FestivalEvent {
  id: string;
  title: string;
  description: string;
  rulesText: string;
  bannerUrl?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isActive: boolean;
  isPinned: boolean;
  restrictParticipants: boolean;
  participantIds: string[]; // Danh sách memberId được duyệt tham gia sự kiện
  weights: DailyReportMetrics; // Điểm quy đổi cho từng chỉ số trong Event
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type DiscipleProgressStep =
  | 'KN'
  | 'Thăm'
  | 'Ăn Cơm'
  | 'GM'
  | 'ĐT'
  | 'HH'
  | 'KT'
  | 'WS'
  | 'Dừng';

export const DISCIPLE_PROGRESS_STEPS: Array<{
  key: DiscipleProgressStep;
  label: string;
  isStop?: boolean;
}> = [
  { key: 'KN', label: 'KN' },
  { key: 'Thăm', label: 'Thăm' },
  { key: 'Ăn Cơm', label: 'Ăn Cơm' },
  { key: 'GM', label: 'GM' },
  { key: 'ĐT', label: 'ĐT' },
  { key: 'HH', label: 'HH' },
  { key: 'KT', label: 'KT' },
  { key: 'WS', label: 'WS' },
  { key: 'Dừng', label: 'Dừng', isStop: true },
];

export type DiscipleAgeMode = 'RANGE' | 'EXACT';
export type DiscipleAgeRange = '<18' | '18-22' | '23-30' | '31-45' | '>45';
export const DISCIPLE_AGE_RANGES: DiscipleAgeRange[] = ['<18', '18-22', '23-30', '31-45', '>45'];

export function mapAgeToRange(age: number): DiscipleAgeRange {
  if (age < 18) return '<18';
  if (age <= 22) return '18-22';
  if (age <= 30) return '23-30';
  if (age <= 45) return '31-45';
  return '>45';
}

export interface DiscipleRecord {
  id: string;
  ownerUid: string;
  ownerMemberId: string;
  ownerName: string;
  companyCode: string;
  areaCode: string;
  ownerUnitCode?: string;
  nickname: string;
  ageMode: DiscipleAgeMode;
  ageRange: DiscipleAgeRange;
  exactAge?: number | null;
  job: string;
  traits: string;
  progress: DiscipleProgressStep[];
  isStopped: boolean;
  statusNote: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export const STEP_DEFINITIONS: StepMetric[] = [
  { id: 1, name: 'Kết bạn', points: 5 },
  { id: 2, name: 'Tương tác', points: 2 },
  { id: 3, name: 'Gặp', points: 50 },
  { id: 4, name: 'Thăm', points: 100 },
  { id: 5, name: 'Cơm', points: 100 },
  { id: 6, name: 'Gợi mở', points: 500 },
];

// ---------- Cấu hình Điểm mặc định hệ thống (system_config/scoring) ----------
export interface SystemScoringConfig {
  id?: string;
  weights: DailyReportMetrics;
  updatedAt?: string;
  updatedBy?: string;
}

// ---------- Cấu hình Font & Bố cục Widget toàn trang (system_config/appearance) ----------
export type AppFontKey =
  | 'BE_VIETNAM_PRO'
  | 'PLUS_JAKARTA_SANS'
  | 'NUNITO'
  | 'INTER'
  | 'MERRIWEATHER'
  | 'PLAYFAIR_DISPLAY';

export type AppFontScale = 'SM' | 'MD' | 'LG';

export interface AppFontOption {
  key: AppFontKey;
  label: string;
  styleTag: string;
  cssFamily: string;
  description: string;
}

export const APP_FONT_OPTIONS: AppFontOption[] = [
  {
    key: 'BE_VIETNAM_PRO',
    label: 'Be Vietnam Pro',
    styleTag: 'Mặc định · Cân đối',
    cssFamily: "'Be Vietnam Pro', 'Plus Jakarta Sans', system-ui, sans-serif",
    description: 'Tối ưu hiển thị dấu tiếng Việt rõ nét trên cả desktop và mobile.',
  },
  {
    key: 'PLUS_JAKARTA_SANS',
    label: 'Plus Jakarta Sans',
    styleTag: 'Hiện đại · SaaS',
    cssFamily: "'Plus Jakarta Sans', 'Be Vietnam Pro', system-ui, sans-serif",
    description: 'Kiểu chữ hiện đại, thanh thoát, phù hợp bảng biểu và dashboard.',
  },
  {
    key: 'NUNITO',
    label: 'Nunito',
    styleTag: 'Thân thiện · Mềm mại',
    cssFamily: "'Nunito', 'Be Vietnam Pro', system-ui, sans-serif",
    description: 'Nét chữ bo tròn thân thiện, dễ đọc cho trang giáo dục và cộng đồng.',
  },
  {
    key: 'INTER',
    label: 'Inter',
    styleTag: 'Sắc nét · Số liệu',
    cssFamily: "'Inter', 'Be Vietnam Pro', system-ui, sans-serif",
    description: 'Tương phản cao cho bảng xếp hạng, con số và báo cáo dày đặc.',
  },
  {
    key: 'MERRIWEATHER',
    label: 'Merriweather',
    styleTag: 'Serif · Giáo trình',
    cssFamily: "'Merriweather', 'Be Vietnam Pro', Georgia, serif",
    description: 'Phong cách chữ có chân trang trọng, phù hợp đọc bài học và lời chứng.',
  },
  {
    key: 'PLAYFAIR_DISPLAY',
    label: 'Playfair Display',
    styleTag: 'Cổ điển · Tôn vinh',
    cssFamily: "'Playfair Display', 'Be Vietnam Pro', Georgia, serif",
    description: 'Tôn vinh tiêu đề trang trọng, phù hợp các đợt lễ hội và sự kiện lớn.',
  },
];

export type HonorsWidgetId =
  | 'BANNER'
  | 'KPI'
  | 'EVENTS_STRIP'
  | 'LEADERBOARD'
  | 'PODIUM'
  | 'REGIONAL'
  | 'QUICK_ACTIONS';

export interface HonorsWidgetMeta {
  id: HonorsWidgetId;
  label: string;
  zone: 'FULL' | 'MAIN' | 'SIDE';
  description: string;
}

export const HONORS_WIDGET_DEFINITIONS: HonorsWidgetMeta[] = [
  {
    id: 'BANNER',
    label: 'Banner Chiến dịch',
    zone: 'FULL',
    description: 'Ảnh bìa đầu trang và tiêu đề chiến dịch thi đua.',
  },
  {
    id: 'KPI',
    label: 'Thẻ Chỉ số Tổng quan (KPI)',
    zone: 'FULL',
    description: 'Tổng số đơn vị, thành viên, lượt báo cáo và tổng điểm.',
  },
  {
    id: 'EVENTS_STRIP',
    label: 'Danh sách Sự kiện Thi đua',
    zone: 'FULL',
    description: 'Các chiến dịch Event đang diễn ra & thời hạn áp dụng.',
  },
  {
    id: 'LEADERBOARD',
    label: 'Bảng Xếp hạng Cá nhân',
    zone: 'MAIN',
    description: 'Bảng điểm số, xếp hạng và thống kê 7 chỉ số.',
  },
  {
    id: 'PODIUM',
    label: 'Bục Vinh danh Top 3',
    zone: 'SIDE',
    description: 'Top 3 cá nhân, khu vực và công ty dẫn đầu.',
  },
  {
    id: 'REGIONAL',
    label: 'Xếp hạng theo Khu vực',
    zone: 'SIDE',
    description: 'Điểm trung bình và thứ hạng giữa các khu vực.',
  },
  {
    id: 'QUICK_ACTIONS',
    label: 'Khối Thao tác nhanh',
    zone: 'SIDE',
    description: 'Lối tắt Báo cáo hằng ngày & Hồ sơ cá nhân.',
  },
];

export const DEFAULT_HONORS_WIDGET_ORDER: HonorsWidgetId[] = [
  'BANNER',
  'KPI',
  'EVENTS_STRIP',
  'LEADERBOARD',
  'PODIUM',
  'REGIONAL',
  'QUICK_ACTIONS',
];

export interface HomeWidgetVisibilityConfig {
  showHeaderBanner: boolean;
  showQuickShortcuts: boolean;
  showCheerTicker: boolean;
  showProgressShowcase: boolean;
  showFeatureCards: boolean;
  cheerDisplayCount?: number;
  cheerRotateSeconds?: number;
  cheerHideAuthor?: boolean;
}

export const DEFAULT_HOME_WIDGET_VISIBILITY: HomeWidgetVisibilityConfig = {
  showHeaderBanner: true,
  showQuickShortcuts: true,
  showCheerTicker: true,
  showProgressShowcase: true,
  showFeatureCards: true,
  cheerDisplayCount: 5,
  cheerRotateSeconds: 10,
  cheerHideAuthor: false,
};

export interface LlvWidgetVisibilityConfig {
  showWsSection: boolean;
}

export const DEFAULT_LLV_WIDGET_VISIBILITY: LlvWidgetVisibilityConfig = {
  showWsSection: true,
};

export type AppLogoPreset = 'BOOK_CLASSIC' | 'BOOK_MODERN' | 'CUSTOM';

export interface AppLogoConfig {
  preset: AppLogoPreset;
  customUrl?: string;
}

export const DEFAULT_APP_LOGO_CONFIG: AppLogoConfig = {
  preset: 'BOOK_CLASSIC',
  customUrl: '',
};

export interface SystemAppearanceConfig {
  id?: string;
  fontKey: AppFontKey;
  fontScale: AppFontScale;
  widgetOrder: HonorsWidgetId[];
  hiddenWidgets: HonorsWidgetId[];
  homeWidgets?: HomeWidgetVisibilityConfig;
  llvWidgets?: LlvWidgetVisibilityConfig;
  logo?: AppLogoConfig;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_APPEARANCE_CONFIG: SystemAppearanceConfig = {
  fontKey: 'BE_VIETNAM_PRO',
  fontScale: 'MD',
  widgetOrder: [...DEFAULT_HONORS_WIDGET_ORDER],
  hiddenWidgets: [],
  homeWidgets: { ...DEFAULT_HOME_WIDGET_VISIBILITY },
  llvWidgets: { ...DEFAULT_LLV_WIDGET_VISIBILITY },
  logo: { ...DEFAULT_APP_LOGO_CONFIG },
};

// ---------- Hệ thống Giáo dục: Edu (LMS & CMS) ----------
export type EduTrack = 'TD_MOI' | 'TD_I' | 'TD_II' | 'NGV';

export const EDU_TRACK_ORDER: EduTrack[] = ['TD_MOI', 'TD_I', 'TD_II', 'NGV'];

export const EDU_TRACK_LABELS: Record<EduTrack, string> = {
  TD_MOI: 'TĐM',
  TD_I: 'TĐ1',
  TD_II: 'TĐ2',
  NGV: 'NGV',
};

export const EDU_TRACK_FULL_LABELS: Record<EduTrack, string> = {
  TD_MOI: 'TĐ Mới (TĐM)',
  TD_I: 'TĐ-I (TĐ1)',
  TD_II: 'TĐ-II (TĐ2)',
  NGV: 'NGV',
};

export type EduCmsStage = 'TD_MOI' | 'TD_I' | 'TD_II' | 'NGV';

export const EDU_CMS_STAGE_LABELS: Record<EduCmsStage, string> = {
  TD_MOI: 'TĐ Mới',
  TD_I: 'TĐ-I',
  TD_II: 'TĐ-II',
  NGV: 'NGV',
};

export type EduAssignmentStatus = 'REGISTERED' | 'IN_PROGRESS' | 'COMPLETED';

export const EDU_ASSIGNMENT_STATUS_LABELS: Record<EduAssignmentStatus, string> = {
  REGISTERED: 'Đã gán',
  IN_PROGRESS: 'Đang học',
  COMPLETED: 'Hoàn thành',
};

export interface EduWeeklyTopic {
  id: string;
  weekNumber: number;
  year: number;
  weekLabel: string; // Ví dụ: "Tuần 12 / 2026"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  track: EduTrack;
  companyCode: string; // 'ALL' hoặc mã Cty
  areaCode: string; // 'ALL' hoặc mã KV
  topicTitle: string; // Tên Chủ đề
  summary: string;
  learningObjectives?: string;
  curriculumContent: string; // Giáo trình / Nội dung bài học soạn từ CMS
  referenceLinks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EduTopicAssignment {
  id: string;
  topicId: string;
  track: EduTrack;
  weekLabel: string;
  topicTitle: string;
  companyCode: string; // Tên/Mã Cty
  areaCode: string; // Tên KV
  memberId?: string;
  cmsProfileId?: string; // Liên kết tới hồ sơ CMS nếu được nạp từ CMS
  studentName: string; // Tên TĐ
  assignedByUid: string;
  assignedByName: string;
  status: EduAssignmentStatus;
  participated?: boolean; // Dấu tích Tham gia
  completed?: boolean; // Dấu tích Hoàn thành
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface EduCmsProfile {
  id: string;
  fullName: string; // Tên TĐ hoặc NGV
  companyCode: string;
  areaCode: string;
  stage: EduCmsStage; // 'TD_MOI' | 'TD_I' | 'TD_II' | 'NGV'
  ngvName: string; // NGV phụ trách
  specialty?: string; // Chuyên môn / Lĩnh vực (dành cho NGV)
  currentTopicId?: string;
  currentTopicTitle?: string;
  note: string;
  ownerUid: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Lịch làm việc tuần (CN -> T7: 3 buổi tách riêng WS) ----------
export type WeekDayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export const WORK_WEEK_DAYS: Array<{
  key: WeekDayKey;
  shortLabel: string;
  fullLabel: string;
}> = [
  { key: 'sun', shortLabel: 'CN', fullLabel: 'Chủ Nhật' },
  { key: 'mon', shortLabel: 'T2', fullLabel: 'Thứ Hai' },
  { key: 'tue', shortLabel: 'T3', fullLabel: 'Thứ Ba' },
  { key: 'wed', shortLabel: 'T4', fullLabel: 'Thứ Tư' },
  { key: 'thu', shortLabel: 'T5', fullLabel: 'Thứ Năm' },
  { key: 'fri', shortLabel: 'T6', fullLabel: 'Thứ Sáu' },
  { key: 'sat', shortLabel: 'T7', fullLabel: 'Thứ Bảy' },
];

export const DEFAULT_WS_ACTIVE_DAYS: WeekDayKey[] = ['tue', 'sat'];

export interface DayThreeSessions {
  morning: string;
  afternoon: string;
  evening: string;
}

export interface WorkScheduleRecord {
  id: string; // `${uid}_${weekStart}`
  ownerUid: string;
  ownerMemberId?: string;
  ownerName: string;
  companyCode: string;
  areaCode: string;
  ownerUnitCode?: string;
  weekStart: string; // YYYY-MM-DD (Chủ Nhật)
  weekEnd: string;   // YYYY-MM-DD (Thứ Bảy)
  sessions: Record<WeekDayKey, DayThreeSessions>;
  wsActiveDays: WeekDayKey[]; // Mặc định ['tue', 'sat']
  ws: Record<WeekDayKey, DayThreeSessions>;
  noteLegend?: string;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyDaySessions(): DayThreeSessions {
  return { morning: '', afternoon: '', evening: '' };
}

export function createEmptyWeekSessionsMap(): Record<WeekDayKey, DayThreeSessions> {
  return {
    sun: createEmptyDaySessions(),
    mon: createEmptyDaySessions(),
    tue: createEmptyDaySessions(),
    wed: createEmptyDaySessions(),
    thu: createEmptyDaySessions(),
    fri: createEmptyDaySessions(),
    sat: createEmptyDaySessions(),
  };
}

// ---------- Kế hoạch LLV cá nhân theo tuần (CN -> T7: Sáng, Chiều, Tối) ----------
export interface PersonalPlannerRecord {
  id: string; // `${ownerUid}_${weekStart}`
  ownerUid: string;
  ownerName: string;
  companyCode: string;
  areaCode: string;
  weekStart: string; // YYYY-MM-DD (Chủ Nhật)
  weekEnd: string;   // YYYY-MM-DD (Thứ Bảy)
  sessions: Record<WeekDayKey, DayThreeSessions>;
  reflectionNote?: string;
  createdAt: string;
  updatedAt: string;
}

