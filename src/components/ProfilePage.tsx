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
} from 'lucide-react';
import {
  UserAccount,
  Member,
  HuongKhiItem,
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
  DEFAULT_DAILY_GOALS,
  DEFAULT_EVENT_WEIGHTS,
} from '../types/edulms';
import { REACTION_CONFIG } from './NewsSection';
import { SPOTLIGHT_COVERS } from './HeroBanner';
import { sumDailyReportMetrics, computeDailyMetricsScore } from '../utils/scoringEngine';

interface ProfilePageProps {
  currentUser: UserAccount;
  memberData: Member | null;
  myHuongKhiList: HuongKhiItem[];
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
  onLogout: () => void;
  onOpenRules: () => void;
  onAddHuongKhi: (item: Omit<HuongKhiItem, 'id' | 'likesCount'>) => void;
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
  }) => void | boolean | Promise<boolean | void>;
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
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Quản trị Tổng';
    case 'ADMIN':
      return 'Ban Quản Trị';
    case 'MANAGER':
      return 'Nhà quản lý';
    case 'AREA_LEADER':
      return 'Khu vực trưởng';
    default:
      return 'Thành Viên Thi Đua';
  }
};

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  memberData,
  myHuongKhiList,
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
  onLogout,
  onOpenRules,
  onAddHuongKhi,
  onReactHuongKhi,
  onAddComment,
  onUpdateProfile,
  onShowNotification,
}) => {
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAddHuongKhiModalOpen, setIsAddHuongKhiModalOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<
    'POSTS' | 'DISCIPLES' | 'REPORTS' | 'ABOUT'
  >('POSTS');

  // Bộ lọc trong tab Danh mục MĐ của tôi
  const [discipleSearch, setDiscipleSearch] = useState('');
  const [discipleStepFilter, setDiscipleStepFilter] = useState<'ALL' | 'ACTIVE' | DiscipleProgressStep>('ALL');

  // Bộ chuyển kỳ trong tab Tiến độ Báo cáo
  const [reportPeriodMode, setReportPeriodMode] = useState<'DAY' | 'MONTH' | 'YEAR'>('MONTH');

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

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editError, setEditError] = useState('');

  // Quick In-page Add Huong Khi Form State
  const [quickHkTitle, setQuickHkTitle] = useState('');
  const [quickHkCategory, setQuickHkCategory] =
    useState<HuongKhiItem['category']>('COM_YEU_THUONG');
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
    let goals: DailyReportMetrics = { ...DEFAULT_DAILY_GOALS };

    if (reportPeriodMode === 'DAY') {
      matchedReports = myDailyReports.filter((r) => r.date === todayStr);
      const todayReport = matchedReports[0];
      if (todayReport) {
        goals = { ...EMPTY_DAILY_METRICS, ...todayReport.goals };
      } else {
        const latest = [...myDailyReports].sort((a, b) => b.date.localeCompare(a.date))[0];
        goals = latest ? { ...DEFAULT_DAILY_GOALS, ...latest.goals } : { ...DEFAULT_DAILY_GOALS };
      }
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
        : {
            kn: DEFAULT_DAILY_GOALS.kn * 25,
            tham: DEFAULT_DAILY_GOALS.tham * 20,
            gm: DEFAULT_DAILY_GOALS.gm * 15,
            dt: DEFAULT_DAILY_GOALS.dt * 20,
            hh: DEFAULT_DAILY_GOALS.hh * 20,
            kt: DEFAULT_DAILY_GOALS.kt * 25,
            wsNew: DEFAULT_DAILY_GOALS.wsNew * 4,
          };
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
        : {
            kn: DEFAULT_DAILY_GOALS.kn * 300,
            tham: DEFAULT_DAILY_GOALS.tham * 240,
            gm: DEFAULT_DAILY_GOALS.gm * 180,
            dt: DEFAULT_DAILY_GOALS.dt * 240,
            hh: DEFAULT_DAILY_GOALS.hh * 240,
            kt: DEFAULT_DAILY_GOALS.kt * 300,
            wsNew: DEFAULT_DAILY_GOALS.wsNew * 48,
          };
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

  // Dedicated Save Avatar Only
  const handleSaveAvatarOnly = async () => {
    setEditError('');
    const saved = await onUpdateProfile({
      fullName: currentUser.fullName,
      avatarUrl: editAvatarUrl.trim(),
      companyCode: currentUser.companyCode,
      areaCode: currentUser.areaCode,
      departmentCode: currentUser.departmentCode,
    });
    if (saved === false) return;
    setIsAvatarModalOpen(false);
    onShowNotification('Đã cập nhật ảnh đại diện thành công!');
  };

  // Dedicated Save Cover Only
  const handleSaveCoverOnly = async () => {
    setEditError('');
    const saved = await onUpdateProfile({
      fullName: currentUser.fullName,
      coverUrl: editCoverUrl.trim(),
      companyCode: currentUser.companyCode,
      areaCode: currentUser.areaCode,
      departmentCode: currentUser.departmentCode,
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

    const saved = await onUpdateProfile({
      fullName: editFullName.trim(),
      avatarUrl: editAvatarUrl.trim(),
      coverUrl: editCoverUrl.trim(),
      bio: editBio.trim(),
      companyCode: editCompany,
      areaCode: editArea,
      departmentCode: editDepartment,
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
    });
    if (changed === false) return;

    setIsPasswordModalOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    onShowNotification('Đã đổi mật khẩu thành công!');
  };

  const handlePostQuickHuongKhi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickHkTitle.trim() || !quickHkContent.trim()) {
      onShowNotification('Vui lòng điền đủ tiêu đề và nội dung hương khí.');
      return;
    }

    onAddHuongKhi({
      authorId: memberData?.id || currentUser.id,
      authorName: currentUser.fullName,
      authorAvatar: currentUser.avatarUrl,
      companyCode: currentUser.companyCode,
      areaCode: currentUser.areaCode,
      departmentCode: currentUser.departmentCode,
      title: quickHkTitle.trim(),
      content: quickHkContent.trim(),
      category: quickHkCategory,
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
    onShowNotification('Đã đăng câu chuyện hương khí! Bài viết đã xuất hiện trên Bản tin.');
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

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 animate-in fade-in space-y-5">
      {/* ========================================================
          1. PROFILE HEADER CARD
          ======================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Cover Photo Container */}
        <div className="relative w-full h-44 sm:h-60 md:h-72 bg-slate-950 overflow-hidden group">
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
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-black/70 hover:bg-black/90 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5 border border-white/20 cursor-pointer shadow-lg shrink-0"
            title="Đổi ảnh bìa"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold whitespace-nowrap">Đổi ảnh bìa</span>
          </button>
        </div>

        {/* Profile Info Section */}
        <div className="px-4 sm:px-8 pb-3 pt-0 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-16 sm:-mt-20 md:-mt-24 pb-5 border-b border-slate-100 dark:border-slate-800">
            {/* Avatar & User Details */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 text-center sm:text-left">
              <div className="relative group shrink-0 z-10">
                <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full bg-white dark:bg-slate-900 p-1.5 shadow-2xl ring-4 ring-amber-400/70 dark:ring-amber-500/50 relative overflow-hidden">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-700 via-indigo-700 to-amber-600 flex items-center justify-center text-white text-4xl sm:text-5xl font-black">
                      {currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN' ? (
                        <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
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
                  className="absolute bottom-1 right-1 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-md transition cursor-pointer hover:scale-105"
                  title="Cập nhật ảnh đại diện"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                </button>
              </div>

              {/* User Identity Stack */}
              <div className="pt-1 sm:pt-0 sm:pb-2 space-y-1.5">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-amber-300">
                    {currentUser.fullName}
                  </h1>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN'
                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                        : currentUser.role === 'MANAGER' || currentUser.role === 'AREA_LEADER'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                        : 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                    }`}
                  >
                    {getRoleLabel(currentUser.role)}
                  </span>
                </div>

                {/* Quick stats subtitle synced with DailyReports & Disciples */}
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="font-mono text-slate-400">@{currentUser.username}</span>
                  <span>•</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(memberScore)} điểm
                  </span>
                  <span>•</span>
                  <span>Hạng #{memberRank}</span>
                  <span>•</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {myDisciples.length} MĐ đang theo dõi
                  </span>
                  <span>•</span>
                  <span>{daysReportedThisMonth} ngày báo cáo tháng</span>
                </div>

                {/* Units Pills */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    <Building2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    Cty: <strong>{currentUser.companyCode}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    <MapPin className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    KV: <strong>{currentUser.areaCode}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    <Users2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <strong>{currentUser.departmentCode}</strong>
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 italic max-w-lg pt-0.5 leading-relaxed">
                  “{currentUser.bio || 'Nguyện làm muối của đất và ánh sáng cho trần gian.'}”
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center md:justify-end gap-2 flex-wrap pt-2 md:pt-0">
              <button
                type="button"
                onClick={() => setIsAddHuongKhiModalOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Đăng Hương Khí</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(true)}
                className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Sửa hồ sơ</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                title="Đổi mật khẩu"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Mật khẩu</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition border border-rose-200 dark:border-rose-900 cursor-pointer flex items-center gap-1"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* Profile Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pt-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setActiveProfileTab('POSTS')}
              className={`px-4 py-2.5 rounded-xl transition cursor-pointer relative shrink-0 ${
                activeProfileTab === 'POSTS'
                  ? 'text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/80 dark:bg-blue-950/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Bài viết &amp; Hương Khí ({myHuongKhiList.length})</span>
              {activeProfileTab === 'POSTS' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveProfileTab('DISCIPLES')}
              className={`px-4 py-2.5 rounded-xl transition cursor-pointer relative shrink-0 ${
                activeProfileTab === 'DISCIPLES'
                  ? 'text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/80 dark:bg-blue-950/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Danh mục MĐ của tôi ({myDisciples.length})</span>
              {activeProfileTab === 'DISCIPLES' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveProfileTab('REPORTS')}
              className={`px-4 py-2.5 rounded-xl transition cursor-pointer relative shrink-0 ${
                activeProfileTab === 'REPORTS'
                  ? 'text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/80 dark:bg-blue-950/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Tiến độ Báo cáo</span>
              {activeProfileTab === 'REPORTS' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveProfileTab('ABOUT')}
              className={`px-4 py-2.5 rounded-xl transition cursor-pointer relative shrink-0 ${
                activeProfileTab === 'ABOUT'
                  ? 'text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50/80 dark:bg-blue-950/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Thông tin &amp; Cơ cấu</span>
              {activeProfileTab === 'ABOUT' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. 2-COLUMN PROFILE CONTENT
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card: Giới thiệu */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
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
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-5 text-white shadow-md border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <span>⚡ Hoạt động thi đua</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cập nhật Báo cáo hằng ngày và quản lý sổ tay Môn Đồ cá nhân để theo sát hành trình chăm sóc.
            </p>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={onNavigateToEntry}
                className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Nhập Báo cáo hằng ngày</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToDisciples}
                className="w-full py-2.5 px-3 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Mở Trang thông tin MĐ</span>
              </button>
              <button
                type="button"
                onClick={onOpenRules}
                className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-white/10"
              >
                <span>Xem thể lệ quy đổi điểm</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-5 min-w-0">
          {/* TAB 1: BÀI VIẾT & HƯƠNG KHÍ */}
          {activeProfileTab === 'POSTS' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Post Composer */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4">
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
                    onClick={() => setIsAddHuongKhiModalOpen(true)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 text-left transition cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">
                      {currentUser.fullName} ơi, bạn có câu chuyện hương khí nào muốn chia sẻ?
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 ml-2" />
                  </button>
                </div>

                <div className="flex items-center justify-around pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickHkCategory('COM_YEU_THUONG');
                      setIsAddHuongKhiModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <span>🍲</span>
                    <span>Bữa cơm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickHkCategory('THAM_VIENG');
                      setIsAddHuongKhiModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <span>🤝</span>
                    <span>Thăm viếng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickHkCategory('LAM_CHUNG');
                      setIsAddHuongKhiModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <span>✨</span>
                    <span>Lời chứng</span>
                  </button>
                </div>
              </div>

              {/* Feed: My Huong Khi Stories */}
              {myHuongKhiList.length > 0 ? (
                <div className="space-y-4">
                  {myHuongKhiList.map((item) => {
                    const totalR = getTotalReactions(item);
                    const isCommentsOpen = expandedCommentsId === item.id;
                    const userCurrentReaction = item.userReaction
                      ? REACTION_CONFIG[item.userReaction]
                      : null;

                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
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
                            <div>
                              <div className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                                {currentUser.fullName}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <span className="font-mono">{item.date}</span>
                                <span>•</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                                  {item.category === 'COM_YEU_THUONG'
                                    ? '🍲 Bữa cơm yêu thương'
                                    : item.category === 'THAM_VIENG'
                                    ? '🤝 Thăm viếng'
                                    : '✨ Lời chứng'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {item.content}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
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
                                placeholder="Viết bình luận khích lệ..."
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
                  Bạn chưa đăng bài viết nào. Hãy chia sẻ hương thơm Đấng Christ qua nút &ldquo;Đăng Hương Khí&rdquo; ở trên!
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DANH MỤC MĐ CỦA TÔI (ĐỒNG BỘ COLLECTION disciples) */}
          {activeProfileTab === 'DISCIPLES' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Danh Mục MĐ Cá Nhân ({myDisciples.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đồng bộ trực tiếp từ Trang thông tin MĐ (sổ tay theo dõi độc lập của bạn).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onNavigateToDisciples}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <span>Quản lý MĐ chi tiết</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Tổng MĐ</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    {discipleStats.total}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60">
                  <div className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-300">
                    Đang theo dõi
                  </div>
                  <div className="text-lg font-black text-blue-700 dark:text-blue-300 mt-0.5">
                    {discipleStats.active}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-300">
                    Tới GM / KT / WS
                  </div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {discipleStats.advanced}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60">
                  <div className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-300">
                    Đã Dừng
                  </div>
                  <div className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5">
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
                <select
                  value={discipleStepFilter}
                  onChange={(e) => setDiscipleStepFilter(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang theo dõi (chưa Dừng)</option>
                  {DISCIPLE_PROGRESS_STEPS.map((st) => (
                    <option key={st.key} value={st.key}>
                      Bước: {st.label}
                    </option>
                  ))}
                </select>
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
                      ? 'Bạn chưa thêm Môn đồ nào trong Trang thông tin MĐ.'
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

          {/* TAB 3: TIẾN ĐỘ BÁO CÁO (ĐỒNG BỘ 7 CHỈ SỐ DAILY REPORTS & PERIOD GOALS) */}
          {activeProfileTab === 'REPORTS' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>Tiến Độ Báo Cáo Hằng Ngày</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tổng hợp tự động 7 chỉ số từ Báo cáo hằng ngày so với Mục tiêu kỳ.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onNavigateToEntry}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Mở Báo cáo hằng ngày</span>
                </button>
              </div>

              {/* Period Mode Switcher + Summary Score */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        reportPeriodMode === m.id
                          ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold text-amber-900 dark:text-amber-200">
                      Quy đổi:
                    </span>
                    <strong className="text-amber-700 dark:text-amber-300 font-black">
                      {formatNumber(reportSummary.score)} điểm
                    </strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 font-bold text-blue-700 dark:text-blue-300">
                    {reportSummary.daysCount} ngày nhập • {reportSummary.overallPct}%
                  </div>
                </div>
              </div>

              {/* 7 Metric Progress Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {DAILY_METRIC_DEFINITIONS.map((metric) => {
                  const goalVal = reportSummary.goals[metric.key] || 0;
                  const resVal = reportSummary.results[metric.key] || 0;
                  const percent =
                    goalVal > 0 ? Math.min(100, Math.round((resVal / goalVal) * 100)) : resVal > 0 ? 100 : 0;

                  return (
                    <div
                      key={metric.key}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${metric.dotColor}`} />
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                            {metric.label}
                          </span>
                        </div>
                        <span className={`text-xs font-black ${metric.colorClass}`}>{percent}%</span>
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span>
                          Kết quả:{' '}
                          <strong className="text-slate-900 dark:text-white">{resVal}</strong>
                        </span>
                        <span>
                          Mục tiêu:{' '}
                          <strong className="text-slate-900 dark:text-white">{goalVal}</strong>
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
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
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dữ liệu định danh thành viên trong hệ thống Hành Thực Lục
                </p>
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
                    Công ty &amp; Khu vực sinh hoạt
                  </div>
                  <div className="font-black text-sm text-blue-700 dark:text-blue-300">
                    {currentUser.companyCode} • Khu vực {currentUser.areaCode}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Ban ngành: {currentUser.departmentCode}
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

              {/* Phạm vi quản lý cho Khu vực trưởng / Nhà quản lý */}
              {(currentUser.role === 'MANAGER' || currentUser.role === 'AREA_LEADER') && (
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2 text-xs">
                  <div className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Phạm vi phụ trách &amp; Hỗ trợ theo dõi MĐ</span>
                  </div>
                  {currentUser.role === 'AREA_LEADER' ? (
                    <p className="text-amber-800 dark:text-amber-300">
                      Phụ trách Khu vực <strong>{currentUser.areaCode}</strong> thuộc Công ty{' '}
                      <strong>{currentUser.companyCode}</strong>.
                    </p>
                  ) : (
                    <div className="space-y-1 text-amber-800 dark:text-amber-300">
                      <div>
                        Công ty quản lý:{' '}
                        <strong>
                          {currentUser.managedCompanyCodes?.length
                            ? currentUser.managedCompanyCodes.join(', ')
                            : 'Chưa gán'}
                        </strong>
                      </div>
                      <div>
                        Khu vực quản lý:{' '}
                        <strong>
                          {currentUser.managedAreaCodes?.length
                            ? currentUser.managedAreaCodes.join(', ')
                            : 'Chưa gán'}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              Chỉnh Sửa Thông Tin Cá Nhân
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Cập nhật tên hiển thị, châm ngôn sống và đơn vị công tác. Thay đổi công ty/khu vực sẽ tự đồng bộ sang danh sách MĐ của bạn.
            </p>

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

              {/* Units: Công ty, Khu vực (select lọc theo Công ty), Ban ngành */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Công ty
                  </label>
                  <select
                    value={editCompany}
                    onChange={(e) => {
                      const nextComp = e.target.value;
                      setEditCompany(nextComp);
                      const validAreas = areas.filter((a) => a.companyCode === nextComp);
                      if (
                        validAreas.length > 0 &&
                        !validAreas.some((a) => a.code === editArea)
                      ) {
                        setEditArea(validAreas[0].code);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {companies.map((c) => (
                      <option key={c.id || c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Khu vực
                  </label>
                  {areasForEditCompany.length > 0 ? (
                    <select
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      {areasForEditCompany.map((a) => (
                        <option key={a.id || `${a.companyCode}_${a.code}`} value={a.code}>
                          {a.name} ({a.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Ban ngành
                  </label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d.id || d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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

            <div className="flex items-center gap-2 mb-1">
              <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Cập Nhật Ảnh Đại Diện
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Chọn từ bộ hình có sẵn hoặc tải ảnh mới từ máy tính / điện thoại (tự tối ưu dung lượng).
            </p>

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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {presetAvatars.map((url, i) => (
                    <div
                      key={i}
                      onClick={() => setEditAvatarUrl(url)}
                      className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition hover:scale-105 ${
                        editAvatarUrl === url
                          ? 'border-blue-600 ring-2 ring-blue-400 shadow-md scale-105'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Avatar ${i + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {editAvatarUrl === url && (
                        <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-0.5">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  ))}
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

            <div className="flex items-center gap-2 mb-1">
              <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Cập Nhật Ảnh Bìa Trang Cá Nhân
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Chọn từ bộ sưu tập Spotlight hoặc tải hình riêng từ thiết bị (tự tối ưu dung lượng).
            </p>

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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SPOTLIGHT_COVERS.map((cover) => (
                    <div
                      key={cover.id}
                      onClick={() => setEditCoverUrl(cover.url)}
                      className={`h-20 rounded-xl overflow-hidden cursor-pointer border-2 relative transition hover:opacity-90 ${
                        editCoverUrl === cover.url
                          ? 'border-amber-500 ring-2 ring-amber-400 shadow-md scale-102'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <img
                        src={cover.url}
                        alt={cover.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {editCoverUrl === cover.url && (
                        <div className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-0.5 text-[9px] text-white font-medium truncate">
                        {cover.title}
                      </div>
                    </div>
                  ))}
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

            <div className="flex items-center gap-2 mb-1">
              <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Đổi Mật Khẩu</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Nhập mật khẩu mới an toàn để bảo vệ tài khoản của bạn.
            </p>

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
          MODAL 3: ĐĂNG HƯƠNG KHÍ (HỖ TRỢ DARK MODE)
          ======================================================== */}
      {isAddHuongKhiModalOpen && (
        <div
          onClick={() => setIsAddHuongKhiModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsAddHuongKhiModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Đăng Hương Khí Truyền Đạo
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Chia sẻ những điều mắt thấy tai nghe, ơn phước Chúa ban qua từng bước kết bạn, thăm viếng và bữa cơm thân tình.
            </p>

            <form onSubmit={handlePostQuickHuongKhi} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Thể loại hương khí *
                </label>
                <select
                  value={quickHkCategory}
                  onChange={(e) => setQuickHkCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="COM_YEU_THUONG">🍲 Bữa cơm yêu thương mở lối</option>
                  <option value="THAM_VIENG">🤝 Thăm viếng chăm sóc</option>
                  <option value="LAM_CHUNG">✨ Lời chứng đức tin biến đổi</option>
                  <option value="GIUP_DO">❤️ Việc lành bác ái cụ thể</option>
                  <option value="CAU_NGUYEN">🙏 Cầu nguyện chữa lành &amp; giải cứu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề câu chuyện *
                </label>
                <input
                  type="text"
                  value={quickHkTitle}
                  onChange={(e) => setQuickHkTitle(e.target.value)}
                  placeholder="Ví dụ: Bữa cơm thân mật cùng gia đình người bạn mới..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung chia sẻ hương thơm Đấng Christ *
                </label>
                <textarea
                  rows={4}
                  value={quickHkContent}
                  onChange={(e) => setQuickHkContent(e.target.value)}
                  placeholder="Kể lại hoàn cảnh, cảm xúc, lời cầu nguyện và những điều Chúa đã làm..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed border border-amber-200 dark:border-amber-800/60">
                ✨ Câu chuyện của bạn sẽ xuất hiện trên mục <strong>Hương Khí Nổi Bật</strong> tại trang Bản tin Lễ hội để khích lệ đức tin cho toàn thể đội ngũ.
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddHuongKhiModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Đăng ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
