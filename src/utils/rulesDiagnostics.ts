import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db, FIRESTORE_DATABASE_ID } from '../firebase';

const METRIC_KEYS = ['kn', 'tham', 'gm', 'dt', 'hh', 'kt', 'wsNew'];
const REPORT_KEYS = [
  'uid', 'memberId', 'companyCode', 'areaCode', 'unitCode',
  'date', 'month', 'year', 'goals', 'results', 'updatedAt',
];

const metricMapProblems = (label: string, m: any): string[] => {
  const out: string[] = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return [`${label}: không phải map`];
  for (const k of Object.keys(m)) {
    if (!METRIC_KEYS.includes(k)) out.push(`${label}: khóa lạ "${k}" (rule chỉ cho ${METRIC_KEYS.join(', ')})`);
    const v = m[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 99999) {
      out.push(`${label}.${k}: giá trị "${String(v)}" (${typeof v}) không hợp lệ (cần số 0..99999)`);
    }
  }
  return out;
};

/**
 * Mô phỏng phía client các điều kiện của rule khi ghi báo cáo ngày / mục tiêu kỳ,
 * rồi in kết quả ra console để biết điều kiện nào không đạt. Không thay đổi dữ liệu.
 */
export async function diagnoseWriteDenied(
  kind: 'dailyReports' | 'periodGoals',
  docId: string,
  payload: Record<string, any>,
  error: unknown
): Promise<void> {
  try {
    const user = auth.currentUser;
    const problems: string[] = [];
    if (!user) problems.push('Chưa đăng nhập Firebase (auth.currentUser = null)');

    if (user) {
      if (payload.uid !== user.uid) problems.push(`payload.uid (${payload.uid}) khác request.auth.uid (${user.uid})`);
      if (!docId.startsWith(`${user.uid}_`)) problems.push(`id "${docId}" không bắt đầu bằng "${user.uid}_"`);
    }

    if (kind === 'dailyReports') {
      Object.keys(payload).forEach((k) => {
        if (!REPORT_KEYS.includes(k)) problems.push(`payload có khóa lạ "${k}"`);
      });
      ['uid', 'date', 'month', 'year', 'goals', 'results'].forEach((k) => {
        if (!(k in payload)) problems.push(`payload thiếu khóa bắt buộc "${k}"`);
      });
      if (typeof payload.companyCode === 'string' && payload.companyCode.length > 30) problems.push('companyCode dài hơn 30 ký tự');
      if (typeof payload.areaCode === 'string' && payload.areaCode.length > 30) problems.push('areaCode dài hơn 30 ký tự');
      if (typeof payload.unitCode === 'string' && payload.unitCode.length > 50) problems.push('unitCode dài hơn 50 ký tự');
      problems.push(...metricMapProblems('goals', payload.goals), ...metricMapProblems('results', payload.results));
    } else {
      ['uid', 'periodType', 'periodKey', 'goals'].forEach((k) => {
        if (!(k in payload)) problems.push(`payload thiếu khóa bắt buộc "${k}"`);
      });
      problems.push(...metricMapProblems('goals', payload.goals));
    }

    let server: any = null;
    let tokenInfo: any = null;
    if (user) {
      try {
        const snap = await getDocFromServer(doc(db, 'users', user.uid));
        server = snap.exists() ? snap.data() : null;
        if (!snap.exists()) problems.push('users/{uid} KHÔNG tồn tại: isApprovedUser() sẽ sai');
        else if (server.approvalStatus && server.approvalStatus !== 'APPROVED')
          problems.push(`users/{uid}.approvalStatus = ${server.approvalStatus} (rule chỉ cho APPROVED hoặc không có trường)`);
      } catch (e) {
        problems.push(`Không đọc được users/{uid}: ${(e as any)?.message || e}`);
      }
      try {
        const t = await user.getIdTokenResult(true);
        tokenInfo = { email: t.claims.email, email_verified: t.claims.email_verified, provider: t.signInProvider };
      } catch {
        /* bỏ qua */
      }
    }

    // Tài liệu đã tồn tại với uid khác (chiếm trước ID) -> không ghi đè được
    if (user) {
      try {
        const existing = await getDocFromServer(doc(db, kind, docId));
        if (existing.exists()) {
          const owner = (existing.data() as any).uid;
          if (owner !== user.uid) problems.push(`Tài liệu ${kind}/${docId} đã tồn tại với uid khác (${owner})`);
        }
      } catch {
        /* đọc bị chặn: bỏ qua */
      }
    }

    console.groupCollapsed(`[Chẩn đoán ghi ${kind}] bị từ chối`);
    console.warn('Lỗi gốc:', error);
    console.warn('Database:', FIRESTORE_DATABASE_ID, '| Đường dẫn:', `${kind}/${docId}`);
    console.warn('Token:', tokenInfo);
    console.warn('users/{uid} trên server:', server && {
      role: server.role,
      approvalStatus: server.approvalStatus ?? '(không có trường)',
      companyCode: server.companyCode,
      areaCode: server.areaCode,
      managedCompanyCodes: server.managedCompanyCodes ?? [],
    });
    console.warn('Payload gửi lên:', payload);
    if (problems.length === 0) {
      console.warn(
        'Không phát hiện điều kiện nào sai ở phía client. Khả năng cao: rule trên Firebase KHÔNG phải bản trong dự án, hoặc đã Publish sang database khác.'
      );
    } else {
      console.warn('Các điều kiện không đạt:\n- ' + problems.join('\n- '));
    }
    console.groupEnd();
  } catch (e) {
    console.warn('[Chẩn đoán ghi] lỗi khi chẩn đoán:', e);
  }
}
