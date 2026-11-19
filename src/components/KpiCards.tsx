import React from 'react';
import { Trophy, Users, Target, Star } from 'lucide-react';
import { KpiSummary } from '../types/edulms';

interface KpiCardsProps {
  kpi: KpiSummary;
  /** Chỉ kéo chồng lên mép dưới Banner khi nằm ngay sau Banner đang hiển thị */
  overlapBanner?: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpi, overlapBanner = false }) => {
  const formatNumber = (num: number) => {
    return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const cards = [
    {
      title: 'Tổng số đội tham gia',
      value: kpi.totalTeams,
      unit: 'đội',
      icon: Trophy,
      iconBg: 'bg-amber-500',
    },
    {
      title: 'Tổng số thành viên',
      value: kpi.totalMembers,
      unit: 'người',
      icon: Users,
      iconBg: 'bg-blue-500',
    },
    {
      title: 'Tổng lượt báo cáo ngày',
      value: formatNumber(kpi.totalTargets),
      unit: 'báo cáo',
      icon: Target,
      iconBg: 'bg-emerald-500',
    },
    {
      title: 'Tổng điểm toàn chương trình',
      value: formatNumber(kpi.totalPoints),
      unit: 'điểm',
      icon: Star,
      iconBg: 'bg-purple-600',
    },
  ];

  return (
    <div
      className={`relative max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full z-20 ${
        overlapBanner ? '-mt-2.5 sm:-mt-4' : ''
      }`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 sm:gap-3.5 group"
            >
              <div
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${card.iconBg} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-200`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate mb-0.5">
                  {card.title}
                </div>
                <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                  <span className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                    {card.value}
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {card.unit}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
