import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Plus,
  Search,
  Users,
  Home,
  Megaphone,
  Handshake,
  Heart,
  TrendingUp,
  Star,
  Building2,
  ClipboardList,
  X,
  Eye,
  Layers,
  MapPinned,
  RotateCcw,
} from 'lucide-react';
import {
  Area,
  Company,
  DAILY_METRIC_DEFINITIONS,
  DailyMetricKey,
  DailyReportMetrics,
  DailyReportRecord,
  DEFAULT_EVENT_WEIGHTS,
  EMPTY_DAILY_METRICS,
  FestivalEvent,
  Member,
  OrgCluster,
  Region,
  ROLE_DISPLAY_META,
  UserAccount,
  canExportExcel,
  getRoleLevel,
} from '../types/edulms';
import {
  canAccessMemberReportOverview,
  cleanRawAreaCode,
  getEffectiveOrgClusters,
  getMemberUnitCode,
  getRbacScopeDescription,
  getRoleScopedDropdownLabels,
  getScopedAreaOptions,
  getScopedClusterOptions,
  getScopedCompanyOptions,
  getScopedMemberOptions,
  getScopedRegionOptions,
  isAdminRole,
  normalizeOrgCode,
  resolveClusterForCompany,
  resolveRegionForArea,
} from '../utils/rbac';
import { computeDailyMetricsScore, sumDailyReportMetrics } from '../utils/scoringEngine';
import {
  DailyReportExportPeriod,
  exportDailyReportsByRbacExcel,
} from '../utils/reportExporter';
import { CustomSelect } from './CustomSelect';

interface DailyReportOverviewPageProps {
  currentUser: UserAccount | null;
  members: Member[];
  companies: Company[];
  areas: Area[];
  clusters?: OrgCluster[];
  regions?: Region[];
  dailyReports: DailyReportRecord[];
  activeEvent: FestivalEvent | null;
  defaultWeights?: DailyReportMetrics;
  onNavigateToEntry: () => void;
  onOpenAuthModal: () => void;
  onShowNotification: (msg: string) => void;
}

type OverviewViewTab = 'UNITS' | 'MEMBERS' | 'LOGS';
type OrgStatLevel = 'CLUSTER' | 'COMPANY' | 'REGION' | 'AREA' | 'UNI';
type SubmissionFilter = 'ALL' | 'REPORTED' | 'MISSING';

const METRIC_ICON_MAP: Record<
  DailyMetricKey,
  { icon: React.ComponentType<{ className?: string }>; textCls: string; barCls: string }
> = {
  kn: { icon: Users, textCls: 'text-sky-600 dark:text-sky-400', barCls: 'bg-sky-500' },
  tham: { icon: Home, textCls: 'text-emerald-600 dark:text-emerald-400', barCls: 'bg-emerald-500' },
  gm: { icon: Megaphone, textCls: 'text-amber-600 dark:text-amber-400', barCls: 'bg-amber-500' },
  dt: { icon: Handshake, textCls: 'text-indigo-600 dark:text-indigo-400', barCls: 'bg-indigo-500' },
  hh: { icon: Heart, textCls: 'text-rose-600 dark:text-rose-400', barCls: 'bg-rose-500' },
  kt: { icon: TrendingUp, textCls: 'text-purple-600 dark:text-purple-400', barCls: 'bg-purple-500' },
  wsNew: { icon: Star, textCls: 'text-teal-600 dark:text-teal-400', barCls: 'bg-teal-500' },
};

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

