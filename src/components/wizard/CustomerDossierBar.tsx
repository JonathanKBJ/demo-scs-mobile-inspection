import React from 'react';
import { useContractStore } from '../../store/useContractStore';
import { ArrowLeft } from 'lucide-react';
import { STEPS, status, checklist } from '../../domain/rules';
import { money } from '../../domain/calculations';

export const CustomerDossierBar: React.FC = () => {
  const {
    activeDraft,
    activeStep,
    setActiveStep,
    selectDraft,
    isDirty,
  } = useContractStore();

  if (!activeDraft) return null;

  const s = status(activeDraft);
  const checks = checklist(activeDraft, activeDraft.soldAt ? 'opening' : 'sale');
  const stepOk = (i: number) => {
    if (i === 8) return checks.every((c) => c.ok);
    if (i === 7 || (!activeDraft.soldAt && [5, 6].includes(i))) return false;
    return checks.filter((c) => c.step === i).every((c) => c.ok);
  };

  const customerName = activeDraft.buyer.first
    ? `${activeDraft.buyer.first} ${activeDraft.buyer.last}`
    : 'เริ่มจัดทำสัญญา';

  const productSummary = activeDraft.terms.product || 'ยังไม่ระบุสินค้า';
  const principalText = activeDraft.terms.principal
    ? ` • ยอดจัด ฿${money(activeDraft.terms.principal)}`
    : '';

  return (
    <div className="editor-top space-y-3">
      {/* Return to Tasks */}
      <div className="editor-nav-bar flex items-center justify-between">
        <button
          type="button"
          onClick={() => selectDraft('', 0, 'tasks')}
          className="editor-back-link inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้าหลัก (งานของฉัน)</span>
        </button>
        <span className="text-xs text-slate-400">
          {activeDraft.shop}
        </span>
      </div>

      {/* Customer Dossier Card */}
      <div className="dossier-card bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="dossier-row flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="dossier-id mono text-xs text-slate-400">
              {activeDraft.id} · {activeDraft.shop}
            </div>
            <h1 className="dossier-name text-lg md:text-xl font-bold text-slate-900 mt-1 truncate">
              {customerName}
            </h1>
            <div className="dossier-meta text-xs text-slate-500 mt-0.5 truncate">
              {productSummary}
              {principalText}
            </div>
          </div>
          <span className={`badge ${s.tone} shrink-0`}>
            <span className="badge-dot" />
            <span>{s.label.replace(/^[A-Z0-9_]+\s*·\s*/, '')}</span>
          </span>
        </div>

        {/* Step subtitle & save state */}
        <div className="flex items-center justify-between text-xs text-slate-400 mt-3 mb-2">
          <span>
            ขั้นตอนที่ {activeStep + 1} จาก {STEPS.length}:{' '}
            <strong className="text-slate-700">{STEPS[activeStep]}</strong>
          </span>
          <span>{isDirty ? 'มีข้อมูลที่ยังไม่บันทึก' : 'บันทึกล่าสุดแล้ว'}</span>
        </div>

        {/* Progress Bar */}
        <div className="progress w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-red-600 transition-all duration-300"
            style={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Mobile Step Dropdown */}
        <div className="mobile-step">
          <select
            value={activeStep}
            onChange={(e) => setActiveStep(Number(e.target.value))}
            className="w-full text-xs font-medium py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            aria-label="เลือกขั้นตอน"
          >
            {STEPS.map((name, i) => (
              <option key={name} value={i}>
                ขั้นตอนที่ {i + 1}. {name} {stepOk(i) ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
