import * as XLSX from 'xlsx';
import {
  Member,
  CompanyRankItem,
  AreaRankItem,
  UserAccount,
  DailyReportRecord,
  DailyReportMetrics,
  DAILY_METRIC_DEFINITIONS,
  ROLE_DISPLAY_META,
} from '../types/edulms';
import { computeDailyMetricsScore, sumDailyReportMetrics } from './scoringEngine';
import { canViewMemberDetail, isAdminRole, isMemberInManagerCluster, normalizeOrgCode } from './rbac';

export type DailyReportExportPeriod = 'DAY' | 'MONTH' | 'YEAR' | 'ALL';

export interface DailyReportExportOptions {
  viewer: UserAccount;
  dailyReports: DailyReportRecord[];
  members: Member[];
  weights: DailyReportMetrics;
  period: DailyReportExportPeriod;
  periodDate?: string; // YYYY-MM-DD
  periodMonth?: string; // YYYY-MM
  periodYear?: string; // YYYY
  filterCompanyCode?: string;
  filterAreaCode?: string;
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

/**
 * Xuất Excel Báo cáo hằng ngày tuân thủ chặt chẽ phân quyền 7 cấp:
 * - HT (SUPER_ADMIN / ADMIN): Toàn hệ thống (tùy chọn lọc Sion/KV)
 * - QL Cụm (MANAGER): Tổng hợp các Sion & Khu vực trong cụm + Chi tiết cá nhân bản thân
 * - TS, NQ (SION_LEADER): Thành viên & khu vực thuộc Sion phụ trách
 * - Gru (AREA_LEADER): Các Uni & thành viên thuộc Khu vực quản lý
 * - Uni (UNI_LEADER): Thành viên thuộc đội Uni của mình
 * - TĐ (MEMBER): Chỉ báo cáo cá nhân của chính mình
 */
export function exportDailyReportsByRbacExcel(
  opts: DailyReportExportOptions
): DailyReportExportSummary {
  const { viewer, dailyReports, members, weights } = opts;
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
    if (opts.filterCompanyCode && opts.filterCompanyCode !== 'ALL') {
      if (normalizeOrgCode(companyCode) !== normalizeOrgCode(opts.filterCompanyCode)) return false;
    }
    if (opts.filterAreaCode && opts.filterAreaCode !== 'ALL') {
      if (normalizeOrgCode(areaCode) !== normalizeOrgCode(opts.filterAreaCode)) return false;
    }
    return true;
  };