function shiftMonthStr(monthStr: string, deltaMonths: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateVN(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function sumReportGoals(reports: DailyReportRecord[]): DailyReportMetrics {
  const sum: DailyReportMetrics = { ...EMPTY_DAILY_METRICS };
  reports.forEach((rep) => {
    const g = rep.goals;
    if (!g) return;
    sum.kn += Number(g.kn) || 0;
    sum.tham += Number(g.tham) || 0;
    sum.gm += Number(g.gm) || 0;
    sum.dt += Number(g.dt) || 0;
    sum.hh += Number(g.hh) || 0;
    sum.kt += Number(g.kt) || 0;
    sum.wsNew += Number(g.wsNew) || 0;
  });
  return sum;
}

function sumAll7(m: DailyReportMetrics): number {
  return (
    (m.kn || 0) +
    (m.tham || 0) +
    (m.gm || 0) +
    (m.dt || 0) +
    (m.hh || 0) +
    (m.kt || 0) +
    (m.wsNew || 0)
  );
}

interface MemberOverviewRow {
  member: Member;
  daysCount: number;
  results: DailyReportMetrics;
  goals: DailyReportMetrics;
  score: number;
  reports: DailyReportRecord[];
}

interface OrgOverviewRow {
  key: string;
  label: string;
  subLabel: string;
  totalMembers: number;
  activeReporters: number;
  reportsCount: number;
  results: DailyReportMetrics;
  goals: DailyReportMetrics;
  score: number;
  clusterId?: string;
  companyCode?: string;
  regionId?: string;
  areaCode?: string;
}

const MetricResultGoalCell: React.FC<{
  result: number;
  goal: number;
  compact?: boolean;
  showMtPrefix?: boolean;
}> = ({ result, goal, compact = false, showMtPrefix = true }) => {
  const metGoal = goal > 0 && result >= goal;
  return (
    <div className="leading-tight tabular-nums whitespace-nowrap">
      <div
        className={`${compact ? 'text-xs sm:text-sm' : 'text-sm'} font-bold ${
          result > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'
        }`}
      >
        {result.toLocaleString('vi-VN')}
      </div>
      <div
        className={`text-[10px] font-medium mt-0.5 whitespace-nowrap ${
          metGoal
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {showMtPrefix ? `MT: ${goal.toLocaleString('vi-VN')}` : goal.toLocaleString('vi-VN')}
      </div>
    </div>
  );
};

export const DailyReportOverviewPage: React.FC<DailyReportOverviewPageProps> = ({
  currentUser,
  members,
  companies,
  areas,
  clusters = [],
  regions = [],
  dailyReports,
  activeEvent,
  defaultWeights,
  onNavigateToEntry,
  onOpenAuthModal,
  onShowNotification,
}) => {
  const todayStr = useMemo(() => getTodayStr(), []);
  const [periodMode, setPeriodMode] = useState<DailyReportExportPeriod>('MONTH');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(todayStr.slice(0, 4));

  const [clusterFilter, setClusterFilter] = useState<string>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [memberFilter, setMemberFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewTab, setViewTab] = useState<OverviewViewTab>('MEMBERS');
  const [orgLevelTab, setOrgLevelTab] = useState<OrgStatLevel>('CLUSTER');
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('ALL');
  const [visibleLogsLimit, setVisibleLogsLimit] = useState<number>(30);
  const [inspectedMemberRow, setInspectedMemberRow] = useState<MemberOverviewRow | null>(null);

  const weights = useMemo(
    () => activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS,
    [activeEvent?.weights, defaultWeights]
  );

  const viewerLevel = getRoleLevel(currentUser?.role);
  const isAdmin = isAdminRole(currentUser?.role);
  const isPersonalOnly = currentUser?.role === 'MEMBER';

  // Phân cấp thống kê tối đa <= cấp độ của user hiện tại
  const canViewClusterLevel = viewerLevel >= 5; // QL Cụm (5), Admin (6), Super Admin (7)
  const canViewSionAndRegionLevel = viewerLevel >= 4; // TS/NQ (4) trở lên
  const canViewAreaLevel = viewerLevel >= 3; // Gru (3) trở lên
  const canViewUniLevel = viewerLevel >= 2; // Uni (2) trở lên

  const availableOrgLevels = useMemo<Array<{ id: OrgStatLevel; label: string }>>(() => {
    const items: Array<{ id: OrgStatLevel; label: string }> = [];
    if (canViewClusterLevel) items.push({ id: 'CLUSTER', label: 'Cụm Sion' });
    if (canViewSionAndRegionLevel) {
      items.push({ id: 'COMPANY', label: 'Sion' });
      items.push({ id: 'REGION', label: 'Địa vực' });
    }
    if (canViewAreaLevel) items.push({ id: 'AREA', label: 'Khu vực' });
    if (canViewUniLevel) items.push({ id: 'UNI', label: 'Đội / Uni' });
    return items;
  }, [canViewClusterLevel, canViewSionAndRegionLevel, canViewAreaLevel, canViewUniLevel]);

  // Đảm bảo tab cấp đơn vị luôn nằm trong phân quyền <= cấp user
  useEffect(() => {
    if (availableOrgLevels.length === 0) return;
    if (!availableOrgLevels.some((l) => l.id === orgLevelTab)) {
      setOrgLevelTab(availableOrgLevels[0].id);
    }
  }, [availableOrgLevels, orgLevelTab]);

  // Reset bộ lọc vượt quyền nếu user thay đổi vai trò
  useEffect(() => {
    if (!canViewClusterLevel && clusterFilter !== 'ALL') setClusterFilter('ALL');
    if (!canViewSionAndRegionLevel && regionFilter !== 'ALL') setRegionFilter('ALL');
  }, [canViewClusterLevel, canViewSionAndRegionLevel, clusterFilter, regionFilter]);

  const effectiveClusters = useMemo(
    () => getEffectiveOrgClusters(clusters, companies),
    [clusters, companies]
  );

  // Tất cả thành viên trong phạm vi phân quyền của viewer
  const rbacMembers = useMemo(() => {
    if (!currentUser) return [];
    const ownMemberId = currentUser.memberId || `m-${currentUser.id}`;
    const list = members.filter((m) => canAccessMemberReportOverview(currentUser, m));

    const hasSelf = list.some((m) => m.id === ownMemberId || m.id === currentUser.id);
    if (!hasSelf) {
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
  }, [currentUser, members, todayStr]);

  // Danh sách Cụm -> Sion -> Địa vực -> Khu vực -> Cá nhân liên hoàn theo phân quyền
  const scopedClusterOptions = useMemo(() => {
    if (!currentUser || !canViewClusterLevel) return [];
    return getScopedClusterOptions(currentUser, effectiveClusters, companies, rbacMembers);
  }, [currentUser, canViewClusterLevel, effectiveClusters, companies, rbacMembers]);

  const selectedClusterOpt = useMemo(() => {
    if (!canViewClusterLevel || clusterFilter === 'ALL') return null;
    return scopedClusterOptions.find((o) => o.cluster.id === clusterFilter) || null;
  }, [canViewClusterLevel, clusterFilter, scopedClusterOptions]);

  const selectedClusterCompanyNorms = useMemo(() => {
    if (!selectedClusterOpt) return null;
    return new Set(selectedClusterOpt.companyCodes.map((c) => normalizeOrgCode(c)));
  }, [selectedClusterOpt]);

  const selectableCompanies = useMemo(() => {
    if (!currentUser || isPersonalOnly) return [];
    const base = getScopedCompanyOptions(currentUser, companies, rbacMembers);
    if (!selectedClusterOpt) return base;
    return base.filter((c) => {
      if (selectedClusterOpt.cluster.isCatchAll) {
        const resolved = resolveClusterForCompany(c.code, effectiveClusters, companies);
        return resolved?.id === selectedClusterOpt.cluster.id;
      }
      return selectedClusterCompanyNorms?.has(normalizeOrgCode(c.code));
    });
  }, [
    currentUser,
    isPersonalOnly,
    companies,
    rbacMembers,
    selectedClusterOpt,
    selectedClusterCompanyNorms,
    effectiveClusters,
  ]);

  const selectableRegions = useMemo(() => {
    if (!currentUser || !canViewSionAndRegionLevel) return [];
    const allowedComps = selectedClusterOpt
      ? new Set(selectableCompanies.map((c) => normalizeOrgCode(c.code)))
      : null;
    return getScopedRegionOptions(currentUser, regions, companyFilter, allowedComps);
  }, [
    currentUser,
    canViewSionAndRegionLevel,
    regions,
    companyFilter,
    selectedClusterOpt,
    selectableCompanies,
  ]);

  const selectedRegionObj = useMemo(() => {
    if (!canViewSionAndRegionLevel || regionFilter === 'ALL') return null;
    return selectableRegions.find((r) => r.id === regionFilter) || null;
  }, [canViewSionAndRegionLevel, regionFilter, selectableRegions]);

  const selectedRegionAreaSet = useMemo(() => {
    if (!selectedRegionObj) return null;
    return new Set(
      (selectedRegionObj.areaCodes || []).map((a) => normalizeOrgCode(cleanRawAreaCode(a)))
    );
  }, [selectedRegionObj]);

  const selectableAreas = useMemo(() => {
    if (!currentUser || isPersonalOnly) return [];
    const allowedComps = new Set(selectableCompanies.map((c) => normalizeOrgCode(c.code)));
    let list = getScopedAreaOptions(currentUser, areas, companyFilter, rbacMembers);
    if (selectedClusterOpt) {
      list = list.filter((a) => allowedComps.has(normalizeOrgCode(a.companyCode)));
    }
    if (selectedRegionObj && selectedRegionAreaSet) {
      list = list.filter(
        (a) =>
          normalizeOrgCode(a.companyCode) === normalizeOrgCode(selectedRegionObj.companyCode) &&
          selectedRegionAreaSet.has(normalizeOrgCode(cleanRawAreaCode(a.code)))
      );
    }
    return list;
  }, [
    currentUser,
    isPersonalOnly,
    areas,
    companyFilter,
    rbacMembers,
    selectableCompanies,
    selectedClusterOpt,
    selectedRegionObj,
    selectedRegionAreaSet,
  ]);

  const selectableMembers = useMemo(() => {
    if (!currentUser || isPersonalOnly) return [];
    const base = getScopedMemberOptions(rbacMembers, companyFilter, areaFilter);
    return base.filter((m) => {
      if (selectedClusterOpt) {
        const resolved = resolveClusterForCompany(m.companyCode, effectiveClusters, companies);
        if (resolved?.id !== selectedClusterOpt.cluster.id) return false;
      }
      if (selectedRegionObj && selectedRegionAreaSet) {
        if (normalizeOrgCode(m.companyCode) !== normalizeOrgCode(selectedRegionObj.companyCode)) {
          return false;
        }
        if (!selectedRegionAreaSet.has(normalizeOrgCode(cleanRawAreaCode(m.areaCode)))) {
          return false;
        }
      }
      return true;
    });
  }, [
    currentUser,
    isPersonalOnly,
    rbacMembers,
    companyFilter,
    areaFilter,
    selectedClusterOpt,
    effectiveClusters,
    companies,
    selectedRegionObj,
    selectedRegionAreaSet,
  ]);

  const showClusterSelector = canViewClusterLevel && scopedClusterOptions.length > 0;
  const showCompanySelector =
    !isPersonalOnly &&
    (isAdmin || currentUser?.role === 'MANAGER' || selectableCompanies.length > 1);
  const showRegionSelector = canViewSionAndRegionLevel && selectableRegions.length > 0;
  const showAreaSelector =
    !isPersonalOnly &&
    (isAdmin ||
      currentUser?.role === 'MANAGER' ||
      currentUser?.role === 'SION_LEADER' ||
      currentUser?.role === 'AREA_LEADER' ||
      selectableAreas.length > 1);
  const showMemberSelector = !isPersonalOnly && selectableMembers.length > 0;

  // Toàn bộ báo cáo trong kỳ đang chọn thuộc phạm vi RBAC (dùng cho khối Cụm Sion nổi bật phía trên)
  const periodRbacReports = useMemo(() => {
    if (!currentUser) return [];
    const ownMemberId = currentUser.memberId || `m-${currentUser.id}`;
    const rbacMemberIdSet = new Set(rbacMembers.map((m) => m.id));

    return dailyReports.filter((r) => {
      if (periodMode === 'DAY' && r.date !== selectedDate) return false;
      if (periodMode === 'MONTH' && r.month !== selectedMonth && !r.date.startsWith(selectedMonth)) {
        return false;
      }
      if (periodMode === 'YEAR' && r.year !== selectedYear && !r.date.startsWith(selectedYear)) {
        return false;
      }
      const mId = r.memberId || `m-${r.uid}`;
      if (isPersonalOnly) {
        return r.uid === currentUser.id || mId === ownMemberId;
      }
      return rbacMemberIdSet.has(mId);
    });
  }, [
    currentUser,
    dailyReports,
    periodMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    isPersonalOnly,
    rbacMembers,
  ]);

  // Thành viên sau khi lọc Cụm / Sion / Địa vực / Khu vực / Cá nhân / Tìm kiếm
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rbacMembers.filter((m) => {
      if (selectedClusterOpt) {
        const resolved = resolveClusterForCompany(m.companyCode, effectiveClusters, companies);
        if (resolved?.id !== selectedClusterOpt.cluster.id) return false;
      }
      if (
        companyFilter !== 'ALL' &&
        normalizeOrgCode(m.companyCode) !== normalizeOrgCode(companyFilter)
      ) {
        return false;
      }
      if (selectedRegionObj && selectedRegionAreaSet) {
        if (normalizeOrgCode(m.companyCode) !== normalizeOrgCode(selectedRegionObj.companyCode)) {
          return false;
        }
        if (!selectedRegionAreaSet.has(normalizeOrgCode(cleanRawAreaCode(m.areaCode)))) {
          return false;
        }
      }
      if (
        areaFilter !== 'ALL' &&
        normalizeOrgCode(cleanRawAreaCode(m.areaCode)) !==
          normalizeOrgCode(cleanRawAreaCode(areaFilter))
      ) {
        return false;
      }
      if (memberFilter !== 'ALL' && m.id !== memberFilter) {
        return false;
      }
      if (q) {
        const cl = canViewClusterLevel
          ? resolveClusterForCompany(m.companyCode, effectiveClusters, companies)
          : null;
        const reg = canViewSionAndRegionLevel
          ? resolveRegionForArea(m.companyCode, m.areaCode, regions)
          : null;
        const hay = [
          m.fullName,
          m.code,
          cl?.name,
          cl?.code,
          m.companyCode,
          reg?.name,
          reg?.code,
          m.areaCode,
          m.unitCode,
          m.departmentCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    rbacMembers,
    selectedClusterOpt,
    effectiveClusters,
    companies,
    companyFilter,
    selectedRegionObj,
    selectedRegionAreaSet,
    areaFilter,
    memberFilter,
    searchQuery,
    canViewClusterLevel,
    canViewSionAndRegionLevel,
    regions,
  ]);

  const filteredMemberIds = useMemo(
    () => new Set(filteredMembers.map((m) => m.id)),
    [filteredMembers]
  );

  // Báo cáo trong kỳ + đúng phạm vi + bộ lọc hiện tại
  const scopedReports = useMemo(() => {
    if (!currentUser) return [];
    const ownMemberId = currentUser.memberId || `m-${currentUser.id}`;

    return periodRbacReports.filter((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      if (isPersonalOnly) {
        return r.uid === currentUser.id || mId === ownMemberId;
      }
      return filteredMemberIds.has(mId);
    });
  }, [currentUser, periodRbacReports, isPersonalOnly, filteredMemberIds]);

  // Dữ liệu Khối thẻ Cụm Sion nổi bật phía trên (dành cho cấp QL Cụm trở lên - không bị ẩn khi chọn lọc 1 cụm)
  const clusterHighlightRows = useMemo<OrgOverviewRow[]>(() => {
    if (!canViewClusterLevel || scopedClusterOptions.length === 0) return [];

    const reportsByMember = new Map<string, DailyReportRecord[]>();
    periodRbacReports.forEach((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      const arr = reportsByMember.get(mId) || [];
      arr.push(r);
      reportsByMember.set(mId, arr);
    });

    const buckets = new Map<
      string,
      {
        cluster: OrgCluster;
        companyCodes: string[];
        totalMembers: number;
        activeReporters: number;
        reports: DailyReportRecord[];
      }
    >();

    scopedClusterOptions.forEach(({ cluster, companyCodes }) => {
      buckets.set(cluster.id, {
        cluster,
        companyCodes: [...companyCodes],
        totalMembers: 0,
        activeReporters: 0,
        reports: [],
      });
    });

    rbacMembers.forEach((m) => {
      const resolved = resolveClusterForCompany(m.companyCode, effectiveClusters, companies);
      if (!resolved) return;
      const bucket = buckets.get(resolved.id);
      if (!bucket) return;
      if (
        m.companyCode &&
        !bucket.companyCodes.some((c) => normalizeOrgCode(c) === normalizeOrgCode(m.companyCode))
      ) {
        bucket.companyCodes.push(m.companyCode);
      }
      bucket.totalMembers += 1;
      const mReps = reportsByMember.get(m.id) || [];
      if (mReps.length > 0) bucket.activeReporters += 1;
      bucket.reports.push(...mReps);
    });

    return Array.from(buckets.values())
      .map((b) => {
        const results = sumDailyReportMetrics(b.reports);
        const goals = sumReportGoals(b.reports);
        const score = computeDailyMetricsScore(results, weights);
        const sionsLabel = b.companyCodes.length ? b.companyCodes.join(', ') : 'Chưa gán Sion';
        return {
          key: b.cluster.id,
          clusterId: b.cluster.id,
          label: b.cluster.name || b.cluster.code,
          subLabel: `Sion: ${sionsLabel}`,
          totalMembers: b.totalMembers,
          activeReporters: b.activeReporters,
          reportsCount: b.reports.length,
          results,
          goals,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || b.reportsCount - a.reportsCount);
  }, [
    canViewClusterLevel,
    scopedClusterOptions,
    periodRbacReports,
    rbacMembers,
    effectiveClusters,
    companies,
    weights,
  ]);

  // Tổng hợp toàn phạm vi (4 KPI + 7 chỉ số)
  const overallTotals = useMemo(() => {
    const results = sumDailyReportMetrics(scopedReports);
    const goals = sumReportGoals(scopedReports);
    const totalScore = computeDailyMetricsScore(results, weights);
    const totalResultsSum = sumAll7(results);
    const totalGoalsSum = sumAll7(goals);
    const activeReporters = new Set(scopedReports.map((r) => r.memberId || `m-${r.uid}`)).size;

    let topMetric = DAILY_METRIC_DEFINITIONS[0];
    let topMetricVal = -1;
    DAILY_METRIC_DEFINITIONS.forEach((def) => {
      const val = results[def.key] || 0;
      if (val > topMetricVal) {
        topMetricVal = val;
        topMetric = def;
      }
    });

    const overallPct =
      totalGoalsSum > 0
        ? Math.min(100, Math.round((totalResultsSum / totalGoalsSum) * 100))
        : totalResultsSum > 0
        ? 100
        : 0;

    return {
      results,
      goals,
      totalScore,
      totalResultsSum,
      totalGoalsSum,
      activeReporters,
      topMetric,
      topMetricVal: Math.max(0, topMetricVal),
      overallPct,
    };
  }, [scopedReports, weights]);

  // Tổng hợp theo từng Thành viên
  const memberOverviewRows = useMemo<MemberOverviewRow[]>(() => {
    const reportsByMember = new Map<string, DailyReportRecord[]>();
    scopedReports.forEach((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      const arr = reportsByMember.get(mId) || [];
      arr.push(r);
      reportsByMember.set(mId, arr);
    });

    return filteredMembers
      .map((member) => {
        const list = (reportsByMember.get(member.id) || []).sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        const results = sumDailyReportMetrics(list);
        const goals = sumReportGoals(list);
        const score = computeDailyMetricsScore(results, weights);
        return {
          member,
          daysCount: list.length,
          results,
          goals,
          score,
          reports: list,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.daysCount - a.daysCount ||
          (a.member.fullName || '').localeCompare(b.member.fullName || '', 'vi')
      );
  }, [filteredMembers, scopedReports, weights]);

  const displayedMemberRows = useMemo(() => {
    if (submissionFilter === 'REPORTED') return memberOverviewRows.filter((r) => r.daysCount > 0);
    if (submissionFilter === 'MISSING') return memberOverviewRows.filter((r) => r.daysCount === 0);
    return memberOverviewRows;
  }, [memberOverviewRows, submissionFilter]);

  const reportedCount = useMemo(
    () => memberOverviewRows.filter((r) => r.daysCount > 0).length,
    [memberOverviewRows]
  );
  const missingCount = memberOverviewRows.length - reportedCount;

  // Tổng hợp đa cấp Tổ chức: Cụm Sion -> Sion -> Địa vực -> Khu vực -> Đội/Uni (theo orgLevelTab)
  const orgOverviewRows = useMemo<OrgOverviewRow[]>(() => {
    if (isPersonalOnly) return [];

    type Bucket = {
      key: string;
      label: string;
      subLabel: string;
      totalMembers: number;
      activeReporters: number;
      reports: DailyReportRecord[];
      clusterId?: string;
      companyCode?: string;
      regionId?: string;
      areaCode?: string;
      subSet: Set<string>;
    };

    const map = new Map<string, Bucket>();

    memberOverviewRows.forEach((row) => {
      const comp = row.member.companyCode || '—';
      const area = cleanRawAreaCode(row.member.areaCode) || '—';
      const unit =
        getMemberUnitCode(row.member) ||
        row.member.unitCode ||
        row.member.departmentCode ||
        'Chưa gắn Uni';
      const cl = canViewClusterLevel
        ? resolveClusterForCompany(comp, effectiveClusters, companies)
        : null;
      const reg = canViewSionAndRegionLevel ? resolveRegionForArea(comp, area, regions) : null;

      let key = '';
      let label = '';
      let subLabel = '';
      let clusterId: string | undefined;
      let companyCode: string | undefined;
      let regionId: string | undefined;
      let areaCode: string | undefined;
      let subItem = '';

      if (orgLevelTab === 'CLUSTER') {
        key = cl ? cl.id : '__unclustered__';
        label = cl ? `Cụm ${cl.name || cl.code}` : 'Cụm Khác';
        subLabel = '';
        clusterId = cl?.id;
        subItem = comp !== '—' ? comp : '';
      } else if (orgLevelTab === 'COMPANY') {
        key = normalizeOrgCode(comp) || '__no_company__';
        label = comp !== '—' ? `Sion ${comp}` : 'Chưa gắn Sion';
        subLabel = cl ? `Cụm ${cl.name || cl.code}` : '';
        companyCode = comp;
        subItem = area !== '—' ? `KV ${area}` : '';
      } else if (orgLevelTab === 'REGION') {
        key = reg ? reg.id : `unassigned__${normalizeOrgCode(comp)}`;
        label = reg ? reg.name || reg.code : 'Chưa gắn Địa vực';
        subLabel = [cl ? `Cụm ${cl.name || cl.code}` : '', comp !== '—' ? `Sion ${comp}` : '']
          .filter(Boolean)
          .join(' · ');
        companyCode = comp;
        regionId = reg?.id;
        subItem = area !== '—' ? `KV ${area}` : '';
      } else if (orgLevelTab === 'AREA') {
        key = `${normalizeOrgCode(comp)}__${normalizeOrgCode(area)}`;
        label = area !== '—' ? `KV ${area}` : 'Chưa gắn KV';
        subLabel = [
          comp !== '—' ? `Sion ${comp}` : '',
          reg ? reg.name || reg.code : '',
        ]
          .filter(Boolean)
          .join(' · ');
        companyCode = comp;
        areaCode = row.member.areaCode || area;
        subItem = unit !== 'Chưa gắn Uni' ? unit : '';
      } else {
        key = `${normalizeOrgCode(comp)}__${normalizeOrgCode(area)}__${normalizeOrgCode(unit)}`;
        label = unit;
        subLabel = [comp !== '—' ? comp : '', area !== '—' ? `KV ${area}` : '']
          .filter(Boolean)
          .join(' · ');
        companyCode = comp;
        areaCode = row.member.areaCode || area;
      }

      const cur = map.get(key) || {
        key,
        label,
        subLabel,
        totalMembers: 0,
        activeReporters: 0,
        reports: [],
        clusterId,
        companyCode,
        regionId,
        areaCode,
        subSet: new Set<string>(),
      };

      if (subItem) cur.subSet.add(subItem);
      cur.totalMembers += 1;
      if (row.daysCount > 0) cur.activeReporters += 1;
      cur.reports.push(...row.reports);
      map.set(key, cur);
    });

    return Array.from(map.values())
      .map((g) => {
        const results = sumDailyReportMetrics(g.reports);
        const goals = sumReportGoals(g.reports);
        const score = computeDailyMetricsScore(results, weights);
        let computedSub = g.subLabel;
        if (orgLevelTab === 'CLUSTER') {
          const sions = Array.from(g.subSet).sort();
          computedSub = sions.length ? `Sion: ${sions.join(', ')}` : 'Chưa có Sion';
        } else if (orgLevelTab === 'REGION' && g.subSet.size > 0) {
          computedSub = [g.subLabel, Array.from(g.subSet).sort().join(', ')]
            .filter(Boolean)
            .join(' · ');
        }
        return {
          key: g.key,
          label: g.label,
          subLabel: computedSub,
          totalMembers: g.totalMembers,
          activeReporters: g.activeReporters,
          reportsCount: g.reports.length,
          results,
          goals,
          score,
          clusterId: g.clusterId,
          companyCode: g.companyCode,
          regionId: g.regionId,
          areaCode: g.areaCode,
        };
      })
      .sort((a, b) => b.score - a.score || b.reportsCount - a.reportsCount);
  }, [
    isPersonalOnly,
    memberOverviewRows,
    orgLevelTab,
    canViewClusterLevel,
    canViewSionAndRegionLevel,
    effectiveClusters,
    companies,
    regions,
    weights,
  ]);

  const handleDrillDownOrgRow = (row: OrgOverviewRow) => {
    if (orgLevelTab === 'CLUSTER' && row.clusterId) {
      setClusterFilter(row.clusterId);
      setCompanyFilter('ALL');
      setRegionFilter('ALL');
      setAreaFilter('ALL');
      setMemberFilter('ALL');
      setOrgLevelTab('COMPANY');
    } else if (orgLevelTab === 'COMPANY' && row.companyCode && row.companyCode !== '—') {
      setCompanyFilter(row.companyCode);
      setRegionFilter('ALL');
      setAreaFilter('ALL');
      setMemberFilter('ALL');
      setOrgLevelTab(regions.length > 0 ? 'REGION' : 'AREA');
    } else if (orgLevelTab === 'REGION' && row.regionId) {
      if (row.companyCode && row.companyCode !== '—') setCompanyFilter(row.companyCode);
      setRegionFilter(row.regionId);
      setAreaFilter('ALL');
      setMemberFilter('ALL');
      setOrgLevelTab('AREA');
    } else if (orgLevelTab === 'AREA' && row.areaCode && row.areaCode !== '—') {
      if (row.companyCode && row.companyCode !== '—') setCompanyFilter(row.companyCode);
      setAreaFilter(row.areaCode);
      setMemberFilter('ALL');
      setOrgLevelTab('UNI');
    } else if (orgLevelTab === 'UNI') {
      if (row.companyCode && row.companyCode !== '—') setCompanyFilter(row.companyCode);
      if (row.areaCode && row.areaCode !== '—') setAreaFilter(row.areaCode);
      if (row.label && row.label !== 'Chưa gắn Uni') setSearchQuery(row.label);
      setViewTab('MEMBERS');
    }
  };

  // Nhật ký báo cáo theo từng ngày
  const sortedLogs = useMemo(() => {
    const memberById = new Map<string, Member>();
    rbacMembers.forEach((m) => memberById.set(m.id, m));

    return [...scopedReports]
      .sort((a, b) => {
        const dCmp = b.date.localeCompare(a.date);
        if (dCmp !== 0) return dCmp;
        return (
          computeDailyMetricsScore(b.results, weights) -
          computeDailyMetricsScore(a.results, weights)
        );
      })
      .map((rep) => {
        const mId = rep.memberId || `m-${rep.uid}`;
        const mem = memberById.get(mId);
        const comp = mem?.companyCode || rep.companyCode || '—';
        const area = mem?.areaCode || rep.areaCode || '—';
        const reg = canViewSionAndRegionLevel ? resolveRegionForArea(comp, area, regions) : null;
        return {
          report: rep,
          memberName: mem?.fullName || (rep.uid === currentUser?.id ? currentUser.fullName : mId),
          companyCode: comp,
          regionName: reg ? reg.name || reg.code : '',
          areaCode: area,
          unitCode: mem?.unitCode || rep.unitCode || mem?.departmentCode || '',
          score: computeDailyMetricsScore(rep.results, weights),
          memberRef: mem,
        };
      });
  }, [scopedReports, rbacMembers, weights, currentUser, canViewSionAndRegionLevel, regions]);

  const maxOrgScore = useMemo(
    () => Math.max(1, ...orgOverviewRows.map((u) => u.score)),
    [orgOverviewRows]
  );

  const hasActiveOrgFilter =
    clusterFilter !== 'ALL' ||
    companyFilter !== 'ALL' ||
    regionFilter !== 'ALL' ||
    areaFilter !== 'ALL' ||
    memberFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  const resetAllFilters = () => {
    setClusterFilter('ALL');
    setCompanyFilter('ALL');
    setRegionFilter('ALL');
    setAreaFilter('ALL');
    setMemberFilter('ALL');
    setSearchQuery('');
    setSubmissionFilter('ALL');
  };

  const canDownloadExcel = canExportExcel(currentUser?.role);

  const handleExportExcel = () => {
    if (!currentUser) return;
    if (!canExportExcel(currentUser.role)) {
      onShowNotification('Chỉ cấp TS, NQ (Cấp 4) trở lên mới được phép tải xuống Excel.');
      return;
    }
    try {
      const summary = exportDailyReportsByRbacExcel({
        viewer: currentUser,
        dailyReports,
        members,
        companies,
        clusters: effectiveClusters,
        regions,
        weights,
        period: periodMode,
        periodDate: selectedDate,
        periodMonth: selectedMonth,
        periodYear: selectedYear,
        filterClusterId: canViewClusterLevel ? clusterFilter : undefined,
        filterCompanyCode: isPersonalOnly ? undefined : companyFilter,
        filterRegionId: canViewSionAndRegionLevel ? regionFilter : undefined,
        filterAreaCode: isPersonalOnly ? undefined : areaFilter,
        filterMemberId: isPersonalOnly ? undefined : memberFilter,
      });
      onShowNotification(
        `Đã xuất ${summary.fileName} (${summary.reportsCount} báo cáo · ${summary.membersCount} nhân sự).`
      );
    } catch (err: any) {
      onShowNotification(err?.message || 'Không có quyền xuất Excel.');
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md mx-auto text-center border border-slate-200 dark:border-slate-800 my-10">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="font-bold text-lg text-slate-900 dark:text-white mb-1.5">
          Tổng quan Kết quả Báo cáo hằng ngày
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          Vui lòng đăng nhập để xem thống kê tổng hợp 7 chỉ số theo đúng phân quyền 7 cấp của bạn.
        </p>
        <button
          type="button"
          onClick={onOpenAuthModal}
          className="w-full py-2.5 min-h-[44px] bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  const roleMeta = ROLE_DISPLAY_META[currentUser.role] || ROLE_DISPLAY_META.MEMBER;
  const scopeText = getRbacScopeDescription(currentUser);
  const periodHumanLabel =
    periodMode === 'DAY'
      ? `Ngày ${formatDateVN(selectedDate)}`
      : periodMode === 'MONTH'
      ? `Tháng ${selectedMonth.split('-').reverse().join('/')}`
      : periodMode === 'YEAR'
      ? `Năm ${selectedYear}`
      : 'Toàn thời gian';

  const currentOrgLevelLabel =
    availableOrgLevels.find((l) => l.id === orgLevelTab)?.label || 'Đơn vị';

  return (
    <div className="space-y-4 pb-8">
      {/* HEADER & PRIMARY ACTIONS */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
              Tổng quan Kết quả Báo cáo hằng ngày
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Cấp {roleMeta.level} · {roleMeta.label}
              </span>
              <span aria-hidden="true">/</span>
              <span>Phạm vi: {scopeText}</span>
              <span aria-hidden="true">/</span>
              <span>
                Thang điểm: {activeEvent ? activeEvent.title : 'Điểm mặc định hệ thống'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onNavigateToEntry}
              className="px-3.5 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Nhập báo cáo</span>
            </button>

            {canDownloadExcel && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Xuất Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* FILTER TOOLBAR */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Period Segmented Tabs */}
            <div className="grid grid-cols-4 sm:inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700">
              {(
                [
                  { id: 'DAY', label: 'Ngày' },
                  { id: 'MONTH', label: 'Tháng' },
                  { id: 'YEAR', label: 'Năm' },
                  { id: 'ALL', label: 'Tất cả' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriodMode(tab.id)}
                  className={`px-3 min-h-[36px] rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                    periodMode === tab.id
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Period Navigation Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {periodMode === 'DAY' && (
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => shiftDateStr(d, -1))}
                    aria-label="Ngày trước"
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    aria-label="Chọn ngày xem tổng quan"
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => shiftDateStr(d, 1))}
                    aria-label="Ngày sau"
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {selectedDate !== todayStr && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className="h-9 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      Hôm nay
                    </button>
                  )}
                </div>
              )}

              {periodMode === 'MONTH' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((m) => shiftMonthStr(m, -1))}
                    aria-label="Tháng trước"
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-40">
                    <CustomSelect
                      size="sm"
                      searchable={false}
                      value={selectedMonth}
                      onChange={setSelectedMonth}
                      options={Array.from({ length: 12 }, (_, idx) => {
                        const yr = selectedMonth.split('-')[0] || String(new Date().getFullYear());
                        const mm = String(idx + 1).padStart(2, '0');
                        return { value: `${yr}-${mm}`, label: `Tháng ${mm}/${yr}` };
                      })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((m) => shiftMonthStr(m, 1))}
                    aria-label="Tháng sau"
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {periodMode === 'YEAR' && (
                <div className="w-36">
                  <CustomSelect
                    size="sm"
                    searchable={false}
                    value={selectedYear}
                    onChange={setSelectedYear}
                    options={['2024', '2025', '2026', '2027', '2028', '2029'].map((yr) => ({
                      value: yr,
                      label: `Năm ${yr}`,
                    }))}
                  />
                </div>
              )}

              {periodMode === 'ALL' && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 px-2">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Tổng hợp toàn bộ lịch sử báo cáo trong phạm vi</span>
                </div>
              )}
            </div>
          </div>

          {/* Scope Filter Row: Cụm -> Sion -> Địa vực -> Khu vực -> Cá nhân (strictly <= user role level) */}
          {!isPersonalOnly &&
            (() => {
              const scopeDropdownLabels = getRoleScopedDropdownLabels(currentUser, {
                selectedCompanyCode: companyFilter,
                companiesCount: selectableCompanies.length,
                singleCompanyCode: selectableCompanies[0]?.code,
                areasCount: selectableAreas.length,
                singleAreaCode: selectableAreas[0]?.code,
                membersCount: selectableMembers.length,
              });
              const activeDropdownCount =
                (showClusterSelector ? 1 : 0) +
                (showCompanySelector ? 1 : 0) +
                (showRegionSelector ? 1 : 0) +
                (showAreaSelector ? 1 : 0) +
                (showMemberSelector ? 1 : 0);

              return (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[210px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm tên thành viên, Cụm, Sion, Địa vực, KV, Uni..."
                        className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {hasActiveOrgFilter && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Đặt lại lọc</span>
                      </button>
                    )}
                  </div>

                  {activeDropdownCount > 0 && (
                    <div
                      className={`grid grid-cols-1 sm:grid-cols-2 ${
                        activeDropdownCount >= 5
                          ? 'lg:grid-cols-5'
                          : activeDropdownCount === 4
                          ? 'lg:grid-cols-4'
                          : activeDropdownCount === 3
                          ? 'lg:grid-cols-3'
                          : activeDropdownCount === 2
                          ? 'lg:grid-cols-2'
                          : 'lg:grid-cols-1'
                      } gap-2`}
                    >
                      {showClusterSelector && (
                        <CustomSelect
                          size="sm"
                          searchable={false}
                          value={clusterFilter}
                          onChange={(val) => {
                            setClusterFilter(val);
                            setCompanyFilter('ALL');
                            setRegionFilter('ALL');
                            setAreaFilter('ALL');
                            setMemberFilter('ALL');
                          }}
                          options={[
                            {
                              value: 'ALL',
                              label: isAdmin ? 'Tất cả Cụm Sion' : 'Cụm Sion phụ trách',
                            },
                            ...scopedClusterOptions.map(({ cluster }) => ({
                              value: cluster.id,
                              label: `Cụm ${cluster.name || cluster.code}`,
                            })),
                          ]}
                          ariaLabel="Chọn Cụm Sion lọc báo cáo"
                        />
                      )}

                      {showCompanySelector && (
                        <CustomSelect
                          size="sm"
                          searchable={false}
                          value={companyFilter}
                          onChange={(val) => {
                            setCompanyFilter(val);
                            setRegionFilter('ALL');
                            setAreaFilter('ALL');
                            setMemberFilter('ALL');
                          }}
                          options={[
                            { value: 'ALL', label: scopeDropdownLabels.allCompaniesLabel },
                            ...selectableCompanies.map((c) => ({ value: c.code, label: c.code })),
                          ]}
                          ariaLabel="Chọn Sion lọc báo cáo"
                        />
                      )}

                      {showRegionSelector && (
                        <CustomSelect
                          size="sm"
                          searchable={false}
                          value={regionFilter}
                          onChange={(val) => {
                            setRegionFilter(val);
                            setAreaFilter('ALL');
                            setMemberFilter('ALL');
                          }}
                          options={[
                            { value: 'ALL', label: 'Tất cả Địa vực' },
                            ...selectableRegions.map((r) => ({
                              value: r.id,
                              label: `${r.name || r.code} (${r.companyCode})`,
                            })),
                          ]}
                          ariaLabel="Chọn Địa vực lọc báo cáo"
                        />
                      )}

                      {showAreaSelector && (
                        <CustomSelect
                          size="sm"
                          searchable={false}
                          value={areaFilter}
                          onChange={(val) => {
                            setAreaFilter(val);
                            setMemberFilter('ALL');
                          }}
                          options={[
                            { value: 'ALL', label: scopeDropdownLabels.allAreasLabel },
                            ...selectableAreas.map((a) => ({ value: a.code, label: `KV ${a.code}` })),
                          ]}
                          ariaLabel="Chọn Khu vực lọc báo cáo"
                        />
                      )}

                      {showMemberSelector && (
                        <CustomSelect
                          size="sm"
                          searchable
                          value={memberFilter}
                          onChange={setMemberFilter}
                          options={[
                            {
                              value: 'ALL',
                              label: scopeDropdownLabels.allMembersLabel,
                            },
                            ...selectableMembers.map((m) => ({
                              value: m.id,
                              label: m.fullName,
                              badge: m.areaCode ? `KV ${m.areaCode}` : m.companyCode,
                            })),
                          ]}
                          ariaLabel="Chọn cá nhân lọc báo cáo"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      </section>

      {/* 4-COLUMN KPI SUMMARY STRIP */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tổng điểm quy đổi
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {overallTotals.totalScore.toLocaleString('vi-VN')} đ
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {scopedReports.length > 0
              ? `TB ${Math.round(overallTotals.totalScore / scopedReports.length).toLocaleString(
                  'vi-VN'
                )} đ / lượt nhập`
              : periodHumanLabel}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isPersonalOnly ? 'Số ngày đã báo cáo' : 'Lượt báo cáo hợp lệ'}
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {scopedReports.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {isPersonalOnly
              ? periodHumanLabel
              : `${overallTotals.activeReporters} / ${filteredMembers.length} nhân sự có dữ liệu`}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tổng thực hiện (7 chỉ số)
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {overallTotals.totalResultsSum.toLocaleString('vi-VN')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            MT: {overallTotals.totalGoalsSum.toLocaleString('vi-VN')} ({overallTotals.overallPct}%)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Chỉ số đạt cao nhất
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums truncate">
            {overallTotals.topMetric.label}: {overallTotals.topMetricVal.toLocaleString('vi-VN')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Trong kỳ {periodHumanLabel.toLowerCase()}
          </div>
        </div>
      </section>

      {/* KHỐI CỤM SION RÚT GỌN 1 HÀNG (Chỉ hiển thị cho Cấp 5 QL Cụm trở lên theo phân quyền) */}
      {canViewClusterLevel && clusterHighlightRows.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Nhanh theo Cụm Sion ({periodHumanLabel})
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {clusterFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setClusterFilter('ALL');
                    setCompanyFilter('ALL');
                    setRegionFilter('ALL');
                    setAreaFilter('ALL');
                    setMemberFilter('ALL');
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Tất cả Cụm
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setViewTab('UNITS');
                  setOrgLevelTab('CLUSTER');
                }}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Bảng chi tiết Cụm →
              </button>
            </div>
          </div>

          <div
            className={`grid gap-2 ${
              clusterHighlightRows.length <= 2
                ? 'grid-cols-2'
                : clusterHighlightRows.length === 3
                ? 'grid-cols-2 sm:grid-cols-3'
                : clusterHighlightRows.length === 4
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
            }`}
          >
            {clusterHighlightRows.map((cl) => {
              const isSelected = clusterFilter === cl.clusterId;
              const totalRes = sumAll7(cl.results);
              const totalGoal = sumAll7(cl.goals);

              return (
                <button
                  key={cl.key}
                  type="button"
                  onClick={() => {
                    const nextVal = isSelected ? 'ALL' : cl.clusterId || 'ALL';
                    setClusterFilter(nextVal);
                    setCompanyFilter('ALL');
                    setRegionFilter('ALL');
                    setAreaFilter('ALL');
                    setMemberFilter('ALL');
                  }}
                  className={`text-left px-3 py-2 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/35 border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-300 dark:ring-indigo-700'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      Cụm {cl.label}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 tabular-nums shrink-0">
                      {cl.score.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="mt-1 tabular-nums leading-tight">
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      KQ: {totalRes.toLocaleString('vi-VN')}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 mt-0.5">
                      <span>MT: {totalGoal.toLocaleString('vi-VN')}</span>
                      <span>
                        {cl.activeReporters}/{cl.totalMembers} NS
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 7 METRICS MATRIX (ALL 7 DETAILED INDICES) */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Chi tiết 7 chỉ số ({periodHumanLabel})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dòng lớn trên là Kết quả (KQ) · Dòng nhỏ phía dưới là Mục tiêu (MT)
            </p>
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            Tổng cộng: <strong className="text-slate-900 dark:text-white">KQ: {overallTotals.totalResultsSum.toLocaleString('vi-VN')}</strong> /{' '}
            MT: {overallTotals.totalGoalsSum.toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAILY_METRIC_DEFINITIONS.map((def) => {
            const val = overallTotals.results[def.key] || 0;
            const goal = overallTotals.goals[def.key] || 0;
            const pct =
              goal > 0 ? Math.min(100, Math.round((val / goal) * 100)) : val > 0 ? 100 : 0;
            const pts = val * (weights[def.key] || 0);
            const meta = METRIC_ICON_MAP[def.key];
            const Icon = meta.icon;

            return (
              <div
                key={def.key}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {def.label}
                  </span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.textCls}`} />
                </div>

                <div className="tabular-nums leading-tight">
                  <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    KQ: {val.toLocaleString('vi-VN')}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-between gap-1">
                    <span>MT: {goal.toLocaleString('vi-VN')}</span>
                    <span className="text-slate-400 dark:text-slate-500">+{pts.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.barCls} transition-all duration-200`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MAIN BREAKDOWN SECTION */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Toolbar inside Breakdown */}
        <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {!isPersonalOnly ? (
              <div className="grid grid-cols-3 sm:inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700">
                {(
                  [
                    { id: 'MEMBERS', label: `Thành viên (${filteredMembers.length})`, icon: Users },
                    { id: 'UNITS', label: `Tổ chức (${orgOverviewRows.length})`, icon: Building2 },
                    { id: 'LOGS', label: `Nhật ký (${sortedLogs.length})`, icon: ClipboardList },
                  ] as const
                ).map((t) => {
                  const TabIcon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setViewTab(t.id)}
                      className={`px-3 min-h-[36px] rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        viewTab === t.id
                          ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nhật ký Báo cáo cá nhân ({sortedLogs.length})
                </h3>
              </div>
            )}

            {!isPersonalOnly && viewTab === 'MEMBERS' && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 self-start sm:self-auto">
                {(
                  [
                    { id: 'ALL', label: `Tất cả (${memberOverviewRows.length})` },
                    { id: 'REPORTED', label: `Đã nhập (${reportedCount})` },
                    { id: 'MISSING', label: `Chưa nhập (${missingCount})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSubmissionFilter(f.id)}
                    className={`px-2.5 min-h-[32px] rounded-lg text-[11px] font-semibold transition whitespace-nowrap cursor-pointer ${
                      submissionFilter === f.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {!isPersonalOnly && viewTab === 'UNITS' && availableOrgLevels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 self-start sm:self-auto">
                {availableOrgLevels.map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setOrgLevelTab(lvl.id)}
                    className={`px-2.5 min-h-[32px] rounded-lg text-[11px] font-semibold transition whitespace-nowrap cursor-pointer ${
                      orgLevelTab === lvl.id
                        ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
            <span>Số lớn phía trên: Kết quả thực hiện · Số nhỏ phía dưới: Mục tiêu</span>
            {!isPersonalOnly && viewTab === 'UNITS' && (
              <span className="hidden sm:inline text-slate-400">
                Đang xem cấp {currentOrgLevelLabel} (bấm vào từng dòng để đi sâu hơn)
              </span>
            )}
          </div>
        </div>

        {/* VIEW 1: THEO THÀNH VIÊN (Supervisors Cấp 2-7) */}
        {!isPersonalOnly && viewTab === 'MEMBERS' && (
          <div>
            {displayedMemberRows.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Không có thành viên phù hợp bộ lọc hiện tại
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Thử đổi kỳ báo cáo hoặc xóa từ khóa tìm kiếm để xem toàn bộ phạm vi.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToEntry}
                    className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Nhập báo cáo ngay
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop High-Density Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <th className="py-2.5 pl-4 pr-2 w-9">#</th>
                        <th className="py-2.5 px-2.5">Thành viên</th>
                        <th className="py-2.5 px-2.5">Tổ chức</th>
                        <th className="py-2.5 px-2 text-right">Ngày</th>
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <th key={m.key} className="py-2.5 px-2.5 text-right min-w-[64px]">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 px-2.5 text-right">Tổng điểm</th>
                        <th className="py-2.5 pr-4 pl-2 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {displayedMemberRows.map((row, idx) => {
                        const cl = canViewClusterLevel
                          ? resolveClusterForCompany(
                              row.member.companyCode,
                              effectiveClusters,
                              companies
                            )
                          : null;
                        const reg = canViewSionAndRegionLevel
                          ? resolveRegionForArea(row.member.companyCode, row.member.areaCode, regions)
                          : null;
                        const orgText = [
                          cl ? `Cụm ${cl.code}` : '',
                          row.member.companyCode,
                          reg ? reg.name || reg.code : '',
                          row.member.areaCode ? `KV ${row.member.areaCode}` : '',
                          row.member.unitCode || row.member.departmentCode,
                        ]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <tr
                            key={row.member.id}
                            onClick={() => setInspectedMemberRow(row)}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 pl-4 pr-2 text-slate-400 font-mono tabular-nums whitespace-nowrap">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-2.5">
                              <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[165px]">
                                {row.member.fullName}
                              </div>
                            </td>
                            <td
                              className="py-2.5 px-2.5 text-slate-500 dark:text-slate-400 text-[11px]"
                              title={orgText}
                            >
                              <div className="truncate max-w-[155px]">{orgText}</div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  row.daysCount > 0
                                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                    : 'text-slate-400'
                                }
                              >
                                {row.daysCount}
                              </span>
                            </td>
                            {DAILY_METRIC_DEFINITIONS.map((m) => (
                              <td
                                key={m.key}
                                className="py-2 px-2.5 text-right font-mono whitespace-nowrap min-w-[64px]"
                              >
                                <MetricResultGoalCell
                                  result={row.results[m.key] || 0}
                                  goal={row.goals[m.key] || 0}
                                  compact
                                />
                              </td>
                            ))}
                            <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                              {row.score.toLocaleString('vi-VN')}
                            </td>
                            <td className="py-2.5 pr-4 pl-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectedMemberRow(row);
                                }}
                                aria-label={`Xem chi tiết ${row.member.fullName}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Xem</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Clean List View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedMemberRows.map((row, idx) => {
                    const reg = canViewSionAndRegionLevel
                      ? resolveRegionForArea(row.member.companyCode, row.member.areaCode, regions)
                      : null;
                    return (
                      <button
                        key={row.member.id}
                        type="button"
                        onClick={() => setInspectedMemberRow(row)}
                        className="w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {idx + 1}. {row.member.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {[
                                row.member.companyCode,
                                reg ? reg.name || reg.code : '',
                                row.member.areaCode ? `KV ${row.member.areaCode}` : '',
                                row.member.unitCode || row.member.departmentCode,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                              {row.score.toLocaleString('vi-VN')} đ
                            </div>
                            <div
                              className={`text-[11px] tabular-nums ${
                                row.daysCount > 0
                                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                  : 'text-slate-400'
                              }`}
                            >
                              {row.daysCount} ngày nhập
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                          {DAILY_METRIC_DEFINITIONS.map((m) => (
                            <div key={m.key}>
                              <div className="text-[10px] text-slate-400 truncate mb-0.5">
                                {m.key === 'wsNew' ? 'WS' : m.label}
                              </div>
                              <MetricResultGoalCell
                                result={row.results[m.key] || 0}
                                goal={row.goals[m.key] || 0}
                                compact
                                showMtPrefix={false}
                              />
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEW 2: THỐNG KÊ THEO CẤP TỔ CHỨC (Cụm Sion | Sion | Địa vực | Khu vực | Đội/Uni) */}
        {!isPersonalOnly && viewTab === 'UNITS' && (
          <div>
            {orgOverviewRows.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có dữ liệu {currentOrgLevelLabel.toLowerCase()} trong phạm vi đã chọn.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <th className="py-2.5 pl-4 pr-2 w-9">#</th>
                        <th className="py-2.5 px-2.5">{currentOrgLevelLabel}</th>
                        <th className="py-2.5 px-2 text-right">Đã nhập / NS</th>
                        <th className="py-2.5 px-2 text-right">Lượt BC</th>
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <th key={m.key} className="py-2.5 px-2.5 text-right min-w-[64px]">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 pr-4 pl-2.5 text-right">Tổng KQ / Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {orgOverviewRows.map((u, idx) => {
                        const pctBar = Math.round((u.score / maxOrgScore) * 100);
                        const totalRes = sumAll7(u.results);
                        const totalGoal = sumAll7(u.goals);
                        return (
                          <tr
                            key={u.key}
                            onClick={() => handleDrillDownOrgRow(u)}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 pl-4 pr-2 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-2.5">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {orgLevelTab === 'REGION' && (
                                  <MapPinned className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                )}
                                <span className="truncate max-w-[180px]">{u.label}</span>
                              </div>
                              {u.subLabel && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                  {u.subLabel}
                                </div>
                              )}
                              <div className="w-32 h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                                  style={{ width: `${pctBar}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {u.activeReporters} / {u.totalMembers}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {u.reportsCount}
                            </td>
                            {DAILY_METRIC_DEFINITIONS.map((m) => (
                              <td
                                key={m.key}
                                className="py-2 px-2.5 text-right font-mono whitespace-nowrap min-w-[64px]"
                              >
                                <MetricResultGoalCell
                                  result={u.results[m.key] || 0}
                                  goal={u.goals[m.key] || 0}
                                  compact
                                />
                              </td>
                            ))}
                            <td className="py-2.5 pr-4 pl-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {u.score.toLocaleString('vi-VN')} đ
                              </div>
                              <div className="text-[10px] text-slate-400">
                                KQ {totalRes.toLocaleString('vi-VN')} / MT{' '}
                                {totalGoal.toLocaleString('vi-VN')}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {orgOverviewRows.map((u, idx) => (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => handleDrillDownOrgRow(u)}
                      className="w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {idx + 1}. {u.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums truncate">
                            {[
                              u.subLabel,
                              `${u.activeReporters}/${u.totalMembers} nhân sự`,
                              `${u.reportsCount} lượt BC`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                          {u.score.toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <div key={m.key}>
                            <div className="text-[10px] text-slate-400 mb-0.5">
                              {m.key === 'wsNew' ? 'WS' : m.label}
                            </div>
                            <MetricResultGoalCell
                              result={u.results[m.key] || 0}
                              goal={u.goals[m.key] || 0}
                              compact
                              showMtPrefix={false}
                            />
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEW 3: NHẬT KÝ THEO NGÀY (Supervisors tab 'LOGS' OR Personal Cấp 1) */}
        {(isPersonalOnly || viewTab === 'LOGS') && (
          <div>
            {sortedLogs.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Chưa có báo cáo hằng ngày trong kỳ {periodHumanLabel.toLowerCase()}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isPersonalOnly
                    ? 'Hãy ghi nhận kết quả hoạt động hôm nay để xem thống kê tổng hợp.'
                    : 'Các phiếu báo cáo đã lưu trong phạm vi phân quyền sẽ hiển thị ngay tại đây.'}
                </p>
                <button
                  type="button"
                  onClick={onNavigateToEntry}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Nhập báo cáo hằng ngày
                </button>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <th className="py-2.5 pl-4 pr-2.5">Ngày</th>
                        {!isPersonalOnly && <th className="py-2.5 px-2.5">Thành viên</th>}
                        {!isPersonalOnly && <th className="py-2.5 px-2.5">Đơn vị</th>}
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <th key={m.key} className="py-2.5 px-2.5 text-right min-w-[64px]">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 pr-4 pl-2.5 text-right">Điểm ngày</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {sortedLogs.slice(0, visibleLogsLimit).map((item) => {
                        const unitStr = [
                          item.companyCode,
                          item.regionName,
                          item.areaCode !== '—' ? `KV ${item.areaCode}` : '',
                          item.unitCode,
                        ]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <tr
                            key={item.report.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2.5 pl-4 pr-2.5 font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                              {formatDateVN(item.report.date)}
                            </td>
                            {!isPersonalOnly && (
                              <td className="py-2.5 px-2.5 font-semibold text-slate-900 dark:text-white truncate max-w-[165px]">
                                {item.memberName}
                              </td>
                            )}
                            {!isPersonalOnly && (
                              <td
                                className="py-2.5 px-2.5 text-slate-500 dark:text-slate-400 text-[11px]"
                                title={unitStr}
                              >
                                <div className="truncate max-w-[155px]">{unitStr}</div>
                              </td>
                            )}
                            {DAILY_METRIC_DEFINITIONS.map((m) => (
                              <td
                                key={m.key}
                                className="py-2 px-2.5 text-right font-mono whitespace-nowrap min-w-[64px]"
                              >
                                <MetricResultGoalCell
                                  result={item.report.results?.[m.key] || 0}
                                  goal={item.report.goals?.[m.key] || 0}
                                  compact
                                />
                              </td>
                            ))}
                            <td className="py-2.5 pr-4 pl-2.5 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                              {item.score.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Daily Log Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedLogs.slice(0, visibleLogsLimit).map((item) => (
                    <div key={item.report.id} className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                            {formatDateVN(item.report.date)}
                          </div>
                          {!isPersonalOnly && (
                            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                              {item.memberName} ·{' '}
                              <span className="font-normal text-xs text-slate-500 dark:text-slate-400">
                                {[item.companyCode, item.regionName, `KV ${item.areaCode}`]
                                  .filter(Boolean)
                                  .join(' / ')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                          {item.score.toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <div key={m.key}>
                            <div className="text-[10px] text-slate-400 mb-0.5">
                              {m.key === 'wsNew' ? 'WS' : m.label}
                            </div>
                            <MetricResultGoalCell
                              result={item.report.results?.[m.key] || 0}
                              goal={item.report.goals?.[m.key] || 0}
                              compact
                              showMtPrefix={false}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {sortedLogs.length > visibleLogsLimit && (
                  <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleLogsLimit((prev) => prev + 30)}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Xem thêm ({sortedLogs.length - visibleLogsLimit} bản ghi)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* MEMBER DETAIL MODAL (Cấp 2-7) */}
      {inspectedMemberRow && (
        <div
          onClick={() => setInspectedMemberRow(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in cursor-pointer"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl cursor-default"
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {inspectedMemberRow.member.fullName}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {[
                    inspectedMemberRow.member.companyCode,
                    inspectedMemberRow.member.areaCode
                      ? `KV ${inspectedMemberRow.member.areaCode}`
                      : '',
                    inspectedMemberRow.member.unitCode || inspectedMemberRow.member.departmentCode,
                    periodHumanLabel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedMemberRow(null)}
                aria-label="Đóng chi tiết"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-5">
              {/* Summary Strip inside Modal */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Tổng điểm</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {inspectedMemberRow.score.toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Ngày đã nhập</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {inspectedMemberRow.daysCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Tổng 7 chỉ số</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {sumAll7(inspectedMemberRow.results).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              {/* 7-Metric Table for this member */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="py-2 px-3">Chỉ số</th>
                      <th className="py-2 px-3 text-right">Kết quả</th>
                      <th className="py-2 px-3 text-right">Mục tiêu</th>
                      <th className="py-2 px-3 text-right">Tỉ lệ</th>
                      <th className="py-2 px-3 text-right">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {DAILY_METRIC_DEFINITIONS.map((m) => {
                      const val = inspectedMemberRow.results[m.key] || 0;
                      const goal = inspectedMemberRow.goals[m.key] || 0;
                      const pct =
                        goal > 0 ? Math.round((val / goal) * 100) : val > 0 ? 100 : 0;
                      const pts = val * (weights[m.key] || 0);
                      return (
                        <tr key={m.key}>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                            {m.label}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {val}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500 tabular-nums">
                            {goal}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                            {pct}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                            {pts.toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Member's Daily Logs in Period */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Lịch sử ngày nhập trong kỳ ({inspectedMemberRow.reports.length})
                </h4>
                {inspectedMemberRow.reports.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                    Chưa có báo cáo nào được ghi nhận trong kỳ này.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {inspectedMemberRow.reports.map((rep) => {
                      const dayPts = computeDailyMetricsScore(rep.results, weights);
                      return (
                        <div key={rep.id} className="p-2.5 sm:px-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                              {formatDateVN(rep.date)}
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                              {dayPts.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                          <div className="grid grid-cols-7 gap-1 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-center">
                            {DAILY_METRIC_DEFINITIONS.map((m) => (
                              <div key={m.key}>
                                <div className="text-[10px] text-slate-400">
                                  {m.key === 'wsNew' ? 'WS' : m.label}
                                </div>
                                <MetricResultGoalCell
                                  result={rep.results?.[m.key] || 0}
                                  goal={rep.goals?.[m.key] || 0}
                                  compact
                                  showMtPrefix={false}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
