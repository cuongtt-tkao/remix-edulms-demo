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
  | 'QUICK_ACTIONS'
  | 'NEWS';

export interface HonorsWidgetMeta {
  id: HonorsWidgetId;
  label: string;
  zone: 'FULL' | 'MAIN' | 'SIDE';
  description: string;
}

export const HONORS_WIDGET_DEFINITIONS: HonorsWidgetMeta[] = [
  {
    id: 'BANNER',
    label: 'Banner Chiến dịch Trang chủ',
    zone: 'FULL',
    description: 'Ảnh bìa lớn đầu trang cùng tiêu đề chiến dịch thi đua.',
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
    description: 'Bảng chi tiết điểm số, xếp hạng và thống kê 7 chỉ số.',
  },
  {
    id: 'NEWS',
    label: 'Bảng tin Hương Khí & Lời chứng',
    zone: 'MAIN',
    description: 'Các bài chia sẻ, tương tác cảm xúc và bình luận khích lệ.',
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
    description: 'Lối tắt mở nhanh Báo cáo hằng ngày & Hồ sơ cá nhân.',
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
  'NEWS',
];

export interface SystemAppearanceConfig {
  id?: string;
  fontKey: AppFontKey;
  fontScale: AppFontScale;
  widgetOrder: HonorsWidgetId[];
  hiddenWidgets: HonorsWidgetId[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_APPEARANCE_CONFIG: SystemAppearanceConfig = {
  fontKey: 'BE_VIETNAM_PRO',
  fontScale: 'MD',
  widgetOrder: [...DEFAULT_HONORS_WIDGET_ORDER],
  hiddenWidgets: [],
};

// ---------- Hệ thống Giáo dục: Edu (LMS & CMS) ----------
export type EduTrack = 'TD_I' | 'TD_II' | 'NGV';

export const EDU_TRACK_LABELS: Record<EduTrack, string> = {
  TD_I: 'TĐ-I',
  TD_II: 'TĐ-II',
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
  studentName: string; // Tên TĐ
  assignedByUid: string;
  assignedByName: string;
  status: EduAssignmentStatus;
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


