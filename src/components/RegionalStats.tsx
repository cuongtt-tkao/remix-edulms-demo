import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { AreaRankItem } from '../types/edulms';

interface RegionalStatsProps {
  areaRankings: AreaRankItem[];
  selectedAreaCode?: string | null;
  onSelectAreaCode: (areaCode: string | null) => void;
  onOpenDetailsModal: () => void;
}

const DEFAULT_VISIBLE_AREAS = 5;

export const RegionalStats: React.FC<RegionalStatsProps> = ({
  areaRankings,
  selectedAreaCode,
  onSelectAreaCode,
  onOpenDetailsModal,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');

  const formatNumber = (num: number) => {
    return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const uniqueCompanies = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    areaRankings.forEach((a) => {
      if (a.companyCode && !seen.has(a.companyCode)) {
        seen.add(a.companyCode);
        list.push(a.companyCode);
      }
    });
    return list;
  }, [areaRankings]);

  const effectiveCompanyFilter =
    companyFilter !== 'ALL' && uniqueCompanies.includes(companyFilter) ? companyFilter : 'ALL';

  const filteredAreas = useMemo(() => {
    if (effectiveCompanyFilter === 'ALL') return areaRankings;
    return areaRankings.filter((a) => a.companyCode === effectiveCompanyFilter);
  }, [areaRankings, effectiveCompanyFilter]);

  const maxAvgScore = useMemo(
    () => Math.max(...filteredAreas.map((a) => a.averageScore), 1),
    [filteredAreas]
  );

  const { visibleAreas, hiddenCount, hasPinnedOutsideTop } = useMemo(() => {
    if (isExpanded || filteredAreas.length <= DEFAULT_VISIBLE_AREAS) {
      return {
        visibleAreas: filteredAreas,
        hiddenCount: 0,
        hasPinnedOutsideTop: false,
      };
    }

    const topItems = filteredAreas.slice(0, DEFAULT_VISIBLE_AREAS);
    const pinnedIdx = selectedAreaCode
      ? filteredAreas.findIndex((a) => a.areaCode === selectedAreaCode)
      : -1;

    if (pinnedIdx >= DEFAULT_VISIBLE_AREAS) {
      return {
        visibleAreas: [...topItems, filteredAreas[pinnedIdx]],
        hiddenCount: Math.max(0, filteredAreas.length - DEFAULT_VISIBLE_AREAS - 1),
        hasPinnedOutsideTop: true,
      };
    }

    return {
      visibleAreas: topItems,
      hiddenCount: filteredAreas.length - DEFAULT_VISIBLE_AREAS,
      hasPinnedOutsideTop: false,
    };
  }, [filteredAreas, isExpanded, selectedAreaCode]);

  const getRankBadgeClass = (rankNum: number) => {
    if (rankNum === 1) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200 dark:border-amber-700/70';
    }
    if (rankNum === 2) {
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 border-slate-300 dark:border-slate-600';
    }
    if (rankNum === 3) {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 border-orange-200 dark:border-orange-800/70';
    }
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200/80 dark:border-slate-700';
  };

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800"
      id="stats-section"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">Thống kê Khu vực (Điểm TB)</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Điểm TB chia đều cho thành viên hoạt động
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

      {/* Quick Sion Filter Chips (shown when multiple Sions are present) */}
      {uniqueCompanies.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          <button
            type="button"
            onClick={() => {
              setCompanyFilter('ALL');
              setIsExpanded(false);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              effectiveCompanyFilter === 'ALL'
                ? 'bg-blue-700 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả ({areaRankings.length})
          </button>
          {uniqueCompanies.map((comp) => {
            const count = areaRankings.filter((a) => a.companyCode === comp).length;
            const isActive = effectiveCompanyFilter === comp;
            return (
              <button
                key={comp}
                type="button"
                onClick={() => {
                  setCompanyFilter(comp);
                  setIsExpanded(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                {comp} ({count})
              </button>
            );
          })}
        </div>
      )}

      {selectedAreaCode && (
        <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-200">
          <span>
            Đang lọc: <strong>Khu vực {selectedAreaCode}</strong>
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

      {/* Compact Progress Bars List */}
      <div
        className={`space-y-1.5 ${
          isExpanded && filteredAreas.length > DEFAULT_VISIBLE_AREAS
            ? 'max-h-[400px] overflow-y-auto pr-1'
            : ''
        }`}
      >
        {visibleAreas.map((area, idx) => {
          const percentage = Math.min(100, Math.round((area.averageScore / maxAvgScore) * 100));
          const isSelected = selectedAreaCode === area.areaCode;
          const displayRank = area.rank || idx + 1;
          const isPinnedExtra = hasPinnedOutsideTop && idx === visibleAreas.length - 1;

          return (
            <React.Fragment key={`${area.companyCode}_${area.areaCode}_${idx}`}>
              {isPinnedExtra && (
                <div className="flex items-center gap-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-sky-400">
                  <div className="flex-1 h-px bg-blue-200 dark:bg-blue-900/60" />
                  <span>Đang chọn lọc</span>
                  <div className="flex-1 h-px bg-blue-200 dark:bg-blue-900/60" />
                </div>
              )}

              <div
                onClick={() => onSelectAreaCode(isSelected ? null : area.areaCode)}
                className={`px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-blue-950/45 ring-1 ring-blue-300 dark:ring-blue-700'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {/* Line 1: Rank + Name + Company + Avg Score */}
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded-md text-[10px] font-extrabold border tabular-nums shrink-0 ${getRankBadgeClass(
                        displayRank
                      )}`}
                    >
                      #{displayRank}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: area.color || '#3b82f6' }}
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {area.areaName} ({area.areaCode})
                    </span>
                    {effectiveCompanyFilter === 'ALL' && (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 shrink-0">
                        · {area.companyCode}
                      </span>
                    )}
                  </div>
                  <span className="font-black text-slate-900 dark:text-white tabular-nums shrink-0">
                    {formatNumber(area.averageScore)} <span className="text-[10px] font-semibold text-slate-500">đ/ng</span>
                  </span>
                </div>

                {/* Line 2: Slim Progress Bar + Compact Member & Total Summary */}
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: area.color || '#3b82f6',
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                    {area.activeMembersCount} TV · {formatNumber(area.totalScore)} đ
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Expand / Collapse Toggle Button */}
      {filteredAreas.length > DEFAULT_VISIBLE_AREAS && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-2.5 w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-blue-700 dark:text-sky-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Thu gọn (chỉ hiện Top {DEFAULT_VISIBLE_AREAS})</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Xem tất cả (còn {hiddenCount} khu vực)</span>
            </>
          )}
        </button>
      )}

      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Nhấn vào khu vực để lọc bảng</span>
        <span className="tabular-nums font-medium">
          {effectiveCompanyFilter === 'ALL'
            ? `${areaRankings.length} khu vực`
            : `${filteredAreas.length}/${areaRankings.length} khu vực`}
        </span>
      </div>
    </div>
  );
};

