import { doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, FIRESTORE_DATABASE_ID } from '../firebase';

export interface DebugUiUserContext {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  roleUpdatedAt?: string | null;
  approvalStatus?: string | null;
  companyCode?: string | null;
  areaCode?: string | null;
  unitCode?: string | null;
  departmentCode?: string | null;
  managedClusterIds?: string[];
  managedCompanyCodes?: string[];
  managedAreaCodes?: string[];
  managedUnitCodes?: string[];
}

export interface LogUserContextOptions {
  /** Điểm truy vấn / collection / path bị lỗi (VD: 'dailyReports (all)', 'users', 'system_config/roles') */
  queryPoint: string;
  /** Loại thao tác (GET, LIST, CREATE, UPDATE, DELETE, WRITE, QUERY) */
  operation?: string;
  /** Lỗi gốc trả về từ Firestore */
  error?: unknown;
  /** Vai trò đang hiển thị trên UI (ưu tiên nếu truyền trực tiếp) */
  uiRole?: string | null;
  /** Thông tin tài khoản đang giữ trên UI */
  uiUser?: DebugUiUserContext | null;
  /** Chỉ xuất log khi lỗi thuộc nhóm permission-denied / insufficient permissions (mặc định: true) */
  onlyOnPermissionDenied?: boolean;
}

export interface UserContextDiagnostic {
  timestamp: string;
  localTime: string;
  databaseId: string;
  appletConfigDatabaseId: string;
  projectId: string | null;
  queryPoint: string;
  operation: string;
  errorCode: string;
  errorMessage: string;
  userRole: {
    uiRole: string | null;
    serverRole: string | null;
    claimDocRole: string | null;
    approvalStatus: string | null;
  };
  claims: Record<string, unknown> | null;
  auth: {
    uid: string;
    email: string | null;
    emailVerified: boolean;
  } | null;
  uiContext: DebugUiUserContext | null;
  serverUserDoc: Record<string, unknown> | null;
  roleClaimDoc: Record<string, unknown> | null;
  mismatchDetected: boolean;
  mismatchReasons: string[];
}

let activeDebugUiUser: DebugUiUserContext | null = null;

/** Cập nhật ngữ cảnh user hiện tại trên UI để mọi điểm bắt lỗi Firestore có thể đối chiếu */
export function setActiveDebugUserContext(user: DebugUiUserContext | null): void {
  activeDebugUiUser = user ? { ...user } : null;
}

/** Kiểm tra lỗi có phải do Firestore từ chối quyền (permission-denied / insufficient permissions) */
export function isPermissionDeniedError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    code.includes('permission-denied') ||
    msg.includes('permission-denied') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('insufficient permissions')
  );
}

interface ServerSnapshotCache {
  key: string;
  fetchedAt: number;
  claims: Record<string, unknown> | null;
  serverUserDoc: Record<string, unknown> | null;
  roleClaimDoc: Record<string, unknown> | null;
}

const SERVER_CONTEXT_CACHE_TTL_MS = 2500;
let lastServerCache: ServerSnapshotCache | null = null;
let inFlightServerFetch: { key: string; promise: Promise<ServerSnapshotCache> } | null = null;

