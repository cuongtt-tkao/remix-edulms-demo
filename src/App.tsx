import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocFromServer,
} from 'firebase/firestore';
import {
  useCloudCollection,
  sortHuongKhiNewestFirst,
  seedStructure,
} from './data/cloudStore';
import {
  Company,
  Area,
  Department,
  Member,
  UserAccount,
  UserRole,
  RoleAssignment,
  SystemRolesConfig,
  HuongKhiItem,
  ReactionType,
  ReactionCounts,
  HuongKhiComment,
  DailyReportMetrics,
  DailyReportRecord,
  PeriodGoalRecord,
  SystemBannerConfig,
  FestivalEvent,
  DEFAULT_EVENT_WEIGHTS,
  DiscipleRecord,
  DiscipleProgressStep,
  DiscipleAgeMode,
  DiscipleAgeRange,
  SystemScoringConfig,
  SystemAppearanceConfig,
  DEFAULT_APPEARANCE_CONFIG,
  DEFAULT_HOME_WIDGET_VISIBILITY,
  APP_FONT_OPTIONS,
  DEFAULT_HONORS_WIDGET_ORDER,
  HonorsWidgetId,
  EduWeeklyTopic,
  EduTopicAssignment,
  EduCmsProfile,
  WorkScheduleRecord,
} from './types/edulms';
import {
  rankMembers,
  computeCompanyRankings,
  computeAreaRankings,
  sumDailyReportMetrics,
  computeDailyMetricsScore,
} from './utils/scoringEngine';
import {
  canViewMemberDetail,
  filterLeaderboardByRbac,
  getVisibleKpiSummary,
  getMemberUnitCode,
} from './utils/rbac';
import {
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
} from './utils/firestoreError';

import { TopHeader, SideNavigation, MobileBottomNav, AppTab } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { KpiCards } from './components/KpiCards';
import { LeaderboardTable } from './components/LeaderboardTable';
import { PodiumTop3 } from './components/PodiumTop3';
import { RegionalStats } from './components/RegionalStats';
import { DailyReportSection } from './components/DailyReportSection';
import { DisciplesPage } from './components/DisciplesPage';
import { EventHubPage } from './components/EventHubPage';
import { EduLmsPage } from './components/EduLmsPage';
import { EduCmsPage } from './components/EduCmsPage';
import { WorkSchedulePage } from './components/WorkSchedulePage';
import { AdminPanel, AdminSectionId } from './components/AdminPanel';
import { ProfilePage } from './components/ProfilePage';
import { AuthModal, RegistrationData } from './components/AuthModal';
import { DetailModal } from './components/DetailModal';
import { RegionalDetailModal } from './components/RegionalDetailModal';
import { RulesModal } from './components/RulesModal';
import { NewsSection } from './components/NewsSection';
import { Footer } from './components/Footer';
import { Shield, Lock, ArrowRight, Calendar, Award, Users, Sliders } from 'lucide-react';
import {
  auth,
  db,
  onAuthStateChanged,
  FirebaseUser,
  logOutFirebase,
  registerWithEmail,
  changeCurrentPassword,
  describeAuthError,
  BOOTSTRAP_SUPER_ADMIN_EMAILS,
  isBootstrapSuperAdminEmail,
} from './firebase';

