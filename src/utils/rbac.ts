import {
  AreaRankItem,
  CompanyRankItem,
  DiscipleRecord,
  KpiSummary,
  Member,
  ROLE_DISPLAY_META,
  UserAccount,
  UserRole,
} from '../types/edulms';

export function normalizeOrgCode(code?: string | null): string {
  return (code || '').trim().toUpperCase();
}

export function getMemberUnitCode(record?: {
  unitCode?: string | null;
  departmentCode?: string | null;
}): string {
  return normalizeOrgCode(record?.unitCode || record?.departmentCode);
}

export function isAdminRole(role?: UserRole | null): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function isSupervisorRole(role?: UserRole | null): boolean {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'SION_LEADER' ||
    role === 'AREA_LEADER' ||
    role === 'UNI_LEADER'
  );
}

function resolveViewerCompanyScope(viewer: UserAccount): Set<string> {
  const set = new Set<string>();
  (viewer.managedCompanyCodes || []).forEach((c) => {
    const norm = normalizeOrgCode(c);
    if (norm) set.add(norm);
  });
  if (set.size === 0 && viewer.companyCode) {
    const norm = normalizeOrgCode(viewer.companyCode);
    if (norm) set.add(norm);
  }
  return set;
}

function resolveViewerAreaScope(viewer: UserAccount): Set<string> {
  const set = new Set<string>();
  (viewer.managedAreaCodes || []).forEach((a) => {
    const norm = normalizeOrgCode(a);
    if (norm) set.add(norm);
  });
  if (set.size === 0 && viewer.areaCode) {
    const norm = normalizeOrgCode(viewer.areaCode);
    if (norm) set.add(norm);
  }
  return set;
}

function resolveViewerUnitScope(viewer: UserAccount): Set<string> {
  const set = new Set<string>();
  (viewer.managedUnitCodes || []).forEach((u) => {
    const norm = normalizeOrgCode(u);
    if (norm) set.add(norm);
  });
  if (set.size === 0) {
    const own = getMemberUnitCode(viewer);
    if (own) set.add(own);
  }
  return set;
}

function isSelfMember(viewer: UserAccount, target: Member): boolean {
  const viewerMemberId = viewer.memberId || `m-${viewer.id}`;
  return target.id === viewerMemberId || target.id === viewer.id;
}

/**
 * Kiểm tra quyền xem chi tiết 7 chỉ số cá nhân / hồ sơ chi tiết của một thành viên
 * Lưu ý: Top 15 BXH chung hiển thị tên/điểm/hạng cho tất cả, nhưng chi tiết bên trong
 * chỉ mở được khi thuộc phạm vi quản lý hoặc là chính mình.
 */
export function canViewMemberDetail(viewer: UserAccount | null, target: Member): boolean {
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;
  if (isSelfMember(viewer, target)) return true;

  const targetCompany = normalizeOrgCode(target.companyCode);
  const targetArea = normalizeOrgCode(target.areaCode);
  const targetUnit = getMemberUnitCode(target);

  if (viewer.role === 'MANAGER') {
    return false;
  }

  if (viewer.role === 'SION_LEADER') {
    const companies = resolveViewerCompanyScope(viewer);
    return companies.has(targetCompany);
  }

  if (viewer.role === 'AREA_LEADER') {
    const companies = resolveViewerCompanyScope(viewer);
    const areas = resolveViewerAreaScope(viewer);
    const managedUnits = new Set(
      (viewer.managedUnitCodes || []).map((u) => normalizeOrgCode(u)).filter(Boolean)
    );
    const companyOk = companies.size === 0 || companies.has(targetCompany);
    const areaOk = areas.has(targetArea);
    const unitOk = managedUnits.size === 0 || managedUnits.has(targetUnit);
    return companyOk && areaOk && unitOk;
  }

  if (viewer.role === 'UNI_LEADER') {
    const ownCompany = normalizeOrgCode(viewer.companyCode);
    const ownArea = normalizeOrgCode(viewer.areaCode);
    const units = resolveViewerUnitScope(viewer);
    const companyOk = !ownCompany || ownCompany === targetCompany;
    const areaOk = !ownArea || ownArea === targetArea;
    const unitOk = units.size > 0 && units.has(targetUnit);
    return companyOk && areaOk && unitOk;
  }

  // MEMBER (TĐ): chỉ xem chi tiết KQ của mình
  return false;
}

