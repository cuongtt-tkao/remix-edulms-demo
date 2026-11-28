import {
  EDU_TRACK_LABELS,
  EDU_TRACK_ORDER,
  EduAssignmentStatus,
  EduCmsProfile,
  EduTopicAssignment,
  EduTrack,
  EduWeeklyTopic,
  UserAccount,
} from '../types/edulms';
import { canViewEduRecord, normalizeOrgCode } from './rbac';

export type EduRatingTier =
  | 'CHUA_CO'
  | 'YEU'
  | 'TRUNG_BINH'
  | 'KHA'
  | 'TOT'
  | 'XUAT_SAC'
  | 'SIEU_XUAT_SAC';

export interface EduRatingResult {
  tier: EduRatingTier;
  label: string;
}

export interface LmsManagementRow {
  rowKey: string;
  source: 'CMS_AUTO' | 'CMS_LINKED' | 'MANUAL';
  name: string;
  companyCode: string;
  areaCode: string;
  level: EduTrack;
  participated: boolean;
  completed: boolean;
  cmsProfileId?: string;
  assignment?: EduTopicAssignment;
  note: string;
}

export interface LmsLevelAnalyticsRow {
  level: EduTrack | 'TOTAL';
  label: string;
  totalCount: number; // SL
  participatedCount: number;
  participatedRate: number | null; // %
  participatedRating: EduRatingResult;
  completedCount: number;
  completedRate: number | null; // %
  completedRating: EduRatingResult;
}

export interface LmsAreaAnalyticsRow {
  companyCode: string;
  areaCode: string;
  totalCount: number;
  participatedCount: number;
  participatedRate: number | null;
  participatedRating: EduRatingResult;
  completedCount: number;
  completedRate: number | null;
  completedRating: EduRatingResult;
}

export interface LmsManagementFilters {
  weekFilter?: string; // 'ALL' | weekLabel
  topicIdFilter?: string; // 'ALL' | topic.id
  companyFilter?: string; // 'ALL' | companyCode
  areaFilter?: string; // 'ALL' | areaCode
  levelFilter?: 'ALL' | EduTrack;
  searchQuery?: string;
}

export function normalizeEduText(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getISOWeekInfo(date: Date = new Date()): { week: number; year: number; weekLabel: string } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();
  return {
    week,
    year,
    weekLabel: `Tuần ${String(week).padStart(2, '0')} / ${year}`,
  };
}

export function parseWeekLabelToIdSuffix(weekLabel: string): string {
  const m = weekLabel.match(/(\d+)\s*\/\s*(\d{4})/);
  if (m) {
    return `${m[2]}_W${m[1].padStart(2, '0')}`;
  }
  const safe = weekLabel.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return safe || 'WEEK';
}

export function isAssignmentCompleted(
  a: Pick<EduTopicAssignment, 'completed' | 'status'>
): boolean {
  if (typeof a.completed === 'boolean') return a.completed;
  return a.status === 'COMPLETED';
}

export function isAssignmentParticipated(
  a: Pick<EduTopicAssignment, 'participated' | 'completed' | 'status'>
): boolean {
  if (isAssignmentCompleted(a)) return true;
  if (typeof a.participated === 'boolean') return a.participated;
  return a.status === 'IN_PROGRESS' || a.status === 'COMPLETED';
}

export function deriveAssignmentStatus(participated: boolean, completed: boolean): {
  participated: boolean;
  completed: boolean;
  status: EduAssignmentStatus;
} {
  if (completed) {
    return { participated: true, completed: true, status: 'COMPLETED' };
  }
  if (participated) {
    return { participated: true, completed: false, status: 'IN_PROGRESS' };
  }
  return { participated: false, completed: false, status: 'REGISTERED' };
}

/**
 * Thang điểm Đánh giá theo chuẩn đã chốt:
 * - < 50%: Yếu
 * - 50% – 59%: Trung bình
 * - 60% – 69%: Khá
 * - 70% – 79%: Tốt
 * - 80% – 89%: Xuất sắc
 * - 90% – 100%: Siêu xuất sắc
 */
