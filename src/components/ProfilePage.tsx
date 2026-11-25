import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Building2,
  MapPin,
  Users2,
  Trophy,
  Target,
  Sparkles,
  Calendar,
  LogOut,
  PenTool,
  CheckCircle2,
  ArrowRight,
  Pencil,
  KeyRound,
  Send,
  Plus,
  Camera,
  X,
  Check,
  MessageCircle,
  Save,
  Upload,
  Search,
  BookOpen,
  Briefcase,
  PauseCircle,
  BarChart3,
  Award,
  FileSpreadsheet,
  Download,
  Lock,
  Eye,
  EyeOff,
  CalendarDays,
  Clock,
  Trash2,
  AlertTriangle,
  NotebookPen,
} from 'lucide-react';
import {
  UserAccount,
  Member,
  HuongKhiItem,
  TurboJournalItem,
  PersonalPlannerRecord,
  Company,
  Area,
  Department,
  ReactionType,
  DailyReportRecord,
  PeriodGoalRecord,
  FestivalEvent,
  DiscipleRecord,
  DiscipleProgressStep,
  DISCIPLE_PROGRESS_STEPS,
  DAILY_METRIC_DEFINITIONS,
  DailyReportMetrics,
  EMPTY_DAILY_METRICS,
  DEFAULT_EVENT_WEIGHTS,
  ROLE_DISPLAY_META,
} from '../types/edulms';
import { REACTION_CONFIG } from './GratitudeCheerPage';
import { SPOTLIGHT_COVERS } from './HeroBanner';
import { sumDailyReportMetrics, computeDailyMetricsScore } from '../utils/scoringEngine';
import { CustomSelect } from './CustomSelect';
import { PersonalPlannerSection } from './PersonalPlannerSection';
import {
  canAccessMemberReportOverview,
  formatAreaDisplayName,
  formatAreaScopeLabel,
  getScopedAreaOptions,
  getScopedCompanyOptions,
  getScopedMemberOptions,
  isAdminRole,
  makeAreaScopeKey,
} from '../utils/rbac';
import { isValidPersonalPin, sanitizePinInput } from '../utils/pinSecurity';
import {
  exportDailyReportsByRbacExcel,
  DailyReportExportPeriod,
} from '../utils/reportExporter';
import {
  DEFAULT_VOCABULARY_CONFIG,
  SystemVocabularyConfig,
  encodeSensitiveText,
  findSensitiveMatches,
  formatRemainingExpiry,
} from '../utils/wordEncoder';
import { isSafeImageUrl, sanitizeImageUrl } from '../utils/urlSanitizer';

interface ProfilePageProps {
  currentUser: UserAccount;
  memberData: Member | null;
  members?: Member[];
  myHuongKhiList: HuongKhiItem[];
  turboJournals?: TurboJournalItem[];
  personalPlanners?: PersonalPlannerRecord[];
  vocabularyConfig?: SystemVocabularyConfig;
  dailyReports: DailyReportRecord[];
  periodGoals: PeriodGoalRecord[];
  activeEvent: FestivalEvent | null;
  defaultWeights?: DailyReportMetrics;
  disciples: DiscipleRecord[];
  companies: Company[];
  areas: Area[];
  departments: Department[];
  onNavigateToEntry: () => void;
  onNavigateToDisciples: () => void;
  onNavigateToHonors: () => void;
  onNavigateToJournalCheer?: () => void;
  onLogout: () => void;
  onOpenRules: () => void;
  onAddHuongKhi: (item: Omit<HuongKhiItem, 'id' | 'likesCount'>) => void;
  onDeleteHuongKhi?: (id: string) => Promise<void> | void;
  onAddTurboJournal?: (payload: { title: string; content: string }) => Promise<void> | void;
  onUpdateTurboJournal?: (
    journalId: string,
    payload: { title: string; content: string }
  ) => Promise<void> | void;
  onDeleteTurboJournal?: (journalId: string) => Promise<void> | void;
  onSavePersonalPlanner?: (planner: PersonalPlannerRecord) => Promise<void>;
  onReactHuongKhi?: (id: string, reaction: ReactionType) => void;
  onAddComment?: (huongKhiId: string, content: string) => void;
  onUpdateProfile: (updatedData: {
    fullName: string;
    avatarUrl?: string;
    coverUrl?: string;
    bio?: string;
    newPassword?: string;
    companyCode: string;
    areaCode: string;
    departmentCode: string;
    unitCode?: string;
  }) => void | boolean | Promise<boolean | void>;
  onChangePin?: (currentPin: string | undefined, newPin: string) => Promise<boolean>;
  onShowNotification: (msg: string) => void;
}

/**
 * Nén ảnh qua Canvas để đảm bảo Data URL lưu lên Firestore luôn gọn nhẹ (< 200KB),
 * tránh lỗi vượt giới hạn 1MB/document của Firestore khi người dùng tải ảnh từ điện thoại.
 */
async function compressImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  initialQuality = 0.82
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Tệp ảnh không hợp lệ.'));
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let quality = initialQuality;
  let result = canvas.toDataURL('image/jpeg', quality);
  while (result.length > 220_000 && quality > 0.45) {
    quality -= 0.12;
    result = canvas.toDataURL('image/jpeg', quality);
  }
  return result;
}

