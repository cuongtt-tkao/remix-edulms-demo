/**
 * Kiểm tra và làm sạch đường dẫn hình ảnh trước khi lưu vào Firestore hoặc render lên DOM.
 * Chỉ cho phép:
 * - Đường dẫn http:// hoặc https:// hợp lệ
 * - Đường dẫn cục bộ bắt đầu bằng "/" (không phải "//")
 * - Ảnh base64 nhúng an toàn (png, jpeg, jpg, webp, gif) — chặn SVG/HTML/javascript:
 */
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[a-zA-Z0-9+/=\s]+$/i;

export function isSafeImageUrl(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  if (SAFE_DATA_IMAGE_RE.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeImageUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  return isSafeImageUrl(trimmed) ? trimmed : '';
}
