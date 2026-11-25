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
  Home,
  Megaphone,
  Handshake,
  Heart,
  TrendingUp,
  Star,
} from 'lucide-react';
import {
  SystemBannerConfig,
  BannerSlide,
  BannerVisibilityConfig,
  DEFAULT_BANNER_VISIBILITY,
  FestivalEvent,
  Member,
  Company,
  Area,
  DailyMetricKey,
  DailyReportMetrics,
  DAILY_METRIC_DEFINITIONS,
  DEFAULT_EVENT_WEIGHTS,
} from '../types/edulms';
import { SPOTLIGHT_COVERS } from './HeroBanner';
import { compressImageFile } from '../utils/imageUtils';
import { CustomSelect } from './CustomSelect';
import { isSafeImageUrl, sanitizeImageUrl } from '../utils/urlSanitizer';

const METRIC_ICON_META: Record<
  DailyMetricKey,
  { icon: React.ComponentType<{ className?: string }>; bgCls: string; iconCls: string }
> = {
  kn: { icon: Users, bgCls: 'bg-sky-100 dark:bg-sky-950/70', iconCls: 'text-sky-600 dark:text-sky-400' },
  tham: { icon: Home, bgCls: 'bg-emerald-100 dark:bg-emerald-950/70', iconCls: 'text-emerald-600 dark:text-emerald-400' },
  gm: { icon: Megaphone, bgCls: 'bg-amber-100 dark:bg-amber-950/70', iconCls: 'text-amber-600 dark:text-amber-400' },
  dt: { icon: Handshake, bgCls: 'bg-indigo-100 dark:bg-indigo-950/70', iconCls: 'text-indigo-600 dark:text-indigo-400' },
  hh: { icon: Heart, bgCls: 'bg-rose-100 dark:bg-rose-950/70', iconCls: 'text-rose-500 dark:text-rose-400' },
  kt: { icon: TrendingUp, bgCls: 'bg-emerald-100 dark:bg-emerald-950/70', iconCls: 'text-emerald-600 dark:text-emerald-400' },
  wsNew: { icon: Star, bgCls: 'bg-amber-100 dark:bg-amber-950/70', iconCls: 'text-amber-500 dark:text-amber-400' },
};

interface AdminBannerEventTabProps {
  bannerConfig: SystemBannerConfig | null;
  events: FestivalEvent[];
  members: Member[];
  companies: Company[];
  areas: Area[];
  forcedSection?: 'EVENTS' | 'BANNER';
  onSaveBannerConfig: (config: SystemBannerConfig) => Promise<void>;
  onSaveEvent: (event: FestivalEvent) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onShowNotification: (msg: string) => void;
  defaultWeights?: DailyReportMetrics;
}

