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

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AREA_LEADER' | 'MEMBER';

export interface RoleAssignment {
  email: string;
  role: UserRole;
  grantedBy: string;
  grantedAt: string;
  note?: string;
  managedCompanyCodes?: string[];
  managedAreaCodes?: string[];
}

export interface SystemRolesConfig {
  superAdmins: string[];
  admins: string[];
  assignments?: RoleAssignment[];
  updatedAt?: string;
  updatedBy?: string;
}

export type ThemeMode = 'light' | 'dark';

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
  managedCompanyCodes?: string[];
  managedAreaCodes?: string[];
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  emailVerified?: boolean;
  verificationCode?: string;
  createdAt: string;
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
  authorName: string;
  authorAvatar?: string;
  companyCode: string;
  areaCode: string;
  departmentCode?: string;
  title: string;
  content: string;
  category: 'THAM_VIENG' | 'LAM_CHUNG' | 'BAP_TEM' | 'COM_YEU_THUONG' | 'CAU_NGUYEN' | 'GIUP_DO';
  date: string;
  likesCount: number;
  reactions?: ReactionCounts;
  userReaction?: ReactionType; // chỉ dùng để hiển thị (tính từ userReactions của người đang đăng nhập)
  userReactions?: Record<string, ReactionType>; // uid -> cảm xúc đã chọn (lưu chung trên Firestore)
  comments?: HuongKhiComment[];
  imageUrl?: string;
  isFeatured?: boolean;
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
  kn: 5,
  tham: 1,
  gm: 1,
  dt: 2,
  hh: 1,
  kt: 1,
  wsNew: 1,
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

export interface SystemBannerConfig {
  id?: string;
  mainTitle: string;
  highlightTitle: string;
  description: string;
  tagline: string;
  slides: BannerSlide[];
  autoSlideSeconds?: number;
  updatedAt?: string;
  updatedBy?: string;
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