export interface RbacFilteredLeaderboard {
  visibleMembers: Member[];
  visibleCompanies: CompanyRankItem[];
  visibleAreas: AreaRankItem[];
  top15Ids: Set<string>;
  accessibleDetailIds: Set<string>;
  scopeBadge: string;
  scopeTitle: string;
  scopeDescription: string;
  isScopedRestricted: boolean;
}

export function filterLeaderboardByRbac(
  viewer: UserAccount | null,
  rankedMembers: Member[],
  companyRankings: CompanyRankItem[],
  areaRankings: AreaRankItem[]
): RbacFilteredLeaderboard {
  const top15 = rankedMembers.slice(0, 15);
  const top15Ids = new Set(top15.map((m) => m.id));
  const accessibleDetailIds = new Set<string>();

  rankedMembers.forEach((m) => {
    if (canViewMemberDetail(viewer, m)) {
      accessibleDetailIds.add(m.id);
    }
  });

  // Guest (chưa đăng nhập): Quy tắc chung -> xem BXH Top 15 người đầu tiên
  if (!viewer) {
    return {
      visibleMembers: top15,
      visibleCompanies: companyRankings.slice(0, 3),
      visibleAreas: areaRankings.slice(0, 5),
      top15Ids,
      accessibleDetailIds,
      scopeBadge: 'Chung',
      scopeTitle: 'BXH Top 15',
      scopeDescription: '',
      isScopedRestricted: true,
    };
  }

  const meta = ROLE_DISPLAY_META[viewer.role] || ROLE_DISPLAY_META.MEMBER;

  // HT: Admin / Super Admin thấy toàn bộ
  if (isAdminRole(viewer.role)) {
    return {
      visibleMembers: rankedMembers,
      visibleCompanies: companyRankings,
      visibleAreas: areaRankings,
      top15Ids,
      accessibleDetailIds,
      scopeBadge: meta.codeBadge,
      scopeTitle: 'Toàn hệ thống',
      scopeDescription: '',
      isScopedRestricted: false,
    };
  }

  // QL Cụm (MANAGER): Thấy tổng các Sion trong khu vực/cụm + Top 15 + KQ cá nhân
  if (viewer.role === 'MANAGER') {
    const clusterCompanies = resolveViewerCompanyScope(viewer);
    const clusterAreas = new Set(
      (viewer.managedAreaCodes || []).map((a) => normalizeOrgCode(a)).filter(Boolean)
    );

    const visibleCompanies = companyRankings.filter((c) => {
      const code = normalizeOrgCode(c.companyCode);
      if (clusterCompanies.has(code)) return true;
      if (clusterAreas.size > 0) {
        return areaRankings.some(
          (a) =>
            normalizeOrgCode(a.companyCode) === code &&
            clusterAreas.has(normalizeOrgCode(a.areaCode))
        );
      }
      return false;
    });

    const visibleAreas = areaRankings.filter((a) => {
      const cCode = normalizeOrgCode(a.companyCode);
      const aCode = normalizeOrgCode(a.areaCode);
      return clusterCompanies.has(cCode) || clusterAreas.has(aCode);
    });

    const visibleMembers = rankedMembers.filter(
      (m) => top15Ids.has(m.id) || isSelfMember(viewer, m)
    );

    const companyListText = Array.from(clusterCompanies).join(', ') || viewer.companyCode || 'Chưa gán';
    return {
      visibleMembers,
      visibleCompanies: visibleCompanies.length > 0 ? visibleCompanies : companyRankings.filter((c) => normalizeOrgCode(c.companyCode) === normalizeOrgCode(viewer.companyCode)),
      visibleAreas,
      top15Ids,
      accessibleDetailIds,
      scopeBadge: meta.codeBadge,
      scopeTitle: `Cụm ${companyListText}`,
      scopeDescription: '',
      isScopedRestricted: true,
    };
  }

  // Ts, Nq (SION_LEADER): Thấy các thành viên & khu vực trong Sion + Top 15
  if (viewer.role === 'SION_LEADER') {
    const companies = resolveViewerCompanyScope(viewer);
    const visibleCompanies = companyRankings.filter((c) =>
      companies.has(normalizeOrgCode(c.companyCode))
    );
    const visibleAreas = areaRankings.filter((a) =>
      companies.has(normalizeOrgCode(a.companyCode))
    );
    const visibleMembers = rankedMembers.filter(
      (m) =>
        top15Ids.has(m.id) ||
        isSelfMember(viewer, m) ||
        companies.has(normalizeOrgCode(m.companyCode))
    );

    const companyLabel = Array.from(companies).join(', ') || viewer.companyCode || 'Sion';
    return {
      visibleMembers,
      visibleCompanies,
      visibleAreas,
      top15Ids,
      accessibleDetailIds,
      scopeBadge: meta.codeBadge,
      scopeTitle: `Sion ${companyLabel}`,
      scopeDescription: '',
      isScopedRestricted: true,
    };
  }

  // Gru (AREA_LEADER): Thấy các Uni & thành viên mình quản lý trong khu vực + Top 15
  if (viewer.role === 'AREA_LEADER') {
    const companies = resolveViewerCompanyScope(viewer);
    const areas = resolveViewerAreaScope(viewer);
    const managedUnits = new Set(
      (viewer.managedUnitCodes || []).map((u) => normalizeOrgCode(u)).filter(Boolean)
    );

    const visibleCompanies = companyRankings.filter((c) =>
      companies.has(normalizeOrgCode(c.companyCode))
    );
    const visibleAreas = areaRankings.filter(
      (a) =>
        (companies.size === 0 || companies.has(normalizeOrgCode(a.companyCode))) &&
        areas.has(normalizeOrgCode(a.areaCode))
    );
    const visibleMembers = rankedMembers.filter((m) => {
      if (top15Ids.has(m.id) || isSelfMember(viewer, m)) return true;
      const compOk = companies.size === 0 || companies.has(normalizeOrgCode(m.companyCode));
      const areaOk = areas.has(normalizeOrgCode(m.areaCode));
      const unitOk = managedUnits.size === 0 || managedUnits.has(getMemberUnitCode(m));
      return compOk && areaOk && unitOk;
    });

    const areaLabel = Array.from(areas).join(', ') || viewer.areaCode || 'Khu vực';
    return {
      visibleMembers,
      visibleCompanies,
      visibleAreas,
      top15Ids,
      accessibleDetailIds,
      scopeBadge: meta.codeBadge,
      scopeTitle: `KV ${areaLabel} (${Array.from(companies).join(', ') || viewer.companyCode})`,
      scopeDescription: '',
      isScopedRestricted: true,
    };
  }

  // Uni (UNI_LEADER): Thấy thành viên đội mình + Top 15
  if (viewer.role === 'UNI_LEADER') {
    const ownCompany = normalizeOrgCode(viewer.companyCode);
    const ownArea = normalizeOrgCode(viewer.areaCode);
    const units = resolveViewerUnitScope(viewer);

    const visibleCompanies = companyRankings.filter(
      (c) => normalizeOrgCode(c.companyCode) === ownCompany
    );
    const visibleAreas = areaRankings.filter(
      (a) =>
        (!ownCompany || normalizeOrgCode(a.companyCode) === ownCompany) &&
        (!ownArea || normalizeOrgCode(a.areaCode) === ownArea)
    );
    const visibleMembers = rankedMembers.filter((m) => {
      if (top15Ids.has(m.id) || isSelfMember(viewer, m)) return true;
      const compOk = !ownCompany || normalizeOrgCode(m.companyCode) === ownCompany;
      const areaOk = !ownArea || normalizeOrgCode(m.areaCode) === ownArea;
      const unitOk = units.size > 0 && units.has(getMemberUnitCode(m));
      return compOk && areaOk && unitOk;
    });

    const unitLabel = Array.from(units).join(', ') || viewer.departmentCode || 'Đội Uni';
    return {
      visibleMembers,
      visibleCompanies,
      visibleAreas,
      top15Ids,
      accessibleDetailIds,
      scopeBadge: meta.codeBadge,
      scopeTitle: `Uni ${unitLabel}`,
      scopeDescription: '',
      isScopedRestricted: true,
    };
  }

  // TĐ (MEMBER): Chỉ xem được KQ của mình + BXH 15 người đầu tiên
  const ownCompany = normalizeOrgCode(viewer.companyCode);
  const ownArea = normalizeOrgCode(viewer.areaCode);
  const visibleMembers = rankedMembers.filter(
    (m) => top15Ids.has(m.id) || isSelfMember(viewer, m)
  );
  const visibleCompanies = companyRankings.filter(
    (c) => normalizeOrgCode(c.companyCode) === ownCompany
  );
  const visibleAreas = areaRankings.filter(
    (a) =>
      (!ownCompany || normalizeOrgCode(a.companyCode) === ownCompany) &&
      (!ownArea || normalizeOrgCode(a.areaCode) === ownArea)
  );

  return {
    visibleMembers,
    visibleCompanies,
    visibleAreas,
    top15Ids,
    accessibleDetailIds,
    scopeBadge: meta.codeBadge,
    scopeTitle: 'Cá nhân & Top 15',
    scopeDescription: '',
    isScopedRestricted: true,
  };
}

