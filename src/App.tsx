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
  runTransaction,
  getDocFromServer,
  deleteField,
} from 'firebase/firestore';
import {
  useCloudCollection,
  sortHuongKhiNewestFirst,
  seedStructure,
} from './data/cloudStore';
import {
  INITIAL_DEPARTMENTS,
} from './data/competitionStore';
import {
  Company,
  Area,
  Region,
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
  DEFAULT_LLV_WIDGET_VISIBILITY,
  DEFAULT_APP_LOGO_CONFIG,
  APP_FONT_OPTIONS,
  DEFAULT_HONORS_WIDGET_ORDER,
  HonorsWidgetId,
  EduWeeklyTopic,
  EduTopicAssignment,
  EduCmsProfile,
  WorkScheduleRecord,
  TurboJournalItem,
  PersonalPlannerRecord,
  SystemSecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  OrgCluster,
  SystemClustersConfig,
  SystemOrgSyncConfig,
  OrgDeleteAttachedMode,
  resolveUserApprovalStatus,
  canAccessAdminPanel,
  getRoleLevel,
} from './types/edulms';
import {
  DEFAULT_VOCABULARY_CONFIG,
  SystemVocabularyConfig,
  GRATITUDE_TTL_MS,
  encodeSensitiveText,
  isGratitudePostActive,
} from './utils/wordEncoder';
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
  isAdminRole,
  canAssignTargetRole,
  normalizeOrgCode,
  cleanRawAreaCode,
  slugifyOrgCode,
  getDefaultCompanyDisplayName,
  makeDeterministicCompanyId,
  makeDeterministicAreaId,
  normalizeDeletedAreaKey,
  parseAreaScopeEntry,
  resolveCompanyCodesFromClusterIds,
} from './utils/rbac';
import { hashPersonalPin, verifyPersonalPin, isValidPersonalPin } from './utils/pinSecurity';
import {
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
} from './utils/firestoreError';

import { TopHeader, SideNavigation, MobileBottomNav, AppTab } from './components/Navbar';
import {
  SecurityGateScreen,
  SecurityGateMode,
  OnboardingSubmitData,
} from './components/SecurityGateScreen';
import { HeroBanner } from './components/HeroBanner';
import { KpiCards } from './components/KpiCards';
import { LeaderboardTable } from './components/LeaderboardTable';
import { PodiumTop3 } from './components/PodiumTop3';
import { RegionalStats } from './components/RegionalStats';
import { DailyReportSection } from './components/DailyReportSection';
import { DisciplesPage } from './components/DisciplesPage';
import { DailyReportOverviewPage } from './components/DailyReportOverviewPage';
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
import { GratitudeCheerPage } from './components/GratitudeCheerPage';
import { Footer } from './components/Footer';
import { Shield, Lock, ArrowRight, Calendar, Award, Users, Sliders, Bell, X, AlertTriangle } from 'lucide-react';
import {
  auth,
  db,
  onAuthStateChanged,
  FirebaseUser,
  logOutFirebase,
  registerWithEmail,
  changeCurrentPassword,
  resendVerificationEmail,
  reloadCurrentAuthUser,
  describeAuthError,
  BOOTSTRAP_SUPER_ADMIN_EMAILS,
  isBootstrapSuperAdminEmail,
  FIRESTORE_DATABASE_ID,
} from './firebase';
import {
  diagnoseWriteDenied,
  logUserContext,
  setActiveDebugUserContext,
} from './utils/rulesDiagnostics';
import {
  playRegistrationChime,
  showBrowserRegistrationNotification,
} from './utils/registrationAlert';

function getAreaLeaderQueryPairs(
  compCodes: string[],
  areaCodes: string[],
  fallbackComp?: string,
  fallbackArea?: string
): Array<{ key: string; companyCode: string; areaCode: string }> {
  const effectiveComps = Array.from(
    new Set([...compCodes, ...(fallbackComp ? [fallbackComp] : [])].filter(Boolean))
  );
  const rawEntries = areaCodes.filter(Boolean);
  const pairs = new Map<string, { key: string; companyCode: string; areaCode: string }>();
  const addPair = (cCode: string, aCode: string) => {
    const cc = cCode.trim();
    const ac = aCode.trim();
    if (!cc || !ac) return;
    const key = `${cc}::${ac}`;
    if (!pairs.has(key)) pairs.set(key, { key, companyCode: cc, areaCode: ac });
  };

  if (rawEntries.length > 0) {
    rawEntries.forEach((entry) => {
      const parsed = parseAreaScopeEntry(entry);
      if (parsed.hasCompanyPrefix && parsed.rawCompanyCode && parsed.rawAreaCode) {
        addPair(parsed.rawCompanyCode, parsed.rawAreaCode);
      } else if (parsed.rawAreaCode) {
        effectiveComps.forEach((c) => addPair(c, parsed.rawAreaCode));
      }
    });
  } else if (fallbackArea) {
    effectiveComps.forEach((c) => addPair(c, fallbackArea));
  }
  return Array.from(pairs.values());
}

function areCodeListsEqual(a?: string[], b?: string[]): boolean {
  const normA = (a || []).map((x) => normalizeOrgCode(x)).filter(Boolean).sort();
  const normB = (b || []).map((x) => normalizeOrgCode(x)).filter(Boolean).sort();
  if (normA.length !== normB.length) return false;
  return normA.every((val, idx) => val === normB[idx]);
}

