import React from 'react';
import {
  CalendarDays,
  Award,
  Users,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Shield,
} from 'lucide-react';
import {
  FestivalEvent,
  DAILY_METRIC_DEFINITIONS,
  DEFAULT_EVENT_WEIGHTS,
  DailyReportMetrics,
  UserAccount,
  Member,
} from '../types/edulms';

interface EventHubPageProps {
  events: FestivalEvent[];
  activeEvent: FestivalEvent | null;
  defaultWeights?: DailyReportMetrics;
  currentUser: UserAccount | null;
  currentMember: Member | null;
  onOpenRulesModal: () => void;
  onNavigateToEntry: () => void;
  onNavigateToAdmin?: () => void;
}

export const EventHubPage: React.FC<EventHubPageProps> = ({
  events,
  activeEvent,
  defaultWeights,
  currentUser,
  currentMember,
  onOpenRulesModal,
  onNavigateToEntry,
  onNavigateToAdmin,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const weights = activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS;

  return (
    <div className="space-y-5">
      {/* Header Banner Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Chiến dịch &amp; Thể lệ Event</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Điểm thi đua Event được tổng hợp trực tiếp từ dữ liệu Báo cáo hằng ngày trong khoảng thời gian chiến dịch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenRulesModal}
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Mở bảng Thể lệ</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToEntry}
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Nhập Báo cáo</span>
            </button>

            {isAdmin && onNavigateToAdmin && (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="px-3.5 py-2 min-h-[40px] rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Quản lý Event</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Event Details */}
        {activeEvent ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {activeEvent.bannerUrl && (
              <div className="lg:col-span-5 h-48 lg:h-auto bg-slate-900">
                <img
                  src={activeEvent.bannerUrl}
                  alt={activeEvent.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className={`p-4 sm:p-5 space-y-3 ${activeEvent.bannerUrl ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-extrabold text-amber-800 dark:text-amber-300">
                  Sự kiện đang áp dụng
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                  {activeEvent.startDate.split('-').reverse().join('/')} –{' '}
                  {activeEvent.endDate.split('-').reverse().join('/')}
                </span>
              </div>

              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {activeEvent.title}
              </h2>

              {activeEvent.description && (
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeEvent.description}
                </p>
              )}

              {activeEvent.rulesText && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {activeEvent.rulesText}
                </div>
              )}

              {currentMember && (
                <div className="text-xs font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {!activeEvent.restrictParticipants ||
                    activeEvent.participantIds?.includes(currentMember.id)
                      ? 'Tài khoản của bạn đang nằm trong danh sách thi đua của chiến dịch này.'
                      : 'Chiến dịch này đang giới hạn danh sách người tham gia (liên hệ Admin nếu cần bổ sung).'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center text-xs text-slate-500">
            Hiện chưa có sự kiện nào được kích hoạt. Bảng xếp hạng đang áp dụng trọng số mặc định.
          </div>
        )}
      </div>

      {/* Point Conversion Weights Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span>Bảng quy đổi điểm từ Báo cáo hằng ngày</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAILY_METRIC_DEFINITIONS.map((m) => (
            <div
              key={m.key}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 text-center"
            >
              <div className={`text-xs font-black ${m.colorClass}`}>{m.label}</div>
              <div className="text-base font-black text-slate-900 dark:text-white tabular-nums mt-1">
                +{weights[m.key]}đ
              </div>
              <div className="text-[10px] text-slate-400">mỗi lượt đạt</div>
            </div>
          ))}
        </div>
      </div>

      {/* All Events Roster */}
      {events.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Danh sách tất cả chiến dịch ({events.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className={`p-4 rounded-2xl border space-y-2 ${
                  activeEvent?.id === ev.id
                    ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-300 dark:border-amber-700'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={`font-bold ${
                      activeEvent?.id === ev.id
                        ? 'text-amber-700 dark:text-amber-300'
                        : ev.isActive
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {activeEvent?.id === ev.id
                      ? 'Đang áp dụng'
                      : ev.isActive
                      ? 'Đang mở'
                      : 'Tạm ngưng'}
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {ev.startDate.split('-').reverse().join('/')} –{' '}
                    {ev.endDate.split('-').reverse().join('/')}
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">{ev.title}</div>
                {ev.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {ev.description}
                  </p>
                )}
                {ev.restrictParticipants && (
                  <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1 pt-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{ev.participantIds?.length || 0} thành viên tham gia</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