export function isMemberInManagerCluster(viewer: UserAccount, target: Member): boolean {
  if (viewer.role !== 'MANAGER') return false;
  const companies = resolveViewerCompanyScope(viewer);
  const areas = new Set(
    (viewer.managedAreaCodes || []).map((a) => normalizeOrgCode(a)).filter(Boolean)
  );
  const tComp = normalizeOrgCode(target.companyCode);
  const tArea = normalizeOrgCode(target.areaCode);
  return companies.has(tComp) || areas.has(tArea);
}

export function getVisibleKpiSummary(
  viewer: UserAccount | null,
  fullKpi: KpiSummary,
  rankedMembers: Member[],
  visibleCompanies: CompanyRankItem[],
  visibleAreas: AreaRankItem[]
): KpiSummary {
  if (!viewer || isAdminRole(viewer.role)) {
    return fullKpi;
  }

  if (viewer.role === 'MANAGER' || viewer.role === 'SION_LEADER' || viewer.role === 'AREA_LEADER') {
    const scopeMembers = rankedMembers.filter((m) =>
      viewer.role === 'MANAGER'
        ? visibleCompanies.some((c) => normalizeOrgCode(c.companyCode) === normalizeOrgCode(m.companyCode))
        : canViewMemberDetail(viewer, m)
    );
    const totalPoints = scopeMembers.reduce((sum, m) => sum + (m.score || 0), 0);
    const totalTargets = scopeMembers.reduce((sum, m) => {
      if (m.dailyResults) {
        return (
          sum +
          m.dailyResults.kn +
          m.dailyResults.tham +
          m.dailyResults.gm +
          m.dailyResults.dt +
          m.dailyResults.hh +
          m.dailyResults.kt +
          m.dailyResults.wsNew
        );
      }
      return sum + (m.targets?.length || 0);
    }, 0);

    return {
      totalTeams: visibleAreas.length || visibleCompanies.length || 1,
      totalMembers: scopeMembers.length,
      totalTargets,
      totalPoints,
      lastUpdated: fullKpi.lastUpdated,
    };
  }

  if (viewer.role === 'UNI_LEADER') {
    const unitMembers = rankedMembers.filter((m) => canViewMemberDetail(viewer, m));
    const totalPoints = unitMembers.reduce((sum, m) => sum + (m.score || 0), 0);
    const totalTargets = unitMembers.reduce((sum, m) => {
      if (m.dailyResults) {
        return (
          sum +
          m.dailyResults.kn +
          m.dailyResults.tham +
          m.dailyResults.gm +
          m.dailyResults.dt +
          m.dailyResults.hh +
          m.dailyResults.kt +
          m.dailyResults.wsNew
        );
      }
      return sum + (m.targets?.length || 0);
    }, 0);
    return {
      totalTeams: 1,
      totalMembers: unitMembers.length,
      totalTargets,
      totalPoints,
      lastUpdated: fullKpi.lastUpdated,
    };
  }

  // MEMBER: chỉ tính KQ của chính mình
  const self = rankedMembers.find((m) => isSelfMember(viewer, m));
  const selfTargets = self?.dailyResults
    ? self.dailyResults.kn +
      self.dailyResults.tham +
      self.dailyResults.gm +
      self.dailyResults.dt +
      self.dailyResults.hh +
      self.dailyResults.kt +
      self.dailyResults.wsNew
    : self?.targets?.length || 0;

  return {
    totalTeams: 1,
    totalMembers: self ? 1 : 0,
    totalTargets: selfTargets,
    totalPoints: self?.score || 0,
    lastUpdated: fullKpi.lastUpdated,
  };
}

