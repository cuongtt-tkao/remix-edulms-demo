import * as XLSX from 'xlsx';
import {
  Member,
  Company,
  OrgCluster,
  Region,
  CompanyRankItem,
  AreaRankItem,
  UserAccount,
  DailyReportRecord,
  DailyReportMetrics,
  DAILY_METRIC_DEFINITIONS,
  EMPTY_DAILY_METRICS,
  ROLE_DISPLAY_META,
  canExportExcel,
  getRoleLevel,
} from '../types/edulms';
import { computeDailyMetricsScore, sumDailyReportMetrics } from './scoringEngine';
import {
  canAccessMemberReportOverview,
  cleanRawAreaCode,
  getEffectiveOrgClusters,
  getScopedClusterOptions,
  isAdminRole,
  normalizeOrgCode,
  resolveClusterForCompany,
  resolveRegionForArea,
} from './rbac';

export type DailyReportExportPeriod = 'DAY' | 'MONTH' | 'YEAR' | 'ALL';

export interface DailyReportExportOptions {
  viewer: UserAccount;
  dailyReports: DailyReportRecord[];
  members: Member[];
  companies?: Company[];
  clusters?: OrgCluster[];
  regions?: Region[];
  weights: DailyReportMetrics;
  period: DailyReportExportPeriod;
  periodDate?: string; // YYYY-MM-DD
  periodMonth?: string; // YYYY-MM
  periodYear?: string; // YYYY
  filterClusterId?: string;
  filterCompanyCode?: string;
  filterRegionId?: string;
  filterAreaCode?: string;
  filterMemberId?: string;
}

export interface DailyReportExportSummary {
  reportsCount: number;
  membersCount: number;
  fileName: string;
}

