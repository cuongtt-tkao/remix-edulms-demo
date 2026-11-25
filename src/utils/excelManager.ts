import * as XLSX from 'xlsx';
import {
  Company,
  Area,
  Department,
  OrgCluster,
  Member,
  UserAccount,
  DiscipleRecord,
  DISCIPLE_PROGRESS_STEPS,
  ROLE_DISPLAY_META,
  DEFAULT_DAILY_GOALS,
  EduWeeklyTopic,
  EduTopicAssignment,
  EduCmsProfile,
  EDU_TRACK_LABELS,
  EDU_CMS_STAGE_LABELS,
  EDU_ASSIGNMENT_STATUS_LABELS,
} from '../types/edulms';

import {
  canManageOrgRecord,
  canModifyDiscipleRecord,
  canViewEduRecord,
  canViewMemberDetail,
  isAdminRole,
  isMemberInManagerCluster,
  normalizeOrgCode,
} from './rbac';

function getDateStamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now
    .getDate()
    .toString()
    .padStart(2, '0')}`;
}

function getSafeRoleBadge(viewer?: UserAccount | null): string {
  if (!viewer) return '';
  const badge = ROLE_DISPLAY_META[viewer.role]?.codeBadge || viewer.role;
  return badge.replace(/[^a-zA-Z0-9]/g, '') || viewer.role;
}

function formatUserManagedScope(u?: UserAccount): string {
  if (!u) return '';
  if (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') return 'Toàn hệ thống (HT)';
  if (u.role === 'MANAGER' || u.role === 'SION_LEADER') {
    const comps = u.managedCompanyCodes?.length ? u.managedCompanyCodes : [u.companyCode];
    return `Sion: ${comps.join(', ')}`;
  }
  if (u.role === 'AREA_LEADER') {
    const areas = u.managedAreaCodes?.length ? u.managedAreaCodes : [u.areaCode];
    return `KV: ${areas.join(', ')}`;
  }
  if (u.role === 'UNI_LEADER') {
    const units = u.managedUnitCodes?.length
      ? u.managedUnitCodes
      : u.unitCode
      ? [u.unitCode]
      : [];
    return units.length ? `Uni: ${units.join(', ')}` : u.departmentCode || '';
  }
  return 'Cá nhân';
}

function canExportMemberOrgRecord(viewer: UserAccount | null | undefined, m: Member): boolean {
  if (!viewer || isAdminRole(viewer.role)) return true;
  const ownMemberId = viewer.memberId || `m-${viewer.id}`;
  if (m.id === ownMemberId || m.id === viewer.id) return true;
  if (viewer.role === 'MANAGER') {
    return isMemberInManagerCluster(viewer, m) || canManageOrgRecord(viewer, m);
  }
  if (viewer.role === 'MEMBER') {
    return false;
  }
  return canManageOrgRecord(viewer, m) || canViewMemberDetail(viewer, m);
}

/**
 * 1. Xuất file Cấu hình Danh mục Hệ thống (.xlsx)
 * Bao gồm 4 Sheets: Sion - Công Ty, Khu Vực, Ban Ngành, Cụm Sion
 */
export function exportSystemConfigExcel(
  companies: Company[],
  areas: Area[],
  departments: Department[],
  clusters: OrgCluster[] = []
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Sion / Công ty
  const compRows = companies.map((c, i) => ({
    STT: i + 1,
    'Mã Sion': c.code,
    'Tên Sion': c.name,
    'Mô Tả': c.description || '',
    'Trạng Thái': c.active ? 'Hoạt động' : 'Tạm ngưng',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compRows), 'Sion - Công Ty');

  // Sheet 2: Khu vực
  const areaRows = areas.map((a, i) => ({
    STT: i + 1,
    'Mã Khu Vực': a.code,
    'Tên Khu Vực': a.name,
    'Mã Sion Trực Thuộc': a.companyCode,
    'Trạng Thái': a.active ? 'Hoạt động' : 'Tạm ngưng',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaRows), 'Khu Vực');

  // Sheet 3: Ban ngành
  const deptRows = departments.map((d, i) => ({
    STT: i + 1,
    'Mã Ban Ngành': d.code,
    'Tên Ban Ngành': d.name,
    'Trạng Thái': d.active ? 'Hoạt động' : 'Tạm ngưng',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptRows), 'Ban Ngành');

  // Sheet 4: Cụm Sion
  const clusterRows = clusters.map((cl, i) => ({
    STT: i + 1,
    'Mã Cụm': cl.code,
    'Tên Cụm': cl.name,
    'Danh Sách Sion': (cl.companyCodes || []).join(', '),
    'Tự Động Còn Lại': cl.isCatchAll ? 'Có' : 'Không',
    'Mô Tả': cl.description || '',
    'Trạng Thái': cl.active !== false ? 'Hoạt động' : 'Tạm ngưng',
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      clusterRows.length ? clusterRows : [{ 'Thông báo': 'Chưa có Cụm Sion' }]
    ),
    'Cụm Sion'
  );

  XLSX.writeFile(wb, `HanhThucLuc_DanhMuc_HeThong_${getDateStamp()}.xlsx`);
}

/**
 * 2. Xuất file Hồ sơ Cá nhân & Nhân sự Thi đua theo phân quyền 7 cấp (.xlsx)
 * Đối chiếu members + usersList + disciples (Đội/Uni, Vai trò 7 cấp, 7 chỉ số Báo cáo hằng ngày, Thống kê MĐ)
 */
export function exportMembersAndTargetsExcel(
  members: Member[],
  usersList: UserAccount[] = [],
  disciples: DiscipleRecord[] = [],
  opts?: {
    viewer?: UserAccount | null;
    companyCode?: string;
    areaCode?: string;
    memberId?: string;
  }
): { membersCount: number; fileName: string } {
  const wb = XLSX.utils.book_new();
  const viewer = opts?.viewer;

  const scopedMembers = members.filter((m) => {
    if (viewer && !canExportMemberOrgRecord(viewer, m)) return false;
    if (opts?.companyCode && opts.companyCode !== 'ALL') {
      if (normalizeOrgCode(m.companyCode) !== normalizeOrgCode(opts.companyCode)) return false;
    }
    if (opts?.areaCode && opts.areaCode !== 'ALL') {
      if (normalizeOrgCode(m.areaCode) !== normalizeOrgCode(opts.areaCode)) return false;
    }
    if (opts?.memberId && opts.memberId !== 'ALL') {
      const targetId = opts.memberId;
      if (m.id !== targetId && m.id !== `m-${targetId}`) return false;
    }
    return true;
  });

  const scopedDisciples = viewer && !isAdminRole(viewer.role)
    ? disciples.filter((d) => canModifyDiscipleRecord(viewer, d))
    : disciples;

  const userByMemberId = new Map<string, UserAccount>();
  const userByName = new Map<string, UserAccount>();
  usersList.forEach((u) => {
    if (u.memberId) userByMemberId.set(u.memberId, u);
    userByMemberId.set(`m-${u.id}`, u);
    if (u.fullName) userByName.set(u.fullName.trim().toLowerCase(), u);
  });

  // Thống kê MĐ theo ownerMemberId hoặc ownerUid
  const discipleCountMap = new Map<string, { total: number; active: number; stopped: number }>();
  scopedDisciples.forEach((d) => {
    const keys = [d.ownerMemberId, d.ownerUid ? `m-${d.ownerUid}` : ''].filter(Boolean);
    const progressArr = Array.isArray(d.progress) ? d.progress : [];
    const isStopped = Boolean(d.isStopped || progressArr.includes('Dừng'));
    keys.forEach((k) => {
      const cur = discipleCountMap.get(k) || { total: 0, active: 0, stopped: 0 };
      cur.total += 1;
      if (isStopped) cur.stopped += 1;
      else cur.active += 1;
      discipleCountMap.set(k, cur);
    });
  });

  const sortedMembers = [...scopedMembers].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Sheet 1: Hồ Sơ & Thi Đua TV
  const memberRows = sortedMembers.map((m, i) => {
    const linkedUser =
      userByMemberId.get(m.id) || userByName.get((m.fullName || '').trim().toLowerCase());
    const roleMeta = linkedUser ? ROLE_DISPLAY_META[linkedUser.role] : ROLE_DISPLAY_META.MEMBER;
    const dStats = discipleCountMap.get(m.id) || { total: 0, active: 0, stopped: 0 };
    const dr = m.dailyResults;

    return {
      STT: i + 1,
      'Mã TV': m.code,
      'Họ và Tên': m.fullName,
      Username: linkedUser?.username || '',
      Email: linkedUser?.email || '',
      'Vai Trò (7 cấp)': roleMeta?.label || 'Thành viên (TĐ)',
      'Phạm Vi Quản Lý': formatUserManagedScope(linkedUser),
      Sion: m.companyCode,
      'Khu Vực': m.areaCode,
      'Ban Ngành': m.departmentCode,
      'Đội / Uni': m.unitCode || linkedUser?.unitCode || '',
      Hạng: m.rank || i + 1,
      'Tổng Điểm': m.score || 0,
      KN: dr?.kn || 0,
      Thăm: dr?.tham || 0,
      GM: dr?.gm || 0,
      ĐT: dr?.dt || 0,
      HH: dr?.hh || 0,
      KT: dr?.kt || 0,
      'WS New': dr?.wsNew || 0,
      'MĐ Đang Theo': dStats.active,
      'Tổng MĐ': dStats.total,
      'Trạng Thái': m.active ? 'Hoạt động' : 'Tạm ngưng',
      'Ngày Tham Gia': m.createdAt || '',
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      memberRows.length ? memberRows : [{ 'Thông báo': 'Chưa có nhân sự trong phạm vi phân quyền' }]
    ),
    'Hồ Sơ & Thi Đua TV'
  );

  // Sheet 2: Tổng hợp theo Sion & Khu vực
  const areaGroupMap = new Map<
    string,
    {
      companyCode: string;
      areaCode: string;
      count: number;
      totalScore: number;
      kn: number;
      tham: number;
      gm: number;
      dt: number;
      hh: number;
      kt: number;
      wsNew: number;
      activeMd: number;
      totalMd: number;
    }
  >();

  sortedMembers.forEach((m) => {
    const key = `${m.companyCode}__${m.areaCode}`;
    const dStats = discipleCountMap.get(m.id) || { total: 0, active: 0, stopped: 0 };
    const dr = m.dailyResults;
    const cur = areaGroupMap.get(key) || {
      companyCode: m.companyCode,
      areaCode: m.areaCode,
      count: 0,
      totalScore: 0,
      kn: 0,
      tham: 0,
      gm: 0,
      dt: 0,
      hh: 0,
      kt: 0,
      wsNew: 0,
      activeMd: 0,
      totalMd: 0,
    };
    cur.count += 1;
    cur.totalScore += m.score || 0;
    cur.kn += dr?.kn || 0;
    cur.tham += dr?.tham || 0;
    cur.gm += dr?.gm || 0;
    cur.dt += dr?.dt || 0;
    cur.hh += dr?.hh || 0;
    cur.kt += dr?.kt || 0;
    cur.wsNew += dr?.wsNew || 0;
    cur.activeMd += dStats.active;
    cur.totalMd += dStats.total;
    areaGroupMap.set(key, cur);
  });

  const summaryRows = Array.from(areaGroupMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((g, idx) => ({
      STT: idx + 1,
      Sion: g.companyCode,
      'Khu Vực': g.areaCode,
      'Số Thành Viên': g.count,
      'Tổng Điểm': g.totalScore,
      'Điểm TB': g.count > 0 ? Math.round(g.totalScore / g.count) : 0,
      KN: g.kn,
      Thăm: g.tham,
      GM: g.gm,
      ĐT: g.dt,
      HH: g.hh,
      KT: g.kt,
      'WS New': g.wsNew,
      'MĐ Đang Theo': g.activeMd,
      'Tổng MĐ': g.totalMd,
    }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summaryRows.length ? summaryRows : [{ 'Thông báo': 'Chưa có dữ liệu tổng hợp theo khu vực' }]
    ),
    'Tổng Hợp Sion & KV'
  );

  const badgeSuffix = viewer && !isAdminRole(viewer.role) ? `_${getSafeRoleBadge(viewer)}` : '';
  const fileName = `HanhThucLuc_HoSo_NhanSu${badgeSuffix}_${getDateStamp()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return { membersCount: sortedMembers.length, fileName };
}