export function canModifyDiscipleRecord(
  viewer: UserAccount | null,
  record: DiscipleRecord
): boolean {
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;
  if (record.ownerUid === viewer.id) return true;

  const recCompany = normalizeOrgCode(record.companyCode);
  const recArea = normalizeOrgCode(record.areaCode);
  const recUnit = normalizeOrgCode(record.ownerUnitCode);

  if (viewer.role === 'MANAGER') {
    return (
      resolveViewerCompanyScope(viewer).has(recCompany) ||
      resolveViewerAreaScope(viewer).has(recArea)
    );
  }
  if (viewer.role === 'SION_LEADER') {
    return resolveViewerCompanyScope(viewer).has(recCompany);
  }
  if (viewer.role === 'AREA_LEADER') {
    const compOk =
      resolveViewerCompanyScope(viewer).size === 0 ||
      resolveViewerCompanyScope(viewer).has(recCompany);
    const areaOk = resolveViewerAreaScope(viewer).has(recArea);
    return compOk && areaOk;
  }
  if (viewer.role === 'UNI_LEADER') {
    const ownCompany = normalizeOrgCode(viewer.companyCode);
    const ownArea = normalizeOrgCode(viewer.areaCode);
    const units = resolveViewerUnitScope(viewer);
    return (
      (!ownCompany || ownCompany === recCompany) &&
      (!ownArea || ownArea === recArea) &&
      units.size > 0 &&
      units.has(recUnit)
    );
  }

  return false;
}

