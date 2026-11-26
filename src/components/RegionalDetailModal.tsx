import React, { useMemo, useState } from 'react';
import { X, BarChart3, Search } from 'lucide-react';
import { AreaRankItem } from '../types/edulms';

interface RegionalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaRankings: AreaRankItem[];
  onSelectAreaCode: (areaCode: string) => void;
}

export const RegionalDetailModal: React.FC<RegionalDetailModalProps> = ({
  isOpen,
  onClose,
  areaRankings,
  onSelectAreaCode,
}) => {
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const filteredRankings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return areaRankings.filter((a) => {
      if (effectiveCompanyFilter !== 'ALL' && a.companyCode !== effectiveCompanyFilter) {
        return false;
      }
      if (!q) return true;
      return (
        a.areaName.toLowerCase().includes(q) ||
        a.areaCode.toLowerCase().includes(q) ||
        a.companyCode.toLowerCase().includes(q)
      );
    });
  }, [areaRankings, effectiveCompanyFilter, searchQuery]);

  if (!isOpen) return null;

  const formatNumber = (num: number) => {
    return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-7 relative cursor-default"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-sky-300 flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Chi Tiết Xếp Hạng Điểm Theo Khu Vực
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Xếp hạng theo điểm trung bình trên tổng số thành viên hoạt động
            </p>
          </div>
        </div>

        {/* Filter Bar: Search + Sion Quick Chips */}
        <div className="mt-3.5 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên khu vực, mã KV hoặc Sion..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {uniqueCompanies.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCompanyFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  effectiveCompanyFilter === 'ALL'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                }`}
              >
                Tất cả ({areaRankings.length})
              </button>
              {uniqueCompanies.map((comp) => {
                const count = areaRankings.filter((a) => a.companyCode === comp).length;
                return (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => setCompanyFilter(comp)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      effectiveCompanyFilter === comp
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                    }`}
                  >
                    {comp} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Areas Breakdown Table */}
        <div className="mt-3.5 overflow-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
              <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider font-bold">
                <th className="py-2.5 px-3">Hạng</th>
                <th className="py-2.5 px-3">Khu vực</th>
                <th className="py-2.5 px-3">Sion</th>
                <th className="py-2.5 px-3 text-center">Thành viên</th>
                <th className="py-2.5 px-3 text-right">Tổng điểm</th>
                <th className="py-2.5 px-3 text-right font-black text-blue-900 dark:text-sky-300">
                  Điểm TB/Người
                </th>
                <th className="py-2.5 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRankings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Không tìm thấy khu vực phù hợp.
                  </td>
                </tr>
              ) : (
                filteredRankings.map((area, idx) => (
                  <tr
                    key={`${area.companyCode}_${area.areaCode}_${idx}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white tabular-nums">
                      #{area.rank}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: area.color || '#3b82f6' }}
                        />
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {area.areaName} ({area.areaCode})
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                      {area.companyCode}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                      {area.activeMembersCount} người
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                      {formatNumber(area.totalScore)} đ
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-blue-800 dark:text-sky-300 text-sm tabular-nums">
                      {formatNumber(area.averageScore)} đ
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectAreaCode(area.areaCode);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/70 text-blue-700 dark:text-sky-300 rounded-lg font-bold text-[11px] transition cursor-pointer"
                      >
                        Lọc bảng
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Action */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span className="tabular-nums">
            Hiển thị {filteredRankings.length}/{areaRankings.length} khu vực
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