/**
 * 3. Xuất Danh sách MĐ theo phân quyền 7 cấp (.xlsx)
 * Bao gồm 2 Sheets: Tổng Hợp MĐ (theo Sion/KV/TĐ) và Chi Tiết Danh Sách MĐ (9 bước tiến độ)
 */
export function exportDisciplesExcel(
  disciples: DiscipleRecord[],
  opts?: {
    viewer?: UserAccount | null;
    companyCode?: string;
    areaCode?: string;
    ownerKey?: string;
    status?: 'ALL' | 'ACTIVE' | 'STOPPED';
  }
): { count: number; fileName: string } {
  const wb = XLSX.utils.book_new();
  const viewer = opts?.viewer;
  const compFilter = opts?.companyCode || 'ALL';
  const areaFilter = opts?.areaCode || 'ALL';
  const ownerFilter = opts?.ownerKey || 'ALL';
  const statusFilter = opts?.status || 'ALL';

  const filtered = disciples
    .filter((d) => {
      if (viewer && !isAdminRole(viewer.role) && !canModifyDiscipleRecord(viewer, d)) {
        return false;
      }
      if (
        compFilter !== 'ALL' &&
        normalizeOrgCode(d.companyCode) !== normalizeOrgCode(compFilter)
      ) {
        return false;
      }
      if (
        areaFilter !== 'ALL' &&
        normalizeOrgCode(d.areaCode) !== normalizeOrgCode(areaFilter)
      ) {
        return false;
      }
      if (ownerFilter !== 'ALL') {
        const matchesOwner =
          d.ownerUid === ownerFilter ||
          d.ownerMemberId === ownerFilter ||
          (d.ownerUid && `m-${d.ownerUid}` === ownerFilter);
        if (!matchesOwner) return false;
      }
      const progressArr = Array.isArray(d.progress) ? d.progress : [];
      const stopped = Boolean(d.isStopped || progressArr.includes('Dừng'));
      if (statusFilter === 'ACTIVE' && stopped) return false;
      if (statusFilter === 'STOPPED' && !stopped) return false;
      return true;
    })
    .sort((a, b) => {
      const cCmp = (a.companyCode || '').localeCompare(b.companyCode || '');
      if (cCmp !== 0) return cCmp;
      const aCmp = (a.areaCode || '').localeCompare(b.areaCode || '');
      if (aCmp !== 0) return aCmp;
      return (a.ownerName || '').localeCompare(b.ownerName || '');
    });

  // Sheet 1: Tổng hợp MĐ theo Sion / KV / Người phụ trách
  const ownerMap = new Map<
    string,
    {
      companyCode: string;
      areaCode: string;
      unitCode: string;
      ownerName: string;
      total: number;
      active: number;
      stopped: number;
      kn: number;
      tham: number;
      com: number;
      gm: number;
      dt: number;
      hh: number;
      kt: number;
      ws: number;
    }
  >();

  filtered.forEach((d) => {
    const progressArr = Array.isArray(d.progress) ? d.progress : [];
    const key = `${d.companyCode}__${d.areaCode}__${d.ownerUid || d.ownerName}`;
    const stopped = Boolean(d.isStopped || progressArr.includes('Dừng'));
    const cur = ownerMap.get(key) || {
      companyCode: d.companyCode || '',
      areaCode: d.areaCode || '',
      unitCode: d.ownerUnitCode || '',
      ownerName: d.ownerName || '',
      total: 0,
      active: 0,
      stopped: 0,
      kn: 0,
      tham: 0,
      com: 0,
      gm: 0,
      dt: 0,
      hh: 0,
      kt: 0,
      ws: 0,
    };
    cur.total += 1;
    if (stopped) cur.stopped += 1;
    else cur.active += 1;
    if (progressArr.includes('KN')) cur.kn += 1;
    if (progressArr.includes('Thăm')) cur.tham += 1;
    if (progressArr.includes('Ăn Cơm')) cur.com += 1;
    if (progressArr.includes('GM')) cur.gm += 1;
    if (progressArr.includes('ĐT')) cur.dt += 1;
    if (progressArr.includes('HH')) cur.hh += 1;
    if (progressArr.includes('KT')) cur.kt += 1;
    if (progressArr.includes('WS')) cur.ws += 1;
    ownerMap.set(key, cur);
  });

  const summaryRows = Array.from(ownerMap.values()).map((g, idx) => ({
    STT: idx + 1,
    Sion: g.companyCode,
    'Khu Vực': g.areaCode,
    'Đội / Uni': g.unitCode,
    'Người Phụ Trách': g.ownerName,
    'Tổng MĐ': g.total,
    'Đang Theo': g.active,
    'Đã Dừng': g.stopped,
    KN: g.kn,
    Thăm: g.tham,
    'Ăn Cơm': g.com,
    GM: g.gm,
    ĐT: g.dt,
    HH: g.hh,
    KT: g.kt,
    WS: g.ws,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summaryRows.length
        ? summaryRows
        : [{ 'Thông báo': 'Chưa có danh sách MĐ trong phạm vi / bộ lọc đã chọn' }]
    ),
    'Tổng Hợp MĐ'
  );

  // Sheet 2: Chi tiết Danh sách MĐ
  const detailRows = filtered.map((d, idx) => {
    const progressArr = Array.isArray(d.progress) ? d.progress : [];
    const stopped = Boolean(d.isStopped || progressArr.includes('Dừng'));
    const ageLabel =
      d.ageMode === 'EXACT' && d.exactAge
        ? `${d.exactAge} tuổi (${d.ageRange})`
        : `Khoảng ${d.ageRange}`;

    const activeSteps = DISCIPLE_PROGRESS_STEPS.filter(
      (st) => !st.isStop && progressArr.includes(st.key)
    ).map((st) => st.label);
    const highestStep = activeSteps.length ? activeSteps[activeSteps.length - 1] : 'Chưa có';

    return {
      STT: idx + 1,
      'Biệt Danh MĐ': d.nickname,
      'Độ Tuổi': ageLabel,
      'Công Việc': d.job || '',
      'Đặc Điểm': d.traits || '',
      'Trạng Thái': stopped ? 'Đã dừng' : 'Đang theo',
      'Bước Cao Nhất': highestStep,
      KN: progressArr.includes('KN') ? 'X' : '',
      Thăm: progressArr.includes('Thăm') ? 'X' : '',
      'Ăn Cơm': progressArr.includes('Ăn Cơm') ? 'X' : '',
      GM: progressArr.includes('GM') ? 'X' : '',
      ĐT: progressArr.includes('ĐT') ? 'X' : '',
      HH: progressArr.includes('HH') ? 'X' : '',
      KT: progressArr.includes('KT') ? 'X' : '',
      WS: progressArr.includes('WS') ? 'X' : '',
      Dừng: stopped ? 'X' : '',
      'Ghi Chú Chăm Sóc': d.statusNote || '',
      'Người Phụ Trách': d.ownerName || '',
      Sion: d.companyCode || '',
      'Khu Vực': d.areaCode || '',
      'Đội / Uni': d.ownerUnitCode || '',
      'Ngày Cập Nhật': (d.updatedAt || d.createdAt || '').slice(0, 10),
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      detailRows.length
        ? detailRows
        : [{ 'Thông báo': 'Chưa có hồ sơ MĐ trong phạm vi / bộ lọc đã chọn' }]
    ),
    'Chi Tiết Danh Sách MĐ'
  );

  const suffixComp =
    compFilter !== 'ALL'
      ? compFilter
      : viewer && !isAdminRole(viewer.role)
      ? viewer.role === 'MEMBER'
        ? 'CaNhan'
        : getSafeRoleBadge(viewer)
      : 'ToanHT';
  const suffixArea = areaFilter !== 'ALL' ? `_KV${areaFilter}` : '';
  const suffixStatus =
    statusFilter === 'ACTIVE' ? '_DangTheo' : statusFilter === 'STOPPED' ? '_DaDung' : '';
  const fileName = `HanhThucLuc_DanhSach_MD_${suffixComp}${suffixArea}${suffixStatus}_${getDateStamp()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return { count: filtered.length, fileName };
}

/**
 * 4. Xuất dữ liệu Edu (LMS Chủ đề tuần & Phân công + CMS Lộ trình & NGV) theo phân quyền 7 cấp (.xlsx)
 */
export function exportEduDataExcel(
  topics: EduWeeklyTopic[],
  assignments: EduTopicAssignment[],
  cmsProfiles: EduCmsProfile[],
  opts?: { viewer?: UserAccount | null; companyCode?: string; areaCode?: string }
): { topicsCount: number; assignmentsCount: number; cmsCount: number; fileName: string } {
  const wb = XLSX.utils.book_new();
  const viewer = opts?.viewer;
  const compFilter = opts?.companyCode || 'ALL';
  const areaFilter = opts?.areaCode || 'ALL';

  const canAccessTopic = (t: EduWeeklyTopic): boolean => {
    if (!viewer || isAdminRole(viewer.role)) return true;
    if (t.companyCode === 'ALL') return true;
    if (t.areaCode === 'ALL' || !t.areaCode) {
      return canManageOrgRecord(viewer, { companyCode: t.companyCode, areaCode: viewer.areaCode });
    }
    return canViewEduRecord(viewer, { companyCode: t.companyCode, areaCode: t.areaCode });
  };

  const filteredTopics = topics
    .filter(
      (t) =>
        canAccessTopic(t) &&
        (compFilter === 'ALL' ||
          t.companyCode === 'ALL' ||
          normalizeOrgCode(t.companyCode) === normalizeOrgCode(compFilter)) &&
        (areaFilter === 'ALL' ||
          !t.areaCode ||
          t.areaCode === 'ALL' ||
          normalizeOrgCode(t.areaCode) === normalizeOrgCode(areaFilter))
    )
    .sort((a, b) => b.year - a.year || b.weekNumber - a.weekNumber);

  const filteredAssignments = assignments
    .filter(
      (a) =>
        (!viewer ||
          canViewEduRecord(viewer, {
            companyCode: a.companyCode,
            areaCode: a.areaCode,
            assignedByUid: a.assignedByUid,
            memberId: a.memberId,
          })) &&
        (compFilter === 'ALL' || normalizeOrgCode(a.companyCode) === normalizeOrgCode(compFilter)) &&
        (areaFilter === 'ALL' || normalizeOrgCode(a.areaCode) === normalizeOrgCode(areaFilter))
    )
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const filteredCms = cmsProfiles
    .filter(
      (c) =>
        (!viewer ||
          canViewEduRecord(viewer, {
            companyCode: c.companyCode,
            areaCode: c.areaCode,
            ownerUid: c.ownerUid,
          })) &&
        (compFilter === 'ALL' || normalizeOrgCode(c.companyCode) === normalizeOrgCode(compFilter)) &&
        (areaFilter === 'ALL' || normalizeOrgCode(c.areaCode) === normalizeOrgCode(areaFilter))
    )
    .sort((a, b) => (a.companyCode || '').localeCompare(b.companyCode || ''));

  // Sheet 1: LMS Chủ Đề Tuần
  const topicRows = filteredTopics.map((t, idx) => ({
    STT: idx + 1,
    Tuần: t.weekLabel,
    'Từ Ngày': t.startDate,
    'Đến Ngày': t.endDate,
    'Lộ Trình': EDU_TRACK_LABELS[t.track] || t.track,
    Sion: t.companyCode === 'ALL' ? 'Toàn hệ thống' : t.companyCode,
    'Khu Vực': t.areaCode === 'ALL' ? 'Tất cả KV' : t.areaCode,
    'Tên Chủ Đề': t.topicTitle,
    'Tóm Tắt': t.summary || '',
    'Mục Tiêu Bài Học': t.learningObjectives || '',
    'Nội Dung Giáo Trình': t.curriculumContent || '',
    'Tài Liệu Tham Khảo': t.referenceLinks || '',
    'Người Tạo': t.createdBy || '',
    'Cập Nhật': (t.updatedAt || '').slice(0, 10),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      topicRows.length ? topicRows : [{ 'Thông báo': 'Chưa có chủ đề tuần trong phạm vi đã chọn' }]
    ),
    'LMS Chủ Đề Tuần'
  );

  // Sheet 2: LMS Phân Công TĐ
  const assignRows = filteredAssignments.map((a, idx) => ({
    STT: idx + 1,
    Tuần: a.weekLabel,
    'Lộ Trình': EDU_TRACK_LABELS[a.track] || a.track,
    'Chủ Đề': a.topicTitle,
    Sion: a.companyCode,
    'Khu Vực': a.areaCode,
    'Tên TĐ': a.studentName,
    'Trạng Thái': EDU_ASSIGNMENT_STATUS_LABELS[a.status] || a.status,
    'Người Gán': a.assignedByName,
    'Ghi Chú': a.note || '',
    'Cập Nhật': (a.updatedAt || '').slice(0, 10),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      assignRows.length ? assignRows : [{ 'Thông báo': 'Chưa có dữ liệu phân công TĐ trong phạm vi' }]
    ),
    'LMS Phân Công TĐ'
  );

  // Sheet 3: CMS Lộ Trình & NGV
  const cmsRows = filteredCms.map((c, idx) => ({
    STT: idx + 1,
    'Họ và Tên': c.fullName,
    Sion: c.companyCode,
    'Khu Vực': c.areaCode,
    'Cấp Độ': EDU_CMS_STAGE_LABELS[c.stage] || c.stage,
    'NGV Phụ Trách': c.ngvName || '',
    'Chuyên Môn / Lĩnh Vực': c.specialty || '',
    'Chủ Đề Hiện Tại': c.currentTopicTitle || '',
    'Ghi Chú': c.note || '',
    'Cập Nhật': (c.updatedAt || '').slice(0, 10),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      cmsRows.length ? cmsRows : [{ 'Thông báo': 'Chưa có hồ sơ CMS trong phạm vi đã chọn' }]
    ),
    'CMS Lộ Trình & NGV'
  );

  const suffix =
    compFilter !== 'ALL'
      ? compFilter
      : viewer && !isAdminRole(viewer.role)
      ? getSafeRoleBadge(viewer)
      : 'ToanHT';
  const fileName = `HanhThucLuc_Edu_LMS_CMS_${suffix}_${getDateStamp()}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return {
    topicsCount: filteredTopics.length,
    assignmentsCount: filteredAssignments.length,
    cmsCount: filteredCms.length,
    fileName,
  };
}

/**
 * 5. Tải file Mẫu Cấu hình Danh mục (.xlsx)
 */
export function downloadConfigTemplateExcel(): void {
  const wb = XLSX.utils.book_new();

  const compSample = [
    { 'Mã Sion': 'Th1', 'Tên Sion': 'Thành phố 1', 'Mô Tả': 'Đơn vị KV phía Đông', 'Trạng Thái': 'Hoạt động' },
    { 'Mã Sion': 'Th2', 'Tên Sion': 'Thành phố 2', 'Mô Tả': 'Đơn vị KV trung tâm', 'Trạng Thái': 'Hoạt động' },
    { 'Mã Sion': 'HT', 'Tên Sion': 'Hà Tĩnh', 'Mô Tả': 'Đơn vị chi nhánh tỉnh', 'Trạng Thái': 'Hoạt động' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compSample), 'Sion - Công Ty');

  const areaSample = [
    { 'Mã Khu Vực': '1.1', 'Tên Khu Vực': 'Khu vực 1.1', 'Mã Sion Trực Thuộc': 'Th1', 'Trạng Thái': 'Hoạt động' },
    { 'Mã Khu Vực': '1.2', 'Tên Khu Vực': 'Khu vực 1.2', 'Mã Sion Trực Thuộc': 'Th1', 'Trạng Thái': 'Hoạt động' },
    { 'Mã Khu Vực': '2.1', 'Tên Khu Vực': 'Khu vực 2.1', 'Mã Sion Trực Thuộc': 'Th2', 'Trạng Thái': 'Hoạt động' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaSample), 'Khu Vực');

  const deptSample = [
    { 'Mã Ban Ngành': 'Tráng Niên', 'Tên Ban Ngành': 'Tráng Niên', 'Trạng Thái': 'Hoạt động' },
    { 'Mã Ban Ngành': 'Phụ Nữ', 'Tên Ban Ngành': 'Phụ Nữ', 'Trạng Thái': 'Hoạt động' },
    { 'Mã Ban Ngành': 'Thanh Niên Nam', 'Tên Ban Ngành': 'Thanh Niên Nam', 'Trạng Thái': 'Hoạt động' },
    { 'Mã Ban Ngành': 'Thanh Niên Nữ', 'Tên Ban Ngành': 'Thanh Niên Nữ', 'Trạng Thái': 'Hoạt động' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptSample), 'Ban Ngành');

  XLSX.writeFile(wb, 'HanhThucLuc_Mau_DanhMuc_HeThong.xlsx');
}

/**
 * 6. Tải file Mẫu Danh sách Thành viên theo cấu trúc mới (.xlsx)
 */
export function downloadMembersTemplateExcel(): void {
  const wb = XLSX.utils.book_new();

  const membersSample = [
    {
      'Mã TV': 'MEM-001',
      'Họ và Tên': 'Nguyễn Văn An',
      Sion: 'Th1',
      'Khu Vực': '1.1',
      'Ban Ngành': 'Thanh Niên Nam',
      'Đội / Uni': 'Uni 1',
      'MT KN': DEFAULT_DAILY_GOALS.kn,
      'MT Thăm': DEFAULT_DAILY_GOALS.tham,
      'MT GM': DEFAULT_DAILY_GOALS.gm,
      'MT ĐT': DEFAULT_DAILY_GOALS.dt,
      'MT HH': DEFAULT_DAILY_GOALS.hh,
      'MT KT': DEFAULT_DAILY_GOALS.kt,
      'MT WS New': DEFAULT_DAILY_GOALS.wsNew,
      'Trạng Thái': 'Hoạt động',
    },
    {
      'Mã TV': 'MEM-002',
      'Họ và Tên': 'Trần Thị Bình',
      Sion: 'Th1',
      'Khu Vực': '1.2',
      'Ban Ngành': 'Phụ Nữ',
      'Đội / Uni': 'Uni 2',
      'MT KN': 6,
      'MT Thăm': 2,
      'MT GM': 1,
      'MT ĐT': 2,
      'MT HH': 2,
      'MT KT': 1,
      'MT WS New': 1,
      'Trạng Thái': 'Hoạt động',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membersSample), 'Thành Viên');

  XLSX.writeFile(wb, 'HanhThucLuc_Mau_Danh_Sach_Thanh_Vien.xlsx');
}

/**
 * 7. Đọc & Kiểm tra file Cấu hình Hệ thống tải lên
 */
export async function parseConfigExcel(file: File): Promise<{
  companies: Company[];
  areas: Area[];
  departments: Department[];
  errors: string[];
}> {
  const errors: string[] = [];
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const parsedCompanies: Company[] = [];
  const parsedAreas: Area[] = [];
  const parsedDepartments: Department[] = [];

  // 1. Sheet Sion / Công ty
  const compSheetName =
    wb.SheetNames.find((s) => /sion|công ty|companies|cty/i.test(s)) || wb.SheetNames[0];
  if (compSheetName && wb.Sheets[compSheetName]) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[compSheetName]);
    rows.forEach((r, idx) => {
      const code = String(
        r['Mã Sion'] || r['Ma Sion'] || r['Mã Công Ty'] || r['Ma Cong Ty'] || r['code'] || r['Code'] || ''
      ).trim();
      const name = String(
        r['Tên Sion'] || r['Ten Sion'] || r['Tên Công Ty'] || r['Ten Cong Ty'] || r['name'] || r['Name'] || ''
      ).trim();
      const desc = String(r['Mô Tả'] || r['Mo Ta'] || r['description'] || '').trim();
      const statusStr = String(
        r['Trạng Thái'] || r['Trang Thai'] || r['active'] || 'Hoạt động'
      ).toLowerCase();
      const active =
        !statusStr.includes('tạm') && !statusStr.includes('ngưng') && !statusStr.includes('false');

      if (!code || !name) {
        errors.push(`[Sheet Sion/Công Ty - Hàng ${idx + 2}]: Thiếu mã hoặc tên Sion.`);
      } else {
        parsedCompanies.push({
          id: code.toLowerCase(),
          code,
          name,
          description: desc,
          active,
        });
      }
    });
  }

  // 2. Sheet Khu vực
  const areaSheetName = wb.SheetNames.find((s) => /khu vực|areas|kv/i.test(s));
  if (areaSheetName && wb.Sheets[areaSheetName]) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[areaSheetName]);
    rows.forEach((r, idx) => {
      const code = String(
        r['Mã Khu Vực'] || r['Ma Khu Vuc'] || r['code'] || r['Code'] || ''
      ).trim();
      const name = String(
        r['Tên Khu Vực'] || r['Ten Khu Vuc'] || r['name'] || r['Name'] || `Khu vực ${code}`
      ).trim();
      const compCode = String(
        r['Mã Sion Trực Thuộc'] ||
          r['Sion'] ||
          r['Mã Công Ty Trực Thuộc'] ||
          r['Công Ty'] ||
          r['companyCode'] ||
          ''
      ).trim();
      const statusStr = String(r['Trạng Thái'] || r['Trang Thai'] || 'Hoạt động').toLowerCase();
      const active =
        !statusStr.includes('tạm') && !statusStr.includes('ngưng') && !statusStr.includes('false');

      if (!code) {
        errors.push(`[Sheet Khu Vực - Hàng ${idx + 2}]: Thiếu mã khu vực.`);
      } else {
        parsedAreas.push({
          id: `area-${code.replace(/\./g, '-')}`,
          code,
          name: name || `Khu vực ${code}`,
          companyCode: compCode || 'Th1',
          active,
        });
      }
    });
  }

  // 3. Sheet Ban ngành
  const deptSheetName = wb.SheetNames.find((s) => /ban ngành|departments|ngành/i.test(s));
  if (deptSheetName && wb.Sheets[deptSheetName]) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[deptSheetName]);
    rows.forEach((r, idx) => {
      const code = String(r['Mã Ban Ngành'] || r['Ma Ban Nganh'] || r['code'] || '').trim();
      const name = String(r['Tên Ban Ngành'] || r['Ten Ban Nganh'] || r['name'] || code).trim();
      const statusStr = String(r['Trạng Thái'] || 'Hoạt động').toLowerCase();
      const active =
        !statusStr.includes('tạm') && !statusStr.includes('ngưng') && !statusStr.includes('false');

      if (!code && !name) {
        errors.push(`[Sheet Ban Ngành - Hàng ${idx + 2}]: Thiếu mã/tên ban ngành.`);
      } else {
        const finalCode = code || name;
        parsedDepartments.push({
          id: `dept-${finalCode.toLowerCase().replace(/\s+/g, '-')}`,
          code: finalCode,
          name: name || finalCode,
          active,
        });
      }
    });
  }

  return {
    companies: parsedCompanies,
    areas: parsedAreas,
    departments: parsedDepartments,
    errors,
  };
}

