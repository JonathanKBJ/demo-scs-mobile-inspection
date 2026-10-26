import React from 'react';
import { useContractStore } from '../../store/useContractStore';
import {
  FileText,
  ShieldAlert,
  PackageCheck,
  CheckCircle,
  Search,
  ArrowRight,
  Plus,
  Clock,
} from 'lucide-react';
import { status, checklist } from '../../domain/rules';
import { money } from '../../domain/calculations';
export const TasksDashboard: React.FC = () => {
  const {
    drafts,
    filter,
    setFilter,
    search,
    setSearch,
    selectDraft,
    createDraft,
  } = useContractStore();

  const draftCount = drafts.filter((d) => status(d).key === 'draft').length;
  const reviewCount = drafts.filter((d) => ['pending', 'pending2'].includes(status(d).key)).length;
  const sellCount = drafts.filter((d) => ['ready', 'submitted', 'sold'].includes(status(d).key)).length;
  const finishCount = drafts.filter((d) => status(d).key === 'opened').length;

  // Filter list
  const filterTabs: Array<{ id: string; label: string; countVal: number }> = [
    { id: 'all', label: 'ทั้งหมด', countVal: drafts.length },
    { id: 'pending_all', label: 'รออนุมัติทั้งหมด', countVal: reviewCount },
    { id: 'sell_all', label: 'รอทำขายทั้งหมด', countVal: sellCount },
    { id: 'draft', label: 'ต้องทำต่อ', countVal: draftCount },
    { id: 'pending', label: 'ตรวจระดับ 1', countVal: drafts.filter((d) => status(d).key === 'pending').length },
    { id: 'pending2', label: 'ตรวจระดับ 2', countVal: drafts.filter((d) => status(d).key === 'pending2').length },
    { id: 'ready', label: 'พร้อมทำขาย', countVal: drafts.filter((d) => status(d).key === 'ready').length },
    { id: 'submitted', label: 'รอผลขาย', countVal: drafts.filter((d) => status(d).key === 'submitted').length },
    { id: 'opened', label: 'เปิดสัญญาแล้ว', countVal: finishCount },
    { id: 'cancelled', label: 'ยกเลิกร่าง', countVal: drafts.filter((d) => status(d).key === 'cancelled').length },
  ];

  // Matching drafts
  const matchingDrafts = drafts.filter((d) => {
    const s = status(d);
    // Filter match
    let matchFilter = true;
    if (filter === 'pending_all') matchFilter = ['pending', 'pending2'].includes(s.key);
    else if (filter === 'sell_all') matchFilter = ['ready', 'submitted', 'sold'].includes(s.key);
    else if (filter !== 'all') matchFilter = s.key === filter;

    // Search match
    let matchSearch = true;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const name = `${d.buyer.first} ${d.buyer.last}`.toLowerCase();
      const id = d.id.toLowerCase();
      const ref = (d.saleRef || '').toLowerCase();
      const prod = (d.terms.product || '').toLowerCase();
      matchSearch = name.includes(q) || id.includes(q) || ref.includes(q) || prod.includes(q);
    }
    return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-6 pb-28 md:pb-12">
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="eyebrow block mb-1">CONTRACT WORKSPACE</span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            งานของฉัน
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            ติดตามร่าง ผลอนุมัติ และสัญญาเช่าซื้อออนไลน์
          </p>
        </div>
        <button
          type="button"
          onClick={createDraft}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-sm transition active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>เริ่มรายการใหม่</span>
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div className="stats-grid">
        <div
          onClick={() => setFilter('draft')}
          className={`stat-card cursor-pointer transition ${
            filter === 'draft' ? 'ring-2 ring-amber-500 bg-amber-50/20' : ''
          }`}
        >
          <div className="stat-head">
            <span className="stat-label">ต้องทำต่อ</span>
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <div className="stat-number">{draftCount}</div>
          <span className="stat-sub">เติมข้อมูลร่างสัญญา</span>
        </div>

        <div
          onClick={() => setFilter('pending_all')}
          className={`stat-card cursor-pointer transition ${
            filter === 'pending_all' ? 'ring-2 ring-amber-500 bg-amber-50/20' : ''
          }`}
        >
          <div className="stat-head">
            <span className="stat-label">รออนุมัติ</span>
            <ShieldAlert className="w-5 h-5 text-slate-400" />
          </div>
          <div className="stat-number">{reviewCount}</div>
          <span className="stat-sub">ตรวจระดับ 1 / 2</span>
        </div>

        <div
          onClick={() => setFilter('sell_all')}
          className={`stat-card cursor-pointer transition ${
            filter === 'sell_all' ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''
          }`}
        >
          <div className="stat-head">
            <span className="stat-label">รอทำขาย</span>
            <PackageCheck className="w-5 h-5 text-slate-400" />
          </div>
          <div className="stat-number">{sellCount}</div>
          <span className="stat-sub">พร้อมขาย / ส่งขาย</span>
        </div>

        <div
          onClick={() => setFilter('opened')}
          className={`stat-card cursor-pointer transition ${
            filter === 'opened' ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''
          }`}
        >
          <div className="stat-head">
            <span className="stat-label">เปิดสัญญาแล้ว</span>
            <CheckCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div className="stat-number">{finishCount}</div>
          <span className="stat-sub">สัญญาเสร็จสมบูรณ์</span>
        </div>
      </div>
      {/* Search Input */}
      <div className="relative searchbox">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อลูกค้า, เลขร่างสัญญา, หรือเลขที่ขาย..."
          style={{ paddingLeft: '44px' }}
          className="w-full pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
        />
      </div>

      {/* Filter Chips Scrollable Bar */}
      <div className="filter-scroll-container">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`filter-chip ${filter === t.id ? 'active' : ''}`}
          >
            <span>{t.label}</span>
            <span className="chip-count">{t.countVal}</span>
          </button>
        ))}
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matchingDrafts.length > 0 ? (
          matchingDrafts.map((d) => {
            const s = status(d);
            const isReadOnly = Boolean(d.openedAt || d.credit.status === 'rejected');
            const checks = checklist(d, d.soldAt ? 'opening' : 'sale');
            const missing = checks.find((c) => !c.ok);

            const nextStepText = d.openedAt
              ? 'ตรวจผลและเอกสารเปิดสัญญา'
              : d.credit.status === 'rejected'
              ? 'รายการไม่ผ่านการอนุมัติ'
              : d.credit.status.startsWith('pending')
              ? 'รอผลพิจารณาจากสินเชื่อ'
              : d.soldAt
              ? 'ตรวจความพร้อมเปิดสัญญา'
              : d.submittedAt
              ? 'รอผลทำขายและเลขที่ขายจากระบบ'
              : missing
              ? `ขั้นตอนถัดไป: ${missing.label}`
              : 'พร้อมส่งทำขาย';

            return (
              <div
                key={d.id}
                className="task card p-5 flex flex-col justify-between hover:shadow-md transition border border-slate-200 rounded-2xl bg-white"
              >
                <div>
                  {/* Top row: ID and Status badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="mono text-xs font-semibold text-slate-500">
                      {d.id}
                    </span>
                    <span className={`badge ${s.tone}`}>
                      <span className="badge-dot" />
                      <span>{s.label.replace(/^[A-Z0-9_]+\s*·\s*/, '')}</span>
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">
                      {d.buyer.first ? d.buyer.first.slice(0, 1) : 'ล'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate m-0">
                        {d.buyer.first ? `${d.buyer.first} ${d.buyer.last}` : 'ยังไม่ระบุชื่อลูกค้า'}
                      </h3>
                      <p className="text-xs text-slate-500 truncate m-0 mt-0.5">
                        {d.terms.product || 'ยังไม่ระบุสินค้า'}
                      </p>
                    </div>
                  </div>

                  {/* Financial Facts */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 block">ยอดจัดสัญญา</span>
                      <strong className="text-sm font-bold text-slate-800 mono">
                        ฿{money(d.terms.principal)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 block">แผนผ่อนชำระ</span>
                      <strong className="text-xs font-semibold text-slate-700 mono">
                        {d.terms.monthly ? `฿${money(d.terms.monthly)} × ${d.terms.months || '-'} งวด` : '-'}
                      </strong>
                    </div>
                  </div>

                  {/* Next Step hint */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{nextStepText}</span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {d.shop}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectDraft(d.id, missing ? missing.step : 0, isReadOnly ? 'detail' : 'editor')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 p-1 transition"
                  >
                    <span>{isReadOnly ? 'ดูรายละเอียด' : 'เปิดทำต่อ'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">ไม่พบรายการงานที่ตรงกับเงื่อนไข</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">ลองค้นหาด้วยชื่อ เลขร่าง หรือเลือกดูสถานะอื่น</p>
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              แสดงงานทั้งหมด
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
