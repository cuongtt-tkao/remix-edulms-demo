import { HuongKhiItem } from '../types/edulms';

export interface EncodingWordRule {
  id: string;
  source: string; // Cụm từ nhạy cảm gốc (ví dụ: "Hội Thánh")
  code: string;   // Chữ viết tắt / mã hóa (ví dụ: "HT")
  enabled: boolean;
}

export interface SystemVocabularyConfig {
  id?: string;
  enabled: boolean;
  rules: EncodingWordRule[];
  updatedAt?: string;
  updatedBy?: string;
}

export const GRATITUDE_TTL_MS = 24 * 60 * 60 * 1000; // 1 ngày (24 giờ)

/**
 * Bộ từ điển viết tắt mẫu dùng để mã hóa ngôn từ nhạy cảm trong Nhật ký cảm tạ & Nhật ký turbo.
 * Admin có thể thêm, sửa, bật/tắt hoặc khôi phục bộ mẫu này trong trang Quản trị.
 */
export const DEFAULT_ENCODING_RULES: EncodingWordRule[] = [
  { id: 'r_ht', source: 'Hội Thánh', code: 'HT', enabled: true },
  { id: 'r_dct', source: 'Đức Chúa Trời', code: 'ĐCT', enabled: true },
  { id: 'r_tl', source: 'Tin Lành', code: 'TL', enabled: true },
  { id: 'r_kt', source: 'Kinh Thánh', code: 'KT', enabled: true },
  { id: 'r_cn', source: 'Cầu nguyện', code: 'CN', enabled: true },
  { id: 'r_tg', source: 'Truyền giáo', code: 'TG', enabled: true },
  { id: 'r_bt', source: 'Báp-têm', code: 'BT', enabled: true },
  { id: 'r_bt2', source: 'Báp têm', code: 'BT', enabled: true },
  { id: 'r_md', source: 'Môn đồ', code: 'MĐ', enabled: true },
  { id: 'r_td', source: 'Thánh đồ', code: 'TĐ', enabled: true },
  { id: 'r_ms', source: 'Mục sư', code: 'MS', enabled: true },
  { id: 'r_ts', source: 'Truyền sự', code: 'TS', enabled: true },
  { id: 'r_nq', source: 'Nhà quản', code: 'NQ', enabled: true },
  { id: 'r_hh', source: 'Học hành', code: 'HH', enabled: true },
  { id: 'r_dt', source: 'Đào tạo', code: 'ĐT', enabled: true },
  { id: 'r_gm', source: 'Gợi mở', code: 'GM', enabled: true },
  { id: 'r_kn', source: 'Kết nối', code: 'KN', enabled: true },
  { id: 'r_gt', source: 'Giảng thuyết', code: 'GT', enabled: true },
  { id: 'r_cm', source: 'Chức mừng', code: 'CM', enabled: true },
  { id: 'r_ws', source: 'Worship', code: 'WS', enabled: true },
];

export const DEFAULT_VOCABULARY_CONFIG: SystemVocabularyConfig = {
  enabled: true,
  rules: DEFAULT_ENCODING_RULES.map((r) => ({ ...r })),
};

export function normalizeEncodingRules(rules?: EncodingWordRule[] | null): EncodingWordRule[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return DEFAULT_ENCODING_RULES.map((r) => ({ ...r }));
  }
  return rules
    .filter((r) => r && typeof r.source === 'string' && typeof r.code === 'string')
    .map((r, idx) => ({
      id: r.id || `rule_${idx}`,
      source: r.source.trim(),
      code: r.code.trim(),
      enabled: r.enabled !== false,
    }))
    .filter((r) => r.source.length > 0 && r.code.length > 0);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ranh giới từ tương thích Unicode Tiếng Việt:
 * Không đứng liền chữ cái/số Unicode (p{L} / p{N}) ở hai đầu cụm từ.
 */
function buildRuleRegex(source: string): RegExp {
  const escaped = escapeRegExp(source.trim());
  return new RegExp(`(^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`, 'giu');
}

export interface SensitiveMatchItem {
  source: string;
  code: string;
  count: number;
}

/**
 * Tìm tất cả các cụm từ thuộc từ điển đang xuất hiện trong văn bản (để hiển thị cảnh báo/xem trước).
 */
export function findSensitiveMatches(
  text: string,
  rules: EncodingWordRule[] = DEFAULT_ENCODING_RULES
): SensitiveMatchItem[] {
  if (!text) return [];
  const activeRules = normalizeEncodingRules(rules)
    .filter((r) => r.enabled)
    .sort((a, b) => b.source.length - a.source.length);

  const found: SensitiveMatchItem[] = [];
  const seenSources = new Set<string>();

  for (const rule of activeRules) {
    const key = rule.source.toLowerCase();
    if (seenSources.has(key)) continue;
    const regex = buildRuleRegex(rule.source);
    let count = 0;
    while (regex.exec(text) !== null) {
      count += 1;
    }
    if (count > 0) {
      seenSources.add(key);
      found.push({ source: rule.source, code: rule.code, count });
    }
  }
  return found;
}

/**
 * Tự động thay thế các từ nhạy cảm bằng chữ viết tắt trong từ điển (ưu tiên cụm dài trước).
 */
export function encodeSensitiveText(
  text: string,
  rules: EncodingWordRule[] = DEFAULT_ENCODING_RULES,
  enabled = true
): string {
  if (!text || !enabled) return text;
  const activeRules = normalizeEncodingRules(rules)
    .filter((r) => r.enabled)
    .sort((a, b) => b.source.length - a.source.length);

  let output = text;
  for (const rule of activeRules) {
    const regex = buildRuleRegex(rule.source);
    output = output.replace(regex, (_full, prefix: string) => `${prefix}${rule.code}`);
  }
  return output;
}

/**
 * Kiểm tra bài Nhật ký cảm tạ còn hiệu lực trong 24 giờ không.
 * Bài cũ trước đây không có expiresAtIso vẫn hiển thị bình thường để tương thích ngược.
 */
export function isGratitudePostActive(
  item: Pick<HuongKhiItem, 'journalType' | 'expiresAtIso'>,
  nowMs: number = Date.now()
): boolean {
  if (item.journalType === 'TURBO') return false;
  if (!item.expiresAtIso) return true;
  const expMs = Date.parse(item.expiresAtIso);
  if (Number.isNaN(expMs)) return true;
  return nowMs < expMs;
}

/**
 * Format thời gian còn lại (ví dụ: "Còn 23g 45p" hoặc "Sắp ẩn").
 */
export function formatRemainingExpiry(
  expiresAtIso?: string,
  nowMs: number = Date.now()
): string | null {
  if (!expiresAtIso) return null;
  const expMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expMs)) return null;
  const diff = expMs - nowMs;
  if (diff <= 0) return 'Đã hết hạn';
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) {
    return `Còn ${hours}g ${minutes > 0 ? `${minutes}p` : ''}`.trim();
  }
  return `Còn ${Math.max(1, minutes)} phút`;
}