  // CASE 1: QL Cụm (MANAGER) -> Tổng hợp Sion & Khu vực thuộc cụm + báo cáo cá nhân bản thân
  if (viewer.role === 'MANAGER') {
    const clusterMembers = members.filter(
      (m) =>
        isMemberInManagerCluster(viewer, m) && isMatchedOrgFilter(m.companyCode, m.areaCode)
    );
    const clusterMemberIds = new Set(clusterMembers.map((m) => m.id));
    const clusterReports = periodReports.filter((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      return clusterMemberIds.has(mId);
    });

    // Sheet 1: Tổng hợp theo Sion & Khu vực
    const areaGroupMap = new Map<
      string,
      {
        companyCode: string;
        areaCode: string;
        memberSet: Set<string>;
        reports: DailyReportRecord[];
      }
    >();
    clusterReports.forEach((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      const mem = memberById.get(mId);
      const comp = mem?.companyCode || '';
      const area = mem?.areaCode || '';
      const groupKey = `${comp}__${area}`;
      const bucket = areaGroupMap.get(groupKey) || {
        companyCode: comp,
        areaCode: area,
        memberSet: new Set<string>(),
        reports: [],
      };
      bucket.memberSet.add(mId);
      bucket.reports.push(r);
      areaGroupMap.set(groupKey, bucket);
    });

    const summaryRows = Array.from(areaGroupMap.values())
      .sort((a, b) => `${a.companyCode}-${a.areaCode}`.localeCompare(`${b.companyCode}-${b.areaCode}`))
      .map((g, idx) => {
        const sums = sumDailyReportMetrics(g.reports);
        const totalScore = computeDailyMetricsScore(sums, weights);
        return {
          STT: idx + 1,
          Sion: g.companyCode,
          'Khu vực': g.areaCode,
          'Số thành viên báo cáo': g.memberSet.size,
          'Tổng lượt ngày nhập': g.reports.length,
          ...Object.fromEntries(DAILY_METRIC_DEFINITIONS.map((m) => [m.label, sums[m.key]])),
          'Tổng điểm quy đổi': totalScore,
        };
      });

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        summaryRows.length
          ? summaryRows
          : [{ 'Thông báo': 'Chưa có dữ liệu báo cáo trong cụm ở kỳ đã chọn' }]
      ),
      'Tổng hợp Cụm'
    );

    // Sheet 2: Chi tiết cá nhân của chính Manager
    const ownReports = periodReports
      .filter((r) => r.uid === viewer.id || r.memberId === ownMemberId)
      .sort((a, b) => b.date.localeCompare(a.date));

    const ownRows = ownReports.map((r) => ({
      Ngày: r.date,
      ...Object.fromEntries(
        DAILY_METRIC_DEFINITIONS.map((m) => [`KQ ${m.label}`, r.results?.[m.key] || 0])
      ),
      ...Object.fromEntries(
        DAILY_METRIC_DEFINITIONS.map((m) => [`MT ${m.label}`, r.goals?.[m.key] || 0])
      ),
      'Điểm ngày': computeDailyMetricsScore(r.results, weights),
    }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        ownRows.length ? ownRows : [{ 'Thông báo': 'Chưa có báo cáo cá nhân trong kỳ đã chọn' }]
      ),
      'Báo cáo cá nhân'
    );

    const fileName = `BaoCao_HangNgay_QLCum_${periodSuffix}.xlsx`;
    XLSX.writeFile(wb, fileName);
    return {
      reportsCount: clusterReports.length,
      membersCount: clusterMembers.length,
      fileName,
    };
  }

  // CASE 2: HT / Ts,nq / Gru / Uni / TĐ -> Lọc chính xác theo canViewMemberDetail
  const allowedMembers = members.filter(
    (m) => canViewMemberDetail(viewer, m) && isMatchedOrgFilter(m.companyCode, m.areaCode)
  );
  const allowedMemberIds = new Set(allowedMembers.map((m) => m.id));

  // Đảm bảo bản thân luôn nằm trong phạm vi nếu chưa có bản ghi Member đồng bộ
  const scopedReports = periodReports.filter((r) => {
    const mId = r.memberId || `m-${r.uid}`;
    if (r.uid === viewer.id || mId === ownMemberId) {
      return isMatchedOrgFilter(viewer.companyCode, viewer.areaCode);
    }
    if (isAdminRole(viewer.role) && allowedMemberIds.size === 0) {
      return true;
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

  // Sheet 1: Tổng hợp theo Thành viên
  const memberSummarySource =
    allowedMembers.length > 0
      ? allowedMembers
      : [
          {
            id: ownMemberId,
            code: viewer.username,
            fullName: viewer.fullName,
            companyCode: viewer.companyCode,
            areaCode: viewer.areaCode,
            departmentCode: viewer.departmentCode,
            unitCode: viewer.unitCode,
          } as Member,
        ];

  const memberSummaryRows = memberSummarySource
    .map((m) => {
      const mReps = reportsByMem.get(m.id) || [];
      const sums = sumDailyReportMetrics(mReps);
      const totalScore = computeDailyMetricsScore(sums, weights);
      return {
        member: m,
        daysCount: mReps.length,
        sums,
        totalScore,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore || b.daysCount - a.daysCount)
    .map((entry, idx) => ({
      STT: idx + 1,
      'Họ và Tên': entry.member.fullName,
      Sion: entry.member.companyCode,
      'Khu vực': entry.member.areaCode,
      'Đội / Uni': entry.member.unitCode || entry.member.departmentCode || '',
      'Số ngày nhập': entry.daysCount,
      ...Object.fromEntries(DAILY_METRIC_DEFINITIONS.map((m) => [m.label, entry.sums[m.key]])),
      'Tổng điểm quy đổi': entry.totalScore,
    }));

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      memberSummaryRows.length
        ? memberSummaryRows
        : [{ 'Thông báo': 'Chưa có dữ liệu báo cáo trong phạm vi đã chọn' }]
    ),
    viewer.role === 'MEMBER' ? 'Tổng hợp cá nhân' : 'Tổng hợp Thành viên'
  );

  // Sheet 2 (cho cấp quản lý): Tổng hợp theo Đơn vị (Sion / KV)
  if (viewer.role !== 'MEMBER') {
    const unitMap = new Map<
      string,
      {
        companyCode: string;
        areaCode: string;
        memberSet: Set<string>;
        reports: DailyReportRecord[];
      }
    >();
    scopedReports.forEach((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      const mem = memberById.get(mId);
      const comp = mem?.companyCode || viewer.companyCode || '';
      const area = mem?.areaCode || viewer.areaCode || '';
      const key = `${comp}__${area}`;
      const bucket = unitMap.get(key) || {
        companyCode: comp,
        areaCode: area,
        memberSet: new Set<string>(),
        reports: [],
      };
      bucket.memberSet.add(mId);
      bucket.reports.push(r);
      unitMap.set(key, bucket);
    });

    const orgRows = Array.from(unitMap.values())
      .sort((a, b) => `${a.companyCode}-${a.areaCode}`.localeCompare(`${b.companyCode}-${b.areaCode}`))
      .map((g, idx) => {
        const sums = sumDailyReportMetrics(g.reports);
        return {
          STT: idx + 1,
          Sion: g.companyCode,
          'Khu vực': g.areaCode,
          'Số thành viên': g.memberSet.size,
          'Số ngày báo cáo': g.reports.length,
          ...Object.fromEntries(DAILY_METRIC_DEFINITIONS.map((m) => [m.label, sums[m.key]])),
          'Tổng điểm': computeDailyMetricsScore(sums, weights),
        };
      });

    if (orgRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orgRows), 'Tổng hợp Khu vực');
    }
  }

  // Sheet 3: Chi tiết theo từng Ngày
  const detailRows = [...scopedReports]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => {
      const mId = r.memberId || `m-${r.uid}`;
      const mem = memberById.get(mId);
      return {
        Ngày: r.date,
        'Họ và Tên': mem?.fullName || (r.uid === viewer.id ? viewer.fullName : mId),
        Sion: mem?.companyCode || (r.uid === viewer.id ? viewer.companyCode : ''),
        'Khu vực': mem?.areaCode || (r.uid === viewer.id ? viewer.areaCode : ''),
        'Đội / Uni':
          mem?.unitCode ||
          mem?.departmentCode ||
          (r.uid === viewer.id ? viewer.unitCode || viewer.departmentCode : ''),
        ...Object.fromEntries(
          DAILY_METRIC_DEFINITIONS.map((m) => [`KQ ${m.label}`, r.results?.[m.key] || 0])
        ),
        ...Object.fromEntries(
          DAILY_METRIC_DEFINITIONS.map((m) => [`MT ${m.label}`, r.goals?.[m.key] || 0])
        ),
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
