import {
  Area,
  AreaRankItem,
  Company,
  CompanyRankItem,
  DiscipleRecord,
  KpiSummary,
  Member,
  OrgCluster,
  ROLE_DISPLAY_META,
  UserAccount,
  UserRole,
  getRoleLevel,
  getMaxAssignableRoleLevel,
} from '../types/edulms';

export function normalizeOrgCode(code?: string | null): string {
  return (code || '').trim().toUpperCase();
}

export function cleanRawAreaCode(raw?: string | null): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const stripped = s
    .replace(/^(khu\s*vực|khu\s*vuc|kv)\s*[:.\-]?\s*/i, '')
    .trim();
  return stripped || s;
}

export function slugifyOrgCode(code?: string | null): string {
  return (code || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DEFAULT_COMPANY_DISPLAY_NAMES: Record<string, string> = {
  TH1: 'Thương Hội 1',
  TH2: 'Thương Hội 2',
  TH3: 'Thương Hội 3',
  HT: 'Hội Thánh',
  NC: 'Nam Cali',
  QN: 'Quảng Nam',
};

export function getDefaultCompanyDisplayName(code?: string | null): string {
  const clean = (code || '').trim();
  if (!clean) return '';
  const norm = normalizeOrgCode(clean);
  return DEFAULT_COMPANY_DISPLAY_NAMES[norm] || `Sion ${clean}`;
}

export function makeDeterministicCompanyId(code: string): string {
  const slug = slugifyOrgCode(code) || 'org';
  return `c-${slug}`;
}

export function makeDeterministicAreaId(companyCode: string, areaCode: string): string {
  const cSlug = slugifyOrgCode(companyCode) || 'org';
  const aSlug = slugifyOrgCode(cleanRawAreaCode(areaCode)) || 'area';
  return `a-${cSlug}-${aSlug}`;
}

export function makeAreaScopeKey(companyCode?: string | null, areaCode?: string | null): string {
  const comp = (companyCode || '').trim();
  const area = cleanRawAreaCode(areaCode);
  if (!area) return '';
  if (!comp) return area;
  return `${comp}::${area}`;
}

export interface ParsedAreaScopeEntry {
  hasCompanyPrefix: boolean;
  companyCode: string;
  areaCode: string;
  rawCompanyCode: string;
  rawAreaCode: string;
}

export function parseAreaScopeEntry(entry?: string | null): ParsedAreaScopeEntry {
  const trimmed = (entry || '').trim();
  if (!trimmed) {
    return {
      hasCompanyPrefix: false,
      companyCode: '',
      areaCode: '',
      rawCompanyCode: '',
      rawAreaCode: '',
    };
  }
  const sepIdx = trimmed.indexOf('::');
  if (sepIdx !== -1) {
    const rawCompanyCode = trimmed.slice(0, sepIdx).trim();
    const rawAreaCode = cleanRawAreaCode(trimmed.slice(sepIdx + 2));
    return {
      hasCompanyPrefix: Boolean(rawCompanyCode),
      companyCode: normalizeOrgCode(rawCompanyCode),
      areaCode: normalizeOrgCode(rawAreaCode),
      rawCompanyCode,
      rawAreaCode,
    };
  }
  const rawAreaCode = cleanRawAreaCode(trimmed);
  return {
    hasCompanyPrefix: false,
    companyCode: '',
    areaCode: normalizeOrgCode(rawAreaCode),
    rawCompanyCode: '',
    rawAreaCode,
  };
}

export function formatAreaDisplayName(code?: string | null, name?: string | null): string {
  const cleanCode = cleanRawAreaCode(code);
  const cleanName = (name || '').trim();
  if (!cleanCode && !cleanName) return '';
  if (!cleanName || normalizeOrgCode(cleanName) === normalizeOrgCode(cleanCode)) {
    return cleanCode ? `KV ${cleanCode}` : '';
  }
  if (/^(khu\s*vực|khu\s*vuc|kv)\b/i.test(cleanName)) {
    return cleanName;
  }
  return cleanCode ? `KV ${cleanCode} · ${cleanName}` : cleanName;
}

export function getClusterSeedCompanyCodes(clusters?: OrgCluster[] | null): string[] {
  const byNorm = new Map<string, string>();
  (clusters || []).forEach((cl) => {
    if (cl.active === false) return;
    (cl.companyCodes || []).forEach((raw) => {
      const clean = (raw || '').trim();
      const norm = normalizeOrgCode(clean);
      if (norm && !byNorm.has(norm)) {
        byNorm.set(norm, clean);
      }
    });
  });
  if (byNorm.size === 0) {
    return ['Th1'];
  }
  return Array.from(byNorm.values());
}

export function createDefaultClustersForCompanies(companies: Company[]): OrgCluster[] {
  const findExistingCode = (candidates: string[]): string[] => {
    const found: string[] = [];
    candidates.forEach((cand) => {
      const match = companies.find((c) => normalizeOrgCode(c.code) === normalizeOrgCode(cand));
      if (match && !found.some((x) => normalizeOrgCode(x) === normalizeOrgCode(match.code))) {
        found.push(match.code);
      }
    });
    return found;
  };

  const th1Codes = findExistingCode(['Th1']);
  return [
    {
      id: 'cluster-th1',
      code: 'TH1',
      name: 'TH1',
      companyCodes: th1Codes,
      isCatchAll: false,
      description: 'Cụm Thương Hội 1',
      active: true,
    },
    {
      id: 'cluster-eli',
      code: 'ELI',
      name: 'ÊLI',
      companyCodes: findExistingCode(['ELI', 'ÊLI']),
      isCatchAll: false,
      description: 'Cụm ÊLI',
      active: true,
    },
    {
      id: 'cluster-hbc',
      code: 'HBC',
      name: 'HBC',
      companyCodes: findExistingCode(['HBC']),
      isCatchAll: false,
      description: 'Cụm HBC',
      active: true,
    },
    {
      id: 'cluster-per',
      code: 'PER',
      name: 'PER',
      companyCodes: findExistingCode(['PER']),
      isCatchAll: false,
      description: 'Cụm PER',
      active: true,
    },
    {
      id: 'cluster-ysac',
      code: 'YSAC',
      name: 'YSAC',
      companyCodes: [],
      isCatchAll: true,
      description: 'Tự động gồm các Sion chưa thuộc cụm khác',
      active: true,
    },
  ];
}

export function resolveClusterCompanyCodes(
  cluster: OrgCluster,
  allClusters: OrgCluster[],
  companies: Company[]
): string[] {
  const canonicalByNorm = new Map<string, string>();
  companies.forEach((c) => {
    const norm = normalizeOrgCode(c.code);
    if (norm && !canonicalByNorm.has(norm)) {
      canonicalByNorm.set(norm, c.code);
    }
  });

  if (cluster.isCatchAll) {
    const assignedNorms = new Set<string>();
    allClusters.forEach((other) => {
      if (other.id === cluster.id || other.isCatchAll || other.active === false) return;
      (other.companyCodes || []).forEach((code) => {
        const norm = normalizeOrgCode(code);
        if (norm) assignedNorms.add(norm);
      });
    });

    const result: string[] = [];
    const seen = new Set<string>();
    companies.forEach((c) => {
      if (c.active === false) return;
      const norm = normalizeOrgCode(c.code);
      if (!norm || assignedNorms.has(norm) || seen.has(norm)) return;
      seen.add(norm);
      result.push(c.code);
    });
    return result;
  }

  const result: string[] = [];
  const seen = new Set<string>();
  (cluster.companyCodes || []).forEach((raw) => {
    const clean = (raw || '').trim();
    const norm = normalizeOrgCode(clean);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    result.push(canonicalByNorm.get(norm) || clean);
  });
  return result;
}

export function resolveCompanyCodesFromClusterIds(
  clusterIds: string[] | undefined,
  allClusters: OrgCluster[],
  companies: Company[]
): string[] {
  if (!clusterIds || clusterIds.length === 0) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  clusterIds.forEach((cid) => {
    const normCid = normalizeOrgCode(cid);
    const matched = allClusters.find(
      (cl) => cl.id === cid || (normCid && normalizeOrgCode(cl.code) === normCid)
    );
    if (!matched || matched.active === false) return;
    resolveClusterCompanyCodes(matched, allClusters, companies).forEach((code) => {
      const norm = normalizeOrgCode(code);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        result.push(code);
      }
    });
  });

  return result;
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
    const parsed = parseAreaScopeEntry(a);
    if (parsed.areaCode) set.add(parsed.areaCode);
  });
  if (set.size === 0 && viewer.areaCode) {
    const parsed = parseAreaScopeEntry(viewer.areaCode);
    if (parsed.areaCode) set.add(parsed.areaCode);
  }
  return set;
}

