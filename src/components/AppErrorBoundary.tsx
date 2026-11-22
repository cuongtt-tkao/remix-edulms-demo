import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Lỗi hiển thị giao diện không xác định.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Lỗi render:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleHardReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Đã xảy ra sự cố hiển thị
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Một phần dữ liệu vừa tải chưa đúng định dạng nên trang tạm ngưng để bảo vệ phiên làm việc của bạn.
              </p>
              {this.state.errorMessage && (
                <div className="mt-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 font-mono break-words text-left">
                  {this.state.errorMessage}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử khôi phục</span>
              </button>
              <button
                type="button"
                onClick={this.handleHardReload}
                className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tải lại trang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