export function canModifyEduRecord(
  viewer: UserAccount | null,
  record: { companyCode?: string; areaCode?: string; ownerUid?: string; assignedByUid?: string }
): boolean {
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;
  if (record.ownerUid && record.ownerUid === viewer.id) return true;
  if (record.assignedByUid && record.assignedByUid === viewer.id) return true;

  const recCompany = normalizeOrgCode(record.companyCode);
  const recArea = normalizeOrgCode(record.areaCode);

  if (viewer.role === 'MANAGER') {
    return (
      resolveViewerCompanyScope(viewer).has(recCompany) ||
      resolveViewerAreaScope(viewer).has(recArea)
    );
  }
  if (viewer.role === 'SION_LEADER') {
    return resolveViewerCompanyScope(viewer).has(recCompany);
  }
  if (viewer.role === 'AREA_LEADER') {
    const compOk =
      resolveViewerCompanyScope(viewer).size === 0 ||
      resolveViewerCompanyScope(viewer).has(recCompany);
    return compOk && resolveViewerAreaScope(viewer).has(recArea);
  }
  if (viewer.role === 'UNI_LEADER') {
    const ownCompany = normalizeOrgCode(viewer.companyCode);
    const ownArea = normalizeOrgCode(viewer.areaCode);
    return (!ownCompany || ownCompany === recCompany) && (!ownArea || ownArea === recArea);
  }
  return false;
}