export default function App() {
  // ---------- Đăng nhập (Firebase Authentication) ----------
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [profileState, setProfileState] = useState<'UNKNOWN' | 'READY' | 'MISSING'>('UNKNOWN');
  const pendingRegistrationRef = useRef<RegistrationData | null>(null);
  const creatingProfileRef = useRef<boolean>(false);
  const welcomedUidRef = useRef<string | null>(null);
  const signedIn = !!firebaseUser;

  // ---------- Toast ----------
  const [notification, setNotification] = useState<string | null>(null);
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // ---------- Dữ liệu dùng chung (Cloud Firestore) ----------
  const reportError = useCallback((msg: string) => showNotification(msg), [showNotification]);
  const [companies, setCompanies] = useCloudCollection<Company>('companies', {
    enabled: signedIn,
    ordered: true,
    onError: reportError,
  });
  const [areas, setAreas] = useCloudCollection<Area>('areas', {
    enabled: signedIn,
    ordered: true,
    onError: reportError,
  });
  const [departments, setDepartments] = useCloudCollection<Department>('departments', {
    enabled: signedIn,
    ordered: true,
    onError: reportError,
  });
  const [members, setMembers] = useCloudCollection<Member>('members', {
    enabled: signedIn,
    onError: reportError,
  });
  const [huongKhiList, setHuongKhiList] = useCloudCollection<HuongKhiItem>('huongKhi', {
    enabled: signedIn,
    sort: sortHuongKhiNewestFirst,
    onError: reportError,
  });
  const [events] = useCloudCollection<FestivalEvent>('events', {
    enabled: true,
    onError: reportError,
  });

  // Kiểm tra kết nối Firestore khi khởi chạy
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Banner, Điểm mặc định & Font/Bố cục Widget toàn hệ thống (công khai)
  const [bannerConfig, setBannerConfig] = useState<SystemBannerConfig | null>(null);
  const [scoringConfig, setScoringConfig] = useState<SystemScoringConfig | null>(null);
  const [appearanceConfig, setAppearanceConfig] = useState<SystemAppearanceConfig | null>(null);

  useEffect(() => {
    const unsubBanner = onSnapshot(
      doc(db, 'system_config', 'banner'),
      (snap) => {
        if (snap.exists()) {
          setBannerConfig({ ...(snap.data() as SystemBannerConfig), id: snap.id });
        } else {
          setBannerConfig(null);
        }
      },
      (err) => console.warn('[Firestore] Lỗi đọc system_config/banner:', err)
    );
    const unsubScoring = onSnapshot(
      doc(db, 'system_config', 'scoring'),
      (snap) => {
        if (snap.exists()) {
          setScoringConfig({ ...(snap.data() as SystemScoringConfig), id: snap.id });
        } else {
          setScoringConfig(null);
        }
      },
      (err) => console.warn('[Firestore] Lỗi đọc system_config/scoring:', err)
    );
    const unsubAppearance = onSnapshot(
      doc(db, 'system_config', 'appearance'),
      (snap) => {
        if (snap.exists()) {
          setAppearanceConfig({ ...(snap.data() as SystemAppearanceConfig), id: snap.id });
        } else {
          setAppearanceConfig(null);
        }
      },
      (err) => console.warn('[Firestore] Lỗi đọc system_config/appearance:', err)
    );
    return () => {
      unsubBanner();
      unsubScoring();
      unsubAppearance();
    };
  }, []);

  // Áp dụng Font chữ & Cỡ chữ toàn website theo cấu hình Admin
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const activeFontKey = appearanceConfig?.fontKey || DEFAULT_APPEARANCE_CONFIG.fontKey;
    const activeScale = appearanceConfig?.fontScale || DEFAULT_APPEARANCE_CONFIG.fontScale;
    const fontMeta =
      APP_FONT_OPTIONS.find((f) => f.key === activeFontKey) || APP_FONT_OPTIONS[0];
    document.documentElement.style.setProperty('--app-font-family', fontMeta.cssFamily);
    document.documentElement.style.setProperty(
      '--app-font-scale',
      activeScale === 'SM' ? '0.93' : activeScale === 'LG' ? '1.08' : '1'
    );
  }, [appearanceConfig]);

  // Hệ thống Edu: LMS (Chủ đề tuần & gán KV/TĐ) + CMS (Lộ trình TĐ Mới -> TĐ-II & NGV)
  const [eduTopics, setEduTopics] = useState<EduWeeklyTopic[]>([]);
  const [eduAssignments, setEduAssignments] = useState<EduTopicAssignment[]>([]);
  const [eduCmsProfiles, setEduCmsProfiles] = useState<EduCmsProfile[]>([]);
  const [eduLoading, setEduLoading] = useState<boolean>(false);
  const [cmsNavIntent, setCmsNavIntent] = useState<{
    subTab: 'PROGRESSION' | 'NGV' | 'CURRICULUM';
    topicId: string | null;
  }>({ subTab: 'PROGRESSION', topicId: null });

  useEffect(() => {
    if (!signedIn) {
      setEduTopics([]);
      setEduAssignments([]);
      setEduCmsProfiles([]);
      setEduLoading(false);
      return;
    }
    setEduLoading(true);
    const unsubTopics = onSnapshot(
      collection(db, 'edu_topics'),
      (snap) => {
        setEduTopics(
          snap.docs.map((d) => ({ ...(d.data() as Omit<EduWeeklyTopic, 'id'>), id: d.id }))
        );
        setEduLoading(false);
      },
      (err) => {
        setEduLoading(false);
        console.warn('[Firestore] Lỗi đọc edu_topics:', err);
      }
    );
    const unsubAssigns = onSnapshot(
      collection(db, 'edu_assignments'),
      (snap) => {
        setEduAssignments(
          snap.docs.map((d) => ({ ...(d.data() as Omit<EduTopicAssignment, 'id'>), id: d.id }))
        );
      },
      (err) => console.warn('[Firestore] Lỗi đọc edu_assignments:', err)
    );
    const unsubCms = onSnapshot(
      collection(db, 'edu_cms_profiles'),
      (snap) => {
        setEduCmsProfiles(
          snap.docs.map((d) => ({ ...(d.data() as Omit<EduCmsProfile, 'id'>), id: d.id }))
        );
      },
      (err) => console.warn('[Firestore] Lỗi đọc edu_cms_profiles:', err)
    );
    return () => {
      unsubTopics();
      unsubAssigns();
      unsubCms();
    };
  }, [signedIn]);

  // Báo cáo hằng ngày (tất cả người dùng đã đăng nhập đọc để tính điểm thi đua trực tiếp)
  const [dailyReports, setDailyReports] = useState<DailyReportRecord[]>([]);
  useEffect(() => {
    if (!signedIn) {
      setDailyReports([]);
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, 'dailyReports'),
      (snap) => {
        const list: DailyReportRecord[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<DailyReportRecord, 'id'>),
          id: d.id,
        }));
        setDailyReports(list);
      },
      (err) => console.warn('[Firestore] Lỗi đọc dailyReports:', err)
    );
    return unsubscribe;
  }, [signedIn]);

  // Mục tiêu Tháng / Năm của cá nhân (lọc theo uid khớp firestore.rules)
  const [periodGoals, setPeriodGoals] = useState<PeriodGoalRecord[]>([]);
  useEffect(() => {
    if (!signedIn || !firebaseUser?.uid) {
      setPeriodGoals([]);
      return;
    }
    const q = query(collection(db, 'periodGoals'), where('uid', '==', firebaseUser.uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: PeriodGoalRecord[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<PeriodGoalRecord, 'id'>),
          id: d.id,
        }));
        setPeriodGoals(list);
      },
      (err) => console.warn('[Firestore] Lỗi đọc periodGoals:', err)
    );
    return unsubscribe;
  }, [signedIn, firebaseUser?.uid]);

  // Quản lý tài khoản người dùng & Danh sách cấp quyền trước
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [preAssignedRoles, setPreAssignedRoles] = useState<RoleAssignment[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    const unsubscribe = onSnapshot(
      doc(db, 'system_config', 'roles'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SystemRolesConfig;
          if (Array.isArray(data.assignments)) {
            setPreAssignedRoles(data.assignments);
          }
        }
      },
      (err) => console.warn('[Firestore] Lỗi đọc system_config/roles:', err)
    );
    return unsubscribe;
  }, [signedIn]);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      setUsersList([]);
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserAccount[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<UserAccount, 'id'>),
          id: d.id,
        }));
        setUsersList(list);
      },
      (err) => console.warn('[Firestore] Lỗi đọc danh sách users:', err)
    );
    return unsubscribe;
  }, [currentUser?.role]);

  // Theme Dark/Light mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        localStorage.getItem('hanhthucluc_theme') || localStorage.getItem('edulms_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hanhthucluc_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hanhthucluc_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Navigation & Sidebar states
  const [activeTab, setActiveTab] = useState<AppTab>('ENTRY');
  const [adminNavTab, setAdminNavTab] = useState<AdminSectionId>('SCORING');
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Timers & Refresh
  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;
  });

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [isRegionalModalOpen, setIsRegionalModalOpen] = useState<boolean>(false);
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const getCurrentFormattedTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;
  };

  const handleRefresh = useCallback(() => {
    setLastUpdated(getCurrentFormattedTime());
    showNotification('Đã làm mới giao diện & bảng xếp hạng!');
  }, [showNotification]);

  // ---------- Chiến dịch Event hiện hành ----------
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (b.startDate || '').localeCompare(a.startDate || '');
    });
  }, [events]);

  const activeEvent = useMemo<FestivalEvent | null>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const pinnedActive = sortedEvents.find((e) => e.isActive && e.isPinned);
    if (pinnedActive) return pinnedActive;
    const ongoing = sortedEvents.find(
      (e) => e.isActive && e.startDate <= todayStr && e.endDate >= todayStr
    );
    if (ongoing) return ongoing;
    return sortedEvents.find((e) => e.isActive) || null;
  }, [sortedEvents]);

  // ---------- Điểm mặc định hệ thống & Tính điểm thi đua trực tiếp từ Báo cáo hằng ngày ----------
  const effectiveDefaultWeights = useMemo(
    () => scoringConfig?.weights || DEFAULT_EVENT_WEIGHTS,
    [scoringConfig]
  );

  const computedAllMembers = useMemo(() => {
    const weights = activeEvent?.weights || effectiveDefaultWeights;
    const reportsByMember = new Map<string, DailyReportRecord[]>();

    dailyReports.forEach((rep) => {
      if (activeEvent) {
        if (rep.date < activeEvent.startDate || rep.date > activeEvent.endDate) return;
      }
      const key = rep.memberId || `m-${rep.uid}`;
      const list = reportsByMember.get(key) || [];
      list.push(rep);
      reportsByMember.set(key, list);
    });

    return members.map((m) => {
      const mReports = reportsByMember.get(m.id) || [];
      const aggregated = sumDailyReportMetrics(mReports);
      const dailyScore = computeDailyMetricsScore(aggregated, weights);
      return {
        ...m,
        dailyResults: aggregated,
        score: dailyScore,
      };
    });
  }, [members, dailyReports, activeEvent, effectiveDefaultWeights]);

  // Thành viên đủ điều kiện dự thi Event (lọc người tham gia nếu Event bật giới hạn)
  const competingMembers = useMemo(() => {
    if (activeEvent?.restrictParticipants) {
      const allowedSet = new Set(activeEvent.participantIds || []);
      return computedAllMembers.filter((m) => allowedSet.has(m.id));
    }
    return computedAllMembers;
  }, [computedAllMembers, activeEvent]);

  const rankedMembers = useMemo(() => rankMembers(competingMembers), [competingMembers]);
  const allMembersRanked = useMemo(() => rankMembers(computedAllMembers), [computedAllMembers]);

  const companyRankings = useMemo(
    () => computeCompanyRankings(companies, rankedMembers),
    [companies, rankedMembers]
  );

  const areaRankings = useMemo(
    () => computeAreaRankings(areas, rankedMembers),
    [areas, rankedMembers]
  );

  // ---------- Theo dõi trạng thái đăng nhập ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setAuthReady(true);
      if (!u) {
        setCurrentUser(null);
        setProfileState('UNKNOWN');
        creatingProfileRef.current = false;
      }
    });
    return unsubscribe;
  }, []);

  // Đọc hồ sơ tài khoản (users/{uid})
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubscribe = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as Omit<UserAccount, 'id'>;
          const emailLower = (firebaseUser.email || raw.email || '').toLowerCase().trim();
          const preMatch = preAssignedRoles.find((p) => p.email.toLowerCase() === emailLower);
          const isSuper =
            isBootstrapSuperAdminEmail(emailLower) ||
            preMatch?.role === 'SUPER_ADMIN' ||
            raw.role === 'SUPER_ADMIN';
          const isAdmin =
            isSuper || raw.role === 'ADMIN' || preMatch?.role === 'ADMIN';
          const resolvedRole: UserRole = isSuper
            ? 'SUPER_ADMIN'
            : isAdmin
            ? 'ADMIN'
            : preMatch?.role || raw.role || 'MEMBER';

          const managedCompanyCodes =
            raw.managedCompanyCodes?.length
              ? raw.managedCompanyCodes
              : preMatch?.managedCompanyCodes || [];
          const managedAreaCodes =
            raw.managedAreaCodes?.length
              ? raw.managedAreaCodes
              : preMatch?.managedAreaCodes || [];
          const managedUnitCodes =
            raw.managedUnitCodes?.length
              ? raw.managedUnitCodes
              : preMatch?.managedUnitCodes || [];

          setCurrentUser({
            ...raw,
            id: snap.id,
            role: resolvedRole,
            managedCompanyCodes,
            managedAreaCodes,
            managedUnitCodes,
          });
          setProfileState('READY');
        } else if (!snap.metadata.fromCache) {
          setCurrentUser(null);
          setProfileState('MISSING');
        }
      },
      (err) => {
        console.error('[Firestore] Không đọc được hồ sơ:', err);
        showNotification(`Không đọc được hồ sơ tài khoản: ${err.message}`);
      }
    );
    return unsubscribe;
  }, [firebaseUser?.uid, preAssignedRoles, showNotification]);

  // Tạo hồ sơ + thành viên cho tài khoản mới
  useEffect(() => {
    if (!firebaseUser || profileState !== 'MISSING' || creatingProfileRef.current) return;
    creatingProfileRef.current = true;

    const createProfile = async () => {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const existing = await getDocFromServer(userRef);
      if (existing.exists()) return;

      const reg = pendingRegistrationRef.current;
      const email = (firebaseUser.email || reg?.email || '').trim();
      const fullName =
        reg?.fullName || firebaseUser.displayName || email.split('@')[0] || 'Thành viên mới';
      const companyCode = reg?.companyCode || companies[0]?.code || 'Th1';
      const areaCode =
        reg?.areaCode ||
        areas.find((a) => a.companyCode === companyCode)?.code ||
        areas[0]?.code ||
        '1.1';
      const departmentCode = reg?.departmentCode || departments[0]?.code || 'Thanh Niên Nam';
      const unitCode = reg?.unitCode?.trim() || undefined;
      const today = new Date().toISOString().split('T')[0];
      const memberId = `m-${firebaseUser.uid}`;
      const emailLower = email.toLowerCase();
      const preMatch = preAssignedRoles.find((p) => p.email.toLowerCase() === emailLower);
      const isSuperAdminEmail =
        isBootstrapSuperAdminEmail(emailLower) || preMatch?.role === 'SUPER_ADMIN';

      let initialRole: UserRole = 'MEMBER';
      if (isSuperAdminEmail) initialRole = 'SUPER_ADMIN';
      else if (preMatch?.role) initialRole = preMatch.role;

      const account = JSON.parse(
        JSON.stringify({
          username: reg?.username || email.split('@')[0] || `user_${Date.now()}`,
          email,
          fullName,
          role: initialRole,
          memberId,
          companyCode,
          areaCode,
          departmentCode,
          unitCode,
          managedCompanyCodes: preMatch?.managedCompanyCodes || [],
          managedAreaCodes: preMatch?.managedAreaCodes || [],
          managedUnitCodes: preMatch?.managedUnitCodes || [],
          avatarUrl: firebaseUser.photoURL || undefined,
          emailVerified: firebaseUser.emailVerified,
          createdAt: today,
        })
      );

      const member = JSON.parse(
        JSON.stringify({
          code: `MEM-${firebaseUser.uid.slice(0, 6).toUpperCase()}`,
          fullName,
          companyCode,
          areaCode,
          departmentCode,
          unitCode,
          active: true,
          score: 0,
          avatarUrl: firebaseUser.photoURL || undefined,
          goals: { s1: 10, s2: 8, s3: 5, s4: 4, s5: 4, s6: 2 },
          results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
          targets: [],
          createdAt: today,
        })
      );

      const batch = writeBatch(db);
      batch.set(userRef, account);
      batch.set(doc(db, 'members', memberId), member);
      await batch.commit();

      pendingRegistrationRef.current = null;
      setActiveTab('ENTRY');
      if (reg) {
        showNotification(
          'Đăng ký thành công! Thư xác thực đã được gửi tới email của bạn (kiểm tra cả mục Spam).'
        );
      }
    };

    createProfile().catch((err) => {
      console.error('[Firestore] Không tạo được hồ sơ:', err);
      showNotification(`Không tạo được hồ sơ tài khoản: ${err.message}`);
      creatingProfileRef.current = false;
    });
  }, [firebaseUser, profileState, preAssignedRoles, companies, areas, departments, showNotification]);

  // Khi đăng nhập thành công -> chuyển thẳng sang trang Báo cáo hằng ngày (ENTRY)
  useEffect(() => {
    if (currentUser && welcomedUidRef.current !== currentUser.id) {
      welcomedUidRef.current = currentUser.id;
      setActiveTab('ENTRY');
      showNotification(`Xin chào, ${currentUser.fullName}!`);
    }
    if (!currentUser) {
      welcomedUidRef.current = null;
    }
  }, [currentUser?.id, currentUser?.fullName, showNotification]);

  // Helper xác định quyền Super Admin & Admin
  const isSuperAdminUser = useMemo(() => {
    if (!currentUser && !firebaseUser) return false;
    const emailLower = (firebaseUser?.email || currentUser?.email || '').toLowerCase().trim();
    if (isBootstrapSuperAdminEmail(emailLower)) return true;
    if (currentUser?.role === 'SUPER_ADMIN') return true;
    if (
      preAssignedRoles.some(
        (p) => p.email.toLowerCase() === emailLower && p.role === 'SUPER_ADMIN'
      )
    ) {
      return true;
    }
    return false;
  }, [currentUser?.role, currentUser?.email, firebaseUser?.email, preAssignedRoles]);

  const isAdminUser = useMemo(() => {
    if (isSuperAdminUser) return true;
    if (!currentUser && !firebaseUser) return false;
    const emailLower = (firebaseUser?.email || currentUser?.email || '').toLowerCase().trim();
    if (currentUser?.role === 'ADMIN') return true;
    if (
      preAssignedRoles.some((p) => p.email.toLowerCase() === emailLower && p.role === 'ADMIN')
    ) {
      return true;
    }
    return false;
  }, [isSuperAdminUser, currentUser?.role, currentUser?.email, firebaseUser?.email, preAssignedRoles]);

  const effectiveCurrentUser = useMemo(() => {
    if (!currentUser) return null;
    const effectiveRole: UserRole = isSuperAdminUser
      ? 'SUPER_ADMIN'
      : isAdminUser
      ? 'ADMIN'
      : currentUser.role || 'MEMBER';
    return {
      ...currentUser,
      role: effectiveRole,
    };
  }, [currentUser, isSuperAdminUser, isAdminUser]);

  // Đồng bộ role & emailVerified lên Firestore
  useEffect(() => {
    if (!currentUser || !firebaseUser || currentUser.id !== firebaseUser.uid) return;
    const emailLower = (firebaseUser.email || currentUser.email || '').toLowerCase().trim();
    const preMatch = preAssignedRoles.find((p) => p.email.toLowerCase() === emailLower);
    const shouldBeSuper =
      isBootstrapSuperAdminEmail(emailLower) || preMatch?.role === 'SUPER_ADMIN';

    const expectedRole: UserRole = shouldBeSuper
      ? 'SUPER_ADMIN'
      : preMatch?.role
      ? preMatch.role
      : currentUser.role;

    if (currentUser.role !== expectedRole) {
      setCurrentUser((prev) => (prev ? { ...prev, role: expectedRole } : null));
    }

    const patch: Record<string, unknown> = {};
    if (shouldBeSuper && currentUser.role !== 'SUPER_ADMIN') {
      patch.role = 'SUPER_ADMIN';
    } else if (preMatch && currentUser.role === 'MEMBER' && preMatch.role !== 'MEMBER') {
      patch.role = preMatch.role;
      if (preMatch.managedCompanyCodes?.length) {
        patch.managedCompanyCodes = preMatch.managedCompanyCodes;
      }
      if (preMatch.managedAreaCodes?.length) {
        patch.managedAreaCodes = preMatch.managedAreaCodes;
      }
      if (preMatch.managedUnitCodes?.length) {
        patch.managedUnitCodes = preMatch.managedUnitCodes;
      }
    }

    if (firebaseUser.emailVerified && !currentUser.emailVerified) patch.emailVerified = true;
    if (Object.keys(patch).length > 0) {
      updateDoc(doc(db, 'users', currentUser.id), patch).catch((err) =>
        console.warn('Lỗi đồng bộ hồ sơ lên Firestore:', err)
      );
    }
  }, [currentUser?.role, currentUser?.emailVerified, firebaseUser?.emailVerified, preAssignedRoles]);

  // ---------- Trang thông tin MĐ (disciples) - Truy vấn theo cấp bậc (7 cấp) ----------
  const [disciples, setDisciples] = useState<DiscipleRecord[]>([]);
  const [disciplesLoading, setDisciplesLoading] = useState<boolean>(false);

  const managedCompKey = JSON.stringify(effectiveCurrentUser?.managedCompanyCodes || []);
  const managedAreaKey = JSON.stringify(effectiveCurrentUser?.managedAreaCodes || []);
  const managedUnitKey = JSON.stringify(effectiveCurrentUser?.managedUnitCodes || []);

  useEffect(() => {
    if (!signedIn || !firebaseUser?.uid || !effectiveCurrentUser) {
      setDisciples([]);
      setDisciplesLoading(false);
      return;
    }

    setDisciplesLoading(true);
    const uid = firebaseUser.uid;
    const role = effectiveCurrentUser.role;
    const buckets = new Map<string, Map<string, DiscipleRecord>>();
    const unsubs: Array<() => void> = [];

    const syncMerged = () => {
      const merged = new Map<string, DiscipleRecord>();
      buckets.forEach((b) => {
        b.forEach((rec, id) => merged.set(id, rec));
      });
      setDisciples(Array.from(merged.values()));
    };

    const attachQuery = (bucketKey: string, qRef: any) => {
      const unsub = onSnapshot(
        qRef,
        (snap: any) => {
          const map = new Map<string, DiscipleRecord>();
          snap.docs.forEach((d: any) => {
            map.set(d.id, { ...(d.data() as Omit<DiscipleRecord, 'id'>), id: d.id });
          });
          buckets.set(bucketKey, map);
          syncMerged();
          setDisciplesLoading(false);
        },
        (err: any) => {
          setDisciplesLoading(false);
          console.error(`[Firestore] Lỗi đọc disciples (${bucketKey}):`, err);
          showNotification(`Không đọc được danh sách MĐ (${bucketKey}): ${err.message}`);
        }
      );
      unsubs.push(unsub);
    };

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      attachQuery('all', collection(db, 'disciples'));
    } else if (role === 'MANAGER') {
      attachQuery('own', query(collection(db, 'disciples'), where('ownerUid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      compCodes.forEach((cCode) => {
        if (cCode) {
          attachQuery(
            `comp_${cCode}`,
            query(collection(db, 'disciples'), where('companyCode', '==', cCode))
          );
        }
      });
      areaCodes.forEach((aCode) => {
        if (aCode) {
          attachQuery(
            `area_${aCode}`,
            query(collection(db, 'disciples'), where('areaCode', '==', aCode))
          );
        }
      });
    } else if (role === 'SION_LEADER') {
      attachQuery('own', query(collection(db, 'disciples'), where('ownerUid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const effectiveComps = Array.from(
        new Set(
          (compCodes.length ? compCodes : [effectiveCurrentUser.companyCode]).filter(Boolean)
        )
      );
      effectiveComps.forEach((cCode) => {
        attachQuery(
          `sion_${cCode}`,
          query(collection(db, 'disciples'), where('companyCode', '==', cCode))
        );
      });
    } else if (role === 'AREA_LEADER') {
      attachQuery('own', query(collection(db, 'disciples'), where('ownerUid', '==', uid)));
      if (effectiveCurrentUser.companyCode && effectiveCurrentUser.areaCode) {
        attachQuery(
          'leader_area',
          query(
            collection(db, 'disciples'),
            where('companyCode', '==', effectiveCurrentUser.companyCode),
            where('areaCode', '==', effectiveCurrentUser.areaCode)
          )
        );
      }
    } else if (role === 'UNI_LEADER') {
      attachQuery('own', query(collection(db, 'disciples'), where('ownerUid', '==', uid)));
      const unitCodes: string[] = JSON.parse(managedUnitKey);
      const ownUnit = effectiveCurrentUser.unitCode || '';
      const effectiveUnits = Array.from(
        new Set([...unitCodes, ...(ownUnit ? [ownUnit] : [])].filter(Boolean))
      );
      if (effectiveCurrentUser.companyCode && effectiveCurrentUser.areaCode) {
        effectiveUnits.forEach((uCode) => {
          attachQuery(
            `uni_${uCode}`,
            query(
              collection(db, 'disciples'),
              where('companyCode', '==', effectiveCurrentUser.companyCode),
              where('areaCode', '==', effectiveCurrentUser.areaCode),
              where('ownerUnitCode', '==', uCode)
            )
          );
        });
      }
    } else {
      attachQuery('own', query(collection(db, 'disciples'), where('ownerUid', '==', uid)));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    signedIn,
    firebaseUser?.uid,
    effectiveCurrentUser?.role,
    effectiveCurrentUser?.companyCode,
    effectiveCurrentUser?.areaCode,
    effectiveCurrentUser?.unitCode,
    managedCompKey,
    managedAreaKey,
    managedUnitKey,
    showNotification,
  ]);

  // ---------- Lịch làm việc tuần (work_schedules) - Truy vấn theo cấp bậc (7 cấp) ----------
  const [workSchedules, setWorkSchedules] = useState<WorkScheduleRecord[]>([]);
  const [workSchedulesLoading, setWorkSchedulesLoading] = useState<boolean>(false);
  const [workSchedulesError, setWorkSchedulesError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn || !firebaseUser?.uid || !effectiveCurrentUser) {
      setWorkSchedules([]);
      setWorkSchedulesLoading(false);
      setWorkSchedulesError(null);
      return;
    }

    setWorkSchedulesLoading(true);
    setWorkSchedulesError(null);
    const uid = firebaseUser.uid;
    const role = effectiveCurrentUser.role;
    const buckets = new Map<string, Map<string, WorkScheduleRecord>>();
    const unsubs: Array<() => void> = [];

    const syncMerged = () => {
      const merged = new Map<string, WorkScheduleRecord>();
      buckets.forEach((b) => {
        b.forEach((rec, id) => merged.set(id, rec));
      });
      setWorkSchedules(Array.from(merged.values()));
    };

    const attachQuery = (bucketKey: string, qRef: any) => {
      const unsub = onSnapshot(
        qRef,
        (snap: any) => {
          const map = new Map<string, WorkScheduleRecord>();
          snap.docs.forEach((d: any) => {
            map.set(d.id, { ...(d.data() as Omit<WorkScheduleRecord, 'id'>), id: d.id });
          });
          buckets.set(bucketKey, map);
          syncMerged();
          setWorkSchedulesError(null);
          setWorkSchedulesLoading(false);
        },
        (err: any) => {
          setWorkSchedulesLoading(false);
          const msg = err?.message || String(err || 'Permission error');
          setWorkSchedulesError(`[${bucketKey}] ${msg}`);
          console.error(`[Firestore] Lỗi đọc work_schedules (${bucketKey}):`, err);
          showNotification(`Không đọc được lịch làm việc (${bucketKey}): ${msg}`);
        }
      );
      unsubs.push(unsub);
    };

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      attachQuery('all', collection(db, 'work_schedules'));
    } else if (role === 'MANAGER') {
      attachQuery('own', query(collection(db, 'work_schedules'), where('ownerUid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      compCodes.forEach((cCode) => {
        if (cCode) {
          attachQuery(
            `comp_${cCode}`,
            query(collection(db, 'work_schedules'), where('companyCode', '==', cCode))
          );
        }
      });
      areaCodes.forEach((aCode) => {
        if (aCode) {
          attachQuery(
            `area_${aCode}`,
            query(collection(db, 'work_schedules'), where('areaCode', '==', aCode))
          );
        }
      });
    } else if (role === 'SION_LEADER') {
      attachQuery('own', query(collection(db, 'work_schedules'), where('ownerUid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const effectiveComps = Array.from(
        new Set(
          (compCodes.length ? compCodes : [effectiveCurrentUser.companyCode]).filter(Boolean)
        )
      );
      effectiveComps.forEach((cCode) => {
        attachQuery(
          `sion_${cCode}`,
          query(collection(db, 'work_schedules'), where('companyCode', '==', cCode))
        );
      });
    } else if (role === 'AREA_LEADER') {
      attachQuery('own', query(collection(db, 'work_schedules'), where('ownerUid', '==', uid)));
      if (effectiveCurrentUser.companyCode && effectiveCurrentUser.areaCode) {
        attachQuery(
          'leader_area',
          query(
            collection(db, 'work_schedules'),
            where('companyCode', '==', effectiveCurrentUser.companyCode),
            where('areaCode', '==', effectiveCurrentUser.areaCode)
          )
        );
      }
    } else if (role === 'UNI_LEADER') {
      attachQuery('own', query(collection(db, 'work_schedules'), where('ownerUid', '==', uid)));
      const unitCodes: string[] = JSON.parse(managedUnitKey);
      const ownUnit = effectiveCurrentUser.unitCode || '';
      const effectiveUnits = Array.from(
        new Set([...unitCodes, ...(ownUnit ? [ownUnit] : [])].filter(Boolean))
      );
      if (effectiveCurrentUser.companyCode && effectiveCurrentUser.areaCode) {
        effectiveUnits.forEach((uCode) => {
          attachQuery(
            `uni_${uCode}`,
            query(
              collection(db, 'work_schedules'),
              where('companyCode', '==', effectiveCurrentUser.companyCode),
              where('areaCode', '==', effectiveCurrentUser.areaCode),
              where('ownerUnitCode', '==', uCode)
            )
          );
        });
      }
    } else {
      attachQuery('own', query(collection(db, 'work_schedules'), where('ownerUid', '==', uid)));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    signedIn,
    firebaseUser?.uid,
    effectiveCurrentUser?.role,
    effectiveCurrentUser?.companyCode,
    effectiveCurrentUser?.areaCode,
    effectiveCurrentUser?.unitCode,
    managedCompKey,
    managedAreaKey,
    managedUnitKey,
    showNotification,
  ]);

  const currentMemberData = useMemo(() => {
    if (!currentUser) return null;
    return (
      rankedMembers.find((m) => m.id === currentUser.memberId) ||
      allMembersRanked.find((m) => m.id === currentUser.memberId) ||
      null
    );
  }, [currentUser, rankedMembers, allMembersRanked]);

  const huongKhiView = useMemo<HuongKhiItem[]>(
    () =>
      huongKhiList.map((hk) => ({
        ...hk,
        userReaction: currentUser ? hk.userReactions?.[currentUser.id] : undefined,
      })),
    [huongKhiList, currentUser?.id]
  );

  const myHuongKhiList = useMemo(() => {
    if (!currentUser) return [];
    return huongKhiView.filter((h) => h.authorId === currentUser.memberId);
  }, [huongKhiView, currentUser]);

  const kpiData = useMemo(() => {
    const activeMembers = rankedMembers.filter((m) => m.active);
    const totalReportsInEvent = dailyReports.filter((r) => {
      if (!activeEvent) return true;
      return r.date >= activeEvent.startDate && r.date <= activeEvent.endDate;
    }).length;
    const totalPoints = activeMembers.reduce((acc, m) => acc + (m.score || 0), 0);

    return {
      totalTeams: companies.length,
      totalMembers: activeMembers.length,
      totalTargets: totalReportsInEvent,
      totalPoints,
      lastUpdated,
    };
  }, [rankedMembers, companies, dailyReports, activeEvent, lastUpdated]);

  // ---------- Áp dụng RBAC 7 cấp cho BXH, KPI, Podium & Thống kê Khu vực ----------
  const rbacLeaderboard = useMemo(
    () =>
      filterLeaderboardByRbac(
        effectiveCurrentUser,
        rankedMembers,
        companyRankings,
        areaRankings
      ),
    [effectiveCurrentUser, rankedMembers, companyRankings, areaRankings]
  );

  const rbacKpiData = useMemo(
    () =>
      getVisibleKpiSummary(
        effectiveCurrentUser,
        kpiData,
        rankedMembers,
        rbacLeaderboard.visibleCompanies,
        rbacLeaderboard.visibleAreas
      ),
    [
      effectiveCurrentUser,
      kpiData,
      rankedMembers,
      rbacLeaderboard.visibleCompanies,
      rbacLeaderboard.visibleAreas,
    ]
  );

  const handleSelectLeaderboardMember = useCallback(
    (mem: Member) => {
      if (!canViewMemberDetail(effectiveCurrentUser, mem)) {
        showNotification(
          `Quy tắc chung chỉ hiển thị Top 15. Chi tiết của "${mem.fullName}" nằm ngoài phạm vi quản lý (${rbacLeaderboard.scopeBadge}).`
        );
        return;
      }
      setSelectedMember(mem);
    },
    [effectiveCurrentUser, rbacLeaderboard.scopeBadge, showNotification]
  );

  // ---------- Lưu Báo cáo hằng ngày & Mục tiêu Tháng/Năm ----------
  const handleSaveDailyReport = async (
    date: string,
    goals: DailyReportMetrics,
    results: DailyReportMetrics
  ) => {
    if (!firebaseUser || !currentUser) return;
    const uid = firebaseUser.uid;
    const memberId = currentUser.memberId || `m-${uid}`;
    const [year, month] = date.split('-');
    const reportId = `${uid}_${date}`;
    const payload: Omit<DailyReportRecord, 'id'> = {
      uid,
      memberId,
      date,
      month: `${year}-${month}`,
      year,
      goals,
      results,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'dailyReports', reportId), payload);

    // Cập nhật tức thì tổng điểm lên document member để đồng bộ dữ liệu
    const mergedReports = [
      ...dailyReports.filter((r) => r.id !== reportId),
      { id: reportId, ...payload },
    ].filter((r) => {
      if (r.uid !== uid) return false;
      if (activeEvent) return r.date >= activeEvent.startDate && r.date <= activeEvent.endDate;
      return true;
    });
    const aggregated = sumDailyReportMetrics(mergedReports);
    const weights = activeEvent?.weights || effectiveDefaultWeights;
    const newScore = computeDailyMetricsScore(aggregated, weights);

    updateDoc(doc(db, 'members', memberId), {
      dailyResults: aggregated,
      dailyGoals: goals,
      score: newScore,
    }).catch((err) => console.warn('Cập nhật điểm member:', err));
    setLastUpdated(getCurrentFormattedTime());
  };

  const handleSavePeriodGoal = async (
    periodType: 'MONTH' | 'YEAR',
    periodKey: string,
    goals: DailyReportMetrics
  ) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const goalId = `${uid}_${periodType}_${periodKey}`;
    await setDoc(doc(db, 'periodGoals', goalId), {
      uid,
      periodType,
      periodKey,
      goals,
      updatedAt: new Date().toISOString(),
    });
  };

  // ---------- CRUD Trang thông tin MĐ (disciples) ----------
  const handleCreateDisciple = async (payload: {
    nickname: string;
    ageMode: DiscipleAgeMode;
    ageRange: DiscipleAgeRange;
    exactAge?: number | null;
    job: string;
    traits: string;
    progress: DiscipleProgressStep[];
    isStopped: boolean;
    statusNote: string;
  }) => {
    if (!firebaseUser || !effectiveCurrentUser) return;
    const now = new Date().toISOString();
    const discipleId = `disc_${firebaseUser.uid}_${Date.now()}`;
    const ownerUnitCode = (
      effectiveCurrentUser.unitCode ||
      effectiveCurrentUser.departmentCode ||
      ''
    )
      .trim()
      .slice(0, 50);
    const docBody = JSON.parse(
      JSON.stringify({
        ownerUid: firebaseUser.uid,
        ownerMemberId: effectiveCurrentUser.memberId || `m-${firebaseUser.uid}`,
        ownerName: effectiveCurrentUser.fullName.slice(0, 100),
        companyCode: effectiveCurrentUser.companyCode.slice(0, 30),
        areaCode: effectiveCurrentUser.areaCode.slice(0, 30),
        ...(ownerUnitCode ? { ownerUnitCode } : {}),
        nickname: payload.nickname.trim().slice(0, 60),
        ageMode: payload.ageMode,
        ageRange: payload.ageRange,
        exactAge: payload.exactAge ?? null,
        job: payload.job.trim().slice(0, 100),
        traits: payload.traits.trim().slice(0, 400),
        progress: payload.progress,
        isStopped: payload.isStopped,
        statusNote: payload.statusNote.trim().slice(0, 600),
        createdAt: now,
        updatedAt: now,
        updatedBy: effectiveCurrentUser.fullName.slice(0, 100),
      })
    );
    try {
      await setDoc(doc(db, 'disciples', discipleId), docBody);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `disciples/${discipleId}`);
    }
  };

  const handleUpdateDiscipleFull = async (
    disciple: DiscipleRecord,
    payload: {
      nickname: string;
      ageMode: DiscipleAgeMode;
      ageRange: DiscipleAgeRange;
      exactAge: number | null;
      job: string;
      traits: string;
      progress: DiscipleProgressStep[];
      isStopped: boolean;
      statusNote: string;
    }
  ) => {
    if (!effectiveCurrentUser) return;
    const patch = JSON.parse(
      JSON.stringify({
        nickname: payload.nickname.trim().slice(0, 60),
        ageMode: payload.ageMode,
        ageRange: payload.ageRange,
        exactAge: payload.exactAge ?? null,
        job: payload.job.trim().slice(0, 100),
        traits: payload.traits.trim().slice(0, 400),
        progress: payload.progress,
        isStopped: payload.isStopped,
        statusNote: payload.statusNote.trim().slice(0, 600),
        updatedAt: new Date().toISOString(),
        updatedBy: effectiveCurrentUser.fullName.slice(0, 100),
      })
    );
    try {
      await updateDoc(doc(db, 'disciples', disciple.id), patch);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `disciples/${disciple.id}`);
    }
  };

  const handleUpdateDiscipleProgressNote = async (
    disciple: DiscipleRecord,
    payload: {
      progress: DiscipleProgressStep[];
      isStopped: boolean;
      statusNote: string;
    }
  ) => {
    if (!effectiveCurrentUser) return;
    const patch = JSON.parse(
      JSON.stringify({
        progress: payload.progress,
        isStopped: payload.isStopped,
        statusNote: payload.statusNote.trim().slice(0, 600),
        updatedAt: new Date().toISOString(),
        updatedBy: effectiveCurrentUser.fullName.slice(0, 100),
      })
    );
    try {
      await updateDoc(doc(db, 'disciples', disciple.id), patch);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `disciples/${disciple.id}`);
    }
  };

  const handleDeleteDisciple = async (discipleId: string) => {
    try {
      await deleteDoc(doc(db, 'disciples', discipleId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `disciples/${discipleId}`);
    }
  };

  // ---------- Lịch làm việc tuần (work_schedules) CRUD ----------
  const handleSaveWorkSchedule = async (schedule: WorkScheduleRecord) => {
    if (!firebaseUser) return;
    const { id, ...rest } = schedule;
    const clean = JSON.parse(
      JSON.stringify({
        ...rest,
        ownerUid: firebaseUser.uid,
      })
    );
    try {
      await setDoc(doc(db, 'work_schedules', id), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `work_schedules/${id}`);
      throw err;
    }
  };

  const handleDeleteWorkSchedule = async (scheduleId: string) => {
    try {
      await deleteDoc(doc(db, 'work_schedules', scheduleId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `work_schedules/${scheduleId}`);
      throw err;
    }
  };

  // ---------- Quản lý Banner & Event (Admin) ----------
  const handleSaveBannerConfig = async (config: SystemBannerConfig) => {
    const clean = JSON.parse(
      JSON.stringify({
        ...config,
        updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(doc(db, 'system_config', 'banner'), clean);
  };

  const handleSaveEvent = async (ev: FestivalEvent) => {
    const { id, ...rest } = ev;
    const clean = JSON.parse(
      JSON.stringify({
        ...rest,
        createdBy: ev.createdBy || effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(doc(db, 'events', id), clean);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteDoc(doc(db, 'events', eventId));
    showNotification('Đã xóa chiến dịch Event.');
  };

  // ---------- Cấu hình Điểm mặc định & Giao diện toàn trang (Admin) ----------
  const handleSaveScoringConfig = async (weights: DailyReportMetrics) => {
    const clean = JSON.parse(
      JSON.stringify({
        weights,
        updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(doc(db, 'system_config', 'scoring'), clean);
  };

  const handleSaveAppearanceConfig = async (config: SystemAppearanceConfig) => {
    const clean = JSON.parse(
      JSON.stringify({
        fontKey: config.fontKey,
        fontScale: config.fontScale,
        widgetOrder: config.widgetOrder,
        hiddenWidgets: config.hiddenWidgets,
        homeWidgets: config.homeWidgets || DEFAULT_HOME_WIDGET_VISIBILITY,
        updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(doc(db, 'system_config', 'appearance'), clean);
  };

  // ---------- Hệ thống Edu LMS & CMS CRUD ----------
  const handleSaveEduTopic = async (topic: Omit<EduWeeklyTopic, 'id'>, existingId?: string) => {
    const id = existingId || `topic_${Date.now()}`;
    const clean = JSON.parse(JSON.stringify(topic));
    await setDoc(doc(db, 'edu_topics', id), clean);
  };

  const handleDeleteEduTopic = async (topicId: string) => {
    await deleteDoc(doc(db, 'edu_topics', topicId));
  };

  const handleSaveTopicCurriculum = async (topic: EduWeeklyTopic) => {
    const { id, ...rest } = topic;
    const clean = JSON.parse(JSON.stringify(rest));
    await setDoc(doc(db, 'edu_topics', id), clean);
  };

  const handleSaveEduAssignment = async (
    assignment: Omit<EduTopicAssignment, 'id'>,
    existingId?: string
  ) => {
    const id = existingId || `asg_${firebaseUser?.uid || 'u'}_${Date.now()}`;
    const clean = JSON.parse(JSON.stringify(assignment));
    await setDoc(doc(db, 'edu_assignments', id), clean);
  };

  const handleDeleteEduAssignment = async (assignmentId: string) => {
    await deleteDoc(doc(db, 'edu_assignments', assignmentId));
  };

  const handleSaveEduCmsProfile = async (
    profile: Omit<EduCmsProfile, 'id'>,
    existingId?: string
  ) => {
    const id = existingId || `cms_${firebaseUser?.uid || 'u'}_${Date.now()}`;
    const clean = JSON.parse(JSON.stringify(profile));
    await setDoc(doc(db, 'edu_cms_profiles', id), clean);
  };

  const handleDeleteEduCmsProfile = async (profileId: string) => {
    await deleteDoc(doc(db, 'edu_cms_profiles', profileId));
  };

  // ---------- Quản lý vai trò người dùng (7 cấp + phạm vi Sion / Khu vực / Uni) ----------
  const handleUpdateUserRole = async (
    targetUserId: string,
    newRole: UserRole,
    targetName: string,
    scope?: {
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
    }
  ) => {
    const cleanPatch = JSON.parse(
      JSON.stringify({
        role: newRole,
        ...(scope?.managedCompanyCodes !== undefined
          ? { managedCompanyCodes: scope.managedCompanyCodes }
          : {}),
        ...(scope?.managedAreaCodes !== undefined
          ? { managedAreaCodes: scope.managedAreaCodes }
          : {}),
        ...(scope?.managedUnitCodes !== undefined
          ? { managedUnitCodes: scope.managedUnitCodes }
          : {}),
      })
    );

    setUsersList((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, ...cleanPatch } : u))
    );
    if (currentUser && currentUser.id === targetUserId) {
      setCurrentUser((prev) => (prev ? { ...prev, ...cleanPatch } : null));
    }

    try {
      await updateDoc(doc(db, 'users', targetUserId), cleanPatch);
      showNotification(`Đã cập nhật quyền cho "${targetName}" thành công!`);
    } catch (err: any) {
      console.error('[Firestore] Lỗi phân quyền:', err);
      showNotification(`Lỗi phân quyền: ${err?.message || 'Không thể cập nhật quyền'}`);
    }
  };

  const handlePreAssignRole = async (
    email: string,
    role: UserRole,
    note?: string,
    scope?: {
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
    }
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const newAssignment: RoleAssignment = JSON.parse(
      JSON.stringify({
        email: cleanEmail,
        role,
        grantedBy: currentUser?.fullName || 'Quản trị viên tổng',
        grantedAt: new Date().toISOString().split('T')[0],
        note: note || undefined,
        managedCompanyCodes: scope?.managedCompanyCodes,
        managedAreaCodes: scope?.managedAreaCodes,
        managedUnitCodes: scope?.managedUnitCodes,
      })
    );

    const updated = preAssignedRoles.filter((a) => a.email.toLowerCase() !== cleanEmail);
    updated.push(newAssignment);
    setPreAssignedRoles(updated);

    const target = usersList.find((u) => (u.email || '').toLowerCase().trim() === cleanEmail);
    if (target) {
      const targetPatch = JSON.parse(
        JSON.stringify({
          role,
          ...(scope?.managedCompanyCodes !== undefined
            ? { managedCompanyCodes: scope.managedCompanyCodes }
            : {}),
          ...(scope?.managedAreaCodes !== undefined
            ? { managedAreaCodes: scope.managedAreaCodes }
            : {}),
          ...(scope?.managedUnitCodes !== undefined
            ? { managedUnitCodes: scope.managedUnitCodes }
            : {}),
        })
      );
      setUsersList((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, ...targetPatch } : u))
      );
      updateDoc(doc(db, 'users', target.id), targetPatch).catch((e) =>
        console.warn('Lỗi phân quyền trực tiếp:', e)
      );
    }

    const superAdmins = Array.from(
      new Set([
        ...BOOTSTRAP_SUPER_ADMIN_EMAILS,
        ...updated.filter((a) => a.role === 'SUPER_ADMIN').map((a) => a.email.toLowerCase()),
      ])
    );

    const admins = Array.from(
      new Set(updated.filter((a) => a.role === 'ADMIN').map((a) => a.email.toLowerCase()))
    );

    try {
      await setDoc(
        doc(db, 'system_config', 'roles'),
        {
          superAdmins,
          admins,
          assignments: updated,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.fullName || 'Quản trị viên tổng',
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Lỗi ghi system_config/roles:', err);
    }
  };

  const handleDeletePreAssignedRole = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const updated = preAssignedRoles.filter((a) => a.email.toLowerCase() !== cleanEmail);

    const superAdmins = Array.from(
      new Set([
        ...BOOTSTRAP_SUPER_ADMIN_EMAILS,
        ...updated.filter((a) => a.role === 'SUPER_ADMIN').map((a) => a.email.toLowerCase()),
      ])
    );

    const admins = Array.from(
      new Set(updated.filter((a) => a.role === 'ADMIN').map((a) => a.email.toLowerCase()))
    );

    try {
      await setDoc(
        doc(db, 'system_config', 'roles'),
        {
          superAdmins,
          admins,
          assignments: updated,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Lỗi thu hồi quyền:', err);
    }

    setPreAssignedRoles(updated);
    showNotification(`Đã thu hồi cấp quyền trước của ${email}`);
  };

  // ---------- Đăng ký / Đăng xuất ----------
  const handleRegister = async (data: RegistrationData): Promise<void> => {
    pendingRegistrationRef.current = data;
    try {
      await registerWithEmail(data.email, data.password);
    } catch (err) {
      pendingRegistrationRef.current = null;
      throw err;
    }
  };

  const handleLogout = () => {
    logOutFirebase().catch((err) => console.warn('Firebase logout notice:', err));
    setActiveTab('HONORS');
    showNotification('Đã đăng xuất tài khoản.');
  };

  const handleUpdateProfile = async (updated: {
    fullName: string;
    avatarUrl?: string;
    coverUrl?: string;
    bio?: string;
    newPassword?: string;
    companyCode: string;
    areaCode: string;
    departmentCode: string;
    unitCode?: string;
  }): Promise<boolean> => {
    if (!currentUser) return false;

    if (updated.newPassword) {
      try {
        const result = await changeCurrentPassword(updated.newPassword);
        if (result === 'NO_PASSWORD_PROVIDER') {
          showNotification('Tài khoản này đăng nhập bằng Google nên không có mật khẩu riêng để đổi.');
          return false;
        }
        return true;
      } catch (err) {
        showNotification(describeAuthError(err));
        return false;
      }
    }

    const nextUnitCode =
      updated.unitCode !== undefined ? updated.unitCode.trim() : currentUser.unitCode || '';

    const patch = JSON.parse(
      JSON.stringify({
        fullName: updated.fullName,
        avatarUrl: updated.avatarUrl || currentUser.avatarUrl,
        coverUrl: updated.coverUrl || currentUser.coverUrl,
        bio: updated.bio !== undefined ? updated.bio : currentUser.bio,
        companyCode: updated.companyCode,
        areaCode: updated.areaCode,
        departmentCode: updated.departmentCode,
        ...(nextUnitCode ? { unitCode: nextUnitCode } : {}),
      })
    );

    try {
      // Đồng bộ nguyên tử hồ sơ tài khoản, thành viên và các MĐ của chính mình để không lệch khu vực / Uni
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', currentUser.id), patch);

      if (currentUser.memberId) {
        batch.set(
          doc(db, 'members', currentUser.memberId),
          JSON.parse(
            JSON.stringify({
              fullName: updated.fullName,
              avatarUrl: updated.avatarUrl || currentUser.avatarUrl,
              coverUrl: updated.coverUrl || currentUser.coverUrl,
              bio: updated.bio !== undefined ? updated.bio : currentUser.bio,
              companyCode: updated.companyCode,
              areaCode: updated.areaCode,
              departmentCode: updated.departmentCode,
              ...(nextUnitCode ? { unitCode: nextUnitCode } : {}),
            })
          ),
          { merge: true }
        );
      }

      const orgOrNameChanged =
        updated.companyCode !== currentUser.companyCode ||
        updated.areaCode !== currentUser.areaCode ||
        updated.fullName !== currentUser.fullName ||
        nextUnitCode !== (currentUser.unitCode || '');

      if (orgOrNameChanged) {
        const ownDisciples = disciples.filter((d) => d.ownerUid === currentUser.id);
        const syncedUnit = (nextUnitCode || updated.departmentCode || '').slice(0, 50);
        ownDisciples.slice(0, 350).forEach((d) => {
          batch.update(doc(db, 'disciples', d.id), {
            companyCode: updated.companyCode,
            areaCode: updated.areaCode,
            ...(syncedUnit ? { ownerUnitCode: syncedUnit } : {}),
            ownerName: updated.fullName,
            updatedAt: new Date().toISOString(),
          });
        });

        const ownSchedules = workSchedules.filter((w) => w.ownerUid === currentUser.id);
        ownSchedules.slice(0, 100).forEach((w) => {
          batch.update(doc(db, 'work_schedules', w.id), {
            companyCode: updated.companyCode,
            areaCode: updated.areaCode,
            ...(syncedUnit ? { ownerUnitCode: syncedUnit } : {}),
            ownerName: updated.fullName,
            updatedAt: new Date().toISOString(),
          });
        });
      }

      await batch.commit();
    } catch (err: any) {
      console.error(err);
      showNotification(`Không lưu được hồ sơ: ${err.message}`);
      return false;
    }

    return true;
  };

  // ---------- Hương Khí Handlers ----------
  const handleAddHuongKhi = (item: Omit<HuongKhiItem, 'id' | 'likesCount'>) => {
    if (!currentUser) {
      showNotification('Vui lòng đăng nhập để đăng bài hương khí.');
      return;
    }
    const newItem: HuongKhiItem = {
      ...item,
      authorId: currentUser.memberId || item.authorId,
      id: `hk-${Date.now()}`,
      likesCount: 1,
      reactions: item.reactions || {
        heart: 1,
        pray: 1,
        praise: 0,
        fire: 0,
        blessing: 0,
        like: 0,
      },
      comments: item.comments || [],
    };
    setHuongKhiList((prev) => [newItem, ...prev]);
  };

  const handleReactHuongKhi = (id: string, reaction: ReactionType) => {
    if (!currentUser) {
      showNotification('Vui lòng đăng nhập để bày tỏ cảm xúc.');
      setIsAuthModalOpen(true);
      return;
    }
    const uid = currentUser.id;

    setHuongKhiList((prev) =>
      prev.map((hk) => {
        if (hk.id !== id) return hk;

        const reactions: ReactionCounts = {
          heart: 0,
          pray: 0,
          praise: 0,
          fire: 0,
          blessing: 0,
          like: 0,
          ...(hk.reactions || {}),
        };
        const userReactions: Record<string, ReactionType> = { ...(hk.userReactions || {}) };
        const prevUserReaction = userReactions[uid];
        let likesCount = hk.likesCount;

        if (prevUserReaction === reaction) {
          reactions[reaction] = Math.max(0, (reactions[reaction] || 1) - 1);
          delete userReactions[uid];
          likesCount = Math.max(0, likesCount - 1);
        } else {
          if (prevUserReaction) {
            reactions[prevUserReaction] = Math.max(0, (reactions[prevUserReaction] || 1) - 1);
          } else {
            likesCount = Math.max(1, likesCount + 1);
          }
          reactions[reaction] = (reactions[reaction] || 0) + 1;
          userReactions[uid] = reaction;
        }

        return { ...hk, reactions, userReactions, likesCount };
      })
    );
    showNotification('Đã bày tỏ cảm xúc thành công!');
  };

  const handleAddComment = (huongKhiId: string, content: string) => {
    if (!content.trim()) return;
    if (!currentUser) {
      showNotification('Vui lòng đăng nhập để bình luận.');
      setIsAuthModalOpen(true);
      return;
    }

    const newComment: HuongKhiComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorAvatar: currentUser.avatarUrl,
      companyCode: currentUser.companyCode,
      areaCode: currentUser.areaCode,
      content: content.trim(),
      createdAt: getCurrentFormattedTime(),
    };

    setHuongKhiList((prev) =>
      prev.map((hk) => {
        if (hk.id !== huongKhiId) return hk;
        return {
          ...hk,
          comments: [...(hk.comments || []), newComment],
        };
      })
    );
    showNotification('Đã đăng bình luận khích lệ thành công!');
  };

  // Admin CRUD functions
  const handleAddCompany = (company: Omit<Company, 'id'>) => {
    setCompanies((prev) => [...prev, { ...company, id: `c-${Date.now()}` }]);
  };
  const handleUpdateCompany = (company: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? company : c)));
  };
  const handleDeleteCompany = (id: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddArea = (area: Omit<Area, 'id'>) => {
    setAreas((prev) => [...prev, { ...area, id: `a-${Date.now()}` }]);
  };
  const handleUpdateArea = (area: Area) => {
    setAreas((prev) => prev.map((a) => (a.id === area.id ? area : a)));
  };
  const handleDeleteArea = (id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddDepartment = (dept: Omit<Department, 'id'>) => {
    setDepartments((prev) => [...prev, { ...dept, id: `d-${Date.now()}` }]);
  };
  const handleUpdateDepartment = (dept: Department) => {
    setDepartments((prev) => prev.map((d) => (d.id === dept.id ? dept : d)));
  };
  const handleDeleteDepartment = (id: string) => {
    setDepartments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleAddMember = (
    member: Omit<Member, 'id' | 'code' | 'score' | 'targets' | 'createdAt'>
  ) => {
    const newMem: Member = {
      ...member,
      id: `m-${Date.now()}`,
      code: `MEM-${(members.length + 1).toString().padStart(3, '0')}`,
      score: 0,
      targets: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setMembers((prev) => [newMem, ...prev]);
  };
  const handleUpdateMember = (member: Member) => {
    setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)));
  };
  const handleDeleteMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleBatchUpdateCompanies = (newCompanies: Company[], mode: 'MERGE' | 'REPLACE' = 'MERGE') => {
    setCompanies((prev) => {
      if (mode === 'REPLACE') return newCompanies;
      const map = new Map(prev.map((c) => [c.code, c]));
      newCompanies.forEach((c) => map.set(c.code, { ...map.get(c.code), ...c }));
      return Array.from(map.values());
    });
    showNotification(`Đã đồng bộ ${newCompanies.length} công ty từ file Excel!`);
  };

  const handleBatchUpdateAreas = (newAreas: Area[], mode: 'MERGE' | 'REPLACE' = 'MERGE') => {
    setAreas((prev) => {
      if (mode === 'REPLACE') return newAreas;
      const map = new Map(prev.map((a) => [a.code, a]));
      newAreas.forEach((a) => map.set(a.code, { ...map.get(a.code), ...a }));
      return Array.from(map.values());
    });
    showNotification(`Đã đồng bộ ${newAreas.length} khu vực từ file Excel!`);
  };

  const handleBatchUpdateDepartments = (newDepts: Department[], mode: 'MERGE' | 'REPLACE' = 'MERGE') => {
    setDepartments((prev) => {
      if (mode === 'REPLACE') return newDepts;
      const map = new Map(prev.map((d) => [d.code, d]));
      newDepts.forEach((d) => map.set(d.code, { ...map.get(d.code), ...d }));
      return Array.from(map.values());
    });
    showNotification(`Đã đồng bộ ${newDepts.length} ban ngành từ file Excel!`);
  };

  const handleBatchUpdateMembers = (newMembers: Member[], mode: 'MERGE' | 'REPLACE' = 'MERGE') => {
    setMembers((prev) => {
      if (mode === 'REPLACE') return newMembers;
      const map = new Map(prev.map((m) => [m.code, m]));
      newMembers.forEach((m) => {
        const existing = map.get(m.code);
        if (existing) {
          map.set(m.code, {
            ...existing,
            ...m,
            targets: existing.targets || m.targets || [],
            score: existing.score || m.score || 0,
            results: existing.results || m.results,
          });
        } else {
          map.set(m.code, m);
        }
      });
      return Array.from(map.values());
    });
    showNotification(`Đã đồng bộ ${newMembers.length} thành viên từ file Excel!`);
  };

  const handleResetData = () => {
    seedStructure()
      .then(() => showNotification('Đã nạp danh mục mẫu (công ty, khu vực, ban ngành).'))
      .catch((err) => showNotification(`Không nạp được danh mục mẫu: ${err.message}`));
  };

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarOpen((prev) => !prev);
    } else {
      setIsMobileDrawerOpen((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f6fb] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 antialiased selection:bg-amber-200 selection:text-amber-900 transition-colors duration-300">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Minimal DB-independent Header */}
      <TopHeader
        isSidebarOpen={isDesktopSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
        onRefreshUI={handleRefresh}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onNavigateHome={() => setActiveTab('ENTRY')}
      />

      {/* Shell: Vertical Left Sidebar (3 Mục Chính) + Main Workspace */}
      <div className="flex flex-1 min-h-0">
        <SideNavigation
          isDesktopOpen={isDesktopSidebarOpen}
          isMobileOpen={isMobileDrawerOpen}
          onCloseMobile={() => setIsMobileDrawerOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={effectiveCurrentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Prompt đăng nhập nếu chưa đăng nhập */}
          {authReady && !firebaseUser && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-4">
              <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Vui lòng đăng nhập để nhập Báo cáo hằng ngày và xem Bảng xếp hạng trực tuyến.</strong>
                  <br />
                  Dữ liệu được đồng bộ an toàn trên máy chủ theo thời gian thực.
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="shrink-0 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Đăng nhập / Đăng ký
                </button>
              </div>
            </div>
          )}

          {/* TAB: BÁO CÁO HẰNG NGÀY (Trang chủ mặc định) */}
          {activeTab === 'ENTRY' && (
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full py-4 sm:py-6 flex-1">
              <DailyReportSection
                currentUser={effectiveCurrentUser}
                currentMember={currentMemberData}
                dailyReports={dailyReports}
                periodGoals={periodGoals}
                activeEvent={activeEvent}
                defaultWeights={effectiveDefaultWeights}
                appearanceConfig={appearanceConfig}
                huongKhiList={huongKhiView}
                onReactHuongKhi={handleReactHuongKhi}
                onNavigateTab={setActiveTab}
                onSaveDailyReport={handleSaveDailyReport}
                onSavePeriodGoal={handleSavePeriodGoal}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onOpenRules={() => setIsRulesModalOpen(true)}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: BẢNG VINH DANH & SỰ KIỆN (Hỗ trợ bố cục Widget 1→8 tùy biến từ Admin) */}
          {activeTab === 'HONORS' && (() => {
            const orderedIds: HonorsWidgetId[] = [
              ...(appearanceConfig?.widgetOrder || DEFAULT_HONORS_WIDGET_ORDER).filter((id) =>
                DEFAULT_HONORS_WIDGET_ORDER.includes(id)
              ),
              ...DEFAULT_HONORS_WIDGET_ORDER.filter(
                (id) => !(appearanceConfig?.widgetOrder || DEFAULT_HONORS_WIDGET_ORDER).includes(id)
              ),
            ];
            const hiddenSet = new Set<HonorsWidgetId>(appearanceConfig?.hiddenWidgets || []);
            const visibleOrdered = orderedIds.filter((id) => !hiddenSet.has(id));
            const fullIds: HonorsWidgetId[] = ['BANNER', 'KPI', 'EVENTS_STRIP'];
            const mainIds: HonorsWidgetId[] = ['LEADERBOARD', 'NEWS'];

            type HonorsRowBatch =
              | { kind: 'FULL'; id: HonorsWidgetId; overlapBanner: boolean }
              | { kind: 'COLUMNS'; items: HonorsWidgetId[] };

            const batches: HonorsRowBatch[] = [];
            let columnBuffer: HonorsWidgetId[] = [];

            visibleOrdered.forEach((id, idx) => {
              if (fullIds.includes(id)) {
                if (columnBuffer.length > 0) {
                  batches.push({ kind: 'COLUMNS', items: columnBuffer });
                  columnBuffer = [];
                }
                batches.push({
                  kind: 'FULL',
                  id,
                  overlapBanner: id === 'KPI' && idx > 0 && visibleOrdered[idx - 1] === 'BANNER',
                });
              } else {
                columnBuffer.push(id);
              }
            });
            if (columnBuffer.length > 0) {
              batches.push({ kind: 'COLUMNS', items: columnBuffer });
            }

            const renderEventsStrip = () =>
              sortedEvents.length > 0 ? (
                <div
                  key="EVENTS_STRIP"
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Chiến dịch &amp; Sự kiện thi đua ({sortedEvents.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsRulesModalOpen(true)}
                      className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Xem quy đổi điểm →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2 ${
                          activeEvent?.id === ev.id
                            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-800 dark:text-amber-300">
                              {activeEvent?.id === ev.id
                                ? 'Đang áp dụng'
                                : ev.isActive
                                ? 'Đang mở'
                                : 'Tạm ngưng'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {ev.startDate.split('-').reverse().join('/')} -{' '}
                              {ev.endDate.split('-').reverse().join('/')}
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                            {ev.title}
                          </div>
                          {ev.description && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                              {ev.description}
                            </p>
                          )}
                        </div>
                        {ev.restrictParticipants && (
                          <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{ev.participantIds?.length || 0} thành viên tham gia</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;

            const renderWidgetById = (wId: HonorsWidgetId, overlapBanner = false) => {
              switch (wId) {
                case 'BANNER':
                  return (
                    <HeroBanner
                      key="BANNER"
                      bannerConfig={bannerConfig}
                      activeEvent={activeEvent}
                      onOpenRules={() => setIsRulesModalOpen(true)}
                    />
                  );
                case 'KPI':
                  return <KpiCards key="KPI" kpi={rbacKpiData} overlapBanner={overlapBanner} />;
                case 'EVENTS_STRIP':
                  return (
                    <div
                      key="EVENTS_STRIP"
                      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full mt-6"
                    >
                      {renderEventsStrip()}
                    </div>
                  );
                case 'LEADERBOARD':
                  return (
                    <LeaderboardTable
                      key="LEADERBOARD"
                      members={rbacLeaderboard.visibleMembers}
                      companyRankings={rbacLeaderboard.visibleCompanies}
                      areaRankings={rbacLeaderboard.visibleAreas}
                      lastUpdated={lastUpdated}
                      selectedAreaCode={selectedAreaCode}
                      onSelectAreaCode={setSelectedAreaCode}
                      onSelectMember={handleSelectLeaderboardMember}
                      onOpenRules={() => setIsRulesModalOpen(true)}
                      rbacInfo={rbacLeaderboard}
                      currentMemberId={effectiveCurrentUser?.memberId}
                    />
                  );
                case 'NEWS':
                  return (
                    <NewsSection
                      key="NEWS"
                      huongKhiList={huongKhiView}
                      currentUser={effectiveCurrentUser}
                      onReactHuongKhi={handleReactHuongKhi}
                      onAddComment={handleAddComment}
                      onOpenRules={() => setIsRulesModalOpen(true)}
                    />
                  );
                case 'PODIUM':
                  return (
                    <PodiumTop3
                      key="PODIUM"
                      members={rbacLeaderboard.visibleMembers}
                      areaRankings={rbacLeaderboard.visibleAreas}
                      companyRankings={rbacLeaderboard.visibleCompanies}
                      onSelectMember={handleSelectLeaderboardMember}
                    />
                  );
                case 'REGIONAL':
                  return (
                    <RegionalStats
                      key="REGIONAL"
                      areaRankings={rbacLeaderboard.visibleAreas}
                      selectedAreaCode={selectedAreaCode}
                      onSelectAreaCode={setSelectedAreaCode}
                      onOpenDetailsModal={() => setIsRegionalModalOpen(true)}
                    />
                  );
                case 'QUICK_ACTIONS':
                  return (
                    <div
                      key="QUICK_ACTIONS"
                      className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-5 text-white shadow-md border border-slate-800 space-y-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                          <span>⚡ Thao tác nhanh</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-white mb-1">
                          Nhập Báo cáo hằng ngày
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Ghi nhận kết quả ngày để tự động tổng hợp báo cáo tháng, năm và tính điểm thi đua lễ hội.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <button
                          onClick={() => setActiveTab('ENTRY')}
                          className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <span>✏️ Mở Báo cáo hằng ngày</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('PROFILE')}
                          className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border border-white/15 cursor-pointer"
                        >
                          <span>👤 Xem Hồ sơ cá nhân</span>
                        </button>
                      </div>
                    </div>
                  );
                default:
                  return null;
              }
            };

            return (
              <div className="flex-1 pb-16">
                {isAdminUser && (
                  <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ADMIN')}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Tùy chỉnh Font &amp; Sắp xếp Widget</span>
                    </button>
                  </div>
                )}

                {visibleOrdered.length === 0 ? (
                  <div className="max-w-xl mx-auto px-4 py-14 text-center">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        Các khối trên Bảng Vinh danh đang tạm ẩn
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Quản trị viên có thể bật lại các widget hiển thị trong mục Quản trị → Giao diện.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('ENTRY')}
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Về Báo cáo hằng ngày
                        </button>
                        {isAdminUser && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('ADMIN')}
                            className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer"
                          >
                            Mở Tùy chỉnh Widget
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {batches.map((batch, batchIdx) => {
                      if (batch.kind === 'FULL') {
                        return (
                          <React.Fragment key={`${batch.id}_${batchIdx}`}>
                            {renderWidgetById(batch.id, batch.overlapBanner)}
                          </React.Fragment>
                        );
                      }

                      const mainInBatch = batch.items.filter((id) => mainIds.includes(id));
                      const sideInBatch = batch.items.filter((id) => !mainIds.includes(id));
                      const firstIsSide = !mainIds.includes(batch.items[0]);

                      return (
                        <main
                          key={`batch_${batchIdx}`}
                          className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full"
                        >
                          {mainInBatch.length > 0 && sideInBatch.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                              <div
                                className={`lg:col-span-8 space-y-6 ${
                                  firstIsSide ? 'order-2 lg:order-1' : 'order-1'
                                }`}
                              >
                                {mainInBatch.map((wId) => renderWidgetById(wId))}
                              </div>
                              <div
                                className={`lg:col-span-4 space-y-6 ${
                                  firstIsSide ? 'order-1 lg:order-2' : 'order-2'
                                }`}
                              >
                                {sideInBatch.map((wId) => renderWidgetById(wId))}
                              </div>
                            </div>
                          ) : mainInBatch.length > 0 ? (
                            <div className="space-y-6">
                              {mainInBatch.map((wId) => renderWidgetById(wId))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                              {sideInBatch.map((wId) => renderWidgetById(wId))}
                            </div>
                          )}
                        </main>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB: TRANG THÔNG TIN MĐ (Mục Turbo) */}
          {activeTab === 'DISCIPLES' && (
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full py-4 sm:py-6 flex-1">
              <DisciplesPage
                currentUser={effectiveCurrentUser}
                disciples={disciples}
                isLoading={disciplesLoading}
                companies={companies}
                areas={areas}
                onCreateDisciple={handleCreateDisciple}
                onUpdateDiscipleFull={handleUpdateDiscipleFull}
                onUpdateDiscipleProgressNote={handleUpdateDiscipleProgressNote}
                onDeleteDisciple={handleDeleteDisciple}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: TRANG EVENT (Mục Event) */}
          {activeTab === 'EVENT_HUB' && (
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full py-4 sm:py-6 flex-1">
              <EventHubPage
                events={sortedEvents}
                activeEvent={activeEvent}
                defaultWeights={effectiveDefaultWeights}
                currentUser={effectiveCurrentUser}
                currentMember={currentMemberData}
                onOpenRulesModal={() => setIsRulesModalOpen(true)}
                onNavigateToEntry={() => setActiveTab('ENTRY')}
                onNavigateToAdmin={
                  isAdminUser
                    ? () => {
                        setAdminNavTab('EVENTS');
                        setActiveTab('ADMIN');
                      }
                    : undefined
                }
              />
            </main>
          )}

          {/* TAB: EDU LMS (Mục Edu) */}
          {activeTab === 'EDU_LMS' && (
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full py-4 sm:py-6 flex-1">
              <EduLmsPage
                currentUser={effectiveCurrentUser}
                topics={eduTopics}
                assignments={eduAssignments}
                companies={companies}
                areas={areas}
                members={allMembersRanked}
                isLoading={eduLoading}
                onSaveTopic={handleSaveEduTopic}
                onDeleteTopic={handleDeleteEduTopic}
                onSaveAssignment={handleSaveEduAssignment}
                onDeleteAssignment={handleDeleteEduAssignment}
                onNavigateToCmsCurriculum={(topicId) => {
                  setCmsNavIntent({ subTab: 'CURRICULUM', topicId });
                  setActiveTab('EDU_CMS');
                }}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: EDU CMS (Mục Edu) */}
          {activeTab === 'EDU_CMS' && (
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full py-4 sm:py-6 flex-1">
              <EduCmsPage
                currentUser={effectiveCurrentUser}
                cmsProfiles={eduCmsProfiles}
                topics={eduTopics}
                companies={companies}
                areas={areas}
                initialSubTab={cmsNavIntent.subTab}
                initialTopicId={cmsNavIntent.topicId}
                onSaveCmsProfile={handleSaveEduCmsProfile}
                onDeleteCmsProfile={handleDeleteEduCmsProfile}
                onSaveTopicCurriculum={handleSaveTopicCurriculum}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: HỒ SƠ CÁ NHÂN (Mục Công Việc) */}
          {activeTab === 'PROFILE' && (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6 flex-1">
              {effectiveCurrentUser ? (
                <ProfilePage
                  currentUser={effectiveCurrentUser}
                  memberData={currentMemberData}
                  members={allMembersRanked}
                  myHuongKhiList={myHuongKhiList}
                  dailyReports={dailyReports}
                  periodGoals={periodGoals}
                  activeEvent={activeEvent}
                  defaultWeights={effectiveDefaultWeights}
                  disciples={disciples}
                  companies={companies}
                  areas={areas}
                  departments={departments}
                  onNavigateToEntry={() => setActiveTab('ENTRY')}
                  onNavigateToDisciples={() => setActiveTab('DISCIPLES')}
                  onNavigateToHonors={() => setActiveTab('HONORS')}
                  onLogout={handleLogout}
                  onOpenRules={() => setIsRulesModalOpen(true)}
                  onAddHuongKhi={handleAddHuongKhi}
                  onReactHuongKhi={handleReactHuongKhi}
                  onAddComment={handleAddComment}
                  onUpdateProfile={handleUpdateProfile}
                  onShowNotification={showNotification}
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md mx-auto text-center shadow-sm border border-slate-100 dark:border-slate-800 my-12">
                  <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
                    Chưa đăng nhập
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                    Vui lòng đăng nhập hoặc đăng ký tài khoản cá nhân để xem trang hồ sơ của bạn.
                  </p>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    Đăng nhập / Đăng ký ngay
                  </button>
                </div>
              )}
            </main>
          )}

          {/* TAB: LỊCH LÀM VIỆC TUẦN (Mục Công Việc) */}
          {activeTab === 'WORK_SCHEDULE' && (
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full py-4 sm:py-6 flex-1">
              <WorkSchedulePage
                currentUser={effectiveCurrentUser}
                workSchedules={workSchedules}
                isLoading={workSchedulesLoading}
                readError={workSchedulesError}
                members={allMembersRanked}
                companies={companies}
                areas={areas}
                onSaveWorkSchedule={handleSaveWorkSchedule}
                onDeleteWorkSchedule={handleDeleteWorkSchedule}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: TRANG QUẢN TRỊ */}
          {activeTab === 'ADMIN' && (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6 flex-1">
              {isAdminUser ? (
                <AdminPanel
                  initialTab={adminNavTab}
                  companies={companies}
                  areas={areas}
                  departments={departments}
                  members={allMembersRanked}
                  onAddCompany={handleAddCompany}
                  onUpdateCompany={handleUpdateCompany}
                  onDeleteCompany={handleDeleteCompany}
                  onAddArea={handleAddArea}
                  onUpdateArea={handleUpdateArea}
                  onDeleteArea={handleDeleteArea}
                  onAddDepartment={handleAddDepartment}
                  onUpdateDepartment={handleUpdateDepartment}
                  onDeleteDepartment={handleDeleteDepartment}
                  onAddMember={handleAddMember}
                  onUpdateMember={handleUpdateMember}
                  onDeleteMember={handleDeleteMember}
                  onBatchUpdateCompanies={handleBatchUpdateCompanies}
                  onBatchUpdateAreas={handleBatchUpdateAreas}
                  onBatchUpdateDepartments={handleBatchUpdateDepartments}
                  onBatchUpdateMembers={handleBatchUpdateMembers}
                  onResetData={handleResetData}
                  onShowNotification={showNotification}
                  currentUser={effectiveCurrentUser}
                  usersList={usersList}
                  onUpdateUserRole={handleUpdateUserRole}
                  preAssignedRoles={preAssignedRoles}
                  onPreAssignRole={handlePreAssignRole}
                  onDeletePreAssignedRole={handleDeletePreAssignedRole}
                  bannerConfig={bannerConfig}
                  events={sortedEvents}
                  onSaveBannerConfig={handleSaveBannerConfig}
                  onSaveEvent={handleSaveEvent}
                  onDeleteEvent={handleDeleteEvent}
                  scoringConfig={scoringConfig}
                  appearanceConfig={appearanceConfig}
                  activeEvent={activeEvent}
                  onSaveScoringConfig={handleSaveScoringConfig}
                  onSaveAppearanceConfig={handleSaveAppearanceConfig}
                  disciples={disciples}
                  dailyReports={dailyReports}
                  eduTopics={eduTopics}
                  eduAssignments={eduAssignments}
                  eduCmsProfiles={eduCmsProfiles}
                  workSchedules={workSchedules}
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-lg mx-auto text-center shadow-sm border border-slate-100 dark:border-slate-800 my-12">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
                    Khu vực Giới hạn Quyền
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                    Trang Quản trị yêu cầu tài khoản Ban Quản Trị hệ thống.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('ENTRY')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Về Báo cáo hằng ngày
                    </button>
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Đổi tài khoản Admin</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </main>
          )}

          {/* Footer */}
          <Footer
            onOpenRulesModal={() => setIsRulesModalOpen(true)}
            onScrollToSection={(sec) => {
              if (sec === 'leaderboard-section') setActiveTab('HONORS');
              if (sec === 'entry-section') setActiveTab('ENTRY');
              if (sec === 'admin-section') setActiveTab('ADMIN');
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        companies={companies}
        areas={areas}
        departments={departments}
        onRegister={handleRegister}
      />

      <DetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />

      <RegionalDetailModal
        isOpen={isRegionalModalOpen}
        onClose={() => setIsRegionalModalOpen(false)}
        areaRankings={rbacLeaderboard.visibleAreas}
        onSelectAreaCode={(code) => setSelectedAreaCode(code)}
      />

      <RulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        activeEvent={activeEvent}
        defaultWeights={effectiveDefaultWeights}
      />

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />
    </div>
  );
}