const getRoleLabel = (role: UserAccount['role']): string => {
  const meta = ROLE_DISPLAY_META[role];
  if (meta) return meta.label;
  return 'Thành viên (TĐ)';
};

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  memberData,
  members = [],
  myHuongKhiList,
  turboJournals = [],
  personalPlanners = [],
  vocabularyConfig = DEFAULT_VOCABULARY_CONFIG,
  dailyReports,
  periodGoals,
  activeEvent,
  defaultWeights,
  disciples,
  companies,
  areas,
  departments,
  onNavigateToEntry,
  onNavigateToDisciples,
  onNavigateToJournalCheer,
  onLogout,
  onOpenRules,
  onAddHuongKhi,
  onDeleteHuongKhi,
  onAddTurboJournal,
  onUpdateTurboJournal,
  onDeleteTurboJournal,
  onSavePersonalPlanner,
  onReactHuongKhi,
  onAddComment,
  onUpdateProfile,
  onChangePin,
  onShowNotification,
}) => {
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isAddHuongKhiModalOpen, setIsAddHuongKhiModalOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<
    'POSTS' | 'PLANNER' | 'DISCIPLES' | 'REPORTS' | 'ABOUT'
  >('POSTS');

  // Bộ lọc bài viết trên tường cá nhân (Cảm tạ vs Turbo)
  const [journalFeedFilter, setJournalFeedFilter] = useState<'ALL' | 'GRATITUDE' | 'TURBO'>('ALL');
  const [journalSearch, setJournalSearch] = useState('');
  const [journalMonthFilter, setJournalMonthFilter] = useState<string>('ALL');
  const [editingTurboJournal, setEditingTurboJournal] = useState<TurboJournalItem | null>(null);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState<{
    kind: 'GRATITUDE' | 'TURBO';
    id: string;
    title: string;
  } | null>(null);

  // Bộ lọc trong tab Danh mục MĐ của tôi
  const [discipleSearch, setDiscipleSearch] = useState('');
  const [discipleStepFilter, setDiscipleStepFilter] = useState<'ALL' | 'ACTIVE' | DiscipleProgressStep>('ALL');

  // Bộ chuyển kỳ trong tab Tiến độ Báo cáo
  const [reportPeriodMode, setReportPeriodMode] = useState<'DAY' | 'MONTH' | 'YEAR'>('MONTH');

  // Cấu hình Xuất Excel Báo cáo hằng ngày theo phân quyền 7 cấp & 3 tầng liên hoàn
  const [exportPeriod, setExportPeriod] = useState<DailyReportExportPeriod>('MONTH');
  const [exportCompanyFilter, setExportCompanyFilter] = useState<string>('ALL');
  const [exportAreaFilter, setExportAreaFilter] = useState<string>('ALL');
  const [exportMemberFilter, setExportMemberFilter] = useState<string>('ALL');

  const avatarFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Reaction picker & comment expansion states
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Edit Profile Form State
  const [editFullName, setEditFullName] = useState(currentUser.fullName);
  const [editAvatarUrl, setEditAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [editCoverUrl, setEditCoverUrl] = useState(currentUser.coverUrl || '');
  const [editBio, setEditBio] = useState(
    currentUser.bio || 'Nguyện làm muối của đất và ánh sáng cho trần gian.'
  );
  const [editCompany, setEditCompany] = useState(currentUser.companyCode);
  const [editArea, setEditArea] = useState(currentUser.areaCode);
  const [editDepartment, setEditDepartment] = useState(currentUser.departmentCode);
  const [editUnitCode, setEditUnitCode] = useState(currentUser.unitCode || '');

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editError, setEditError] = useState('');

  // Personal 6-digit PIN change state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showPinDigits, setShowPinDigits] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Quick Journal Modal State (2 loại: Nhật ký cảm tạ 24h & Nhật ký turbo cá nhân)
  const [quickJournalKind, setQuickJournalKind] = useState<'GRATITUDE' | 'TURBO'>('GRATITUDE');
  const [quickHkTitle, setQuickHkTitle] = useState('');
  const [quickHkContent, setQuickHkContent] = useState('');

  // Đồng bộ form mỗi khi mở modal Sửa hồ sơ hoặc thông tin tài khoản thay đổi
  useEffect(() => {
    if (isEditProfileModalOpen) {
      setEditFullName(currentUser.fullName);
      setEditAvatarUrl(currentUser.avatarUrl || '');
      setEditCoverUrl(currentUser.coverUrl || '');
      setEditBio(currentUser.bio || 'Nguyện làm muối của đất và ánh sáng cho trần gian.');
      setEditCompany(currentUser.companyCode);
      setEditArea(currentUser.areaCode);
      setEditDepartment(currentUser.departmentCode);
      setEditUnitCode(currentUser.unitCode || '');
      setEditError('');
    }
  }, [isEditProfileModalOpen, currentUser]);

  // Danh sách khu vực lọc theo công ty đang chọn trong modal
  const areasForEditCompany = useMemo(
    () => areas.filter((a) => a.companyCode === editCompany),
    [areas, editCompany]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditProfileModalOpen(false);
        setIsAvatarModalOpen(false);
        setIsCoverModalOpen(false);
        setIsPasswordModalOpen(false);
        setIsPinModalOpen(false);
        setIsAddHuongKhiModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatNumber = (num: number) => {
    return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // ---------- Dữ liệu đồng bộ từ Báo cáo hằng ngày ----------
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const currentMonthStr = todayStr.slice(0, 7);
  const currentYearStr = todayStr.slice(0, 4);

  const myDailyReports = useMemo(
    () => dailyReports.filter((r) => r.uid === currentUser.id),
    [dailyReports, currentUser.id]
  );

  const daysReportedThisMonth = useMemo(
    () =>
      myDailyReports.filter(
        (r) => r.month === currentMonthStr || r.date.startsWith(currentMonthStr)
      ).length,
    [myDailyReports, currentMonthStr]
  );

  const reportSummary = useMemo(() => {
    const weights = activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS;
    let matchedReports: DailyReportRecord[] = [];
    let goals: DailyReportMetrics = { ...EMPTY_DAILY_METRICS };

    if (reportPeriodMode === 'DAY') {
      matchedReports = myDailyReports.filter((r) => r.date === todayStr);
      const todayReport = matchedReports[0];
      goals = todayReport
        ? { ...EMPTY_DAILY_METRICS, ...todayReport.goals }
        : { ...EMPTY_DAILY_METRICS };
    } else if (reportPeriodMode === 'MONTH') {
      matchedReports = myDailyReports.filter(
        (r) => r.month === currentMonthStr || r.date.startsWith(currentMonthStr)
      );
      const monthGoal = periodGoals.find(
        (g) =>
          g.uid === currentUser.id &&
          g.periodType === 'MONTH' &&
          g.periodKey === currentMonthStr
      );
      goals = monthGoal
        ? { ...EMPTY_DAILY_METRICS, ...monthGoal.goals }
        : { ...EMPTY_DAILY_METRICS };
    } else {
      matchedReports = myDailyReports.filter(
        (r) => r.year === currentYearStr || r.date.startsWith(currentYearStr)
      );
      const yearGoal = periodGoals.find(
        (g) =>
          g.uid === currentUser.id &&
          g.periodType === 'YEAR' &&
          g.periodKey === currentYearStr
      );
      goals = yearGoal
        ? { ...EMPTY_DAILY_METRICS, ...yearGoal.goals }
        : { ...EMPTY_DAILY_METRICS };
    }

    const results = sumDailyReportMetrics(matchedReports);
    const score = computeDailyMetricsScore(results, weights);

    let totalGoal = 0;
    let totalDone = 0;
    DAILY_METRIC_DEFINITIONS.forEach(({ key }) => {
      const g = Number(goals[key]) || 0;
      const r = Number(results[key]) || 0;
      if (g > 0) {
        totalGoal += g;
        totalDone += Math.min(r, g);
      }
    });
    const overallPct = totalGoal > 0 ? Math.round((totalDone / totalGoal) * 100) : 0;

    return {
      results,
      goals,
      score,
      overallPct,
      daysCount: matchedReports.length,
    };
  }, [
    myDailyReports,
    periodGoals,
    activeEvent,
    defaultWeights,
    reportPeriodMode,
    todayStr,
    currentMonthStr,
    currentYearStr,
    currentUser.id,
  ]);

  // ---------- Dữ liệu đồng bộ từ Danh mục MĐ (của chính tài khoản) ----------
  const myDisciples = useMemo(
    () =>
      disciples
        .filter((d) => d.ownerUid === currentUser.id)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [disciples, currentUser.id]
  );

  const discipleStats = useMemo(() => {
    const total = myDisciples.length;
    const stopped = myDisciples.filter((d) => d.isStopped || d.progress.includes('Dừng')).length;
    const active = total - stopped;
    const advanced = myDisciples.filter(
      (d) =>
        !d.isStopped &&
        (d.progress.includes('WS') || d.progress.includes('KT') || d.progress.includes('GM'))
    ).length;
    return { total, active, stopped, advanced };
  }, [myDisciples]);

  const filteredMyDisciples = useMemo(() => {
    const kw = discipleSearch.trim().toLowerCase();
    return myDisciples.filter((d) => {
      if (discipleStepFilter === 'ACTIVE') {
        if (d.isStopped || d.progress.includes('Dừng')) return false;
      } else if (discipleStepFilter !== 'ALL') {
        if (!d.progress.includes(discipleStepFilter)) return false;
      }
      if (!kw) return true;
      return (
        d.nickname.toLowerCase().includes(kw) ||
        (d.job || '').toLowerCase().includes(kw) ||
        (d.statusNote || '').toLowerCase().includes(kw) ||
        (d.traits || '').toLowerCase().includes(kw)
      );
    });
  }, [myDisciples, discipleSearch, discipleStepFilter]);

  const memberScore = memberData?.score || 0;
  const memberRank = memberData?.rank || 1;

  // Preset Avatars
  const presetAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  ];

  const canEditOrgPlacement = isAdminRole(currentUser.role);

  // Dedicated Save Avatar Only
  const handleSaveAvatarOnly = async () => {
    setEditError('');
    const rawAvatar = editAvatarUrl.trim();
    if (rawAvatar && !isSafeImageUrl(rawAvatar)) {
      onShowNotification('Đường dẫn ảnh đại diện không hợp lệ (chỉ hỗ trợ https://, http:// hoặc ảnh tải lên).');
      return;
    }
    const saved = await onUpdateProfile({
      fullName: currentUser.fullName,
      avatarUrl: sanitizeImageUrl(rawAvatar),
      companyCode: currentUser.companyCode,
      areaCode: currentUser.areaCode,
      departmentCode: currentUser.departmentCode,
      unitCode: currentUser.unitCode,
    });
    if (saved === false) return;
    setIsAvatarModalOpen(false);
    onShowNotification('Đã cập nhật ảnh đại diện thành công!');
  };

  // Dedicated Save Cover Only
  const handleSaveCoverOnly = async () => {
    setEditError('');
    const rawCover = editCoverUrl.trim();
    if (rawCover && !isSafeImageUrl(rawCover)) {
      onShowNotification('Đường dẫn ảnh bìa không hợp lệ (chỉ hỗ trợ https://, http:// hoặc ảnh tải lên).');
      return;
    }
    const saved = await onUpdateProfile({
      fullName: currentUser.fullName,
      coverUrl: sanitizeImageUrl(rawCover),
      companyCode: currentUser.companyCode,
      areaCode: currentUser.areaCode,
      departmentCode: currentUser.departmentCode,
      unitCode: currentUser.unitCode,
    });
    if (saved === false) return;
    setIsCoverModalOpen(false);
    onShowNotification('Đã cập nhật ảnh bìa thành công!');
  };

  // Handle Local File Upload for Avatar (tự nén trước khi lưu Firestore)
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      onShowNotification('Kích thước ảnh quá lớn (vui lòng chọn ảnh dưới 10MB).');
      return;
    }
    try {
      const compressed = await compressImageFile(file, 400, 400, 0.85);
      setEditAvatarUrl(compressed);
      onShowNotification('Đã xử lý & tải ảnh lên! Hãy bấm "Lưu ảnh đại diện".');
    } catch (err: any) {
      onShowNotification(err?.message || 'Không xử lý được tệp ảnh.');
    }
  };

  // Handle Local File Upload for Cover (tự nén trước khi lưu Firestore)
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      onShowNotification('Kích thước ảnh bìa quá lớn (vui lòng chọn ảnh dưới 12MB).');
      return;
    }
    try {
      const compressed = await compressImageFile(file, 1280, 720, 0.8);
      setEditCoverUrl(compressed);
      onShowNotification('Đã xử lý & tải ảnh bìa! Hãy bấm "Lưu ảnh bìa".');
    } catch (err: any) {
      onShowNotification(err?.message || 'Không xử lý được tệp ảnh bìa.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editFullName.trim()) {
      setEditError('Họ và tên không được để trống.');
      return;
    }
    if (editAvatarUrl.trim() && !isSafeImageUrl(editAvatarUrl)) {
      setEditError('Đường dẫn ảnh đại diện không hợp lệ (chỉ hỗ trợ https://, http:// hoặc ảnh tải lên).');
      return;
    }
    if (editCoverUrl.trim() && !isSafeImageUrl(editCoverUrl)) {
      setEditError('Đường dẫn ảnh bìa không hợp lệ (chỉ hỗ trợ https://, http:// hoặc ảnh tải lên).');
      return;
    }

    const saved = await onUpdateProfile({
      fullName: editFullName.trim(),
      avatarUrl: sanitizeImageUrl(editAvatarUrl),
      coverUrl: sanitizeImageUrl(editCoverUrl),
      bio: editBio.trim(),
      companyCode: canEditOrgPlacement ? editCompany : currentUser.companyCode,
      areaCode: canEditOrgPlacement ? editArea : currentUser.areaCode,
      departmentCode: canEditOrgPlacement ? editDepartment : currentUser.departmentCode,
      unitCode: canEditOrgPlacement ? editUnitCode.trim() : currentUser.unitCode,
    });
    if (saved === false) return;

    setIsEditProfileModalOpen(false);
    onShowNotification('Đã cập nhật thông tin cá nhân & đồng bộ dữ liệu!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!newPassword || newPassword.length < 6) {
      setEditError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setEditError('Mật khẩu xác nhận không khớp.');
      return;
    }

    const changed = await onUpdateProfile({
      fullName: currentUser.fullName,
      newPassword,
      companyCode: currentUser.companyCode,
      areaCode: currentUser.areaCode,
      departmentCode: currentUser.departmentCode,
      unitCode: currentUser.unitCode,
    });
    if (changed === false) return;

    setIsPasswordModalOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    onShowNotification('Đã đổi mật khẩu thành công!');
  };

  const handleOpenPinModal = () => {
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinError('');
    setShowPinDigits(false);
    setIsPinModalOpen(true);
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (currentUser.pinHash && !isValidPersonalPin(currentPinInput)) {
      setPinError('Vui lòng nhập đúng Mã cá nhân 6 số hiện tại.');
      return;
    }
    if (!isValidPersonalPin(newPinInput)) {
      setPinError('Mã cá nhân mới phải gồm đúng 6 chữ số (0–9).');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinError('Mã cá nhân xác nhận không khớp.');
      return;
    }
    if (!onChangePin) return;

    setIsSavingPin(true);
    try {
      const ok = await onChangePin(currentUser.pinHash ? currentPinInput : undefined, newPinInput);
      if (!ok) {
        setPinError('Mã cá nhân hiện tại không chính xác hoặc không thể cập nhật.');
        return;
      }
      setIsPinModalOpen(false);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      onShowNotification('Đã cập nhật Mã cá nhân 6 số thành công!');
    } finally {
      setIsSavingPin(false);
    }
  };

  // ---------- Bộ lọc Xuất Excel 3 tầng liên hoàn (Sion -> KV -> Cá nhân) ----------
  const exportRbacMembers = useMemo(() => {
    const list = members.filter((m) => canAccessMemberReportOverview(currentUser, m));
    const ownMemberId = currentUser.memberId || `m-${currentUser.id}`;
    if (!list.some((m) => m.id === ownMemberId || m.id === currentUser.id)) {
      list.unshift({
        id: ownMemberId,
        code: currentUser.username,
        fullName: currentUser.fullName,
        companyCode: currentUser.companyCode || '',
        areaCode: currentUser.areaCode || '',
        departmentCode: currentUser.departmentCode || '',
        unitCode: currentUser.unitCode || '',
        active: true,
        goals: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
        results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
        score: 0,
        targets: [],
        createdAt: currentUser.createdAt || todayStr,
      });
    }
    return list;
  }, [members, currentUser, todayStr]);

  const exportScopedCompanies = useMemo(
    () => getScopedCompanyOptions(currentUser, companies, exportRbacMembers),
    [currentUser, companies, exportRbacMembers]
  );

  const exportScopedAreas = useMemo(
    () => getScopedAreaOptions(currentUser, areas, exportCompanyFilter, exportRbacMembers),
    [currentUser, areas, exportCompanyFilter, exportRbacMembers]
  );

  const exportScopedMembers = useMemo(
    () => getScopedMemberOptions(exportRbacMembers, exportCompanyFilter, exportAreaFilter),
    [exportRbacMembers, exportCompanyFilter, exportAreaFilter]
  );

  const journalMatches = useMemo(
    () =>
      findSensitiveMatches(
        `${quickHkTitle}\n${quickHkContent}`,
        vocabularyConfig?.rules
      ),
    [quickHkTitle, quickHkContent, vocabularyConfig?.rules]
  );

  const encodedPreviewContent = useMemo(
    () =>
      encodeSensitiveText(
        quickHkContent,
        vocabularyConfig?.rules,
        vocabularyConfig?.enabled !== false
      ),
    [quickHkContent, vocabularyConfig?.rules, vocabularyConfig?.enabled]
  );

  const openNewJournalModal = (kind: 'GRATITUDE' | 'TURBO') => {
    setEditingTurboJournal(null);
    setQuickJournalKind(kind);
    setQuickHkTitle('');
    setQuickHkContent('');
    setIsAddHuongKhiModalOpen(true);
  };

  const openEditTurboModal = (journal: TurboJournalItem) => {
    setEditingTurboJournal(journal);
    setQuickJournalKind('TURBO');
    setQuickHkTitle(journal.title);
    setQuickHkContent(journal.content);
    setIsAddHuongKhiModalOpen(true);
  };

  const handlePostQuickHuongKhi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickHkTitle.trim() || !quickHkContent.trim()) {
      onShowNotification('Vui lòng điền đủ tiêu đề và nội dung.');
      return;
    }

    setIsSavingJournal(true);
    try {
      if (editingTurboJournal && onUpdateTurboJournal) {
        await onUpdateTurboJournal(editingTurboJournal.id, {
          title: quickHkTitle.trim(),
          content: quickHkContent.trim(),
        });
        setEditingTurboJournal(null);
        setQuickHkTitle('');
        setQuickHkContent('');
        setIsAddHuongKhiModalOpen(false);
        onShowNotification('Đã cập nhật Nhật ký turbo!');
      } else if (quickJournalKind === 'TURBO') {
        if (onAddTurboJournal) {
          await onAddTurboJournal({
            title: quickHkTitle.trim(),
            content: quickHkContent.trim(),
          });
        }
        setQuickHkTitle('');
        setQuickHkContent('');
        setIsAddHuongKhiModalOpen(false);
        onShowNotification('Đã lưu Nhật ký turbo lên tường cá nhân!');
      } else {
        onAddHuongKhi({
          authorId: memberData?.id || currentUser.id,
          authorUid: currentUser.id,
          authorName: currentUser.fullName,
          authorAvatar: currentUser.avatarUrl,
          companyCode: currentUser.companyCode,
          areaCode: currentUser.areaCode,
          departmentCode: currentUser.departmentCode,
          title: quickHkTitle.trim(),
          content: quickHkContent.trim(),
          category: 'GRATITUDE',
          journalType: 'GRATITUDE',
          date: new Date().toLocaleDateString('vi-VN'),
          isFeatured: true,
          reactions: {
            heart: 1,
            pray: 1,
            praise: 0,
            fire: 0,
            blessing: 0,
            like: 0,
          },
          comments: [],
        });
        setQuickHkTitle('');
        setQuickHkContent('');
        setIsAddHuongKhiModalOpen(false);
        onShowNotification('Đã đăng Nhật ký cảm tạ (tự ẩn sau 24 giờ)!');
      }
    } finally {
      setIsSavingJournal(false);
    }
  };

  const handleConfirmDeleteJournal = async () => {
    if (!confirmDeletePost) return;
    if (confirmDeletePost.kind === 'TURBO' && onDeleteTurboJournal) {
      await onDeleteTurboJournal(confirmDeletePost.id);
    } else if (confirmDeletePost.kind === 'GRATITUDE' && onDeleteHuongKhi) {
      await onDeleteHuongKhi(confirmDeletePost.id);
    }
    setConfirmDeletePost(null);
  };

  const handleCommentSubmit = (storyId: string) => {
    const text = commentInputs[storyId]?.trim();
    if (!text) return;
    if (onAddComment) {
      onAddComment(storyId, text);
    }
    setCommentInputs((prev) => ({ ...prev, [storyId]: '' }));
  };

  const getTotalReactions = (story: HuongKhiItem) => {
    if (story.reactions) {
      return (
        (story.reactions.heart || 0) +
        (story.reactions.pray || 0) +
        (story.reactions.praise || 0) +
        (story.reactions.fire || 0) +
        (story.reactions.like || 0) +
        (story.reactions.blessing || 0)
      );
    }
    return story.likesCount || 0;
  };

  const coverImage = currentUser.coverUrl || SPOTLIGHT_COVERS[0].url;
  const totalPostsCount = myHuongKhiList.length + turboJournals.length;

  const availableJournalMonths = useMemo(() => {
    const months = new Set<string>();
    turboJournals.forEach((t) => {
      if (t.createdAtIso && t.createdAtIso.length >= 7) {
        months.add(t.createdAtIso.slice(0, 7));
      }
    });
    myHuongKhiList.forEach((h) => {
      if (h.createdAtIso && h.createdAtIso.length >= 7) {
        months.add(h.createdAtIso.slice(0, 7));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [turboJournals, myHuongKhiList]);

  type UnifiedFeedEntry =
    | { kind: 'TURBO'; sortKey: string; item: TurboJournalItem }
    | { kind: 'GRATITUDE'; sortKey: string; item: HuongKhiItem };

  const unifiedFeedEntries = useMemo<UnifiedFeedEntry[]>(() => {
    const kw = journalSearch.trim().toLowerCase();
    const list: UnifiedFeedEntry[] = [];

    if (journalFeedFilter === 'ALL' || journalFeedFilter === 'TURBO') {
      turboJournals.forEach((tj) => {
        if (journalMonthFilter !== 'ALL') {
          const ym = tj.createdAtIso?.slice(0, 7) || '';
          if (ym !== journalMonthFilter) return;
        }
        if (
          kw &&
          !tj.title.toLowerCase().includes(kw) &&
          !tj.content.toLowerCase().includes(kw)
        ) {
          return;
        }
        list.push({
          kind: 'TURBO',
          sortKey: tj.createdAtIso || tj.id || '',
          item: tj,
        });
      });
    }

    if (journalFeedFilter === 'ALL' || journalFeedFilter === 'GRATITUDE') {
      myHuongKhiList.forEach((hk) => {
        if (journalMonthFilter !== 'ALL') {
          const ym = hk.createdAtIso?.slice(0, 7) || '';
          if (ym !== journalMonthFilter) return;
        }
        if (
          kw &&
          !hk.title.toLowerCase().includes(kw) &&
          !hk.content.toLowerCase().includes(kw)
        ) {
          return;
        }
        list.push({
          kind: 'GRATITUDE',
          sortKey: hk.createdAtIso || hk.id || '',
          item: hk,
        });
      });
    }

    return list.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [turboJournals, myHuongKhiList, journalFeedFilter, journalSearch, journalMonthFilter]);

  return (
    <div
      className={`${
        activeProfileTab === 'PLANNER' ? 'max-w-6xl' : 'max-w-5xl'
      } mx-auto animate-in fade-in space-y-3 sm:space-y-4`}
    >
      {/* ========================================================
          1. PROFILE HEADER CARD
          ======================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Cover Photo Container (Compact on mobile) */}
        <div className="relative w-full h-24 sm:h-44 md:h-52 bg-slate-950 overflow-hidden group">
          <img
            src={coverImage}
            alt="Ảnh bìa trang cá nhân"
            className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

          <button
            type="button"
            onClick={() => {
              setEditCoverUrl(currentUser.coverUrl || SPOTLIGHT_COVERS[0].url);
              setIsCoverModalOpen(true);
            }}
            className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-20 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5 border border-white/20 cursor-pointer shadow-lg shrink-0"
            title="Đổi ảnh bìa"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold whitespace-nowrap">Đổi ảnh bìa</span>
          </button>
        </div>

        {/* Profile Info Section */}
        <div className="px-3 sm:px-6 pb-2.5 pt-0 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2.5 sm:gap-4 -mt-10 sm:-mt-16 md:-mt-20 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
            {/* Avatar & User Details */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-2.5 sm:gap-5 text-center sm:text-left">
              <div className="relative group shrink-0 z-10">
                <div className="w-20 h-20 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full bg-white dark:bg-slate-900 p-1 shadow-xl ring-3 sm:ring-4 ring-amber-400/70 dark:ring-amber-500/50 relative overflow-hidden">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-700 via-indigo-700 to-amber-600 flex items-center justify-center text-white text-2xl sm:text-4xl font-black">
                      {currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN' ? (
                        <Shield className="w-8 h-8 sm:w-14 sm:h-14 text-white" />
                      ) : (
                        currentUser.fullName.charAt(0)
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditAvatarUrl(currentUser.avatarUrl || '');
                    setIsAvatarModalOpen(true);
                  }}
                  className="absolute bottom-0 right-0 sm:bottom-1 sm:right-1 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-md transition cursor-pointer hover:scale-105"
                  title="Cập nhật ảnh đại diện"
                >
                  <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                </button>
              </div>

              {/* User Identity Stack */}
              <div className="pt-0.5 sm:pb-1 space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-amber-300">
                    {currentUser.fullName}
                  </h1>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      ROLE_DISPLAY_META[currentUser.role]?.badgeClass ||
                      'bg-blue-100 text-blue-800 border-blue-200'
                    }`}
                  >
                    {getRoleLabel(currentUser.role)}
                  </span>
                </div>

                {/* Quick stats subtitle synced with DailyReports & Disciples */}
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
                  <span className="font-mono text-slate-400">@{currentUser.username}</span>
                  <span>•</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {formatNumber(memberScore)} điểm
                  </span>
                  <span>•</span>
                  <span className="tabular-nums">Hạng #{memberRank}</span>
                  <span>•</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                    {myDisciples.length} MĐ
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline tabular-nums">{daysReportedThisMonth} ngày báo cáo tháng</span>
                </div>

                {/* Units Pills */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 pt-0.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 sm:py-1 rounded-lg">
                    <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-700 dark:text-blue-400" />
                    Sion: <strong>{currentUser.companyCode}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 sm:py-1 rounded-lg">
                    <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-700 dark:text-blue-400" />
                    KV: <strong>{currentUser.areaCode}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 sm:py-1 rounded-lg">
                    <Users2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-700 dark:text-blue-400" />
                    <strong>
                      {currentUser.unitCode
                        ? `${currentUser.unitCode} (${currentUser.departmentCode})`
                        : currentUser.departmentCode}
                    </strong>
                  </span>
                </div>

                <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 italic max-w-lg pt-0.5 leading-relaxed">
                  “{currentUser.bio || 'Nguyện làm muối của đất và ánh sáng cho trần gian.'}”
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center md:justify-end gap-1.5 sm:gap-2 flex-wrap pt-1 md:pt-0">
              <button
                type="button"
                onClick={() => openNewJournalModal('GRATITUDE')}
                className="h-9 px-3 sm:px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Viết bài</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(true)}
                className="h-9 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Sửa hồ sơ</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="h-9 px-2.5 sm:px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                title="Đổi mật khẩu"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Mật khẩu</span>
              </button>

              {onChangePin && (
                <button
                  type="button"
                  onClick={handleOpenPinModal}
                  className="h-9 px-2.5 sm:px-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-2xs"
                  title="Đổi Mã cá nhân 6 số"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mã PIN</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                className="h-9 px-2.5 sm:px-3 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition border border-rose-200 dark:border-rose-900 cursor-pointer flex items-center gap-1"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* Profile Navigation Tabs: 5 tabs */}
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 pt-2 sm:pt-3 text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setActiveProfileTab('POSTS')}
              className={`px-1 sm:px-2.5 h-9 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 border ${
                activeProfileTab === 'POSTS'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-extrabold shadow-2xs'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
              <span className="truncate">Bài Viết</span>
              <span className="hidden sm:inline-flex px-1 py-0.5 rounded-md text-[10px] bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700 tabular-nums shrink-0">
                {totalPostsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveProfileTab('PLANNER')}
              className={`px-1 sm:px-2.5 h-9 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 border ${
                activeProfileTab === 'PLANNER'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-extrabold shadow-2xs'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
              <span className="truncate sm:hidden">KH LLV</span>
              <span className="truncate hidden sm:inline">Kế hoạch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveProfileTab('DISCIPLES')}
              className={`px-1 sm:px-2.5 h-9 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 border ${
                activeProfileTab === 'DISCIPLES'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-extrabold shadow-2xs'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
              <span className="truncate sm:hidden">MĐ</span>
              <span className="truncate hidden sm:inline">MĐ của tôi</span>
              <span className="hidden sm:inline-flex px-1 py-0.5 rounded-md text-[10px] bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700 tabular-nums shrink-0">
                {myDisciples.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveProfileTab('REPORTS')}
              className={`px-1 sm:px-2.5 h-9 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 border ${
                activeProfileTab === 'REPORTS'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-extrabold shadow-2xs'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
              <span className="truncate">Báo cáo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveProfileTab('ABOUT')}
              className={`px-1 sm:px-2.5 h-9 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 border ${
                activeProfileTab === 'ABOUT'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-extrabold shadow-2xs'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
              <span className="truncate">Thông tin</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. PROFILE CONTENT (FULL-WIDTH CHO PLANNER, 2 CỘT CHO TAB KHÁC)
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 items-start">
        {activeProfileTab === 'PLANNER' && (
          <div className="lg:col-span-12 min-w-0">
            <PersonalPlannerSection
              currentUser={currentUser}
              personalPlanners={personalPlanners}
              onSavePersonalPlanner={
                onSavePersonalPlanner || (async () => {})
              }
              onShowNotification={onShowNotification}
            />
          </div>
        )}

        {activeProfileTab !== 'PLANNER' && (
        <>
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4">
          {/* Card: Giới thiệu */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs border border-slate-100 dark:border-slate-800 space-y-2.5 sm:space-y-3">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>Giới thiệu</span>
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed text-center py-2 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700">
              “{currentUser.bio || 'Nguyện làm muối của đất và ánh sáng cho trần gian.'}”
            </p>

            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Thuộc công ty:{' '}
                  <strong className="text-slate-900 dark:text-white">{currentUser.companyCode}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Khu vực thi đua:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    Khu vực {currentUser.areaCode}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Users2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Ban ngành sinh hoạt:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {currentUser.departmentCode}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Vị trí bảng xếp hạng:{' '}
                  <strong className="text-amber-600 dark:text-amber-400 font-black">
                    Hạng #{memberRank}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  Điểm thi đua hiện tại:{' '}
                  <strong className="text-blue-600 dark:text-blue-400 font-black">
                    {formatNumber(memberScore)} điểm
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  MĐ đang theo dõi:{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    {discipleStats.active} đang theo / {discipleStats.total} tổng
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  Báo cáo tháng {currentMonthStr.split('-').reverse().join('/')}:{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    {daysReportedThisMonth} ngày
                  </strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditProfileModalOpen(true)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Chỉnh sửa chi tiết
            </button>
          </div>

          {/* Card: Thao Tác Nhanh */}
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 text-white shadow-md border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <span>⚡ Thao tác nhanh</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 pt-0.5">
              <button
                type="button"
                onClick={onNavigateToEntry}
                className="w-full h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Báo cáo ngày</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToDisciples}
                className="w-full h-9 px-3 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Thông tin MĐ</span>
              </button>
              <button
                type="button"
                onClick={onOpenRules}
                className="col-span-2 lg:col-span-1 w-full h-9 px-3 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
              >
                <span>Thể lệ quy đổi điểm</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-3 sm:space-y-4 min-w-0">
          {/* TAB 1: BÀI VIẾT (NHẬT KÝ CẢM TẠ 24H & NHẬT KÝ TURBO CÁ NHÂN) */}
          {activeProfileTab === 'POSTS' && (
            <div className="space-y-3 sm:space-y-4 animate-in fade-in">
              {/* Post Composer & Filters */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-blue-100 dark:ring-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-700 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                      {currentUser.fullName.charAt(0)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => openNewJournalModal('GRATITUDE')}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 text-left transition cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">Viết bài mới...</span>
                    <NotebookPen className="w-4 h-4 text-amber-500 shrink-0 ml-2" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => openNewJournalModal('GRATITUDE')}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/60 transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">Nhật ký cảm tạ</div>
                        <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300/90 truncate">
                          Công khai · Tự ẩn sau 24h
                        </div>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openNewJournalModal('TURBO')}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/60 transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">Nhật ký turbo</div>
                        <div className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300/90 truncate">
                          Riêng tư · Lưu tường cá nhân
                        </div>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 shrink-0" />
                  </button>
                </div>

                {/* Bộ lọc + Tìm kiếm + Lối tắt Nhật Ký & Cổ Vũ */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold gap-1">
                      <button
                        type="button"
                        onClick={() => setJournalFeedFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          journalFeedFilter === 'ALL'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Tất cả ({totalPostsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setJournalFeedFilter('GRATITUDE')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          journalFeedFilter === 'GRATITUDE'
                            ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Cảm tạ 24h ({myHuongKhiList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setJournalFeedFilter('TURBO')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          journalFeedFilter === 'TURBO'
                            ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Turbo riêng tư ({turboJournals.length})
                      </button>
                    </div>

                    {onNavigateToJournalCheer && (
                      <button
                        type="button"
                        onClick={onNavigateToJournalCheer}
                        className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>Trang Nhật Ký &amp; Cổ Vũ</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {totalPostsCount > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={journalSearch}
                          onChange={(e) => setJournalSearch(e.target.value)}
                          placeholder="Tìm theo tiêu đề, nội dung..."
                          className="w-full h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                        />
                      </div>
                      {availableJournalMonths.length > 0 && (
                        <div className="w-full sm:w-44 shrink-0">
                          <CustomSelect
                            size="sm"
                            searchable={false}
                            value={journalMonthFilter}
                            onChange={setJournalMonthFilter}
                            options={[
                              { value: 'ALL', label: 'Tất cả tháng' },
                              ...availableJournalMonths.map((ym) => ({
                                value: ym,
                                label: `Tháng ${ym.split('-').reverse().join('/')}`,
                              })),
                            ]}
                            ariaLabel="Lọc bài viết theo tháng"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Unified Chronological Timeline Feed */}
              {unifiedFeedEntries.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {unifiedFeedEntries.map((entry) => {
                    if (entry.kind === 'TURBO') {
                      const tj = entry.item;
                      return (
                        <div
                          key={`turbo_${tj.id}`}
                          className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-xs border border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {currentUser.avatarUrl ? (
                                <img
                                  src={currentUser.avatarUrl}
                                  alt={currentUser.fullName}
                                  className="w-9 h-9 rounded-full object-cover shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center shrink-0">
                                  {currentUser.fullName.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight truncate">
                                  {currentUser.fullName}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                                  <span className="font-mono tabular-nums">{tj.date}</span>
                                  <span>·</span>
                                  <span className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300">
                                    <Lock className="w-3 h-3" />
                                    Nhật ký turbo · Riêng tư
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {onUpdateTurboJournal && (
                                <button
                                  type="button"
                                  onClick={() => openEditTurboModal(tj)}
                                  title="Chỉnh sửa Nhật ký turbo"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteTurboJournal && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeletePost({
                                      kind: 'TURBO',
                                      id: tj.id,
                                      title: tj.title,
                                    })
                                  }
                                  title="Xóa trang Nhật ký turbo"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                              {tj.title}
                            </h4>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                              {tj.content}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const item = entry.item;
                    const totalR = getTotalReactions(item);
                    const isCommentsOpen = expandedCommentsId === item.id;
                    const userCurrentReaction = item.userReaction
                      ? REACTION_CONFIG[item.userReaction]
                      : null;
                    const remainingLabel = formatRemainingExpiry(item.expiresAtIso);

                    return (
                      <div
                        key={`grat_${item.id}`}
                        className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-xs border border-slate-100 dark:border-slate-800 space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {currentUser.avatarUrl ? (
                              <img
                                src={currentUser.avatarUrl}
                                alt={currentUser.fullName}
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-700 text-white font-bold flex items-center justify-center shrink-0">
                                {currentUser.fullName.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight truncate">
                                {currentUser.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                                <span className="font-mono tabular-nums">{item.date}</span>
                                <span>·</span>
                                <span className="font-bold text-amber-700 dark:text-amber-300">
                                  Nhật ký cảm tạ
                                </span>
                                {remainingLabel && (
                                  <>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 tabular-nums">
                                      <Clock className="w-3 h-3 text-amber-500" />
                                      {remainingLabel}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {onDeleteHuongKhi && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeletePost({
                                  kind: 'GRATITUDE',
                                  id: item.id,
                                  title: item.title,
                                })
                              }
                              title="Xóa Nhật ký cảm tạ"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div>
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {item.content}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <div className="flex items-center gap-1 font-bold">
                            <span>❤️ 🙏 🔥</span>
                            <span>{totalR} lượt cảm xúc</span>
                          </div>
                          <span>{item.comments?.length || 0} bình luận</span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between relative">
                          <div
                            className="relative"
                            onMouseEnter={() => setActiveReactionPickerId(item.id)}
                            onMouseLeave={() => setActiveReactionPickerId(null)}
                          >
                            {activeReactionPickerId === item.id && (
                              <div className="absolute -top-11 left-0 z-30 flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-full shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in">
                                {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((rType) => {
                                  const cfg = REACTION_CONFIG[rType];
                                  return (
                                    <button
                                      key={rType}
                                      type="button"
                                      onClick={() => {
                                        if (onReactHuongKhi) onReactHuongKhi(item.id, rType);
                                        setActiveReactionPickerId(null);
                                      }}
                                      className="text-lg hover:scale-125 transition-transform p-1 cursor-pointer"
                                      title={cfg.label}
                                    >
                                      {cfg.emoji}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (onReactHuongKhi) {
                                  onReactHuongKhi(item.id, item.userReaction ? 'like' : 'heart');
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                userCurrentReaction
                                  ? `${userCurrentReaction.bgColor} ${userCurrentReaction.color}`
                                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span>{userCurrentReaction ? userCurrentReaction.emoji : '👍'}</span>
                              <span>{userCurrentReaction ? userCurrentReaction.label : 'Thích'}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCommentsId(isCommentsOpen ? null : item.id)
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span>Bình luận</span>
                          </button>
                        </div>

                        {isCommentsOpen && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 animate-in fade-in">
                            {item.comments && item.comments.length > 0 && (
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {item.comments.map((c) => (
                                  <div
                                    key={c.id}
                                    className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-2.5 text-xs"
                                  >
                                    <div className="flex justify-between font-bold text-[11px] text-slate-900 dark:text-white">
                                      <span>{c.authorName}</span>
                                      <span className="text-slate-400 font-mono text-[10px]">
                                        {c.createdAt}
                                      </span>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                                      {c.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <input
                                type="text"
                                value={commentInputs[item.id] || ''}
                                onChange={(e) =>
                                  setCommentInputs((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCommentSubmit(item.id);
                                  }
                                }}
                                placeholder="Viết bình luận..."
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleCommentSubmit(item.id)}
                                className="px-3 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                  {journalSearch.trim() || journalMonthFilter !== 'ALL'
                    ? 'Không tìm thấy bài viết khớp bộ lọc.'
                    : journalFeedFilter === 'TURBO'
                    ? 'Chưa có Nhật ký turbo nào.'
                    : journalFeedFilter === 'GRATITUDE'
                    ? 'Chưa có Nhật ký cảm tạ nào trong 24 giờ qua.'
                    : 'Chưa có bài viết nào.'}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DANH MỤC MĐ CỦA TÔI (ĐỒNG BỘ COLLECTION disciples) */}
          {activeProfileTab === 'DISCIPLES' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs border border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Danh Mục MĐ Cá Nhân ({myDisciples.length})</span>
                </h3>

                <button
                  type="button"
                  onClick={onNavigateToDisciples}
                  className="px-3 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <span>Quản lý MĐ chi tiết</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick KPI Strip (1 row) */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
                <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase text-slate-400 truncate">Tổng MĐ</div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {discipleStats.total}
                  </div>
                </div>
                <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60">
                  <div className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-300 truncate">
                    Đang theo
                  </div>
                  <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-300 tabular-nums mt-0.5">
                    {discipleStats.active}
                  </div>
                </div>
                <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-300 truncate">
                    GM/KT/WS
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
                    {discipleStats.advanced}
                  </div>
                </div>
                <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60">
                  <div className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-300 truncate">
                    Đã Dừng
                  </div>
                  <div className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300 tabular-nums mt-0.5">
                    {discipleStats.stopped}
                  </div>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={discipleSearch}
                    onChange={(e) => setDiscipleSearch(e.target.value)}
                    placeholder="Tìm theo biệt danh, công việc, ghi chú..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div className="w-full sm:w-64 shrink-0">
                  <CustomSelect
                    size="sm"
                    value={discipleStepFilter}
                    onChange={(val) => setDiscipleStepFilter(val as any)}
                    options={[
                      { value: 'ALL', label: 'Tất cả trạng thái' },
                      { value: 'ACTIVE', label: 'Đang theo dõi (chưa Dừng)' },
                      ...DISCIPLE_PROGRESS_STEPS.map((st) => ({
                        value: st.key,
                        label: `Bước: ${st.label}`,
                      })),
                    ]}
                    ariaLabel="Lọc trạng thái MĐ"
                  />
                </div>
              </div>

              {/* Disciples List */}
              {filteredMyDisciples.length > 0 ? (
                <div className="space-y-3">
                  {filteredMyDisciples.map((d) => {
                    const stopped = d.isStopped || d.progress.includes('Dừng');
                    const ageLabel =
                      d.ageMode === 'EXACT' && d.exactAge
                        ? `${d.exactAge} tuổi (${d.ageRange})`
                        : `Khoảng ${d.ageRange}`;

                    return (
                      <div
                        key={d.id}
                        className={`p-4 rounded-2xl border text-xs space-y-2.5 transition ${
                          stopped
                            ? 'bg-rose-50/40 dark:bg-rose-950/15 border-rose-200/80 dark:border-rose-900/50'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {d.nickname}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {ageLabel}
                            </span>
                            {d.job && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                                <Briefcase className="w-3 h-3" />
                                {d.job}
                              </span>
                            )}
                          </div>

                          {stopped ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                              <PauseCircle className="w-3 h-3" />
                              Đã dừng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Đang theo
                            </span>
                          )}
                        </div>

                        {d.traits && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            <strong className="text-slate-700 dark:text-slate-200">Đặc điểm:</strong>{' '}
                            {d.traits}
                          </div>
                        )}

                        {/* Progress Steps Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {DISCIPLE_PROGRESS_STEPS.map((st) => {
                            const hasStep = d.progress.includes(st.key);
                            return (
                              <span
                                key={st.key}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  hasStep
                                    ? st.isStop
                                      ? 'bg-rose-600 text-white border-rose-600'
                                      : 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white/70 dark:bg-slate-900/50 text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {st.label}
                              </span>
                            );
                          })}
                        </div>

                        {d.statusNote && (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="font-bold text-slate-900 dark:text-white">Ghi chú: </span>
                            {d.statusNote}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    {myDisciples.length === 0
                      ? 'Bạn chưa thêm MĐ nào trong Trang thông tin MĐ.'
                      : 'Không có MĐ nào khớp với bộ lọc tìm kiếm.'}
                  </div>
                  <button
                    type="button"
                    onClick={onNavigateToDisciples}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm MĐ mới ngay</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TIẾN ĐỘ BÁO CÁO (GỌN GÀNG TRÊN MOBILE + BẢNG 7 DÒNG + EXCEL GRID) */}
          {activeProfileTab === 'REPORTS' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in">
              {/* Header gọn */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">Tiến Độ Báo Cáo</span>
                </h3>

                <button
                  type="button"
                  onClick={onNavigateToEntry}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Nhập báo cáo</span>
                </button>
              </div>

              {/* Khối Xuất Excel Báo cáo (3 tầng liên hoàn Sion -> KV -> Cá nhân theo RBAC) */}
              <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-extrabold text-xs text-emerald-950 dark:text-emerald-200 truncate">
                      Xuất Excel Báo cáo
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-white/90 dark:bg-slate-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shrink-0">
                    {ROLE_DISPLAY_META[currentUser.role]?.codeBadge || 'TĐ'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                  <div className="min-w-0">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={exportPeriod}
                      onChange={(val) => setExportPeriod(val as DailyReportExportPeriod)}
                      options={[
                        { value: 'DAY', label: `Hôm nay (${todayStr.split('-').reverse().join('/')})` },
                        { value: 'MONTH', label: `Tháng ${currentMonthStr.split('-').reverse().join('/')}` },
                        { value: 'YEAR', label: `Năm ${currentYearStr}` },
                        { value: 'ALL', label: 'Tất cả' },
                      ]}
                    />
                  </div>

                  {(isAdminRole(currentUser.role) ||
                    currentUser.role === 'MANAGER' ||
                    exportScopedCompanies.length > 1) && (
                    <div className="min-w-0">
                      <CustomSelect
                        size="sm"
                        searchable={false}
                        value={exportCompanyFilter}
                        onChange={(val) => {
                          setExportCompanyFilter(val);
                          setExportAreaFilter('ALL');
                          setExportMemberFilter('ALL');
                        }}
                        options={[
                          {
                            value: 'ALL',
                            label: isAdminRole(currentUser.role) ? 'Tất cả Sion' : 'Tất cả Sion (phạm vi)',
                          },
                          ...exportScopedCompanies.map((c) => ({
                            value: c.code,
                            label: c.name || c.code,
                          })),
                        ]}
                      />
                    </div>
                  )}

                  {(isAdminRole(currentUser.role) ||
                    currentUser.role === 'MANAGER' ||
                    currentUser.role === 'SION_LEADER' ||
                    currentUser.role === 'AREA_LEADER' ||
                    exportScopedAreas.length > 1) && (
                    <div className="min-w-0">
                      <CustomSelect
                        size="sm"
                        searchable={false}
                        value={exportAreaFilter}
                        onChange={(val) => {
                          setExportAreaFilter(val);
                          setExportMemberFilter('ALL');
                        }}
                        options={[
                          { value: 'ALL', label: 'Tất cả Khu vực' },
                          ...exportScopedAreas.map((a) => ({
                            value:
                              exportCompanyFilter === 'ALL'
                                ? makeAreaScopeKey(a.companyCode, a.code)
                                : a.code,
                            label:
                              exportCompanyFilter === 'ALL'
                                ? `KV ${a.code} (${a.companyCode})`
                                : `KV ${a.code}`,
                          })),
                        ]}
                      />
                    </div>
                  )}

                  {currentUser.role !== 'MEMBER' && exportScopedMembers.length > 0 && (
                    <div className="min-w-0">
                      <CustomSelect
                        size="sm"
                        searchable
                        value={exportMemberFilter}
                        onChange={setExportMemberFilter}
                        options={[
                          {
                            value: 'ALL',
                            label: `Tất cả cá nhân (${exportScopedMembers.length})`,
                          },
                          ...exportScopedMembers.map((m) => ({
                            value: m.id,
                            label: m.fullName,
                            badge: m.areaCode ? `KV ${m.areaCode}` : m.companyCode,
                          })),
                        ]}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const weights = activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS;
                      const summary = exportDailyReportsByRbacExcel({
                        viewer: currentUser,
                        dailyReports,
                        members,
                        weights,
                        period: exportPeriod,
                        periodDate: todayStr,
                        periodMonth: currentMonthStr,
                        periodYear: currentYearStr,
                        filterCompanyCode:
                          currentUser.role !== 'MEMBER' ? exportCompanyFilter : undefined,
                        filterAreaCode:
                          currentUser.role !== 'MEMBER' ? exportAreaFilter : undefined,
                        filterMemberId:
                          currentUser.role !== 'MEMBER' ? exportMemberFilter : undefined,
                      });
                      onShowNotification(
                        `Đã tải ${summary.fileName} (${summary.reportsCount} báo cáo).`
                      );
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Tải Excel</span>
                  </button>
                </div>
              </div>

              {/* Bộ chuyển kỳ + Thanh tóm tắt gọn */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="grid grid-cols-3 sm:inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  {(
                    [
                      { id: 'DAY', label: 'Hôm nay' },
                      {
                        id: 'MONTH',
                        label: `Tháng ${currentMonthStr.split('-').reverse().join('/')}`,
                      },
                      { id: 'YEAR', label: `Năm ${currentYearStr}` },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setReportPeriodMode(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer text-center truncate ${
                        reportPeriodMode === m.id
                          ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2 text-xs">
                  <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <strong className="text-amber-700 dark:text-amber-300 font-black tabular-nums">
                      {formatNumber(reportSummary.score)} đ
                    </strong>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 font-bold text-blue-700 dark:text-blue-300 text-center tabular-nums">
                    {reportSummary.daysCount} ngày • {reportSummary.overallPct}%
                  </div>
                </div>
              </div>

              {/* Bảng 7 dòng gọn (hiển thị trọn vẹn không cần scroll nhiều) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/50 dark:bg-slate-800/35">
                <div className="grid grid-cols-[90px_1fr_auto] sm:grid-cols-[130px_1fr_auto] items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100/90 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <span>Chỉ số</span>
                  <span>Tiến độ KQ / MT</span>
                  <span className="text-right">Đạt</span>
                </div>

                <div className="divide-y divide-slate-200/80 dark:divide-slate-700/70">
                  {DAILY_METRIC_DEFINITIONS.map((metric) => {
                    const goalVal = reportSummary.goals[metric.key] || 0;
                    const resVal = reportSummary.results[metric.key] || 0;
                    const percent =
                      goalVal > 0
                        ? Math.min(100, Math.round((resVal / goalVal) * 100))
                        : resVal > 0
                        ? 100
                        : 0;

                    return (
                      <div
                        key={metric.key}
                        className="grid grid-cols-[90px_1fr_auto] sm:grid-cols-[130px_1fr_auto] items-center gap-2 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${metric.dotColor}`} />
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {metric.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                            <strong className="text-slate-900 dark:text-white">{resVal}</strong>/{goalVal}
                          </span>
                        </div>

                        <span
                          className={`text-xs font-black tabular-nums w-10 text-right ${metric.colorClass}`}
                        >
                          {percent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: THÔNG TIN & CƠ CẤU */}
          {activeProfileTab === 'ABOUT' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-5 animate-in fade-in">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Thông Tin Tài Khoản &amp; Cơ Cấu Đơn Vị
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Họ và Tên
                  </div>
                  <div className="font-black text-sm text-slate-900 dark:text-white">
                    {currentUser.fullName}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    @{currentUser.username} • {currentUser.email}
                  </div>
                  <div className="pt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        currentUser.emailVerified
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {currentUser.emailVerified ? 'Đã xác thực email' : 'Chưa xác thực email'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Vai trò hệ thống
                  </div>
                  <div className="font-black text-sm text-purple-700 dark:text-purple-300">
                    {getRoleLabel(currentUser.role)}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Mã thành viên: {currentUser.memberId || 'Chưa gắn'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Sion &amp; Khu vực sinh hoạt
                  </div>
                  <div className="font-black text-sm text-blue-700 dark:text-blue-300">
                    {currentUser.companyCode} • Khu vực {currentUser.areaCode}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Ban / Đội Uni:{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {currentUser.unitCode
                        ? `${currentUser.unitCode} (${currentUser.departmentCode})`
                        : currentUser.departmentCode}
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Hoạt động &amp; Xếp hạng
                  </div>
                  <div className="font-black text-sm text-amber-600 dark:text-amber-400">
                    {formatNumber(memberScore)} điểm • Hạng #{memberRank}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {myDisciples.length} MĐ cá nhân • {myDailyReports.length} ngày đã báo cáo
                  </div>
                </div>
              </div>

              {/* Quyền truy cập (rút gọn, bỏ mô tả thừa) */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{getRoleLabel(currentUser.role)}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/80 dark:bg-slate-900/80 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-700">
                  {isAdminRole(currentUser.role)
                    ? 'Toàn hệ thống'
                    : currentUser.role === 'MANAGER'
                    ? `Cụm ${currentUser.managedCompanyCodes?.join(', ') || currentUser.companyCode}`
                    : currentUser.role === 'SION_LEADER'
                    ? `Sion ${currentUser.managedCompanyCodes?.join(', ') || currentUser.companyCode}`
                    : currentUser.role === 'AREA_LEADER'
                    ? `KV ${
                        currentUser.managedAreaCodes?.length
                          ? currentUser.managedAreaCodes
                              .map((a) => formatAreaScopeLabel(a))
                              .filter(Boolean)
                              .join(', ')
                          : currentUser.areaCode
                      }`
                    : currentUser.role === 'UNI_LEADER'
                    ? `Uni ${currentUser.managedUnitCodes?.join(', ') || currentUser.unitCode || currentUser.departmentCode}`
                    : 'Cá nhân · Top 15'}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Đổi mật khẩu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Sửa thông tin</span>
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* ========================================================
          MODAL 1: CHỈNH SỬA THÔNG TIN CÁ NHÂN
          ======================================================== */}
      {isEditProfileModalOpen && (
        <div
          onClick={() => setIsEditProfileModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsEditProfileModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
              Chỉnh Sửa Thông Tin Cá Nhân
            </h3>

            {editError && (
              <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold rounded-xl">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên hiển thị *
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Châm ngôn sống / Lời chứng ngắn
                </label>
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Ví dụ: Nguyện làm muối của đất và ánh sáng cho trần gian."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Units: Sion/Công ty, Khu vực, Ban ngành, Đội/Uni */}
              {canEditOrgPlacement ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Sion / Công ty
                    </label>
                    <CustomSelect
                      size="sm"
                      value={editCompany}
                      onChange={(nextComp) => {
                        setEditCompany(nextComp);
                        const validAreas = areas.filter((a) => a.companyCode === nextComp);
                        if (
                          validAreas.length > 0 &&
                          !validAreas.some((a) => a.code === editArea)
                        ) {
                          setEditArea(validAreas[0].code);
                        }
                      }}
                      options={companies.map((c) => ({
                        value: c.code,
                        label: c.name,
                        badge: c.code,
                      }))}
                      ariaLabel="Chọn Sion / Công ty"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Khu vực
                    </label>
                    {areasForEditCompany.length > 0 ? (
                      <CustomSelect
                        size="sm"
                        value={editArea}
                        onChange={setEditArea}
                        options={areasForEditCompany.map((a) => ({
                          value: a.code,
                          label: formatAreaDisplayName(a.code, a.name),
                          badge: a.code,
                        }))}
                        ariaLabel="Chọn Khu vực"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editArea}
                        onChange={(e) => setEditArea(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Ban ngành
                    </label>
                    <CustomSelect
                      size="sm"
                      value={editDepartment}
                      onChange={setEditDepartment}
                      options={departments.map((d) => ({
                        value: d.code,
                        label: d.name,
                      }))}
                      ariaLabel="Chọn Ban ngành"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Đội / Uni (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={editUnitCode}
                      onChange={(e) => setEditUnitCode(e.target.value)}
                      placeholder="VD: Uni 1, Đội A..."
                      className="w-full min-h-[38px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Đơn vị trực thuộc (chỉ Admin có quyền điều chuyển)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div>
                      Sion: <strong className="text-slate-900 dark:text-white">{currentUser.companyCode || '—'}</strong>
                    </div>
                    <div>
                      Khu vực: <strong className="text-slate-900 dark:text-white">{currentUser.areaCode || '—'}</strong>
                    </div>
                    <div>
                      Ban ngành: <strong className="text-slate-900 dark:text-white">{currentUser.departmentCode || '—'}</strong>
                    </div>
                    <div>
                      Đội / Uni: <strong className="text-slate-900 dark:text-white">{currentUser.unitCode || '—'}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1B: CẬP NHẬT ẢNH ĐẠI DIỆN (AVATAR)
          ======================================================== */}
      {isAvatarModalOpen && (
        <div
          onClick={() => setIsAvatarModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Cập Nhật Ảnh Đại Diện
              </h3>
            </div>

            <div className="flex flex-col items-center justify-center pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-24 h-24 rounded-full p-1 ring-4 ring-amber-400 shadow-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
                <img
                  src={editAvatarUrl || currentUser.avatarUrl || presetAvatars[0]}
                  alt="Xem trước Avatar"
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Hình đại diện đang chọn
              </span>
            </div>

            <input
              type="file"
              ref={avatarFileInputRef}
              onChange={handleAvatarFileUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  1. Tải ảnh lên từ máy tính / điện thoại
                </label>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Chọn tệp ảnh từ thiết bị</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Hoặc chọn nhanh từ bộ avatar có sẵn
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {presetAvatars.map((url, i) => {
                    const selected = editAvatarUrl === url;
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setEditAvatarUrl(url)}
                        className={`group relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-150 ${
                          selected
                            ? 'border-sky-500 ring-2 ring-sky-400/50 shadow-lg scale-[1.03]'
                            : 'border-slate-200 dark:border-slate-700 hover:border-sky-300 hover:scale-[1.02]'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Avatar ${i + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-1.5 py-1 text-[9px] font-bold text-white text-center">
                          Mẫu {i + 1}
                        </div>
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 bg-sky-600 text-white rounded-full p-0.5 shadow-sm">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Hoặc dán đường dẫn (URL) ảnh
                </label>
                <input
                  type="text"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveAvatarOnly}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu ảnh đại diện</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1C: CẬP NHẬT ẢNH BÌA (COVER)
          ======================================================== */}
      {isCoverModalOpen && (
        <div
          onClick={() => setIsCoverModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsCoverModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Cập Nhật Ảnh Bìa Trang Cá Nhân
              </h3>
            </div>

            <div className="w-full h-36 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative shadow-inner mb-4">
              <img
                src={editCoverUrl || coverImage}
                alt="Xem trước ảnh bìa"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-2 left-3 text-white text-xs font-bold drop-shadow-md">
                Xem trước ảnh bìa hiện tại
              </div>
            </div>

            <input
              type="file"
              ref={coverFileInputRef}
              onChange={handleCoverFileUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  1. Tải ảnh bìa lên từ máy tính / điện thoại
                </label>
                <button
                  type="button"
                  onClick={() => coverFileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Chọn ảnh bìa từ thiết bị</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Hoặc chọn từ bộ sưu tập ảnh bìa Spotlight
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {SPOTLIGHT_COVERS.map((cover) => {
                    const selected = editCoverUrl === cover.url;
                    return (
                      <button
                        type="button"
                        key={cover.id}
                        onClick={() => setEditCoverUrl(cover.url)}
                        className={`h-20 rounded-2xl overflow-hidden cursor-pointer border-2 relative transition-all duration-150 text-left ${
                          selected
                            ? 'border-amber-500 ring-2 ring-amber-400/50 shadow-lg scale-[1.02]'
                            : 'border-slate-200 dark:border-slate-700 hover:border-amber-300'
                        }`}
                      >
                        <img
                          src={cover.url}
                          alt={cover.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full p-0.5 shadow-sm">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 py-1 text-[10px] text-white font-semibold truncate">
                          {cover.title}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Hoặc dán đường dẫn (URL) ảnh bìa riêng
                </label>
                <input
                  type="text"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCoverModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCoverOnly}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu ảnh bìa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: ĐỔI MẬT KHẨU (HỖ TRỢ DARK MODE)
          ======================================================== */}
      {isPasswordModalOpen && (
        <div
          onClick={() => setIsPasswordModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Đổi Mật Khẩu</h3>
            </div>

            {editError && (
              <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold rounded-xl">
                {editError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu mới (tối thiểu 6 ký tự) *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Xác nhận lại mật khẩu mới *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2B: ĐỔI MÃ CÁ NHÂN 6 SỐ
          ======================================================== */}
      {isPinModalOpen && (
        <div
          onClick={() => setIsPinModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsPinModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between gap-2 mb-4 pr-8">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Đổi Mã Cá Nhân 6 Số</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPinDigits((p) => !p)}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
              >
                {showPinDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPinDigits ? 'Ẩn' : 'Hiện'}</span>
              </button>
            </div>

            {pinError && (
              <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold rounded-xl">
                {pinError}
              </div>
            )}

            <form onSubmit={handleChangePinSubmit} className="space-y-3.5">
              {currentUser.pinHash && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mã PIN hiện tại (6 số) *
                  </label>
                  <input
                    type={showPinDigits ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(sanitizePinInput(e.target.value))}
                    placeholder="••••••"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-white"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mã PIN mới (6 chữ số) *
                </label>
                <input
                  type={showPinDigits ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(sanitizePinInput(e.target.value))}
                  placeholder="Ví dụ: 123456"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Xác nhận Mã PIN mới *
                </label>
                <input
                  type={showPinDigits ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(sanitizePinInput(e.target.value))}
                  placeholder="Nhập lại 6 số"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isSavingPin ? 'Đang lưu...' : 'Cập nhật Mã PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: VIẾT / SỬA NHẬT KÝ CẢM TẠ (24H) HOẶC NHẬT KÝ TURBO
          ======================================================== */}
      {isAddHuongKhiModalOpen && (
        <div
          onClick={() => {
            setIsAddHuongKhiModalOpen(false);
            setEditingTurboJournal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-7 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => {
                setIsAddHuongKhiModalOpen(false);
                setEditingTurboJournal(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 pr-8">
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  quickJournalKind === 'TURBO'
                    ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                }`}
              >
                {quickJournalKind === 'TURBO' ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {editingTurboJournal
                  ? 'Chỉnh sửa Nhật ký turbo'
                  : quickJournalKind === 'TURBO'
                  ? 'Viết Nhật ký turbo'
                  : 'Viết Nhật ký cảm tạ'}
              </h3>
            </div>

            <form onSubmit={handlePostQuickHuongKhi} className="space-y-3.5">
              {/* Chọn loại nhật ký (ẩn khi đang sửa bài Turbo) */}
              {!editingTurboJournal && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickJournalKind('GRATITUDE')}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                      quickJournalKind === 'GRATITUDE'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Nhật ký cảm tạ</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Công khai · Tự ẩn sau 24h
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickJournalKind('TURBO')}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                      quickJournalKind === 'TURBO'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-400/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Nhật ký turbo</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Riêng tư · Lưu tường cá nhân
                    </div>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  value={quickHkTitle}
                  onChange={(e) => setQuickHkTitle(e.target.value)}
                  placeholder={
                    quickJournalKind === 'TURBO'
                      ? 'Tiêu đề Nhật ký turbo...'
                      : 'Tiêu đề Nhật ký cảm tạ...'
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung *
                </label>
                <textarea
                  rows={4}
                  value={quickHkContent}
                  onChange={(e) => setQuickHkContent(e.target.value)}
                  placeholder="Viết nội dung (tự động viết tắt theo từ điển khi lưu)..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              {vocabularyConfig?.enabled !== false && journalMatches.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5 text-[11px]">
                  <div className="font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Tự động viết tắt {journalMatches.length} cụm từ:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {journalMatches.map((m) => (
                      <span
                        key={m.source}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 text-slate-700 dark:text-slate-200 font-semibold"
                      >
                        {m.source} → <strong className="text-emerald-700 dark:text-emerald-400">{m.code}</strong>
                      </span>
                    ))}
                  </div>
                  {quickHkContent.trim() && (
                    <div className="pt-1 text-slate-600 dark:text-slate-300 border-t border-emerald-200/70 dark:border-emerald-800/60">
                      <span className="font-bold">Xem trước: </span>
                      <span className="italic">{encodedPreviewContent}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddHuongKhiModalOpen(false);
                    setEditingTurboJournal(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingJournal}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                    quickJournalKind === 'TURBO'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSavingJournal
                      ? 'Đang lưu...'
                      : editingTurboJournal
                      ? 'Cập nhật'
                      : 'Lưu bài'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa Nhật ký */}
      {confirmDeletePost && (
        <div
          onClick={() => setConfirmDeletePost(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Xóa nhật ký này?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bạn muốn xóa bài <strong>&ldquo;{confirmDeletePost.title}&rdquo;</strong>? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePost(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteJournal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
