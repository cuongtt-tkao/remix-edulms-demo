import React, { useState, useEffect } from 'react';
import {
  Scale,
  Type,
  LayoutGrid,
  Save,
  RotateCcw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Home,
  Trophy,
  Users,
  Megaphone,
  Handshake,
  Heart,
  TrendingUp,
  Star,
  CalendarDays,
} from 'lucide-react';
import {
  DailyMetricKey,
  DailyReportMetrics,
  DAILY_METRIC_DEFINITIONS,
  DEFAULT_EVENT_WEIGHTS,
  SystemScoringConfig,
  SystemAppearanceConfig,
  APP_FONT_OPTIONS,
  AppFontKey,
  AppFontScale,
  HONORS_WIDGET_DEFINITIONS,
  DEFAULT_HONORS_WIDGET_ORDER,
  DEFAULT_HOME_WIDGET_VISIBILITY,
  DEFAULT_LLV_WIDGET_VISIBILITY,
  DEFAULT_APPEARANCE_CONFIG,
  HomeWidgetVisibilityConfig,
  LlvWidgetVisibilityConfig,
  HonorsWidgetId,
  FestivalEvent,
} from '../types/edulms';

export type AdminAppearanceSection =
  | 'SCORING'
  | 'TYPOGRAPHY'
  | 'HOME_LAYOUT'
  | 'HONORS_LAYOUT'
  | 'LLV_LAYOUT';

interface AdminScoringAppearanceTabProps {
  scoringConfig: SystemScoringConfig | null;
  appearanceConfig: SystemAppearanceConfig | null;
  activeEvent: FestivalEvent | null;
  forcedSection?: AdminAppearanceSection;
  onSaveScoringConfig: (weights: DailyReportMetrics) => Promise<void>;
  onSaveAppearanceConfig: (config: SystemAppearanceConfig) => Promise<void>;
  onShowNotification: (msg: string) => void;
}

type AdminAppearanceSubTab = AdminAppearanceSection;

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

const HOME_WIDGET_ITEMS: Array<{
  key:
    | 'showHeaderBanner'
    | 'showQuickShortcuts'
    | 'showCheerTicker'
    | 'showProgressShowcase'
    | 'showFeatureCards';
  title: string;
  desc: string;
}> = [
  {
    key: 'showHeaderBanner',
    title: 'Banner đầu thẻ Báo cáo hằng ngày',
    desc: 'Khung tiêu đề Hành Thực Lục — Báo cáo hằng ngày tươi sáng ở đầu trang chủ.',
  },
  {
    key: 'showQuickShortcuts',
    title: 'Dải 5 lối tắt nhanh',
    desc: '5 nút truy cập nhanh: Xếp hạng, Sự kiện, MĐ, Edu LMS, Edu CMS.',
  },
  {
    key: 'showCheerTicker',
    title: 'Thanh Tin nhắn cổ vũ',
    desc: 'Hiển thị danh sách Nhật ký cảm tạ cổ vũ, tự động đổi tin và nút cổ vũ trên Trang chủ.',
  },
  {
    key: 'showProgressShowcase',
    title: 'Khối Vòng tròn Tiến độ & Điểm năm',
    desc: 'Vòng tròn % hoàn thành mục tiêu năm/tháng cùng tổng điểm tích lũy.',
  },
  {
    key: 'showFeatureCards',
    title: '2 Thẻ lối tắt nổi bật cuối Trang chủ',
    desc: 'Hai thẻ pastel dẫn nhanh sang Bảng Vinh danh và Hệ thống Giáo dục Edu.',
  },
];

const LLV_WIDGET_ITEMS: Array<{
  key: keyof LlvWidgetVisibilityConfig;
  title: string;
  desc: string;
}> = [
  {
    key: 'showWsSection',
    title: 'Khối Lịch WS Tuần (Bật / Tắt)',
    desc: 'Cho phép hiển thị bảng nhập Lịch WS Tuần, tab chuyển WS trên điện thoại, thống kê WS đội ngũ và cột WS khi xuất Excel LLV. Dữ liệu WS cũ vẫn được giữ an toàn khi tắt.',
  },
];

