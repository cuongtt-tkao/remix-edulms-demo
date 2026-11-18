import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Search,
  Filter,
  User,
  Users,
  Building2,
  MapPin,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { Member, CompanyRankItem, AreaRankItem } from '../types/edulms';
import { exportCompetitionToExcel, printCompetitionReport } from '../utils/reportExporter';
import { TrendingChartsModal } from './TrendingChartsModal';
import { CustomSelect } from './CustomSelect';

interface LeaderboardRbacInfo {
  scopeBadge: string;
  scopeTitle: string;
  scopeDescription: string;
  isScopedRestricted: boolean;
  top15Ids: Set<string>;
  accessibleDetailIds: Set<string>;
}

interface LeaderboardTableProps {
  members: Member[];
  companyRankings: CompanyRankItem[];
  areaRankings: AreaRankItem[];
  lastUpdated: string;
  selectedAreaCode: string | null;
  onSelectAreaCode: (code: string | null) => void;
  onSelectMember: (member: Member) => void;
  onOpenRules: () => void;
  rbacInfo?: LeaderboardRbacInfo;
  currentMemberId?: string;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  members,
  companyRankings,
  areaRankings,
  lastUpdated,
  selectedAreaCode,
  onSelectAreaCode,
  onSelectMember,
  onOpenRules,
  rbacInfo,
  currentMemberId,
}) => {
  const [activeTab, setActiveTab] = useState<'PERSON' | 'AREA' | 'COMPANY'>('PERSON');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [displayCount, setDisplayCount] = useState<number>(10);

  const formatNumber = (num: number) => {
    return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Filtered Members
  const filteredMembers = useMemo(() => {
    let list = members;
    if (selectedAreaCode) {
      list = list.filter((m) => m.areaCode === selectedAreaCode);
    }
    if (selectedCompanyFilter !== 'ALL') {
      list = list.filter((m) => m.companyCode === selectedCompanyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.companyCode.toLowerCase().includes(q) ||
          m.areaCode.toLowerCase().includes(q) ||
          m.departmentCode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, selectedAreaCode, selectedCompanyFilter, searchQuery]);

  // Filtered Areas
  const filteredAreas = useMemo(() => {
    let list = areaRankings;
    if (selectedCompanyFilter !== 'ALL') {
      list = list.filter((a) => a.companyCode === selectedCompanyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.areaName.toLowerCase().includes(q) ||
          a.areaCode.toLowerCase().includes(q) ||
          a.companyCode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [areaRankings, selectedCompanyFilter, searchQuery]);

  // Filtered Companies
  const filteredCompanies = useMemo(() => {
    let list = companyRankings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          c.companyCode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [companyRankings, searchQuery]);

  const visibleMembers = filteredMembers.slice(0, displayCount);

  // Render Rank Badge helper
  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-amber-950 font-black inline-flex items-center justify-center text-xs shadow-md shadow-amber-500/20">
          1
        </span>
      );
    } else if (rank === 2) {
      return (
        <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-800 font-black inline-flex items-center justify-center text-xs shadow-xs">
          2
        </span>
      );
    } else if (rank === 3) {
      return (
        <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 text-white font-black inline-flex items-center justify-center text-xs shadow-xs">
          3
        </span>
      );
    }
    return (
      <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold inline-flex items-center justify-center text-xs">
        {rank}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors" id="leaderboard-section">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>Bảng xếp hạng thi đua</span>
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">Cập nhật tức thì:</span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {lastUpdated}
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* 3 Tab Vinh danh (Cá nhân, Khu vực, Công ty) */}
        <div className="grid grid-cols-3 sm:inline-flex p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl text-[11px] sm:text-xs font-bold w-full sm:w-auto gap-1">
          <button
            onClick={() => setActiveTab('PERSON')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'PERSON'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Cá nhân</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'PERSON' ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {members.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('AREA')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'AREA'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Khu vực</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'AREA' ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {areaRankings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('COMPANY')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'COMPANY'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Công ty</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'COMPANY' ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {companyRankings.length}
            </span>
          </button>
        </div>
      </div>

      {/* Explanatory banner for Ranking Rules */}
      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-300 gap-2">
        <div>
          {activeTab === 'PERSON' && (
            <span>⭐ <strong>Xếp hạng Cá nhân:</strong> Tính theo tổng điểm các đối tượng đã ghi nhận. Cùng điểm thì đồng hạng.</span>
          )}
          {activeTab === 'AREA' && (
            <span>📍 <strong>Xếp hạng Khu vực:</strong> Tính theo <strong>điểm trung bình mỗi thành viên</strong> hoạt động trong KV (người chưa ghi tính 0đ).</span>
          )}
          {activeTab === 'COMPANY' && (
            <span>🏢 <strong>Xếp hạng Công ty:</strong> Tính theo <strong>điểm trung bình mỗi thành viên</strong> hoạt động trong Cty (người chưa ghi tính 0đ).</span>
          )}
        </div>
        <button
          onClick={onOpenRules}
          className="text-blue-700 hover:underline font-bold text-[11px]"
        >
          Chi tiết quy tắc →
        </button>
      </div>

      {/* Search & Filtering Bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nhanh..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {/* Company filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
          <div className="w-full sm:w-60">
            <CustomSelect
              size="sm"
              value={selectedCompanyFilter}
              onChange={setSelectedCompanyFilter}
              leadingIcon={<Building2 className="w-3.5 h-3.5" />}
              options={[
                { value: 'ALL', label: 'Tất cả Sion / Công ty' },
                ...companyRankings.map((c) => ({
                  value: c.companyCode,
                  label: c.companyName,
                  badge: c.companyCode,
                })),
              ]}
            />
          </div>

          {selectedAreaCode && (
            <button
              onClick={() => onSelectAreaCode(null)}
              className="text-blue-700 dark:text-blue-400 underline font-semibold text-[11px] ml-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Bỏ lọc KV {selectedAreaCode}
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: CÁ NHÂN */}
      {activeTab === 'PERSON' && (
        <div className="mt-4">
          {/* Mobile Card List */}
          <div className="md:hidden space-y-2.5">
            {visibleMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                Không tìm thấy thành viên nào phù hợp bộ lọc.
              </div>
            ) : (
              visibleMembers.map((mem) => {
                const canInspect = !rbacInfo || rbacInfo.accessibleDetailIds.has(mem.id);
                const isSelf = currentMemberId && mem.id === currentMemberId;
                return (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => onSelectMember(mem)}
                  className="w-full text-left p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-blue-50/70 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderRankBadge(mem.rank || 1)}
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{mem.fullName}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                            Bạn
                          </span>
                        )}
                        {!canInspect && (
                          <span title="Ngoài phạm vi xem chi tiết" className="inline-flex shrink-0">
                            <Lock className="w-3 h-3 text-slate-400" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {mem.companyCode} • KV {mem.areaCode} • {mem.unitCode || mem.departmentCode}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-sm text-blue-700 dark:text-blue-300 tabular-nums">
                      {formatNumber(mem.score)} đ
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {canInspect ? `${mem.targets?.length || 0} mục tiêu` : 'Top 15'}
                    </div>
                  </div>
                </button>
              );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-3 w-16 text-center">Hạng</th>
                  <th className="py-3 px-3">Họ và tên</th>
                  <th className="py-3 px-3">Công ty</th>
                  <th className="py-3 px-3">Khu vực</th>
                  <th className="py-3 px-3">Uni / Ban</th>
                  <th className="py-3 px-3 text-center">Số đối tượng</th>
                  <th className="py-3 px-3 text-right">Tổng điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {visibleMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                      Không tìm thấy thành viên nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  visibleMembers.map((mem) => {
                    const canInspect = !rbacInfo || rbacInfo.accessibleDetailIds.has(mem.id);
                    const isSelf = currentMemberId && mem.id === currentMemberId;
                    return (
                    <tr
                      key={mem.id}
                      onClick={() => onSelectMember(mem)}
                      className="hover:bg-blue-50/80 dark:hover:bg-slate-800/90 transition-all duration-150 cursor-pointer group"
                    >
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {renderRankBadge(mem.rank || 1)}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition flex items-center gap-1.5">
                              <span>{mem.fullName}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                  Bạn
                                </span>
                              )}
                              {!canInspect && (
                                <span title="Top 15 chung — ngoài phạm vi xem chi tiết">
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{mem.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{mem.companyCode}</td>
                      <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{mem.areaCode}</td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 text-xs">{mem.unitCode || mem.departmentCode}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                        {canInspect ? (mem.targets?.length || 0) : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-black text-slate-900 dark:text-white tabular-nums">
                        {formatNumber(mem.score)} đ
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredMembers.length > displayCount && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => setDisplayCount((prev) => prev + 10)}
                className="font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Xem thêm 10 thành viên khác →
              </button>
              <span className="text-slate-400">
                Hiển thị {visibleMembers.length}/{filteredMembers.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: KHU VỰC */}
      {activeTab === 'AREA' && (
        <div className="mt-4">
          <div className="md:hidden space-y-2.5">
            {filteredAreas.map((area, idx) => (
              <button
                key={`${area.companyCode}_${area.areaCode}_${idx}`}
                type="button"
                onClick={() => onSelectAreaCode(area.areaCode)}
                className="w-full text-left p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-blue-50/70 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderRankBadge(area.rank)}
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: area.color || '#3b82f6' }}
                      />
                      <span className="truncate">{area.areaName} ({area.areaCode})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {area.companyCode} • {area.activeMembersCount} thành viên • Tổng {formatNumber(area.totalScore)} đ
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-sm text-blue-700 dark:text-blue-300 tabular-nums">
                    {formatNumber(area.averageScore)} đ
                  </div>
                  <div className="text-[10px] text-slate-400">TB/người</div>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-3 w-16 text-center">Hạng</th>
                  <th className="py-3 px-3">Khu vực</th>
                  <th className="py-3 px-3">Trực thuộc Cty</th>
                  <th className="py-3 px-3 text-center">Số thành viên hoạt động</th>
                  <th className="py-3 px-3 text-right">Tổng điểm khu vực</th>
                  <th className="py-3 px-3 text-right font-bold text-blue-900 dark:text-blue-300">Điểm TB/Thành viên</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {filteredAreas.map((area, idx) => (
                  <tr
                    key={`${area.companyCode}_${area.areaCode}_${idx}`}
                    onClick={() => onSelectAreaCode(area.areaCode)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {renderRankBadge(area.rank)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: area.color || '#3b82f6' }}
                        />
                        <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition">
                          {area.areaName} ({area.areaCode})
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{area.companyCode}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {area.activeMembersCount} người
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                      {formatNumber(area.totalScore)} đ
                    </td>
                    <td className="py-3.5 px-3 text-right font-black text-blue-800 dark:text-blue-300 text-base tabular-nums">
                      {formatNumber(area.averageScore)} đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: CÔNG TY */}
      {activeTab === 'COMPANY' && (
        <div className="mt-4">
          <div className="md:hidden space-y-2.5">
            {filteredCompanies.map((comp, idx) => (
              <div
                key={`${comp.companyCode}_${idx}`}
                className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderRankBadge(comp.rank)}
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {comp.companyName} <span className="text-blue-600 dark:text-blue-400">({comp.companyCode})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {comp.activeMembersCount} thành viên • Tổng {formatNumber(comp.totalScore)} đ
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-sm text-blue-700 dark:text-blue-300 tabular-nums">
                    {formatNumber(comp.averageScore)} đ
                  </div>
                  <div className="text-[10px] text-slate-400">TB/người</div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-3 w-16 text-center">Hạng</th>
                  <th className="py-3 px-3">Mã Cty</th>
                  <th className="py-3 px-3">Tên Công ty</th>
                  <th className="py-3 px-3 text-center">Số thành viên hoạt động</th>
                  <th className="py-3 px-3 text-right">Tổng điểm tích lũy</th>
                  <th className="py-3 px-3 text-right font-bold text-blue-900 dark:text-blue-300">Điểm TB/Thành viên</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {filteredCompanies.map((comp, idx) => (
                  <tr key={`${comp.companyCode}_${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition-colors group">
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {renderRankBadge(comp.rank)}
                    </td>
                    <td className="py-3.5 px-3 font-black text-blue-700 dark:text-blue-300">{comp.companyCode}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-slate-100">{comp.companyName}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {comp.activeMembersCount} người
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                      {formatNumber(comp.totalScore)} đ
                    </td>
                    <td className="py-3.5 px-3 text-right font-black text-blue-800 dark:text-blue-300 text-base tabular-nums">
                      {formatNumber(comp.averageScore)} đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
