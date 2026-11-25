import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Power, MapPinned, X, Check } from 'lucide-react';
import type { Area, Company, Member, Region } from '../types/edulms';

interface AdminRegionsTabProps {
  regions: Region[];
  companies: Company[]; // đã lọc theo phạm vi người dùng
  areas: Area[]; // đã lọc theo phạm vi người dùng
  members: Member[];
  isAdmin: boolean;
  canManageCompany: (companyCode: string) => boolean;
  onAddRegion: (region: Omit<Region, 'id'>) => void;
  onUpdateRegion: (region: Region) => void;
  onDeleteRegion: (id: string) => void;
  onShowNotification: (msg: string) => void;
  requestConfirm: (target: { title: string; onConfirm: () => void }) => void;
}

const norm = (v?: string | null) => (v || '').trim().toLowerCase();

export function AdminRegionsTab({
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
}: AdminRegionsTabProps) {
  const [filterCompany, setFilterCompany] = useState<string>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Region | null>(null);

  const manageableCompanies = useMemo(
    () => companies.filter((c) => canManageCompany(c.code)),
    [companies, canManageCompany]
  );
  const canCreate = manageableCompanies.length > 0;

  const visibleCompanyCodes = useMemo(
    () => new Set(companies.map((c) => norm(c.code))),
    [companies]
  );

  const visibleRegions = useMemo(
    () =>
      regions
        .filter((r) => visibleCompanyCodes.has(norm(r.companyCode)))
        .filter((r) => filterCompany === 'ALL' || norm(r.companyCode) === norm(filterCompany))
        .sort(
          (a, b) =>
            a.companyCode.localeCompare(b.companyCode) || a.code.localeCompare(b.code)
        ),
    [regions, visibleCompanyCodes, filterCompany]
  );

  // Khu vực đã thuộc một địa vực khác (theo từng Sion)
  const areaOwnerRegion = (companyCode: string, areaCode: string, exceptId?: string) =>
    regions.find(
      (r) =>
        r.id !== exceptId &&
        norm(r.companyCode) === norm(companyCode) &&
        (r.areaCodes || []).some((a) => norm(a) === norm(areaCode))
    );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const company = newCompany || manageableCompanies[0]?.code || '';
    const code = newCode.trim();
    if (!company || !code) {
      onShowNotification('Vui lòng chọn Sion và nhập mã Địa vực.');
      return;
    }
    if (!canManageCompany(company)) {
      onShowNotification('Bạn không có quyền thêm Địa vực cho Sion này.');
      return;
    }
    const dup = regions.find(
      (r) => norm(r.companyCode) === norm(company) && norm(r.code) === norm(code)
    );
    if (dup) {
      onShowNotification(`Địa vực "${code}" đã tồn tại trong Sion ${company}.`);
      return;
    }
    onAddRegion({
      code,
      name: newName.trim() || code,
      companyCode: company,
      areaCodes: [],
      active: true,
    });
    setNewCode('');
    setNewName('');
    setIsAdding(false);
    onShowNotification(`Đã thêm Địa vực ${code} cho Sion ${company}.`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!canManageCompany(editing.companyCode)) {
      onShowNotification('Bạn không có quyền sửa Địa vực này.');
      return;
    }
    onUpdateRegion({
      ...editing,
      code: editing.code.trim() || editing.code,
      name: editing.name.trim() || editing.code,
    });
    setEditing(null);
    onShowNotification('Đã cập nhật Địa vực.');
  };

  const toggleActive = (r: Region) => {
    onUpdateRegion({ ...r, active: !r.active });
    onShowNotification(
      r.active ? `Đã ngừng hoạt động Địa vực ${r.name}.` : `Đã kích hoạt lại Địa vực ${r.name}.`
    );
  };

  const tryDelete = (r: Region) => {
    const memberCount = members.filter(
      (m) =>
        norm(m.companyCode) === norm(r.companyCode) &&
        (r.areaCodes || []).some((a) => norm(a) === norm(m.areaCode))
    ).length;
    if (!isAdmin) {
      if (r.active) {
        onShowNotification('Hãy "Ngừng hoạt động" Địa vực trước khi xóa.');
        return;
      }
      if ((r.areaCodes || []).length > 0 || memberCount > 0) {
        onShowNotification(
          'Địa vực còn Khu vực hoặc thành viên. Hãy chuyển Khu vực sang Địa vực khác trước khi xóa.'
        );
        return;
      }
    }
    requestConfirm({
      title:
        memberCount > 0 || (r.areaCodes || []).length > 0
          ? `Xóa Địa vực ${r.name}? Đang có ${(r.areaCodes || []).length} Khu vực / ${memberCount} thành viên liên quan (Khu vực và thành viên không bị xóa).`
          : `Xóa Địa vực ${r.name}?`,
      onConfirm: () => {
        onDeleteRegion(r.id);
        onShowNotification(`Đã xóa Địa vực ${r.name}.`);
      },
    });
  };

  const editingAreas = editing
    ? areas.filter((a) => norm(a.companyCode) === norm(editing.companyCode))
    : [];

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white">
            Địa vực theo từng Sion
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Sion → Địa vực → Khu vực → Thành viên. Mỗi Địa vực gom nhiều Khu vực (mỗi Khu vực chỉ thuộc một Địa vực).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <option value="ALL">Tất cả Sion</option>
            {companies.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setNewCompany(manageableCompanies[0]?.code || '');
                setIsAdding(true);
              }}
              className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Địa vực</span>
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="mb-4 p-4 rounded-2xl border border-blue-200 bg-blue-50/60 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <label className="text-[11px] font-bold text-slate-600">
            Sion
            <select
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
            >
              {manageableCompanies.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold text-slate-600">
            Mã Địa vực
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              maxLength={40}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              placeholder="VD: DV1"
            />
          </label>
          <label className="text-[11px] font-bold text-slate-600">
            Tên hiển thị
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              placeholder="VD: Địa vực 1"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Lưu
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {editing && (
        <form
          onSubmit={handleSaveEdit}
          className="mb-4 p-4 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800">
              Sửa Địa vực {editing.code} · Sion {editing.companyCode}
            </h4>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-bold text-slate-600">
              Mã Địa vực
              <input
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                maxLength={40}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              Tên hiển thị
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                maxLength={80}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              />
            </label>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1.5">
              Khu vực thuộc Địa vực này
            </p>
            {editingAreas.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                Sion này chưa có Khu vực nào (thêm ở mục "Khu vực").
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {editingAreas.map((a) => {
                  const owner = areaOwnerRegion(a.companyCode, a.code, editing.id);
                  const checked = (editing.areaCodes || []).some((x) => norm(x) === norm(a.code));
                  return (
                    <label
                      key={a.id}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${
                        owner
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : checked
                          ? 'bg-blue-100 border-blue-300 text-blue-800 cursor-pointer'
                          : 'bg-white border-slate-200 text-slate-700 cursor-pointer'
                      }`}
                      title={owner ? `Đã thuộc Địa vực ${owner.code}` : undefined}
                    >
                      <input
                        type="checkbox"
                        disabled={!!owner}
                        checked={checked}
                        onChange={(e) => {
                          const list = editing.areaCodes || [];
                          setEditing({
                            ...editing,
                            areaCodes: e.target.checked
                              ? [...list, a.code]
                              : list.filter((x) => norm(x) !== norm(a.code)),
                          });
                        }}
                      />
                      KV {a.code}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Lưu thay đổi
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Mã</th>
              <th className="py-2.5 px-4">Tên Địa vực</th>
              <th className="py-2.5 px-4">Sion</th>
              <th className="py-2.5 px-4">Khu vực</th>
              <th className="py-2.5 px-4">Trạng thái</th>
              <th className="py-2.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRegions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                  <MapPinned className="w-5 h-5 mx-auto mb-1 opacity-60" />
                  Chưa có Địa vực nào trong phạm vi của bạn.
                </td>
              </tr>
            )}
            {visibleRegions.map((r) => {
              const manageable = canManageCompany(r.companyCode);
              return (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-black text-blue-700">{r.code}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{r.name}</td>
                  <td className="py-3 px-4 text-slate-600">{r.companyCode}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {(r.areaCodes || []).length > 0
                      ? (r.areaCodes || []).map((a) => `KV ${a}`).join(', ')
                      : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {r.active ? 'Đang hoạt động' : 'Đã ngừng'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {manageable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing({ ...r, areaCodes: [...(r.areaCodes || [])] })}
                          className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-blue-50 mr-1 transition cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(r)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 mr-1 transition cursor-pointer"
                          title={r.active ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => tryDelete(r)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa Địa vực"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Chỉ xem</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
