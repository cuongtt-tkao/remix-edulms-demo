import * as XLSX from 'xlsx';
import {
  DayThreeSessions,
  DEFAULT_WS_ACTIVE_DAYS,
  Member,
  ROLE_DISPLAY_META,
  UserAccount,
  WeekDayKey,
  WORK_WEEK_DAYS,
  WorkScheduleRecord,
} from '../types/edulms';
import {
  canViewMemberDetail,
  isAdminRole,
  isMemberInManagerCluster,
  normalizeOrgCode,
} from './rbac';
import { sanitizeExcelCell } from './excelSanitizer';

export type WorkScheduleExportPeriod = 'WEEK' | 'MONTH' | 'ALL';

export interface WorkScheduleExportOptions {
  viewer: UserAccount;
  workSchedules: WorkScheduleRecord[];
  members: Member[];
  period: WorkScheduleExportPeriod;
  selectedWeekStart?: string; // YYYY-MM-DD (Chủ Nhật đầu tuần)
  targetMonth?: string; // YYYY-MM
  scopeMode?: 'SELF' | 'TEAM';
  filterCompanyCode?: string;
  filterAreaCode?: string;
  filterOwnerKey?: string; // 'ALL' | memberId | ownerUid
  includeWs?: boolean; // Mặc định true; nếu false sẽ ẩn toàn bộ cột/dòng WS khi xuất Excel
}

export interface WorkScheduleExportSummary {
  recordsCount: number;
  peopleCount: number;
  fileName: string;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date();
}

