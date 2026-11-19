import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  Award,
  Users,
  Sparkles,
} from 'lucide-react';
import heroSpotlightImage from '../assets/images/hero_spotlight_1792173345769.jpg';
import {
  SystemBannerConfig,
  FestivalEvent,
  DEFAULT_BANNER_VISIBILITY,
} from '../types/edulms';

interface HeroBannerProps {
  festivalName?: string;
  bannerConfig?: SystemBannerConfig | null;
  activeEvent?: FestivalEvent | null;
  onOpenRules?: () => void;
}

export const SPOTLIGHT_COVERS = [
  {
    id: 1,
    title: 'Hành Thực Lục — Chiến dịch Thi đua',
    subtitle: 'Ghi nhận báo cáo hằng ngày và lan tỏa tinh thần thực hành bền bỉ.',
    url: heroSpotlightImage,
  },
  {
    id: 2,
    title: 'Kết nối Khu vực & Công ty',
    subtitle: 'Đồng hành theo sát mục tiêu ngày, tháng, năm theo thời gian thực.',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80',
  },
  {
    id: 3,
    title: 'Vinh danh & Đào tạo Edu',
    subtitle: 'Ghi nhận đóng góp cá nhân và đồng bộ lộ trình đào tạo hàng tuần.',
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&auto=format&fit=crop&q=80',
  },
];