export default function App() {
  // ---------- Đăng nhập (Firebase Authentication) & Khóa Mã cá nhân 6 số ----------
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [profileState, setProfileState] = useState<'UNKNOWN' | 'READY' | 'MISSING' | 'ERROR'>('UNKNOWN');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetryTick, setProfileRetryTick] = useState<number>(0);
  const [pinUnlockedUid, setPinUnlockedUid] = useState<string | null>(null);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const pendingRegistrationRef = useRef<RegistrationData | null>(null);
  const creatingProfileRef = useRef<boolean>(false);
  const welcomedUidRef = useRef<string | null>(null);
  const prevAuthUidRef = useRef<string | null>(null);
  const seenPendingUidsRef = useRef<Set<string> | null>(null);
  const signedIn = !!firebaseUser;

  const currentEmailLower = (firebaseUser?.email || currentUser?.email || '').trim().toLowerCase();
  const isSelfBootstrapSuperAdmin =
    isBootstrapSuperAdminEmail(currentEmailLower) && !!firebaseUser?.emailVerified;
  const currentApprovalStatus = useMemo(() => {
    if (isSelfBootstrapSuperAdmin) return 'APPROVED' as const;
    return resolveUserApprovalStatus(currentUser);
  }, [isSelfBootstrapSuperAdmin, currentUser]);

  const securityGateMode: SecurityGateMode | null = useMemo(() => {
    if (!authReady) return 'LOADING';
    if (!signedIn) return 'UNAUTHENTICATED';
    if (profileState === 'ERROR') return 'PROFILE_ERROR';
    if (profileState === 'UNKNOWN') return 'LOADING';
    if (profileState === 'MISSING') {
      return pendingRegistrationRef.current ? 'LOADING' : 'ONBOARDING';
    }
    if (!currentUser) return 'LOADING';
    if (currentApprovalStatus === 'PENDING') return 'PENDING_APPROVAL';
    if (currentApprovalStatus === 'REJECTED') return 'REJECTED_APPROVAL';
    if (!currentUser.pinHash) return 'PIN_SETUP';
    if (pinUnlockedUid !== firebaseUser?.uid) return 'PIN_LOCKED';
    return null;
  }, [
    authReady,
    signedIn,
    profileState,
    currentUser,
    currentApprovalStatus,
    pinUnlockedUid,
    firebaseUser?.uid,
  ]);

  const dataUnlocked =
    signedIn &&
    profileState === 'READY' &&
    !!currentUser &&
    currentApprovalStatus === 'APPROVED' &&
    !!currentUser.pinHash &&
    pinUnlockedUid === firebaseUser?.uid;

  // ---------- Toast ----------
  const [notification, setNotification] = useState<string | null>(null);
  const [rulesSyncWarning, setRulesSyncWarning] = useState<string | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotification = useCallback((msg: string, durationMs = 3500) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    setNotification(msg);
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // ---------- Dữ liệu dùng chung (Cloud Firestore) ----------
  const reportError = useCallback((msg: string) => showNotification(msg), [showNotification]);
  // Danh mục Sion / Khu vực / Ban ngành tải trước để Form Đăng ký & Hoàn tất hồ sơ luôn có dropdown
  const [companies, setCompanies, companiesLoaded] = useCloudCollection<Company>('companies', {
    enabled: true,
    ordered: true,
    onError: reportError,
  });
  const [areas, setAreas, areasLoaded] = useCloudCollection<Area>('areas', {
    enabled: true,
    ordered: true,
    onError: reportError,
  });
  const [regions, setRegions] = useCloudCollection<Region>('regions', {
    enabled: dataUnlocked,
    ordered: true,
    onError: reportError,
  });
  const [departments, setDepartments] = useCloudCollection<Department>('departments', {
    enabled: true,
    ordered: true,
    onError: reportError,
  });
  const effectiveCompanies = useMemo(
    () => (companiesLoaded || companies.length > 0 ? companies : []),
    [companies, companiesLoaded]
  );
  const effectiveAreas = useMemo(
    () => (areasLoaded || areas.length > 0 ? areas : []),
    [areas, areasLoaded]
  );
  const effectiveDepartments = useMemo(
    () => (departments.length > 0 ? departments : INITIAL_DEPARTMENTS),
    [departments]
  );

  // Dữ liệu nhạy cảm chỉ tải SAU KHI đã xác thực + mở khóa Mã cá nhân 6 số
  const [members, setMembers, membersLoaded] = useCloudCollection<Member>('members', {
    enabled: dataUnlocked,
    onError: reportError,
  });
  const [huongKhiList, setHuongKhiList] = useCloudCollection<HuongKhiItem>('huongKhi', {
    enabled: dataUnlocked,
    sort: sortHuongKhiNewestFirst,
    onError: reportError,
  });
  const [events] = useCloudCollection<FestivalEvent>('events', {
    enabled: dataUnlocked,
    onError: reportError,
  });

  // Kiểm tra kết nối Firestore khi khởi chạy
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Banner, Điểm mặc định, Giao diện, Bảo mật & Từ điển mã hóa toàn hệ thống
  const [bannerConfig, setBannerConfig] = useState<SystemBannerConfig | null>(null);
  const [scoringConfig, setScoringConfig] = useState<SystemScoringConfig | null>(null);
  const [appearanceConfig, setAppearanceConfig] = useState<SystemAppearanceConfig | null>(null);
  const [securityConfig, setSecurityConfig] = useState<SystemSecurityConfig | null>(null);
  const [vocabularyConfig, setVocabularyConfig] = useState<SystemVocabularyConfig>(
    DEFAULT_VOCABULARY_CONFIG
  );
  const [clustersConfig, setClustersConfig] = useState<SystemClustersConfig | null>(null);
  const [orgSyncConfig, setOrgSyncConfig] = useState<SystemOrgSyncConfig | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const deletedCompanySet = useMemo(() => {
    const set = new Set<string>();
    (orgSyncConfig?.deletedCompanyCodes || []).forEach((code) => {
      const norm = normalizeOrgCode(code);
      if (norm) set.add(norm);
    });
    return set;
  }, [orgSyncConfig?.deletedCompanyCodes]);

  const deletedAreaKeySet = useMemo(() => {
    const set = new Set<string>();
    (orgSyncConfig?.deletedAreaKeys || []).forEach((entry) => {
      const parsed = parseAreaScopeEntry(entry);
      if (parsed.hasCompanyPrefix && parsed.companyCode && parsed.areaCode) {
        set.add(`${parsed.companyCode}::${parsed.areaCode}`);
      }
    });
    return set;
  }, [orgSyncConfig?.deletedAreaKeys]);

  const effectiveSecurityConfig = useMemo<SystemSecurityConfig>(
    () => ({
      requireRegistrationApproval:
        securityConfig?.requireRegistrationApproval ??
        DEFAULT_SECURITY_CONFIG.requireRegistrationApproval,
      autoApprovePreAssigned:
        securityConfig?.autoApprovePreAssigned ??
        DEFAULT_SECURITY_CONFIG.autoApprovePreAssigned,
      updatedAt: securityConfig?.updatedAt,
      updatedBy: securityConfig?.updatedBy,
    }),
    [securityConfig]
  );

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
    const unsubSecurity = onSnapshot(
      doc(db, 'system_config', 'security'),
      (snap) => {
        if (snap.exists()) {
          setSecurityConfig({ ...(snap.data() as SystemSecurityConfig), id: snap.id });
        } else {
          setSecurityConfig(null);
        }
      },
      (err) => console.warn('[Firestore] Lỗi đọc system_config/security:', err)
    );
    const unsubVocabulary = onSnapshot(
      doc(db, 'system_config', 'vocabulary'),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as SystemVocabularyConfig;
          setVocabularyConfig({
            id: snap.id,
            enabled: raw.enabled !== false,
            rules:
              Array.isArray(raw.rules) && raw.rules.length > 0
                ? raw.rules
                : DEFAULT_VOCABULARY_CONFIG.rules,
            updatedAt: raw.updatedAt,
            updatedBy: raw.updatedBy,
          });
        } else {
          setVocabularyConfig(DEFAULT_VOCABULARY_CONFIG);
        }
      },
      (err) => console.warn('[Firestore] Lỗi đọc system_config/vocabulary:', err)
    );
    const unsubClusters = onSnapshot(
      doc(db, 'system_config', 'clusters'),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as SystemClustersConfig;
          setClustersConfig({
            id: snap.id,
            clusters: Array.isArray(raw.clusters) ? raw.clusters : [],
            updatedAt: raw.updatedAt,
            updatedBy: raw.updatedBy,
          });
        } else {
          setClustersConfig(null);
        }
      },
      (err) => console.warn('[Firestore] Lỗi đọc system_config/clusters:', err)
    );
    const unsubOrgSync = onSnapshot(
      doc(db, 'system_config', 'org_sync'),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as SystemOrgSyncConfig;
          setOrgSyncConfig({
            id: snap.id,
            orgInitialized: Boolean(raw.orgInitialized),
            deletedCompanyCodes: Array.isArray(raw.deletedCompanyCodes)
              ? raw.deletedCompanyCodes
              : [],
            deletedAreaKeys: Array.isArray(raw.deletedAreaKeys) ? raw.deletedAreaKeys : [],
            updatedAt: raw.updatedAt,
            updatedBy: raw.updatedBy,
          });
        } else {
          setOrgSyncConfig(null);
        }
      },
      (err) => {
        console.warn('[Firestore] Lỗi đọc system_config/org_sync:', err);
      }
    );
    const expiryTimer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      clearInterval(expiryTimer);
      unsubBanner();
      unsubScoring();
      unsubAppearance();
      unsubSecurity();
      unsubVocabulary();
      unsubClusters();
      unsubOrgSync();
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

  // Báo cáo hằng ngày (chỉ tải theo đúng phạm vi RBAC sau khi mở khóa PIN)
  const [dailyReports, setDailyReports] = useState<DailyReportRecord[]>([]);

  // Mục tiêu Tháng / Năm của cá nhân (lọc theo uid khớp firestore.rules)
  const [periodGoals, setPeriodGoals] = useState<PeriodGoalRecord[]>([]);
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid) {
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
      (err) => {
        console.warn('[Firestore] Lỗi đọc periodGoals:', err);
        void logUserContext({
          queryPoint: 'periodGoals (own)',
          operation: 'LIST',
          error: err,
          uiUser: currentUser,
        });
      }
    );
    return unsubscribe;
  }, [dataUnlocked, firebaseUser?.uid]);

  // Nhật ký Turbo cá nhân (turbo_journals) - riêng tư theo authorUid
  const [turboJournals, setTurboJournals] = useState<TurboJournalItem[]>([]);
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid) {
      setTurboJournals([]);
      return;
    }
    const q = query(collection(db, 'turbo_journals'), where('authorUid', '==', firebaseUser.uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: TurboJournalItem[] = snap.docs
          .map((d) => ({ ...(d.data() as Omit<TurboJournalItem, 'id'>), id: d.id }))
          .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
        setTurboJournals(list);
      },
      (err) => {
        console.warn('[Firestore] Lỗi đọc turbo_journals:', err);
        void logUserContext({
          queryPoint: 'turbo_journals (own)',
          operation: 'LIST',
          error: err,
          uiUser: currentUser,
        });
      }
    );
    return unsubscribe;
  }, [dataUnlocked, firebaseUser?.uid]);

  // Kế hoạch LLV cá nhân theo tuần (personal_planners) - riêng tư theo ownerUid
  const [personalPlanners, setPersonalPlanners] = useState<PersonalPlannerRecord[]>([]);
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid) {
      setPersonalPlanners([]);
      return;
    }
    const q = query(collection(db, 'personal_planners'), where('ownerUid', '==', firebaseUser.uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: PersonalPlannerRecord[] = snap.docs
          .map((d) => ({ ...(d.data() as Omit<PersonalPlannerRecord, 'id'>), id: d.id }))
          .sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || ''));
        setPersonalPlanners(list);
      },
      (err) => {
        console.warn('[Firestore] Lỗi đọc personal_planners:', err);
        void logUserContext({
          queryPoint: 'personal_planners (own)',
          operation: 'LIST',
          error: err,
          uiUser: currentUser,
        });
      }
    );
    return unsubscribe;
  }, [dataUnlocked, firebaseUser?.uid]);

  // Quản lý tài khoản người dùng & Danh sách cấp quyền trước (role_claims/{emailLower} cho mọi user, system_config/roles chỉ cho Admin)
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [usersLoaded, setUsersLoaded] = useState<boolean>(false);
  const [preAssignedRoles, setPreAssignedRoles] = useState<RoleAssignment[]>([]);
  const [ownRoleClaim, setOwnRoleClaim] = useState<RoleAssignment | null>(null);

  useEffect(() => {
    const emailLower = (firebaseUser?.email || '').trim().toLowerCase();
    if (!signedIn || !emailLower || !firebaseUser?.emailVerified) {
      setOwnRoleClaim(null);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'role_claims', emailLower),
      (snap) => {
        if (snap.exists()) {
          setOwnRoleClaim(snap.data() as RoleAssignment);
        } else {
          setOwnRoleClaim(null);
        }
      },
      (err) => {
        console.warn('[Firestore] Lỗi đọc role_claims cá nhân:', err);
        void logUserContext({
          queryPoint: `role_claims/${emailLower}`,
          operation: 'GET',
          error: err,
          uiUser: currentUser,
        });
      }
    );
    return unsubscribe;
  }, [signedIn, firebaseUser?.email, firebaseUser?.emailVerified]);

  const canReadAdminRolesConfig = useMemo(() => {
    if (!signedIn || !currentUser) return false;
    const emailLower = (firebaseUser?.email || currentUser.email || '').trim().toLowerCase();
    if (firebaseUser?.emailVerified && isBootstrapSuperAdminEmail(emailLower)) return true;
    return currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';
  }, [signedIn, firebaseUser?.email, firebaseUser?.emailVerified, currentUser]);

  useEffect(() => {
    if (!canReadAdminRolesConfig) {
      setPreAssignedRoles([]);
      return;
    }
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
      (err) => {
        console.warn('[Firestore] Lỗi đọc system_config/roles:', err);
        void logUserContext({
          queryPoint: 'system_config/roles',
          operation: 'GET',
          error: err,
          uiUser: currentUser,
        });
      }
    );
    return unsubscribe;
  }, [canReadAdminRolesConfig]);

  const managedCompKeyEarly = JSON.stringify(currentUser?.managedCompanyCodes || []);
  const managedAreaKeyEarly = JSON.stringify(currentUser?.managedAreaCodes || []);
  const managedUnitKeyEarly = JSON.stringify(currentUser?.managedUnitCodes || []);

  // Listener danh sách users cho Admin / Tổng Quản trị (tách riêng để không bị reset khi đổi thông tin tổ chức)
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid || !canReadAdminRolesConfig) {
      if (!dataUnlocked || !firebaseUser?.uid) {
        setUsersList([]);
        setUsersLoaded(false);
        seenPendingUidsRef.current = null;
      }
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      { includeMetadataChanges: true },
      (snap) => {
        const list: UserAccount[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<UserAccount, 'id'>),
          id: d.id,
        }));
        setUsersList(list);
        const serverSynced = !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        if (serverSynced) setUsersLoaded(true);

        const currentPending = list
          .filter((u) => resolveUserApprovalStatus(u) === 'PENDING')
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const currentPendingSet = new Set(currentPending.map((u) => u.id));

        if (seenPendingUidsRef.current === null) {
          // Chờ snapshot xác thực từ máy chủ (hoặc nếu cache đã có dữ liệu) mới chốt mốc ban đầu
          if (serverSynced) {
            seenPendingUidsRef.current = currentPendingSet;
            if (currentPending.length > 0) {
              const first = currentPending[0];
              const extra =
                currentPending.length > 1 ? ` (+${currentPending.length - 1} khác)` : '';
              const unitLabel = first.companyCode
                ? `${first.companyCode}${first.areaCode ? ` · KV ${first.areaCode}` : ''}`
                : 'Chờ phân bổ đơn vị';
              showNotification(
                `Có ${currentPending.length} đăng ký chờ duyệt: ${first.fullName} (${unitLabel})${extra}`,
                7000
              );
              playRegistrationChime();
            }
          }
          return;
        }

        const newlyArrived = currentPending.filter(
          (u) => !seenPendingUidsRef.current!.has(u.id)
        );
        seenPendingUidsRef.current = currentPendingSet;

        if (newlyArrived.length > 0) {
          const first = newlyArrived[0];
          const extra =
            newlyArrived.length > 1 ? ` (+${newlyArrived.length - 1} khác)` : '';
          const unitLabel = first.companyCode
            ? `${first.companyCode}${first.areaCode ? ` · KV ${first.areaCode}` : ''}`
            : 'Chờ phân bổ đơn vị';
          const msg = `Đăng ký mới chờ duyệt: ${first.fullName} (${unitLabel})${extra}`;
          showNotification(msg, 7500);
          playRegistrationChime();
          showBrowserRegistrationNotification('Hành Thực Lục — Đăng ký mới', msg, () => {
            setAdminNavTab('ROLES');
            setAdminNavTrigger((n) => n + 1);
            setActiveTab('ADMIN');
          });
        }
      },
      (err) => {
        console.warn('[Firestore] Lỗi đọc danh sách users:', err);
        void logUserContext({
          queryPoint: 'users (all)',
          operation: 'LIST',
          error: err,
          uiUser: currentUser,
        });
        showNotification(
          `Không tải được danh sách đăng ký chờ duyệt: ${err?.message || 'Kiểm tra Firestore Rules'}`,
          6000
        );
      }
    );
    return unsubscribe;
  }, [dataUnlocked, firebaseUser?.uid, canReadAdminRolesConfig, showNotification]);

  // Listener danh sách users theo phạm vi cho Cấp 2 -> 5
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid || canReadAdminRolesConfig) {
      return;
    }

    setUsersLoaded(false);
    if (!currentUser || !canAccessAdminPanel(currentUser.role)) {
      setUsersList([]);
      seenPendingUidsRef.current = null;
      return;
    }

    seenPendingUidsRef.current = null;
    const role = currentUser.role;
    const buckets = new Map<string, Map<string, UserAccount>>();
    const unsubs: Array<() => void> = [];

    const syncMerged = () => {
      const merged = new Map<string, UserAccount>();
      buckets.forEach((b) => {
        b.forEach((rec, id) => merged.set(id, rec));
      });
      if (!merged.has(currentUser.id)) {
        merged.set(currentUser.id, currentUser);
      }
      setUsersList(Array.from(merged.values()));
    };

    const attachUserQuery = (bucketKey: string, qRef: any) => {
      const unsub = onSnapshot(
        qRef,
        (snap: any) => {
          const map = new Map<string, UserAccount>();
          snap.docs.forEach((d: any) => {
            map.set(d.id, { ...(d.data() as Omit<UserAccount, 'id'>), id: d.id });
          });
          buckets.set(bucketKey, map);
          syncMerged();
        },
        (err: any) => {
          console.warn(`[Firestore] Lỗi đọc users (${bucketKey}):`, err);
          void logUserContext({
            queryPoint: `users (${bucketKey})`,
            operation: 'LIST',
            error: err,
            uiUser: currentUser,
          });
        }
      );
      unsubs.push(unsub);
    };

    const compCodes: string[] = JSON.parse(managedCompKeyEarly);
    const areaCodes: string[] = JSON.parse(managedAreaKeyEarly);
    const unitCodes: string[] = JSON.parse(managedUnitKeyEarly);

    if (role === 'MANAGER') {
      const effectiveComps = Array.from(
        new Set([...compCodes, ...(currentUser.companyCode ? [currentUser.companyCode] : [])].filter(Boolean))
      );
      effectiveComps.forEach((cCode) => {
        attachUserQuery(`comp_${cCode}`, query(collection(db, 'users'), where('companyCode', '==', cCode)));
      });
      areaCodes.forEach((aEntry) => {
        if (!aEntry) return;
        const parsed = parseAreaScopeEntry(aEntry);
        if (parsed.hasCompanyPrefix && parsed.rawCompanyCode && parsed.rawAreaCode) {
          attachUserQuery(
            `area_${parsed.rawCompanyCode}_${parsed.rawAreaCode}`,
            query(
              collection(db, 'users'),
              where('companyCode', '==', parsed.rawCompanyCode),
              where('areaCode', '==', parsed.rawAreaCode)
            )
          );
        } else if (parsed.rawAreaCode) {
          attachUserQuery(
            `area_${parsed.rawAreaCode}`,
            query(collection(db, 'users'), where('areaCode', '==', parsed.rawAreaCode))
          );
        }
      });
    } else if (role === 'SION_LEADER') {
      const effectiveComps = Array.from(
        new Set([...compCodes, ...(currentUser.companyCode ? [currentUser.companyCode] : [])].filter(Boolean))
      );
      effectiveComps.forEach((cCode) => {
        attachUserQuery(`sion_${cCode}`, query(collection(db, 'users'), where('companyCode', '==', cCode)));
      });
    } else if (role === 'AREA_LEADER') {
      getAreaLeaderQueryPairs(compCodes, areaCodes, currentUser.companyCode, currentUser.areaCode).forEach(
        ({ key, companyCode, areaCode }) => {
          attachUserQuery(
            `area_${key}`,
            query(
              collection(db, 'users'),
              where('companyCode', '==', companyCode),
              where('areaCode', '==', areaCode)
            )
          );
        }
      );
    } else if (role === 'UNI_LEADER') {
      const ownUnit = currentUser.unitCode || '';
      const ownDept = currentUser.departmentCode || '';
      const useDeptFallback = unitCodes.length === 0 && !ownUnit && Boolean(ownDept);
      const effectiveUnits = Array.from(
        new Set([...unitCodes, ...(ownUnit ? [ownUnit] : []), ...(useDeptFallback ? [ownDept] : [])].filter(Boolean))
      );
      if (currentUser.companyCode && currentUser.areaCode) {
        effectiveUnits.forEach((uCode) => {
          attachUserQuery(
            `uni_${uCode}`,
            query(
              collection(db, 'users'),
              where('companyCode', '==', currentUser.companyCode),
              where('areaCode', '==', currentUser.areaCode),
              where('unitCode', '==', uCode)
            )
          );
          if (useDeptFallback && uCode === ownDept) {
            attachUserQuery(
              `dept_${uCode}`,
              query(
                collection(db, 'users'),
                where('companyCode', '==', currentUser.companyCode),
                where('areaCode', '==', currentUser.areaCode),
                where('departmentCode', '==', uCode)
              )
            );
          }
        });
      }
    }

    syncMerged();

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    dataUnlocked,
    firebaseUser?.uid,
    canReadAdminRolesConfig,
    currentUser?.id,
    currentUser?.role,
    currentUser?.companyCode,
    currentUser?.areaCode,
    currentUser?.unitCode,
    currentUser?.departmentCode,
    managedCompKeyEarly,
    managedAreaKeyEarly,
    managedUnitKeyEarly,
  ]);

  const pendingApprovalUsers = useMemo(
    () =>
      usersList
        .filter((u) => resolveUserApprovalStatus(u) === 'PENDING')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [usersList]
  );
  const [dismissedPendingSignature, setDismissedPendingSignature] = useState<string>('');
  const pendingApprovalSignature = useMemo(
    () => pendingApprovalUsers.map((u) => u.id).sort().join(','),
    [pendingApprovalUsers]
  );

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
  const [adminNavTrigger, setAdminNavTrigger] = useState<number>(0);
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
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

  const preAssignedRolesRef = useRef<RoleAssignment[]>([]);
  preAssignedRolesRef.current = preAssignedRoles;
  const ownRoleClaimRef = useRef<RoleAssignment | null>(null);
  ownRoleClaimRef.current = ownRoleClaim;

  const formatFirestoreProfileError = useCallback((err: unknown): string => {
    const code = String((err as { code?: string })?.code || '').toLowerCase();
    const msg = err instanceof Error ? err.message : String(err || '');
    const lower = `${code} ${msg}`.toLowerCase();
    if (lower.includes('resource-exhausted') || lower.includes('quota')) {
      return `Firestore (${FIRESTORE_DATABASE_ID}) đã chạm hạn mức đọc miễn phí trong ngày (Spark). Vui lòng thử lại sau hoặc kiểm tra Firebase Console.\n(${code || msg})`;
    }
    if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
      return `Quyền đọc hồ sơ trên Firestore (${FIRESTORE_DATABASE_ID}) bị từ chối. Hãy kiểm tra và Publish lại file firestore.rules lên database (${FIRESTORE_DATABASE_ID}) trong Firebase Console.\n(${code || msg})`;
    }
    if (lower.includes('not-found') || lower.includes('does not exist')) {
      return `Không tìm thấy database Firestore (${FIRESTORE_DATABASE_ID}) trên dự án Firebase. Hãy kiểm tra trong Firebase Console.\n(${code || msg})`;
    }
    if (lower.includes('unavailable') || lower.includes('offline') || lower.includes('network')) {
      return `Không kết nối được tới máy chủ Firestore (${FIRESTORE_DATABASE_ID}). Kiểm tra mạng hoặc tắt trình chặn quảng cáo/VPN rồi bấm Thử lại.\n(${code || msg})`;
    }
    return `Không đọc được hồ sơ tài khoản trên Firestore (${FIRESTORE_DATABASE_ID}): ${msg || code}`;
  }, []);

  // ---------- Theo dõi trạng thái đăng nhập ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      const nextUid = u?.uid || null;
      if (prevAuthUidRef.current !== nextUid) {
        setPinUnlockedUid(null);
        setCurrentUser(null);
        setProfileState('UNKNOWN');
        setProfileError(null);
        setOwnRoleClaim(null);
        setPreAssignedRoles([]);
        setUsersList([]);
        setUsersLoaded(false);
        setRulesSyncWarning(null);
        seenPendingUidsRef.current = null;
        prevAuthUidRef.current = nextUid;
      }
      setFirebaseUser(u);
      setAuthReady(true);
      if (!u) {
        setCurrentUser(null);
        setProfileState('UNKNOWN');
        setProfileError(null);
        setOwnRoleClaim(null);
        setPreAssignedRoles([]);
        setUsersList([]);
        setUsersLoaded(false);
        setRulesSyncWarning(null);
        seenPendingUidsRef.current = null;
        creatingProfileRef.current = false;
      }
    });
    return unsubscribe;
  }, []);

  // Đọc hồ sơ tài khoản (users/{uid}) - tách khỏi preAssignedRoles/ownRoleClaim để không bị reset listener khi vừa login
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    let cancelled = false;
    let settled = false;
    let serverCheckInFlight = false;
    setProfileError(null);

    const userRef = doc(db, 'users', firebaseUser.uid);

    const applyProfileData = (raw: Omit<UserAccount, 'id'>, docId: string) => {
      if (cancelled) return;
      settled = true;
      const emailLower = (firebaseUser.email || raw.email || '').toLowerCase().trim();
      const emailVerified = Boolean(firebaseUser.emailVerified);
      const rawRole: UserRole = raw.role || 'MEMBER';
      // Chỉ lấy quyền thật đang lưu trên users/{uid} (ngoại lệ duy nhất là email Bootstrap SuperAdmin đã xác thực)
      const resolvedRole: UserRole =
        emailVerified && isBootstrapSuperAdminEmail(emailLower) ? 'SUPER_ADMIN' : rawRole;

      setProfileError(null);
      setCurrentUser({
        ...raw,
        id: docId,
        role: resolvedRole,
        managedClusterIds: raw.managedClusterIds || [],
        managedCompanyCodes: raw.managedCompanyCodes || [],
        managedAreaCodes: raw.managedAreaCodes || [],
        managedUnitCodes: raw.managedUnitCodes || [],
      });
      setProfileState('READY');
    };

    const applyMissing = () => {
      if (cancelled || settled) return;
      settled = true;
      setProfileError(null);
      setCurrentUser(null);
      setProfileState('MISSING');
    };

    const applyError = (err: unknown) => {
      if (cancelled || settled) return;
      settled = true;
      const msg = formatFirestoreProfileError(err);
      console.error('[Firestore] Không đọc được hồ sơ:', err);
      void logUserContext({
        queryPoint: `users/${firebaseUser.uid}`,
        operation: 'GET',
        error: err,
        uiUser: currentUser,
      });
      setProfileError(msg);
      setProfileState('ERROR');
      showNotification(msg.split('\n')[0]);
    };

    const verifyFromServer = async (cachedDocData?: Omit<UserAccount, 'id'>, cachedDocId?: string) => {
      if (cancelled || settled || serverCheckInFlight) return;
      serverCheckInFlight = true;
      try {
        const serverSnap = await getDocFromServer(userRef);
        if (cancelled || settled) return;
        clearTimeout(timeoutId);
        if (serverSnap.exists()) {
          applyProfileData(serverSnap.data() as Omit<UserAccount, 'id'>, serverSnap.id);
        } else {
          applyMissing();
        }
      } catch (err: any) {
        if (cancelled || settled) return;
        const code = String(err?.code || '').toLowerCase();
        const msg = String(err?.message || '').toLowerCase();
        const isOfflineError =
          code.includes('unavailable') || msg.includes('offline') || msg.includes('network');
        if (isOfflineError && cachedDocData && cachedDocId) {
          clearTimeout(timeoutId);
          applyProfileData(cachedDocData, cachedDocId);
        } else {
          clearTimeout(timeoutId);
          applyError(err);
        }
      } finally {
        serverCheckInFlight = false;
      }
    };

    const timeoutId = setTimeout(() => {
      if (cancelled || settled) return;
      settled = true;
      setProfileError(
        `Quá thời gian chờ phản hồi từ Firestore (${FIRESTORE_DATABASE_ID}). Hãy kiểm tra mạng, hạn mức đọc Spark hoặc Rules trên database (${FIRESTORE_DATABASE_ID}).`
      );
      setProfileState('ERROR');
    }, 8000);

    const unsubscribe = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          if (snap.metadata.fromCache && !settled) {
            // Không mở khóa bằng cache cũ (tránh lệch quyền khi vừa bị hạ quyền/đổi vai trò trên server)
            void verifyFromServer(snap.data() as Omit<UserAccount, 'id'>, snap.id);
            return;
          }
          clearTimeout(timeoutId);
          applyProfileData(snap.data() as Omit<UserAccount, 'id'>, snap.id);
        } else if (!snap.metadata.fromCache) {
          clearTimeout(timeoutId);
          applyMissing();
        } else {
          // Bộ nhớ đệm cục bộ trả rỗng -> kiểm tra trực tiếp từ máy chủ để tránh kẹt ở UNKNOWN
          void verifyFromServer();
        }
      },
      (err) => {
        clearTimeout(timeoutId);
        applyError(err);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [firebaseUser?.uid, profileRetryTick, formatFirestoreProfileError, showNotification]);

  // Tạo hồ sơ + thành viên CHỈ KHI người dùng đăng ký qua Email (có pendingRegistrationRef với đủ Sion/KV/PIN).
  // Người dùng Google lần đầu sẽ ở mode ONBOARDING để tự chọn Sion/Khu vực & Mã PIN 6 số.
  useEffect(() => {
    const reg = pendingRegistrationRef.current;
    if (!firebaseUser || profileState !== 'MISSING' || creatingProfileRef.current || !reg) return;
    creatingProfileRef.current = true;

    const createProfile = async () => {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const existing = await getDocFromServer(userRef);
      if (existing.exists()) {
        pendingRegistrationRef.current = null;
        creatingProfileRef.current = false;
        return;
      }

      const email = (firebaseUser.email || reg.email || '').trim();
      const fullName = (
        reg.fullName ||
        firebaseUser.displayName ||
        email.split('@')[0] ||
        'Thành viên mới'
      )
        .trim()
        .slice(0, 100);
      const companyCode = (reg.companyCode || effectiveCompanies[0]?.code || '')
        .trim()
        .slice(0, 30);
      const rawAreaCode = (
        cleanRawAreaCode(reg.areaCode) ||
        cleanRawAreaCode(
          effectiveAreas.find((a) => normalizeOrgCode(a.companyCode) === normalizeOrgCode(companyCode))
            ?.code
        ) ||
        ''
      ).trim();
      const cleanArea = rawAreaCode.slice(0, 30);
      const existingAreaDoc = areas.find(
        (a) =>
          normalizeOrgCode(a.companyCode) === normalizeOrgCode(companyCode) &&
          normalizeOrgCode(cleanRawAreaCode(a.code)) === normalizeOrgCode(cleanArea)
      );
      let areaCode = existingAreaDoc ? existingAreaDoc.code : cleanArea;
      let areaRefToCreate: ReturnType<typeof doc> | null = null;
      const areaTombstoned =
        deletedCompanySet.has(normalizeOrgCode(companyCode)) ||
        deletedAreaKeySet.has(normalizeDeletedAreaKey(companyCode, areaCode));
      if (!existingAreaDoc && companyCode && areaCode && !areaTombstoned) {
        const candidateId = makeDeterministicAreaId(companyCode, areaCode);
        const candidateRef = doc(db, 'areas', candidateId);
        let alreadyOnServer = false;
        try {
          const areaSnap = await getDocFromServer(candidateRef);
          if (areaSnap.exists()) {
            alreadyOnServer = true;
            const serverCode = areaSnap.data()?.code;
            if (typeof serverCode === 'string' && serverCode.trim()) {
              areaCode = serverCode.trim().slice(0, 30);
            }
          }
        } catch {
          // Bỏ qua nếu không kiểm tra được trước
        }
        if (!alreadyOnServer) {
          areaRefToCreate = candidateRef;
        }
      }

      const departmentCode = reg.departmentCode || effectiveDepartments[0]?.code || 'Thanh Niên Nam';
      const unitCode = reg.unitCode?.trim() || undefined;
      const nowIso = new Date().toISOString();
      const today = nowIso.split('T')[0];
      const memberId = `m-${firebaseUser.uid}`;
      const emailLower = email.toLowerCase();
      let remoteClaim: RoleAssignment | undefined =
        ownRoleClaim && ownRoleClaim.email?.toLowerCase() === emailLower ? ownRoleClaim : undefined;
      if (!remoteClaim && emailLower) {
        try {
          const claimSnap = await getDocFromServer(doc(db, 'role_claims', emailLower));
          if (claimSnap.exists()) {
            remoteClaim = claimSnap.data() as RoleAssignment;
          }
        } catch {
          // Bỏ qua nếu chưa có role_claims cho email này
        }
      }

      const preMatch = firebaseUser.emailVerified
        ? preAssignedRoles.find((p) => p.email.toLowerCase() === emailLower) || remoteClaim
        : undefined;
      const isSuperAdminEmail =
        (firebaseUser.emailVerified && isBootstrapSuperAdminEmail(emailLower)) ||
        preMatch?.role === 'SUPER_ADMIN';
      const shouldAutoApprove =
        !effectiveSecurityConfig.requireRegistrationApproval ||
        isSuperAdminEmail ||
        (effectiveSecurityConfig.autoApprovePreAssigned && !!preMatch);

      let initialRole: UserRole = 'MEMBER';
      if (isSuperAdminEmail) initialRole = 'SUPER_ADMIN';
      else if (preMatch?.role) initialRole = preMatch.role;

      const pinHash = reg.pin ? await hashPersonalPin(firebaseUser.uid, reg.pin) : undefined;

      const account = JSON.parse(
        JSON.stringify({
          username: reg.username || email.split('@')[0] || `user_${Date.now()}`,
          email,
          fullName,
          role: initialRole,
          memberId,
          companyCode,
          areaCode,
          departmentCode,
          unitCode,
          ...(preMatch?.managedClusterIds?.length
            ? { managedClusterIds: preMatch.managedClusterIds }
            : {}),
          managedCompanyCodes: preMatch?.managedCompanyCodes || [],
          managedAreaCodes: preMatch?.managedAreaCodes || [],
          managedUnitCodes: preMatch?.managedUnitCodes || [],
          avatarUrl: firebaseUser.photoURL || undefined,
          emailVerified: firebaseUser.emailVerified,
          pinHash,
          pinUpdatedAt: pinHash ? nowIso : undefined,
          onboardingCompleted: true,
          approvalStatus: shouldAutoApprove ? 'APPROVED' : 'PENDING',
          ...(shouldAutoApprove ? { approvedBy: 'SYSTEM_AUTO', approvedAt: nowIso } : {}),
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
          active: shouldAutoApprove,
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
      if (areaRefToCreate) {
        const finalAreaName =
          (reg.areaName || '').trim().slice(0, 80) || `Khu vực ${areaCode}`;
        batch.set(areaRefToCreate, {
          code: areaCode,
          name: finalAreaName,
          companyCode,
          active: true,
          _order: Date.now(),
        });
      }
      await batch.commit();

      pendingRegistrationRef.current = null;
      if (pinHash && shouldAutoApprove) {
        setPinUnlockedUid(firebaseUser.uid);
      }
      setActiveTab('ENTRY');
      showNotification(
        shouldAutoApprove
          ? 'Đăng ký thành công! Thư xác thực đã được gửi tới email của bạn (kiểm tra cả mục Spam).'
          : 'Đã gửi hồ sơ đăng ký! Tài khoản của bạn đang chờ Quản trị viên phê duyệt.'
      );
    };

    createProfile()
      .catch((err) => {
        console.error('[Firestore] Không tạo được hồ sơ:', err);
        showNotification(`Không tạo được hồ sơ tài khoản: ${err.message}`);
        pendingRegistrationRef.current = null;
      })
      .finally(() => {
        creatingProfileRef.current = false;
      });
  }, [
    firebaseUser,
    profileState,
    preAssignedRoles,
    ownRoleClaim,
    effectiveSecurityConfig,
    effectiveCompanies,
    effectiveAreas,
    areas,
    effectiveDepartments,
    showNotification,
  ]);

  // Khi mở khóa thành công -> chuyển sang trang Báo cáo hằng ngày (ENTRY)
  useEffect(() => {
    if (dataUnlocked && currentUser && welcomedUidRef.current !== currentUser.id) {
      welcomedUidRef.current = currentUser.id;
      setActiveTab('ENTRY');
      showNotification(`Xin chào, ${currentUser.fullName}!`);
    }
    if (!currentUser || !dataUnlocked) {
      welcomedUidRef.current = null;
    }
  }, [dataUnlocked, currentUser?.id, currentUser?.fullName, showNotification]);

  // Helper xác định quyền Super Admin & Admin (chỉ dựa trên quyền thật trên users/{uid} và email Bootstrap đã xác thực)
  const isSuperAdminUser = useMemo(() => {
    if (!currentUser) return false;
    const emailLower = (firebaseUser?.email || currentUser.email || '').toLowerCase().trim();
    const emailVerified = Boolean(firebaseUser?.emailVerified);
    if (emailVerified && isBootstrapSuperAdminEmail(emailLower)) return true;
    return currentUser.role === 'SUPER_ADMIN';
  }, [currentUser, firebaseUser?.email, firebaseUser?.emailVerified]);

  const isAdminUser = useMemo(() => {
    if (isSuperAdminUser) return true;
    if (!currentUser) return false;
    return currentUser.role === 'ADMIN';
  }, [isSuperAdminUser, currentUser]);

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

  // Đồng bộ ngữ cảnh người dùng hiện tại cho tiện ích chẩn đoán logUserContext
  useEffect(() => {
    setActiveDebugUserContext(effectiveCurrentUser);
  }, [effectiveCurrentUser]);

  // Cập nhật tiêu đề tab trình duyệt khi có đăng ký chờ duyệt để Admin dễ nhận biết
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const baseTitle = 'Hành Thực Lục — Hệ thống Báo cáo & Thi đua';
    if (dataUnlocked && isAdminUser && pendingApprovalUsers.length > 0) {
      document.title = `(${pendingApprovalUsers.length} chờ duyệt) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
    return () => {
      document.title = baseTitle;
    };
  }, [dataUnlocked, isAdminUser, pendingApprovalUsers.length]);

  // Đồng bộ role & emailVerified lên Firestore (KHÔNG tự nâng quyền trên UI trước khi Firestore xác nhận)
  useEffect(() => {
    if (!currentUser || !firebaseUser || currentUser.id !== firebaseUser.uid) return;
    const emailLower = (firebaseUser.email || currentUser.email || '').toLowerCase().trim();
    const emailVerified = Boolean(firebaseUser.emailVerified);
    const claimMatch =
      emailVerified && ownRoleClaim && ownRoleClaim.email?.toLowerCase() === emailLower
        ? ownRoleClaim
        : undefined;
    const preMatch = emailVerified
      ? claimMatch || preAssignedRoles.find((p) => p.email.toLowerCase() === emailLower)
      : undefined;

    const shouldBeSuper =
      (emailVerified && isBootstrapSuperAdminEmail(emailLower)) ||
      preMatch?.role === 'SUPER_ADMIN';

    const claimUpdatedAt = preMatch?.updatedAt || preMatch?.grantedAt || '';
    const userRoleUpdatedAt = currentUser.roleUpdatedAt || '';
    const claimIsNewerThanUserRole =
      Boolean(claimUpdatedAt) && (!userRoleUpdatedAt || claimUpdatedAt > userRoleUpdatedAt);

    const shouldAdoptPreMatch =
      !!preMatch?.role &&
      preMatch.role !== currentUser.role &&
      (claimIsNewerThanUserRole ||
        (!userRoleUpdatedAt &&
          (currentUser.role === 'MEMBER' ||
            getRoleLevel(preMatch.role) > getRoleLevel(currentUser.role))));

    const patch: Record<string, unknown> = {};
    if (shouldBeSuper && currentUser.role !== 'SUPER_ADMIN') {
      patch.role = 'SUPER_ADMIN';
      patch.roleUpdatedAt = new Date().toISOString();
    } else if (shouldAdoptPreMatch && preMatch) {
      patch.role = preMatch.role;
      patch.roleUpdatedAt = preMatch.updatedAt || new Date().toISOString();
      if (preMatch.managedClusterIds !== undefined) {
        patch.managedClusterIds = preMatch.managedClusterIds;
      }
      if (preMatch.managedCompanyCodes !== undefined) {
        patch.managedCompanyCodes = preMatch.managedCompanyCodes;
      }
      if (preMatch.managedAreaCodes !== undefined) {
        patch.managedAreaCodes = preMatch.managedAreaCodes;
      }
      if (preMatch.managedUnitCodes !== undefined) {
        patch.managedUnitCodes = preMatch.managedUnitCodes;
      }
    }

    if (firebaseUser.emailVerified && !currentUser.emailVerified) patch.emailVerified = true;
    if (Object.keys(patch).length > 0) {
      updateDoc(doc(db, 'users', currentUser.id), patch).catch((err) =>
        console.warn('Lỗi đồng bộ hồ sơ lên Firestore:', err)
      );
    }
  }, [
    currentUser?.id,
    currentUser?.role,
    currentUser?.roleUpdatedAt,
    currentUser?.emailVerified,
    firebaseUser?.uid,
    firebaseUser?.email,
    firebaseUser?.emailVerified,
    preAssignedRoles,
    ownRoleClaim,
  ]);

  // Chẩn đoán: so sánh quyền hiển thị trên giao diện với quyền thật trong Firestore (rule chỉ đọc quyền thật)
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid || !effectiveCurrentUser) {
      setRulesSyncWarning(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocFromServer(doc(db, 'users', firebaseUser.uid));
        if (cancelled || !snap.exists()) return;
        const server = snap.data() as any;
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const info = {
          database: FIRESTORE_DATABASE_ID,
          uiRole: effectiveCurrentUser.role,
          serverRole: server.role,
          serverApproval: server.approvalStatus ?? '(không có trường)',
          serverCompany: server.companyCode,
          serverArea: server.areaCode,
          serverManagedCompanies: server.managedCompanyCodes ?? [],
          serverManagedAreas: server.managedAreaCodes ?? [],
          tokenEmailVerified: tokenResult.claims.email_verified,
        };
        if (info.uiRole !== info.serverRole) {
          console.warn(
            '[Chẩn đoán] LỆCH QUYỀN: giao diện đang là',
            info.uiRole,
            'nhưng Firestore lưu',
            info.serverRole,
            '- rule sẽ từ chối các truy vấn cấp quản lý.',
            info
          );
        } else {
          console.info('[Chẩn đoán] Quyền khớp', info);
        }

        // Kiểm tra thêm xem Firestore Rules trên database hiện tại đã được cập nhật đúng bản mới chưa
        const serverApproved = !server.approvalStatus || server.approvalStatus === 'APPROVED';
        if (serverApproved) {
          try {
            await getDocFromServer(doc(db, 'events', '_probe_'));
            if (!cancelled) setRulesSyncWarning(null);
          } catch (probeErr: any) {
            const probeMsg = `${probeErr?.code || ''} ${probeErr?.message || ''}`.toLowerCase();
            if (probeMsg.includes('permission-denied') || probeMsg.includes('insufficient permissions')) {
              void logUserContext({
                queryPoint: 'events/_probe_',
                operation: 'GET',
                error: probeErr,
                uiUser: effectiveCurrentUser,
              });
              console.error(
                `[Chẩn đoán Firestore Rules] Hồ sơ users/${firebaseUser.uid} đã được duyệt (APPROVED) nhưng Firestore (${FIRESTORE_DATABASE_ID}) vẫn từ chối đọc dữ liệu. Hãy mở Firebase Console → Firestore Database → chọn đúng database "${FIRESTORE_DATABASE_ID}" → tab Rules → dán toàn bộ file firestore.rules mới nhất và bấm Publish.`,
                info
              );
              if (!cancelled) {
                setRulesSyncWarning(
                  `Tài khoản đã được duyệt, nhưng Firestore Rules đang chạy trên database "${FIRESTORE_DATABASE_ID}" là phiên bản cũ hoặc đã Publish nhầm sang database khác. Quản trị viên cần vào Firebase Console → Firestore Database → chọn đúng "${FIRESTORE_DATABASE_ID}" → tab Rules → dán toàn bộ firestore.rules mới nhất và bấm Publish.`
                );
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Chẩn đoán] Không đọc được users/{uid}:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataUnlocked, firebaseUser?.uid, effectiveCurrentUser?.role]);

  // Tính điểm thi đua trực tiếp từ Báo cáo hằng ngày (bảo toàn score lưu sẵn trên members cho Top-15 khi TĐ chỉ tải báo cáo cá nhân)
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

    const hasFullDailyReports = isAdminRole(effectiveCurrentUser?.role);
    const ownMemberId = effectiveCurrentUser?.memberId || (firebaseUser?.uid ? `m-${firebaseUser.uid}` : '');

    return members.map((m) => {
      const safeBase = {
        ...m,
        fullName: m.fullName || '',
        companyCode: m.companyCode || '',
        areaCode: m.areaCode || '',
        departmentCode: m.departmentCode || '',
        targets: Array.isArray(m.targets) ? m.targets : [],
        score: typeof m.score === 'number' && Number.isFinite(m.score) ? m.score : 0,
      };
      const mReports = reportsByMember.get(m.id) || [];
      if (hasFullDailyReports || mReports.length > 0 || m.id === ownMemberId) {
        const aggregated = sumDailyReportMetrics(mReports);
        const dailyScore = computeDailyMetricsScore(aggregated, weights);
        return {
          ...safeBase,
          dailyResults: aggregated,
          score: Number.isFinite(dailyScore) ? dailyScore : 0,
        };
      }
      return safeBase;
    });
  }, [
    members,
    dailyReports,
    activeEvent,
    effectiveDefaultWeights,
    effectiveCurrentUser?.role,
    effectiveCurrentUser?.memberId,
    firebaseUser?.uid,
  ]);

  const competingMembers = useMemo(() => {
    const activeOnly = computedAllMembers.filter((m) => m.active !== false);
    if (activeEvent?.restrictParticipants) {
      const allowedSet = new Set(activeEvent.participantIds || []);
      return activeOnly.filter((m) => allowedSet.has(m.id));
    }
    return activeOnly;
  }, [computedAllMembers, activeEvent]);

  const rankedMembers = useMemo(() => rankMembers(competingMembers), [competingMembers]);
  const allMembersRanked = useMemo(() => rankMembers(computedAllMembers), [computedAllMembers]);

  const companyRankings = useMemo(
    () => computeCompanyRankings(effectiveCompanies, rankedMembers),
    [effectiveCompanies, rankedMembers]
  );

  const areaRankings = useMemo(
    () => computeAreaRankings(effectiveAreas, rankedMembers),
    [effectiveAreas, rankedMembers]
  );

  // ---------- Trang thông tin MĐ (disciples) - Truy vấn theo cấp bậc (7 cấp) ----------
  const [disciples, setDisciples] = useState<DiscipleRecord[]>([]);
  const [disciplesLoading, setDisciplesLoading] = useState<boolean>(false);

  const managedCompKey = JSON.stringify(effectiveCurrentUser?.managedCompanyCodes || []);
  const managedAreaKey = JSON.stringify(effectiveCurrentUser?.managedAreaCodes || []);
  const managedUnitKey = JSON.stringify(effectiveCurrentUser?.managedUnitCodes || []);

  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid || !effectiveCurrentUser) {
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
          void logUserContext({
            queryPoint: `disciples (${bucketKey})`,
            operation: 'LIST',
            error: err,
            uiUser: effectiveCurrentUser,
          });
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
      areaCodes.forEach((aEntry) => {
        if (!aEntry) return;
        const parsed = parseAreaScopeEntry(aEntry);
        if (parsed.hasCompanyPrefix && parsed.rawCompanyCode && parsed.rawAreaCode) {
          attachQuery(
            `area_${parsed.rawCompanyCode}_${parsed.rawAreaCode}`,
            query(
              collection(db, 'disciples'),
              where('companyCode', '==', parsed.rawCompanyCode),
              where('areaCode', '==', parsed.rawAreaCode)
            )
          );
        } else if (parsed.rawAreaCode) {
          attachQuery(
            `area_${parsed.rawAreaCode}`,
            query(collection(db, 'disciples'), where('areaCode', '==', parsed.rawAreaCode))
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
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      getAreaLeaderQueryPairs(
        compCodes,
        areaCodes,
        effectiveCurrentUser.companyCode,
        effectiveCurrentUser.areaCode
      ).forEach(({ key, companyCode, areaCode }) => {
        attachQuery(
          `leader_${key}`,
          query(
            collection(db, 'disciples'),
            where('companyCode', '==', companyCode),
            where('areaCode', '==', areaCode)
          )
        );
      });
    } else if (role === 'UNI_LEADER') {
      attachQuery('own', query(collection(db, 'disciples'), where('ownerUid', '==', uid)));
      const unitCodes: string[] = JSON.parse(managedUnitKey);
      const ownUnit = effectiveCurrentUser.unitCode || '';
      const ownDept = effectiveCurrentUser.departmentCode || '';
      const effectiveUnits = Array.from(
        new Set(
          [
            ...unitCodes,
            ...(ownUnit ? [ownUnit] : []),
            ...(unitCodes.length === 0 && !ownUnit && ownDept ? [ownDept] : []),
          ].filter(Boolean)
        )
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
    dataUnlocked,
    firebaseUser?.uid,
    effectiveCurrentUser?.role,
    effectiveCurrentUser?.companyCode,
    effectiveCurrentUser?.areaCode,
    effectiveCurrentUser?.unitCode,
    effectiveCurrentUser?.departmentCode,
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
    if (!dataUnlocked || !firebaseUser?.uid || !effectiveCurrentUser) {
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
          void logUserContext({
            queryPoint: `work_schedules (${bucketKey})`,
            operation: 'LIST',
            error: err,
            uiUser: effectiveCurrentUser,
          });
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
      areaCodes.forEach((aEntry) => {
        if (!aEntry) return;
        const parsed = parseAreaScopeEntry(aEntry);
        if (parsed.hasCompanyPrefix && parsed.rawCompanyCode && parsed.rawAreaCode) {
          attachQuery(
            `area_${parsed.rawCompanyCode}_${parsed.rawAreaCode}`,
            query(
              collection(db, 'work_schedules'),
              where('companyCode', '==', parsed.rawCompanyCode),
              where('areaCode', '==', parsed.rawAreaCode)
            )
          );
        } else if (parsed.rawAreaCode) {
          attachQuery(
            `area_${parsed.rawAreaCode}`,
            query(collection(db, 'work_schedules'), where('areaCode', '==', parsed.rawAreaCode))
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
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      getAreaLeaderQueryPairs(
        compCodes,
        areaCodes,
        effectiveCurrentUser.companyCode,
        effectiveCurrentUser.areaCode
      ).forEach(({ key, companyCode, areaCode }) => {
        attachQuery(
          `leader_${key}`,
          query(
            collection(db, 'work_schedules'),
            where('companyCode', '==', companyCode),
            where('areaCode', '==', areaCode)
          )
        );
      });
    } else if (role === 'UNI_LEADER') {
      attachQuery('own', query(collection(db, 'work_schedules'), where('ownerUid', '==', uid)));
      const unitCodes: string[] = JSON.parse(managedUnitKey);
      const ownUnit = effectiveCurrentUser.unitCode || '';
      const ownDept = effectiveCurrentUser.departmentCode || '';
      const effectiveUnits = Array.from(
        new Set(
          [
            ...unitCodes,
            ...(ownUnit ? [ownUnit] : []),
            ...(unitCodes.length === 0 && !ownUnit && ownDept ? [ownDept] : []),
          ].filter(Boolean)
        )
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
    dataUnlocked,
    firebaseUser?.uid,
    effectiveCurrentUser?.role,
    effectiveCurrentUser?.companyCode,
    effectiveCurrentUser?.areaCode,
    effectiveCurrentUser?.unitCode,
    effectiveCurrentUser?.departmentCode,
    managedCompKey,
    managedAreaKey,
    managedUnitKey,
    showNotification,
  ]);

  // ---------- Báo cáo hằng ngày (dailyReports) - Truy vấn theo cấp bậc (7 cấp) ----------
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid || !effectiveCurrentUser) {
      setDailyReports([]);
      return;
    }

    const uid = firebaseUser.uid;
    const role = effectiveCurrentUser.role;
    const buckets = new Map<string, Map<string, DailyReportRecord>>();
    const unsubs: Array<() => void> = [];

    const syncMerged = () => {
      const merged = new Map<string, DailyReportRecord>();
      buckets.forEach((b) => {
        b.forEach((rec, id) => merged.set(id, rec));
      });
      setDailyReports(Array.from(merged.values()));
    };

    const attachQuery = (bucketKey: string, qRef: any) => {
      const unsub = onSnapshot(
        qRef,
        (snap: any) => {
          const map = new Map<string, DailyReportRecord>();
          snap.docs.forEach((d: any) => {
            map.set(d.id, { ...(d.data() as Omit<DailyReportRecord, 'id'>), id: d.id });
          });
          buckets.set(bucketKey, map);
          syncMerged();
        },
        (err: any) => {
          console.warn(`[Firestore] Lỗi đọc dailyReports (${bucketKey}):`, err);
          void logUserContext({
            queryPoint: `dailyReports (${bucketKey})`,
            operation: 'LIST',
            error: err,
            uiUser: effectiveCurrentUser,
          });
        }
      );
      unsubs.push(unsub);
    };

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      attachQuery('all', collection(db, 'dailyReports'));
    } else if (role === 'MANAGER') {
      attachQuery('own', query(collection(db, 'dailyReports'), where('uid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      compCodes.forEach((cCode) => {
        if (cCode) {
          attachQuery(
            `comp_${cCode}`,
            query(collection(db, 'dailyReports'), where('companyCode', '==', cCode))
          );
        }
      });
      areaCodes.forEach((aEntry) => {
        if (!aEntry) return;
        const parsed = parseAreaScopeEntry(aEntry);
        if (parsed.hasCompanyPrefix && parsed.rawCompanyCode && parsed.rawAreaCode) {
          attachQuery(
            `area_${parsed.rawCompanyCode}_${parsed.rawAreaCode}`,
            query(
              collection(db, 'dailyReports'),
              where('companyCode', '==', parsed.rawCompanyCode),
              where('areaCode', '==', parsed.rawAreaCode)
            )
          );
        } else if (parsed.rawAreaCode) {
          attachQuery(
            `area_${parsed.rawAreaCode}`,
            query(collection(db, 'dailyReports'), where('areaCode', '==', parsed.rawAreaCode))
          );
        }
      });
    } else if (role === 'SION_LEADER') {
      attachQuery('own', query(collection(db, 'dailyReports'), where('uid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const effectiveComps = Array.from(
        new Set((compCodes.length ? compCodes : [effectiveCurrentUser.companyCode]).filter(Boolean))
      );
      effectiveComps.forEach((cCode) => {
        attachQuery(
          `sion_${cCode}`,
          query(collection(db, 'dailyReports'), where('companyCode', '==', cCode))
        );
      });
    } else if (role === 'AREA_LEADER') {
      attachQuery('own', query(collection(db, 'dailyReports'), where('uid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      getAreaLeaderQueryPairs(
        compCodes,
        areaCodes,
        effectiveCurrentUser.companyCode,
        effectiveCurrentUser.areaCode
      ).forEach(({ key, companyCode, areaCode }) => {
        attachQuery(
          `leader_${key}`,
          query(
            collection(db, 'dailyReports'),
            where('companyCode', '==', companyCode),
            where('areaCode', '==', areaCode)
          )
        );
      });
    } else if (role === 'UNI_LEADER') {
      attachQuery('own', query(collection(db, 'dailyReports'), where('uid', '==', uid)));
      const unitCodes: string[] = JSON.parse(managedUnitKey);
      const ownUnit = effectiveCurrentUser.unitCode || '';
      const ownDept = effectiveCurrentUser.departmentCode || '';
      const effectiveUnits = Array.from(
        new Set(
          [
            ...unitCodes,
            ...(ownUnit ? [ownUnit] : []),
            ...(unitCodes.length === 0 && !ownUnit && ownDept ? [ownDept] : []),
          ].filter(Boolean)
        )
      );
      if (effectiveCurrentUser.companyCode && effectiveCurrentUser.areaCode) {
        effectiveUnits.forEach((uCode) => {
          attachQuery(
            `uni_${uCode}`,
            query(
              collection(db, 'dailyReports'),
              where('companyCode', '==', effectiveCurrentUser.companyCode),
              where('areaCode', '==', effectiveCurrentUser.areaCode),
              where('unitCode', '==', uCode)
            )
          );
        });
      }
    } else {
      attachQuery('own', query(collection(db, 'dailyReports'), where('uid', '==', uid)));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    dataUnlocked,
    firebaseUser?.uid,
    effectiveCurrentUser?.role,
    effectiveCurrentUser?.companyCode,
    effectiveCurrentUser?.areaCode,
    effectiveCurrentUser?.unitCode,
    effectiveCurrentUser?.departmentCode,
    managedCompKey,
    managedAreaKey,
    managedUnitKey,
  ]);

  // ---------- Edu (edu_topics, edu_assignments, edu_cms_profiles) - Truy vấn theo cấp bậc (7 cấp) ----------
  useEffect(() => {
    if (!dataUnlocked || !firebaseUser?.uid || !effectiveCurrentUser) {
      setEduTopics([]);
      setEduAssignments([]);
      setEduCmsProfiles([]);
      setEduLoading(false);
      return;
    }

    setEduLoading(true);
    const uid = firebaseUser.uid;
    const memberId = effectiveCurrentUser.memberId || `m-${uid}`;
    const role = effectiveCurrentUser.role;
    const unsubs: Array<() => void> = [];

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
        void logUserContext({
          queryPoint: 'edu_topics',
          operation: 'LIST',
          error: err,
          uiUser: effectiveCurrentUser,
        });
      }
    );
    unsubs.push(unsubTopics);

    // edu_assignments (scoped by RBAC)
    const assignBuckets = new Map<string, Map<string, EduTopicAssignment>>();
    const syncAssignments = () => {
      const merged = new Map<string, EduTopicAssignment>();
      assignBuckets.forEach((b) => b.forEach((rec, id) => merged.set(id, rec)));
      setEduAssignments(Array.from(merged.values()));
    };
    const attachAssign = (bucketKey: string, qRef: any) => {
      const u = onSnapshot(
        qRef,
        (snap: any) => {
          const map = new Map<string, EduTopicAssignment>();
          snap.docs.forEach((d: any) => {
            map.set(d.id, { ...(d.data() as Omit<EduTopicAssignment, 'id'>), id: d.id });
          });
          assignBuckets.set(bucketKey, map);
          syncAssignments();
        },
        (err: any) => {
          console.warn(`[Firestore] Lỗi đọc edu_assignments (${bucketKey}):`, err);
          void logUserContext({
            queryPoint: `edu_assignments (${bucketKey})`,
            operation: 'LIST',
            error: err,
            uiUser: effectiveCurrentUser,
          });
        }
      );
      unsubs.push(u);
    };

    // edu_cms_profiles (scoped by RBAC)
    const cmsBuckets = new Map<string, Map<string, EduCmsProfile>>();
    const syncCms = () => {
      const merged = new Map<string, EduCmsProfile>();
      cmsBuckets.forEach((b) => b.forEach((rec, id) => merged.set(id, rec)));
      setEduCmsProfiles(Array.from(merged.values()));
    };
    const attachCms = (bucketKey: string, qRef: any) => {
      const u = onSnapshot(
        qRef,
        (snap: any) => {
          const map = new Map<string, EduCmsProfile>();
          snap.docs.forEach((d: any) => {
            map.set(d.id, { ...(d.data() as Omit<EduCmsProfile, 'id'>), id: d.id });
          });
          cmsBuckets.set(bucketKey, map);
          syncCms();
        },
        (err: any) => {
          console.warn(`[Firestore] Lỗi đọc edu_cms_profiles (${bucketKey}):`, err);
          void logUserContext({
            queryPoint: `edu_cms_profiles (${bucketKey})`,
            operation: 'LIST',
            error: err,
            uiUser: effectiveCurrentUser,
          });
        }
      );
      unsubs.push(u);
    };

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      attachAssign('all', collection(db, 'edu_assignments'));
      attachCms('all', collection(db, 'edu_cms_profiles'));
    } else if (role === 'MANAGER') {
      attachAssign('own', query(collection(db, 'edu_assignments'), where('assignedByUid', '==', uid)));
      attachCms('own', query(collection(db, 'edu_cms_profiles'), where('ownerUid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      compCodes.forEach((cCode) => {
        if (cCode) {
          attachAssign(`comp_${cCode}`, query(collection(db, 'edu_assignments'), where('companyCode', '==', cCode)));
          attachCms(`comp_${cCode}`, query(collection(db, 'edu_cms_profiles'), where('companyCode', '==', cCode)));
        }
      });
      areaCodes.forEach((aEntry) => {
        if (!aEntry) return;
        const parsed = parseAreaScopeEntry(aEntry);
        if (parsed.hasCompanyPrefix && parsed.rawCompanyCode && parsed.rawAreaCode) {
          attachAssign(
            `area_${parsed.rawCompanyCode}_${parsed.rawAreaCode}`,
            query(
              collection(db, 'edu_assignments'),
              where('companyCode', '==', parsed.rawCompanyCode),
              where('areaCode', '==', parsed.rawAreaCode)
            )
          );
          attachCms(
            `area_${parsed.rawCompanyCode}_${parsed.rawAreaCode}`,
            query(
              collection(db, 'edu_cms_profiles'),
              where('companyCode', '==', parsed.rawCompanyCode),
              where('areaCode', '==', parsed.rawAreaCode)
            )
          );
        } else if (parsed.rawAreaCode) {
          attachAssign(
            `area_${parsed.rawAreaCode}`,
            query(collection(db, 'edu_assignments'), where('areaCode', '==', parsed.rawAreaCode))
          );
          attachCms(
            `area_${parsed.rawAreaCode}`,
            query(collection(db, 'edu_cms_profiles'), where('areaCode', '==', parsed.rawAreaCode))
          );
        }
      });
    } else if (role === 'SION_LEADER') {
      attachAssign('own', query(collection(db, 'edu_assignments'), where('assignedByUid', '==', uid)));
      attachCms('own', query(collection(db, 'edu_cms_profiles'), where('ownerUid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const effectiveComps = Array.from(
        new Set((compCodes.length ? compCodes : [effectiveCurrentUser.companyCode]).filter(Boolean))
      );
      effectiveComps.forEach((cCode) => {
        attachAssign(`sion_${cCode}`, query(collection(db, 'edu_assignments'), where('companyCode', '==', cCode)));
        attachCms(`sion_${cCode}`, query(collection(db, 'edu_cms_profiles'), where('companyCode', '==', cCode)));
      });
    } else if (role === 'AREA_LEADER') {
      attachAssign('own', query(collection(db, 'edu_assignments'), where('assignedByUid', '==', uid)));
      attachCms('own', query(collection(db, 'edu_cms_profiles'), where('ownerUid', '==', uid)));
      const compCodes: string[] = JSON.parse(managedCompKey);
      const areaCodes: string[] = JSON.parse(managedAreaKey);
      getAreaLeaderQueryPairs(
        compCodes,
        areaCodes,
        effectiveCurrentUser.companyCode,
        effectiveCurrentUser.areaCode
      ).forEach(({ key, companyCode, areaCode }) => {
        attachAssign(
          `leader_${key}`,
          query(
            collection(db, 'edu_assignments'),
            where('companyCode', '==', companyCode),
            where('areaCode', '==', areaCode)
          )
        );
        attachCms(
          `leader_${key}`,
          query(
            collection(db, 'edu_cms_profiles'),
            where('companyCode', '==', companyCode),
            where('areaCode', '==', areaCode)
          )
        );
      });
    } else if (role === 'UNI_LEADER') {
      attachAssign('own', query(collection(db, 'edu_assignments'), where('assignedByUid', '==', uid)));
      attachCms('own', query(collection(db, 'edu_cms_profiles'), where('ownerUid', '==', uid)));
      if (effectiveCurrentUser.companyCode && effectiveCurrentUser.areaCode) {
        attachAssign(
          'uni_area',
          query(
            collection(db, 'edu_assignments'),
            where('companyCode', '==', effectiveCurrentUser.companyCode),
            where('areaCode', '==', effectiveCurrentUser.areaCode)
          )
        );
        attachCms(
          'uni_area',
          query(
            collection(db, 'edu_cms_profiles'),
            where('companyCode', '==', effectiveCurrentUser.companyCode),
            where('areaCode', '==', effectiveCurrentUser.areaCode)
          )
        );
      }
    } else {
      // MEMBER (TĐ): Chỉ xem lịch phân công / hồ sơ CMS của chính mình
      attachAssign('own', query(collection(db, 'edu_assignments'), where('assignedByUid', '==', uid)));
      attachAssign('self_member', query(collection(db, 'edu_assignments'), where('memberId', '==', memberId)));
      attachCms('own', query(collection(db, 'edu_cms_profiles'), where('ownerUid', '==', uid)));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    dataUnlocked,
    firebaseUser?.uid,
    effectiveCurrentUser?.role,
    effectiveCurrentUser?.memberId,
    effectiveCurrentUser?.companyCode,
    effectiveCurrentUser?.areaCode,
    managedCompKey,
    managedAreaKey,
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
      huongKhiList
        .filter((hk) => isGratitudePostActive(hk, nowMs))
        .map((hk) => ({
          ...hk,
          userReaction: currentUser ? hk.userReactions?.[currentUser.id] : undefined,
        })),
    [huongKhiList, currentUser?.id, nowMs]
  );

  const myHuongKhiList = useMemo(() => {
    if (!currentUser) return [];
    return huongKhiView.filter(
      (h) => h.authorUid === currentUser.id || h.authorId === currentUser.memberId
    );
  }, [huongKhiView, currentUser]);

  const kpiData = useMemo(() => {
    const activeMembers = rankedMembers.filter((m) => m.active);
    const totalReportsInEvent = dailyReports.filter((r) => {
      if (!activeEvent) return true;
      return r.date >= activeEvent.startDate && r.date <= activeEvent.endDate;
    }).length;
    const totalPoints = activeMembers.reduce((acc, m) => acc + (m.score || 0), 0);

    return {
      totalTeams: effectiveCompanies.length,
      totalMembers: activeMembers.length,
      totalTargets: totalReportsInEvent,
      totalPoints,
      lastUpdated,
    };
  }, [rankedMembers, effectiveCompanies, dailyReports, activeEvent, lastUpdated]);

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
    const resolvedUnit = (currentUser.unitCode || currentUser.departmentCode || '').trim();
    const payload: Omit<DailyReportRecord, 'id'> = JSON.parse(
      JSON.stringify({
        uid,
        memberId,
        companyCode: currentUser.companyCode,
        areaCode: currentUser.areaCode,
        ...(resolvedUnit ? { unitCode: resolvedUnit } : {}),
        date,
        month: `${year}-${month}`,
        year,
        goals,
        results,
        updatedAt: new Date().toISOString(),
      })
    );

    try {
      await setDoc(doc(db, 'dailyReports', reportId), payload);
    } catch (err) {
      void diagnoseWriteDenied('dailyReports', reportId, payload as Record<string, any>, err);
      throw err;
    }

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

    const hasMemberDoc = members.some((m) => m.id === memberId);
    const memberSyncOp = hasMemberDoc
      ? updateDoc(doc(db, 'members', memberId), {
          dailyResults: aggregated,
          dailyGoals: goals,
          score: newScore,
        })
      : setDoc(
          doc(db, 'members', memberId),
          JSON.parse(
            JSON.stringify({
              code: `MEM-${uid.slice(0, 6).toUpperCase()}`,
              fullName: currentUser.fullName,
              companyCode: currentUser.companyCode,
              areaCode: currentUser.areaCode,
              departmentCode: currentUser.departmentCode,
              ...(currentUser.unitCode ? { unitCode: currentUser.unitCode } : {}),
              active: true,
              score: newScore,
              dailyResults: aggregated,
              dailyGoals: goals,
              goals: { s1: 10, s2: 8, s3: 5, s4: 4, s5: 4, s6: 2 },
              results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
              targets: [],
              createdAt: new Date().toISOString().split('T')[0],
            })
          ),
          { merge: true }
        );
    memberSyncOp.catch((err) => console.warn('Cập nhật điểm member:', err));
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
    const goalPayload = {
      uid,
      periodType,
      periodKey,
      goals,
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'periodGoals', goalId), goalPayload);
    } catch (err) {
      void diagnoseWriteDenied('periodGoals', goalId, goalPayload, err);
      throw err;
    }
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
        llvWidgets: config.llvWidgets || DEFAULT_LLV_WIDGET_VISIBILITY,
        logo: config.logo || DEFAULT_APP_LOGO_CONFIG,
        updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(doc(db, 'system_config', 'appearance'), clean);
  };

  // ---------- Cấu hình Phê duyệt Đăng ký & Duyệt / Từ chối tài khoản (Admin & Super Admin) ----------
  const handleSaveSecurityConfig = async (nextConfig: SystemSecurityConfig) => {
    const clean = JSON.parse(
      JSON.stringify({
        requireRegistrationApproval: nextConfig.requireRegistrationApproval,
        autoApprovePreAssigned: nextConfig.autoApprovePreAssigned,
        updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(doc(db, 'system_config', 'security'), clean);
  };

  const handleSaveVocabularyConfig = async (nextConfig: SystemVocabularyConfig) => {
    const clean = JSON.parse(
      JSON.stringify({
        enabled: nextConfig.enabled !== false,
        rules: nextConfig.rules,
        updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: new Date().toISOString(),
      })
    );
    await setDoc(doc(db, 'system_config', 'vocabulary'), clean);
  };

  // Đồng bộ tự động managedCompanyCodes cho các QL Cụm (MANAGER) đang gắn với Cụm Sion
  const syncManagerClusters = useCallback(
    async (nextClusters: OrgCluster[], nextCompanies: Company[]): Promise<number> => {
      if (!isAdminUser) return 0;
      const nowIso = new Date().toISOString();
      const batch = writeBatch(db);
      let syncedUsersCount = 0;

      const updatedUsersMap = new Map<string, string[]>();
      usersList.forEach((u) => {
        if (u.role !== 'MANAGER' || !u.managedClusterIds?.length) return;
        const resolvedComps = resolveCompanyCodesFromClusterIds(
          u.managedClusterIds,
          nextClusters,
          nextCompanies
        );
        if (!areCodeListsEqual(u.managedCompanyCodes, resolvedComps)) {
          batch.update(doc(db, 'users', u.id), {
            managedCompanyCodes: resolvedComps,
          });
          updatedUsersMap.set(u.id, resolvedComps);
          syncedUsersCount += 1;

          const cleanEmail = (u.email || '').trim().toLowerCase();
          if (isSuperAdminUser && cleanEmail) {
            batch.set(
              doc(db, 'role_claims', cleanEmail),
              {
                email: cleanEmail,
                role: u.role,
                managedClusterIds: u.managedClusterIds,
                managedCompanyCodes: resolvedComps,
                updatedAt: nowIso,
              },
              { merge: true }
            );
          }
        }
      });

      let nextPreAssigned: RoleAssignment[] | null = null;
      if (isSuperAdminUser && preAssignedRoles.length > 0) {
        let claimChanged = false;
        const mapped = preAssignedRoles.map((a) => {
          if (a.role !== 'MANAGER' || !a.managedClusterIds?.length) return a;
          const resolvedComps = resolveCompanyCodesFromClusterIds(
            a.managedClusterIds,
            nextClusters,
            nextCompanies
          );
          if (!areCodeListsEqual(a.managedCompanyCodes, resolvedComps)) {
            claimChanged = true;
            const cleanEmail = a.email.trim().toLowerCase();
            batch.set(
              doc(db, 'role_claims', cleanEmail),
              {
                email: cleanEmail,
                role: a.role,
                managedClusterIds: a.managedClusterIds,
                managedCompanyCodes: resolvedComps,
                updatedAt: nowIso,
              },
              { merge: true }
            );
            return { ...a, managedCompanyCodes: resolvedComps };
          }
          return a;
        });
        if (claimChanged) {
          nextPreAssigned = mapped;
          batch.set(
            doc(db, 'system_config', 'roles'),
            {
              assignments: mapped,
              updatedAt: nowIso,
              updatedBy: effectiveCurrentUser?.fullName || 'Admin',
            },
            { merge: true }
          );
        }
      }

      if (syncedUsersCount > 0 || nextPreAssigned) {
        await batch.commit();
        if (updatedUsersMap.size > 0) {
          setUsersList((prev) =>
            prev.map((u) =>
              updatedUsersMap.has(u.id)
                ? { ...u, managedCompanyCodes: updatedUsersMap.get(u.id)! }
                : u
            )
          );
          if (currentUser && updatedUsersMap.has(currentUser.id)) {
            setCurrentUser((prev) =>
              prev ? { ...prev, managedCompanyCodes: updatedUsersMap.get(prev.id)! } : null
            );
          }
        }
        if (nextPreAssigned) {
          setPreAssignedRoles(nextPreAssigned);
        }
      }

      return syncedUsersCount;
    },
    [
      isAdminUser,
      isSuperAdminUser,
      usersList,
      preAssignedRoles,
      effectiveCurrentUser?.fullName,
      currentUser,
    ]
  );

  const handleSaveClustersConfig = async (
    nextConfig: SystemClustersConfig
  ): Promise<{ syncedCount: number }> => {
    const nowIso = new Date().toISOString();
    const clean = JSON.parse(
      JSON.stringify({
        clusters: nextConfig.clusters,
        updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        updatedAt: nowIso,
      })
    );
    await setDoc(doc(db, 'system_config', 'clusters'), clean);
    const syncedCount = await syncManagerClusters(nextConfig.clusters, effectiveCompanies);
    return { syncedCount };
  };

  const handleApproveUser = async (
    targetUser: UserAccount,
    options?: {
      role?: UserRole;
      companyCode?: string;
      areaCode?: string;
      unitCode?: string;
      scope?: {
        managedClusterIds?: string[];
        managedCompanyCodes?: string[];
        managedAreaCodes?: string[];
        managedUnitCodes?: string[];
      };
    }
  ) => {
    if (!isAdminUser) return;
    const nowIso = new Date().toISOString();
    const approverName = effectiveCurrentUser?.fullName || 'Admin';
    const rawNextCompany = (options?.companyCode || targetUser.companyCode || '').trim();
    const matchedExistingComp = companies.find(
      (c) => normalizeOrgCode(c.code) === normalizeOrgCode(rawNextCompany)
    );
    const nextCompany = matchedExistingComp?.code || rawNextCompany;
    const nextArea = cleanRawAreaCode(options?.areaCode || targetUser.areaCode);
    const nextUnit =
      options?.unitCode !== undefined ? options.unitCode.trim() : targetUser.unitCode || '';

    const canAssignRole =
      options?.role &&
      (options.role !== 'SUPER_ADMIN' || isSuperAdminUser) &&
      (targetUser.role !== 'SUPER_ADMIN' || isSuperAdminUser);
    const nextRole = canAssignRole ? options!.role! : targetUser.role;

    const userPatch: Record<string, unknown> = {
      approvalStatus: 'APPROVED',
      approvedBy: approverName,
      approvedAt: nowIso,
      rejectionReason: deleteField(),
      companyCode: nextCompany,
      areaCode: nextArea,
      ...(nextUnit ? { unitCode: nextUnit } : {}),
      ...(canAssignRole ? { role: nextRole, roleUpdatedAt: nowIso } : {}),
      ...(options?.scope?.managedClusterIds !== undefined
        ? { managedClusterIds: options.scope.managedClusterIds }
        : {}),
      ...(options?.scope?.managedCompanyCodes !== undefined
        ? { managedCompanyCodes: options.scope.managedCompanyCodes }
        : {}),
      ...(options?.scope?.managedAreaCodes !== undefined
        ? { managedAreaCodes: options.scope.managedAreaCodes }
        : {}),
      ...(options?.scope?.managedUnitCodes !== undefined
        ? { managedUnitCodes: options.scope.managedUnitCodes }
        : {}),
    };

    const memberId = targetUser.memberId || `m-${targetUser.id}`;
    const existingMember = members.find((m) => m.id === memberId);
    const memberPayload = existingMember
      ? JSON.parse(
          JSON.stringify({
            active: true,
            fullName: targetUser.fullName,
            companyCode: nextCompany,
            areaCode: nextArea,
            departmentCode: targetUser.departmentCode,
            ...(nextUnit ? { unitCode: nextUnit } : {}),
          })
        )
      : JSON.parse(
          JSON.stringify({
            code: `MEM-${targetUser.id.slice(0, 6).toUpperCase()}`,
            fullName: targetUser.fullName,
            companyCode: nextCompany,
            areaCode: nextArea,
            departmentCode: targetUser.departmentCode,
            ...(nextUnit ? { unitCode: nextUnit } : {}),
            active: true,
            score: 0,
            avatarUrl: targetUser.avatarUrl,
            goals: { s1: 10, s2: 8, s3: 5, s4: 4, s5: 4, s6: 2 },
            results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
            targets: [],
            createdAt: nowIso.split('T')[0],
          })
        );

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', targetUser.id), userPatch);
    batch.set(doc(db, 'members', memberId), memberPayload, { merge: true });

    // Cách 2: Tự động tạo Sion & Khu vực nếu tài khoản mới được duyệt khai báo KV/Sion chưa có trong danh mục (bỏ qua nếu đã xóa)
    const orderStamp = Date.now();
    const nextCompNorm = normalizeOrgCode(nextCompany);
    const nextAreaKey = normalizeDeletedAreaKey(nextCompany, nextArea);
    if (nextCompany && !matchedExistingComp && !deletedCompanySet.has(nextCompNorm)) {
      batch.set(
        doc(db, 'companies', makeDeterministicCompanyId(nextCompany)),
        {
          code: nextCompany,
          name: getDefaultCompanyDisplayName(nextCompany),
          active: true,
          _order: orderStamp,
        },
        { merge: true }
      );
    }

    const areaAlreadyExists = areas.some(
      (a) =>
        normalizeOrgCode(a.companyCode) === nextCompNorm &&
        normalizeOrgCode(cleanRawAreaCode(a.code)) === normalizeOrgCode(nextArea)
    );
    if (
      nextCompany &&
      nextArea &&
      !areaAlreadyExists &&
      !deletedCompanySet.has(nextCompNorm) &&
      !deletedAreaKeySet.has(nextAreaKey)
    ) {
      batch.set(
        doc(db, 'areas', makeDeterministicAreaId(nextCompany, nextArea)),
        {
          code: nextArea,
          name: nextArea,
          companyCode: nextCompany,
          active: true,
          _order: orderStamp,
        },
        { merge: true }
      );
    }

    await batch.commit();

    const cleanTargetEmail = (targetUser.email || '').trim().toLowerCase();
    if (
      canAssignRole &&
      cleanTargetEmail &&
      (isSuperAdminUser || (getRoleLevel(targetUser.role) <= 5 && getRoleLevel(nextRole) <= 5))
    ) {
      if (nextRole !== 'MEMBER') {
        const claimData = JSON.parse(
          JSON.stringify({
            email: cleanTargetEmail,
            role: nextRole,
            grantedBy: approverName,
            grantedAt: nowIso.split('T')[0],
            managedClusterIds: options?.scope?.managedClusterIds,
            managedCompanyCodes: options?.scope?.managedCompanyCodes,
            managedAreaCodes: options?.scope?.managedAreaCodes,
            managedUnitCodes: options?.scope?.managedUnitCodes,
            updatedAt: nowIso,
          })
        );
        setDoc(doc(db, 'role_claims', cleanTargetEmail), claimData).catch((e) =>
          console.warn('[Firestore] Lỗi đồng bộ role_claims khi duyệt:', e)
        );
      }
      if (
        isSuperAdminUser &&
        (preAssignedRoles.some((p) => p.email.toLowerCase() === cleanTargetEmail) ||
          nextRole === 'ADMIN' ||
          nextRole === 'SUPER_ADMIN')
      ) {
        const existingPre = preAssignedRoles.find((p) => p.email.toLowerCase() === cleanTargetEmail);
        const updatedAssignments = preAssignedRoles.filter(
          (p) => p.email.toLowerCase() !== cleanTargetEmail
        );
        if (nextRole !== 'MEMBER') {
          updatedAssignments.push(
            JSON.parse(
              JSON.stringify({
                email: cleanTargetEmail,
                role: nextRole,
                grantedBy: approverName,
                grantedAt: existingPre?.grantedAt || nowIso.split('T')[0],
                note: existingPre?.note,
                managedClusterIds: options?.scope?.managedClusterIds,
                managedCompanyCodes: options?.scope?.managedCompanyCodes,
                managedAreaCodes: options?.scope?.managedAreaCodes,
                managedUnitCodes: options?.scope?.managedUnitCodes,
                updatedAt: nowIso,
              })
            )
          );
        }
        const superAdmins = Array.from(
          new Set([
            ...BOOTSTRAP_SUPER_ADMIN_EMAILS,
            ...updatedAssignments
              .filter((a) => a.role === 'SUPER_ADMIN')
              .map((a) => a.email.toLowerCase()),
          ])
        );
        const admins = Array.from(
          new Set(
            updatedAssignments.filter((a) => a.role === 'ADMIN').map((a) => a.email.toLowerCase())
          )
        );
        setPreAssignedRoles(updatedAssignments);
        setDoc(
          doc(db, 'system_config', 'roles'),
          {
            superAdmins,
            admins,
            assignments: updatedAssignments,
            updatedAt: nowIso,
            updatedBy: approverName,
          },
          { merge: true }
        ).catch((e) => console.warn('[Firestore] Lỗi đồng bộ system_config/roles khi duyệt:', e));
      }
    }

    setUsersList((prev) =>
      prev.map((u) =>
        u.id === targetUser.id
          ? {
              ...u,
              approvalStatus: 'APPROVED',
              approvedBy: approverName,
              approvedAt: nowIso,
              rejectionReason: undefined,
              companyCode: nextCompany,
              areaCode: nextArea,
              ...(nextUnit ? { unitCode: nextUnit } : {}),
              role: nextRole,
              ...(canAssignRole ? { roleUpdatedAt: nowIso } : {}),
            }
          : u
      )
    );
    showNotification(
      !areaAlreadyExists && nextArea
        ? `Đã phê duyệt "${targetUser.fullName}" và tự động thêm KV ${nextArea} (${nextCompany})!`
        : `Đã phê duyệt tài khoản "${targetUser.fullName}"!`
    );
  };

  const handleRejectUser = async (targetUser: UserAccount, reason?: string) => {
    if (!isAdminUser) return;
    if (targetUser.role === 'SUPER_ADMIN' && !isSuperAdminUser) {
      showNotification('Không thể từ chối tài khoản Tổng Quản trị.');
      return;
    }
    const nowIso = new Date().toISOString();
    const approverName = effectiveCurrentUser?.fullName || 'Admin';
    const cleanReason = (reason || '').trim().slice(0, 300);
    const memberId = targetUser.memberId || `m-${targetUser.id}`;

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', targetUser.id), {
      approvalStatus: 'REJECTED',
      approvedBy: approverName,
      approvedAt: nowIso,
      rejectionReason: cleanReason,
    });
    if (members.some((m) => m.id === memberId)) {
      batch.set(doc(db, 'members', memberId), { active: false }, { merge: true });
    }
    await batch.commit();

    setUsersList((prev) =>
      prev.map((u) =>
        u.id === targetUser.id
          ? {
              ...u,
              approvalStatus: 'REJECTED',
              approvedBy: approverName,
              approvedAt: nowIso,
              rejectionReason: cleanReason,
            }
          : u
      )
    );
    showNotification(`Đã từ chối yêu cầu đăng ký của "${targetUser.fullName}".`);
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

  // ---------- Quản lý vai trò người dùng (7 cấp + phạm vi Cụm / Sion / Khu vực / Uni) ----------
  const handleUpdateUserRole = async (
    targetUserId: string,
    newRole: UserRole,
    targetName: string,
    scope?: {
      managedClusterIds?: string[];
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
      companyCode?: string;
      areaCode?: string;
      unitCode?: string;
    }
  ) => {
    const targetUserObj = usersList.find((u) => u.id === targetUserId);
    const currentTargetRole: UserRole = targetUserObj?.role || 'MEMBER';

    if (!canAssignTargetRole(effectiveCurrentUser?.role, currentTargetRole, newRole)) {
      const msg = 'Bạn chỉ được phân quyền cho tài khoản cấp thấp hơn trong phạm vi quản lý.';
      showNotification(msg);
      throw new Error(msg);
    }

    if (!isSuperAdminUser && targetUserId === effectiveCurrentUser?.id) {
      const msg = 'Không thể tự thay đổi quyền của chính mình.';
      showNotification(msg);
      throw new Error(msg);
    }

    const nowIso = new Date().toISOString();
    const nextHomeCompany =
      isAdminUser && scope?.companyCode !== undefined ? scope.companyCode.trim() : undefined;
    const nextHomeArea =
      isAdminUser && scope?.areaCode !== undefined ? cleanRawAreaCode(scope.areaCode) : undefined;
    const nextHomeUnit =
      isAdminUser && scope?.unitCode !== undefined ? scope.unitCode.trim() : undefined;

    const cleanPatch = JSON.parse(
      JSON.stringify({
        role: newRole,
        roleUpdatedAt: nowIso,
        ...(scope?.managedClusterIds !== undefined
          ? { managedClusterIds: scope.managedClusterIds }
          : {}),
        ...(scope?.managedCompanyCodes !== undefined
          ? { managedCompanyCodes: scope.managedCompanyCodes }
          : {}),
        ...(scope?.managedAreaCodes !== undefined
          ? { managedAreaCodes: scope.managedAreaCodes }
          : {}),
        ...(scope?.managedUnitCodes !== undefined
          ? { managedUnitCodes: scope.managedUnitCodes }
          : {}),
        ...(nextHomeCompany !== undefined ? { companyCode: nextHomeCompany } : {}),
        ...(nextHomeArea !== undefined ? { areaCode: nextHomeArea } : {}),
        ...(nextHomeUnit !== undefined ? { unitCode: nextHomeUnit } : {}),
      })
    );

    const prevTargetSnapshot = targetUserObj;
    setUsersList((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, ...cleanPatch } : u))
    );
    if (currentUser && currentUser.id === targetUserId) {
      setCurrentUser((prev) => (prev ? { ...prev, ...cleanPatch } : null));
    }

    try {
      await updateDoc(doc(db, 'users', targetUserId), cleanPatch);

      if (
        isAdminUser &&
        (nextHomeCompany !== undefined || nextHomeArea !== undefined || nextHomeUnit !== undefined)
      ) {
        const linkedMemberId = targetUserObj?.memberId || `m-${targetUserId}`;
        const existingMember = members.find((m) => m.id === linkedMemberId);
        if (existingMember) {
          const memberPatch = JSON.parse(
            JSON.stringify({
              ...(nextHomeCompany !== undefined ? { companyCode: nextHomeCompany } : {}),
              ...(nextHomeArea !== undefined ? { areaCode: nextHomeArea } : {}),
              ...(nextHomeUnit !== undefined ? { unitCode: nextHomeUnit } : {}),
            })
          );
          await updateDoc(doc(db, 'members', linkedMemberId), memberPatch).catch((e) =>
            console.warn('[Firestore] Lỗi đồng bộ đơn vị cho members:', e)
          );
        }
      }

      const cleanEmail = (targetUserObj?.email || '').trim().toLowerCase();
      const canSyncRoleClaim =
        Boolean(cleanEmail) &&
        (isSuperAdminUser ||
          (isAdminUser && getRoleLevel(currentTargetRole) <= 5 && getRoleLevel(newRole) <= 5));
      const hasAnyManagedScope = Boolean(
        scope?.managedClusterIds?.length ||
          scope?.managedCompanyCodes?.length ||
          scope?.managedAreaCodes?.length ||
          scope?.managedUnitCodes?.length
      );

      if (canSyncRoleClaim) {
        if (newRole === 'MEMBER' && !hasAnyManagedScope) {
          await deleteDoc(doc(db, 'role_claims', cleanEmail)).catch((e) =>
            console.warn('[Firestore] Lỗi xóa role_claims:', e)
          );
        } else {
          const claimData = JSON.parse(
            JSON.stringify({
              email: cleanEmail,
              role: newRole,
              grantedBy: effectiveCurrentUser?.fullName || 'Ban Quản Trị',
              grantedAt: nowIso.split('T')[0],
              managedClusterIds: scope?.managedClusterIds,
              managedCompanyCodes: scope?.managedCompanyCodes,
              managedAreaCodes: scope?.managedAreaCodes,
              managedUnitCodes: scope?.managedUnitCodes,
              updatedAt: nowIso,
            })
          );
          await setDoc(doc(db, 'role_claims', cleanEmail), claimData).catch((e) =>
            console.warn('[Firestore] Lỗi đồng bộ role_claims:', e)
          );
        }
      }

      // Đồng bộ system_config/roles khi Tổng Quản trị cập nhật hoặc hạ quyền tài khoản
      if (isSuperAdminUser && cleanEmail) {
        const existedInAssignments = preAssignedRoles.some(
          (a) => a.email.toLowerCase() === cleanEmail
        );
        const touchesAdminTier =
          currentTargetRole === 'ADMIN' ||
          currentTargetRole === 'SUPER_ADMIN' ||
          newRole === 'ADMIN' ||
          newRole === 'SUPER_ADMIN';
        if (existedInAssignments || touchesAdminTier) {
          const existingEntry = preAssignedRoles.find(
            (a) => a.email.toLowerCase() === cleanEmail
          );
          const nextAssignments = preAssignedRoles.filter(
            (a) => a.email.toLowerCase() !== cleanEmail
          );
          if (!(newRole === 'MEMBER' && !hasAnyManagedScope)) {
            nextAssignments.push(
              JSON.parse(
                JSON.stringify({
                  email: cleanEmail,
                  role: newRole,
                  grantedBy: effectiveCurrentUser?.fullName || 'Quản trị viên tổng',
                  grantedAt: existingEntry?.grantedAt || nowIso.split('T')[0],
                  note: existingEntry?.note,
                  managedClusterIds: scope?.managedClusterIds,
                  managedCompanyCodes: scope?.managedCompanyCodes,
                  managedAreaCodes: scope?.managedAreaCodes,
                  managedUnitCodes: scope?.managedUnitCodes,
                  updatedAt: nowIso,
                })
              )
            );
          }
          const superAdmins = Array.from(
            new Set([
              ...BOOTSTRAP_SUPER_ADMIN_EMAILS,
              ...nextAssignments
                .filter((a) => a.role === 'SUPER_ADMIN')
                .map((a) => a.email.toLowerCase()),
            ])
          );
          const admins = Array.from(
            new Set(
              nextAssignments.filter((a) => a.role === 'ADMIN').map((a) => a.email.toLowerCase())
            )
          );
          setPreAssignedRoles(nextAssignments);
          await setDoc(
            doc(db, 'system_config', 'roles'),
            {
              superAdmins,
              admins,
              assignments: nextAssignments,
              updatedAt: nowIso,
              updatedBy: effectiveCurrentUser?.fullName || 'Quản trị viên tổng',
            },
            { merge: true }
          ).catch((e) => console.warn('[Firestore] Lỗi đồng bộ system_config/roles:', e));
        }
      }

      showNotification(`Đã cập nhật quyền cho "${targetName}" thành công!`);
    } catch (err: any) {
      if (prevTargetSnapshot) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === targetUserId ? prevTargetSnapshot : u))
        );
      }
      console.error('[Firestore] Lỗi phân quyền:', err);
      void logUserContext({
        queryPoint: `users/${targetUserId} (roleUpdate: ${currentTargetRole} -> ${newRole})`,
        operation: 'UPDATE',
        error: err,
        uiUser: effectiveCurrentUser,
      });
      showNotification(`Lỗi phân quyền: ${err?.message || 'Không thể cập nhật quyền'}`);
      throw err;
    }
  };

  const handleResetUserPin = async (
    targetUserId: string,
    targetName: string,
    newPin?: string
  ) => {
    if (!isAdminUser) {
      const msg = 'Chỉ Admin (Cấp 6) và Tổng Quản trị (Cấp 7) mới có quyền đổi hoặc đặt lại Mã PIN.';
      showNotification(msg);
      throw new Error(msg);
    }

    const targetUserObj = usersList.find((u) => u.id === targetUserId);
    if (!isSuperAdminUser && targetUserObj?.role === 'SUPER_ADMIN') {
      const msg = 'Không thể thay đổi Mã PIN của tài khoản Tổng Quản trị.';
      showNotification(msg);
      throw new Error(msg);
    }

    try {
      if (newPin !== undefined) {
        const cleanPin = newPin.trim();
        if (!isValidPersonalPin(cleanPin)) {
          const msg = 'Mã cá nhân mới phải gồm đúng 6 chữ số.';
          showNotification(msg);
          throw new Error(msg);
        }
        const pinHash = await hashPersonalPin(targetUserId, cleanPin);
        const nowIso = new Date().toISOString();
        await updateDoc(doc(db, 'users', targetUserId), {
          pinHash,
          pinUpdatedAt: nowIso,
        });
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === targetUserId ? { ...u, pinHash, pinUpdatedAt: nowIso } : u
          )
        );
        if (currentUser?.id === targetUserId) {
          setCurrentUser((prev) => (prev ? { ...prev, pinHash, pinUpdatedAt: nowIso } : null));
        }
        showNotification(`Đã thay đổi Mã cá nhân 6 số cho "${targetName}" thành công!`);
        return;
      }

      await updateDoc(doc(db, 'users', targetUserId), {
        pinHash: deleteField(),
        pinUpdatedAt: deleteField(),
      });
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === targetUserId ? { ...u, pinHash: undefined, pinUpdatedAt: undefined } : u
        )
      );
      if (currentUser?.id === targetUserId) {
        setCurrentUser((prev) =>
          prev ? { ...prev, pinHash: undefined, pinUpdatedAt: undefined } : null
        );
        setPinUnlockedUid(null);
      }
      showNotification(
        `Đã đặt lại Mã cá nhân cho "${targetName}". Tài khoản sẽ tạo mã 6 số mới ở lần đăng nhập kế tiếp.`
      );
    } catch (err: any) {
      console.error('[Firestore] Lỗi cập nhật PIN:', err);
      showNotification(`Không thể cập nhật Mã PIN: ${err?.message || 'Lỗi không xác định'}`);
      throw err;
    }
  };

  const handleDeleteUserAccount = async (
    targetUserId: string,
    targetName: string,
    targetEmail?: string
  ) => {
    try {
      await deleteDoc(doc(db, 'users', targetUserId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${targetUserId}`);
      throw err;
    }

    const linkedMemberId =
      usersList.find((u) => u.id === targetUserId)?.memberId || `m-${targetUserId}`;
    setUsersList((prev) => prev.filter((u) => u.id !== targetUserId));
    setMembers((prev) => prev.filter((m) => m.id !== linkedMemberId));
    deleteDoc(doc(db, 'members', linkedMemberId)).catch((e) =>
      console.warn('[Firestore] Lỗi xóa member sau khi xóa TK:', e)
    );

    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    if (cleanEmail) {
      deleteDoc(doc(db, 'role_claims', cleanEmail)).catch((e) =>
        console.warn('[Firestore] Lỗi xóa role_claims sau khi xóa TK:', e)
      );
    }

    if (cleanEmail && preAssignedRoles.some((a) => a.email.toLowerCase() === cleanEmail)) {
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
            updatedBy: currentUser?.fullName || 'Quản trị viên tổng',
          },
          { merge: true }
        );
        setPreAssignedRoles(updated);
      } catch (err) {
        console.warn('[Firestore] Lỗi đồng bộ system_config/roles sau khi xóa TK:', err);
      }
    }

    showNotification(`Đã xóa tài khoản "${targetName}" khỏi danh sách phân quyền.`);
  };

  const handlePreAssignRole = async (
    email: string,
    role: UserRole,
    note?: string,
    scope?: {
      managedClusterIds?: string[];
      managedCompanyCodes?: string[];
      managedAreaCodes?: string[];
      managedUnitCodes?: string[];
    }
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const newAssignment: RoleAssignment = JSON.parse(
      JSON.stringify({
        email: cleanEmail,
        role,
        grantedBy: effectiveCurrentUser?.fullName || 'Quản trị viên tổng',
        grantedAt: nowIso.split('T')[0],
        updatedAt: nowIso,
        note: note || undefined,
        managedClusterIds: scope?.managedClusterIds,
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
      const needsApproval = resolveUserApprovalStatus(target) !== 'APPROVED';
      const targetPatch: Record<string, unknown> = JSON.parse(
        JSON.stringify({
          role,
          roleUpdatedAt: nowIso,
          ...(scope?.managedClusterIds !== undefined
            ? { managedClusterIds: scope.managedClusterIds }
            : {}),
          ...(scope?.managedCompanyCodes !== undefined
            ? { managedCompanyCodes: scope.managedCompanyCodes }
            : {}),
          ...(scope?.managedAreaCodes !== undefined
            ? { managedAreaCodes: scope.managedAreaCodes }
            : {}),
          ...(scope?.managedUnitCodes !== undefined
            ? { managedUnitCodes: scope.managedUnitCodes }
            : {}),
          ...(needsApproval
            ? {
                approvalStatus: 'APPROVED',
                approvedBy: effectiveCurrentUser?.fullName || 'Admin',
                approvedAt: nowIso,
              }
            : {}),
        })
      );
      setUsersList((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, ...targetPatch } : u))
      );
      await updateDoc(doc(db, 'users', target.id), {
        ...targetPatch,
        ...(needsApproval ? { rejectionReason: deleteField() } : {}),
      }).catch((e) => console.warn('Lỗi phân quyền trực tiếp:', e));

      if (needsApproval) {
        const targetMemberId = target.memberId || `m-${target.id}`;
        if (members.some((m) => m.id === targetMemberId)) {
          await setDoc(doc(db, 'members', targetMemberId), { active: true }, { merge: true }).catch(
            (e) => console.warn('Lỗi kích hoạt thành viên:', e)
          );
        }
      }
    }

    // Lưu bản ghi riêng tại role_claims/{cleanEmail} để user tự đọc được vai trò của riêng mình mà không cần mở system_config/roles
    await setDoc(doc(db, 'role_claims', cleanEmail), newAssignment).catch((err) =>
      console.warn('Lỗi ghi role_claims:', err)
    );

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
          updatedAt: nowIso,
          updatedBy: effectiveCurrentUser?.fullName || 'Quản trị viên tổng',
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Lỗi ghi system_config/roles:', err);
    }
  };

  const handleDeletePreAssignedRole = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const updated = preAssignedRoles.filter((a) => a.email.toLowerCase() !== cleanEmail);

    await deleteDoc(doc(db, 'role_claims', cleanEmail)).catch((err) =>
      console.warn('Lỗi xóa role_claims:', err)
    );

    const linkedUser = usersList.find((u) => (u.email || '').toLowerCase().trim() === cleanEmail);
    if (
      linkedUser &&
      linkedUser.id !== currentUser?.id &&
      !isBootstrapSuperAdminEmail(cleanEmail) &&
      linkedUser.role !== 'MEMBER'
    ) {
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === linkedUser.id
            ? {
                ...u,
                role: 'MEMBER',
                roleUpdatedAt: nowIso,
                managedClusterIds: [],
                managedCompanyCodes: [],
                managedAreaCodes: [],
                managedUnitCodes: [],
              }
            : u
        )
      );
      await updateDoc(doc(db, 'users', linkedUser.id), {
        role: 'MEMBER',
        roleUpdatedAt: nowIso,
        managedClusterIds: [],
        managedCompanyCodes: [],
        managedAreaCodes: [],
        managedUnitCodes: [],
      }).catch((err) => console.warn('Lỗi hạ quyền tài khoản sau khi thu hồi:', err));
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
          updatedAt: nowIso,
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Lỗi thu hồi quyền:', err);
    }

    setPreAssignedRoles(updated);
    showNotification(`Đã thu hồi cấp quyền trước của ${email}`);
  };

  // ---------- Đăng ký / Hoàn tất hồ sơ lần đầu / Mã PIN 6 số / Đăng xuất ----------
  const handleRegister = async (data: RegistrationData): Promise<void> => {
    pendingRegistrationRef.current = data;
    try {
      await registerWithEmail(data.email, data.password);
    } catch (err) {
      pendingRegistrationRef.current = null;
      throw err;
    }
  };

  const handleCompleteOnboarding = async (data: OnboardingSubmitData): Promise<void> => {
    if (!firebaseUser) return;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const existing = await getDocFromServer(userRef);
    if (existing.exists()) {
      setProfileState('READY');
      return;
    }

    const email = (firebaseUser.email || '').trim();
    const emailLower = email.toLowerCase();
    let remoteClaim: RoleAssignment | undefined =
      ownRoleClaim && ownRoleClaim.email?.toLowerCase() === emailLower ? ownRoleClaim : undefined;
    if (!remoteClaim && emailLower) {
      try {
        const claimSnap = await getDocFromServer(doc(db, 'role_claims', emailLower));
        if (claimSnap.exists()) {
          remoteClaim = claimSnap.data() as RoleAssignment;
        }
      } catch {
        // Bỏ qua nếu chưa có role_claims cho email này
      }
    }

    const preMatch = firebaseUser.emailVerified
      ? preAssignedRoles.find((p) => p.email.toLowerCase() === emailLower) || remoteClaim
      : undefined;
    const isSuperEmail =
      (firebaseUser.emailVerified && isBootstrapSuperAdminEmail(emailLower)) ||
      preMatch?.role === 'SUPER_ADMIN';
    const shouldAutoApprove =
      !effectiveSecurityConfig.requireRegistrationApproval ||
      isSuperEmail ||
      (effectiveSecurityConfig.autoApprovePreAssigned && !!preMatch);

    let initialRole: UserRole = 'MEMBER';
    if (isSuperEmail) initialRole = 'SUPER_ADMIN';
    else if (preMatch?.role) initialRole = preMatch.role;

    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];
    const memberId = `m-${firebaseUser.uid}`;
    const pinHash = await hashPersonalPin(firebaseUser.uid, data.pin);
    const companyCode = data.companyCode.trim().slice(0, 30);
    const rawCleanArea = cleanRawAreaCode(data.areaCode).slice(0, 30);
    const existingAreaDoc = areas.find(
      (a) =>
        normalizeOrgCode(a.companyCode) === normalizeOrgCode(companyCode) &&
        normalizeOrgCode(cleanRawAreaCode(a.code)) === normalizeOrgCode(rawCleanArea)
    );
    let cleanArea = existingAreaDoc ? existingAreaDoc.code : rawCleanArea;
    let areaRefToCreate: ReturnType<typeof doc> | null = null;
    const areaTombstoned =
      deletedCompanySet.has(normalizeOrgCode(companyCode)) ||
      deletedAreaKeySet.has(normalizeDeletedAreaKey(companyCode, cleanArea));
    if (!existingAreaDoc && companyCode && cleanArea && !areaTombstoned) {
      const candidateId = makeDeterministicAreaId(companyCode, cleanArea);
      const candidateRef = doc(db, 'areas', candidateId);
      let alreadyOnServer = false;
      try {
        const areaSnap = await getDocFromServer(candidateRef);
        if (areaSnap.exists()) {
          alreadyOnServer = true;
          const serverCode = areaSnap.data()?.code;
          if (typeof serverCode === 'string' && serverCode.trim()) {
            cleanArea = serverCode.trim().slice(0, 30);
          }
        }
      } catch {
        // Bỏ qua nếu không kiểm tra được trước
      }
      if (!alreadyOnServer) {
        areaRefToCreate = candidateRef;
      }
    }

    const unitCode = data.unitCode?.trim() || undefined;

    const account = JSON.parse(
      JSON.stringify({
        username: email.split('@')[0] || `user_${Date.now()}`,
        email,
        fullName: data.fullName.trim().slice(0, 100),
        role: initialRole,
        memberId,
        companyCode,
        areaCode: cleanArea,
        departmentCode: data.departmentCode,
        unitCode,
        ...(preMatch?.managedClusterIds?.length
          ? { managedClusterIds: preMatch.managedClusterIds }
          : {}),
        managedCompanyCodes: preMatch?.managedCompanyCodes || [],
        managedAreaCodes: preMatch?.managedAreaCodes || [],
        managedUnitCodes: preMatch?.managedUnitCodes || [],
        avatarUrl: firebaseUser.photoURL || undefined,
        emailVerified: firebaseUser.emailVerified,
        pinHash,
        pinUpdatedAt: nowIso,
        onboardingCompleted: true,
        approvalStatus: shouldAutoApprove ? 'APPROVED' : 'PENDING',
        ...(shouldAutoApprove ? { approvedBy: 'SYSTEM_AUTO', approvedAt: nowIso } : {}),
        createdAt: today,
      })
    );

    const member = JSON.parse(
      JSON.stringify({
        code: `MEM-${firebaseUser.uid.slice(0, 6).toUpperCase()}`,
        fullName: data.fullName,
        companyCode,
        areaCode: cleanArea,
        departmentCode: data.departmentCode,
        unitCode,
        active: shouldAutoApprove,
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
    if (areaRefToCreate) {
      const finalAreaName =
        (data.areaName || '').trim().slice(0, 80) || `Khu vực ${cleanArea}`;
      batch.set(areaRefToCreate, {
        code: cleanArea,
        name: finalAreaName,
        companyCode,
        active: true,
        _order: Date.now(),
      });
    }
    await batch.commit();

    if (shouldAutoApprove) {
      setPinUnlockedUid(firebaseUser.uid);
      setActiveTab('ENTRY');
      showNotification(
        areaRefToCreate
          ? `Hoàn tất hồ sơ và đã tạo thêm Khu vực ${cleanArea} (${companyCode})!`
          : 'Hoàn tất hồ sơ & thiết lập Mã cá nhân thành công!'
      );
    } else {
      setPinUnlockedUid(null);
      showNotification('Đã gửi hồ sơ! Tài khoản của bạn đang chờ Admin phê duyệt.');
    }
  };

  const handleSetupPin = async (pinHash: string): Promise<void> => {
    if (!firebaseUser || !currentUser) return;
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'users', currentUser.id), {
      pinHash,
      pinUpdatedAt: nowIso,
    });
    setCurrentUser((prev) =>
      prev ? { ...prev, pinHash, pinUpdatedAt: nowIso } : null
    );
    setPinUnlockedUid(firebaseUser.uid);
    showNotification('Đã thiết lập Mã cá nhân 6 số thành công!');
  };

  const handleChangePin = async (
    currentPin: string | undefined,
    newPin: string
  ): Promise<boolean> => {
    if (!firebaseUser || !currentUser) return false;
    if (currentUser.pinHash) {
      const ok = await verifyPersonalPin(
        currentUser.id,
        currentPin || '',
        currentUser.pinHash
      );
      if (!ok) return false;
    }
    const nextHash = await hashPersonalPin(currentUser.id, newPin);
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'users', currentUser.id), {
      pinHash: nextHash,
      pinUpdatedAt: nowIso,
    });
    setCurrentUser((prev) =>
      prev ? { ...prev, pinHash: nextHash, pinUpdatedAt: nowIso } : null
    );
    return true;
  };

  const handleRetryProfile = useCallback(() => {
    setProfileError(null);
    setProfileState('UNKNOWN');
    setProfileRetryTick((n) => n + 1);
  }, []);

  const handleLogout = () => {
    setPinUnlockedUid(null);
    setProfileError(null);
    setProfileState('UNKNOWN');
    pendingRegistrationRef.current = null;
    logOutFirebase().catch((err) => console.warn('Firebase logout notice:', err));
    setActiveTab('ENTRY');
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

    const canEditOrg = isAdminUser;
    const requestedOrgChange =
      updated.companyCode !== currentUser.companyCode ||
      updated.areaCode !== currentUser.areaCode ||
      updated.departmentCode !== currentUser.departmentCode ||
      (updated.unitCode !== undefined && updated.unitCode.trim() !== (currentUser.unitCode || ''));

    if (!canEditOrg && requestedOrgChange) {
      showNotification('Liên hệ Cấp cao hơn để thay đổi nơi trực thuộc.');
      return false;
    }

    const effectiveCompanyCode = canEditOrg ? updated.companyCode : currentUser.companyCode;
    const effectiveAreaCode = canEditOrg ? updated.areaCode : currentUser.areaCode;
    const effectiveDepartmentCode = canEditOrg
      ? updated.departmentCode
      : currentUser.departmentCode;
    const nextUnitCode = canEditOrg
      ? updated.unitCode !== undefined
        ? updated.unitCode.trim()
        : currentUser.unitCode || ''
      : currentUser.unitCode || '';

    const wantsClearAvatar = updated.avatarUrl === '';
    const wantsClearCover = updated.coverUrl === '';
    const resolvedAvatarUrl =
      updated.avatarUrl === undefined ? currentUser.avatarUrl : updated.avatarUrl || undefined;
    const resolvedCoverUrl =
      updated.coverUrl === undefined ? currentUser.coverUrl : updated.coverUrl || undefined;
    const resolvedBio = updated.bio !== undefined ? updated.bio : currentUser.bio;

    const orgPatch: Record<string, unknown> = canEditOrg
      ? {
          companyCode: effectiveCompanyCode,
          areaCode: effectiveAreaCode,
          departmentCode: effectiveDepartmentCode,
          ...(updated.unitCode !== undefined
            ? nextUnitCode
              ? { unitCode: nextUnitCode }
              : { unitCode: deleteField() }
            : {}),
        }
      : {};

    const userPatch: Record<string, unknown> = {
      fullName: updated.fullName,
      ...(wantsClearAvatar
        ? { avatarUrl: deleteField() }
        : resolvedAvatarUrl
        ? { avatarUrl: resolvedAvatarUrl }
        : {}),
      ...(wantsClearCover
        ? { coverUrl: deleteField() }
        : resolvedCoverUrl
        ? { coverUrl: resolvedCoverUrl }
        : {}),
      ...(resolvedBio !== undefined ? { bio: resolvedBio } : {}),
      ...orgPatch,
    };

    const memberId = currentUser.memberId || `m-${currentUser.id}`;
    const hasMemberDoc = members.some((m) => m.id === memberId);

    try {
      // Đồng bộ nguyên tử hồ sơ tài khoản & thành viên
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', currentUser.id), userPatch);

      if (hasMemberDoc) {
        batch.update(doc(db, 'members', memberId), userPatch);
      } else {
        batch.set(
          doc(db, 'members', memberId),
          JSON.parse(
            JSON.stringify({
              code: `MEM-${currentUser.id.slice(0, 6).toUpperCase()}`,
              fullName: updated.fullName,
              companyCode: effectiveCompanyCode,
              areaCode: effectiveAreaCode,
              departmentCode: effectiveDepartmentCode,
              ...(nextUnitCode ? { unitCode: nextUnitCode } : {}),
              active: resolveUserApprovalStatus(currentUser) === 'APPROVED',
              score: 0,
              ...(resolvedAvatarUrl ? { avatarUrl: resolvedAvatarUrl } : {}),
              ...(resolvedCoverUrl ? { coverUrl: resolvedCoverUrl } : {}),
              ...(resolvedBio !== undefined ? { bio: resolvedBio } : {}),
              goals: { s1: 10, s2: 8, s3: 5, s4: 4, s5: 4, s6: 2 },
              results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
              targets: [],
              createdAt: currentUser.createdAt || new Date().toISOString().split('T')[0],
            })
          ),
          { merge: true }
        );
      }

      await batch.commit();
    } catch (err: any) {
      console.error(err);
      showNotification(`Không lưu được hồ sơ: ${err.message}`);
      return false;
    }

    // Đồng bộ phụ sang Sổ tay MĐ & Lịch làm việc (không làm hỏng việc lưu hồ sơ nếu có bản ghi cũ)
    const orgOrNameChanged =
      (canEditOrg &&
        (effectiveCompanyCode !== currentUser.companyCode ||
          effectiveAreaCode !== currentUser.areaCode ||
          nextUnitCode !== (currentUser.unitCode || ''))) ||
      updated.fullName !== currentUser.fullName;

    if (orgOrNameChanged) {
      try {
        const syncBatch = writeBatch(db);
        const syncedUnit = (nextUnitCode || effectiveDepartmentCode || '').slice(0, 50);
        const ownDisciples = disciples.filter((d) => d.ownerUid === currentUser.id);
        ownDisciples.slice(0, 350).forEach((d) => {
          syncBatch.update(doc(db, 'disciples', d.id), {
            ...(canEditOrg
              ? {
                  companyCode: effectiveCompanyCode,
                  areaCode: effectiveAreaCode,
                  ...(syncedUnit ? { ownerUnitCode: syncedUnit } : {}),
                }
              : {}),
            ownerName: updated.fullName,
            updatedAt: new Date().toISOString(),
          });
        });

        const ownSchedules = workSchedules.filter((w) => w.ownerUid === currentUser.id);
        ownSchedules.slice(0, 100).forEach((w) => {
          syncBatch.update(doc(db, 'work_schedules', w.id), {
            ...(canEditOrg
              ? {
                  companyCode: effectiveCompanyCode,
                  areaCode: effectiveAreaCode,
                  ...(syncedUnit ? { ownerUnitCode: syncedUnit } : {}),
                }
              : {}),
            ownerName: updated.fullName,
            updatedAt: new Date().toISOString(),
          });
        });

        if (ownDisciples.length > 0 || ownSchedules.length > 0) {
          await syncBatch.commit();
        }
      } catch (syncErr) {
        console.warn('[Firestore] Đồng bộ phụ sang MĐ/LLV gặp cảnh báo:', syncErr);
      }
    }

    return true;
  };

  // ---------- Nhật ký Cảm tạ (24h công khai) & Nhật ký Turbo (cá nhân) & Kế hoạch LLV ----------
  const handleAddHuongKhi = async (item: Omit<HuongKhiItem, 'id' | 'likesCount'>) => {
    if (!currentUser) {
      showNotification('Vui lòng đăng nhập để đăng Nhật ký cảm tạ.');
      throw new Error('Vui lòng đăng nhập để đăng Nhật ký cảm tạ.');
    }
    const createdMs = Date.now();
    const createdAtIso = new Date(createdMs).toISOString();
    const expiresAtIso = new Date(createdMs + GRATITUDE_TTL_MS).toISOString();
    const encodedTitle = encodeSensitiveText(
      item.title,
      vocabularyConfig.rules,
      vocabularyConfig.enabled
    ).slice(0, 300);
    const encodedContent = encodeSensitiveText(
      item.content,
      vocabularyConfig.rules,
      vocabularyConfig.enabled
    ).slice(0, 4000);
    const id = `hk-${createdMs}`;

    const docBody = JSON.parse(
      JSON.stringify({
        ...item,
        title: encodedTitle,
        content: encodedContent,
        authorId: currentUser.memberId || `m-${currentUser.id}`,
        authorUid: currentUser.id,
        journalType: 'GRATITUDE',
        category: 'GRATITUDE',
        createdAtIso,
        expiresAtIso,
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
      })
    );

    try {
      await setDoc(doc(db, 'huongKhi', id), docBody);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `huongKhi/${id}`);
      throw err;
    }
  };

  const handleDeleteHuongKhi = async (id: string) => {
    const target = huongKhiList.find((item) => item.id === id);
    if (!target) return;
    const ownMemberId = currentUser?.memberId || (currentUser ? `m-${currentUser.id}` : '');
    const isOwner =
      (!!currentUser?.id && target.authorUid === currentUser.id) ||
      (!!ownMemberId && target.authorId === ownMemberId);
    if (!isAdminUser && !isOwner) {
      showNotification('Bạn chỉ có thể xóa bài viết do chính mình đăng.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'huongKhi', id));
      showNotification('Đã xóa bài Nhật ký cảm tạ.');
    } catch (err: any) {
      showNotification(`Không xóa được bài viết: ${err?.message || 'Lỗi quyền'}`);
    }
  };

  const handleAddTurboJournal = async (payload: { title: string; content: string }) => {
    if (!firebaseUser || !currentUser) return;
    const nowIso = new Date().toISOString();
    const journalId = `tj_${firebaseUser.uid}_${Date.now()}`;
    const encodedTitle = encodeSensitiveText(
      payload.title.trim(),
      vocabularyConfig.rules,
      vocabularyConfig.enabled
    ).slice(0, 300);
    const encodedContent = encodeSensitiveText(
      payload.content.trim(),
      vocabularyConfig.rules,
      vocabularyConfig.enabled
    ).slice(0, 5000);

    const docBody = JSON.parse(
      JSON.stringify({
        authorUid: firebaseUser.uid,
        authorMemberId: currentUser.memberId || `m-${firebaseUser.uid}`,
        authorName: currentUser.fullName.slice(0, 100),
        ...(currentUser.avatarUrl && currentUser.avatarUrl.length <= 200000
          ? { authorAvatar: currentUser.avatarUrl }
          : {}),
        companyCode: (currentUser.companyCode || '').slice(0, 30),
        areaCode: (currentUser.areaCode || '').slice(0, 30),
        title: encodedTitle || 'Nhật ký turbo',
        content: encodedContent,
        date: getCurrentFormattedTime(),
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      })
    );
    try {
      await setDoc(doc(db, 'turbo_journals', journalId), docBody);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `turbo_journals/${journalId}`);
      throw err;
    }
  };

  const handleDeleteTurboJournal = async (journalId: string) => {
    try {
      await deleteDoc(doc(db, 'turbo_journals', journalId));
      showNotification('Đã xóa trang Nhật ký turbo.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `turbo_journals/${journalId}`);
      throw err;
    }
  };

  const handleUpdateTurboJournal = async (
    journalId: string,
    payload: { title: string; content: string }
  ) => {
    if (!firebaseUser || !currentUser) return;
    const encodedTitle = encodeSensitiveText(
      payload.title.trim(),
      vocabularyConfig.rules,
      vocabularyConfig.enabled
    ).slice(0, 300);
    const encodedContent = encodeSensitiveText(
      payload.content.trim(),
      vocabularyConfig.rules,
      vocabularyConfig.enabled
    ).slice(0, 5000);
    try {
      await updateDoc(doc(db, 'turbo_journals', journalId), {
        title: encodedTitle || 'Nhật ký turbo',
        content: encodedContent,
        updatedAtIso: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `turbo_journals/${journalId}`);
      throw err;
    }
  };

  const handleSavePersonalPlanner = async (planner: PersonalPlannerRecord) => {
    if (!firebaseUser) return;
    const { id, ...rest } = planner;
    const clean = JSON.parse(
      JSON.stringify({
        ...rest,
        ownerUid: firebaseUser.uid,
      })
    );
    try {
      await setDoc(doc(db, 'personal_planners', id), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `personal_planners/${id}`);
      throw err;
    }
  };

  const handleReactHuongKhi = async (id: string, reaction: ReactionType) => {
    if (!currentUser) {
      showNotification('Vui lòng đăng nhập để bày tỏ cảm xúc.');
      setIsAuthModalOpen(true);
      return;
    }
    const uid = currentUser.id;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'huongKhi', id);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const hk = snap.data() as Omit<HuongKhiItem, 'id'>;
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
        let likesCount = Number(hk.likesCount) || 0;

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

        tx.update(ref, { reactions, userReactions, likesCount });
      });
      showNotification('Đã bày tỏ cảm xúc thành công!');
    } catch (err: any) {
      console.warn('[Firestore] Lỗi bày tỏ cảm xúc:', err);
      showNotification(`Không lưu được cảm xúc: ${err?.message || 'Vui lòng thử lại'}`);
    }
  };

  const handleAddComment = async (huongKhiId: string, content: string) => {
    if (!content.trim()) return;
    if (!currentUser) {
      showNotification('Vui lòng đăng nhập để bình luận.');
      setIsAuthModalOpen(true);
      return;
    }

    const newComment: HuongKhiComment = JSON.parse(
      JSON.stringify({
        id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        authorId: currentUser.id,
        authorName: currentUser.fullName,
        authorAvatar: currentUser.avatarUrl,
        companyCode: currentUser.companyCode,
        areaCode: currentUser.areaCode,
        content: content.trim(),
        createdAt: getCurrentFormattedTime(),
      })
    );

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'huongKhi', huongKhiId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const currentComments = Array.isArray(snap.data()?.comments)
          ? (snap.data()?.comments as HuongKhiComment[])
          : [];
        if (currentComments.length >= 200) {
          throw new Error('Bài viết đã đạt tối đa 200 bình luận.');
        }
        tx.update(ref, { comments: [...currentComments, newComment] });
      });
      showNotification('Đã đăng bình luận khích lệ thành công!');
    } catch (err: any) {
      console.warn('[Firestore] Lỗi đăng bình luận:', err);
      showNotification(`Không gửi được bình luận: ${err?.message || 'Vui lòng thử lại'}`);
    }
  };

  // Admin CRUD functions
  const triggerCatchAllClusterSync = (nextCompanies: Company[]) => {
    const activeClusters = clustersConfig?.clusters || [];
    if (isAdminUser && activeClusters.some((cl) => cl.isCatchAll && cl.active !== false)) {
      syncManagerClusters(activeClusters, nextCompanies).catch((err) =>
        console.warn('[Clusters] Lỗi đồng bộ QL Cụm theo danh sách Sion mới:', err)
      );
    }
  };

  type BatchOp =
    | { kind: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown>; merge?: boolean }
    | { kind: 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
    | { kind: 'delete'; ref: ReturnType<typeof doc> };

  const commitBatchOps = async (ops: BatchOp[]) => {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => {
        if (op.kind === 'set') {
          if (op.merge) {
            batch.set(op.ref, op.data, { merge: true });
          } else {
            batch.set(op.ref, op.data);
          }
        } else if (op.kind === 'update') {
          batch.update(op.ref, op.data);
        } else {
          batch.delete(op.ref);
        }
      });
      await batch.commit();
    }
  };

  const handleAddCompany = async (company: Omit<Company, 'id'>): Promise<boolean> => {
    if (!isAdminUser) {
      showNotification('Chỉ Ban Quản trị mới có quyền thêm Sion.');
      return false;
    }
    const cleanCode = (company.code || '').trim();
    const cleanName = (company.name || '').trim() || getDefaultCompanyDisplayName(cleanCode);
    const normCode = normalizeOrgCode(cleanCode);
    if (!cleanCode || !normCode) return false;
    const compId = makeDeterministicCompanyId(cleanCode);
    const nowIso = new Date().toISOString();
    const newComp: Company = {
      ...company,
      id: compId,
      code: cleanCode,
      name: cleanName,
      active: company.active !== false,
    };
    try {
      const { id: _id, ...rest } = newComp;
      const nextDeletedCompanies = (orgSyncConfig?.deletedCompanyCodes || []).filter(
        (c) => normalizeOrgCode(c) !== normCode
      );
      const ops: BatchOp[] = [
        {
          kind: 'set',
          ref: doc(db, 'companies', compId),
          data: {
            ...JSON.parse(JSON.stringify(rest)),
            _order: Date.now(),
          },
          merge: true,
        },
        {
          kind: 'set',
          ref: doc(db, 'system_config', 'org_sync'),
          data: {
            orgInitialized: true,
            deletedCompanyCodes: nextDeletedCompanies,
            deletedAreaKeys: orgSyncConfig?.deletedAreaKeys || [],
            updatedAt: nowIso,
            updatedBy: effectiveCurrentUser?.fullName || 'Admin',
          },
          merge: true,
        },
      ];
      await commitBatchOps(ops);
      triggerCatchAllClusterSync([
        ...companies.filter((c) => normalizeOrgCode(c.code) !== normCode),
        newComp,
      ]);
      return true;
    } catch (err: any) {
      showNotification(`Không thêm được Sion: ${err?.message || 'Lỗi phân quyền'}`);
      return false;
    }
  };

  const handleUpdateCompany = async (company: Company): Promise<boolean> => {
    try {
      const { id, ...rest } = company;
      await setDoc(doc(db, 'companies', id), JSON.parse(JSON.stringify(rest)), { merge: true });
      const nextList = companies.map((c) => (c.id === company.id ? company : c));
      triggerCatchAllClusterSync(nextList);
      return true;
    } catch (err: any) {
      showNotification(`Không cập nhật được Sion: ${err?.message || 'Lỗi phân quyền'}`);
      return false;
    }
  };

  const handleDeleteCompany = async (
    id: string,
    attachedMode: OrgDeleteAttachedMode = 'PENDING_REASSIGN'
  ): Promise<boolean> => {
    if (!isAdminUser) {
      showNotification('Chỉ Ban Quản trị mới có quyền xóa Sion.');
      return false;
    }
    const target = companies.find((c) => c.id === id);
    if (!target) return false;
    const compNorm = normalizeOrgCode(target.code);
    const nowIso = new Date().toISOString();
    const actorName = effectiveCurrentUser?.fullName || 'Admin';

    const matchingCompanies = companies.filter((c) => normalizeOrgCode(c.code) === compNorm);
    const remainingCompanies = companies.filter((c) => normalizeOrgCode(c.code) !== compNorm);
    const childAreas = areas.filter((a) => normalizeOrgCode(a.companyCode) === compNorm);
    const remainingAreas = areas.filter((a) => normalizeOrgCode(a.companyCode) !== compNorm);
    const childRegions = regions.filter((r) => normalizeOrgCode(r.companyCode) === compNorm);

    const nextDeletedCompanies = Array.from(
      new Set([...(orgSyncConfig?.deletedCompanyCodes || []).map(normalizeOrgCode), compNorm])
    ).filter(Boolean);
    const childAreaKeys = childAreas
      .map((a) => normalizeDeletedAreaKey(a.companyCode, a.code))
      .filter(Boolean);
    const nextDeletedAreaKeys = Array.from(
      new Set([
        ...(orgSyncConfig?.deletedAreaKeys || [])
          .map((e) => {
            const p = parseAreaScopeEntry(e);
            return p.hasCompanyPrefix ? `${p.companyCode}::${p.areaCode}` : '';
          })
          .filter(Boolean),
        ...childAreaKeys,
      ])
    );

    const coreOps: BatchOp[] = [];
    coreOps.push({
      kind: 'set',
      ref: doc(db, 'system_config', 'org_sync'),
      data: {
        orgInitialized: true,
        deletedCompanyCodes: nextDeletedCompanies,
        deletedAreaKeys: nextDeletedAreaKeys,
        updatedAt: nowIso,
        updatedBy: actorName,
      },
      merge: true,
    });

    matchingCompanies.forEach((c) => {
      coreOps.push({ kind: 'delete', ref: doc(db, 'companies', c.id) });
    });
    childAreas.forEach((a) => {
      coreOps.push({ kind: 'delete', ref: doc(db, 'areas', a.id) });
    });
    childRegions.forEach((r) => {
      coreOps.push({ kind: 'delete', ref: doc(db, 'regions', r.id) });
    });

    // Gỡ mã Sion khỏi cấu hình Cụm nếu có
    let nextClusters = clustersConfig?.clusters || [];
    let clustersChanged = false;
    if (nextClusters.length > 0) {
      nextClusters = nextClusters.map((cl) => {
        const filtered = (cl.companyCodes || []).filter(
          (code) => normalizeOrgCode(code) !== compNorm
        );
        if (filtered.length !== (cl.companyCodes || []).length) {
          clustersChanged = true;
          return { ...cl, companyCodes: filtered };
        }
        return cl;
      });
      if (clustersChanged) {
        coreOps.push({
          kind: 'set',
          ref: doc(db, 'system_config', 'clusters'),
          data: JSON.parse(
            JSON.stringify({
              clusters: nextClusters,
              updatedBy: actorName,
              updatedAt: nowIso,
            })
          ),
        });
      }
    }

    const fallbackCompObj = remainingCompanies.find((c) => c.active !== false) || remainingCompanies[0];
    const fallbackCompCode = fallbackCompObj?.code || '';
    const fallbackAreaObj =
      remainingAreas.find(
        (a) =>
          normalizeOrgCode(a.companyCode) === normalizeOrgCode(fallbackCompCode) &&
          a.active !== false
      ) ||
      remainingAreas.find(
        (a) => normalizeOrgCode(a.companyCode) === normalizeOrgCode(fallbackCompCode)
      );
    const fallbackAreaCode = fallbackAreaObj?.code || '';

    const filterAreaScopeForDeletedComp = (entries?: string[]): string[] => {
      if (!Array.isArray(entries)) return [];
      return entries.filter((entry) => {
        const parsed = parseAreaScopeEntry(entry);
        if (parsed.hasCompanyPrefix) {
          return parsed.companyCode !== compNorm;
        }
        return !childAreas.some(
          (ca) => normalizeOrgCode(cleanRawAreaCode(ca.code)) === parsed.areaCode
        );
      });
    };

    const userOps: BatchOp[] = [];
    const protectedMemberIds = new Set<string>();
    const deletedEmails = new Set<string>();
    const updatedUserPatches = new Map<string, Partial<UserAccount>>();
    const removedUserIds = new Set<string>();
    let movedCount = 0;
    let deletedUserCount = 0;

    usersList.forEach((u) => {
      const canEditTargetUser = isSuperAdminUser || (isAdminUser && u.role !== 'SUPER_ADMIN');
      const isAttachedUser = normalizeOrgCode(u.companyCode) === compNorm;
      const isProtectedAdmin =
        u.id === currentUser?.id || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN';

      if (isAttachedUser && isProtectedAdmin) {
        protectedMemberIds.add(u.memberId || `m-${u.id}`);
      }

      // 1. Dọn phạm vi quản lý nếu có gắn với Sion bị xóa
      const prevManagedComps = u.managedCompanyCodes || [];
      let nextManagedComps = prevManagedComps.filter((c) => normalizeOrgCode(c) !== compNorm);
      if (u.role === 'MANAGER' && u.managedClusterIds?.length && nextClusters.length > 0) {
        nextManagedComps = resolveCompanyCodesFromClusterIds(
          u.managedClusterIds,
          nextClusters,
          remainingCompanies
        );
      }
      const nextManagedAreas = filterAreaScopeForDeletedComp(u.managedAreaCodes);
      const scopeChanged =
        !areCodeListsEqual(prevManagedComps, nextManagedComps) ||
        !areCodeListsEqual(u.managedAreaCodes, nextManagedAreas);

      if (isAttachedUser && !isProtectedAdmin) {
        if (attachedMode === 'DELETE_RECORDS' && isSuperAdminUser) {
          if (canEditTargetUser) {
            userOps.push({ kind: 'delete', ref: doc(db, 'users', u.id) });
            removedUserIds.add(u.id);
            deletedUserCount++;
            const cleanEmail = (u.email || '').trim().toLowerCase();
            if (cleanEmail) {
              deletedEmails.add(cleanEmail);
              userOps.push({ kind: 'delete', ref: doc(db, 'role_claims', cleanEmail) });
            }
          }
          return;
        }
        // Chuyển sang trạng thái chờ phân bổ đơn vị (hoặc cấp 6 không được xóa auth user)
        if (canEditTargetUser) {
          const patchData: Record<string, unknown> = {
            companyCode: '',
            areaCode: '',
            unitCode: deleteField(),
            approvalStatus: 'PENDING',
            managedClusterIds: [],
            managedCompanyCodes: [],
            managedAreaCodes: [],
            managedUnitCodes: [],
            ...(attachedMode === 'DELETE_RECORDS' && !isSuperAdminUser ? { role: 'MEMBER' } : {}),
          };
          userOps.push({ kind: 'update', ref: doc(db, 'users', u.id), data: patchData });
          updatedUserPatches.set(u.id, {
            companyCode: '',
            areaCode: '',
            unitCode: undefined,
            approvalStatus: 'PENDING',
            managedClusterIds: [],
            managedCompanyCodes: [],
            managedAreaCodes: [],
            managedUnitCodes: [],
            ...(attachedMode === 'DELETE_RECORDS' && !isSuperAdminUser
              ? { role: 'MEMBER' as UserRole }
              : {}),
          });
          movedCount++;
          const cleanEmail = (u.email || '').trim().toLowerCase();
          if (isSuperAdminUser && cleanEmail && scopeChanged) {
            userOps.push({
              kind: 'set',
              ref: doc(db, 'role_claims', cleanEmail),
              data: {
                email: cleanEmail,
                role: u.role,
                managedClusterIds: [],
                managedCompanyCodes: [],
                managedAreaCodes: [],
                managedUnitCodes: [],
                updatedAt: nowIso,
              },
              merge: true,
            });
          }
        }
        return;
      }

      // Tài khoản Admin/SuperAdmin hoặc tài khoản thuộc Sion khác có phạm vi dính Sion bị xóa
      if ((isAttachedUser || scopeChanged) && canEditTargetUser) {
        const patchData: Record<string, unknown> = {};
        const localPatch: Partial<UserAccount> = {};
        if (isAttachedUser && isProtectedAdmin) {
          patchData.companyCode = fallbackCompCode;
          patchData.areaCode = fallbackAreaCode;
          localPatch.companyCode = fallbackCompCode;
          localPatch.areaCode = fallbackAreaCode;
        }
        if (scopeChanged) {
          patchData.managedCompanyCodes = nextManagedComps;
          patchData.managedAreaCodes = nextManagedAreas;
          localPatch.managedCompanyCodes = nextManagedComps;
          localPatch.managedAreaCodes = nextManagedAreas;
        }
        if (Object.keys(patchData).length > 0) {
          userOps.push({ kind: 'update', ref: doc(db, 'users', u.id), data: patchData });
          updatedUserPatches.set(u.id, localPatch);
          const cleanEmail = (u.email || '').trim().toLowerCase();
          if (isSuperAdminUser && cleanEmail && scopeChanged) {
            userOps.push({
              kind: 'set',
              ref: doc(db, 'role_claims', cleanEmail),
              data: {
                email: cleanEmail,
                role: u.role,
                managedClusterIds: u.managedClusterIds || [],
                managedCompanyCodes: nextManagedComps,
                managedAreaCodes: nextManagedAreas,
                managedUnitCodes: u.managedUnitCodes || [],
                updatedAt: nowIso,
              },
              merge: true,
            });
          }
        }
      }
    });

    // Cập nhật system_config/roles và role_claims cho danh sách cấp quyền trước (SuperAdmin)
    let nextPreAssigned: RoleAssignment[] | null = null;
    if (isSuperAdminUser && preAssignedRoles.length > 0) {
      let rolesChanged = false;
      const mapped: RoleAssignment[] = [];
      preAssignedRoles.forEach((a) => {
        const cleanEmail = a.email.trim().toLowerCase();
        if (deletedEmails.has(cleanEmail)) {
          rolesChanged = true;
          return;
        }
        const nextComps = (a.managedCompanyCodes || []).filter(
          (c) => normalizeOrgCode(c) !== compNorm
        );
        const nextAreas = filterAreaScopeForDeletedComp(a.managedAreaCodes);
        const resolvedComps =
          a.role === 'MANAGER' && a.managedClusterIds?.length && nextClusters.length > 0
            ? resolveCompanyCodesFromClusterIds(
                a.managedClusterIds,
                nextClusters,
                remainingCompanies
              )
            : nextComps;
        if (
          !areCodeListsEqual(a.managedCompanyCodes, resolvedComps) ||
          !areCodeListsEqual(a.managedAreaCodes, nextAreas)
        ) {
          rolesChanged = true;
          userOps.push({
            kind: 'set',
            ref: doc(db, 'role_claims', cleanEmail),
            data: {
              email: cleanEmail,
              role: a.role,
              managedClusterIds: a.managedClusterIds || [],
              managedCompanyCodes: resolvedComps,
              managedAreaCodes: nextAreas,
              managedUnitCodes: a.managedUnitCodes || [],
              updatedAt: nowIso,
            },
            merge: true,
          });
          mapped.push({
            ...a,
            managedCompanyCodes: resolvedComps,
            managedAreaCodes: nextAreas,
          });
        } else {
          mapped.push(a);
        }
      });
      if (rolesChanged) {
        nextPreAssigned = mapped;
        userOps.push({
          kind: 'set',
          ref: doc(db, 'system_config', 'roles'),
          data: {
            assignments: mapped,
            updatedAt: nowIso,
            updatedBy: actorName,
          },
          merge: true,
        });
      }
    }

    // Xử lý danh sách thành viên (members) thuộc Sion bị xóa
    const memberOps: BatchOp[] = [];
    let deletedMembersCount = 0;
    let unassignedMembersCount = 0;
    members
      .filter((m) => normalizeOrgCode(m.companyCode) === compNorm)
      .forEach((m) => {
        if (protectedMemberIds.has(m.id)) {
          memberOps.push({
            kind: 'update',
            ref: doc(db, 'members', m.id),
            data: {
              companyCode: fallbackCompCode,
              areaCode: fallbackAreaCode,
            },
          });
          return;
        }
        if (attachedMode === 'DELETE_RECORDS') {
          memberOps.push({ kind: 'delete', ref: doc(db, 'members', m.id) });
          deletedMembersCount++;
        } else {
          memberOps.push({
            kind: 'update',
            ref: doc(db, 'members', m.id),
            data: {
              companyCode: '',
              areaCode: '',
              unitCode: deleteField(),
              active: false,
            },
          });
          unassignedMembersCount++;
        }
      });

    try {
      await commitBatchOps([...coreOps, ...userOps, ...memberOps]);

      if (updatedUserPatches.size > 0 || removedUserIds.size > 0) {
        setUsersList((prev) =>
          prev
            .filter((u) => !removedUserIds.has(u.id))
            .map((u) =>
              updatedUserPatches.has(u.id) ? { ...u, ...updatedUserPatches.get(u.id)! } : u
            )
        );
        if (currentUser && updatedUserPatches.has(currentUser.id)) {
          setCurrentUser((prev) =>
            prev ? { ...prev, ...updatedUserPatches.get(prev.id)! } : null
          );
        }
      }
      if (nextPreAssigned) {
        setPreAssignedRoles(nextPreAssigned);
      }

      const detailParts: string[] = [];
      if (childAreas.length > 0) detailParts.push(`${childAreas.length} KV`);
      if (childRegions.length > 0) detailParts.push(`${childRegions.length} địa vực`);
      if (attachedMode === 'DELETE_RECORDS') {
        if (deletedMembersCount > 0) detailParts.push(`đã xóa ${deletedMembersCount} TV`);
        if (deletedUserCount > 0) detailParts.push(`đã xóa ${deletedUserCount} TK`);
        else if (movedCount > 0) detailParts.push(`${movedCount} TK chuyển chờ phân bổ`);
      } else {
        if (unassignedMembersCount > 0)
          detailParts.push(`${unassignedMembersCount} TV chờ phân bổ`);
        if (movedCount > 0) detailParts.push(`${movedCount} TK chuyển chờ duyệt/phân bổ`);
      }
      const suffix = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
      showNotification(`Đã xóa vĩnh viễn Sion ${target.name} (${target.code})${suffix}.`);
      return true;
    } catch (err: any) {
      console.error('[OrgDelete] Lỗi xóa Sion:', err);
      showNotification(`Không xóa được Sion: ${err?.message || 'Lỗi phân quyền'}`);
      return false;
    }
  };

  const ensureAreaExistsForOrg = useCallback(
    (rawCompanyCode?: string, rawAreaCode?: string) => {
      const cleanArea = cleanRawAreaCode(rawAreaCode);
      const cleanComp = (rawCompanyCode || '').trim();
      if (!cleanArea || !cleanComp) return;
      const compNorm = normalizeOrgCode(cleanComp);
      const areaKey = normalizeDeletedAreaKey(cleanComp, cleanArea);
      if (deletedCompanySet.has(compNorm) || (areaKey && deletedAreaKeySet.has(areaKey))) {
        return;
      }
      const canCreateArea =
        isAdminUser ||
        effectiveCurrentUser?.role === 'MANAGER' ||
        effectiveCurrentUser?.role === 'SION_LEADER';
      if (!canCreateArea) return;

      const exists = areas.some(
        (a) =>
          normalizeOrgCode(a.companyCode) === compNorm &&
          normalizeOrgCode(cleanRawAreaCode(a.code)) === normalizeOrgCode(cleanArea)
      );
      if (exists) return;

      const canonicalComp =
        companies.find((c) => normalizeOrgCode(c.code) === compNorm)?.code || cleanComp;
      setAreas((prev) => {
        if (
          prev.some(
            (a) =>
              normalizeOrgCode(a.companyCode) === normalizeOrgCode(canonicalComp) &&
              normalizeOrgCode(cleanRawAreaCode(a.code)) === normalizeOrgCode(cleanArea)
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            id: makeDeterministicAreaId(canonicalComp, cleanArea),
            code: cleanArea,
            name: cleanArea,
            companyCode: canonicalComp,
            active: true,
          },
        ];
      });
    },
    [
      areas,
      companies,
      isAdminUser,
      effectiveCurrentUser?.role,
      deletedCompanySet,
      deletedAreaKeySet,
      setAreas,
    ]
  );

  const handleAddArea = async (area: Omit<Area, 'id'>): Promise<boolean> => {
    const cleanCode = cleanRawAreaCode(area.code);
    const cleanName = (area.name || '').trim() || cleanCode;
    const cleanComp = (area.companyCode || '').trim();
    const compNorm = normalizeOrgCode(cleanComp);
    const areaKey = normalizeDeletedAreaKey(cleanComp, cleanCode);
    if (!cleanCode || !cleanComp || !areaKey) return false;

    const canonicalComp =
      companies.find((c) => normalizeOrgCode(c.code) === compNorm)?.code || cleanComp;
    const uniqueId = makeDeterministicAreaId(canonicalComp, cleanCode);
    const nowIso = new Date().toISOString();

    try {
      const nextDeletedAreas = (orgSyncConfig?.deletedAreaKeys || []).filter((entry) => {
        const parsed = parseAreaScopeEntry(entry);
        return !(parsed.hasCompanyPrefix && `${parsed.companyCode}::${parsed.areaCode}` === areaKey);
      });
      const existingDeletedComps = orgSyncConfig?.deletedCompanyCodes || [];
      const nextDeletedComps = isAdminUser
        ? existingDeletedComps.filter((c) => normalizeOrgCode(c) !== compNorm)
        : existingDeletedComps;

      const ops: BatchOp[] = [
        {
          kind: 'set',
          ref: doc(db, 'areas', uniqueId),
          data: JSON.parse(
            JSON.stringify({
              ...area,
              code: cleanCode,
              name: cleanName,
              companyCode: canonicalComp,
              active: area.active !== false,
              _order: Date.now(),
            })
          ),
          merge: true,
        },
        {
          kind: 'set',
          ref: doc(db, 'system_config', 'org_sync'),
          data: {
            orgInitialized: true,
            deletedCompanyCodes: nextDeletedComps,
            deletedAreaKeys: nextDeletedAreas,
            updatedAt: nowIso,
            updatedBy: effectiveCurrentUser?.fullName || 'Admin',
          },
          merge: true,
        },
      ];
      await commitBatchOps(ops);
      return true;
    } catch (err: any) {
      showNotification(`Không thêm được khu vực: ${err?.message || 'Lỗi phân quyền'}`);
      return false;
    }
  };

  const handleUpdateArea = async (area: Area): Promise<boolean> => {
    try {
      const { id, ...rest } = area;
      await setDoc(doc(db, 'areas', id), JSON.parse(JSON.stringify(rest)), { merge: true });
      return true;
    } catch (err: any) {
      showNotification(`Không cập nhật được khu vực: ${err?.message || 'Lỗi phân quyền'}`);
      return false;
    }
  };

  const handleDeleteArea = async (
    id: string,
    attachedMode: OrgDeleteAttachedMode = 'PENDING_REASSIGN'
  ): Promise<boolean> => {
    const target = areas.find((a) => a.id === id);
    if (!target) return false;
    const isManagerOrSionLeader =
      effectiveCurrentUser?.role === 'MANAGER' || effectiveCurrentUser?.role === 'SION_LEADER';
    if (!isAdminUser && (!isManagerOrSionLeader || target.active !== false)) {
      showNotification('Hãy ngừng hoạt động Khu vực trước khi xóa (hoặc liên hệ Admin).');
      return false;
    }

    const compNorm = normalizeOrgCode(target.companyCode);
    const areaClean = cleanRawAreaCode(target.code);
    const areaNorm = normalizeOrgCode(areaClean);
    const areaKey = normalizeDeletedAreaKey(target.companyCode, areaClean);
    const nowIso = new Date().toISOString();
    const actorName = effectiveCurrentUser?.fullName || 'Admin';

    const matchingAreas = areas.filter(
      (a) =>
        normalizeOrgCode(a.companyCode) === compNorm &&
        normalizeOrgCode(cleanRawAreaCode(a.code)) === areaNorm
    );
    const remainingAreasInComp = areas.filter(
      (a) =>
        normalizeOrgCode(a.companyCode) === compNorm &&
        normalizeOrgCode(cleanRawAreaCode(a.code)) !== areaNorm
    );
    const fallbackAreaObj =
      remainingAreasInComp.find((a) => a.active !== false) || remainingAreasInComp[0];
    const fallbackAreaCode = fallbackAreaObj?.code || '';

    const nextDeletedAreaKeys = Array.from(
      new Set([
        ...(orgSyncConfig?.deletedAreaKeys || [])
          .map((e) => {
            const p = parseAreaScopeEntry(e);
            return p.hasCompanyPrefix ? `${p.companyCode}::${p.areaCode}` : '';
          })
          .filter(Boolean),
        ...(areaKey ? [areaKey] : []),
      ])
    );

    const coreOps: BatchOp[] = [
      {
        kind: 'set',
        ref: doc(db, 'system_config', 'org_sync'),
        data: {
          orgInitialized: true,
          // Giữ nguyên deletedCompanyCodes để MANAGER/SION_LEADER cũng hợp lệ theo firestore.rules
          deletedCompanyCodes: orgSyncConfig?.deletedCompanyCodes || [],
          deletedAreaKeys: nextDeletedAreaKeys,
          updatedAt: nowIso,
          updatedBy: actorName,
        },
        merge: true,
      },
    ];
    matchingAreas.forEach((a) => {
      coreOps.push({ kind: 'delete', ref: doc(db, 'areas', a.id) });
    });

    const filterAreaEntries = (entries?: string[]): string[] => {
      if (!Array.isArray(entries)) return [];
      return entries.filter((entry) => {
        const p = parseAreaScopeEntry(entry);
        return p.hasCompanyPrefix
          ? !(p.companyCode === compNorm && p.areaCode === areaNorm)
          : p.areaCode !== areaNorm;
      });
    };

    const userOps: BatchOp[] = [];
    const protectedMemberIds = new Set<string>();
    const deletedEmails = new Set<string>();
    const updatedUserPatches = new Map<string, Partial<UserAccount>>();
    const removedUserIds = new Set<string>();
    let movedUsersCount = 0;
    let deletedUsersCount = 0;

    if (isAdminUser) {
      usersList.forEach((u) => {
        const canEditTargetUser = isSuperAdminUser || u.role !== 'SUPER_ADMIN';
        const isAttachedUser =
          normalizeOrgCode(u.companyCode) === compNorm &&
          normalizeOrgCode(cleanRawAreaCode(u.areaCode)) === areaNorm;
        const isProtectedAdmin =
          u.id === currentUser?.id || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN';

        if (isAttachedUser && isProtectedAdmin) {
          protectedMemberIds.add(u.memberId || `m-${u.id}`);
        }

        const nextManagedAreas = filterAreaEntries(u.managedAreaCodes);
        const areaScopeChanged = !areCodeListsEqual(u.managedAreaCodes, nextManagedAreas);

        if (isAttachedUser && !isProtectedAdmin) {
          if (attachedMode === 'DELETE_RECORDS' && isSuperAdminUser) {
            if (canEditTargetUser) {
              userOps.push({ kind: 'delete', ref: doc(db, 'users', u.id) });
              removedUserIds.add(u.id);
              deletedUsersCount++;
              const cleanEmail = (u.email || '').trim().toLowerCase();
              if (cleanEmail) {
                deletedEmails.add(cleanEmail);
                userOps.push({ kind: 'delete', ref: doc(db, 'role_claims', cleanEmail) });
              }
            }
            return;
          }
          if (canEditTargetUser) {
            const patchData: Record<string, unknown> = {
              areaCode: '',
              unitCode: deleteField(),
              approvalStatus: 'PENDING',
              managedAreaCodes: nextManagedAreas,
              managedUnitCodes: [],
              ...(attachedMode === 'DELETE_RECORDS' && !isSuperAdminUser ? { role: 'MEMBER' } : {}),
            };
            userOps.push({ kind: 'update', ref: doc(db, 'users', u.id), data: patchData });
            updatedUserPatches.set(u.id, {
              areaCode: '',
              unitCode: undefined,
              approvalStatus: 'PENDING',
              managedAreaCodes: nextManagedAreas,
              managedUnitCodes: [],
              ...(attachedMode === 'DELETE_RECORDS' && !isSuperAdminUser
                ? { role: 'MEMBER' as UserRole }
                : {}),
            });
            movedUsersCount++;
            const cleanEmail = (u.email || '').trim().toLowerCase();
            if (isSuperAdminUser && cleanEmail && areaScopeChanged) {
              userOps.push({
                kind: 'set',
                ref: doc(db, 'role_claims', cleanEmail),
                data: {
                  email: cleanEmail,
                  role: u.role,
                  managedClusterIds: u.managedClusterIds || [],
                  managedCompanyCodes: u.managedCompanyCodes || [],
                  managedAreaCodes: nextManagedAreas,
                  managedUnitCodes: [],
                  updatedAt: nowIso,
                },
                merge: true,
              });
            }
          }
          return;
        }

        if ((isAttachedUser || areaScopeChanged) && canEditTargetUser) {
          const patchData: Record<string, unknown> = {};
          const localPatch: Partial<UserAccount> = {};
          if (isAttachedUser && isProtectedAdmin) {
            patchData.areaCode = fallbackAreaCode;
            localPatch.areaCode = fallbackAreaCode;
          }
          if (areaScopeChanged) {
            patchData.managedAreaCodes = nextManagedAreas;
            localPatch.managedAreaCodes = nextManagedAreas;
          }
          if (Object.keys(patchData).length > 0) {
            userOps.push({ kind: 'update', ref: doc(db, 'users', u.id), data: patchData });
            updatedUserPatches.set(u.id, localPatch);
            const cleanEmail = (u.email || '').trim().toLowerCase();
            if (isSuperAdminUser && cleanEmail && areaScopeChanged) {
              userOps.push({
                kind: 'set',
                ref: doc(db, 'role_claims', cleanEmail),
                data: {
                  email: cleanEmail,
                  role: u.role,
                  managedClusterIds: u.managedClusterIds || [],
                  managedCompanyCodes: u.managedCompanyCodes || [],
                  managedAreaCodes: nextManagedAreas,
                  managedUnitCodes: u.managedUnitCodes || [],
                  updatedAt: nowIso,
                },
                merge: true,
              });
            }
          }
        }
      });
    }

    let nextPreAssigned: RoleAssignment[] | null = null;
    if (isSuperAdminUser && preAssignedRoles.length > 0) {
      let rolesChanged = false;
      const mapped: RoleAssignment[] = [];
      preAssignedRoles.forEach((a) => {
        const cleanEmail = a.email.trim().toLowerCase();
        if (deletedEmails.has(cleanEmail)) {
          rolesChanged = true;
          return;
        }
        const nextAreas = filterAreaEntries(a.managedAreaCodes);
        if (!areCodeListsEqual(a.managedAreaCodes, nextAreas)) {
          rolesChanged = true;
          userOps.push({
            kind: 'set',
            ref: doc(db, 'role_claims', cleanEmail),
            data: {
              email: cleanEmail,
              role: a.role,
              managedClusterIds: a.managedClusterIds || [],
              managedCompanyCodes: a.managedCompanyCodes || [],
              managedAreaCodes: nextAreas,
              managedUnitCodes: a.managedUnitCodes || [],
              updatedAt: nowIso,
            },
            merge: true,
          });
          mapped.push({ ...a, managedAreaCodes: nextAreas });
        } else {
          mapped.push(a);
        }
      });
      if (rolesChanged) {
        nextPreAssigned = mapped;
        userOps.push({
          kind: 'set',
          ref: doc(db, 'system_config', 'roles'),
          data: {
            assignments: mapped,
            updatedAt: nowIso,
            updatedBy: actorName,
          },
          merge: true,
        });
      }
    }

    const actorCoversWholeCompany =
      isAdminUser ||
      normalizeOrgCode(effectiveCurrentUser?.companyCode) === compNorm ||
      (effectiveCurrentUser?.managedCompanyCodes || []).some(
        (c) => normalizeOrgCode(c) === compNorm
      );

    const memberOps: BatchOp[] = [];
    let deletedMembersCount = 0;
    let unassignedMembersCount = 0;
    members
      .filter(
        (m) =>
          normalizeOrgCode(m.companyCode) === compNorm &&
          normalizeOrgCode(cleanRawAreaCode(m.areaCode)) === areaNorm
      )
      .forEach((m) => {
        if (protectedMemberIds.has(m.id)) {
          if (isAdminUser) {
            memberOps.push({
              kind: 'update',
              ref: doc(db, 'members', m.id),
              data: { areaCode: fallbackAreaCode },
            });
          }
          return;
        }
        if (attachedMode === 'DELETE_RECORDS') {
          memberOps.push({ kind: 'delete', ref: doc(db, 'members', m.id) });
          deletedMembersCount++;
        } else if (actorCoversWholeCompany) {
          memberOps.push({
            kind: 'update',
            ref: doc(db, 'members', m.id),
            data: {
              areaCode: '',
              unitCode: deleteField(),
              active: false,
            },
          });
          unassignedMembersCount++;
        }
      });

    try {
      await commitBatchOps([...coreOps, ...userOps, ...memberOps]);

      if (updatedUserPatches.size > 0 || removedUserIds.size > 0) {
        setUsersList((prev) =>
          prev
            .filter((u) => !removedUserIds.has(u.id))
            .map((u) =>
              updatedUserPatches.has(u.id) ? { ...u, ...updatedUserPatches.get(u.id)! } : u
            )
        );
        if (currentUser && updatedUserPatches.has(currentUser.id)) {
          setCurrentUser((prev) =>
            prev ? { ...prev, ...updatedUserPatches.get(prev.id)! } : null
          );
        }
      }
      if (nextPreAssigned) {
        setPreAssignedRoles(nextPreAssigned);
      }

      const detailParts: string[] = [];
      if (attachedMode === 'DELETE_RECORDS') {
        if (deletedMembersCount > 0) detailParts.push(`đã xóa ${deletedMembersCount} TV`);
        if (deletedUsersCount > 0) detailParts.push(`đã xóa ${deletedUsersCount} TK`);
        else if (movedUsersCount > 0) detailParts.push(`${movedUsersCount} TK chờ phân bổ KV`);
      } else {
        if (unassignedMembersCount > 0)
          detailParts.push(`${unassignedMembersCount} TV chờ phân bổ KV`);
        if (movedUsersCount > 0) detailParts.push(`${movedUsersCount} TK chờ phân bổ KV`);
      }
      const suffix = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
      showNotification(
        `Đã xóa vĩnh viễn khu vực ${target.code} (${target.companyCode})${suffix}.`
      );
      return true;
    } catch (err: any) {
      console.error('[OrgDelete] Lỗi xóa Khu vực:', err);
      showNotification(`Không xóa được khu vực: ${err?.message || 'Lỗi phân quyền'}`);
      return false;
    }
  };

  const makeRegionId = (companyCode: string, code: string) => {
    const slug = (v: string) =>
      (v || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `r-${slug(companyCode) || 'x'}-${slug(code) || 'x'}`;
  };
  const handleAddRegion = (region: Omit<Region, 'id'>) => {
    const code = (region.code || '').trim();
    const id = makeRegionId(region.companyCode, code);
    setRegions((prev) =>
      prev.some((r) => r.id === id)
        ? prev
        : [...prev, { ...region, code, name: (region.name || '').trim() || code, id }]
    );
  };
  const handleUpdateRegion = (region: Region) => {
    setRegions((prev) => prev.map((r) => (r.id === region.id ? region : r)));
  };
  const handleDeleteRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
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
    const cleanArea = cleanRawAreaCode(member.areaCode);
    const newMem: Member = {
      ...member,
      areaCode: cleanArea,
      id: `m-${Date.now()}`,
      code: `MEM-${(members.length + 1).toString().padStart(3, '0')}`,
      score: 0,
      targets: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setMembers((prev) => [newMem, ...prev]);
    ensureAreaExistsForOrg(member.companyCode, cleanArea);
  };
  const handleUpdateMember = (member: Member) => {
    setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)));
  };
  const handleDeleteMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleBatchUpdateCompanies = (newCompanies: Company[], mode: 'MERGE' | 'REPLACE' = 'MERGE') => {
    let nextResult: Company[] = newCompanies;
    if (mode !== 'REPLACE') {
      const map = new Map(companies.map((c) => [normalizeOrgCode(c.code), c]));
      newCompanies.forEach((c) => {
        const key = normalizeOrgCode(c.code);
        const existing = map.get(key);
        map.set(key, existing ? { ...existing, ...c, id: existing.id } : c);
      });
      nextResult = Array.from(map.values());
    }
    setCompanies(nextResult);
    triggerCatchAllClusterSync(nextResult);
    if (isAdminUser) {
      const importedNorms = new Set(newCompanies.map((c) => normalizeOrgCode(c.code)).filter(Boolean));
      const nextDeletedCompanies = (orgSyncConfig?.deletedCompanyCodes || []).filter(
        (c) => !importedNorms.has(normalizeOrgCode(c))
      );
      void setDoc(
        doc(db, 'system_config', 'org_sync'),
        {
          orgInitialized: true,
          deletedCompanyCodes: nextDeletedCompanies,
          deletedAreaKeys: orgSyncConfig?.deletedAreaKeys || [],
          updatedAt: new Date().toISOString(),
          updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        },
        { merge: true }
      ).catch(() => undefined);
    }
    showNotification(`Đã đồng bộ ${newCompanies.length} công ty từ file Excel!`);
  };

  const handleBatchUpdateAreas = (newAreas: Area[], mode: 'MERGE' | 'REPLACE' = 'MERGE') => {
    setAreas((prev) => {
      if (mode === 'REPLACE') return newAreas;
      const keyOf = (a: Area) => `${normalizeOrgCode(a.companyCode)}::${normalizeOrgCode(a.code)}`;
      const map = new Map(prev.map((a) => [keyOf(a), a]));
      newAreas.forEach((a) => {
        const k = keyOf(a);
        const existing = map.get(k);
        map.set(k, existing ? { ...existing, ...a, id: existing.id } : a);
      });
      return Array.from(map.values());
    });
    if (isAdminUser) {
      const importedAreaKeys = new Set(
        newAreas.map((a) => normalizeDeletedAreaKey(a.companyCode, a.code)).filter(Boolean)
      );
      const nextDeletedAreas = (orgSyncConfig?.deletedAreaKeys || []).filter((entry) => {
        const p = parseAreaScopeEntry(entry);
        return !(p.hasCompanyPrefix && importedAreaKeys.has(`${p.companyCode}::${p.areaCode}`));
      });
      void setDoc(
        doc(db, 'system_config', 'org_sync'),
        {
          orgInitialized: true,
          deletedCompanyCodes: orgSyncConfig?.deletedCompanyCodes || [],
          deletedAreaKeys: nextDeletedAreas,
          updatedAt: new Date().toISOString(),
          updatedBy: effectiveCurrentUser?.fullName || 'Admin',
        },
        { merge: true }
      ).catch(() => undefined);
    }
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
    const registeredMemberIds = new Set(usersList.map((u) => u.memberId || `m-${u.id}`));
    setMembers((prev) => {
      if (mode === 'REPLACE') {
        const importedIds = new Set(newMembers.map((m) => m.id));
        const importedCodes = new Set(newMembers.map((m) => m.code).filter(Boolean));
        const preservedRegistered = prev.filter(
          (m) =>
            registeredMemberIds.has(m.id) &&
            !importedIds.has(m.id) &&
            !(m.code && importedCodes.has(m.code))
        );
        return [...newMembers, ...preservedRegistered];
      }
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
      .then(async () => {
        await setDoc(
          doc(db, 'system_config', 'org_sync'),
          {
            orgInitialized: true,
            deletedCompanyCodes: [],
            deletedAreaKeys: [],
            updatedAt: new Date().toISOString(),
            updatedBy: effectiveCurrentUser?.fullName || 'Admin',
          },
          { merge: true }
        );
        showNotification('Đã nạp danh mục mẫu (công ty, khu vực, ban ngành).');
      })
      .catch((err) => showNotification(`Không nạp được danh mục mẫu: ${err.message}`));
  };

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarOpen((prev) => !prev);
    } else {
      setIsMobileDrawerOpen((prev) => !prev);
    }
  };

  const openAuthModalWithMode = (mode: 'LOGIN' | 'REGISTER') => {
    setAuthModalInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  // ---------- PHƯƠNG ÁN A: Cổng xác thực + Khóa Mã cá nhân 6 số toàn hệ thống ----------
  if (securityGateMode !== null) {
    return (
      <>
        {notification && (
          <div className="fixed bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        <SecurityGateScreen
          mode={securityGateMode}
          firebaseUser={firebaseUser}
          currentUser={effectiveCurrentUser}
          profileError={profileError}
          companies={effectiveCompanies}
          areas={effectiveAreas}
          departments={effectiveDepartments}
          requireRegistrationApproval={effectiveSecurityConfig.requireRegistrationApproval}
          onOpenAuthModal={openAuthModalWithMode}
          onCompleteOnboarding={handleCompleteOnboarding}
          onSetupPin={handleSetupPin}
          onPinUnlocked={() => {
            if (firebaseUser?.uid) setPinUnlockedUid(firebaseUser.uid);
          }}
          onRetryProfile={handleRetryProfile}
          onResendVerificationEmail={async () => {
            await resendVerificationEmail();
            showNotification('Đã gửi lại thư xác thực tới email của bạn.');
          }}
          onCheckEmailVerified={async () => {
            const res = await reloadCurrentAuthUser();
            if (res.emailVerified) {
              setFirebaseUser(auth.currentUser);
              setProfileRetryTick((n) => n + 1);
            }
            return res.emailVerified;
          }}
          onLogout={handleLogout}
          logoConfig={appearanceConfig?.logo}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalInitialMode}
          onClose={() => setIsAuthModalOpen(false)}
          companies={effectiveCompanies}
          areas={effectiveAreas}
          departments={effectiveDepartments}
          requireRegistrationApproval={effectiveSecurityConfig.requireRegistrationApproval}
          onRegister={handleRegister}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f6fb] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 antialiased selection:bg-amber-200 selection:text-amber-900 transition-colors duration-300">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Minimal Header: Sau khi đăng nhập thay nút "Tài khoản" bằng Profile + Đăng xuất */}
      <TopHeader
        isSidebarOpen={isDesktopSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
        onRefreshUI={handleRefresh}
        onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
        currentUser={effectiveCurrentUser}
        onNavigateProfile={() => setActiveTab('PROFILE')}
        onLogout={handleLogout}
        onLockPin={() => setPinUnlockedUid(null)}
        pendingApprovals={isAdminUser ? pendingApprovalUsers : []}
        onNavigateAdminRoles={() => {
          setAdminNavTab('ROLES');
          setAdminNavTrigger((n) => n + 1);
          setActiveTab('ADMIN');
        }}
        onNavigateAdmin={
          canAccessAdminPanel(effectiveCurrentUser?.role)
            ? () => {
                setAdminNavTab(isAdminUser ? 'SCORING' : 'MEMBERS');
                setAdminNavTrigger((n) => n + 1);
                setActiveTab('ADMIN');
              }
            : undefined
        }
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onNavigateHome={() => setActiveTab('ENTRY')}
        logoConfig={appearanceConfig?.logo}
      />

      {/* Shell: Vertical Left Sidebar (3 Mục Chính) + Main Workspace */}
      <div className="flex flex-1 min-h-0">
        <SideNavigation
          isDesktopOpen={isDesktopSidebarOpen}
          isMobileOpen={isMobileDrawerOpen}
          onCloseMobile={() => setIsMobileDrawerOpen(false)}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'ADMIN') {
              setAdminNavTab(isAdminUser ? 'SCORING' : 'MEMBERS');
              setAdminNavTrigger((n) => n + 1);
            }
            setActiveTab(tab);
          }}
          currentUser={effectiveCurrentUser}
          pendingApprovalCount={isAdminUser ? pendingApprovalUsers.length : 0}
          onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
          onLogout={handleLogout}
          logoConfig={appearanceConfig?.logo}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {rulesSyncWarning && (
            <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full pt-2.5">
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700/70 px-3.5 py-2.5 shadow-sm flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-rose-900 dark:text-rose-100 leading-relaxed">
                    {rulesSyncWarning}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRulesSyncWarning(null)}
                  aria-label="Đóng cảnh báo"
                  className="p-1 rounded-lg text-rose-500 hover:text-rose-800 dark:text-rose-300 dark:hover:text-white hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {/* Actionable Real-Time Pending Registration Alert Banner for Admin/SuperAdmin */}
          {isAdminUser &&
            pendingApprovalUsers.length > 0 &&
            dismissedPendingSignature !== pendingApprovalSignature &&
            !(activeTab === 'ADMIN' && adminNavTab === 'ROLES') && (
              <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full pt-2.5">
                <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 dark:from-amber-950/60 dark:via-rose-950/50 dark:to-amber-950/60 border border-amber-300 dark:border-amber-700/70 px-3.5 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>
                          {pendingApprovalUsers.length} đăng ký mới đang chờ phê duyệt
                        </span>
                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 truncate">
                          · {pendingApprovalUsers[0].fullName} ({pendingApprovalUsers[0].companyCode} · KV{' '}
                          {pendingApprovalUsers[0].areaCode})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        {pendingApprovalUsers[0].email}
                        {pendingApprovalUsers.length > 1
                          ? ` và ${pendingApprovalUsers.length - 1} tài khoản khác`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminNavTab('ROLES');
                        setAdminNavTrigger((n) => n + 1);
                        setActiveTab('ADMIN');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <span>Xem &amp; Duyệt ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedPendingSignature(pendingApprovalSignature)}
                      aria-label="Ẩn thông báo tạm thời"
                      title="Ẩn tạm thời"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* TAB: BÁO CÁO HẰNG NGÀY (Trang chủ mặc định) */}
          {activeTab === 'ENTRY' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
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
                onNavigateTab={(tab) => {
                  if (tab === 'ADMIN') {
                    setAdminNavTab(isAdminUser ? 'SCORING' : 'MEMBERS');
                    setAdminNavTrigger((n) => n + 1);
                  }
                  setActiveTab(tab);
                }}
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
            const mainIds: HonorsWidgetId[] = ['LEADERBOARD'];

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
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                        <span>⚡ Thao tác nhanh</span>
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
              <div className="flex-1 pb-8 sm:pb-12">
                {isAdminUser && (
                  <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminNavTab('APPEARANCE_FONT');
                        setAdminNavTrigger((n) => n + 1);
                        setActiveTab('ADMIN');
                      }}
                      className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Tùy chỉnh Font &amp; Sắp xếp Widget</span>
                    </button>
                  </div>
                )}

                {visibleOrdered.length === 0 ? (
                  <div className="max-w-xl mx-auto px-4 py-10 text-center">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
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
                            onClick={() => {
                              setAdminNavTab('APPEARANCE_FONT');
                              setAdminNavTrigger((n) => n + 1);
                              setActiveTab('ADMIN');
                            }}
                            className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer"
                          >
                            Mở Tùy chỉnh Widget
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-5">
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
                          className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full"
                        >
                          {mainInBatch.length > 0 && sideInBatch.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 items-start">
                              <div
                                className={`lg:col-span-8 space-y-3 sm:space-y-5 ${
                                  firstIsSide ? 'order-2 lg:order-1' : 'order-1'
                                }`}
                              >
                                {mainInBatch.map((wId) => renderWidgetById(wId))}
                              </div>
                              <div
                                className={`lg:col-span-4 space-y-3 sm:space-y-5 ${
                                  firstIsSide ? 'order-1 lg:order-2' : 'order-2'
                                }`}
                              >
                                {sideInBatch.map((wId) => renderWidgetById(wId))}
                              </div>
                            </div>
                          ) : mainInBatch.length > 0 ? (
                            <div className="space-y-3 sm:space-y-5">
                              {mainInBatch.map((wId) => renderWidgetById(wId))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 items-start">
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
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              <DisciplesPage
                currentUser={effectiveCurrentUser}
                disciples={disciples}
                isLoading={disciplesLoading}
                companies={effectiveCompanies}
                areas={effectiveAreas}
                onCreateDisciple={handleCreateDisciple}
                onUpdateDiscipleFull={handleUpdateDiscipleFull}
                onUpdateDiscipleProgressNote={handleUpdateDiscipleProgressNote}
                onDeleteDisciple={handleDeleteDisciple}
                onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: TỔNG QUAN BÁO CÁO (Mục Turbo - Thẻ thứ 4) */}
          {activeTab === 'REPORT_OVERVIEW' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              <DailyReportOverviewPage
                currentUser={effectiveCurrentUser}
                members={allMembersRanked}
                companies={effectiveCompanies}
                areas={effectiveAreas}
                clusters={clustersConfig?.clusters}
                regions={regions}
                dailyReports={dailyReports}
                activeEvent={activeEvent}
                defaultWeights={effectiveDefaultWeights}
                onNavigateToEntry={() => setActiveTab('ENTRY')}
                onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: TRANG EVENT (Mục Event) */}
          {activeTab === 'EVENT_HUB' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
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
                        setAdminNavTrigger((n) => n + 1);
                        setActiveTab('ADMIN');
                      }
                    : undefined
                }
              />
            </main>
          )}

          {/* TAB: EDU LMS (Mục Edu) */}
          {activeTab === 'EDU_LMS' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              <EduLmsPage
                currentUser={effectiveCurrentUser}
                topics={eduTopics}
                assignments={eduAssignments}
                companies={effectiveCompanies}
                areas={effectiveAreas}
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
                onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: EDU CMS (Mục Edu) */}
          {activeTab === 'EDU_CMS' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              <EduCmsPage
                currentUser={effectiveCurrentUser}
                cmsProfiles={eduCmsProfiles}
                topics={eduTopics}
                companies={effectiveCompanies}
                areas={effectiveAreas}
                initialSubTab={cmsNavIntent.subTab}
                initialTopicId={cmsNavIntent.topicId}
                onSaveCmsProfile={handleSaveEduCmsProfile}
                onDeleteCmsProfile={handleDeleteEduCmsProfile}
                onSaveTopicCurriculum={handleSaveTopicCurriculum}
                onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: HỒ SƠ CÁ NHÂN (Mục Công Việc) */}
          {activeTab === 'PROFILE' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              {effectiveCurrentUser ? (
                <ProfilePage
                  currentUser={effectiveCurrentUser}
                  memberData={currentMemberData}
                  members={allMembersRanked}
                  myHuongKhiList={myHuongKhiList}
                  turboJournals={turboJournals}
                  personalPlanners={personalPlanners}
                  vocabularyConfig={vocabularyConfig}
                  dailyReports={dailyReports}
                  periodGoals={periodGoals}
                  activeEvent={activeEvent}
                  defaultWeights={effectiveDefaultWeights}
                  disciples={disciples}
                  companies={effectiveCompanies}
                  areas={effectiveAreas}
                  departments={effectiveDepartments}
                  onNavigateToEntry={() => setActiveTab('ENTRY')}
                  onNavigateToDisciples={() => setActiveTab('DISCIPLES')}
                  onNavigateToHonors={() => setActiveTab('HONORS')}
                  onNavigateToJournalCheer={() => setActiveTab('JOURNAL_CHEER')}
                  onLogout={handleLogout}
                  onOpenRules={() => setIsRulesModalOpen(true)}
                  onAddHuongKhi={handleAddHuongKhi}
                  onDeleteHuongKhi={handleDeleteHuongKhi}
                  onAddTurboJournal={handleAddTurboJournal}
                  onUpdateTurboJournal={handleUpdateTurboJournal}
                  onDeleteTurboJournal={handleDeleteTurboJournal}
                  onSavePersonalPlanner={handleSavePersonalPlanner}
                  onReactHuongKhi={handleReactHuongKhi}
                  onAddComment={handleAddComment}
                  onUpdateProfile={handleUpdateProfile}
                  onChangePin={handleChangePin}
                  onShowNotification={showNotification}
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-6 max-w-md mx-auto text-center shadow-sm border border-slate-100 dark:border-slate-800 my-8">
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
                    onClick={() => openAuthModalWithMode('LOGIN')}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    Đăng nhập / Đăng ký ngay
                  </button>
                </div>
              )}
            </main>
          )}

          {/* TAB: NHẬT KÝ & CỔ VŨ (Mục Công Việc) */}
          {activeTab === 'JOURNAL_CHEER' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              <GratitudeCheerPage
                huongKhiList={huongKhiView}
                currentUser={effectiveCurrentUser}
                companies={effectiveCompanies}
                areas={effectiveAreas}
                vocabularyConfig={vocabularyConfig}
                onAddHuongKhi={handleAddHuongKhi}
                onDeleteHuongKhi={handleDeleteHuongKhi}
                onAddTurboJournal={effectiveCurrentUser ? handleAddTurboJournal : undefined}
                onReactHuongKhi={handleReactHuongKhi}
                onAddComment={handleAddComment}
                onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
                onNavigateProfile={() => setActiveTab('PROFILE')}
                onShowNotification={showNotification}
              />
            </main>
          )}

          {/* TAB: LỊCH LÀM VIỆC TUẦN (Mục Công Việc) */}
          {activeTab === 'WORK_SCHEDULE' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              <WorkSchedulePage
                currentUser={effectiveCurrentUser}
                workSchedules={workSchedules}
                isLoading={workSchedulesLoading}
                readError={workSchedulesError}
                members={allMembersRanked}
                companies={effectiveCompanies}
                areas={effectiveAreas}
                onSaveWorkSchedule={handleSaveWorkSchedule}
                onDeleteWorkSchedule={handleDeleteWorkSchedule}
                onOpenAuthModal={() => openAuthModalWithMode('LOGIN')}
                onShowNotification={showNotification}
                showWsSection={
                  appearanceConfig?.llvWidgets?.showWsSection ??
                  DEFAULT_LLV_WIDGET_VISIBILITY.showWsSection
                }
              />
            </main>
          )}

          {/* TAB: TRANG QUẢN TRỊ */}
          {activeTab === 'ADMIN' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full py-2.5 sm:py-4 flex-1">
              {canAccessAdminPanel(effectiveCurrentUser?.role) ? (
                <AdminPanel
                  initialTab={adminNavTab}
                  initialTabTrigger={adminNavTrigger}
                  companies={effectiveCompanies}
                  areas={effectiveAreas}
                  departments={effectiveDepartments}
                  members={allMembersRanked}
                  onAddCompany={handleAddCompany}
                  onUpdateCompany={handleUpdateCompany}
                  onDeleteCompany={handleDeleteCompany}
                  regions={regions}
                  onAddRegion={handleAddRegion}
                  onUpdateRegion={handleUpdateRegion}
                  onDeleteRegion={handleDeleteRegion}
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
                  onDeleteUserAccount={handleDeleteUserAccount}
                  preAssignedRoles={preAssignedRoles}
                  onPreAssignRole={handlePreAssignRole}
                  onDeletePreAssignedRole={handleDeletePreAssignedRole}
                  onResetUserPin={handleResetUserPin}
                  securityConfig={effectiveSecurityConfig}
                  onSaveSecurityConfig={handleSaveSecurityConfig}
                  onApproveUser={handleApproveUser}
                  onRejectUser={handleRejectUser}
                  bannerConfig={bannerConfig}
                  events={sortedEvents}
                  onSaveBannerConfig={handleSaveBannerConfig}
                  onSaveEvent={handleSaveEvent}
                  onDeleteEvent={handleDeleteEvent}
                  scoringConfig={scoringConfig}
                  appearanceConfig={appearanceConfig}
                  vocabularyConfig={vocabularyConfig}
                  clustersConfig={clustersConfig}
                  activeEvent={activeEvent}
                  onSaveScoringConfig={handleSaveScoringConfig}
                  onSaveAppearanceConfig={handleSaveAppearanceConfig}
                  onSaveVocabularyConfig={handleSaveVocabularyConfig}
                  onSaveClustersConfig={handleSaveClustersConfig}
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
                    Trang Quản trị chỉ dành cho tài khoản từ cấp Uni (Cấp 2) trở lên.
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
        initialMode={authModalInitialMode}
        onClose={() => setIsAuthModalOpen(false)}
        companies={effectiveCompanies}
        areas={effectiveAreas}
        departments={effectiveDepartments}
        requireRegistrationApproval={effectiveSecurityConfig.requireRegistrationApproval}
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
        pendingApprovalCount={isAdminUser ? pendingApprovalUsers.length : 0}
      />
    </div>
  );
}
