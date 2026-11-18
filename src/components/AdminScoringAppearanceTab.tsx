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
} from 'lucide-react';
import {
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
  DEFAULT_APPEARANCE_CONFIG,
  HonorsWidgetId,
  FestivalEvent,
} from '../types/edulms';

interface AdminScoringAppearanceTabProps {
  scoringConfig: SystemScoringConfig | null;
  appearanceConfig: SystemAppearanceConfig | null;
  activeEvent: FestivalEvent | null;
  onSaveScoringConfig: (weights: DailyReportMetrics) => Promise<void>;
  onSaveAppearanceConfig: (config: SystemAppearanceConfig) => Promise<void>;
  onShowNotification: (msg: string) => void;
}

export const AdminScoringAppearanceTab: React.FC<AdminScoringAppearanceTabProps> = ({
  scoringConfig,
  appearanceConfig,
  activeEvent,
  onSaveScoringConfig,
  onSaveAppearanceConfig,
  onShowNotification,
}) => {
  // ---------- 1. System Default Scoring State ----------
  const [weightsDraft, setWeightsDraft] = useState<DailyReportMetrics>({
    ...DEFAULT_EVENT_WEIGHTS,
    ...(scoringConfig?.weights || {}),
  });
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  useEffect(() => {
    setWeightsDraft({
      ...DEFAULT_EVENT_WEIGHTS,
      ...(scoringConfig?.weights || {}),
    });
  }, [scoringConfig]);

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWeights(true);
    try {
      await onSaveScoringConfig(weightsDraft);
      onShowNotification('Đã lưu Bảng điểm mặc định hệ thống cho toàn web!');
    } catch (err: any) {
      onShowNotification(`Lỗi lưu bảng điểm: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingWeights(false);
    }
  };

  const handleResetDefaultWeights = () => {
    setWeightsDraft({ ...DEFAULT_EVENT_WEIGHTS });
    onShowNotification('Đã khôi phục giá trị điểm gốc (bấm Lưu để áp dụng lên hệ thống).');
  };

  // ---------- 2. Global Typography & Widget Layout State ----------
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

  const handleResetAppearanceDraft = () => {
    setFontKey(DEFAULT_APPEARANCE_CONFIG.fontKey);
    setFontScale(DEFAULT_APPEARANCE_CONFIG.fontScale);
    setWidgetOrder([...DEFAULT_HONORS_WIDGET_ORDER]);
    setHiddenWidgets([]);
    onShowNotification('Đã đưa cấu hình font & bố cục về mặc định (bấm Lưu để áp dụng toàn trang).');
  };

  const handleSaveAppearance = async () => {
    setIsSavingAppearance(true);
    try {
      await onSaveAppearanceConfig({
        fontKey,
        fontScale,
        widgetOrder,
        hiddenWidgets,
      });
      onShowNotification('Đã cập nhật Font chữ & Bố cục Widget cho toàn bộ người dùng!');
    } catch (err: any) {
      onShowNotification(`Lỗi lưu giao diện: ${err?.message || 'Thử lại sau'}`);
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const selectedFontMeta =
    APP_FONT_OPTIONS.find((f) => f.key === fontKey) || APP_FONT_OPTIONS[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* SECTION 1: SYSTEM DEFAULT SCORING TABLE */}
      <form
        onSubmit={handleSaveWeights}
        className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
              <Scale className="w-3.5 h-3.5" />
              <span>Bảng Điểm Mặc Định Hệ Thống</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Hệ số quy đổi điểm Báo cáo hằng ngày
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Bảng điểm gốc dùng để tính điểm thi đua khi chưa có Chiến dịch Event kích hoạt, đồng thời tự động điền sẵn làm gợi ý khi Admin tạo Event mới.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetDefaultWeights}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục gốc</span>
          </button>
        </div>

        {activeEvent && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Lưu ý về mức ưu tiên:</strong> Chiến dịch Event{' '}
              <span className="font-black">“{activeEvent.title}”</span> đang được kích hoạt nên bảng xếp hạng hiện ưu tiên dùng hệ số riêng của Event đó. Khi Event kết thúc hoặc tạm ngưng, hệ thống sẽ áp dụng ngay Bảng điểm mặc định này.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {DAILY_METRIC_DEFINITIONS.map((m) => (
            <div
              key={m.key}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 text-center"
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${m.dotColor}`} />
                <span className={`text-xs font-black ${m.colorClass}`}>{m.label}</span>
              </div>
              <input
                type="number"
                min={0}
                step={1}
                value={weightsDraft[m.key] ?? 0}
                onChange={(e) =>
                  setWeightsDraft((prev) => ({
                    ...prev,
                    [m.key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                className="w-full text-center py-2 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-base tabular-nums"
              />
              <div className="text-[10px] text-slate-400">điểm / lượt</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {scoringConfig?.updatedAt
              ? `Cập nhật gần nhất: ${scoringConfig.updatedBy || 'Admin'} (${new Date(
                  scoringConfig.updatedAt
                ).toLocaleString('vi-VN')})`
              : 'Đang dùng mức mặc định khởi tạo của hệ thống.'}
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

      {/* SECTION 2 & 3: GLOBAL FONT & WIDGET LAYOUT */}
      <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đồng bộ toàn Website cho mọi người dùng</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Tùy chỉnh Font chữ &amp; Sắp xếp Bố cục Widget
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Mọi thay đổi sau khi lưu sẽ được áp dụng đồng bộ ngay lập tức cho tất cả thành viên đang truy cập Hành Thực Lục.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetAppearanceDraft}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định giao diện</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Font Selector & Live Preview */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <Type className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Chọn kiểu Font chữ toàn trang (hỗ trợ đầy đủ tiếng Việt)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

            {/* Font Scale */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Cỡ chữ tổng thể
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: 'SM', label: 'Gọn nhẹ (93%)' },
                    { key: 'MD', label: 'Tiêu chuẩn (100%)' },
                    { key: 'LG', label: 'To rõ (108%)' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setFontScale(s.key)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      fontScale === s.key
                        ? 'bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Typography Preview */}
            <div
              style={{
                fontFamily: selectedFontMeta.cssFamily,
                fontSize: fontScale === 'SM' ? '14px' : fontScale === 'LG' ? '17px' : '15px',
              }}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 space-y-1.5"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Xem trước hiển thị trực tiếp ({selectedFontMeta.label})
              </div>
              <div className="font-extrabold text-base text-slate-900 dark:text-white">
                Hành Thực Lục — Vinh danh thi đua &amp; Đào tạo Edu
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Tiếng Việt có dấu rõ nét: Ăn cơm, Thăm viếng, Gợi mở, Đường tới TĐ-II • Số liệu: 12,450 điểm (7/7 chỉ số đạt mục tiêu).
              </p>
            </div>
          </div>

          {/* Drag-and-Drop Widget Layout Editor */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                <LayoutGrid className="w-4 h-4 text-amber-500" />
                <span>Kéo thả sắp xếp Widget trang Vinh danh &amp; Xếp hạng</span>
              </div>
              <span className="text-[10px] text-slate-400">Kéo giữ biểu tượng ⋮⋮</span>
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
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition select-none ${
                      isDragging
                        ? 'opacity-50 scale-[0.99] border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
                        : isOver
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 shadow-xs'
                        : isHidden
                        ? 'bg-slate-100/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-65'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0"
                      title="Kéo thả để đổi vị trí"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
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

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveWidget(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Đưa lên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidget(idx, 1)}
                        disabled={idx === widgetOrder.length - 1}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Đưa xuống"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWidgetVisibility(wId)}
                        className={`p-1.5 rounded-lg cursor-pointer transition ${
                          isHidden
                            ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/50'
                            : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                        }`}
                        title={isHidden ? 'Đang ẩn — bấm để hiện lại' : 'Đang hiển thị — bấm để ẩn'}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {appearanceConfig?.updatedAt
              ? `Cập nhật gần nhất: ${appearanceConfig.updatedBy || 'Admin'} (${new Date(
                  appearanceConfig.updatedAt
                ).toLocaleString('vi-VN')})`
              : 'Chưa có tùy chỉnh giao diện toàn trang nào được lưu.'}
          </div>

          <button
            type="button"
            onClick={handleSaveAppearance}
            disabled={isSavingAppearance}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingAppearance ? 'Đang lưu...' : 'Lưu Font & Bố cục Toàn Trang'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