async function fetchServerAuthAndDocs(): Promise<ServerSnapshotCache> {
  const user = auth.currentUser;
  const uid = user?.uid || '_anon_';
  const emailLower = (user?.email || '').trim().toLowerCase();
  const cacheKey = `${uid}::${emailLower}::${FIRESTORE_DATABASE_ID}`;

  if (
    lastServerCache &&
    lastServerCache.key === cacheKey &&
    Date.now() - lastServerCache.fetchedAt < SERVER_CONTEXT_CACHE_TTL_MS
  ) {
    return lastServerCache;
  }

  if (inFlightServerFetch && inFlightServerFetch.key === cacheKey) {
    return inFlightServerFetch.promise;
  }

  const promise = (async (): Promise<ServerSnapshotCache> => {
    let claims: Record<string, unknown> | null = null;
    let serverUserDoc: Record<string, unknown> | null = null;
    let roleClaimDoc: Record<string, unknown> | null = null;

    if (user) {
      try {
        const tokenRes = await user.getIdTokenResult(false);
        claims = {
          email: tokenRes.claims.email ?? null,
          email_verified: tokenRes.claims.email_verified ?? null,
          sign_in_provider:
            (tokenRes.claims.firebase as { sign_in_provider?: string } | undefined)
              ?.sign_in_provider ?? null,
          auth_time: tokenRes.claims.auth_time ?? null,
          exp: tokenRes.expirationTime ?? null,
          role: (tokenRes.claims as Record<string, unknown>).role ?? null,
          customClaims: Object.fromEntries(
            Object.entries(tokenRes.claims).filter(
              ([k]) =>
                ![
                  'iss',
                  'aud',
                  'auth_time',
                  'user_id',
                  'sub',
                  'iat',
                  'exp',
                  'email',
                  'email_verified',
                  'firebase',
                  'name',
                  'picture',
                ].includes(k)
            )
          ),
        };
      } catch (tokenErr) {
        claims = {
          tokenError: tokenErr instanceof Error ? tokenErr.message : String(tokenErr),
        };
      }

      try {
        const userSnap = await getDocFromServer(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const d = userSnap.data();
          serverUserDoc = {
            exists: true,
            role: d.role ?? null,
            roleUpdatedAt: d.roleUpdatedAt ?? null,
            approvalStatus: d.approvalStatus ?? '(không có trường)',
            companyCode: d.companyCode ?? null,
            areaCode: d.areaCode ?? null,
            unitCode: d.unitCode ?? null,
            departmentCode: d.departmentCode ?? null,
            managedClusterIds: d.managedClusterIds ?? [],
            managedCompanyCodes: d.managedCompanyCodes ?? [],
            managedAreaCodes: d.managedAreaCodes ?? [],
            managedUnitCodes: d.managedUnitCodes ?? [],
          };
        } else {
          serverUserDoc = { exists: false };
        }
      } catch (readErr) {
        serverUserDoc = {
          readError: readErr instanceof Error ? readErr.message : String(readErr),
        };
      }

      if (emailLower && user.emailVerified) {
        try {
          const claimSnap = await getDocFromServer(doc(db, 'role_claims', emailLower));
          if (claimSnap.exists()) {
            const c = claimSnap.data();
            roleClaimDoc = {
              exists: true,
              role: c.role ?? null,
              updatedAt: c.updatedAt ?? c.grantedAt ?? null,
              managedClusterIds: c.managedClusterIds ?? [],
              managedCompanyCodes: c.managedCompanyCodes ?? [],
              managedAreaCodes: c.managedAreaCodes ?? [],
              managedUnitCodes: c.managedUnitCodes ?? [],
            };
          } else {
            roleClaimDoc = { exists: false };
          }
        } catch (claimErr) {
          roleClaimDoc = {
            readError: claimErr instanceof Error ? claimErr.message : String(claimErr),
          };
        }
      }
    }

    const result: ServerSnapshotCache = {
      key: cacheKey,
      fetchedAt: Date.now(),
      claims,
      serverUserDoc,
      roleClaimDoc,
    };
    lastServerCache = result;
    return result;
  })();

  inFlightServerFetch = { key: cacheKey, promise };
  try {
    return await promise;
  } finally {
    if (inFlightServerFetch?.promise === promise) {
      inFlightServerFetch = null;
    }
  }
}

/**
 * Xuất log chi tiết (user role, claims, database ID, timestamp, chẩn đoán LỆCH QUYỀN)
 * ra console khi xảy ra lỗi permission-denied tại các điểm truy vấn Firestore chính.
 */
