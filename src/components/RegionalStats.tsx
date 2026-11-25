import React from 'react';
import { BarChart3, ChevronRight } from 'lucide-react';
import { AreaRankItem } from '../types/edulms';
import { formatAreaDisplayName } from '../utils/rbac';

interface RegionalStatsProps {
  areaRankings: AreaRankItem[];
  selectedAreaCode?: string | null;
  onSelectAreaCode: (areaCode: string | null) => void;
  onOpenDetailsModal: () => void;
}

export const RegionalStats: React.FC<RegionalStatsProps> = ({
  areaRankings,
  selectedAreaCode,
  onSelectAreaCode,
  onOpenDetailsModal,
}) => {
  const formatNumber = (num: number) => {
    return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const maxAvgScore = Math.max(...areaRankings.map((a) => a.averageScore), 1);

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 dark:border-slate-800"
      id="stats-section"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">Thống kê Khu vực (Điểm TB)</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Điểm trung bình chia đều cho thành viên hoạt động
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenDetailsModal}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-0.5 group transition shrink-0 cursor-pointer"
        >
          <span>Chi tiết</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {selectedAreaCode && (
        <div className="mb-3 flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-200">
          <span>
            Đang lọc: <strong>{formatAreaDisplayName(selectedAreaCode)}</strong>
          </span>
          <button
            type="button"
            onClick={() => onSelectAreaCode(null)}
            className="text-blue-600 dark:text-blue-300 hover:underline font-bold ml-2 cursor-pointer"
          >
            Bỏ lọc
          </button>
        </div>
      )}

      {/* Progress Bars List */}
      <div className="space-y-2.5">
        {areaRankings.map((area, idx) => {
          const percentage = Math.min(100, Math.round((area.averageScore / maxAvgScore) * 100));
          const isSelected = selectedAreaCode === area.areaCode;

          return (
            <div
              key={`${area.companyCode}_${area.areaCode}_${idx}`}
              onClick={() => onSelectAreaCode(isSelected ? null : area.areaCode)}
              className={`p-2.5 rounded-xl cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-300 dark:ring-blue-700'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: area.color || '#3b82f6' }}
                  />
                  <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                    {formatAreaDisplayName(area.areaCode, area.areaName)}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">({area.companyCode})</span>
                </span>
                <span className="font-black text-slate-900 dark:text-white tabular-nums shrink-0">
                  {formatNumber(area.averageScore)} đ/người
                </span>
              </div>

              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: area.color || '#3b82f6',
                  }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                <span>{area.activeMembersCount} thành viên</span>
                <span>Tổng: {formatNumber(area.totalScore)} đ</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Nhấn vào khu vực để lọc bảng</span>
        <span className="tabular-nums">{areaRankings.length} khu vực</span>
      </div>
    </div>
  );
};
