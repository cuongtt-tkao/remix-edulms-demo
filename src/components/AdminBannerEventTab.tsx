import React, { useState, useRef, useMemo } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Pencil,
  Upload,
  Save,
  Calendar,
  Trophy,
  Users,
  CheckCircle2,
  Pin,
  Sparkles,
  Search,
  Check,
  X,
  Sliders,
  Eye,
  FileText,
  Clock,
} from 'lucide-react';
import {
  SystemBannerConfig,
  BannerSlide,
  FestivalEvent,
  Member,
  Company,
  Area,
  DailyReportMetrics,
  DAILY_METRIC_DEFINITIONS,
  DEFAULT_EVENT_WEIGHTS,
} from '../types/edulms';
import { SPOTLIGHT_COVERS } from './HeroBanner';
import { compressImageFile } from '../utils/imageUtils';

interface AdminBannerEventTabProps {
  bannerConfig: SystemBannerConfig | null;
  events: FestivalEvent[];
  members: Member[];
  companies: Company[];
  areas: Area[];
  onSaveBannerConfig: (config: SystemBannerConfig) => Promise<void>;
  onSaveEvent: (event: FestivalEvent) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onShowNotification: (msg: string) => void;
}

const DEFAULT_BANNER_CONFIG: SystemBannerConfig = {
  mainTitle: 'HÀNH THỰC LỤC',
  highlightTitle: 'VINH DANH THI ĐUA',
  description:
    'Hệ thống ghi nhận báo cáo hằng ngày, theo dõi tiến độ mục tiêu và tôn vinh thành tích cá nhân, khu vực, công ty.',
  tagline: 'Báo cáo hằng ngày • Lan tỏa thực hành • Tiến bước vững vàng',
  slides: SPOTLIGHT_COVERS.map((c) => ({
    id: String(c.id),
    title: c.title,
    subtitle: c.subtitle,
    url: c.url,
  })),
  autoSlideSeconds: 7,
};

