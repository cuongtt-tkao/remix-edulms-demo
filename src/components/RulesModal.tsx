import React from 'react';
import { X, BookOpen, Scale, Trophy, Calendar, Users, Sparkles } from 'lucide-react';
import {
  FestivalEvent,
  DAILY_METRIC_DEFINITIONS,
  DEFAULT_EVENT_WEIGHTS,
  DailyReportMetrics,
} from '../types/edulms';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvent?: FestivalEvent | null;
  defaultWeights?: DailyReportMetrics;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  activeEvent,
  defaultWeights,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const weights = activeEvent?.weights || defaultWeights || DEFAULT_EVENT_WEIGHTS;
  const formatDate = (d: string) => d.split('-').reverse().join('/');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 relative cursor-default"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Thể Lệ Tính Điểm • Hành Thực Lục
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Điểm thi đua được tổng hợp trực tiếp từ Báo cáo hằng ngày
            </p>
          </div>
        </div>

        {/* Active Event Banner */}
        {activeEvent && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-extrabold text-sm text-amber-950 dark:text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Sự kiện hiện hành: {activeEvent.title}</span>
              </div>
              <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(activeEvent.startDate)} → {formatDate(activeEvent.endDate)}
              </span>
            </div>
            {activeEvent.rulesText && (
              <p className="text-xs text-amber-900/90 dark:text-amber-100/90 leading-relaxed whitespace-pre-line">
                {activeEvent.rulesText}
              </p>
            )}
            {activeEvent.restrictParticipants && (
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>
                  Áp dụng cho {activeEvent.participantIds?.length || 0} thành viên được Admin chọn tham gia sự kiện.
                </span>
              </div>
            )}
          </div>
        )}

        {/* 7 Abbreviated Daily Metrics Point Weights */}
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-blue-600" />
            <span>Hệ số quy đổi điểm cho 7 chỉ số Báo cáo hằng ngày</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {DAILY_METRIC_DEFINITIONS.map((m) => (
              <div
                key={m.key}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${m.dotColor}`} />
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {m.label}
                  </span>
                </div>
                <div className="mt-1 text-xs font-black text-blue-700 dark:text-blue-300">
                  +{weights[m.key] ?? 0} điểm / lượt
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mechanism of Daily Report & Ranking */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 text-xs space-y-2">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Cơ chế tổng hợp &amp; Xếp hạng</span>
          </div>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            <li>
              <strong>Báo cáo theo Ngày / Tháng / Năm:</strong> Thành viên nhập mục tiêu và kết quả ở thẻ <strong>Ngày</strong>. Tab <strong>Tháng</strong> và <strong>Năm</strong> chỉ cho phép nhập mục tiêu; phần kết quả được hệ thống tự động cộng dồn từ dữ liệu ngày.
            </li>
            <li>
              <strong>Điểm lễ hội sự kiện:</strong> Khi có chiến dịch Event đang kích hoạt, hệ thống tự động cộng kết quả Báo cáo hằng ngày trong khoảng thời gian diễn ra sự kiện nhân với hệ số quy đổi của sự kiện đó.
            </li>
            <li>
              <strong>Danh sách dự thi chuẩn hóa:</strong> Admin có thể chọn danh sách thành viên tham gia từng Event để đảm bảo điểm trung bình theo Khu vực và Công ty không bị sai lệch bởi các tài khoản không hoạt động.
            </li>
            <li>
              <strong>Xếp hạng Khu vực &amp; Công ty:</strong> Tính theo <strong>điểm trung bình mỗi thành viên</strong> dự thi trong đơn vị đó. Các thành viên hoặc đơn vị bằng điểm nhau sẽ đồng hạng.
            </li>
          </ul>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-blue-700 hover:bg-slate-800 dark:hover:bg-blue-800 text-white font-bold text-xs transition cursor-pointer"
          >
            Đã hiểu thể lệ
          </button>
        </div>
      </div>
    </div>
  );
};