function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDayMonthVN(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function addDaysStr(baseDateStr: string, offsetDays: number): string {
  const d = parseLocalDate(baseDateStr);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getDateStamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
}

function resolveActiveWsDays(rec: WorkScheduleRecord): WeekDayKey[] {
  const activeSet = new Set<WeekDayKey>(
    Array.isArray(rec.wsActiveDays) && rec.wsActiveDays.length > 0
      ? rec.wsActiveDays
      : DEFAULT_WS_ACTIVE_DAYS
  );
  if (rec.ws) {
    WORK_WEEK_DAYS.forEach(({ key }) => {
      const entry = rec.ws?.[key];
      if (
        entry &&
        ((entry.morning || '').trim() ||
          (entry.afternoon || '').trim() ||
          (entry.evening || '').trim())
      ) {
        activeSet.add(key);
      }
    });
  }
  return WORK_WEEK_DAYS.map((d) => d.key).filter((k) => activeSet.has(k));
}

function formatDaySessionsCompact(entry?: Partial<DayThreeSessions>): string {
  if (!entry) return '—';
  const m = (entry.morning || '').trim() || '-';
  const a = (entry.afternoon || '').trim() || '-';
  const e = (entry.evening || '').trim() || '-';
  if (m === '-' && a === '-' && e === '-') return '—';
  return `${m} / ${a} / ${e}`;
}

function formatWsSummary(rec: WorkScheduleRecord): string {
  const activeDays = resolveActiveWsDays(rec);
  const parts: string[] = [];
  activeDays.forEach((dayKey) => {
    const entry = rec.ws?.[dayKey];
    if (!entry) return;
    const sub: string[] = [];
    if ((entry.morning || '').trim()) sub.push(`S:${entry.morning.trim()}`);
    if ((entry.afternoon || '').trim()) sub.push(`C:${entry.afternoon.trim()}`);
    if ((entry.evening || '').trim()) sub.push(`T:${entry.evening.trim()}`);
    if (sub.length > 0) {
      const label = WORK_WEEK_DAYS.find((d) => d.key === dayKey)?.shortLabel || dayKey;
      parts.push(`${label}(${sub.join(', ')})`);
    }
  });
  return parts.length > 0 ? parts.join(' | ') : '—';
}

function countRegularFilled(rec: WorkScheduleRecord): number {
  if (!rec.sessions) return 0;
  return WORK_WEEK_DAYS.reduce((sum, { key }) => {
    const d = rec.sessions[key];
    if (!d) return sum;
    return (
      sum +
      ((d.morning || '').trim() ? 1 : 0) +
      ((d.afternoon || '').trim() ? 1 : 0) +
      ((d.evening || '').trim() ? 1 : 0)
    );
  }, 0);
}

function countWsFilled(rec: WorkScheduleRecord): number {
  if (!rec.ws) return 0;
  const days = resolveActiveWsDays(rec);
  return days.reduce((sum, key) => {
    const d = rec.ws[key];
    if (!d) return sum;
    return (
      sum +
      ((d.morning || '').trim() ? 1 : 0) +
      ((d.afternoon || '').trim() ? 1 : 0) +
      ((d.evening || '').trim() ? 1 : 0)
    );
  }, 0);
}

function matchesPeriod(rec: WorkScheduleRecord, opts: WorkScheduleExportOptions): boolean {
  if (opts.period === 'WEEK' && opts.selectedWeekStart) {
    return rec.weekStart === opts.selectedWeekStart;
  }
  if (opts.period === 'MONTH' && opts.targetMonth) {
    return (
      rec.weekStart.startsWith(opts.targetMonth) ||
      rec.weekEnd.startsWith(opts.targetMonth)
    );
  }
  return true;
}

/**
 * Xuất Excel Lịch Làm Việc Tuần (3 buổi & WS) tuân thủ phân quyền 7 cấp:
 * - scopeMode = 'SELF' hoặc MEMBER (TĐ): Chỉ xuất lịch cá nhân của chính viewer
 * - UNI_LEADER / AREA_LEADER / SION_LEADER / MANAGER / ADMIN / SUPER_ADMIN: Xuất theo phạm vi quản lý
 */
export function exportWorkSchedulesByRbacExcel(
  opts: WorkScheduleExportOptions
): WorkScheduleExportSummary {
  const { viewer, workSchedules, members } = opts;
  const includeWs = opts.includeWs !== false;
  const wb = XLSX.utils.book_new();
  const ownMemberId = viewer.memberId || `m-${viewer.id}`;
  const isSelfOnly = opts.scopeMode === 'SELF' || viewer.role === 'MEMBER';

  const memberById = new Map<string, Member>();
  const memberByUid = new Map<string, Member>();
  members.forEach((m) => {
    memberById.set(m.id, m);
    if (m.id.startsWith('m-')) {
      memberByUid.set(m.id.slice(2), m);
    }
  });

  const isMatchedOrgFilter = (comp?: string, area?: string): boolean => {
    if (opts.filterCompanyCode && opts.filterCompanyCode !== 'ALL') {
      if (normalizeOrgCode(comp) !== normalizeOrgCode(opts.filterCompanyCode)) return false;
    }
    if (opts.filterAreaCode && opts.filterAreaCode !== 'ALL') {
      if (normalizeOrgCode(area) !== normalizeOrgCode(opts.filterAreaCode)) return false;
    }
    return true;
  };

  const canAccessRecord = (rec: WorkScheduleRecord): boolean => {
    const isOwn =
      rec.ownerUid === viewer.id ||
      (rec.ownerMemberId && rec.ownerMemberId === ownMemberId);

    if (isSelfOnly) {
      return Boolean(isOwn);
    }

    const linkedMember =
      (rec.ownerMemberId && memberById.get(rec.ownerMemberId)) ||
      memberByUid.get(rec.ownerUid) ||
      ({
        id: rec.ownerMemberId || `m-${rec.ownerUid}`,
        code: '',
        fullName: rec.ownerName,
        companyCode: rec.companyCode,
        areaCode: rec.areaCode,
        departmentCode: rec.ownerUnitCode || '',
        unitCode: rec.ownerUnitCode || '',
        active: true,
        goals: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
        results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
        score: 0,
        targets: [],
        createdAt: rec.createdAt,
      } satisfies Member);

    const effCompany = linkedMember.companyCode || rec.companyCode;
    const effArea = linkedMember.areaCode || rec.areaCode;

    if (!isMatchedOrgFilter(effCompany, effArea)) return false;

    if (opts.filterOwnerKey && opts.filterOwnerKey !== 'ALL') {
      const targetKey = opts.filterOwnerKey;
      const matchesTarget =
        rec.ownerUid === targetKey ||
        rec.ownerMemberId === targetKey ||
        `m-${rec.ownerUid}` === targetKey ||
        linkedMember.id === targetKey;
      if (!matchesTarget) return false;
    }

    if (isAdminRole(viewer.role)) return true;
    if (isOwn) return true;
    if (viewer.role === 'MANAGER') {
      return isMemberInManagerCluster(viewer, linkedMember);
    }
    return canViewMemberDetail(viewer, linkedMember);
  };

  const scopedRecords = workSchedules
    .filter((rec) => matchesPeriod(rec, opts) && canAccessRecord(rec))
    .sort((a, b) => {
      const wCmp = (b.weekStart || '').localeCompare(a.weekStart || '');
      if (wCmp !== 0) return wCmp;
      const cCmp = (a.companyCode || '').localeCompare(b.companyCode || '');
      if (cCmp !== 0) return cCmp;
      return (a.ownerName || '').localeCompare(b.ownerName || '', 'vi');
    });

  const uniquePeople = new Set(scopedRecords.map((r) => r.ownerUid || r.ownerMemberId || r.ownerName));

  // SHEET 1: TỔNG HỢP LỊCH TUẦN
  const summaryRows = scopedRecords.map((rec, idx) => {
    const activeWsDays = resolveActiveWsDays(rec);
    const activeWsLabels = activeWsDays
      .map((k) => WORK_WEEK_DAYS.find((d) => d.key === k)?.shortLabel || k)
      .join(', ');

    const dayColumns: Record<string, string | number> = {};
    WORK_WEEK_DAYS.forEach((d) => {
      dayColumns[`${d.shortLabel} (S/C/T)`] = sanitizeExcelCell(
        formatDaySessionsCompact(rec.sessions?.[d.key])
      );
    });

    return {
      STT: idx + 1,
      'Tuần (CN → T7)': `${formatDayMonthVN(rec.weekStart)} – ${formatDateVN(rec.weekEnd)}`,
      'Họ và Tên': sanitizeExcelCell(rec.ownerName),
      Sion: sanitizeExcelCell(rec.companyCode || ''),
      'Khu Vực': sanitizeExcelCell(rec.areaCode || ''),
      'Đội / Uni': sanitizeExcelCell(rec.ownerUnitCode || ''),
      'Buổi thường (/21)': countRegularFilled(rec),
      ...(includeWs
        ? {
            'Buổi WS': countWsFilled(rec),
            'Ngày bật WS': sanitizeExcelCell(activeWsLabels || '—'),
          }
        : {}),
      ...dayColumns,
      ...(includeWs ? { 'Chi tiết Lịch WS': sanitizeExcelCell(formatWsSummary(rec)) } : {}),
      'Ghi chú cá nhân': sanitizeExcelCell(rec.noteLegend || ''),
      'Cập nhật lúc': rec.updatedAt ? new Date(rec.updatedAt).toLocaleString('vi-VN') : '',
    };
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summaryRows.length
        ? summaryRows
        : [{ 'Thông báo': 'Chưa có dữ liệu lịch làm việc trong phạm vi và thời gian đã chọn' }]
    ),
    isSelfOnly ? 'Tổng Hợp Lịch Cá Nhân' : 'Tổng Hợp Lịch Tuần'
  );

  // SHEET 2: CHI TIẾT THEO NGÀY & BUỔI (Dạng dọc dễ lọc Pivot)
  const dailyRows: Array<Record<string, string | number>> = [];
  scopedRecords.forEach((rec) => {
    const weekLabel = `${formatDayMonthVN(rec.weekStart)} – ${formatDateVN(rec.weekEnd)}`;
    const activeWsSet = new Set(resolveActiveWsDays(rec));
    WORK_WEEK_DAYS.forEach((d, dayIdx) => {
      const sEntry = rec.sessions?.[d.key];
      const wEntry = rec.ws?.[d.key];
      const isWsDay = activeWsSet.has(d.key);
      const dateStr = addDaysStr(rec.weekStart, dayIdx);

      dailyRows.push({
        'Tuần': weekLabel,
        'Thứ': d.fullLabel,
        'Ngày': formatDateVN(dateStr),
        'Họ và Tên': sanitizeExcelCell(rec.ownerName),
        Sion: sanitizeExcelCell(rec.companyCode || ''),
        'Khu Vực': sanitizeExcelCell(rec.areaCode || ''),
        'Đội / Uni': sanitizeExcelCell(rec.ownerUnitCode || ''),
        'Sáng': sanitizeExcelCell((sEntry?.morning || '').trim() || ''),
        'Chiều': sanitizeExcelCell((sEntry?.afternoon || '').trim() || ''),
        'Tối': sanitizeExcelCell((sEntry?.evening || '').trim() || ''),
        ...(includeWs
          ? {
              'Có WS': isWsDay ? 'Có' : '',
              'WS Sáng': isWsDay ? sanitizeExcelCell((wEntry?.morning || '').trim()) : '',
              'WS Chiều': isWsDay ? sanitizeExcelCell((wEntry?.afternoon || '').trim()) : '',
              'WS Tối': isWsDay ? sanitizeExcelCell((wEntry?.evening || '').trim()) : '',
            }
          : {}),
      });
    });
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dailyRows.length
        ? dailyRows
        : [{ 'Thông báo': 'Chưa có dữ liệu chi tiết theo ngày trong kỳ đã chọn' }]
    ),
    'Chi Tiết Theo Ngày'
  );

  // SHEET 3: MA TRẬN CÁ NHÂN (Khi xuất cá nhân hoặc chỉ 1 người cụ thể)
  const shouldIncludeMatrix =
    isSelfOnly ||
    (opts.filterOwnerKey && opts.filterOwnerKey !== 'ALL') ||
    uniquePeople.size === 1;

  if (shouldIncludeMatrix && scopedRecords.length > 0) {
    const matrixAoA: Array<Array<string>> = [];
    scopedRecords.forEach((rec, recIdx) => {
      if (recIdx > 0) matrixAoA.push([]);
      matrixAoA.push([
        `LỊCH LÀM VIỆC TUẦN: ${formatDayMonthVN(rec.weekStart)} – ${formatDateVN(rec.weekEnd)}`,
        '',
        String(sanitizeExcelCell(`Họ tên: ${rec.ownerName}`)),
        String(sanitizeExcelCell(`Sion: ${rec.companyCode || '—'}`)),
        String(sanitizeExcelCell(`KV: ${rec.areaCode || '—'}`)),
        rec.ownerUnitCode ? String(sanitizeExcelCell(`Uni: ${rec.ownerUnitCode}`)) : '',
      ]);
      matrixAoA.push([
        'Khung giờ / Hạng mục',
        ...WORK_WEEK_DAYS.map((d, idx) => `${d.fullLabel} (${formatDayMonthVN(addDaysStr(rec.weekStart, idx))})`),
      ]);

      // 3 buổi thường
      const sessionDefs: Array<{ key: keyof DayThreeSessions; label: string }> = [
        { key: 'morning', label: 'Sáng (06:00–11:59)' },
        { key: 'afternoon', label: 'Chiều (12:00–17:59)' },
        { key: 'evening', label: 'Tối (18:00–22:59)' },
      ];
      sessionDefs.forEach((sDef) => {
        matrixAoA.push([
          sDef.label,
          ...WORK_WEEK_DAYS.map((d) =>
            String(sanitizeExcelCell((rec.sessions?.[d.key]?.[sDef.key] || '').trim() || '—'))
          ),
        ]);
      });

      // Tách riêng khối WS (chỉ thêm khi đang bật hiển thị WS)
      if (includeWs) {
        const activeWsSet = new Set(resolveActiveWsDays(rec));
        sessionDefs.forEach((sDef) => {
          matrixAoA.push([
            `WS · ${sDef.label.split(' ')[0]}`,
            ...WORK_WEEK_DAYS.map((d) =>
              activeWsSet.has(d.key)
                ? String(sanitizeExcelCell((rec.ws?.[d.key]?.[sDef.key] || '').trim() || '—'))
                : 'Không bật'
            ),
          ]);
        });
      }

      if (rec.noteLegend) {
        matrixAoA.push(['Ghi chú quy ước số', String(sanitizeExcelCell(rec.noteLegend))]);
      }
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrixAoA), 'Ma Trận Cá Nhân');
  }

  const roleMeta = ROLE_DISPLAY_META[viewer.role] || ROLE_DISPLAY_META.MEMBER;
  const safeBadge = isSelfOnly
    ? 'CaNhan'
    : roleMeta.codeBadge.replace(/[^a-zA-Z0-9]/g, '') || viewer.role;
  const periodTag =
    opts.period === 'WEEK'
      ? opts.selectedWeekStart?.replace(/-/g, '') || getDateStamp()
      : opts.period === 'MONTH'
      ? (opts.targetMonth || '').replace(/-/g, '') || 'Thang'
      : 'TatCa';

  const fileName = `LichLamViec_${safeBadge}_${periodTag}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return {
    recordsCount: scopedRecords.length,
    peopleCount: uniquePeople.size,
    fileName,
  };
}
