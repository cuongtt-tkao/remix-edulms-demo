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
import {
  canAccessMemberReportOverview,
  isAdminRole,
  normalizeOrgCode,
} from './rbac';

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

/**
 * Xuất Excel Báo cáo hằng ngày với đầy đủ 7 chỉ số chi tiết (KN, Thăm, GM, ĐT, HH, KT, WS New),
 * tuân thủ chặt chẽ phân quyền 7 cấp:
 * - Cấp 6-7 (ADMIN / SUPER_ADMIN): Toàn hệ thống (tùy chọn lọc Sion/KV/Cá nhân)
 * - Cấp 5 (MANAGER / QL Cụm): Toàn bộ thành viên, Sion & Khu vực thuộc cụm phụ trách + 7 chỉ số chi tiết
 * - Cấp 4 (SION_LEADER / TS, NQ): Thành viên & khu vực thuộc Sion phụ trách
 * - Cấp 3 (AREA_LEADER / Gru): Các Uni & thành viên thuộc Khu vực quản lý
 * - Cấp 2 (UNI_LEADER / Uni): Thành viên thuộc đội Uni của mình
 * - Cấp 1 (MEMBER / TĐ): Chỉ báo cáo cá nhân & 7 chỉ số chi tiết của chính mình
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

  // Lọc chính xác thành viên theo phân quyền 7 cấp + 3 tầng Sion -> Khu vực -> Cá nhân
  const allowedMembers = members.filter(
    (m) =>
      canAccessMemberReportOverview(viewer, m) &&
      isMatchedOrgFilter(m.companyCode, m.areaCode) &&
      matchesMemberFilter(m.id)
  );
  const allowedMemberIds = new Set(allowedMembers.map((m) => m.id));

  // Đảm bảo bản thân luôn nằm trong phạm vi nếu chưa có bản ghi Member đồng bộ
  const scopedReports = periodReports.filter((r) => {
    const mId = r.memberId || `m-${r.uid}`;
    if (!matchesMemberFilter(mId, r.uid)) return false;
    if (r.uid === viewer.id || mId === ownMemberId) {
      return isMatchedOrgFilter(viewer.companyCode, viewer.areaCode);
    }
    if (isAdminRole(viewer.role) && allowedMemberIds.size === 0 && !targetMemberKey) {
      const mem = memberById.get(mId);
      return isMatchedOrgFilter(mem?.companyCode, mem?.areaCode);
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

  // Sheet 1: Tổng hợp theo Thành viên (đầy đủ 7 chỉ số chi tiết)
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
