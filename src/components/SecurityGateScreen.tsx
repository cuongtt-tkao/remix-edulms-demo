import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  LogIn,
  UserPlus,
  LogOut,
  Building2,
  MapPin,
  Users2,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Delete,
  Eye,
  EyeOff,
  Sparkles,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Company,
  Area,
  Department,
  UserAccount,
  ROLE_DISPLAY_META,
  formatCompanyDisplayName,
} from '../types/edulms';
import { CustomSelect } from './CustomSelect';
import { signInWithGoogle, describeAuthError, FirebaseUser } from '../firebase';
import {
  hashPersonalPin,
  verifyPersonalPin,
  sanitizePinInput,
  isValidPersonalPin,
} from '../utils/pinSecurity';

export type SecurityGateMode =
  | 'LOADING'
  | 'PROFILE_ERROR'
  | 'UNAUTHENTICATED'
  | 'ONBOARDING'
  | 'PENDING_APPROVAL'
  | 'REJECTED_APPROVAL'
  | 'PIN_SETUP'
  | 'PIN_LOCKED';

export interface OnboardingSubmitData {
  fullName: string;
  companyCode: string;
  areaCode: string;
  departmentCode: string;
  unitCode?: string;
  pin: string;
}

interface SecurityGateScreenProps {
  mode: SecurityGateMode;
  firebaseUser: FirebaseUser | null;
  currentUser: UserAccount | null;
  profileError?: string | null;
  companies: Company[];
  areas: Area[];
  departments: Department[];
  requireRegistrationApproval?: boolean;
  onOpenAuthModal: (initialMode: 'LOGIN' | 'REGISTER') => void;
  onCompleteOnboarding: (data: OnboardingSubmitData) => Promise<void>;
  onSetupPin: (pinHash: string) => Promise<void>;
  onPinUnlocked: () => void;
  onRetryProfile?: () => void;
  onLogout: () => void;
}

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const PIN_GUARD_STORAGE_PREFIX = 'htl_pin_guard_';

interface PinGuardState {
  fails: number;
  lockedUntilMs: number;
  lockCount: number;
}

function readPinGuardState(uid?: string | null): PinGuardState {
  if (!uid) return { fails: 0, lockedUntilMs: 0, lockCount: 0 };
  try {
    const raw = localStorage.getItem(`${PIN_GUARD_STORAGE_PREFIX}${uid}`);
    if (!raw) return { fails: 0, lockedUntilMs: 0, lockCount: 0 };
    const parsed = JSON.parse(raw);
    return {
      fails: Number(parsed?.fails) || 0,
      lockedUntilMs: Number(parsed?.lockedUntilMs) || 0,
      lockCount: Number(parsed?.lockCount) || 0,
    };
  } catch {
    return { fails: 0, lockedUntilMs: 0, lockCount: 0 };
  }
}

