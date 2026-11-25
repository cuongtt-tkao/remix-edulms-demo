/**
 * Chống chèn công thức bảng tính (Spreadsheet Formula Injection) khi xuất Excel
 * và kiểm tra an toàn file Excel đầu vào trước khi phân tích.
 */
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;
const NUMERIC_NEGATIVE_RE = /^-\d+(\.\d+)?$/;

export function sanitizeExcelCell(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  const str = String(value);
  if (!str) return '';
  const trimmed = str.trimStart();
  if (
    trimmed.length > 0 &&
    FORMULA_PREFIX_RE.test(trimmed) &&
    !NUMERIC_NEGATIVE_RE.test(trimmed)
  ) {
    return `'${str}`;
  }
  return str;
}

export const MAX_EXCEL_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_EXCEL_PARSE_ROWS = 2000;

export function validateExcelUploadFile(file: File): void {
  const lowerName = (file.name || '').toLowerCase();
  const allowedExt = ['.xlsx', '.xls', '.csv'].some((ext) => lowerName.endsWith(ext));
  if (!allowedExt) {
    throw new Error('Vui lòng chọn tệp Excel hợp lệ (.xlsx, .xls hoặc .csv).');
  }
  if (file.size <= 0) {
    throw new Error('Tệp Excel trống.');
  }
  if (file.size > MAX_EXCEL_UPLOAD_BYTES) {
    throw new Error('Kích thước tệp Excel vượt quá giới hạn an toàn 5MB.');
  }
}

export function sanitizeParsedSheetRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.slice(0, MAX_EXCEL_PARSE_ROWS).map((row) => {
    const clean: Record<string, unknown> = {};
    if (!row || typeof row !== 'object') return clean as T;
    for (const key of Object.keys(row)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      clean[key] = row[key];
    }
    return clean as T;
  });
}
