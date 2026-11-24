import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpenCheck,
  Plus,
  Search,
  RotateCcw,
  Save,
  Trash2,
  Pencil,
  Check,
  X,
  Sparkles,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import {
  DEFAULT_ENCODING_RULES,
  DEFAULT_VOCABULARY_CONFIG,
  EncodingWordRule,
  SystemVocabularyConfig,
  encodeSensitiveText,
  findSensitiveMatches,
  normalizeEncodingRules,
} from '../utils/wordEncoder';

interface AdminVocabularyTabProps {
  vocabularyConfig: SystemVocabularyConfig;
  onSaveVocabularyConfig: (config: SystemVocabularyConfig) => Promise<void>;
  onShowNotification: (msg: string) => void;
}

export const AdminVocabularyTab: React.FC<AdminVocabularyTabProps> = ({
  vocabularyConfig,
  onSaveVocabularyConfig,
  onShowNotification,
}) => {
  const [enabled, setEnabled] = useState<boolean>(vocabularyConfig.enabled !== false);
  const [rules, setRules] = useState<EncodingWordRule[]>(() =>
    normalizeEncodingRules(vocabularyConfig.rules)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newCode, setNewCode] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState('');
  const [editCode, setEditCode] = useState('');
  const [sandboxText, setSandboxText] = useState(
    'Hôm nay cảm tạ Đức Chúa Trời đã dẫn dắt Hội Thánh đi Truyền giáo, Kết nối và Cầu nguyện rất phước hạnh.'
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEnabled(vocabularyConfig.enabled !== false);
    setRules(normalizeEncodingRules(vocabularyConfig.rules));
  }, [vocabularyConfig]);

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) => r.source.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
    );
  }, [rules, searchQuery]);

  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);
  const sandboxMatches = useMemo(() => findSensitiveMatches(sandboxText, rules), [sandboxText, rules]);
  const sandboxEncoded = useMemo(
    () => encodeSensitiveText(sandboxText, rules, enabled),
    [sandboxText, rules, enabled]
  );

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const s = newSource.trim();
    const c = newCode.trim();
    if (!s || !c) {
      onShowNotification('Vui lòng nhập đầy đủ cụm từ gốc và chữ viết tắt.');
      return;
    }
    const exists = rules.some((r) => r.source.toLowerCase() === s.toLowerCase());
    if (exists) {
      onShowNotification(`Cụm từ "${s}" đã tồn tại trong từ điển.`);
      return;
    }
    const nextRule: EncodingWordRule = {
      id: `rule_${Date.now()}`,
      source: s,
      code: c,
      enabled: true,
    };
    setRules((prev) => [nextRule, ...prev]);
    setNewSource('');
    setNewCode('');
    onShowNotification(`Đã thêm "${s} → ${c}" vào bản nháp (bấm Lưu để đồng bộ).`);
  };

  const handleToggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleStartEdit = (rule: EncodingWordRule) => {
    setEditingRuleId(rule.id);
    setEditSource(rule.source);
    setEditCode(rule.code);
  };

  const handleConfirmEdit = (id: string) => {
    const s = editSource.trim();
    const c = editCode.trim();
    if (!s || !c) {
      onShowNotification('Cụm từ gốc và ký hiệu mã hóa không được để trống.');
      return;
    }
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, source: s, code: c } : r)));
    setEditingRuleId(null);
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRestoreDefaults = () => {
    setEnabled(true);
    setRules(DEFAULT_ENCODING_RULES.map((r) => ({ ...r })));
    onShowNotification('Đã khôi phục bộ từ điển mẫu (bấm Lưu thay đổi để áp dụng toàn hệ thống).');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveVocabularyConfig({
        ...DEFAULT_VOCABULARY_CONFIG,
        enabled,
        rules: normalizeEncodingRules(rules),
      });
      onShowNotification('Đã lưu Từ điển mã hóa ngôn từ thành công!');
    } catch (err: any) {
      onShowNotification(`Không thể lưu từ điển: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-indigo-950 dark:text-white">
              Từ Điển Viết Tắt &amp; Mã Hóa Ngôn Từ
            </h3>
            <p className="text-xs text-indigo-900/75 dark:text-indigo-200/80 mt-0.5 leading-relaxed">
              Tự động chuyển đổi các cụm từ nhạy cảm sang ký hiệu viết tắt khi thành viên đăng{' '}
              <strong>Nhật ký cảm tạ</strong> (24h) và <strong>Nhật ký turbo</strong> (cá nhân).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer flex items-center gap-1.5 ${
              enabled
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{enabled ? 'Đang bật tự động mã hóa' : 'Đang tạm tắt'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu từ điển'}</span>
          </button>
        </div>
      </div>

      {/* Add Rule Form + Restore Defaults */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <form
          onSubmit={handleAddRule}
          className="lg:col-span-7 p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Thêm cặp từ viết tắt mới</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {activeCount}/{rules.length} từ đang áp dụng
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Cụm từ gốc cần mã hóa
              </label>
              <input
                type="text"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="Ví dụ: Hội Thánh, Tin Lành..."
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Viết tắt thành
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="HT, TL..."
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                className="w-full h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm từ</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhanh trong từ điển..."
                className="w-full h-8 pl-8 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="h-8 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục bộ mẫu</span>
            </button>
          </div>
        </form>

        {/* Live Preview Sandbox */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Xem trước mã hóa tức thì</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
              {sandboxMatches.length} cụm phát hiện
            </span>
          </div>

          <textarea
            rows={2}
            value={sandboxText}
            onChange={(e) => setSandboxText(e.target.value)}
            placeholder="Nhập thử câu văn để xem kết quả sau khi mã hóa..."
            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />

          <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-amber-200/70 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Kết quả hiển thị sau mã hóa:</span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {sandboxEncoded}
            </p>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="overflow-x-auto border border-slate-200/90 dark:border-slate-800 rounded-2xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-4 w-12">STT</th>
              <th className="py-2.5 px-4">Cụm từ nhạy cảm gốc</th>
              <th className="py-2.5 px-4">Chữ viết tắt / Mã hóa</th>
              <th className="py-2.5 px-4 text-center">Trạng thái</th>
              <th className="py-2.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredRules.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                  Không tìm thấy quy tắc phù hợp trong từ điển.
                </td>
              </tr>
            ) : (
              filteredRules.map((rule, idx) => {
                const isEditing = editingRuleId === rule.id;
                return (
                  <tr
                    key={rule.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                      !rule.enabled ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-400 tabular-nums">{idx + 1}</td>
                    <td className="py-2.5 px-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editSource}
                          onChange={(e) => setEditSource(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-400 text-xs font-bold text-slate-800 dark:text-white"
                        />
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {rule.source}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          className="w-32 h-8 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-400 text-xs font-extrabold text-indigo-700 dark:text-indigo-300"
                        />
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-extrabold">
                          {rule.code}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold cursor-pointer transition ${
                          rule.enabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {rule.enabled ? 'Đang bật' : 'Tạm tắt'}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleConfirmEdit(rule.id)}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            title="Xác nhận"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRuleId(null)}
                            className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                            title="Hủy"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(rule)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                            title="Sửa cặp từ"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Xóa cặp từ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
