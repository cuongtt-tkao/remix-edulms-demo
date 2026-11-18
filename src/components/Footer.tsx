import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface FooterProps {
  onOpenRulesModal: () => void;
  onScrollToSection: (sectionId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenRulesModal, onScrollToSection }) => {
  return (
    <footer className="bg-slate-900 text-white border-t border-slate-800 pt-10 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pb-6 border-b border-slate-800">
          {/* Left Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md">
              H
            </div>
            <div>
              <div className="font-black text-lg tracking-tight font-cinzel text-white">
                Hành Thực Lục
              </div>
              <div className="text-xs text-amber-200/80 font-medium">
                Báo cáo hằng ngày • Lan tỏa thực hành
              </div>
            </div>
          </div>

          {/* Center Info */}
          <div className="text-center space-y-2">
            <div className="font-bold text-sm text-slate-200 tracking-wide uppercase">
              Lễ hội thi đua Hành Thực Lục
            </div>
            <div className="text-xs text-slate-400">Kết nối • Lan tỏa • Tiến bước</div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => onScrollToSection('entry-section')}
                className="text-xs text-slate-300 hover:text-white transition underline cursor-pointer"
              >
                Báo cáo hằng ngày
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={() => onScrollToSection('leaderboard-section')}
                className="text-xs text-slate-300 hover:text-white transition underline cursor-pointer"
              >
                Bảng vinh danh
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={() => onScrollToSection('admin-section')}
                className="text-xs text-slate-300 hover:text-white transition underline cursor-pointer"
              >
                Trang quản trị
              </button>
            </div>
          </div>

          {/* Right Scripture Quote */}
          <div className="text-left md:text-right">
            <blockquote className="text-sm font-medium italic text-amber-100/90 leading-relaxed">
              “Ngài đã ban cho chúng ta sứ mạng này.”
            </blockquote>
            <div className="text-xs font-bold text-amber-400 mt-1">Ma-thi-ơ 28:19</div>
          </div>
        </div>

        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Hành Thực Lục — Nền tảng báo cáo hằng ngày và vinh danh thi đua trực tuyến.</span>
          </div>

          <button
            onClick={onOpenRulesModal}
            className="hover:text-amber-300 transition underline underline-offset-2 cursor-pointer"
          >
            Thể lệ &amp; Cơ chế tính điểm sự kiện
          </button>
        </div>
      </div>
    </footer>
  );
};
