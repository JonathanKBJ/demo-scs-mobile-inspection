import { useMobileBack } from '../../utils/mobileNavigation';
import React from 'react';
import { useContractStore } from '../../store/useContractStore';
import {
  ArrowLeft,
  Printer,
  Copy,
  Clock,
} from 'lucide-react';
import { status, usesGuarantor, historyReportMatches } from '../../domain/rules';
import { money } from '../../domain/calculations';
import { HistoryReport } from '../wizard/HistoryReport';

export const DetailView: React.FC = () => {
  const { activeDraft, selectDraft, showToast, user } = useContractStore();

  useMobileBack(true, () => selectDraft('', 0, 'tasks'), 'detail-view');

  if (!activeDraft) return null;

  const d = activeDraft;
  const s = status(d);

  const handleCopyId = () => {
    navigator.clipboard.writeText(d.id);
    showToast(`คัดลอกรหัสสัญญา ${d.id} เรียบร้อยแล้ว`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => selectDraft('', 0, 'tasks')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้ารายการงาน</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyId}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>คัดลอกเลขร่าง</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์สรุปสัญญา</span>
          </button>
        </div>
      </div>

      {/* Main Dossier Card */}
      <div className="card p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="mono text-xs font-bold text-slate-400">{d.id}</span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs text-slate-500">{d.shop}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              {d.buyer.first} {d.buyer.last}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              เลขบัตรประชาชน: <span className="mono font-semibold">{d.buyer.id || '-'}</span>
            </p>
          </div>
          <span className={`badge ${s.tone} self-start sm:self-center`}>
            <span className="badge-dot" />
            <span>{s.label}</span>
          </span>
        </div>

        {/* Financial Overview Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block font-medium">ราคาสินค้า</span>
            <strong className="text-base font-bold text-slate-900 mono">฿{money(d.terms.price)}</strong>
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">เงินดาวน์</span>
            <strong className="text-base font-bold text-slate-900 mono">฿{money(d.terms.down)}</strong>
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">ยอดจัดสัญญา</span>
            <strong className="text-base font-bold text-red-600 mono">฿{money(d.terms.principal)}</strong>
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">แผนผ่อนชำระ</span>
            <strong className="text-sm font-semibold text-slate-800 mono">
              ฿{money(d.terms.monthly)} × {d.terms.months || '-'} งวด
            </strong>
          </div>
        </div>

        {/* Important Dates & References */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl border border-slate-100 bg-white">
            <span className="text-slate-400 block mb-0.5">เลขที่ขาย (Sale Ref)</span>
            <strong className="mono font-bold text-slate-800 text-sm">
              {d.saleRef || 'ยังไม่มีผลขาย'}
            </strong>
          </div>
          <div className="p-3 rounded-xl border border-slate-100 bg-white">
            <span className="text-slate-400 block mb-0.5">วันที่ทำขาย</span>
            <strong className="font-semibold text-slate-800">
              {d.saleDate || '-'}
            </strong>
          </div>
          <div className="p-3 rounded-xl border border-slate-100 bg-white">
            <span className="text-slate-400 block mb-0.5">สถานะเปิดสัญญา</span>
            <strong className={`font-semibold ${d.openedAt ? 'text-emerald-600' : 'text-blue-600'}`}>
              {d.openedAt ? 'เปิดสัญญาสำเร็จ (FINISH)' : 'รอเปิดสัญญา'}
            </strong>
          </div>
        </div>

        {/* Parties involved */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              ข้อมูลผู้เช่าซื้อ
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>ที่อยู่ตามบัตร:</strong> {d.buyer.address} {d.buyer.subdistrict} {d.buyer.district}{' '}
              {d.buyer.province} {d.buyer.postcode}
              <br />
              <strong>เบอร์โทรศัพท์:</strong> {d.buyer.phone}
              <br />
              <strong>อาชีพ:</strong> {d.buyer.job} ({d.buyer.company}) รายได้ ฿{money(d.buyer.income)}/ด.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              ข้อมูลผู้ค้ำประกัน
            </h3>
            {usesGuarantor(d) ? (
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>ชื่อผู้ค้ำ:</strong> {d.guarantor.first} {d.guarantor.last} ({d.guarantor.relation})
                <br />
                <strong>เบอร์โทรศัพท์:</strong> {d.guarantor.phone}
                <br />
                <strong>อาชีพ:</strong> {d.guarantor.job} รายได้ ฿{money(d.guarantor.income)}/ด.
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">สัญญานี้เป็นสดพิเศษ ไม่ต้องมีผู้ค้ำประกัน</p>
            )}
          </div>
        </div>

        <section className="space-y-4 border-t border-slate-100 pt-4" aria-labelledby="saved-history-heading">
          <h2 id="saved-history-heading" className="text-base font-bold text-slate-900">
            ผลตรวจประวัติก่อนทำสัญญา
          </h2>
          <p className="text-sm text-slate-600">
            ข้อมูลสาธิตที่บันทึกไว้ของผู้เกี่ยวข้อง แยกจากประวัติการดำเนินรายการด้านล่าง
          </p>
          {(['buyer', ...(usesGuarantor(d) ? ['guarantor'] as const : [])] as const).map((who) => {
            const identity = d.identities[who];
            const report = identity.report;
            const label = who === 'buyer' ? 'ผู้เช่าซื้อ' : 'ผู้ค้ำประกัน';
            const current = d.consent && historyReportMatches(d, who);
            return (
              <details key={who} className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">
                  {label} · {d[who].first} {d[who].last}
                </summary>
                <div className="mt-4">
                  {current && report ? (
                    <HistoryReport report={report} canInspect={user.role !== 'sales'} />
                  ) : (
                    <p className="text-sm text-slate-600">ไม่มีผลตรวจประวัติที่ตรงกับบุคคลนี้ในร่างที่บันทึกไว้</p>
                  )}
                </div>
              </details>
            );
          })}
          {!usesGuarantor(d) && (
            <p className="text-sm text-slate-600">สดพิเศษ: ไม่ต้องตรวจประวัติผู้ค้ำประกัน</p>
          )}
          {d.credit.reason && (
            <p className="break-words text-sm text-slate-700">
              <strong>
                {['pending', 'pending2', 'approved', 'rejected'].includes(d.credit.status)
                  ? 'เหตุผลส่งตรวจ: '
                  : 'หมายเหตุผลตรวจ: '}
              </strong>
              {d.credit.reason}
            </p>
          )}
          {d.credit.decisions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800">ผลพิจารณาสินเชื่อสาธิต</h3>
              {d.credit.decisions.map((decision, index) => (
                <div key={`${decision.at}-${index}`} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold">
                    ระดับ {decision.level} · {decision.approve ? 'อนุมัติ' : 'ไม่อนุมัติ'}
                    {decision.percent !== null ? ` · รับ ${decision.percent}%` : ''}
                  </p>
                  <p className="break-words">{decision.note}</p>
                  {decision.reason && <p className="break-words">เหตุผลประกอบ: {decision.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History log */}
        {d.history.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              ประวัติการดำเนินรายการ
            </h3>
            <div className="space-y-2">
              {d.history.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-700">{h.text}</span>
                    <span className="text-slate-400 ml-2">({h.by})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