function matchesPeriod(rep: DailyReportRecord, opts: DailyReportExportOptions): boolean {
  if (opts.period === 'DAY' && opts.periodDate) {
    return rep.date === opts.periodDate;
  }
  if (opts.period === 'MONTH' && opts.periodMonth) {
    return rep.month === opts.periodMonth || rep.date.startsWith(opts.periodMonth);
  }
  if (opts.period === 'YEAR' && opts.periodYear) {
    return rep.year === opts.periodYear || rep.date.startsWith(opts.periodYear);
  }
  return true;
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

function sumAllMetrics(m: DailyReportMetrics): number {
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

function buildResultGoalColumns(
  results: DailyReportMetrics,
  goals: DailyReportMetrics
): Record<string, number> {
  const cols: Record<string, number> = {};
  DAILY_METRIC_DEFINITIONS.forEach((m) => {
    cols[`KQ ${m.label}`] = results[m.key] || 0;
    cols[`MT ${m.label}`] = goals[m.key] || 0;
  });
  return cols;
}

/**
 * Xuất Excel Báo cáo hằng ngày với đầy đủ 7 chỉ số (Kết quả & Mục tiêu),
 * phân cấp Cụm Sion - Sion - Địa vực - Khu vực tuân thủ chặt chẽ phân quyền 7 cấp.
 * Chỉ cấp TS, NQ (Cấp 4) trở lên được phép xuất Excel.
 */
export function exportDailyReportsByRbacExcel(
  opts: DailyReportExportOptions
): DailyReportExportSummary {
  const {
    viewer,
    dailyReports,
    members,
    companies = [],
    clusters = [],
    regions = [],
    weights,
  } = opts;
  if (!viewer || !canExportExcel(viewer.role)) {
    throw new Error('Chỉ tài khoản từ cấp TS, NQ (Cấp 4) trở lên mới được phép tải xuống Excel.');
  }

  const viewerLevel = getRoleLevel(viewer.role);
  const canViewClusterLevel = viewerLevel >= 5;
  const canViewSionAndRegionLevel = viewerLevel >= 4;

  const effectiveClusters = getEffectiveOrgClusters(clusters, companies);
  const scopedClusterOpts = getScopedClusterOptions(viewer, effectiveClusters, companies, members);

  const selectedClusterOpt =
    canViewClusterLevel && opts.filterClusterId && opts.filterClusterId !== 'ALL'
      ? scopedClusterOpts.find(
          (c) =>
            c.cluster.id === opts.filterClusterId ||
            normalizeOrgCode(c.cluster.code) === normalizeOrgCode(opts.filterClusterId)
        ) || null
      : null;

  const allowedClusterCompanySet = selectedClusterOpt
    ? new Set(selectedClusterOpt.companyCodes.map((c) => normalizeOrgCode(c)))
    : null;

  const selectedRegion =
    canViewSionAndRegionLevel && opts.filterRegionId && opts.filterRegionId !== 'ALL'
      ? regions.find((r) => r.id === opts.filterRegionId) || null
      : null;

  const selectedRegionAreaSet = selectedRegion
    ? new Set((selectedRegion.areaCodes || []).map((a) => normalizeOrgCode(cleanRawAreaCode(a))))
    : null;

  const wb = XLSX.utils.book_new();
  const memberById = new Map<string, Member>();
  members.forEach((m) => memberById.set(m.id, m));

  const periodReports = dailyReports.filter((r) => matchesPeriod(r, opts));
  const ownMemberId = viewer.memberId || `m-${viewer.id}`;

  const periodSuffix =
    opts.period === 'DAY'
      ? opts.periodDate || 'Ngay'
      : opts.period === 'MONTH'
      ? opts.periodMonth || 'Thang'
      : opts.period === 'YEAR'
      ? opts.periodYear || 'Nam'
      : 'Tat_ca';

  const roleMeta = ROLE_DISPLAY_META[viewer.role] || ROLE_DISPLAY_META.MEMBER;

  const isMatchedOrgFilter = (companyCode?: string, areaCode?: string): boolean => {
    const normComp = normalizeOrgCode(companyCode);
    const normArea = normalizeOrgCode(cleanRawAreaCode(areaCode));

    if (allowedClusterCompanySet) {
      if (selectedClusterOpt?.cluster.isCatchAll) {
        const resolved = resolveClusterForCompany(companyCode, effectiveClusters, companies);
        if (resolved?.id !== selectedClusterOpt.cluster.id) return false;
      } else if (!allowedClusterCompanySet.has(normComp)) {
        return false;
      }
    }

    if (opts.filterCompanyCode && opts.filterCompanyCode !== 'ALL') {
      if (normComp !== normalizeOrgCode(opts.filterCompanyCode)) return false;
    }

    if (selectedRegion) {
      if (normComp !== normalizeOrgCode(selectedRegion.companyCode)) return false;
      if (!selectedRegionAreaSet?.has(normArea)) return false;
    }

    if (opts.filterAreaCode && opts.filterAreaCode !== 'ALL') {
      if (normArea !== normalizeOrgCode(cleanRawAreaCode(opts.filterAreaCode))) return false;
    }
    return true;
  };

  const targetMemberKey =
    opts.filterMemberId && opts.filterMemberId !== 'ALL' ? opts.filterMemberId : '';

  const matchesMemberFilter = (mId?: string, uid?: string): boolean => {
    if (!targetMemberKey) return true;
    return (
      mId === targetMemberKey ||
      uid === targetMemberKey ||
      (uid ? `m-${uid}` === targetMemberKey : false) ||
      `m-${targetMemberKey}` === mId
    );
  };

  const getClusterLabel = (companyCode?: string): string => {
    if (!canViewClusterLevel) return '—';
    const cl = resolveClusterForCompany(companyCode, effectiveClusters, companies);
    return cl ? cl.name || cl.code : 'Khác';
  };

  const getRegionLabel = (companyCode?: string, areaCode?: string): string => {
    if (!canViewSionAndRegionLevel) return '—';
    const reg = resolveRegionForArea(companyCode, areaCode, regions);
    return reg ? reg.name || reg.code : 'Chưa gắn ĐV';
  };

  // Lọc chính xác thành viên theo phân quyền + bộ lọc Cụm -> Sion -> Địa vực -> Khu vực -> Cá nhân
  const allowedMembers = members.filter(
    (m) =>
      canAccessMemberReportOverview(viewer, m) &&
      isMatchedOrgFilter(m.companyCode, m.areaCode) &&
      matchesMemberFilter(m.id)
  );
  const allowedMemberIds = new Set(allowedMembers.map((m) => m.id));

  const scopedReports = periodReports.filter((r) => {
    const mId = r.memberId || `m-${r.uid}`;
    if (!matchesMemberFilter(mId, r.uid)) return false;
    if (r.uid === viewer.id || mId === ownMemberId) {
      const mem = memberById.get(mId);
      return isMatchedOrgFilter(mem?.companyCode || viewer.companyCode, mem?.areaCode || viewer.areaCode);
    }
    if (isAdminRole(viewer.role) && allowedMemberIds.size === 0 && !targetMemberKey) {
      const mem = memberById.get(mId);
      return isMatchedOrgFilter(mem?.companyCode || r.companyCode, mem?.areaCode || r.areaCode);
    }
    return allowedMemberIds.has(mId);
  });

  // Gom nhóm báo cáo theo thành viên
  const reportsByMem = new Map<string, DailyReportRecord[]>();
  scopedReports.forEach((r) => {
    const mId = r.memberId || `m-${r.uid}`;
    const list = reportsByMem.get(mId) || [];
    list.push(r);
    reportsByMem.set(mId, list);
  });

  const memberSummarySource =
    allowedMembers.length > 0
      ? allowedMembers
      : !targetMemberKey || matchesMemberFilter(ownMemberId, viewer.id)
      ? [
          {
            id: ownMemberId,
            code: viewer.username,
            fullName: viewer.fullName,
            companyCode: viewer.companyCode,
            areaCode: viewer.areaCode,
            departmentCode: viewer.departmentCode,
            unitCode: viewer.unitCode,
          } as Member,
        ]
      : [];

  // Sheet 1: Tổng hợp theo Thành viên (KQ & MT 7 chỉ số)
  const memberSummaryRows = memberSummarySource
    .map((m) => {
      const mReps = reportsByMem.get(m.id) || [];
      const results = sumDailyReportMetrics(mReps);
      const goals = sumReportGoals(mReps);
      const totalScore = computeDailyMetricsScore(results, weights);
      return {
        member: m,
        daysCount: mReps.length,
        results,
        goals,
        totalScore,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore || b.daysCount - a.daysCount)
    .map((entry, idx) => {
      const totalRes = sumAllMetrics(entry.results);
      const totalGoal = sumAllMetrics(entry.goals);
      const pct = totalGoal > 0 ? Math.round((totalRes / totalGoal) * 100) : totalRes > 0 ? 100 : 0;
      return {
        STT: idx + 1,
        'Họ và Tên': entry.member.fullName,
        ...(canViewClusterLevel ? { 'Cụm Sion': getClusterLabel(entry.member.companyCode) } : {}),
        Sion: entry.member.companyCode,
        'Địa vực': getRegionLabel(entry.member.companyCode, entry.member.areaCode),
        'Khu vực': entry.member.areaCode,
        'Đội / Uni': entry.member.unitCode || entry.member.departmentCode || '',
        'Số ngày nhập': entry.daysCount,
        ...buildResultGoalColumns(entry.results, entry.goals),
        'Tổng Kết quả': totalRes,
        'Tổng Mục tiêu': totalGoal,
        'Hoàn thành (%)': pct,
        'Tổng điểm quy đổi': entry.totalScore,
      };
    });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      memberSummaryRows.length
        ? memberSummaryRows
        : [{ 'Thông báo': 'Chưa có dữ liệu báo cáo trong phạm vi đã chọn' }]
    ),
    'Tổng hợp Thành viên'
  );

  // Sheet 2 (Cấp 5 QL Cụm trở lên): Tổng hợp theo Cụm Sion
  if (canViewClusterLevel) {
    const clusterBuckets = new Map<
      string,
      {
        clusterName: string;
        companies: Set<string>;
        totalMembers: number;
        activeReporters: number;
        reports: DailyReportRecord[];
      }
    >();

    memberSummarySource.forEach((m) => {
      const cl = resolveClusterForCompany(m.companyCode, effectiveClusters, companies);
      const key = cl?.id || '__unclustered__';
      const clName = cl ? cl.name || cl.code : 'Khác';
      const bucket = clusterBuckets.get(key) || {
        clusterName: clName,
        companies: new Set<string>(),
        totalMembers: 0,
        activeReporters: 0,
        reports: [],
      };
      if (m.companyCode) bucket.companies.add(m.companyCode);
      bucket.totalMembers += 1;
      const mReps = reportsByMem.get(m.id) || [];
      if (mReps.length > 0) bucket.activeReporters += 1;
      bucket.reports.push(...mReps);
      clusterBuckets.set(key, bucket);
    });

    const clusterRows = Array.from(clusterBuckets.values())
      .map((g) => {
        const results = sumDailyReportMetrics(g.reports);
        const goals = sumReportGoals(g.reports);
        const score = computeDailyMetricsScore(results, weights);
        return { g, results, goals, score };
      })
      .sort((a, b) => b.score - a.score || b.g.reports.length - a.g.reports.length)
      .map((item, idx) => {
        const totalRes = sumAllMetrics(item.results);
        const totalGoal = sumAllMetrics(item.goals);
        const pct = totalGoal > 0 ? Math.round((totalRes / totalGoal) * 100) : totalRes > 0 ? 100 : 0;
        return {
          STT: idx + 1,
          'Cụm Sion': item.g.clusterName,
          'Các Sion': Array.from(item.g.companies).sort().join(', '),
          'Đã nhập / Tổng NS': `${item.g.activeReporters} / ${item.g.totalMembers}`,
          'Lượt BC': item.g.reports.length,
          ...buildResultGoalColumns(item.results, item.goals),
          'Tổng Kết quả': totalRes,
          'Tổng Mục tiêu': totalGoal,
          'Hoàn thành (%)': pct,
          'Tổng điểm': item.score,
        };
      });

    if (clusterRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clusterRows), 'Tổng hợp Cụm Sion');
    }
  }

  // Sheet 3 (Cấp 4 TS, NQ trở lên): Tổng hợp theo Sion
  if (canViewSionAndRegionLevel) {
    const sionMap = new Map<
      string,
      {
        companyCode: string;
        totalMembers: number;
        activeReporters: number;
        reports: DailyReportRecord[];
      }
    >();
    memberSummarySource.forEach((m) => {
      const comp = m.companyCode || '—';
      const key = normalizeOrgCode(comp) || comp;
      const bucket = sionMap.get(key) || {
        companyCode: comp,
        totalMembers: 0,
        activeReporters: 0,
        reports: [],
      };
      bucket.totalMembers += 1;
      const mReps = reportsByMem.get(m.id) || [];
      if (mReps.length > 0) bucket.activeReporters += 1;
      bucket.reports.push(...mReps);
      sionMap.set(key, bucket);
    });

    const sionRows = Array.from(sionMap.values())
      .map((g) => {
        const results = sumDailyReportMetrics(g.reports);
        const goals = sumReportGoals(g.reports);
        const score = computeDailyMetricsScore(results, weights);
        return { g, results, goals, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => {
        const totalRes = sumAllMetrics(item.results);
        const totalGoal = sumAllMetrics(item.goals);
        const pct = totalGoal > 0 ? Math.round((totalRes / totalGoal) * 100) : totalRes > 0 ? 100 : 0;
        return {
          STT: idx + 1,
          ...(canViewClusterLevel ? { 'Cụm Sion': getClusterLabel(item.g.companyCode) } : {}),
          Sion: item.g.companyCode,
          'Đã nhập / Tổng NS': `${item.g.activeReporters} / ${item.g.totalMembers}`,
          'Lượt BC': item.g.reports.length,
          ...buildResultGoalColumns(item.results, item.goals),
          'Tổng Kết quả': totalRes,
          'Tổng Mục tiêu': totalGoal,
          'Hoàn thành (%)': pct,
          'Tổng điểm': item.score,
        };
      });

    if (sionRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sionRows), 'Tổng hợp Sion');
    }

    // Sheet 4: Tổng hợp theo Địa vực (nếu có dữ liệu Địa vực)
    if (regions.length > 0) {
      const regMap = new Map<
        string,
        {
          companyCode: string;
          regionName: string;
          areas: Set<string>;
          totalMembers: number;
          activeReporters: number;
          reports: DailyReportRecord[];
        }
      >();
      memberSummarySource.forEach((m) => {
        const reg = resolveRegionForArea(m.companyCode, m.areaCode, regions);
        const comp = m.companyCode || '—';
        const regName = reg ? reg.name || reg.code : 'Chưa gắn Địa vực';
        const key = reg ? reg.id : `unassigned__${normalizeOrgCode(comp)}`;
        const bucket = regMap.get(key) || {
          companyCode: comp,
          regionName: regName,
          areas: new Set<string>(),
          totalMembers: 0,
          activeReporters: 0,
          reports: [],
        };
        if (m.areaCode) bucket.areas.add(m.areaCode);
        bucket.totalMembers += 1;
        const mReps = reportsByMem.get(m.id) || [];
        if (mReps.length > 0) bucket.activeReporters += 1;
        bucket.reports.push(...mReps);
        regMap.set(key, bucket);
      });

      const regionRows = Array.from(regMap.values())
        .map((g) => {
          const results = sumDailyReportMetrics(g.reports);
          const goals = sumReportGoals(g.reports);
          const score = computeDailyMetricsScore(results, weights);
          return { g, results, goals, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => {
          const totalRes = sumAllMetrics(item.results);
          const totalGoal = sumAllMetrics(item.goals);
          const pct =
            totalGoal > 0 ? Math.round((totalRes / totalGoal) * 100) : totalRes > 0 ? 100 : 0;
          return {
            STT: idx + 1,
            ...(canViewClusterLevel ? { 'Cụm Sion': getClusterLabel(item.g.companyCode) } : {}),
            Sion: item.g.companyCode,
            'Địa vực': item.g.regionName,
            'Các Khu vực': Array.from(item.g.areas).sort().join(', '),
            'Đã nhập / Tổng NS': `${item.g.activeReporters} / ${item.g.totalMembers}`,
            'Lượt BC': item.g.reports.length,
            ...buildResultGoalColumns(item.results, item.goals),
            'Tổng Kết quả': totalRes,
            'Tổng Mục tiêu': totalGoal,
            'Hoàn thành (%)': pct,
            'Tổng điểm': item.score,
          };
        });

      if (regionRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(regionRows), 'Tổng hợp Địa vực');
      }
    }
  }

  // Sheet 5: Tổng hợp theo Khu vực (có Cụm, Địa vực, Kết quả & Mục tiêu)
  const areaMap = new Map<
    string,
    {
      companyCode: string;
      areaCode: string;
      totalMembers: number;
      activeReporters: number;
      reports: DailyReportRecord[];
    }
  >();
  memberSummarySource.forEach((m) => {
    const comp = m.companyCode || '—';
    const area = m.areaCode || '—';
    const key = `${normalizeOrgCode(comp)}__${normalizeOrgCode(area)}`;
    const bucket = areaMap.get(key) || {
      companyCode: comp,
      areaCode: area,
      totalMembers: 0,
      activeReporters: 0,
      reports: [],
    };
    bucket.totalMembers += 1;
    const mReps = reportsByMem.get(m.id) || [];
    if (mReps.length > 0) bucket.activeReporters += 1;
    bucket.reports.push(...mReps);
    areaMap.set(key, bucket);
  });

  const areaRows = Array.from(areaMap.values())
    .map((g) => {
      const results = sumDailyReportMetrics(g.reports);
      const goals = sumReportGoals(g.reports);
      const score = computeDailyMetricsScore(results, weights);
      return { g, results, goals, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, idx) => {
      const totalRes = sumAllMetrics(item.results);
      const totalGoal = sumAllMetrics(item.goals);
      const pct = totalGoal > 0 ? Math.round((totalRes / totalGoal) * 100) : totalRes > 0 ? 100 : 0;
      return {
        STT: idx + 1,
        ...(canViewClusterLevel ? { 'Cụm Sion': getClusterLabel(item.g.companyCode) } : {}),
        Sion: item.g.companyCode,
        'Địa vực': getRegionLabel(item.g.companyCode, item.g.areaCode),
        'Khu vực': item.g.areaCode,
        'Đã nhập / Tổng NS': `${item.g.activeReporters} / ${item.g.totalMembers}`,
        'Lượt BC': item.g.reports.length,
        ...buildResultGoalColumns(item.results, item.goals),
        'Tổng Kết quả': totalRes,
        'Tổng Mục tiêu': totalGoal,
        'Hoàn thành (%)': pct,
        'Tổng điểm': item.score,
      };
    });

  if (areaRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaRows), 'Tổng hợp Khu vực');
  }

  // Sheet 6: Chi tiết theo từng Ngày
  const detailRows = [...scopedReports]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      const mem = memberById.get(mId);
      const comp = mem?.companyCode || r.companyCode || (r.uid === viewer.id ? viewer.companyCode : '');
      const area = mem?.areaCode || r.areaCode || (r.uid === viewer.id ? viewer.areaCode : '');
      const totalRes = sumAllMetrics(r.results);
      const totalGoal = sumAllMetrics(r.goals);
      return {
        Ngày: r.date,
        'Họ và Tên': mem?.fullName || (r.uid === viewer.id ? viewer.fullName : mId),
        ...(canViewClusterLevel ? { 'Cụm Sion': getClusterLabel(comp) } : {}),
        Sion: comp,
        'Địa vực': getRegionLabel(comp, area),
        'Khu vực': area,
        'Đội / Uni':
          mem?.unitCode ||
          mem?.departmentCode ||
          r.unitCode ||
          (r.uid === viewer.id ? viewer.unitCode || viewer.departmentCode : ''),
        ...buildResultGoalColumns(r.results, r.goals),
        'Tổng Kết quả': totalRes,
        'Tổng Mục tiêu': totalGoal,
        'Điểm ngày': computeDailyMetricsScore(r.results, weights),
      };
    });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      detailRows.length ? detailRows : [{ 'Thông báo': 'Chưa có bản ghi chi tiết trong kỳ đã chọn' }]
    ),
    'Chi tiết theo ngày'
  );

  const safeBadge = roleMeta.codeBadge.replace(/[^a-zA-Z0-9]/g, '') || viewer.role;
  const fileName = `BaoCao_HangNgay_${safeBadge}_${periodSuffix}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return {
    reportsCount: scopedReports.length,
    membersCount: memberSummarySource.length,
    fileName,
  };
}

/**
 * Export full competition rankings and 6-step breakdown to Excel (.xlsx)
 */
export function exportCompetitionToExcel(
  members: Member[],
  companyRankings: CompanyRankItem[],
  areaRankings: AreaRankItem[]
): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Cá Nhân
  const memberRows = members.map((m, idx) => ({
    'Thứ Hạng': m.rank || idx + 1,
    'Mã TV': m.code,
    'Họ và Tên': m.fullName,
    'Công Ty': m.companyCode,
    'Khu Vực': m.areaCode,
    'Ban Ngành': m.departmentCode,
    'Tổng Điểm': m.score,
    'Số Đối Tượng': m.targets?.length || 0,
    'B1 (Kết bạn)': m.results?.s1 || 0,
    'B2 (Tương tác)': m.results?.s2 || 0,
    'B3 (Gặp)': m.results?.s3 || 0,
    'B4 (Thăm)': m.results?.s4 || 0,
    'B5 (Cơm)': m.results?.s5 || 0,
    'B6 (Gợi mở)': m.results?.s6 || 0,
    'Trạng Thái': m.active ? 'Đang hoạt động' : 'Tạm ngưng',
  }));
  const wsMembers = XLSX.utils.json_to_sheet(memberRows);
  XLSX.utils.book_append_sheet(wb, wsMembers, 'Bảng Cá Nhân');

  // 2. Sheet Công Ty
  const companyRows = companyRankings.map((c) => ({
    'Hạng': c.rank,
    'Mã Cty': c.companyCode,
    'Tên Công Ty': c.companyName,
    'Số Thành Viên': c.activeMembersCount,
    'Điểm Trung Bình / TV': c.averageScore,
    'Tổng Điểm Cty': c.totalScore,
  }));
  const wsCompanies = XLSX.utils.json_to_sheet(companyRows);
  XLSX.utils.book_append_sheet(wb, wsCompanies, 'Xếp Hạng Công Ty');

  // 3. Sheet Khu Vực
  const areaRows = areaRankings.map((a) => ({
    'Hạng': a.rank,
    'Mã Khu Vực': a.areaCode,
    'Tên Khu Vực': a.areaName,
    'Trực Thuộc Cty': a.companyCode,
    'Số Thành Viên': a.activeMembersCount,
    'Điểm Trung Bình / TV': a.averageScore,
    'Tổng Điểm KV': a.totalScore,
  }));
  const wsAreas = XLSX.utils.json_to_sheet(areaRows);
  XLSX.utils.book_append_sheet(wb, wsAreas, 'Xếp Hạng Khu Vực');

  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  XLSX.writeFile(wb, `HanhThucLuc_Bao_Cao_Thi_Dua_${dateStr}.xlsx`);
}

/**
 * Trigger clean browser printing (Save as PDF)
 */
export function printCompetitionReport(): void {
  window.print();
}