function matchesViewerAreaScope(
  viewer: UserAccount,
  targetCompanyCode?: string | null,
  targetAreaCode?: string | null,
  requireCompanyIfNoPrefix = false
): boolean {
  const tComp = normalizeOrgCode(targetCompanyCode);
  const tArea = normalizeOrgCode(cleanRawAreaCode(targetAreaCode));
  if (!tArea) return false;
  const rawEntries = (viewer.managedAreaCodes || []).filter((a) => (a || '').trim().length > 0);
  const entries = rawEntries.length
    ? rawEntries.map(parseAreaScopeEntry).filter((p) => Boolean(p.areaCode))
    : viewer.areaCode
    ? [parseAreaScopeEntry(viewer.areaCode)].filter((p) => Boolean(p.areaCode))
    : [];
  const companies = resolveViewerCompanyScope(viewer);
  return entries.some((entry) => {
    if (entry.areaCode !== tArea) return false;
    if (entry.hasCompanyPrefix) return entry.companyCode === tComp;
    return !requireCompanyIfNoPrefix || companies.size === 0 || companies.has(tComp);
  });
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
    const managedUnits = new Set(
      (viewer.managedUnitCodes || []).map((u) => normalizeOrgCode(u)).filter(Boolean)
    );
    const areaOk = matchesViewerAreaScope(viewer, target.companyCode, target.areaCode, true);
    const unitOk = managedUnits.size === 0 || managedUnits.has(targetUnit);
    return areaOk && unitOk;
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

/**
 * Kiểm tra quyền xem & xuất Tổng quan Báo cáo hằng ngày (7 chỉ số) theo phân quyền 7 cấp:
 * - Cấp 6-7 (ADMIN / SUPER_ADMIN): Toàn hệ thống
 * - Cấp 5 (MANAGER): Các Sion & Khu vực trong cụm phụ trách + bản thân
 * - Cấp 4 (SION_LEADER): Thành viên trong Sion phụ trách + bản thân
 * - Cấp 3 (AREA_LEADER): Thành viên trong Khu vực phụ trách + bản thân
 * - Cấp 2 (UNI_LEADER): Thành viên trong Đội/Uni phụ trách + bản thân
 * - Cấp 1 (MEMBER): Chỉ báo cáo của chính mình
 */
export function canAccessMemberReportOverview(
  viewer: UserAccount | null,
  target: Member
): boolean {
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;
  if (isSelfMember(viewer, target)) return true;
  if (viewer.role === 'MANAGER') {
    return isMemberInManagerCluster(viewer, target) || canManageOrgRecord(viewer, target);
  }
  return canViewMemberDetail(viewer, target) || canManageOrgRecord(viewer, target);
}

export function getRbacScopeDescription(viewer: UserAccount | null): string {
  if (!viewer) return 'Chưa đăng nhập';
  if (isAdminRole(viewer.role)) return 'Toàn hệ thống';
  if (viewer.role === 'MANAGER') {
    const comps = Array.from(resolveViewerCompanyScope(viewer));
    const areas = (viewer.managedAreaCodes || []).filter(Boolean);
    const parts: string[] = [];
    if (comps.length) parts.push(`Sion ${comps.join(', ')}`);
    if (areas.length) parts.push(`KV ${areas.join(', ')}`);
    return parts.join(' · ') || 'Cụm phụ trách';
  }
  if (viewer.role === 'SION_LEADER') {
    const comps = Array.from(resolveViewerCompanyScope(viewer));
    return comps.length ? `Sion ${comps.join(', ')}` : `Sion ${viewer.companyCode}`;
  }
  if (viewer.role === 'AREA_LEADER') {
    const areas = Array.from(resolveViewerAreaScope(viewer));
    return areas.length ? `Khu vực ${areas.join(', ')}` : `Khu vực ${viewer.areaCode}`;
  }
  if (viewer.role === 'UNI_LEADER') {
    const units = Array.from(resolveViewerUnitScope(viewer));
    return units.length ? `Đội / Uni ${units.join(', ')}` : `KV ${viewer.areaCode}`;
  }
  return `Cá nhân · ${viewer.companyCode || '—'} / KV ${viewer.areaCode || '—'}`;
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

  const sanitizeVisibleMembers = (list: Member[]): Member[] =>
    list.map((m) =>
      accessibleDetailIds.has(m.id)
        ? m
        : {
            ...m,
            targets: [],
            dailyResults: undefined,
            dailyGoals: undefined,
            bio: undefined,
            results: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
            goals: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
          }
    );

  // Guest (chưa đăng nhập): Quy tắc chung -> xem BXH Top 15 người đầu tiên
  if (!viewer) {
    return {
      visibleMembers: sanitizeVisibleMembers(top15),
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

    const visibleMembers = sanitizeVisibleMembers(
      rankedMembers.filter((m) => top15Ids.has(m.id) || isSelfMember(viewer, m))
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
    const visibleMembers = sanitizeVisibleMembers(
      rankedMembers.filter(
        (m) =>
          top15Ids.has(m.id) ||
          isSelfMember(viewer, m) ||
          companies.has(normalizeOrgCode(m.companyCode))
      )
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
    const visibleMembers = sanitizeVisibleMembers(
      rankedMembers.filter((m) => {
        if (top15Ids.has(m.id) || isSelfMember(viewer, m)) return true;
        const compOk = companies.size === 0 || companies.has(normalizeOrgCode(m.companyCode));
        const areaOk = areas.has(normalizeOrgCode(m.areaCode));
        const unitOk = managedUnits.size === 0 || managedUnits.has(getMemberUnitCode(m));
        return compOk && areaOk && unitOk;
      })
    );

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
    const visibleMembers = sanitizeVisibleMembers(
      rankedMembers.filter((m) => {
        if (top15Ids.has(m.id) || isSelfMember(viewer, m)) return true;
        const compOk = !ownCompany || normalizeOrgCode(m.companyCode) === ownCompany;
        const areaOk = !ownArea || normalizeOrgCode(m.areaCode) === ownArea;
        const unitOk = units.size > 0 && units.has(getMemberUnitCode(m));
        return compOk && areaOk && unitOk;
      })
    );

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
  const visibleMembers = sanitizeVisibleMembers(
    rankedMembers.filter((m) => top15Ids.has(m.id) || isSelfMember(viewer, m))
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
  const tComp = normalizeOrgCode(target.companyCode);
  if (companies.has(tComp)) return true;
  if ((viewer.managedAreaCodes || []).length > 0) {
    return matchesViewerAreaScope(viewer, target.companyCode, target.areaCode, false);
  }
  return false;
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

export function canViewEduRecord(
  viewer: UserAccount | null,
  record: {
    companyCode?: string;
    areaCode?: string;
    ownerUid?: string;
    assignedByUid?: string;
    memberId?: string;
  }
): boolean {
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;
  if (record.ownerUid && record.ownerUid === viewer.id) return true;
  if (record.assignedByUid && record.assignedByUid === viewer.id) return true;
  if (record.memberId && viewer.memberId && record.memberId === viewer.memberId) return true;

  // TĐ (MEMBER): khóa hoàn toàn dữ liệu Edu của người khác
  if (viewer.role === 'MEMBER') return false;

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

export function canModifyEduRecord(
  viewer: UserAccount | null,
  record: {
    companyCode?: string;
    areaCode?: string;
    ownerUid?: string;
    assignedByUid?: string;
    memberId?: string;
  }
): boolean {
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;
  if (record.ownerUid && record.ownerUid === viewer.id) return true;
  if (record.assignedByUid && record.assignedByUid === viewer.id) return true;
  if (record.memberId && viewer.memberId && record.memberId === viewer.memberId) return true;

  if (viewer.role === 'MEMBER') return false;

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

/**
 * Kiểm tra xem người dùng (Cấp 2 -> 7) có quyền xem/quản lý bản ghi Tổ chức & Nhân sự
 * (Thành viên / Tài khoản) thuộc phạm vi Sion / Khu vực / Uni của mình hay không.
 */
export function canManageOrgRecord(
  viewer: UserAccount | null,
  record: {
    companyCode?: string | null;
    areaCode?: string | null;
    unitCode?: string | null;
    departmentCode?: string | null;
  }
): boolean {
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;

  const targetCompany = normalizeOrgCode(record.companyCode);
  const targetArea = normalizeOrgCode(record.areaCode);
  const targetUnit = getMemberUnitCode(record);

  if (viewer.role === 'MANAGER') {
    const companies = resolveViewerCompanyScope(viewer);
    if (companies.has(targetCompany)) return true;
    if ((viewer.managedAreaCodes || []).length > 0 && targetArea) {
      return matchesViewerAreaScope(viewer, record.companyCode, record.areaCode, false);
    }
    return false;
  }

  if (viewer.role === 'SION_LEADER') {
    const companies = resolveViewerCompanyScope(viewer);
    return companies.has(targetCompany);
  }

  if (viewer.role === 'AREA_LEADER') {
    const managedUnits = new Set(
      (viewer.managedUnitCodes || []).map((u) => normalizeOrgCode(u)).filter(Boolean)
    );
    const areaOk = matchesViewerAreaScope(viewer, record.companyCode, record.areaCode, true);
    const unitOk = managedUnits.size === 0 || (!!targetUnit && managedUnits.has(targetUnit));
    return areaOk && unitOk;
  }

  if (viewer.role === 'UNI_LEADER') {
    const ownCompany = normalizeOrgCode(viewer.companyCode);
    const ownArea = normalizeOrgCode(viewer.areaCode);
    const units = resolveViewerUnitScope(viewer);
    const companyOk = !ownCompany || ownCompany === targetCompany;
    const areaOk = !ownArea || ownArea === targetArea;
    const unitOk = units.size > 0 && !!targetUnit && units.has(targetUnit);
    return companyOk && areaOk && unitOk;
  }

  return false;
}

/**
 * Kiểm tra quyền phân quyền theo thang bậc:
 * - Cấp 7 (SUPER_ADMIN): phân quyền tất cả 7 cấp
 * - Cấp 6 (ADMIN): cấp 5 trở xuống
 * - Cấp 5 (MANAGER): cấp 4 trở xuống
 * - Cấp 4 (SION_LEADER / TS, NQ): cấp 3 trở xuống
 * - Cấp 3 (AREA_LEADER / Gru): cấp 2 trở xuống
 * - Cấp 2 (UNI_LEADER / Uni): cấp 1 trở xuống
 */
export function canAssignTargetRole(
  actorRole: UserRole | null | undefined,
  currentTargetRole: UserRole,
  nextTargetRole: UserRole
): boolean {
  if (!actorRole) return false;
  if (actorRole === 'SUPER_ADMIN') return true;
  const maxAssignable = getMaxAssignableRoleLevel(actorRole);
  if (maxAssignable <= 0) return false;
  return (
    getRoleLevel(currentTargetRole) <= maxAssignable &&
    getRoleLevel(nextTargetRole) <= maxAssignable
  );
}

/**
 * Xây dựng danh sách lựa chọn 3 tầng liên hoàn (Sion -> Khu vực -> Cá nhân)
 * luôn tuân thủ phạm vi RBAC 7 cấp và chuẩn hóa mã (normalizeOrgCode).
 */
export function getScopedCompanyOptions(
  viewer: UserAccount | null,
  companies: Company[],
  scopedMembers: Member[] = []
): Company[] {
  const seen = new Set<string>();
  const merged: Company[] = [];

  const pushUnique = (comp: Company) => {
    const norm = normalizeOrgCode(comp.code);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    merged.push(comp);
  };

  if (!viewer || isAdminRole(viewer.role)) {
    companies.forEach(pushUnique);
  } else {
    const allowedCodes = new Set<string>();
    if (viewer.companyCode) allowedCodes.add(normalizeOrgCode(viewer.companyCode));
    resolveViewerCompanyScope(viewer).forEach((c) => allowedCodes.add(c));
    scopedMembers
      .filter((m) => canAccessMemberReportOverview(viewer, m) || canManageOrgRecord(viewer, m))
      .forEach((m) => {
        if (m.companyCode) allowedCodes.add(normalizeOrgCode(m.companyCode));
      });

    companies.forEach((c) => {
      if (allowedCodes.has(normalizeOrgCode(c.code))) pushUnique(c);
    });
    allowedCodes.forEach((code) => {
      if (!seen.has(code)) {
        pushUnique({ id: `c-${code}`, code, name: `Sion ${code}`, active: true });
      }
    });
  }

  return merged.sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code, 'vi'));
}

export function getScopedAreaOptions(
  viewer: UserAccount | null,
  areas: Area[],
  selectedCompanyCode: string,
  scopedMembers: Member[] = []
): Area[] {
  const normCompany = normalizeOrgCode(selectedCompanyCode);
  const filterByCompany = selectedCompanyCode && selectedCompanyCode !== 'ALL';
  const seen = new Set<string>();
  const merged: Area[] = [];

  const isAreaAllowedForViewer = (areaCode: string, compCode: string): boolean => {
    if (!viewer || isAdminRole(viewer.role)) return true;
    if (viewer.role === 'MANAGER' || viewer.role === 'SION_LEADER') {
      const allowedComps = resolveViewerCompanyScope(viewer);
      const allowedAreas = resolveViewerAreaScope(viewer);
      return (
        allowedComps.has(normalizeOrgCode(compCode)) ||
        (viewer.role === 'MANAGER' && allowedAreas.has(normalizeOrgCode(areaCode)))
      );
    }
    if (viewer.role === 'AREA_LEADER' || viewer.role === 'UNI_LEADER' || viewer.role === 'MEMBER') {
      const allowedAreas = resolveViewerAreaScope(viewer);
      return allowedAreas.has(normalizeOrgCode(areaCode));
    }
    return true;
  };

  const pushUnique = (area: Area) => {
    const normArea = normalizeOrgCode(area.code);
    const normAreaComp = normalizeOrgCode(area.companyCode);
    if (!normArea) return;
    if (filterByCompany && normAreaComp !== normCompany) return;
    if (!isAreaAllowedForViewer(area.code, area.companyCode)) return;
    const dedupeKey = filterByCompany ? normArea : `${normAreaComp}::${normArea}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    merged.push(area);
  };

  areas.forEach(pushUnique);

  scopedMembers.forEach((m) => {
    if (!m.areaCode) return;
    pushUnique({
      id: `a-${m.companyCode || 'org'}-${m.areaCode}`,
      code: m.areaCode,
      name: `KV ${m.areaCode}`,
      companyCode: m.companyCode || '',
      active: true,
    });
  });

  return merged.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'vi'));
}

export function getScopedMemberOptions(
  scopedMembers: Member[],
  selectedCompanyCode: string,
  selectedAreaCode: string
): Member[] {
  const filterComp = selectedCompanyCode && selectedCompanyCode !== 'ALL';
  const filterArea = selectedAreaCode && selectedAreaCode !== 'ALL';
  const normComp = normalizeOrgCode(selectedCompanyCode);
  const normArea = normalizeOrgCode(selectedAreaCode);

  return scopedMembers
    .filter((m) => {
      if (filterComp && normalizeOrgCode(m.companyCode) !== normComp) return false;
      if (filterArea && normalizeOrgCode(m.areaCode) !== normArea) return false;
      return true;
    })
    .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'vi'));
}

