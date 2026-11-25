import React, { useState } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  Shield,
  User,
  Building2,
  MapPin,
  Users2,
  KeyRound,
  Mail,
  CheckCircle2,
  Send,
  Inbox,
  Sparkles,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Company, Area, Department, formatCompanyDisplayName } from '../types/edulms';
import { signInWithGoogle, signInWithEmail, sendResetPasswordEmail, describeAuthError } from '../firebase';
import { CustomSelect } from './CustomSelect';

import {
  hashPersonalPin,
  isValidPersonalPin,
  sanitizePinInput,
} from '../utils/pinSecurity';
import { cleanRawAreaCode, normalizeOrgCode } from '../utils/rbac';
import {
  INITIAL_DEPARTMENTS,
} from '../data/competitionStore';

export interface RegistrationData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  companyCode: string;
  areaCode: string;
  areaName?: string;
  isNewArea?: boolean;
  departmentCode: string;
  unitCode?: string;
  pin: string;
}

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'LOGIN' | 'REGISTER';
  onClose: () => void;
  companies: Company[];
  areas: Area[];
  departments: Department[];
  requireRegistrationApproval?: boolean;
  onRegister: (data: RegistrationData) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'LOGIN',
  onClose,
  companies,
  areas,
  departments,
  requireRegistrationApproval = true,
  onRegister,
}) => {
  const effectiveCompanies = companies;
  const effectiveAreas = areas;
  const effectiveDepartments = departments.length > 0 ? departments : INITIAL_DEPARTMENTS;

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASS'>(initialMode);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCompany, setRegCompany] = useState(effectiveCompanies[0]?.code || 'Th1');
  const [regArea, setRegArea] = useState(effectiveAreas[0]?.code || '1.1');
  const [isCreatingNewArea, setIsCreatingNewArea] = useState(false);
  const [regNewAreaCode, setRegNewAreaCode] = useState('');
  const [regNewAreaName, setRegNewAreaName] = useState('');
  const [regDept, setRegDept] = useState(effectiveDepartments[0]?.code || 'Thanh Niên Nam');
  const [regUnitCode, setRegUnitCode] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regPinConfirm, setRegPinConfirm] = useState('');

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setAuthError('');
    }
  }, [isOpen, initialMode]);

  const areasForRegCompany = React.useMemo(
    () =>
      effectiveAreas.filter(
        (a) =>
          normalizeOrgCode(a.companyCode) === normalizeOrgCode(regCompany) &&
          a.active !== false
      ),
    [effectiveAreas, regCompany]
  );

  React.useEffect(() => {
    if (effectiveCompanies.length > 0 && !effectiveCompanies.some((c) => c.code === regCompany)) {
      setRegCompany(effectiveCompanies[0].code);
    }
  }, [effectiveCompanies]);

  React.useEffect(() => {
    if (areasForRegCompany.length > 0) {
      if (!areasForRegCompany.some((a) => a.code === regArea)) {
        setRegArea(areasForRegCompany[0].code);
      }
    } else {
      setRegArea('');
    }
  }, [areasForRegCompany, regCompany]);

  React.useEffect(() => {
    if (
      effectiveDepartments.length > 0 &&
      !effectiveDepartments.some((d) => d.code === regDept)
    ) {
      setRegDept(effectiveDepartments[0].code);
    }
  }, [effectiveDepartments]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Đăng nhập Google (Firebase Auth). Hồ sơ được App tạo/đọc tự động sau khi đăng nhập.
  const handleGoogleSignInClick = async () => {
    try {
      setIsGoogleLoading(true);
      setAuthError('');
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      setAuthError(describeAuthError(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const email = loginIdentifier.trim();
    if (!email.includes('@')) {
      setAuthError('Vui lòng nhập địa chỉ email (hoặc dùng nút đăng nhập bằng Google).');
      return;
    }
    if (!loginPassword) {
      setAuthError('Vui lòng nhập mật khẩu.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signInWithEmail(email, loginPassword);
      setLoginPassword('');
      onClose();
    } catch (err: any) {
      setAuthError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!regFullName.trim()) {
      setAuthError('Vui lòng nhập họ và tên.');
      return;
    }
    if (!regUsername.trim()) {
      setAuthError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!regEmail.trim()) {
      setAuthError('Vui lòng nhập địa chỉ email.');
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }
    const creatingAreaMode = isCreatingNewArea || areasForRegCompany.length === 0;
    const rawAreaInput = creatingAreaMode ? regNewAreaCode : regArea;
    const cleanArea = cleanRawAreaCode(rawAreaInput);

    if (!regCompany.trim() || !cleanArea) {
      setAuthError(
        creatingAreaMode
          ? 'Vui lòng nhập mã Khu vực mới.'
          : 'Vui lòng chọn đầy đủ Sion / Công ty và Khu vực.'
      );
      return;
    }
    if (cleanArea.length > 30) {
      setAuthError('Mã Khu vực tối đa 30 ký tự.');
      return;
    }
    if (!isValidPersonalPin(regPin)) {
      setAuthError('Mã cá nhân (PIN) phải gồm đúng 6 chữ số.');
      return;
    }
    if (regPin !== regPinConfirm) {
      setAuthError('Mã cá nhân xác nhận chưa khớp.');
      return;
    }

    const matchedExistingArea = areasForRegCompany.find(
      (a) => normalizeOrgCode(cleanRawAreaCode(a.code)) === normalizeOrgCode(cleanArea)
    );
    const resolvedAreaCode = matchedExistingArea ? matchedExistingArea.code : cleanArea;
    const resolvedAreaName = matchedExistingArea
      ? matchedExistingArea.name
      : (regNewAreaName.trim().slice(0, 80) || `Khu vực ${cleanArea}`);

    try {
      setIsSubmitting(true);
      // Pre-validate hashing capability
      await hashPersonalPin('preview', regPin);
      await onRegister({
        fullName: regFullName.trim(),
        username: regUsername.trim().toLowerCase(),
        email: regEmail.trim(),
        password: regPassword,
        companyCode: regCompany,
        areaCode: resolvedAreaCode,
        areaName: resolvedAreaName,
        isNewArea: !matchedExistingArea,
        departmentCode: regDept,
        unitCode: regUnitCode.trim() || undefined,
        pin: regPin,
      });
      setRegPassword('');
      setRegPin('');
      setRegPinConfirm('');
      setIsCreatingNewArea(false);
      setRegNewAreaCode('');
      setRegNewAreaName('');
      onClose();
    } catch (err: any) {
      setAuthError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmail.trim();
    if (!email.includes('@')) {
      setForgotMessage('Vui lòng nhập địa chỉ email đã đăng ký.');
      return;
    }
    try {
      setIsSubmitting(true);
      await sendResetPasswordEmail(email);
      setForgotMessage(
        `Nếu ${email} đã đăng ký tài khoản, thư đặt lại mật khẩu sẽ được gửi tới hộp thư (kiểm tra cả mục Spam).`
      );
    } catch (err: any) {
      setForgotMessage(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 sm:p-7 relative cursor-default"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switch */}
        {(
          <div className="flex border-b border-slate-100 pb-3 mb-5">
            <button
              onClick={() => {
                setMode('LOGIN');
                setAuthError('');
              }}
              className={`flex items-center gap-2 pb-2 px-3 text-sm font-bold border-b-2 transition cursor-pointer ${
                mode === 'LOGIN'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập</span>
            </button>

            <button
              onClick={() => {
                setMode('REGISTER');
                setAuthError('');
              }}
              className={`flex items-center gap-2 pb-2 px-3 text-sm font-bold border-b-2 transition cursor-pointer ${
                mode === 'REGISTER'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Đăng ký</span>
            </button>
          </div>
        )}

        {/* Error notification */}
        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {authError}
          </div>
        )}

        {/* OFFICIAL FIREBASE GOOGLE SIGN-IN BUTTON (Appears in both Login & Register) */}
        {mode !== 'FORGOT_PASS' && (
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={isGoogleLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-2xl border border-slate-300 shadow-sm transition flex items-center justify-center gap-2.5 cursor-pointer hover:border-slate-400"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Đăng nhập với Google</span>
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-[11px] text-slate-400 font-semibold uppercase">Hoặc</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
          </div>
        )}

        {/* VIEW 2: LOGIN FORM */}
        {mode === 'LOGIN' && (
          <div>
            <div className="mb-4">
              <h3 className="text-base font-black text-slate-900">Đăng nhập tài khoản</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập email và mật khẩu của bạn để tiếp tục.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="tenban@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('FORGOT_PASS');
                      setForgotMessage('');
                    }}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Đăng nhập</span>
              </button>
            </form>

            {/* Production Security Assurance */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Hệ thống bảo mật Firebase Authentication. Tài khoản Ban Quản Trị chỉ kích hoạt cho email được phân quyền chính thức.</span>
            </div>
          </div>
        )}

        {/* VIEW 3: REGISTER FORM */}
        {mode === 'REGISTER' && (
          <div>
            <div className="mb-4">
              <h3 className="text-base font-black text-slate-900">Đăng ký tài khoản thi đua</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tạo tài khoản bằng email. Hệ thống sẽ gửi thư xác thực tới email của bạn.
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên của bạn *
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Ví dụ: Lê Hoàng Minh"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên đăng nhập *
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="leminh"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu *
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* Gmail Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Địa chỉ email *</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Có thư xác thực</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="tenban@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>

              {/* Units Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sion / Công ty trực thuộc *
                  </label>
                  <CustomSelect
                    value={regCompany}
                    onChange={(val) => {
                      setRegCompany(val);
                      setIsCreatingNewArea(false);
                    }}
                    size="sm"
                    leadingIcon={<Building2 className="w-3.5 h-3.5" />}
                    options={effectiveCompanies.map((c) => ({
                      value: c.code,
                      label: formatCompanyDisplayName(c.name, c.code),
                      badge: c.code,
                    }))}
                    ariaLabel="Chọn Sion / Công ty"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Khu vực *
                    </label>
                    {areasForRegCompany.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewArea((prev) => !prev);
                          setAuthError('');
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {isCreatingNewArea ? 'Chọn có sẵn' : '+ Tạo mới'}
                      </button>
                    )}
                  </div>
                  {!isCreatingNewArea && areasForRegCompany.length > 0 ? (
                    <CustomSelect
                      value={regArea}
                      onChange={(val) => {
                        if (val === '__CREATE_NEW_AREA__') {
                          setIsCreatingNewArea(true);
                          setRegNewAreaCode('');
                          setRegNewAreaName('');
                        } else {
                          setRegArea(val);
                        }
                      }}
                      size="sm"
                      leadingIcon={<MapPin className="w-3.5 h-3.5" />}
                      options={[
                        ...areasForRegCompany.map((a) => ({
                          value: a.code,
                          label: a.name || `Khu vực ${a.code}`,
                          badge: a.code,
                        })),
                        {
                          value: '__CREATE_NEW_AREA__',
                          label: '+ Tạo khu vực mới...',
                          description: 'Nhập mã/tên nếu chưa có trong danh sách',
                        },
                      ]}
                      ariaLabel="Chọn Khu vực"
                    />
                  ) : (
                    <input
                      type="text"
                      maxLength={30}
                      value={regNewAreaCode}
                      onChange={(e) => setRegNewAreaCode(e.target.value)}
                      placeholder="Nhập mã KV mới (VD: 1.5)"
                      className="w-full px-3 py-2 bg-slate-50 border border-blue-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  )}
                </div>
              </div>

              {(isCreatingNewArea || areasForRegCompany.length === 0) && (
                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-blue-900">
                      Tên hiển thị Khu vực mới (tuỳ chọn)
                    </label>
                    <span className="text-[10px] text-blue-700 font-semibold">
                      Sion {regCompany}
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={80}
                    value={regNewAreaName}
                    onChange={(e) => setRegNewAreaName(e.target.value)}
                    placeholder={`VD: Khu vực ${cleanRawAreaCode(regNewAreaCode) || '1.5'} (để trống sẽ tự đặt)`}
                    className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                  {cleanRawAreaCode(regNewAreaCode) &&
                    areasForRegCompany.some(
                      (a) =>
                        normalizeOrgCode(cleanRawAreaCode(a.code)) ===
                        normalizeOrgCode(cleanRawAreaCode(regNewAreaCode))
                    ) && (
                      <p className="text-[10px] text-amber-700 font-semibold">
                        Mã khu vực này đã tồn tại trong Sion {regCompany} — hệ thống sẽ tự chọn khu vực sẵn có.
                      </p>
                    )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đội / Uni
                  </label>
                  <input
                    type="text"
                    value={regUnitCode}
                    onChange={(e) => setRegUnitCode(e.target.value)}
                    placeholder="Uni 1, Đội A..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ban ngành *
                  </label>
                  <CustomSelect
                    value={regDept}
                    onChange={setRegDept}
                    size="sm"
                    searchable={false}
                    leadingIcon={<Users2 className="w-3.5 h-3.5" />}
                    options={effectiveDepartments.map((d) => ({
                      value: d.code,
                      label: d.name,
                    }))}
                    ariaLabel="Chọn Ban ngành"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                <div className="text-[11px] font-extrabold text-amber-900 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Mã cá nhân 6 số (PIN) bảo vệ tài khoản</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Mã PIN (6 chữ số) *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={regPin}
                      onChange={(e) => setRegPin(sanitizePinInput(e.target.value))}
                      placeholder="••••••"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-center tracking-[0.35em] text-xs font-black text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Xác nhận 6 số *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={regPinConfirm}
                      onChange={(e) => setRegPinConfirm(sanitizePinInput(e.target.value))}
                      placeholder="••••••"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-center tracking-[0.35em] text-xs font-black text-slate-900"
                      required
                    />
                  </div>
                </div>
              </div>

              {requireRegistrationApproval && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/80 text-[11px] text-blue-900 leading-relaxed">
                  <strong>Lưu ý phê duyệt:</strong> Sau khi đăng ký, tài khoản mới sẽ chờ Admin phê duyệt (hoặc tự động vào ngay nếu email đã được cấp quyền trước).
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 mt-3 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>Đăng ký tài khoản</span>
              </button>
            </form>
          </div>
        )}

        {/* VIEW 4: FORGOT PASSWORD */}
        {mode === 'FORGOT_PASS' && (
          <div>
            <div className="mb-4">
              <h3 className="text-base font-black text-slate-900">Quên mật khẩu?</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập email đã đăng ký để nhận thư đặt lại mật khẩu.
              </p>
            </div>

            {forgotMessage && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleForgotPassSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="tenban@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Gửi thư đặt lại mật khẩu
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