function writePinGuardState(uid: string | undefined | null, state: PinGuardState | null): void {
  if (!uid) return;
  try {
    const key = `${PIN_GUARD_STORAGE_PREFIX}${uid}`;
    if (!state) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export const SecurityGateScreen: React.FC<SecurityGateScreenProps> = ({
  mode,
  firebaseUser,
  currentUser,
  profileError,
  companies,
  areas,
  departments,
  requireRegistrationApproval = true,
  onOpenAuthModal,
  onCompleteOnboarding,
  onSetupPin,
  onPinUnlocked,
  onRetryProfile,
  onLogout,
}) => {
  // ---------- Auth Gate (Google quick sign-in) ----------
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [gateError, setGateError] = useState('');
  const [loadingTakingLong, setLoadingTakingLong] = useState(false);

  useEffect(() => {
    if (mode !== 'LOADING') {
      setLoadingTakingLong(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTakingLong(true), 3500);
    return () => clearTimeout(timer);
  }, [mode]);

  // ---------- Onboarding state ----------
  const [obFullName, setObFullName] = useState('');
  const [obCompany, setObCompany] = useState(companies[0]?.code || 'Th1');
  const [obArea, setObArea] = useState('');
  const [obDept, setObDept] = useState(departments[0]?.code || 'Thanh Niên Nam');
  const [obUnitCode, setObUnitCode] = useState('');
  const [obPin, setObPin] = useState('');
  const [obPinConfirm, setObPinConfirm] = useState('');
  const [isSubmittingOb, setIsSubmittingOb] = useState(false);

  // ---------- PIN Setup state ----------
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [showPinDigits, setShowPinDigits] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // ---------- PIN Unlock state ----------
  const [unlockPin, setUnlockPin] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockCount, setLockCount] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const unlockInputRef = useRef<HTMLInputElement | null>(null);

  // Sync defaults when companies/areas/departments load or onboarding opens
  useEffect(() => {
    if (mode === 'ONBOARDING') {
      setGateError('');
      setObFullName((prev) =>
        prev ||
        firebaseUser?.displayName ||
        (firebaseUser?.email ? firebaseUser.email.split('@')[0] : '') ||
        ''
      );
      if (companies.length > 0 && !companies.some((c) => c.code === obCompany)) {
        setObCompany(companies[0].code);
      }
      if (departments.length > 0 && !departments.some((d) => d.code === obDept)) {
        setObDept(departments[0].code);
      }
    }
  }, [mode, firebaseUser?.displayName, firebaseUser?.email, companies, departments]);

  const areasForSelectedCompany = useMemo(
    () => areas.filter((a) => a.companyCode === obCompany && a.active !== false),
    [areas, obCompany]
  );

  useEffect(() => {
    if (areasForSelectedCompany.length > 0) {
      if (!areasForSelectedCompany.some((a) => a.code === obArea)) {
        setObArea(areasForSelectedCompany[0].code);
      }
    } else if (!obArea && areas.length > 0) {
      setObArea(areas[0].code);
    }
  }, [areasForSelectedCompany, areas, obCompany]);

  // Restore persisted PIN lockout & reset fields when switching modes/users
  useEffect(() => {
    setGateError('');
    setUnlockPin('');
    setSetupPin('');
    setSetupPinConfirm('');
    if (mode === 'PIN_LOCKED' && currentUser?.id) {
      const saved = readPinGuardState(currentUser.id);
      const remainingSec =
        saved.lockedUntilMs > Date.now()
          ? Math.ceil((saved.lockedUntilMs - Date.now()) / 1000)
          : 0;
      setFailedAttempts(remainingSec > 0 ? 0 : saved.fails);
      setLockCount(saved.lockCount);
      setCooldownRemaining(remainingSec);
      if (remainingSec > 0) {
        setGateError(`Bạn đã nhập sai quá số lần quy định. Vui lòng chờ ${remainingSec} giây hoặc đăng xuất.`);
      }
      setTimeout(() => unlockInputRef.current?.focus(), 80);
    } else {
      setFailedAttempts(0);
      setCooldownRemaining(0);
    }
  }, [mode, currentUser?.id]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const t = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (currentUser?.id) {
            writePinGuardState(currentUser.id, { fails: 0, lockedUntilMs: 0, lockCount });
          }
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownRemaining, currentUser?.id, lockCount]);

  // Verify PIN helper
  const handleVerifyUnlockPin = async (candidatePin: string) => {
    if (!currentUser || !currentUser.pinHash) return;
    if (cooldownRemaining > 0 || isVerifyingPin) return;
    const clean = sanitizePinInput(candidatePin);
    if (!isValidPersonalPin(clean)) {
      setGateError('Vui lòng nhập đủ 6 chữ số.');
      return;
    }

    setIsVerifyingPin(true);
    setGateError('');
    try {
      const ok = await verifyPersonalPin(currentUser.id, clean, currentUser.pinHash);
      if (ok) {
        setFailedAttempts(0);
        setLockCount(0);
        setCooldownRemaining(0);
        writePinGuardState(currentUser.id, null);
        setUnlockPin('');
        onPinUnlocked();
      } else {
        const nextFails = failedAttempts + 1;
        setUnlockPin('');
        if (nextFails >= MAX_PIN_ATTEMPTS) {
          const nextLockCount = Math.min(4, lockCount + 1);
          const durationSec = LOCKOUT_SECONDS * Math.pow(2, nextLockCount - 1);
          const lockedUntilMs = Date.now() + durationSec * 1000;
          setFailedAttempts(0);
          setLockCount(nextLockCount);
          setCooldownRemaining(durationSec);
          writePinGuardState(currentUser.id, {
            fails: 0,
            lockedUntilMs,
            lockCount: nextLockCount,
          });
          setGateError(
            `Bạn đã nhập sai ${MAX_PIN_ATTEMPTS} lần. Vui lòng chờ ${durationSec} giây hoặc đăng xuất.`
          );
        } else {
          setFailedAttempts(nextFails);
          writePinGuardState(currentUser.id, {
            fails: nextFails,
            lockedUntilMs: 0,
            lockCount,
          });
          setGateError(
            `Mã cá nhân chưa đúng (còn ${MAX_PIN_ATTEMPTS - nextFails} lần thử).`
          );
        }
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Auto-submit when 6 digits entered on PIN_LOCKED
  useEffect(() => {
    if (mode === 'PIN_LOCKED' && unlockPin.length === 6 && cooldownRemaining === 0 && !isVerifyingPin) {
      handleVerifyUnlockPin(unlockPin);
    }
  }, [unlockPin, mode]);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setGateError('');
      await signInWithGoogle();
    } catch (err: any) {
      setGateError(describeAuthError(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError('');
    if (!obFullName.trim()) {
      setGateError('Vui lòng nhập họ và tên.');
      return;
    }
    if (!obCompany.trim()) {
      setGateError('Vui lòng chọn Sion / Công ty.');
      return;
    }
    if (!obArea.trim()) {
      setGateError('Vui lòng chọn Khu vực.');
      return;
    }
    if (!isValidPersonalPin(obPin)) {
      setGateError('Mã cá nhân phải gồm đúng 6 chữ số (0–9).');
      return;
    }
    if (obPin !== obPinConfirm) {
      setGateError('Mã cá nhân xác nhận chưa khớp.');
      return;
    }

    setIsSubmittingOb(true);
    try {
      await onCompleteOnboarding({
        fullName: obFullName.trim(),
        companyCode: obCompany.trim(),
        areaCode: obArea.trim(),
        departmentCode: obDept.trim(),
        unitCode: obUnitCode.trim() || undefined,
        pin: obPin,
      });
    } catch (err: any) {
      setGateError(err?.message || 'Không lưu được hồ sơ. Vui lòng thử lại.');
    } finally {
      setIsSubmittingOb(false);
    }
  };

  const handleSetupPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setGateError('');
    if (!isValidPersonalPin(setupPin)) {
      setGateError('Mã cá nhân phải gồm đúng 6 chữ số (0–9).');
      return;
    }
    if (setupPin !== setupPinConfirm) {
      setGateError('Mã cá nhân xác nhận chưa khớp.');
      return;
    }

    setIsSavingPin(true);
    try {
      const pinHash = await hashPersonalPin(currentUser.id, setupPin);
      await onSetupPin(pinHash);
    } catch (err: any) {
      setGateError(err?.message || 'Không lưu được mã PIN. Vui lòng thử lại.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const appendDigit = (digit: string) => {
    if (cooldownRemaining > 0 || isVerifyingPin) return;
    setGateError('');
    setUnlockPin((prev) => (prev.length < 6 ? prev + digit : prev));
  };

  const backspaceDigit = () => {
    if (cooldownRemaining > 0 || isVerifyingPin) return;
    setGateError('');
    setUnlockPin((prev) => prev.slice(0, -1));
  };

  const roleMeta = currentUser ? ROLE_DISPLAY_META[currentUser.role] || ROLE_DISPLAY_META.MEMBER : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0d1936] to-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      {/* Subtle decorative radial lights */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-lg ring-1 ring-amber-300/60 mb-2.5">
            <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 2L13.5 5.5L17 6L14.5 8.5L15 12L12 10.2L9 12L9.5 8.5L7 6L10.5 5.5L12 2Z"
                  fill="currentColor"
                  fillOpacity="0.9"
                  strokeWidth="0.5"
                  stroke="#fef08a"
                />
                <path
                  d="M4 19.5C5.5 18 8 18 12 19C16 18 18.5 18 20 19.5V8.5C18.5 7 16 7 12 8C8 7 5.5 7 4 8.5V19.5Z"
                  fill="#fef3c7"
                  fillOpacity="0.22"
                  stroke="#fde047"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <line x1="12" y1="8" x2="12" y2="19" stroke="#fde047" strokeWidth="1.2" />
              </svg>
            </div>
          </div>
          <h1 className="font-cinzel font-black text-xl sm:text-2xl text-white tracking-tight">
            Hành Thực Lục
          </h1>
          <p className="text-[11px] text-amber-200/80 font-medium mt-0.5">
            Hệ thống Thi đua · Báo cáo · Giáo dục · Lịch làm việc
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white/15 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          {mode === 'LOADING' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="text-sm font-bold text-slate-800 dark:text-white">
                Đang kiểm tra xác thực bảo mật...
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {firebaseUser?.email
                  ? `Đang tải hồ sơ ${firebaseUser.email} từ Firestore (default)...`
                  : 'Vui lòng chờ trong giây lát.'}
              </p>
              {loadingTakingLong && (
                <div className="pt-2 w-full space-y-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Quá trình kiểm tra đang mất thời gian hơn bình thường.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {onRetryProfile && (
                      <button
                        type="button"
                        onClick={onRetryProfile}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Thử lại</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onLogout}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'PROFILE_ERROR' && (
            <div className="py-4 space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-extrabold text-rose-800 dark:text-rose-200">
                    Không thể hoàn tất kiểm tra xác thực
                  </div>
                  {firebaseUser?.email && (
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                      Tài khoản: {firebaseUser.email}
                    </div>
                  )}
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed whitespace-pre-line">
                    {profileError ||
                      'Không thể kết nối tới cơ sở dữ liệu Firestore (default). Vui lòng thử lại hoặc đăng xuất.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {onRetryProfile && (
                  <button
                    type="button"
                    onClick={onRetryProfile}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold shadow-sm transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Thử kết nối lại</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất / Đổi tài khoản</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'UNAUTHENTICATED' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60">
                <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Cổng truy cập bảo mật 2 lớp
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Đăng nhập tài khoản và nhập <strong>Mã cá nhân 6 số</strong> để xem đúng dữ liệu thuộc Sion / Khu vực và quyền của bạn.
                    {requireRegistrationApproval && (
                      <> Đăng ký mới cần Admin phê duyệt trước khi truy cập.</>
                    )}
                  </p>
                </div>
              </div>

              {gateError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{gateError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-2xl border border-slate-300 dark:border-slate-700 shadow-xs transition flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>Tiếp tục với Google</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('LOGIN')}
                  className="py-2.5 px-3 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('REGISTER')}
                  className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Đăng ký mới</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'ONBOARDING' && (
            <form onSubmit={handleOnboardingSubmit} className="space-y-3">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Hoàn tất hồ sơ lần đầu</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {firebaseUser?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Thoát</span>
                </button>
              </div>

              {gateError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-semibold">
                  {gateError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  value={obFullName}
                  onChange={(e) => setObFullName(e.target.value)}
                  placeholder="Nhập họ tên đầy đủ..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sion / Công ty *
                  </label>
                  <CustomSelect
                    value={obCompany}
                    onChange={setObCompany}
                    size="sm"
                    leadingIcon={<Building2 className="w-3.5 h-3.5" />}
                    options={companies.map((c) => ({
                      value: c.code,
                      label: formatCompanyDisplayName(c.name, c.code),
                      badge: c.code,
                    }))}
                    ariaLabel="Chọn Sion / Công ty"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Khu vực *
                  </label>
                  {areasForSelectedCompany.length > 0 ? (
                    <CustomSelect
                      value={obArea}
                      onChange={setObArea}
                      size="sm"
                      leadingIcon={<MapPin className="w-3.5 h-3.5" />}
                      options={areasForSelectedCompany.map((a) => ({
                        value: a.code,
                        label: a.name || `Khu vực ${a.code}`,
                        badge: a.code,
                      }))}
                      ariaLabel="Chọn Khu vực"
                    />
                  ) : (
                    <input
                      type="text"
                      value={obArea}
                      onChange={(e) => setObArea(e.target.value)}
                      placeholder="VD: 1.1"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ban ngành *
                  </label>
                  <CustomSelect
                    value={obDept}
                    onChange={setObDept}
                    size="sm"
                    searchable={false}
                    leadingIcon={<Users2 className="w-3.5 h-3.5" />}
                    options={departments.map((d) => ({
                      value: d.code,
                      label: d.name,
                    }))}
                    ariaLabel="Chọn Ban ngành"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đội / Uni
                  </label>
                  <input
                    type="text"
                    value={obUnitCode}
                    onChange={(e) => setObUnitCode(e.target.value)}
                    placeholder="VD: Uni 1, Đội A"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-2.5">
                <div className="text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Đặt Mã cá nhân 6 số (PIN) bảo vệ tài khoản</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mã PIN (6 chữ số) *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={obPin}
                      onChange={(e) => setObPin(sanitizePinInput(e.target.value))}
                      placeholder="••••••"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center tracking-[0.35em] text-sm font-black text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nhập lại 6 số *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={obPinConfirm}
                      onChange={(e) => setObPinConfirm(sanitizePinInput(e.target.value))}
                      placeholder="••••••"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center tracking-[0.35em] text-sm font-black text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingOb}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isSubmittingOb ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Hoàn tất &amp; Vào hệ thống</span>
              </button>
            </form>
          )}

          {mode === 'PENDING_APPROVAL' && currentUser && (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      Chờ Admin phê duyệt
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-100 space-y-1.5 leading-relaxed">
                <div className="font-extrabold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Hồ sơ của bạn đã được gửi tới Ban Quản trị</span>
                </div>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90">
                  Để bảo mật thông tin toàn hệ thống, tài khoản mới cần Admin hoặc Tổng Quản trị xác nhận trước khi xem dữ liệu. Màn hình này sẽ tự động mở khóa ngay khi được phê duyệt.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Họ và tên:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white truncate">
                    {currentUser.fullName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Đơn vị đăng ký:</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300 truncate">
                    Sion {currentUser.companyCode} · KV {currentUser.areaCode}
                    {currentUser.unitCode ? ` · ${currentUser.unitCode}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Ban ngành:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {currentUser.departmentCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span>Đang chờ Admin xác nhận tự động theo thời gian thực...</span>
              </div>
            </div>
          )}

          {mode === 'REJECTED_APPROVAL' && currentUser && (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      Yêu cầu đăng ký chưa được duyệt
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 space-y-1.5 leading-relaxed">
                <div className="font-bold">
                  Tài khoản {currentUser.fullName} ({currentUser.companyCode} · KV {currentUser.areaCode}) hiện chưa được cấp quyền truy cập.
                </div>
                {currentUser.rejectionReason && (
                  <div className="text-[11px] bg-white/70 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-800">
                    <strong>Lý do:</strong> {currentUser.rejectionReason}
                  </div>
                )}
                <p className="text-[11px]">
                  Vui lòng liên hệ Quản trị viên hoặc Trưởng Khu vực/Sion để kiểm tra lại thông tin.
                </p>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất / Đổi tài khoản</span>
              </button>
            </div>
          )}

          {mode === 'PIN_SETUP' && currentUser && (
            <form onSubmit={handleSetupPinSubmit} className="space-y-3.5">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Thiết lập Mã cá nhân 6 số</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {currentUser.fullName} · Sion {currentUser.companyCode} · KV {currentUser.areaCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {roleMeta && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Vai trò &amp; Quyền:</span>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${roleMeta.badgeClass}`}>
                      {roleMeta.label}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">{roleMeta.scopeSummary}</div>
                </div>
              )}

              {gateError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-semibold">
                  {gateError}
                </div>
              )}

              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nhập Mã cá nhân mới (6 chữ số) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPinDigits((v) => !v)}
                      className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      {showPinDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPinDigits ? 'Ẩn số' : 'Hiện số'}</span>
                    </button>
                  </div>
                  <input
                    type={showPinDigits ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={setupPin}
                    onChange={(e) => setSetupPin(sanitizePinInput(e.target.value))}
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-center tracking-[0.45em] text-base font-black text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Xác nhận lại 6 chữ số *
                  </label>
                  <input
                    type={showPinDigits ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={setupPinConfirm}
                    onChange={(e) => setSetupPinConfirm(sanitizePinInput(e.target.value))}
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-center tracking-[0.45em] text-base font-black text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPin}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isSavingPin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Lưu Mã PIN &amp; Mở khóa</span>
              </button>
            </form>
          )}

          {mode === 'PIN_LOCKED' && currentUser && (
            <div className="space-y-3.5">
              {/* Current Signed-In Account Summary */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-sm flex items-center justify-center shrink-0 overflow-hidden">
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (currentUser.fullName || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 truncate">
                      Sion {currentUser.companyCode} · KV {currentUser.areaCode}
                      {currentUser.unitCode ? ` · ${currentUser.unitCode}` : ''}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  title="Đăng xuất hoặc đổi tài khoản"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {roleMeta && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                    {currentUser.email}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${roleMeta.badgeClass}`}>
                    {roleMeta.shortLabel}
                  </span>
                </div>
              )}

              <div className="text-center space-y-1">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>Nhập Mã cá nhân 6 số để mở khóa</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mọi thông tin cá nhân và đơn vị được bảo vệ sau lớp mã này.
                </p>
              </div>

              {/* 6-dot PIN indicator + hidden/accessible numeric input */}
              <div className="relative">
                <div
                  onClick={() => unlockInputRef.current?.focus()}
                  className="grid grid-cols-6 gap-2 max-w-[270px] mx-auto cursor-text"
                >
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const filled = idx < unlockPin.length;
                    const isActive = idx === unlockPin.length;
                    return (
                      <div
                        key={idx}
                        className={`h-11 rounded-xl border-2 flex items-center justify-center transition ${
                          filled
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50'
                            : isActive
                            ? 'border-amber-400 bg-white dark:bg-slate-800'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full transition-transform ${
                            filled
                              ? 'bg-blue-700 dark:bg-amber-400 scale-100'
                              : 'bg-slate-300 dark:bg-slate-600 scale-50 opacity-40'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <input
                  ref={unlockInputRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  disabled={cooldownRemaining > 0 || isVerifyingPin}
                  value={unlockPin}
                  onChange={(e) => {
                    setGateError('');
                    setUnlockPin(sanitizePinInput(e.target.value));
                  }}
                  aria-label="Nhập mã cá nhân 6 số"
                  className="sr-only"
                />
              </div>

              {gateError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-semibold text-center">
                  {gateError}
                </div>
              )}

              {/* Compact On-Screen Numeric Keypad (Thumb-friendly Mobile + Desktop Click) */}
              <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={cooldownRemaining > 0 || isVerifyingPin}
                    onClick={() => appendDigit(digit)}
                    className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-black text-base transition cursor-pointer disabled:opacity-40"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={cooldownRemaining > 0 || isVerifyingPin || unlockPin.length === 0}
                  onClick={() => setUnlockPin('')}
                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-800 dark:text-slate-400 text-[11px] font-bold transition cursor-pointer disabled:opacity-40"
                >
                  Xóa hết
                </button>
                <button
                  type="button"
                  disabled={cooldownRemaining > 0 || isVerifyingPin}
                  onClick={() => appendDigit('0')}
                  className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-black text-base transition cursor-pointer disabled:opacity-40"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={cooldownRemaining > 0 || isVerifyingPin || unlockPin.length === 0}
                  onClick={backspaceDigit}
                  aria-label="Xóa một số"
                  className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                {cooldownRemaining > 0 ? (
                  <span className="text-rose-600 font-bold">
                    Tạm khóa {cooldownRemaining}s do nhập sai nhiều lần
                  </span>
                ) : isVerifyingPin ? (
                  <span className="text-blue-600 font-bold inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang kiểm tra...
                  </span>
                ) : (
                  <span>Quên mã PIN? Liên hệ Quản trị Tổng để đặt lại.</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
