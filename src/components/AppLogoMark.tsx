import React, { useState, useEffect } from 'react';
import { AppLogoConfig, AppLogoPreset, DEFAULT_APP_LOGO_CONFIG } from '../types/edulms';

export interface AppLogoMarkProps {
  logoConfig?: AppLogoConfig | null;
  presetOverride?: AppLogoPreset;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const APP_LOGO_PRESETS: Array<{
  preset: 'BOOK_CLASSIC' | 'BOOK_MODERN';
  title: string;
  subtitle: string;
  description: string;
}> = [
  {
    preset: 'BOOK_CLASSIC',
    title: 'Mẫu 1 · Sách Cổ Điển',
    subtitle: 'Navy & Vàng Kim',
    description: 'Cuốn sách mở trang trọng với dây đánh dấu đỏ thắm trên nền xanh navy viền vàng.',
  },
  {
    preset: 'BOOK_MODERN',
    title: 'Mẫu 2 · Sách Hiện Đại',
    subtitle: 'Sapphire & Chàm Tối Giản',
    description: 'Biểu tượng cuốn sách nét mảnh tinh gọn trên nền gradient xanh dương – chàm hiện đại.',
  },
];

export function isSafeLogoImageUrl(raw?: string | null): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith('/')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(trimmed)) return true;
  return false;
}

const SIZE_CLASSES: Record<NonNullable<AppLogoMarkProps['size']>, { box: string; radius: string; innerRadius: string; icon: string }> = {
  sm: { box: 'w-8 h-8', radius: 'rounded-xl', innerRadius: 'rounded-[10px]', icon: 'w-4.5 h-4.5' },
  md: { box: 'w-9 h-9', radius: 'rounded-xl', innerRadius: 'rounded-[10px]', icon: 'w-5 h-5' },
  lg: { box: 'w-12 h-12', radius: 'rounded-2xl', innerRadius: 'rounded-[14px]', icon: 'w-7 h-7' },
  xl: { box: 'w-14 h-14', radius: 'rounded-2xl', innerRadius: 'rounded-[14px]', icon: 'w-8 h-8' },
};

export const AppLogoMark: React.FC<AppLogoMarkProps> = ({
  logoConfig,
  presetOverride,
  size = 'md',
  className = '',
}) => {
  const effectivePreset: AppLogoPreset =
    presetOverride || logoConfig?.preset || DEFAULT_APP_LOGO_CONFIG.preset;
  const customUrl = logoConfig?.customUrl?.trim() || '';
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [customUrl, effectivePreset]);

  const sz = SIZE_CLASSES[size];

  if (effectivePreset === 'CUSTOM' && isSafeLogoImageUrl(customUrl) && !imgError) {
    return (
      <div
        className={`${sz.box} ${sz.radius} bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      >
        <img
          src={customUrl}
          alt="Logo Hành Thực Lục"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (effectivePreset === 'BOOK_MODERN') {
    return (
      <div
        className={`${sz.box} ${sz.radius} bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-[1.5px] shadow-sm ring-1 ring-blue-300/50 dark:ring-blue-500/30 shrink-0 ${className}`}
      >
        <div
          className={`w-full h-full ${sz.innerRadius} bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 flex items-center justify-center`}
        >
          <svg
            className={`${sz.icon} text-white`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Modern crisp open book */}
            <path
              d="M3.5 6.2C3.5 5.3 4.2 4.6 5.1 4.6C7.6 4.6 10.1 5.3 12 6.8C13.9 5.3 16.4 4.6 18.9 4.6C19.8 4.6 20.5 5.3 20.5 6.2V17.4C20.5 18.2 19.9 18.9 19.1 18.9C16.6 18.9 14.1 19.5 12 20.7C9.9 19.5 7.4 18.9 4.9 18.9C4.1 18.9 3.5 18.2 3.5 17.4V6.2Z"
              fill="white"
              fillOpacity="0.16"
              stroke="white"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M12 6.8V20.5"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <path
              d="M6.4 9.2H9.6M6.4 12.2H9.4M14.4 9.2H17.6M14.6 12.2H17.6"
              stroke="#bae6fd"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // BOOK_CLASSIC (mặc định): Sách Cổ Điển nền Navy + viền vàng + dây đánh dấu
  return (
    <div
      className={`${sz.box} ${sz.radius} bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-[1.5px] shadow-sm ring-1 ring-amber-300/60 dark:ring-amber-500/40 shrink-0 ${className}`}
    >
      <div
        className={`w-full h-full ${sz.innerRadius} bg-gradient-to-br from-slate-950 via-[#172554] to-slate-900 flex items-center justify-center`}
      >
        <svg
          className={sz.icon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Golden outer book cover */}
          <path
            d="M3 6.8C5.4 5.9 8.7 6 12 7.6C15.3 6 18.6 5.9 21 6.8V18.3C18.5 17.4 15.2 17.6 12 19.3C8.8 17.6 5.5 17.4 3 18.3V6.8Z"
            fill="#f59e0b"
            fillOpacity="0.28"
            stroke="#fde047"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Open ivory pages */}
          <path
            d="M4.6 5.9C7 5.2 9.7 5.7 12 7.3C14.3 5.7 17 5.2 19.4 5.9V16.6C17 15.9 14.3 16.4 12 17.9C9.7 16.4 7 15.9 4.6 16.6V5.9Z"
            fill="#fef3c7"
            fillOpacity="0.92"
            stroke="#fef08a"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* Spine & scripture lines */}
          <line x1="12" y1="7.2" x2="12" y2="18.1" stroke="#92400e" strokeWidth="1.25" strokeLinecap="round" />
          <path
            d="M6.6 9.3L10 9.8M6.6 12L10 12.5M14 9.8L17.4 9.3M14 12.5L17.4 12"
            stroke="#1e3a8a"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Crimson bookmark ribbon */}
          <path
            d="M11.1 17.6H12.9V21.5L12 20.5L11.1 21.5V17.6Z"
            fill="#e11d48"
            stroke="#fef08a"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