export const AdminScoringAppearanceTab: React.FC<AdminScoringAppearanceTabProps> = ({
  scoringConfig,
  appearanceConfig,
  activeEvent,
  forcedSection,
  onSaveScoringConfig,
  onSaveAppearanceConfig,
  onShowNotification,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<AdminAppearanceSubTab>(
    forcedSection || 'SCORING'
  );
  const subTab = forcedSection || internalSubTab;

  // ---------- 1. System Default Scoring State (string-backed to prevent 0 snapback) ----------
  const toTextMap = (w: DailyReportMetrics): Record<DailyMetricKey, string> => ({
    kn: String(w.kn ?? 0),
    tham: String(w.tham ?? 0),
    gm: String(w.gm ?? 0),
    dt: String(w.dt ?? 0),
    hh: String(w.hh ?? 0),
    kt: String(w.kt ?? 0),
    wsNew: String(w.wsNew ?? 0),
  });

  const [weightsText, setWeightsText] = useState<Record<DailyMetricKey, string>>(() =>
    toTextMap({ ...DEFAULT_EVENT_WEIGHTS, ...(scoringConfig?.weights || {}) })
  );
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  useEffect(() => {
    setWeightsText(
      toTextMap({
        ...DEFAULT_EVENT_WEIGHTS,
        ...(scoringConfig?.weights || {}),
      })
    );
  }, [scoringConfig]);

  const handleWeightInputChange = (key: DailyMetricKey, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') {
      setWeightsText((prev) => ({ ...prev, [key]: '' }));
      return;
    }
    const normalized = digits.length > 1 ? digits.replace(/^0+/, '') || '0' : digits;
    setWeightsText((prev) => ({ ...prev, [key]: normalized }));
  };

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWeights(true);
    try {
      const numericWeights: DailyReportMetrics = {
        kn: parseInt(weightsText.kn, 10) || 0,
        tham: parseInt(weightsText.tham, 10) || 0,
        gm: parseInt(weightsText.gm, 10) || 0,
        dt: parseInt(weightsText.dt, 10) || 0,
        hh: parseInt(weightsText.hh, 10) || 0,
        kt: parseInt(weightsText.kt, 10) || 0,
        wsNew: parseInt(weightsText.wsNew, 10) || 0,
      };
      await onSaveScoringConfig(numericWeights);
      setWeightsText(toTextMap(numericWeights));
      onShowNotification('Đã lưu Bảng điểm mặc định hệ thống cho toàn web!');
    } catch (err: any) {
      onShowNotification(`Lỗi lưu bảng điểm: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingWeights(false);
    }
  };

  const handleResetDefaultWeights = () => {
    setWeightsText(toTextMap({ ...DEFAULT_EVENT_WEIGHTS }));
    onShowNotification('Đã khôi phục giá trị điểm gốc (bấm Lưu để áp dụng lên hệ thống).');
  };

  // ---------- 2. Global Typography, Home Widgets & Honors Widget Layout ----------
  const [fontKey, setFontKey] = useState<AppFontKey>(
    appearanceConfig?.fontKey || DEFAULT_APPEARANCE_CONFIG.fontKey
  );
  const [fontScale, setFontScale] = useState<AppFontScale>(
    appearanceConfig?.fontScale || DEFAULT_APPEARANCE_CONFIG.fontScale
  );
  const [widgetOrder, setWidgetOrder] = useState<HonorsWidgetId[]>(
    appearanceConfig?.widgetOrder?.length
      ? appearanceConfig.widgetOrder
      : [...DEFAULT_HONORS_WIDGET_ORDER]
  );
  const [hiddenWidgets, setHiddenWidgets] = useState<HonorsWidgetId[]>(
    appearanceConfig?.hiddenWidgets || []
  );
  const [homeWidgets, setHomeWidgets] = useState<HomeWidgetVisibilityConfig>({
    ...DEFAULT_HOME_WIDGET_VISIBILITY,
    ...(appearanceConfig?.homeWidgets || {}),
  });
  const [llvWidgets, setLlvWidgets] = useState<LlvWidgetVisibilityConfig>({
    ...DEFAULT_LLV_WIDGET_VISIBILITY,
    ...(appearanceConfig?.llvWidgets || {}),
  });

  const [draggedWidget, setDraggedWidget] = useState<HonorsWidgetId | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<HonorsWidgetId | null>(null);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  useEffect(() => {
    if (!appearanceConfig) return;
    setFontKey(appearanceConfig.fontKey || DEFAULT_APPEARANCE_CONFIG.fontKey);
    setFontScale(appearanceConfig.fontScale || DEFAULT_APPEARANCE_CONFIG.fontScale);
    const mergedOrder: HonorsWidgetId[] = [
      ...(appearanceConfig.widgetOrder || []).filter((id) =>
        DEFAULT_HONORS_WIDGET_ORDER.includes(id)
      ),
      ...DEFAULT_HONORS_WIDGET_ORDER.filter(
        (id) => !(appearanceConfig.widgetOrder || []).includes(id)
      ),
    ];
    setWidgetOrder(mergedOrder);
    setHiddenWidgets(appearanceConfig.hiddenWidgets || []);
    setHomeWidgets({
      ...DEFAULT_HOME_WIDGET_VISIBILITY,
      ...(appearanceConfig.homeWidgets || {}),
    });
    setLlvWidgets({
      ...DEFAULT_LLV_WIDGET_VISIBILITY,
      ...(appearanceConfig.llvWidgets || {}),
    });
  }, [appearanceConfig]);

  const moveWidget = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= widgetOrder.length) return;
    const copy = [...widgetOrder];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, item);
    setWidgetOrder(copy);
  };

  const handleDropWidget = (targetId: HonorsWidgetId) => {
    if (!draggedWidget || draggedWidget === targetId) {
      setDraggedWidget(null);
      setDragOverWidget(null);
      return;
    }
    const fromIdx = widgetOrder.indexOf(draggedWidget);
    const toIdx = widgetOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const copy = [...widgetOrder];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setWidgetOrder(copy);
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  const toggleWidgetVisibility = (id: HonorsWidgetId) => {
    setHiddenWidgets((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleHomeWidget = (
    key:
      | 'showHeaderBanner'
      | 'showQuickShortcuts'
      | 'showCheerTicker'
      | 'showProgressShowcase'
      | 'showFeatureCards'
  ) => {
    setHomeWidgets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleLlvWidget = (key: keyof LlvWidgetVisibilityConfig) => {
    setLlvWidgets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetAppearanceDraft = () => {
    setFontKey(DEFAULT_APPEARANCE_CONFIG.fontKey);
    setFontScale(DEFAULT_APPEARANCE_CONFIG.fontScale);
    setWidgetOrder([...DEFAULT_HONORS_WIDGET_ORDER]);
    setHiddenWidgets([]);
    setHomeWidgets({ ...DEFAULT_HOME_WIDGET_VISIBILITY });
    setLlvWidgets({ ...DEFAULT_LLV_WIDGET_VISIBILITY });
    onShowNotification(
      'Đã đưa cấu hình font & bố cục về mặc định (bấm Lưu để áp dụng toàn trang).'
    );
  };

  const handleSaveAppearance = async () => {
    setIsSavingAppearance(true);
    try {
      await onSaveAppearanceConfig({
        fontKey,
        fontScale,
        widgetOrder,
        hiddenWidgets,
        homeWidgets,
        llvWidgets,
      });
      onShowNotification('Đã cập nhật cấu hình Giao diện & Bố cục cho toàn bộ người dùng!');
    } catch (err: any) {
      onShowNotification(`Lỗi lưu giao diện: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const selectedFontMeta =
    APP_FONT_OPTIONS.find((f) => f.key === fontKey) || APP_FONT_OPTIONS[0];

  const renderSaveAppearanceFooter = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleResetAppearanceDraft}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Khôi phục mặc định</span>
        </button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
          {appearanceConfig?.updatedAt
            ? `Lưu gần nhất: ${appearanceConfig.updatedBy || 'Admin'} (${new Date(
                appearanceConfig.updatedAt
              ).toLocaleString('vi-VN')})`
            : 'Chưa có tùy chỉnh giao diện được lưu.'}
        </span>
      </div>

      <button
        type="button"
        onClick={handleSaveAppearance}
        disabled={isSavingAppearance}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
      >
        <Save className="w-4 h-4" />
        <span>{isSavingAppearance ? 'Đang lưu...' : 'Lưu Cấu hình Toàn Web'}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Sub-tab Selector (only shown when forcedSection is not specified) */}
      {!forcedSection && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
          {(
            [
              {
                id: 'SCORING' as const,
                label: '1. Điểm mặc định',
                sub: '7 hệ số quy đổi',
                icon: Scale,
              },
              {
                id: 'TYPOGRAPHY' as const,
                label: '2. Font & Cỡ chữ',
                sub: selectedFontMeta.label,
                icon: Type,
              },
              {
                id: 'HOME_LAYOUT' as const,
                label: '3. Trang chủ',
                sub: `${HOME_WIDGET_ITEMS.filter((it) => Boolean(homeWidgets[it.key])).length}/${HOME_WIDGET_ITEMS.length} khối bật`,
                icon: Home,
              },
              {
                id: 'HONORS_LAYOUT' as const,
                label: '4. Bảng Vinh danh',
                sub: `${widgetOrder.length - hiddenWidgets.length}/${widgetOrder.length} widget bật`,
                icon: Trophy,
              },
              {
                id: 'LLV_LAYOUT' as const,
                label: '5. Trang LLV',
                sub: llvWidgets.showWsSection ? 'Đang hiện WS' : 'Đang ẩn WS',
                icon: CalendarDays,
              },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInternalSubTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs ring-1 ring-indigo-200 dark:ring-indigo-800'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-900/50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">{tab.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {tab.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 1: SYSTEM DEFAULT SCORING TABLE (Compact Daily-Report-Style) */}
      {subTab === 'SCORING' && (
        <form
          onSubmit={handleSaveWeights}
          className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <Scale className="w-3.5 h-3.5" />
                <span>Bảng Điểm Mặc Định Hệ Thống</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                Hệ số quy đổi điểm Báo cáo hằng ngày
              </h3>
            </div>

            <button
              type="button"
              onClick={handleResetDefaultWeights}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer self-start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục gốc</span>
            </button>
          </div>

          {activeEvent && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Event <strong className="font-black">“{activeEvent.title}”</strong> đang bật nên BXH ưu tiên dùng điểm riêng của Event này.
              </span>
            </div>
          )}

          {/* Compact 2-Column Daily-Report-Style Table */}
          <div className="max-w-xl mx-auto rounded-2xl overflow-hidden border border-sky-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
            <div className="grid grid-cols-[1fr_130px] sm:grid-cols-[1fr_160px] gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white text-xs font-extrabold items-center">
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
                    className="grid grid-cols-[1fr_130px] sm:grid-cols-[1fr_160px] gap-2 items-center px-4 py-2 hover:bg-sky-50/40 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xl ${iconMeta.bgCls} flex items-center justify-center shrink-0`}
                      >
                        <RowIcon className={`w-3.5 h-3.5 ${iconMeta.iconCls}`} />
                      </div>
                      <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                        {m.label}:
                      </span>
                    </div>

                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={weightsText[m.key] ?? ''}
                        placeholder="0"
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleWeightInputChange(m.key, e.target.value)}
                        aria-label={`Điểm ${m.label}`}
                        className="w-full h-9 text-center rounded-full border border-sky-200 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {scoringConfig?.updatedAt
                ? `Lưu gần nhất: ${scoringConfig.updatedBy || 'Admin'} (${new Date(
                    scoringConfig.updatedAt
                  ).toLocaleString('vi-VN')})`
                : 'Đang dùng mức mặc định khởi tạo.'}
            </div>

            <button
              type="submit"
              disabled={isSavingWeights}
              className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingWeights ? 'Đang lưu...' : 'Lưu Bảng Điểm Mặc Định'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: GLOBAL TYPOGRAPHY */}
      {subTab === 'TYPOGRAPHY' && (
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 sm:p-6 space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đồng bộ toàn Website cho mọi người dùng</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Chọn Font chữ &amp; Cỡ chữ tổng thể
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {APP_FONT_OPTIONS.map((opt) => {
                const selected = fontKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFontKey(opt.key)}
                    style={{ fontFamily: opt.cssFamily }}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      selected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {opt.label}
                      </span>
                      {selected && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 mt-0.5">
                      {opt.styleTag}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Cỡ chữ tổng thể (Preset hiển thị)
                  </span>
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {fontScale === 'SM' ? '93%' : fontScale === 'LG' ? '108%' : '100%'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'SM', label: 'Gọn nhẹ', ratio: '93%', sample: 'Aa' },
                      { key: 'MD', label: 'Chuẩn', ratio: '100%', sample: 'Aa' },
                      { key: 'LG', label: 'To rõ', ratio: '108%', sample: 'Aa' },
                    ] as const
                  ).map((s) => {
                    const active = fontScale === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setFontScale(s.key)}
                        className={`p-2.5 rounded-2xl text-center border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                          active
                            ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/25'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                        }`}
                      >
                        <span
                          className={`font-black leading-none ${
                            s.key === 'SM' ? 'text-xs' : s.key === 'LG' ? 'text-lg' : 'text-sm'
                          }`}
                        >
                          {s.sample}
                        </span>
                        <span className="text-xs font-extrabold mt-1">{s.label}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            active ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-400'
                          }`}
                        >
                          {s.ratio}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  fontFamily: selectedFontMeta.cssFamily,
                  fontSize: fontScale === 'SM' ? '14px' : fontScale === 'LG' ? '17px' : '15px',
                }}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 space-y-1.5"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Xem trước hiển thị ({selectedFontMeta.label})
                </div>
                <div className="font-extrabold text-base text-slate-900 dark:text-white">
                  Hành Thực Lục — Báo cáo &amp; Thi đua
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tiếng Việt có dấu rõ nét: KN, Thăm, GM, ĐT, HH, KT, WS New · 12.450 điểm.
                </p>
              </div>
            </div>
          </div>

          {renderSaveAppearanceFooter()}
        </div>
      )}

      {/* SUB-TAB 3: HOME PAGE WIDGETS (ẢNH 1 + ẢNH 2) */}
      {subTab === 'HOME_LAYOUT' && (
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">
                <Home className="w-3.5 h-3.5" />
                <span>Tùy biến Trang chủ (Báo cáo hằng ngày)</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Bật / Tắt các khối tiện ích trên Trang chủ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Bảng nhập 7 chỉ số luôn là trọng tâm; chọn nhanh mẫu hoặc bật/tắt từng khối bên dưới rồi bấm Lưu.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setHomeWidgets((prev) => ({
                    ...prev,
                    showHeaderBanner: true,
                    showQuickShortcuts: true,
                    showCheerTicker: true,
                    showProgressShowcase: true,
                    showFeatureCards: true,
                  }))
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
              >
                Bật đủ 5 khối
              </button>
              <button
                type="button"
                onClick={() =>
                  setHomeWidgets((prev) => ({
                    ...prev,
                    showHeaderBanner: false,
                    showQuickShortcuts: false,
                    showCheerTicker: false,
                    showProgressShowcase: false,
                    showFeatureCards: false,
                  }))
                }
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
              >
                Tối giản (Chỉ bảng nhập)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {HOME_WIDGET_ITEMS.map((item) => {
              const isVisible = homeWidgets[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleHomeWidget(item.key)}
                  className={`flex items-start justify-between gap-3 p-4 rounded-2xl border text-left transition cursor-pointer ${
                    isVisible
                      ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                      : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 shrink-0 ${
                      isVisible
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{isVisible ? 'HIỆN' : 'ẨN'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cấu hình chi tiết Tin nhắn cổ vũ trên Trang chủ */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Cấu hình Tin nhắn cổ vũ trên Trang chủ</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tùy chỉnh số lượng tin hiển thị cùng lúc, chu kỳ tự động đổi tin và bảo mật tên người viết.
                </p>
              </div>
              {!homeWidgets.showCheerTicker && (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Khối Tin nhắn cổ vũ đang tắt
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Số lượng hiển thị */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="cheer-display-count-input"
                    className="text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    Số tin nhắn hiển thị cùng lúc
                  </label>
                  <span className="text-xs font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">
                    {homeWidgets.cheerDisplayCount ?? 5} tin
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[3, 5, 8, 10].map((preset) => {
                    const active = (homeWidgets.cheerDisplayCount ?? 5) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setHomeWidgets((prev) => ({ ...prev, cheerDisplayCount: preset }))
                        }
                        className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition cursor-pointer tabular-nums ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {preset} tin
                      </button>
                    );
                  })}
                  <input
                    id="cheer-display-count-input"
                    type="number"
                    min={1}
                    max={20}
                    value={homeWidgets.cheerDisplayCount ?? 5}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setHomeWidgets((prev) => ({
                        ...prev,
                        cheerDisplayCount: Number.isNaN(val) ? 1 : Math.max(1, Math.min(20, val)),
                      }));
                    }}
                    className="h-8 w-20 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mặc định 5 tin. Nếu có nhiều hơn ngưỡng này, danh sách sẽ tự động xoay vòng.
                </p>
              </div>

              {/* Thời lượng tự đổi tin */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="cheer-rotate-seconds-input"
                    className="text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    Thời lượng tự đổi tin nhắn (giây)
                  </label>
                  <span className="text-xs font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">
                    {homeWidgets.cheerRotateSeconds ?? 10}s
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[5, 10, 15, 20, 30].map((sec) => {
                    const active = (homeWidgets.cheerRotateSeconds ?? 10) === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() =>
                          setHomeWidgets((prev) => ({ ...prev, cheerRotateSeconds: sec }))
                        }
                        className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition cursor-pointer tabular-nums ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {sec}s
                      </button>
                    );
                  })}
                  <input
                    id="cheer-rotate-seconds-input"
                    type="number"
                    min={3}
                    max={120}
                    value={homeWidgets.cheerRotateSeconds ?? 10}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setHomeWidgets((prev) => ({
                        ...prev,
                        cheerRotateSeconds: Number.isNaN(val)
                          ? 10
                          : Math.max(3, Math.min(120, val)),
                      }));
                    }}
                    className="h-8 w-20 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mặc định 10 giây. Áp dụng tự động chuyển trang khi tổng tin nhiều hơn số tin hiển thị.
                </p>
              </div>
            </div>

            {/* Tùy chọn ẩn tên người viết tin nhắn */}
            <button
              type="button"
              onClick={() =>
                setHomeWidgets((prev) => ({
                  ...prev,
                  cheerHideAuthor: !prev.cheerHideAuthor,
                }))
              }
              className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border text-left transition cursor-pointer ${
                homeWidgets.cheerHideAuthor
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/35 border-indigo-300 dark:border-indigo-700'
                  : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-800'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                  Ẩn tên người viết tin nhắn để an toàn thông tin
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Khi bật, thẻ Tin nhắn cổ vũ trên Trang chủ sẽ hiển thị dạng “Thành viên ẩn danh” thay vì họ tên và đơn vị của người viết.
                </p>
              </div>
              <div
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 shrink-0 ${
                  homeWidgets.cheerHideAuthor
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {homeWidgets.cheerHideAuthor ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>ĐANG ẨN TÊN</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>HIỆN TÊN</span>
                  </>
                )}
              </div>
            </button>
          </div>

          {renderSaveAppearanceFooter()}
        </div>
      )}

      {/* SUB-TAB 3B: LLV PAGE LAYOUT (BẬT / TẮT MỤC WS TRONG LỊCH LÀM VIỆC) */}
      {subTab === 'LLV_LAYOUT' && (
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Tùy biến trang Lịch làm việc tuần (LLV)</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Bố cục &amp; Hiển thị khối WS trong LLV
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Chỉ Admin (Cấp 6) và Admin Tổng (Cấp 7) có quyền bật/tắt cấu hình này. Khi bấm Lưu, toàn bộ trang LLV và file Excel LLV sẽ tự đồng bộ theo trạng thái mới.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setLlvWidgets({ showWsSection: true })}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
              >
                Bật hiển thị WS
              </button>
              <button
                type="button"
                onClick={() => setLlvWidgets({ showWsSection: false })}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
              >
                Ẩn khối WS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {LLV_WIDGET_ITEMS.map((item) => {
              const isVisible = llvWidgets[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleLlvWidget(item.key)}
                  className={`flex items-start justify-between gap-3 p-4 rounded-2xl border text-left transition cursor-pointer ${
                    isVisible
                      ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                      : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-85'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 shrink-0 ${
                      isVisible
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{isVisible ? 'HIỆN' : 'ẨN'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {renderSaveAppearanceFooter()}
        </div>
      )}

      {/* SUB-TAB 4: HONORS PAGE DRAG-AND-DROP WIDGETS (1 -> 7) */}
      {subTab === 'HONORS_LAYOUT' && (
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Trang Bảng Xếp hạng &amp; Vinh danh</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Sắp xếp thứ tự 1 → 7 &amp; Bật / Tắt Widget
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setHiddenWidgets([])}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
              >
                Hiện tất cả 7
              </button>
              <button
                type="button"
                onClick={() => setWidgetOrder([...DEFAULT_HONORS_WIDGET_ORDER])}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
              >
                Thứ tự 1 → 7
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {widgetOrder.map((wId, idx) => {
              const meta = HONORS_WIDGET_DEFINITIONS.find((m) => m.id === wId);
              if (!meta) return null;
              const isHidden = hiddenWidgets.includes(wId);
              const isDragging = draggedWidget === wId;
              const isOver = dragOverWidget === wId;

              return (
                <div
                  key={wId}
                  draggable
                  onDragStart={() => setDraggedWidget(wId)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverWidget !== wId) setDragOverWidget(wId);
                  }}
                  onDragLeave={() => {
                    if (dragOverWidget === wId) setDragOverWidget(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropWidget(wId);
                  }}
                  onDragEnd={() => {
                    setDraggedWidget(null);
                    setDragOverWidget(null);
                  }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl border transition select-none ${
                    isDragging
                      ? 'opacity-50 scale-[0.99] border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
                      : isOver
                      ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 shadow-xs'
                      : isHidden
                      ? 'bg-slate-100/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-65'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0"
                      title="Kéo thả để đổi vị trí"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                          {meta.zone === 'FULL'
                            ? 'Toàn chiều ngang'
                            : meta.zone === 'MAIN'
                            ? 'Cột chính'
                            : 'Cột phụ'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {meta.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 shrink-0 pl-9 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => moveWidget(idx, -1)}
                      disabled={idx === 0}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Đưa lên"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWidget(idx, 1)}
                      disabled={idx === widgetOrder.length - 1}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Đưa xuống"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWidgetVisibility(wId)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
                        isHidden
                          ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300'
                          : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}
                      title={isHidden ? 'Đang ẩn — bấm để hiện lại' : 'Đang hiển thị — bấm để ẩn'}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isHidden ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {renderSaveAppearanceFooter()}
        </div>
      )}
    </div>
  );
};
