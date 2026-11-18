import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface FooterProps {
  onOpenRulesModal: () => void;
  onScrollToSection: (sectionId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenRulesModal, onScrollToSection }) => {
  return (
    <footer className="bg-slate-900 text-white border-t border-slate-800 pt-8 pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          {/* Left Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shrink-0">
              H
            </div>
            <div>
              <div className="font-black text-lg tracking-tight font-cinzel text-white">
                Hành Thực Lục
              </div>
              <div className="text-xs text-amber-200/80 font-medium">
                Báo cáo hằng ngày · Thi đua &amp; Đào tạo trực tuyến
              </div>
            </div>
          </div>

          {/* Right Quick Links */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <button
              type="button"
              onClick={() => onScrollToSection('entry-section')}
              className="text-slate-300 hover:text-white transition underline underline-offset-2 cursor-pointer"
            >
              Báo cáo hằng ngày
            </button>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onScrollToSection('leaderboard-section')}
              className="text-slate-300 hover:text-white transition underline underline-offset-2 cursor-pointer"
            >
              Bảng xếp hạng
            </button>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onScrollToSection('admin-section')}
              className="text-slate-300 hover:text-white transition underline underline-offset-2 cursor-pointer"
            >
              Quản trị
            </button>
          </div>
        </div>

        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Hành Thực Lục — Nền tảng báo cáo hằng ngày và vinh danh thi đua trực tuyến.</span>
          </div>

          <button
            type="button"
            onClick={onOpenRulesModal}
            className="hover:text-amber-300 transition underline underline-offset-2 cursor-pointer shrink-0"
          >
            Thể lệ &amp; Cơ chế tính điểm
          </button>
        </div>
      </div>
    </footer>
  );
};
