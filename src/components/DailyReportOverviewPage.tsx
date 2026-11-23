import React, { useMemo, useState } from 'react';
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
  ROLE_DISPLAY_META,
  UserAccount,
} from '../types/edulms';
import {
  canAccessMemberReportOverview,
  getMemberUnitCode,
  getRbacScopeDescription,
  isAdminRole,
  normalizeOrgCode,
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
  dailyReports: DailyReportRecord[];
  activeEvent: FestivalEvent | null;
  defaultWeights?: DailyReportMetrics;
  onNavigateToEntry: () => void;
  onOpenAuthModal: () => void;
  onShowNotification: (msg: string) => void;
}

type OverviewViewTab = 'MEMBERS' | 'UNITS' | 'LOGS';
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

interface UnitOverviewRow {
  key: string;
  label: string;
  subLabel: string;
  totalMembers: number;
  activeReporters: number;
  reportsCount: number;
  results: DailyReportMetrics;
  score: number;
}

export const DailyReportOverviewPage: React.FC<DailyReportOverviewPageProps> = ({
  currentUser,
  members,
  companies,
  areas,
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

  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewTab, setViewTab] = useState<OverviewViewTab>('MEMBERS');
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('ALL');
  const [visibleLogsLimit, setVisibleLogsLimit] = useState<number>(30);
  const [inspectedMemberRow, setInspectedMemberRow] = useState<MemberOverviewRow | null>(null);

  const weights = useMemo(
    () => activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS,
    [activeEvent?.weights, defaultWeights]
  );

  const isAdmin = isAdminRole(currentUser?.role);
  const isPersonalOnly = currentUser?.role === 'MEMBER';

  // Tất cả thành viên trong phạm vi phân quyền của viewer (chưa lọc search/org dropdown)
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

  // Danh sách Sion & KV hợp lệ theo phân quyền để hiển thị bộ lọc
  const selectableCompanies = useMemo(() => {
    if (!currentUser || isPersonalOnly) return [];
    if (isAdmin) return companies;

    const allowedCodes = new Set<string>();
    rbacMembers.forEach((m) => {
      const c = normalizeOrgCode(m.companyCode);
      if (c) allowedCodes.add(c);
    });
    (currentUser.managedCompanyCodes || []).forEach((c) => {
      const nc = normalizeOrgCode(c);
      if (nc) allowedCodes.add(nc);
    });
    if (currentUser.companyCode) allowedCodes.add(normalizeOrgCode(currentUser.companyCode));

    return companies.filter((c) => allowedCodes.has(normalizeOrgCode(c.code)));
  }, [currentUser, isPersonalOnly, isAdmin, companies, rbacMembers]);

  const selectableAreas = useMemo(() => {
    if (!currentUser || isPersonalOnly) return [];
    const source = isAdmin
      ? areas
      : areas.filter((a) => {
          const aComp = normalizeOrgCode(a.companyCode);
          const aCode = normalizeOrgCode(a.code);
          if (currentUser.role === 'MANAGER' || currentUser.role === 'SION_LEADER') {
            const comps = new Set(
              (currentUser.managedCompanyCodes?.length
                ? currentUser.managedCompanyCodes
                : [currentUser.companyCode]
              ).map(normalizeOrgCode)
            );
            const mgrAreas = new Set(
              (currentUser.managedAreaCodes || []).map(normalizeOrgCode)
            );
            return comps.has(aComp) || (currentUser.role === 'MANAGER' && mgrAreas.has(aCode));
          }
          if (currentUser.role === 'AREA_LEADER') {
            const areaSet = new Set(
              (currentUser.managedAreaCodes?.length
                ? currentUser.managedAreaCodes
                : [currentUser.areaCode]
              ).map(normalizeOrgCode)
            );
            return areaSet.has(aCode);
          }
          return aCode === normalizeOrgCode(currentUser.areaCode);
        });

    return source.filter(
      (a) =>
        companyFilter === 'ALL' || normalizeOrgCode(a.companyCode) === normalizeOrgCode(companyFilter)
    );
  }, [currentUser, isPersonalOnly, isAdmin, areas, companyFilter]);

  const showCompanySelector = !isPersonalOnly && (isAdmin || currentUser?.role === 'MANAGER' || selectableCompanies.length > 1);
  const showAreaSelector = !isPersonalOnly && (isAdmin || currentUser?.role === 'MANAGER' || currentUser?.role === 'SION_LEADER' || selectableAreas.length > 1);

  // Thành viên sau khi lọc bộ lọc Sion / Khu vực / Tìm kiếm
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rbacMembers.filter((m) => {
      if (
        companyFilter !== 'ALL' &&
        normalizeOrgCode(m.companyCode) !== normalizeOrgCode(companyFilter)
      ) {
        return false;
      }
      if (areaFilter !== 'ALL' && normalizeOrgCode(m.areaCode) !== normalizeOrgCode(areaFilter)) {
        return false;
      }
      if (q) {
        const hay = [
          m.fullName,
          m.code,
          m.companyCode,
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
  }, [rbacMembers, companyFilter, areaFilter, searchQuery]);

  const filteredMemberIds = useMemo(
    () => new Set(filteredMembers.map((m) => m.id)),
    [filteredMembers]
  );

  // Báo cáo trong kỳ + đúng phạm vi + bộ lọc hiện tại
  const scopedReports = useMemo(() => {
    if (!currentUser) return [];
    const ownMemberId = currentUser.memberId || `m-${currentUser.id}`;

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
      return filteredMemberIds.has(mId);
    });
  }, [
    currentUser,
    dailyReports,
    periodMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    isPersonalOnly,
    filteredMemberIds,
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

  // Tổng hợp theo Đơn vị (Sion/KV hoặc Đội/Uni nếu là AREA_LEADER / UNI_LEADER / đang lọc 1 KV)
  const unitOverviewRows = useMemo<UnitOverviewRow[]>(() => {
    const groupByUni =
      currentUser?.role === 'AREA_LEADER' ||
      currentUser?.role === 'UNI_LEADER' ||
      areaFilter !== 'ALL';

    const map = new Map<
      string,
      {
        label: string;
        subLabel: string;
        totalMembers: number;
        activeReporters: number;
        reports: DailyReportRecord[];
      }
    >();

    memberOverviewRows.forEach((row) => {
      const comp = row.member.companyCode || '—';
      const area = row.member.areaCode || '—';
      const unit = getMemberUnitCode(row.member) || row.member.unitCode || row.member.departmentCode || 'Chưa gắn Uni';
      const key = groupByUni ? `${comp}__${area}__${unit}` : `${comp}__${area}`;
      const label = groupByUni ? `${unit}` : `KV ${area}`;
      const subLabel = groupByUni ? `${comp} · KV ${area}` : `Sion ${comp}`;

      const cur = map.get(key) || {
        label,
        subLabel,
        totalMembers: 0,
        activeReporters: 0,
        reports: [],
      };
      cur.totalMembers += 1;
      if (row.daysCount > 0) cur.activeReporters += 1;
      cur.reports.push(...row.reports);
      map.set(key, cur);
    });

    return Array.from(map.entries())
      .map(([key, g]) => {
        const results = sumDailyReportMetrics(g.reports);
        const score = computeDailyMetricsScore(results, weights);
        return {
          key,
          label: g.label,
          subLabel: g.subLabel,
          totalMembers: g.totalMembers,
          activeReporters: g.activeReporters,
          reportsCount: g.reports.length,
          results,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || b.reportsCount - a.reportsCount);
  }, [memberOverviewRows, currentUser?.role, areaFilter, weights]);

  // Nhật ký báo cáo theo từng ngày
  const sortedLogs = useMemo(() => {
    const memberById = new Map<string, Member>();
    rbacMembers.forEach((m) => memberById.set(m.id, m));

    return [...scopedReports]
      .sort((a, b) => {
        const dCmp = b.date.localeCompare(a.date);
        if (dCmp !== 0) return dCmp;
        return computeDailyMetricsScore(b.results, weights) - computeDailyMetricsScore(a.results, weights);
      })
      .map((rep) => {
        const mId = rep.memberId || `m-${rep.uid}`;
        const mem = memberById.get(mId);
        return {
          report: rep,
          memberName: mem?.fullName || (rep.uid === currentUser?.id ? currentUser.fullName : mId),
          companyCode: mem?.companyCode || rep.companyCode || '—',
          areaCode: mem?.areaCode || rep.areaCode || '—',
          unitCode: mem?.unitCode || rep.unitCode || mem?.departmentCode || '',
          score: computeDailyMetricsScore(rep.results, weights),
          memberRef: mem,
        };
      });
  }, [scopedReports, rbacMembers, weights, currentUser]);

  const maxUnitScore = useMemo(
    () => Math.max(1, ...unitOverviewRows.map((u) => u.score)),
    [unitOverviewRows]
  );

  const handleExportExcel = () => {
    if (!currentUser) return;
    const summary = exportDailyReportsByRbacExcel({
      viewer: currentUser,
      dailyReports,
      members,
      weights,
      period: periodMode,
      periodDate: selectedDate,
      periodMonth: selectedMonth,
      periodYear: selectedYear,
      filterCompanyCode: isPersonalOnly ? undefined : companyFilter,
      filterAreaCode: isPersonalOnly ? undefined : areaFilter,
    });
    onShowNotification(
      `Đã xuất ${summary.fileName} (${summary.reportsCount} báo cáo · ${summary.membersCount} nhân sự).`
    );
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

  return (
    <div className="space-y-4 pb-8">
      {/* HEADER & PRIMARY ACTIONS (Single clean elevation) */}
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

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>
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

          {/* Scope Filter Row (only for Cấp 2-7) */}
          {!isPersonalOnly && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div
                className={`relative ${
                  showCompanySelector && showAreaSelector
                    ? 'sm:col-span-6'
                    : showCompanySelector || showAreaSelector
                    ? 'sm:col-span-8'
                    : 'sm:col-span-12'
                }`}
              >
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên thành viên, mã TV, Đội/Uni, khu vực..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {showCompanySelector && (
                <div className="sm:col-span-3">
                  <CustomSelect
                    size="sm"
                    searchable={false}
                    value={companyFilter}
                    onChange={(val) => {
                      setCompanyFilter(val);
                      setAreaFilter('ALL');
                    }}
                    options={[
                      { value: 'ALL', label: isAdmin ? 'Tất cả Sion' : 'Tất cả Sion (phạm vi)' },
                      ...selectableCompanies.map((c) => ({ value: c.code, label: c.name })),
                    ]}
                  />
                </div>
              )}

              {showAreaSelector && (
                <div className={showCompanySelector ? 'sm:col-span-3' : 'sm:col-span-4'}>
                  <CustomSelect
                    size="sm"
                    searchable={false}
                    value={areaFilter}
                    onChange={setAreaFilter}
                    options={[
                      { value: 'ALL', label: isAdmin ? 'Tất cả Khu vực' : 'Tất cả KV (phạm vi)' },
                      ...selectableAreas.map((a) => ({ value: a.code, label: `KV ${a.code}` })),
                    ]}
                  />
                </div>
              )}
            </div>
          )}
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
              ? `TB ${Math.round(overallTotals.totalScore / scopedReports.length).toLocaleString('vi-VN')} đ / lượt nhập`
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
            Mục tiêu ghi nhận: {overallTotals.totalGoalsSum.toLocaleString('vi-VN')} ({overallTotals.overallPct}%)
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

      {/* 7 METRICS MATRIX (ALL 7 DETAILED INDICES) */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Chi tiết 7 chỉ số ({periodHumanLabel})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đối chiếu Kết quả thực hiện và Mục tiêu đã đặt theo từng hạng mục
            </p>
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            Tổng cộng: {overallTotals.totalResultsSum.toLocaleString('vi-VN')} kết quả /{' '}
            {overallTotals.totalGoalsSum.toLocaleString('vi-VN')} mục tiêu
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAILY_METRIC_DEFINITIONS.map((def) => {
            const val = overallTotals.results[def.key] || 0;
            const goal = overallTotals.goals[def.key] || 0;
            const pct = goal > 0 ? Math.min(100, Math.round((val / goal) * 100)) : val > 0 ? 100 : 0;
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

                <div>
                  <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {val.toLocaleString('vi-VN')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    MT: {goal.toLocaleString('vi-VN')} · +{pts.toLocaleString('vi-VN')} đ
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
        <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {!isPersonalOnly ? (
            <div className="grid grid-cols-3 sm:inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700">
              {(
                [
                  { id: 'MEMBERS', label: `Thành viên (${filteredMembers.length})`, icon: Users },
                  { id: 'UNITS', label: `Đơn vị (${unitOverviewRows.length})`, icon: Building2 },
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
                    onClick={() => {
                      setCompanyFilter('ALL');
                      setAreaFilter('ALL');
                      setSearchQuery('');
                      setSubmissionFilter('ALL');
                    }}
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
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 pl-5 pr-2 w-10">#</th>
                        <th className="py-2.5 px-3">Thành viên</th>
                        <th className="py-2.5 px-3">Sion · KV · Uni</th>
                        <th className="py-2.5 px-2 text-right">Ngày</th>
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <th key={m.key} className="py-2.5 px-2 text-right">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right">Tổng điểm</th>
                        <th className="py-2.5 pr-5 pl-2 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {displayedMemberRows.map((row, idx) => (
                        <tr
                          key={row.member.id}
                          onClick={() => setInspectedMemberRow(row)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 pl-5 pr-2 text-slate-400 font-mono tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[190px]">
                              {row.member.fullName}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {[
                              row.member.companyCode,
                              row.member.areaCode ? `KV ${row.member.areaCode}` : '',
                              row.member.unitCode || row.member.departmentCode,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums">
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
                          {DAILY_METRIC_DEFINITIONS.map((m) => {
                            const val = row.results[m.key] || 0;
                            return (
                              <td
                                key={m.key}
                                className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                                  val > 0
                                    ? 'text-slate-900 dark:text-slate-100 font-semibold'
                                    : 'text-slate-400 dark:text-slate-600'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {row.score.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 pr-5 pl-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedMemberRow(row);
                              }}
                              aria-label={`Xem chi tiết ${row.member.fullName}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Clean List View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedMemberRows.map((row, idx) => (
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
                            <div className="text-[10px] text-slate-400 truncate">
                              {m.key === 'wsNew' ? 'WS' : m.label}
                            </div>
                            <div
                              className={`text-xs font-semibold tabular-nums ${
                                (row.results[m.key] || 0) > 0
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-400 dark:text-slate-600'
                              }`}
                            >
                              {row.results[m.key] || 0}
                            </div>
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

        {/* VIEW 2: THEO ĐƠN VỊ / KHU VỰC (Supervisors Cấp 2-7) */}
        {!isPersonalOnly && viewTab === 'UNITS' && (
          <div>
            {unitOverviewRows.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có dữ liệu đơn vị trong phạm vi đã chọn.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 pl-5 pr-2 w-10">#</th>
                        <th className="py-2.5 px-3">Đơn vị / Khu vực</th>
                        <th className="py-2.5 px-2 text-right">Đã nhập / Tổng NS</th>
                        <th className="py-2.5 px-2 text-right">Lượt BC</th>
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <th key={m.key} className="py-2.5 px-2 text-right">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 pr-5 pl-3 text-right">Tổng điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {unitOverviewRows.map((u, idx) => {
                        const pctBar = Math.round((u.score / maxUnitScore) * 100);
                        return (
                          <tr
                            key={u.key}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 pl-5 pr-2 font-mono text-slate-400 tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {u.label}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {u.subLabel}
                              </div>
                              <div className="w-36 h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                                  style={{ width: `${pctBar}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                              {u.activeReporters} / {u.totalMembers}
                            </td>
                            <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                              {u.reportsCount}
                            </td>
                            {DAILY_METRIC_DEFINITIONS.map((m) => (
                              <td
                                key={m.key}
                                className={`py-3 px-2 text-right font-mono tabular-nums ${
                                  (u.results[m.key] || 0) > 0
                                    ? 'text-slate-900 dark:text-slate-100 font-semibold'
                                    : 'text-slate-400 dark:text-slate-600'
                                }`}
                              >
                                {u.results[m.key] || 0}
                              </td>
                            ))}
                            <td className="py-3 pr-5 pl-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                              {u.score.toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {unitOverviewRows.map((u, idx) => (
                    <div key={u.key} className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {idx + 1}. {u.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {u.subLabel} · {u.activeReporters}/{u.totalMembers} nhân sự · {u.reportsCount} lượt BC
                          </div>
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                          {u.score.toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <div key={m.key}>
                            <div className="text-[10px] text-slate-400">
                              {m.key === 'wsNew' ? 'WS' : m.label}
                            </div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                              {u.results[m.key] || 0}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 pl-5 pr-3">Ngày</th>
                        {!isPersonalOnly && <th className="py-2.5 px-3">Thành viên</th>}
                        {!isPersonalOnly && <th className="py-2.5 px-3">Đơn vị</th>}
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <th key={m.key} className="py-2.5 px-2 text-right">
                            {m.label}
                          </th>
                        ))}
                        <th className="py-2.5 pr-5 pl-3 text-right">Điểm ngày</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {sortedLogs.slice(0, visibleLogsLimit).map((item) => (
                        <tr
                          key={item.report.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2.5 pl-5 pr-3 font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                            {formatDateVN(item.report.date)}
                          </td>
                          {!isPersonalOnly && (
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                              {item.memberName}
                            </td>
                          )}
                          {!isPersonalOnly && (
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {[
                                item.companyCode,
                                item.areaCode !== '—' ? `KV ${item.areaCode}` : '',
                                item.unitCode,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </td>
                          )}
                          {DAILY_METRIC_DEFINITIONS.map((m) => {
                            const res = item.report.results?.[m.key] || 0;
                            const goal = item.report.goals?.[m.key] || 0;
                            return (
                              <td
                                key={m.key}
                                className="py-2.5 px-2 text-right font-mono tabular-nums"
                              >
                                <span
                                  className={
                                    res > 0
                                      ? 'font-semibold text-slate-900 dark:text-white'
                                      : 'text-slate-400 dark:text-slate-600'
                                  }
                                >
                                  {res}
                                </span>
                                {goal > 0 && (
                                  <span className="text-[10px] text-slate-400 ml-0.5">/{goal}</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 pr-5 pl-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {item.score.toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
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
                                {item.companyCode} / KV {item.areaCode}
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
                            <div className="text-[10px] text-slate-400">
                              {m.key === 'wsNew' ? 'WS' : m.label}
                            </div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                              {item.report.results?.[m.key] || 0}
                            </div>
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
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {DAILY_METRIC_DEFINITIONS.map((m) => (
                              <span key={m.key}>
                                {m.label}:{' '}
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {rep.results?.[m.key] || 0}
                                </strong>
                              </span>
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