/**
 * 8. Đọc & Kiểm tra file Danh sách Thành viên tải lên (hỗ trợ cả cấu trúc mới & mẫu cũ)
 */
export async function parseMembersExcel(file: File): Promise<{
  members: Member[];
  errors: string[];
}> {
  const errors: string[] = [];
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const parsedMembers: Member[] = [];
  const memSheetName =
    wb.SheetNames.find((s) => /thành viên|hồ sơ|members|nhân sự/i.test(s)) || wb.SheetNames[0];

  if (memSheetName && wb.Sheets[memSheetName]) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[memSheetName]);
    rows.forEach((r, idx) => {
      const fullName = String(
        r['Họ và Tên'] || r['Họ Tên'] || r['fullName'] || r['Name'] || ''
      ).trim();
      const code = String(
        r['Mã TV'] || r['Ma TV'] || r['code'] || `MEM-${(idx + 1).toString().padStart(3, '0')}`
      ).trim();
      const companyCode = String(
        r['Sion'] || r['Công Ty'] || r['Cong Ty'] || r['companyCode'] || 'Th1'
      ).trim();
      const areaCode = String(r['Khu Vực'] || r['Khu Vuc'] || r['areaCode'] || '1.1').trim();
      const departmentCode = String(
        r['Ban Ngành'] || r['Ban Nganh'] || r['departmentCode'] || 'Thanh Niên Nam'
      ).trim();
      const unitCode = String(r['Đội / Uni'] || r['Doi / Uni'] || r['Uni'] || r['unitCode'] || '').trim();
      const statusStr = String(r['Trạng Thái'] || 'Hoạt động').toLowerCase();
      const active =
        !statusStr.includes('tạm') && !statusStr.includes('ngưng') && !statusStr.includes('false');

      if (!fullName) {
        errors.push(`[Hàng ${idx + 2}]: Thiếu họ và tên thành viên.`);
      } else {
        const dailyGoals = {
          kn: Number(r['MT KN'] ?? r['KN'] ?? DEFAULT_DAILY_GOALS.kn) || 0,
          tham: Number(r['MT Thăm'] ?? r['Thăm'] ?? DEFAULT_DAILY_GOALS.tham) || 0,
          gm: Number(r['MT GM'] ?? r['GM'] ?? DEFAULT_DAILY_GOALS.gm) || 0,
          dt: Number(r['MT ĐT'] ?? r['ĐT'] ?? DEFAULT_DAILY_GOALS.dt) || 0,
          hh: Number(r['MT HH'] ?? r['HH'] ?? DEFAULT_DAILY_GOALS.hh) || 0,
          kt: Number(r['MT KT'] ?? r['KT'] ?? DEFAULT_DAILY_GOALS.kt) || 0,
          wsNew: Number(r['MT WS New'] ?? r['WS New'] ?? DEFAULT_DAILY_GOALS.wsNew) || 0,
        };

        const goals = {
          s1: Number(r['Mục Tiêu B1'] || r['B1'] || 10),
          s2: Number(r['Mục Tiêu B2'] || r['B2'] || 8),
          s3: Number(r['Mục Tiêu B3'] || r['B3'] || 5),
          s4: Number(r['Mục Tiêu B4'] || r['B4'] || 3),
          s5: Number(r['Mục Tiêu B5'] || r['B5'] || 3),
          s6: Number(r['Mục Tiêu B6'] || r['B6'] || 2),
        };

        parsedMembers.push({
          id: code.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
          code,
          fullName,
          companyCode,
          areaCode,
          departmentCode,
          ...(unitCode ? { unitCode } : {}),
          active,
          score: 0,
          rank: idx + 1,
          goals,
          dailyGoals,
          results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
          targets: [],
          createdAt: new Date().toISOString().split('T')[0],
        });
      }
    });
  } else {
    errors.push('Không tìm thấy sheet danh sách thành viên trong file Excel.');
  }

  return {
    members: parsedMembers,
    errors,
  };
}
