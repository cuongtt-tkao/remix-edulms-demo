import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db, FIRESTORE_DATABASE_ID } from '../firebase';

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
  const code = String((err as { code?: string })?.code || '');
  const message = err instanceof Error ? err.message : String(err || '');
  const user = auth.currentUser;

  let userDocStatus: Record<string, unknown> | null = null;
  if (user?.uid) {
    try {
      const snap = await getDocFromServer(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        userDocStatus = {
          exists: true,
          role: d.role ?? null,
          approvalStatus: d.approvalStatus ?? null,
          companyCode: d.companyCode ?? null,
          areaCode: d.areaCode ?? null,
          unitCode: d.unitCode ?? null,
        };
      } else {
        userDocStatus = { exists: false };
      }
    } catch (readErr) {
      userDocStatus = {
        readError: readErr instanceof Error ? readErr.message : String(readErr),
      };
    }
  }

  const diagnostic = {
    databaseId: FIRESTORE_DATABASE_ID,
    path: `${collectionName}/${docId}`,
    code,
    message,
    auth: user
      ? {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
        }
      : null,
    userDoc: userDocStatus,
    payloadKeys: Object.keys(payload || {}),
    payloadOrg: {
      uid: payload?.uid ?? null,
      companyCode: payload?.companyCode ?? null,
      areaCode: payload?.areaCode ?? null,
      unitCode: payload?.unitCode ?? null,
    },
  };

  console.error('[Firestore Write Denied Diagnostic]', diagnostic);
  return JSON.stringify(diagnostic);
}
