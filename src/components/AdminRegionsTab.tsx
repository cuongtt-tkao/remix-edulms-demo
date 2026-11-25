import React, { useMemo, useState } from 'react';
import {
  MapPinned,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Power,
  Layers,
} from 'lucide-react';
import { Area, Company, Member, Region } from '../types/edulms';
import { normalizeOrgCode } from '../utils/rbac';
import { CustomSelect } from './CustomSelect';

interface AdminRegionsTabProps {
  regions: Region[];
  companies: Company[];
  areas: Area[];
  members: Member[];
  isAdmin: boolean;
  canManageCompany: (code: string) => boolean;
  onAddRegion: (region: Omit<Region, 'id'>) => void;
  onUpdateRegion: (region: Region) => void;
  onDeleteRegion: (id: string) => Promise<boolean> | void;
  onShowNotification: (msg: string) => void;
  requestConfirm: (target: { title: string; onConfirm: () => Promise<void> | void } | null) => void;
}

export const AdminRegionsTab: React.FC<AdminRegionsTabProps> = ({
  regions,
  companies,
  areas,
  members,
  isAdmin,
  canManageCompany,
  onAddRegion,
  onUpdateRegion,
  onDeleteRegion,
  onShowNotification,
  requestConfirm,
}) => {
  const [filterCompany, setFilterCompany] = useState<string>('ALL');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCompanyCode, setNewCompanyCode] = useState<string>(companies[0]?.code || '');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newAreaCodes, setNewAreaCodes] = useState<string[]>([]);

  const [editingRegion, setEditingRegion] = useState<Region | null>(null);

  const manageableCompanies = useMemo(
    () => companies.filter((c) => canManageCompany(c.code)),
    [companies, canManageCompany]
  );

  const canCreateAny = manageableCompanies.length > 0;

  const filteredRegions = useMemo(() => {
    const allowedCompanySet = new Set(companies.map((c) => normalizeOrgCode(c.code)));
    return regions.filter((r) => {
      const compNorm = normalizeOrgCode(r.companyCode);
      if (!allowedCompanySet.has(compNorm)) return false;
      if (filterCompany !== 'ALL' && compNorm !== normalizeOrgCode(filterCompany)) return false;
      return true;
    });
  }, [regions, companies, filterCompany]);

  const areasForCompany = (compCode: string) =>
    areas.filter((a) => normalizeOrgCode(a.companyCode) === normalizeOrgCode(compCode));

  const toggleCodeInList = (list: string[], code: string): string[] => {
    const norm = normalizeOrgCode(code);
    const exists = list.some((x) => normalizeOrgCode(x) === norm);
    return exists ? list.filter((x) => normalizeOrgCode(x) !== norm) : [...list, code];
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const targetComp = newCompanyCode || manageableCompanies[0]?.code || '';
    const cleanCode = newCode.trim().slice(0, 40);
    const cleanName = (newName.trim() || cleanCode).slice(0, 80);
    if (!targetComp) {
      onShowNotification('Vui lòng chọn Sion cho Địa vực.');
      return;
    }
    if (!canManageCompany(targetComp)) {
      onShowNotification('Bạn không có quyền thêm Địa vực cho Sion này.');
      return;
    }
    if (!cleanCode) {
      onShowNotification('Vui lòng nhập mã Địa vực.');
      return;
    }
    const duplicate = regions.some(
      (r) =>
        normalizeOrgCode(r.companyCode) === normalizeOrgCode(targetComp) &&
        normalizeOrgCode(r.code) === normalizeOrgCode(cleanCode)
    );
    if (duplicate) {
      onShowNotification(`Địa vực "${cleanCode}" đã tồn tại trong Sion ${targetComp}.`);
      return;
    }

    onAddRegion({
      code: cleanCode,
      name: cleanName,
      companyCode: targetComp,
      areaCodes: newAreaCodes,
      active: true,
    });
    setNewCode('');
    setNewName('');
    setNewAreaCodes([]);
    setIsAddOpen(false);
    onShowNotification(`Đã thêm Địa vực "${cleanName}" (${targetComp}).`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegion) return;
    const cleanCode = editingRegion.code.trim().slice(0, 40);
    const cleanName = (editingRegion.name.trim() || cleanCode).slice(0, 80);
    if (!cleanCode) {
      onShowNotification('Mã Địa vực không được để trống.');
      return;
    }
    onUpdateRegion({
      ...editingRegion,
      code: cleanCode,
      name: cleanName,
    });
    setEditingRegion(null);
    onShowNotification(`Đã cập nhật Địa vực "${cleanName}".`);
  };

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
            <MapPinned className="w-4 h-4 text-blue-600" />
            <span>Quản lý Địa vực theo Sion</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Cấp trung gian giữa Sion và Khu vực (Sion → Địa vực → Khu vực). Phân quyền dữ liệu vẫn giữ theo Khu vực.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <CustomSelect
              size="sm"
              searchable={false}
              value={filterCompany}
              onChange={setFilterCompany}
              options={[
                { value: 'ALL', label: 'Tất cả Sion' },
                ...companies.map((c) => ({
                  value: c.code,
                  label: `${c.code} · ${c.name}`,
                })),
              ]}
            />
          </div>
          {canCreateAny && (
            <button
              type="button"
              onClick={() => {
                const defaultComp =
                  filterCompany !== 'ALL' && canManageCompany(filterCompany)
                    ? filterCompany
                    : manageableCompanies[0]?.code || '';
                setNewCompanyCode(defaultComp);
                setNewAreaCodes([]);
                setIsAddOpen((prev) => !prev);
              }}
              className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Địa vực</span>
            </button>
          )}
        </div>
      </div>

      {isAddOpen && canCreateAny && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 rounded-2xl bg-blue-50/50 dark:bg-slate-800/60 border border-blue-200 dark:border-slate-700 space-y-3"
        >
          <div className="font-bold text-xs text-blue-950 dark:text-blue-200">
            Thêm Địa vực mới
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Thuộc Sion
              </label>
              <CustomSelect
                size="sm"
                value={newCompanyCode}
                onChange={(val) => {
                  setNewCompanyCode(val);
                  setNewAreaCodes([]);
                }}
                options={manageableCompanies.map((c) => ({
                  value: c.code,
                  label: c.name,
                  badge: c.code,
                }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Mã Địa vực
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="VD: DV1, Bắc, ..."
                maxLength={40}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Địa vực 1"
                maxLength={80}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Chọn các Khu vực thuộc Địa vực này ({newAreaCodes.length} đã chọn)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {areasForCompany(newCompanyCode).length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">
                  Sion này chưa có Khu vực nào.
                </span>
              ) : (
                areasForCompany(newCompanyCode).map((a) => {
                  const selected = newAreaCodes.some(
                    (c) => normalizeOrgCode(c) === normalizeOrgCode(a.code)
                  );
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setNewAreaCodes((prev) => toggleCodeInList(prev, a.code))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      <span>{a.name || a.code}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Lưu Địa vực
            </button>
          </div>
        </form>
      )}

      {editingRegion && (
        <form
          onSubmit={handleSaveEdit}
          className="mb-6 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-xs text-amber-950 dark:text-amber-200">
              Chỉnh sửa Địa vực: {editingRegion.name} ({editingRegion.companyCode})
            </div>
            <button
              type="button"
              onClick={() => setEditingRegion(null)}
              className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Mã Địa vực
              </label>
              <input
                type="text"
                value={editingRegion.code}
                onChange={(e) =>
                  setEditingRegion((prev) => (prev ? { ...prev, code: e.target.value } : null))
                }
                maxLength={40}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={editingRegion.name}
                onChange={(e) =>
                  setEditingRegion((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                maxLength={80}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Khu vực trực thuộc ({(editingRegion.areaCodes || []).length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {areasForCompany(editingRegion.companyCode).map((a) => {
                const selected = (editingRegion.areaCodes || []).some(
                  (c) => normalizeOrgCode(c) === normalizeOrgCode(a.code)
                );
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      setEditingRegion((prev) =>
                        prev
                          ? {
                              ...prev,
                              areaCodes: toggleCodeInList(prev.areaCodes || [], a.code),
                            }
                          : null
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    <span>{a.name || a.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingRegion(null)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Cập nhật
            </button>
          </div>
        </form>
      )}

      {filteredRegions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
          <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Chưa có Địa vực nào
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Bấm "Thêm Địa vực" để nhóm các Khu vực trong cùng Sion.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredRegions.map((reg) => {
            const editable = canManageCompany(reg.companyCode);
            const areaSet = new Set((reg.areaCodes || []).map((c) => normalizeOrgCode(c)));
            const memberCount = members.filter(
              (m) =>
                normalizeOrgCode(m.companyCode) === normalizeOrgCode(reg.companyCode) &&
                areaSet.has(normalizeOrgCode(m.areaCode))
            ).length;
            const canDelete = isAdmin || reg.active === false;

            return (
              <div
                key={reg.id}
                className={`rounded-2xl border p-4 transition ${
                  reg.active !== false
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800/70 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-black">
                        {reg.companyCode}
                      </span>
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {reg.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">({reg.code})</span>
                      {reg.active === false && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                          Tạm dừng
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {(reg.areaCodes || []).length} Khu vực · {memberCount} thành viên
                    </div>
                  </div>

                  {editable && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingRegion(reg)}
                        title="Chỉnh sửa"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRegion({
                            ...reg,
                            active: reg.active === false,
                          })
                        }
                        title={reg.active === false ? 'Kích hoạt lại' : 'Tạm dừng'}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() =>
                            requestConfirm({
                              title: `Xóa Địa vực "${reg.name}" (${reg.companyCode})?`,
                              onConfirm: async () => {
                                const ok = await onDeleteRegion(reg.id);
                                if (ok !== false) {
                                  onShowNotification(`Đã xóa Địa vực "${reg.name}".`);
                                }
                              },
                            })
                          }
                          title="Xóa Địa vực"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {(reg.areaCodes || []).length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">Chưa gán Khu vực</span>
                  ) : (
                    (reg.areaCodes || []).map((aCode) => (
                      <span
                        key={aCode}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                      >
                        KV {aCode}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