export const AdminBannerEventTab: React.FC<AdminBannerEventTabProps> = ({
  bannerConfig,
  events,
  members,
  companies,
  areas,
  onSaveBannerConfig,
  onSaveEvent,
  onDeleteEvent,
  onShowNotification,
}) => {
  const [subTab, setSubTab] = useState<'EVENTS' | 'BANNER'>('EVENTS');

  // ---------- BANNER STATE ----------
  const initialBanner = bannerConfig || DEFAULT_BANNER_CONFIG;
  const [mainTitle, setMainTitle] = useState(initialBanner.mainTitle);
  const [highlightTitle, setHighlightTitle] = useState(initialBanner.highlightTitle);
  const [description, setDescription] = useState(initialBanner.description);
  const [tagline, setTagline] = useState(initialBanner.tagline);
  const [autoSlideSeconds, setAutoSlideSeconds] = useState(initialBanner.autoSlideSeconds || 7);
  const [slides, setSlides] = useState<BannerSlide[]>(
    initialBanner.slides?.length ? initialBanner.slides : DEFAULT_BANNER_CONFIG.slides
  );
  const [newSlideUrl, setNewSlideUrl] = useState('');
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideSubtitle, setNewSlideSubtitle] = useState('');
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (bannerConfig) {
      setMainTitle(bannerConfig.mainTitle || DEFAULT_BANNER_CONFIG.mainTitle);
      setHighlightTitle(bannerConfig.highlightTitle || DEFAULT_BANNER_CONFIG.highlightTitle);
      setDescription(bannerConfig.description || DEFAULT_BANNER_CONFIG.description);
      setTagline(bannerConfig.tagline || DEFAULT_BANNER_CONFIG.tagline);
      setAutoSlideSeconds(bannerConfig.autoSlideSeconds || 7);
      if (bannerConfig.slides?.length) setSlides(bannerConfig.slides);
    }
  }, [bannerConfig]);

  const handleBannerFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1280, 0.72);
      const slide: BannerSlide = {
        id: `slide-${Date.now()}`,
        title: newSlideTitle.trim() || file.name.replace(/\.[^/.]+$/, ''),
        subtitle: newSlideSubtitle.trim() || 'Ảnh bìa chiến dịch Hành Thực Lục',
        url: compressed,
      };
      setSlides((prev) => [...prev, slide]);
      setNewSlideTitle('');
      setNewSlideSubtitle('');
      onShowNotification('Đã tải & nén ảnh bìa thành công! Nhớ bấm "Lưu cấu hình Banner".');
    } catch (err: any) {
      onShowNotification(err?.message || 'Không thể xử lý tệp ảnh.');
    } finally {
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  const handleAddSlideByUrl = () => {
    if (!newSlideUrl.trim()) {
      onShowNotification('Vui lòng nhập link ảnh hoặc chọn file ảnh từ máy.');
      return;
    }
    const slide: BannerSlide = {
      id: `slide-${Date.now()}`,
      title: newSlideTitle.trim() || 'Ảnh bìa mới',
      subtitle: newSlideSubtitle.trim() || 'Chiến dịch thi đua Hành Thực Lục',
      url: newSlideUrl.trim(),
    };
    setSlides((prev) => [...prev, slide]);
    setNewSlideUrl('');
    setNewSlideTitle('');
    setNewSlideSubtitle('');
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slides.length === 0) {
      onShowNotification('Banner cần ít nhất 1 ảnh nền.');
      return;
    }
    setIsSavingBanner(true);
    try {
      await onSaveBannerConfig({
        mainTitle: mainTitle.trim() || DEFAULT_BANNER_CONFIG.mainTitle,
        highlightTitle: highlightTitle.trim() || DEFAULT_BANNER_CONFIG.highlightTitle,
        description: description.trim(),
        tagline: tagline.trim(),
        slides,
        autoSlideSeconds: Math.max(3, Number(autoSlideSeconds) || 7),
        updatedAt: new Date().toISOString(),
      });
      onShowNotification('Đã cập nhật Banner trang chủ thành công!');
    } catch (err: any) {
      onShowNotification(`Lỗi lưu Banner: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingBanner(false);
    }
  };

  // ---------- EVENT FORM STATE ----------
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  })();

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evDescription, setEvDescription] = useState('');
  const [evRulesText, setEvRulesText] = useState('');
  const [evStartDate, setEvStartDate] = useState(today);
  const [evEndDate, setEvEndDate] = useState(nextMonth);
  const [evBannerUrl, setEvBannerUrl] = useState('');
  const [evIsActive, setEvIsActive] = useState(true);
  const [evIsPinned, setEvIsPinned] = useState(true);
  const [evRestrictParticipants, setEvRestrictParticipants] = useState(true);
  const [evParticipantIds, setEvParticipantIds] = useState<string[]>([]);
  const [evWeights, setEvWeights] = useState<DailyReportMetrics>({ ...DEFAULT_EVENT_WEIGHTS });
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantCompanyFilter, setParticipantCompanyFilter] = useState('ALL');
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const eventFileInputRef = useRef<HTMLInputElement>(null);

  const openCreateEvent = () => {
    setEditingEventId(null);
    setEvTitle('');
    setEvDescription('');
    setEvRulesText('Điểm thi đua tính tự động theo kết quả báo cáo hằng ngày trong thời gian diễn ra chiến dịch.');
    setEvStartDate(today);
    setEvEndDate(nextMonth);
    setEvBannerUrl('');
    setEvIsActive(true);
    setEvIsPinned(true);
    setEvRestrictParticipants(true);
    setEvParticipantIds(members.filter((m) => m.active).map((m) => m.id));
    setEvWeights({ ...DEFAULT_EVENT_WEIGHTS });
    setParticipantSearch('');
    setParticipantCompanyFilter('ALL');
    setIsEventModalOpen(true);
  };

  const openEditEvent = (ev: FestivalEvent) => {
    setEditingEventId(ev.id);
    setEvTitle(ev.title);
    setEvDescription(ev.description || '');
    setEvRulesText(ev.rulesText || '');
    setEvStartDate(ev.startDate || today);
    setEvEndDate(ev.endDate || nextMonth);
    setEvBannerUrl(ev.bannerUrl || '');
    setEvIsActive(ev.isActive);
    setEvIsPinned(ev.isPinned);
    setEvRestrictParticipants(ev.restrictParticipants);
    setEvParticipantIds(ev.participantIds || []);
    setEvWeights({ ...DEFAULT_EVENT_WEIGHTS, ...(ev.weights || {}) });
    setParticipantSearch('');
    setParticipantCompanyFilter('ALL');
    setIsEventModalOpen(true);
  };

  const handleEventBannerPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1200, 0.72);
      setEvBannerUrl(compressed);
      onShowNotification('Đã tải ảnh bìa sự kiện từ máy!');
    } catch (err: any) {
      onShowNotification(err?.message || 'Không đọc được tệp ảnh.');
    } finally {
      if (eventFileInputRef.current) eventFileInputRef.current.value = '';
    }
  };

  const filteredParticipantCandidates = useMemo(() => {
    return members.filter((m) => {
      if (participantCompanyFilter !== 'ALL' && m.companyCode !== participantCompanyFilter) {
        return false;
      }
      if (participantSearch.trim()) {
        const q = participantSearch.toLowerCase().trim();
        return (
          m.fullName.toLowerCase().includes(q) ||
          m.companyCode.toLowerCase().includes(q) ||
          m.areaCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [members, participantCompanyFilter, participantSearch]);

  const toggleParticipant = (memberId: string) => {
    setEvParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSelectFilteredParticipants = () => {
    const filteredIds = filteredParticipantCandidates.map((m) => m.id);
    setEvParticipantIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDeselectFilteredParticipants = () => {
    const filteredSet = new Set(filteredParticipantCandidates.map((m) => m.id));
    setEvParticipantIds((prev) => prev.filter((id) => !filteredSet.has(id)));
  };

  const handleSaveEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim()) {
      onShowNotification('Vui lòng nhập tên chiến dịch Event.');
      return;
    }
    if (evStartDate > evEndDate) {
      onShowNotification('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
      return;
    }

    setIsSavingEvent(true);
    try {
      const nowIso = new Date().toISOString();
      const existing = editingEventId ? events.find((x) => x.id === editingEventId) : null;
      const payload: FestivalEvent = {
        id: editingEventId || `evt-${Date.now()}`,
        title: evTitle.trim(),
        description: evDescription.trim(),
        rulesText: evRulesText.trim(),
        bannerUrl: evBannerUrl.trim() || undefined,
        startDate: evStartDate,
        endDate: evEndDate,
        isActive: evIsActive,
        isPinned: evIsPinned,
        restrictParticipants: evRestrictParticipants,
        participantIds: evParticipantIds,
        weights: evWeights,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      await onSaveEvent(payload);
      setIsEventModalOpen(false);
      onShowNotification(
        editingEventId ? 'Đã cập nhật chiến dịch Event!' : 'Đã tạo chiến dịch Event mới!'
      );
    } catch (err: any) {
      onShowNotification(`Lỗi lưu Event: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const getEventStatusBadge = (ev: FestivalEvent) => {
    if (!ev.isActive) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Tạm ngưng
        </span>
      );
    }
    if (today < ev.startDate) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
          Sắp diễn ra
        </span>
      );
    }
    if (today > ev.endDate) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Đã kết thúc
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
        Đang diễn ra
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hidden file inputs */}
      <input
        ref={bannerFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBannerFilePick}
        className="hidden"
      />
      <input
        ref={eventFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleEventBannerPick}
        className="hidden"
      />

      {/* Sub-tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('EVENTS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === 'EVENTS'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Chiến dịch Event ({events.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('BANNER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === 'BANNER'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-sky-400" />
            <span>Chỉnh sửa Banner Trang chủ</span>
          </button>
        </div>

        {subTab === 'EVENTS' && (
          <button
            type="button"
            onClick={openCreateEvent}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Event mới</span>
          </button>
        )}
      </div>

      {/* SUB-TAB 1: EVENTS */}
      {subTab === 'EVENTS' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                  Chưa có chiến dịch Event nào
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Tạo chiến dịch Event để cấu hình thời gian, thể lệ quy đổi điểm từ báo cáo hằng ngày và lựa chọn danh sách thành viên tham gia.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateEvent}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                + Tạo chiến dịch đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs flex flex-col"
                >
                  {ev.bannerUrl && (
                    <div className="h-32 w-full bg-slate-900 relative overflow-hidden">
                      <img
                        src={ev.bannerUrl}
                        alt={ev.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                      {ev.isPinned && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                          <Pin className="w-3 h-3" />
                          Ghim trang chủ
                        </span>
                      )}
                    </div>
                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        {getEventStatusBadge(ev)}
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {ev.startDate.split('-').reverse().join('/')} →{' '}
                          {ev.endDate.split('-').reverse().join('/')}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {ev.title}
                      </h4>
                      {ev.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    {/* Event Summary Chips */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {ev.restrictParticipants
                            ? `Đã duyệt: ${ev.participantIds?.length || 0} thành viên`
                            : 'Tất cả thành viên'}
                        </span>
                        {DAILY_METRIC_DEFINITIONS.map((m) => (
                          <span
                            key={m.key}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold"
                          >
                            {m.label}: +{ev.weights?.[m.key] ?? DEFAULT_EVENT_WEIGHTS[m.key]}đ
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openEditEvent(ev)}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(ev.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: BANNER EDITOR */}
      {subTab === 'BANNER' && (
        <form onSubmit={handleSaveBanner} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Banner Text Settings */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Nội dung chữ trên Banner</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nhãn khẩu hiệu nhỏ (Tagline)
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tiêu đề dòng 1
                    </label>
                    <input
                      type="text"
                      value={mainTitle}
                      onChange={(e) => setMainTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tiêu đề nổi bật (Màu vàng)
                    </label>
                    <input
                      type="text"
                      value={highlightTitle}
                      onChange={(e) => setHighlightTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mô tả ngắn dưới tiêu đề
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thời gian tự đổi ảnh nền (giây)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={autoSlideSeconds}
                    onChange={(e) => setAutoSlideSeconds(Number(e.target.value) || 7)}
                    className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Banner Slides Upload & Manager */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  <span>Danh sách ảnh nền Banner ({slides.length})</span>
                </h4>

                <button
                  type="button"
                  onClick={() => bannerFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn ảnh từ máy</span>
                </button>
              </div>

              {/* Add by URL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Tiêu đề ảnh (tùy chọn)"
                  value={newSlideTitle}
                  onChange={(e) => setNewSlideTitle(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                <input
                  type="url"
                  placeholder="Hoặc dán link URL ảnh..."
                  value={newSlideUrl}
                  onChange={(e) => setNewSlideUrl(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddSlideByUrl}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition cursor-pointer"
                >
                  + Thêm từ link
                </button>
              </div>

              {/* Slides Preview List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {slides.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <img
                      src={s.url}
                      alt={s.title}
                      className="w-16 h-11 rounded-lg object-cover shrink-0 bg-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        #{idx + 1} • {s.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{s.subtitle}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSlides((prev) => prev.filter((item) => item.id !== s.id))}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Xóa ảnh này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingBanner}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingBanner ? 'Đang lưu Banner...' : 'Lưu cấu hình Banner'}</span>
            </button>
          </div>
        </form>
      )}

      {/* EVENT CREATE / EDIT MODAL */}
      {isEventModalOpen && (
        <div
          onClick={() => setIsEventModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {editingEventId ? 'Chỉnh sửa Chiến dịch Event' : 'Tạo Chiến dịch Event mới'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cấu hình thời gian, thể lệ tính điểm và danh sách người tham gia
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEventSubmit} className="space-y-5 text-xs">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên chiến dịch Event <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Chiến dịch Hành Thực Tháng 11..."
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    required
                    value={evStartDate}
                    onChange={(e) => setEvStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    required
                    value={evEndDate}
                    onChange={(e) => setEvEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Event Banner Upload / URL */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-200">
                    Ảnh bìa Event (hỗ trợ tải từ máy tính/điện thoại)
                  </label>
                  <button
                    type="button"
                    onClick={() => eventFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn file ảnh</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {evBannerUrl && (
                    <img
                      src={evBannerUrl}
                      alt="Event cover"
                      className="w-24 h-14 rounded-xl object-cover shrink-0 border border-slate-200"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Hoặc dán link URL ảnh bìa sự kiện..."
                    value={evBannerUrl}
                    onChange={(e) => setEvBannerUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Description & Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nội dung chiến dịch
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Mô tả mục đích, ý nghĩa sự kiện..."
                    value={evDescription}
                    onChange={(e) => setEvDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thể lệ & Ghi chú chi tiết
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Quy định xét thưởng, cách tính điểm..."
                    value={evRulesText}
                    onChange={(e) => setEvRulesText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Point Weights per Daily Metric */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-3">
                <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Cấu hình điểm quy đổi cho từng chỉ số Báo cáo hằng ngày</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {DAILY_METRIC_DEFINITIONS.map((m) => (
                    <div
                      key={m.key}
                      className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-amber-200/70 dark:border-slate-700 text-center"
                    >
                      <div className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 mb-1">
                        {m.label}
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={evWeights[m.key] ?? 0}
                        onChange={(e) =>
                          setEvWeights((prev) => ({
                            ...prev,
                            [m.key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                          }))
                        }
                        className="w-full text-center py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-amber-700 dark:text-amber-300 font-black"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Participant Selection (Anti-spam / Approved Roster) */}
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/80 dark:border-blue-800/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>
                        Lựa chọn người tham gia sự kiện ({evParticipantIds.length}/{members.length})
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                      Chỉ thành viên được chọn mới tính vào bảng xếp hạng sự kiện, tránh tài khoản dư làm sai lệch điểm trung bình.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={evRestrictParticipants}
                      onChange={(e) => setEvRestrictParticipants(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Giới hạn theo DS chọn</span>
                  </label>
                </div>

                {evRestrictParticipants && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Tìm tên, công ty, khu vực..."
                          value={participantSearch}
                          onChange={(e) => setParticipantSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>

                      <select
                        value={participantCompanyFilter}
                        onChange={(e) => setParticipantCompanyFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-semibold"
                      >
                        <option value="ALL">Tất cả Công ty</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleSelectFilteredParticipants}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectFilteredParticipants}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1">
                      {filteredParticipantCandidates.map((m) => {
                        const checked = evParticipantIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition ${
                              checked
                                ? 'bg-blue-100/70 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleParticipant(m.id)}
                              className="rounded text-blue-600"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold truncate">{m.fullName}</div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {m.companyCode} • KV {m.areaCode}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Toggles */}
              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evIsActive}
                    onChange={(e) => setEvIsActive(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Kích hoạt sự kiện</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evIsPinned}
                    onChange={(e) => setEvIsPinned(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Ghim làm sự kiện chính trên trang chủ</span>
                </label>
              </div>

              {/* Submit Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEvent}
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSavingEvent
                    ? 'Đang lưu...'
                    : editingEventId
                    ? 'Lưu thay đổi Event'
                    : 'Tạo Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
