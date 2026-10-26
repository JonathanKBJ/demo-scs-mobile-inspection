import React, { useState } from 'react';
import { useContractStore } from '../../store/useContractStore';
import {
  X,
  PlayCircle,
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  UserCheck,
} from 'lucide-react';

interface ScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScenarioModal: React.FC<ScenarioModalProps> = ({ isOpen, onClose }) => {
  const {
    loadScenario,
    fillDemoData,
    activeDraftId,
    exportStateJson,
    importStateJson,
    resetToInitialSeeds,
    user,
    setUser,
    showToast,
  } = useContractStore();

  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);

  if (!isOpen) return null;

  const scenarios = [
    {
      title: 'เคสที่ 1: สัญญาพร้อมส่งทำขาย (ปกติ มีผู้ค้ำ)',
      desc: 'ตรวจตัวตน ประวัติสินเชื่อ และเงื่อนไขครบ 5 หมวดแรก พร้อมกดส่งทำขาย',
      presetIndex: 0,
      badge: 'พร้อมทำขาย',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      title: 'เคสที่ 2: สัญญาผ่านการขายแล้ว (เปิดสัญญาเรียบร้อย)',
      desc: 'มีผลขาย เลขที่ขาย DEMO-SALE ครบทั้งรูปถ่ายและพิกัดติดตาม สัญญาเปิดแล้ว',
      presetIndex: 1,
      badge: 'เปิดสัญญาแล้ว',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      title: 'เคสที่ 3: เคสรอดำเนินการอนุมัติสินเชื่อ (ระดับ 1 และ 2)',
      desc: 'ประวัติติดเงื่อนไข ต้องให้ผู้อนุมัติตรวจสอบและระบุเหตุผล 0–100%',
      presetIndex: 2,
      badge: 'รอตรวจระดับ 1',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  ];

  const handleCopyJson = () => {
    const json = exportStateJson();
    navigator.clipboard.writeText(json);
    showToast('คัดลอกชุดข้อมูล JSON ทั้งหมดลงคลิปบอร์ดแล้ว');
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const ok = importStateJson(importText);
    if (ok) {
      setShowImportArea(false);
      setImportText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 mb-1">
              STAKEHOLDER TOOLKIT
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900">
              เครื่องมือจำลองสถานการณ์และสรุปเงื่อนไข
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              เลือกเคสตัวอย่างสำเร็จรูป หรือแชร์สถานะให้ทีมตรวจสัญญาเปิดบนมือถือเครื่องอื่น
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-6">
          {/* Quick Pre-fill action if in editor */}
          {activeDraftId && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <strong className="text-sm text-red-950 block">เติมข้อมูลสาธิตในร่างปัจจุบัน</strong>
                <span className="text-xs text-red-700">
                  ใส่บัตร ปชช., ที่อยู่, อาชีพ, สินค้า, พิกัด GPS 5 รูปให้ครบในคลิกเดียว
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  fillDemoData();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>เติมข้อมูลทันที</span>
              </button>
            </div>
          )}

          {/* Preset Scenario Cards */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              1. โหลดเคสทดสอบสำเร็จรูป (Scenario Presets)
            </h3>
            <div className="grid gap-3">
              {scenarios.map((sc) => (
                <div
                  key={sc.presetIndex}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <strong className="text-sm font-semibold text-slate-900">{sc.title}</strong>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${sc.badgeColor}`}>
                        {sc.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{sc.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      loadScenario(sc.presetIndex);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shrink-0 transition"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>โหลดเคสนี้</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Role Switcher */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              2. สลับบทบาทผู้ใช้งาน (Role Switcher)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['sales', 'พนักงานขาย', 'หน้าร้าน / ฝ่ายขาย'],
                  ['inspector', 'ผู้อนุมัติ 1', 'ตรวจสอบระดับ 1'],
                  ['inspector2', 'ผู้อนุมัติ 2', 'ตรวจสอบระดับ 2'],
                ] as const
              ).map(([r, title, sub]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    setUser({
                      ...user,
                      role: r,
                      name:
                        r === 'inspector2'
                          ? 'ผู้ตรวจระดับ 2 (สาธิต)'
                          : r === 'inspector'
                          ? 'ผู้ตรวจระดับ 1 (สาธิต)'
                          : 'พนักงานขายตัวอย่าง',
                    })
                  }
                  className={`p-2.5 rounded-xl border text-left transition ${
                    user.role === r
                      ? 'border-red-600 bg-red-50/50 text-red-950 font-semibold ring-1 ring-red-600'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-bold">{title}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* State Sharing & Export/Import */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              3. แชร์สถานะทดสอบ (Export / Import State)
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
              >
                <Download className="w-4 h-4" />
                <span>คัดลอก JSON ทั้งหมด</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImportArea(!showImportArea)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
              >
                <Upload className="w-4 h-4" />
                <span>นำเข้า JSON จากเครื่องอื่น</span>
              </button>
              <button
                type="button"
                onClick={resetToInitialSeeds}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium transition ml-auto"
              >
                <RotateCcw className="w-4 h-4" />
                <span>รีเซ็ตคืนค่าเริ่มต้น</span>
              </button>
            </div>

            {showImportArea && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fade-in">
                <label className="text-xs font-semibold text-slate-700 block">
                  วางข้อความ JSON ที่คัดลอกมาจากเครื่องอื่น:
                </label>
                <textarea
                  rows={4}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='[ { "id": "DEMO-202610-001", ... } ]'
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  ยืนยันนำเข้าข้อมูล
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