export const HeroBanner: React.FC<HeroBannerProps> = ({
  festivalName,
  bannerConfig,
  activeEvent,
  onOpenRules,
}) => {
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const slides =
    bannerConfig?.slides && bannerConfig.slides.length > 0
      ? bannerConfig.slides
      : SPOTLIGHT_COVERS.map((c) => ({
          id: String(c.id),
          title: c.title,
          subtitle: c.subtitle,
          url: c.url,
        }));

  const visibility = {
    ...DEFAULT_BANNER_VISIBILITY,
    ...(bannerConfig?.visibility || {}),
  };

  const slideIntervalMs = Math.max(3, bannerConfig?.autoSlideSeconds || 7) * 1000;
  const heroTitle = bannerConfig?.mainTitle || festivalName || 'HÀNH THỰC LỤC';
  const heroHighlight = bannerConfig?.highlightTitle || 'VINH DANH THI ĐUA';
  const heroTagline =
    bannerConfig?.tagline || 'Báo cáo hằng ngày · Lan tỏa thực hành · Tiến bước vững vàng';
  const heroDescription =
    bannerConfig?.description ||
    'Ghi nhận báo cáo hằng ngày, theo dõi tiến độ mục tiêu và vinh danh thành tích thi đua.';
  const actionStripText =
    bannerConfig?.actionStripLabel?.trim() ||
    (activeEvent ? `Xem thể lệ: ${activeEvent.title}` : 'Xem thể lệ & quy đổi điểm thi đua');

  useEffect(() => {
    if (currentCoverIndex >= slides.length) {
      setCurrentCoverIndex(0);
    }
  }, [slides.length, currentCoverIndex]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % slides.length);
    }, slideIntervalMs);
    return () => clearInterval(timer);
  }, [slides.length, slideIntervalMs]);

  const handlePrevCover = () => {
    setCurrentCoverIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNextCover = () => {
    setCurrentCoverIndex((prev) => (prev + 1) % slides.length);
  };

  const formatDate = (d: string) => d.split('-').reverse().join('/');

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full pt-2 sm:pt-3">
      <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-slate-200/80 dark:border-slate-800 bg-slate-950 select-none">
        {/* Top Visual Banner Area */}
        <div
          className={`relative w-full overflow-hidden flex items-center ${
            visibility.showDescription || visibility.showRightCard
              ? 'min-h-[140px] sm:min-h-[220px] md:min-h-[260px]'
              : 'min-h-[120px] sm:min-h-[175px]'
          }`}
        >
          {/* Background Slides */}
          {slides.map((cover, idx) => {
            const slideKey = cover.id || String(idx);
            const hasFailed = failedImages[slideKey];
            return (
              <div
                key={slideKey}
                className={`absolute inset-0 z-0 transition-opacity duration-700 ease-in-out ${
                  idx === currentCoverIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {cover.url && !hasFailed ? (
                  <img
                    src={cover.url}
                    alt={cover.title || heroTitle}
                    onError={() => setFailedImages((prev) => ({ ...prev, [slideKey]: true }))}
                    className={`w-full h-full object-cover object-center transition-transform duration-7000 ease-linear ${
                      idx === currentCoverIndex ? 'scale-105' : 'scale-100'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-sky-800 via-blue-900 to-indigo-950" />
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-slate-950/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/25" />
              </div>
            );
          })}

          {/* Content Container */}
          <div className="relative z-10 w-full px-4 sm:px-8 py-3.5 sm:py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-5">
              {/* Left Column: Clean Title + Optional Highlight & Description */}
              <div className="max-w-2xl text-left space-y-1 sm:space-y-2">
                {visibility.showHighlight && heroHighlight && (
                  <div className="font-script text-base sm:text-2xl md:text-3xl text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] tracking-wide">
                    {heroHighlight}
                  </div>
                )}

                <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-wide uppercase font-cinzel leading-tight">
                  <span className="gold-gradient-title inline-block drop-shadow-[0_4px_14px_rgba(245,158,11,0.35)]">
                    {heroTitle}
                  </span>
                </h1>

                {visibility.showDescription && heroDescription && (
                  <p className="hidden sm:block text-xs sm:text-sm text-slate-200/95 max-w-xl leading-relaxed">
                    {heroDescription}
                  </p>
                )}

                {/* Slide Indicator Dots + Controls */}
                {visibility.showSlideControls && slides.length > 1 && (
                  <div className="flex items-center gap-2 pt-1 sm:pt-2">
                    <div className="flex items-center gap-1.5">
                      {slides.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCurrentCoverIndex(i)}
                          className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                            i === currentCoverIndex
                              ? 'w-5 bg-amber-400'
                              : 'w-2 bg-white/35 hover:bg-white/65'
                          }`}
                          aria-label={`Chuyển tới ảnh bìa ${i + 1}`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1 ml-1.5">
                      <button
                        type="button"
                        onClick={handlePrevCover}
                        aria-label="Ảnh trước"
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center border border-white/15 transition cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextCover}
                        aria-label="Ảnh tiếp theo"
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center border border-white/15 transition cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Optional Pinned Event / Tagline Card */}
              {visibility.showRightCard && (
                <div className="flex flex-col items-stretch md:items-end w-full md:max-w-xs lg:max-w-sm">
                  {activeEvent ? (
                    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl sm:rounded-2xl border border-amber-400/35 shadow-xl overflow-hidden text-left">
                      <div className="p-2.5 sm:p-4 space-y-1 sm:space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-amber-300 uppercase tracking-wider">
                          <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                          <span>Chiến dịch đang mở</span>
                        </div>

                        <h3 className="text-xs sm:text-base font-black text-white leading-snug line-clamp-1 sm:line-clamp-2">
                          {activeEvent.title}
                        </h3>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 sm:pt-2 border-t border-white/10 text-[10px] sm:text-[11px] text-amber-200 tabular-nums">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                            {formatDate(activeEvent.startDate)} → {formatDate(activeEvent.endDate)}
                          </span>
                          {activeEvent.restrictParticipants && (
                            <span className="flex items-center gap-1 text-emerald-300 font-bold">
                              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {activeEvent.participantIds?.length || 0} TV
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden md:block bg-slate-900/75 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 shadow-xl text-left">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Thông điệp thi đua</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-100 font-medium leading-snug">
                        {heroTagline}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Action Strip */}
        {visibility.showActionStrip && (
          <button
            type="button"
            onClick={onOpenRules}
            className="w-full px-4 sm:px-8 py-2 sm:py-2.5 bg-emerald-50 hover:bg-emerald-100/90 dark:bg-slate-800/95 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2 text-left transition cursor-pointer border-t border-emerald-200/60 dark:border-slate-700"
          >
            <span className="text-xs sm:text-sm font-bold truncate">{actionStripText}</span>
            <ArrowRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};