export async function logUserContext(
  options: LogUserContextOptions
): Promise<UserContextDiagnostic | null> {
  const {
    queryPoint,
    operation = 'QUERY',
    error,
    uiRole: explicitUiRole,
    uiUser: explicitUiUser,
    onlyOnPermissionDenied = true,
  } = options;

  if (onlyOnPermissionDenied && error !== undefined && !isPermissionDeniedError(error)) {
    return null;
  }

  const now = new Date();
  const timestamp = now.toISOString();
  const localTime = now.toLocaleString('vi-VN');
  const errorCode = String((error as { code?: string })?.code || 'permission-denied');
  const errorMessage = error instanceof Error ? error.message : String(error || '');
  const user = auth.currentUser;
  const uiCtx = explicitUiUser ?? activeDebugUiUser;
  const uiRole = explicitUiRole ?? uiCtx?.role ?? null;

  const { claims, serverUserDoc, roleClaimDoc } = await fetchServerAuthAndDocs();

  const serverRole =
    typeof serverUserDoc?.role === 'string' ? serverUserDoc.role : null;
  const claimDocRole =
    typeof roleClaimDoc?.role === 'string' ? roleClaimDoc.role : null;
  const serverApproval =
    typeof serverUserDoc?.approvalStatus === 'string' ? serverUserDoc.approvalStatus : null;
  const appletDbId =
    (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';
  const projectId = (firebaseConfig as { projectId?: string }).projectId || null;

  const mismatchReasons: string[] = [];
  if (!user) {
    mismatchReasons.push('Chưa đăng nhập Firebase Auth (auth.currentUser = null).');
  } else {
    if (!user.emailVerified) {
      mismatchReasons.push('Token Auth có email_verified = false.');
    }
    if (serverUserDoc && serverUserDoc.exists === false) {
      mismatchReasons.push(`Không tìm thấy hồ sơ users/${user.uid} trên database "${FIRESTORE_DATABASE_ID}".`);
    }
    if (uiRole && serverRole && uiRole !== serverRole) {
      mismatchReasons.push(
        `LỆCH QUYỀN UI vs Firestore: UI đang là "${uiRole}" nhưng users/${user.uid} trên server lưu "${serverRole}".`
      );
    }
    if (serverRole && claimDocRole && serverRole !== claimDocRole) {
      mismatchReasons.push(
        `LỆCH role_claims: users/${user.uid}.role="${serverRole}" khác role_claims.role="${claimDocRole}".`
      );
    }
    if (
      serverApproval &&
      serverApproval !== 'APPROVED' &&
      serverApproval !== '(không có trường)'
    ) {
      mismatchReasons.push(`Tài khoản chưa được duyệt (approvalStatus="${serverApproval}").`);
    }
    if (FIRESTORE_DATABASE_ID !== appletDbId) {
      mismatchReasons.push(
        `Database đang chạy ("${FIRESTORE_DATABASE_ID}") khác firebase-applet-config.json ("${appletDbId}") — kiểm tra đã Publish firestore.rules lên đúng "${FIRESTORE_DATABASE_ID}" chưa.`
      );
    }
  }

  const diagnostic: UserContextDiagnostic = {
    timestamp,
    localTime,
    databaseId: FIRESTORE_DATABASE_ID,
    appletConfigDatabaseId: appletDbId,
    projectId,
    queryPoint,
    operation,
    errorCode,
    errorMessage,
    userRole: {
      uiRole,
      serverRole,
      claimDocRole,
      approvalStatus: serverApproval,
    },
    claims,
    auth: user
      ? {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
        }
      : null,
    uiContext: uiCtx,
    serverUserDoc,
    roleClaimDoc,
    mismatchDetected: mismatchReasons.length > 0,
    mismatchReasons,
  };

  console.error(
    `[logUserContext] permission-denied @ ${queryPoint} (${operation}) | db=${FIRESTORE_DATABASE_ID} | uiRole=${uiRole ?? 'null'} | serverRole=${serverRole ?? 'null'} | ${timestamp}`,
    diagnostic
  );

  return diagnostic;
}

/**
 * Ghi log chẩn đoán chi tiết khi thao tác ghi Firestore bị từ chối (permission-denied)
 * để xác định nhanh nguyên nhân (Rules trên database (default), approvalStatus, hoặc dữ liệu payload).
 */
export async function diagnoseWriteDenied(
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>,
  err: unknown
): Promise<string | null> {
  const diagnosticContext = await logUserContext({
    queryPoint: `${collectionName}/${docId}`,
    operation: 'WRITE',
    error: err,
    onlyOnPermissionDenied: false,
  });

  const payloadSummary = {
    timestamp: new Date().toISOString(),
    databaseId: FIRESTORE_DATABASE_ID,
    path: `${collectionName}/${docId}`,
    payloadKeys: Object.keys(payload || {}),
    payloadOrg: {
      uid: payload?.uid ?? null,
      companyCode: payload?.companyCode ?? null,
      areaCode: payload?.areaCode ?? null,
      unitCode: payload?.unitCode ?? null,
    },
    userContext: diagnosticContext,
  };

  console.error('[Firestore Write Denied Diagnostic]', payloadSummary);
  return JSON.stringify(payloadSummary);
}