export function getEduRating(percent: number | null): EduRatingResult {
  if (percent === null || Number.isNaN(percent)) {
    return { tier: 'CHUA_CO', label: 'Chưa có SL' };
  }
  if (percent < 50) return { tier: 'YEU', label: 'Yếu' };
  if (percent < 60) return { tier: 'TRUNG_BINH', label: 'Trung bình' };
  if (percent < 70) return { tier: 'KHA', label: 'Khá' };
  if (percent < 80) return { tier: 'TOT', label: 'Tốt' };
  if (percent < 90) return { tier: 'XUAT_SAC', label: 'Xuất sắc' };
  return { tier: 'SIEU_XUAT_SAC', label: 'Siêu xuất sắc' };
}

export function formatEduPercent(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) return '—';
  return Number.isInteger(rate) ? `${rate}%` : `${rate.toFixed(1)}%`;
}

function calcRate(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Hợp nhất danh sách nhân sự từ CMS (tự động nạp sẵn theo phạm vi lọc) và các bản ghi phân công thủ công
 * thành bảng Sheet 1: Quản lý (Name | KV | Level | Tham gia | Hoàn thành).
 */
export function buildLmsManagementRows(params: {
  viewer: UserAccount | null;
  cmsProfiles: EduCmsProfile[];
  assignments: EduTopicAssignment[];
  topics?: EduWeeklyTopic[];
  filters?: LmsManagementFilters;
}): LmsManagementRow[] {
  const { viewer, cmsProfiles, assignments, topics = [], filters = {} } = params;
  if (!viewer) return [];

  const weekFilter = filters.weekFilter || 'ALL';
  const topicIdFilter = filters.topicIdFilter || 'ALL';
  const companyFilter = filters.companyFilter || 'ALL';
  const areaFilter = filters.areaFilter || 'ALL';
  const levelFilter = filters.levelFilter || 'ALL';
  const searchQuery = normalizeEduText(filters.searchQuery);

  const selectedTopic =
    topicIdFilter !== 'ALL' ? topics.find((t) => t.id === topicIdFilter) || null : null;

  const matchesOrgAndLevel = (item: {
    companyCode?: string;
    areaCode?: string;
    level: EduTrack;
    name: string;
  }): boolean => {
    if (companyFilter !== 'ALL' && normalizeOrgCode(item.companyCode) !== normalizeOrgCode(companyFilter)) {
      return false;
    }
    if (areaFilter !== 'ALL' && normalizeOrgCode(item.areaCode) !== normalizeOrgCode(areaFilter)) {
      return false;
    }
    if (levelFilter !== 'ALL' && item.level !== levelFilter) {
      return false;
    }
    if (selectedTopic) {
      if (selectedTopic.track !== item.level) return false;
      if (
        selectedTopic.companyCode !== 'ALL' &&
        normalizeOrgCode(selectedTopic.companyCode) !== normalizeOrgCode(item.companyCode)
      ) {
        return false;
      }
      if (
        selectedTopic.areaCode !== 'ALL' &&
        normalizeOrgCode(selectedTopic.areaCode) !== normalizeOrgCode(item.areaCode)
      ) {
        return false;
      }
    }
    if (searchQuery) {
      const hay = `${item.name} ${item.companyCode || ''} ${item.areaCode || ''} ${
        EDU_TRACK_LABELS[item.level]
      }`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  };

  // 1. Lọc danh sách assignments theo quyền + thời gian + bộ lọc
  const scopedAssignments = assignments.filter((a) => {
    if (
      !canViewEduRecord(viewer, {
        companyCode: a.companyCode,
        areaCode: a.areaCode,
        assignedByUid: a.assignedByUid,
        memberId: a.memberId,
      })
    ) {
      return false;
    }
    if (topicIdFilter !== 'ALL' && a.topicId !== topicIdFilter) return false;
    if (weekFilter !== 'ALL' && a.weekLabel !== weekFilter) return false;
    return matchesOrgAndLevel({
      companyCode: a.companyCode,
      areaCode: a.areaCode,
      level: a.track,
      name: a.studentName,
    });
  });

  // 2. Lọc danh sách CMS trong phạm vi xem & bộ lọc
  const scopedCms = cmsProfiles.filter((p) => {
    if (
      !canViewEduRecord(viewer, {
        companyCode: p.companyCode,
        areaCode: p.areaCode,
        ownerUid: p.ownerUid,
      })
    ) {
      return false;
    }
    return matchesOrgAndLevel({
      companyCode: p.companyCode,
      areaCode: p.areaCode,
      level: p.stage,
      name: p.fullName,
    });
  });

  const consumedAssignmentIds = new Set<string>();
  const rows: LmsManagementRow[] = [];

  // 3. Nạp sẵn toàn bộ nhân sự CMS và đối chiếu trạng thái Tham gia / Hoàn thành
  for (const profile of scopedCms) {
    const pName = normalizeEduText(profile.fullName);
    const pArea = normalizeOrgCode(profile.areaCode);
    const pComp = normalizeOrgCode(profile.companyCode);

    const matched = scopedAssignments.filter((a) => {
      if (a.cmsProfileId && a.cmsProfileId === profile.id) return true;
      const sameName = normalizeEduText(a.studentName) === pName;
      const sameArea = normalizeOrgCode(a.areaCode) === pArea;
      const sameComp = !pComp || !a.companyCode || normalizeOrgCode(a.companyCode) === pComp;
      const sameLevel = a.track === profile.stage;
      return sameName && sameArea && sameComp && sameLevel;
    });

    matched.forEach((m) => consumedAssignmentIds.add(m.id));

    const sortedMatched = [...matched].sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
    const primary = sortedMatched[0];
    const completed = matched.some(isAssignmentCompleted);
    const participated = completed || matched.some(isAssignmentParticipated);

    rows.push({
      rowKey: `cms_${profile.id}`,
      source: primary ? 'CMS_LINKED' : 'CMS_AUTO',
      name: profile.fullName,
      companyCode: profile.companyCode,
      areaCode: profile.areaCode,
      level: profile.stage,
      participated,
      completed,
      cmsProfileId: profile.id,
      assignment: primary,
      note: primary?.note || profile.note || '',
    });
  }

  // 4. Các dòng thêm thủ công (chưa có trong CMS) -> gộp theo người + KV + Level để không trùng đếm SL
  const manualGroups = new Map<string, EduTopicAssignment[]>();
  for (const a of scopedAssignments) {
    if (consumedAssignmentIds.has(a.id)) continue;
    const key = `${normalizeOrgCode(a.companyCode)}|${normalizeOrgCode(a.areaCode)}|${a.track}|${normalizeEduText(
      a.studentName
    )}`;
    const list = manualGroups.get(key) || [];
    list.push(a);
    manualGroups.set(key, list);
  }

  manualGroups.forEach((group, key) => {
    const sorted = [...group].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const primary = sorted[0];
    const completed = group.some(isAssignmentCompleted);
    const participated = completed || group.some(isAssignmentParticipated);

    rows.push({
      rowKey: `manual_${primary.id || key}`,
      source: 'MANUAL',
      name: primary.studentName,
      companyCode: primary.companyCode,
      areaCode: primary.areaCode,
      level: primary.track,
      participated,
      completed,
      cmsProfileId: primary.cmsProfileId,
      assignment: primary,
      note: primary.note || '',
    });
  });

  // 5. Sắp xếp: Level (TĐM -> TĐ1 -> TĐ2 -> NGV) -> Sion -> KV -> Họ tên
  const levelRank = (lv: EduTrack): number => {
    const idx = EDU_TRACK_ORDER.indexOf(lv);
    return idx >= 0 ? idx : 99;
  };

  rows.sort((a, b) => {
    const lr = levelRank(a.level) - levelRank(b.level);
    if (lr !== 0) return lr;
    const compCmp = (a.companyCode || '').localeCompare(b.companyCode || '', 'vi');
    if (compCmp !== 0) return compCmp;
    const areaCmp = (a.areaCode || '').localeCompare(b.areaCode || '', 'vi', { numeric: true });
    if (areaCmp !== 0) return areaCmp;
    return a.name.localeCompare(b.name, 'vi');
  });

  return rows;
}

/**
 * Tính bảng Sheet 2: Phân tích theo 4 Level (TĐM, TĐ1, TĐ2, NGV) + Tổng cộng
 * Chấm 2 cột Đánh giá riêng cho Tham gia (%) và Hoàn thành (%).
 */
export function buildLmsAnalyticsSummary(rows: LmsManagementRow[]): {
  levelRows: LmsLevelAnalyticsRow[];
  totalRow: LmsLevelAnalyticsRow;
} {
  const levelRows: LmsLevelAnalyticsRow[] = EDU_TRACK_ORDER.map((lv) => {
    const subset = rows.filter((r) => r.level === lv);
    const totalCount = subset.length;
    const participatedCount = subset.filter((r) => r.participated).length;
    const completedCount = subset.filter((r) => r.completed).length;
    const participatedRate = calcRate(participatedCount, totalCount);
    const completedRate = calcRate(completedCount, totalCount);

    return {
      level: lv,
      label: EDU_TRACK_LABELS[lv],
      totalCount,
      participatedCount,
      participatedRate,
      participatedRating: getEduRating(participatedRate),
      completedCount,
      completedRate,
      completedRating: getEduRating(completedRate),
    };
  });

  const totalCount = rows.length;
  const participatedCount = rows.filter((r) => r.participated).length;
  const completedCount = rows.filter((r) => r.completed).length;
  const participatedRate = calcRate(participatedCount, totalCount);
  const completedRate = calcRate(completedCount, totalCount);

  const totalRow: LmsLevelAnalyticsRow = {
    level: 'TOTAL',
    label: 'Tổng cộng',
    totalCount,
    participatedCount,
    participatedRate,
    participatedRating: getEduRating(participatedRate),
    completedCount,
    completedRate,
    completedRating: getEduRating(completedRate),
  };

  return { levelRows, totalRow };
}

/**
 * Bảng phân tích bổ sung theo từng Khu vực (KV) trong phạm vi đang lọc.
 */
export function buildLmsAreaAnalytics(rows: LmsManagementRow[]): LmsAreaAnalyticsRow[] {
  const map = new Map<string, { companyCode: string; areaCode: string; items: LmsManagementRow[] }>();
  for (const r of rows) {
    const comp = r.companyCode || '—';
    const area = r.areaCode || '—';
    const key = `${normalizeOrgCode(comp)}|${normalizeOrgCode(area)}`;
    const bucket = map.get(key) || { companyCode: comp, areaCode: area, items: [] };
    bucket.items.push(r);
    map.set(key, bucket);
  }

  const result: LmsAreaAnalyticsRow[] = [];
  map.forEach(({ companyCode, areaCode, items }) => {
    const totalCount = items.length;
    const participatedCount = items.filter((i) => i.participated).length;
    const completedCount = items.filter((i) => i.completed).length;
    const participatedRate = calcRate(participatedCount, totalCount);
    const completedRate = calcRate(completedCount, totalCount);

    result.push({
      companyCode,
      areaCode,
      totalCount,
      participatedCount,
      participatedRate,
      participatedRating: getEduRating(participatedRate),
      completedCount,
      completedRate,
      completedRating: getEduRating(completedRate),
    });
  });

  return result.sort((a, b) => {
    const compCmp = a.companyCode.localeCompare(b.companyCode, 'vi');
    if (compCmp !== 0) return compCmp;
    return a.areaCode.localeCompare(b.areaCode, 'vi', { numeric: true });
  });
}