const DEFAULT_BANNER_CONFIG: SystemBannerConfig = {
  mainTitle: 'HÀNH THỰC LỤC',
  highlightTitle: 'VINH DANH THI ĐUA',
  description:
    'Hệ thống ghi nhận báo cáo hằng ngày, theo dõi tiến độ mục tiêu và tôn vinh thành tích cá nhân, khu vực, công ty.',
  tagline: 'Báo cáo hằng ngày · Lan tỏa thực hành · Tiến bước vững vàng',
  actionStripLabel: 'Xem thể lệ & quy đổi điểm thi đua',
  visibility: { ...DEFAULT_BANNER_VISIBILITY },
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
  forcedSection,
  onSaveBannerConfig,
  onSaveEvent,
  onDeleteEvent,
  onShowNotification,
  defaultWeights,
}) => {
  const baseWeights = defaultWeights || DEFAULT_EVENT_WEIGHTS;
  const [internalSubTab, setInternalSubTab] = useState<'EVENTS' | 'BANNER'>(
    forcedSection || 'EVENTS'
  );
  const subTab = forcedSection || internalSubTab;

  // ---------- BANNER STATE ----------
  const initialBanner = bannerConfig || DEFAULT_BANNER_CONFIG;
  const [mainTitle, setMainTitle] = useState(initialBanner.mainTitle);
  const [highlightTitle, setHighlightTitle] = useState(initialBanner.highlightTitle);
  const [description, setDescription] = useState(initialBanner.description);
  const [tagline, setTagline] = useState(initialBanner.tagline);
  const [actionStripLabel, setActionStripLabel] = useState(
    initialBanner.actionStripLabel || DEFAULT_BANNER_CONFIG.actionStripLabel || ''
  );
  const [bannerVisibility, setBannerVisibility] = useState<BannerVisibilityConfig>({
    ...DEFAULT_BANNER_VISIBILITY,
    ...(initialBanner.visibility || {}),
  });
  const [autoSlideSecondsText, setAutoSlideSecondsText] = useState(
    String(initialBanner.autoSlideSeconds || 7)
  );
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
      setActionStripLabel(
        bannerConfig.actionStripLabel || DEFAULT_BANNER_CONFIG.actionStripLabel || ''
      );
      setBannerVisibility({
        ...DEFAULT_BANNER_VISIBILITY,
        ...(bannerConfig.visibility || {}),
      });
      setAutoSlideSecondsText(String(bannerConfig.autoSlideSeconds || 7));
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
    const rawUrl = newSlideUrl.trim();
    if (!rawUrl) {
      onShowNotification('Vui lòng nhập link ảnh hoặc chọn file ảnh từ máy.');
      return;
    }
    if (!isSafeImageUrl(rawUrl)) {
      onShowNotification('Link ảnh không hợp lệ (chỉ hỗ trợ https://, http:// hoặc file ảnh tải lên).');
      return;
    }
    const slide: BannerSlide = {
      id: `slide-${Date.now()}`,
      title: newSlideTitle.trim() || 'Ảnh bìa mới',
      subtitle: newSlideSubtitle.trim() || 'Chiến dịch thi đua Hành Thực Lục',
      url: sanitizeImageUrl(rawUrl),
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
        actionStripLabel: actionStripLabel.trim(),
        visibility: bannerVisibility,
        slides,
        autoSlideSeconds: Math.max(3, parseInt(autoSlideSecondsText, 10) || 7),
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
  const toLocalYmd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = toLocalYmd(new Date());
  const nextMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return toLocalYmd(d);
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
  const toWeightTextMap = (w: DailyReportMetrics): Record<DailyMetricKey, string> => ({
    kn: String(w.kn ?? 0),
    tham: String(w.tham ?? 0),
    gm: String(w.gm ?? 0),
    dt: String(w.dt ?? 0),
    hh: String(w.hh ?? 0),
    kt: String(w.kt ?? 0),
    wsNew: String(w.wsNew ?? 0),
  });

  const [evRestrictParticipants, setEvRestrictParticipants] = useState(true);
  const [evParticipantIds, setEvParticipantIds] = useState<string[]>([]);
  const [evWeightsText, setEvWeightsText] = useState<Record<DailyMetricKey, string>>(() =>
    toWeightTextMap(baseWeights)
  );
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantCompanyFilter, setParticipantCompanyFilter] = useState('ALL');
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const eventFileInputRef = useRef<HTMLInputElement>(null);

  const handleEvWeightInputChange = (key: DailyMetricKey, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') {
      setEvWeightsText((prev) => ({ ...prev, [key]: '' }));
      return;
    }
    const normalized = digits.length > 1 ? digits.replace(/^0+/, '') || '0' : digits;
    setEvWeightsText((prev) => ({ ...prev, [key]: normalized }));
  };

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
    setEvWeightsText(toWeightTextMap(baseWeights));
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
    setEvWeightsText(toWeightTextMap({ ...DEFAULT_EVENT_WEIGHTS, ...(ev.weights || {}) }));
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
    const rawEventBanner = evBannerUrl.trim();
    if (rawEventBanner && !isSafeImageUrl(rawEventBanner)) {
      onShowNotification('Link ảnh bìa sự kiện không hợp lệ (chỉ hỗ trợ https://, http:// hoặc file ảnh tải lên).');
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
        bannerUrl: sanitizeImageUrl(rawEventBanner) || undefined,
        startDate: evStartDate,
        endDate: evEndDate,
        isActive: evIsActive,
        isPinned: evIsPinned,
        restrictParticipants: evRestrictParticipants,
        participantIds: evParticipantIds,
        weights: {
          kn: parseInt(evWeightsText.kn, 10) || 0,
          tham: parseInt(evWeightsText.tham, 10) || 0,
          gm: parseInt(evWeightsText.gm, 10) || 0,
          dt: parseInt(evWeightsText.dt, 10) || 0,
          hh: parseInt(evWeightsText.hh, 10) || 0,
          kt: parseInt(evWeightsText.kt, 10) || 0,
          wsNew: parseInt(evWeightsText.wsNew, 10) || 0,
        },
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

      {/* Header / Sub-tab Switcher */}
      {forcedSection === 'EVENTS' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-black text-slate-900 dark:text-white">
              Quản lý Chiến dịch Event ({events.length})
            </span>
          </div>
          <button
            type="button"
            onClick={openCreateEvent}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Event mới</span>
          </button>
        </div>
      ) : forcedSection === 'BANNER' ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInternalSubTab('EVENTS')}
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
              onClick={() => setInternalSubTab('BANNER')}
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
      )}

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
                    Thanh hành động đáy Banner (kiểu thẻ hiện đại)
                  </label>
                  <input
                    type="text"
                    value={actionStripLabel}
                    onChange={(e) => setActionStripLabel(e.target.value)}
                    placeholder="Ví dụ: Xem thể lệ & quy đổi điểm thi đua"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thời gian tự đổi ảnh nền (giây)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={autoSlideSecondsText}
                    placeholder="7"
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '');
                      setAutoSlideSecondsText(d);
                    }}
                    className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-center"
                  />
                </div>

                {/* Visibility Toggles for Banner Elements */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Tùy chọn Ẩn / Hiện chi tiết trên Banner</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        { key: 'showHighlight', label: 'Tiêu đề phụ nổi bật' },
                        { key: 'showDescription', label: 'Mô tả ngắn trên ảnh' },
                        { key: 'showActionStrip', label: 'Thanh hành động đáy Banner' },
                        { key: 'showRightCard', label: 'Thẻ Chiến dịch / Khẩu hiệu bên phải' },
                        { key: 'showSlideControls', label: 'Nút & chấm chuyển ảnh' },
                      ] as const
                    ).map((item) => {
                      const active = bannerVisibility[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setBannerVisibility((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                            active
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <span className="font-semibold text-[11px] truncate">{item.label}</span>
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                              active
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {active ? 'HIỆN' : 'ẨN'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
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

              {/* Point Weights per Daily Metric (Compact Daily-Report-Style Table) */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-3">
                <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Điểm quy đổi cho chiến dịch Event</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-sky-200/80 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <div className="grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_140px] gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-700 to-blue-600 text-white text-[11px] font-extrabold">
                    <div>Hạng mục</div>
                    <div className="text-center">Điểm / lượt</div>
                  </div>
                  <div className="divide-y divide-sky-100 dark:divide-slate-800">
                    {DAILY_METRIC_DEFINITIONS.map((m) => {
                      const iconMeta = METRIC_ICON_META[m.key];
                      const RowIcon = iconMeta.icon;
                      return (
                        <div
                          key={m.key}
                          className="grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_140px] gap-2 items-center px-3.5 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-lg ${iconMeta.bgCls} flex items-center justify-center shrink-0`}
                            >
                              <RowIcon className={`w-3.5 h-3.5 ${iconMeta.iconCls}`} />
                            </div>
                            <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate">
                              {m.label}:
                            </span>
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={evWeightsText[m.key] ?? ''}
                            placeholder="0"
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => handleEvWeightInputChange(m.key, e.target.value)}
                            aria-label={`Điểm Event ${m.label}`}
                            className="w-full h-8 text-center rounded-full border border-sky-200 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-800 text-amber-700 dark:text-amber-300 font-black text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      );
                    })}
                  </div>
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

                      <div className="w-full sm:w-52">
                        <CustomSelect
                          size="sm"
                          value={participantCompanyFilter}
                          onChange={setParticipantCompanyFilter}
                          options={[
                            { value: 'ALL', label: 'Tất cả Công ty' },
                            ...companies.map((c) => ({
                              value: c.code,
                              label: c.name,
                              badge: c.code,
                            })),
                          ]}
                        />
                      </div>

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
