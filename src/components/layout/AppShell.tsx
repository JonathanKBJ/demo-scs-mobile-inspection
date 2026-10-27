import { useEffect } from 'react';
import { mobileNav, useMobileBack } from '../../utils/mobileNavigation';
import React, { useState } from 'react';
import { useContractStore } from '../../store/useContractStore';
import {
  Briefcase,
  PlusCircle,
  ShieldCheck,
  Home,
  Sliders,
  Store,
} from 'lucide-react';
import { PwaInstallPrompt } from '../common/PwaInstallPrompt';
import { ScenarioModal } from '../stakeholder/ScenarioModal';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentView,
    activeDraft,
    user,
    setUser,
    selectDraft,
    createDraft,
    toast,
    showToast,
  } = useContractStore();

  const [scenarioOpen, setScenarioOpen] = useState(false);
  useEffect(() => {
    mobileNav.init(showToast);
  }, [showToast]);

  useMobileBack(scenarioOpen, () => setScenarioOpen(false), 'scenario-modal');


  const isReviewer = ['inspector', 'inspector2'].includes(user.role);
  const roleName =
    user.role === 'inspector2'
      ? 'ผู้อนุมัติระดับ 2'
      : user.role === 'inspector'
      ? 'ผู้อนุมัติระดับ 1'
      : 'หน้าร้าน / ฝ่ายขาย';

  return (
    <div className={currentView === 'editor' ? 'editor' : ''}>
      {/* Accessibility skip link */}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          // Move accessibility focus without adding a fragment history entry.
          event.preventDefault();
          const main = document.getElementById('main-content');
          main?.focus({ preventScroll: true });
          main?.scrollIntoView();
        }}
      >
        ข้ามไปเนื้อหาหลัก
      </a>

      {/* Desktop Sidebar */}
      <aside className="side" aria-label="แถบเมนูเดสก์ท็อป">
        <div className="side-brand flex items-center gap-3">
          <img
            src="/pwa-192x192.png"
            alt="สยามชัย"
            className="w-10 h-10 rounded-xl object-contain shadow-sm shrink-0"
          />
          <div className="brand" translate="no">
            สยามชัย
            <small>CONTRACT WORKSPACE</small>
          </div>
        </div>
        <p className="eyebrow nav-caption">พื้นที่ทำงาน</p>
        <nav aria-label="เมนูหลัก">
          <button
            type="button"
            className={currentView === 'tasks' ? 'active' : ''}
            onClick={() => selectDraft('', 0, 'tasks')}
          >
            <Briefcase className="w-5 h-5" />
            <span>งานของฉัน</span>
          </button>
          <button type="button" onClick={createDraft}>
            <PlusCircle className="w-5 h-5 text-red-600" />
            <span>เริ่มรายการใหม่</span>
          </button>
          <button
            type="button"
            onClick={() => setScenarioOpen(true)}
            className="text-amber-700 bg-amber-50 hover:bg-amber-100 font-semibold"
          >
            <Sliders className="w-5 h-5 text-amber-600" />
            <span>สลับเคสทดสอบ (Presets)</span>
          </button>
          {isReviewer && (
            <button
              type="button"
              className={currentView === 'tasks' ? 'active' : ''}
              onClick={() => selectDraft('', 0, 'tasks')}
            >
              <ShieldCheck className="w-5 h-5" />
              <span>ตรวจอนุมัติ</span>
            </button>
          )}
        </nav>

        {/* User Role Card at bottom */}
        <div className="side-bottom">
          <div className="row">
            <div className="avatar" aria-hidden="true">
              {user.role === 'inspector2' ? 'ผ2' : user.role === 'inspector' ? 'ผ1' : 'ข'}
            </div>
            <div className="grow">
              <strong className="small block text-slate-800">{user.name}</strong>
              <span className="helper block text-xs text-slate-500">{roleName}</span>
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="role-select" className="sr-only">
              สลับบทบาทผู้ใช้
            </label>
            <select
              id="role-select"
              value={user.role}
              onChange={(e) =>
                setUser({
                  ...user,
                  role: e.target.value as 'sales' | 'inspector' | 'inspector2',
                  name:
                    e.target.value === 'inspector2'
                      ? 'ผู้ตรวจระดับ 2 (สาธิต)'
                      : e.target.value === 'inspector'
                      ? 'ผู้ตรวจระดับ 1 (สาธิต)'
                      : 'พนักงานขายตัวอย่าง',
                })
              }
              className="w-full text-xs py-1.5 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium"
            >
              <option value="sales">บทบาท: พนักงานขาย (หน้าร้าน)</option>
              <option value="inspector">บทบาท: ผู้อนุมัติระดับ 1</option>
              <option value="inspector2">บทบาท: ผู้อนุมัติระดับ 2</option>
            </select>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-main" id="main-content" tabIndex={-1}>
        {/* Topbar */}
        <header className="topbar">
          <div className="mobile-brand flex items-center gap-2 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="สยามชัย"
              className="w-8 h-8 rounded-lg object-contain shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-tight">สยามชัย</div>
              <div className="text-[10px] text-white/80 leading-tight truncate">
                {currentView === 'editor' ? 'จัดทำสัญญา' : 'สัญญาออนไลน์'}
              </div>
            </div>
          </div>

          <div className="topbar-title">
            <span>สัญญาออนไลน์</span>
            <span className="muted"> / </span>
            <span>
              {currentView === 'tasks'
                ? 'พื้นที่ทำงาน'
                : currentView === 'detail'
                ? 'รายละเอียดสัญญา'
                : `จัดทำสัญญา (${activeDraft?.id || ''})`}
            </span>
          </div>

          <div className="top-meta flex items-center gap-2 shrink-0">
            {/* Mobile Home button inside topbar when in editor or detail */}
            {currentView !== 'tasks' && (
              <button
                type="button"
                className="topbar-home-btn"
                onClick={() => selectDraft('', 0, 'tasks')}
                aria-label="กลับหน้ารายการงาน"
              >
                <Home className="w-4 h-4 text-red-600" />
                <span>หน้าหลัก</span>
              </button>
            )}

            <span className="shop-label hidden md:inline-flex">
              <Store className="w-4 h-4 text-slate-400" />
              <span>{user.shop}</span>
            </span>

            <button
              type="button"
              onClick={() => setScenarioOpen(true)}
              className="inline-flex md:hidden items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>เคสทดสอบ</span>
            </button>

            <span className="demo-badge hidden sm:inline-flex">PROTOTYPE</span>
          </div>
        </header>

        {/* Child views */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto pt-4 md:pt-8">{children}</div>
      </main>
      {/* Mobile Bottom Navigation - Only show on Tasks Dashboard */}
      {currentView === 'tasks' && (
        <nav className="bottom-nav md:hidden" aria-label="เมนูหลักมือถือ">
          <button
            type="button"
            className="active"
            onClick={() => selectDraft('', 0, 'tasks')}
          >
            <Briefcase className="w-5 h-5" />
            <span>งานของฉัน</span>
          </button>
          <button type="button" onClick={createDraft}>
            <div className="center-action-circle">
              <PlusCircle className="w-6 h-6" />
            </div>
            <span>เริ่มรายการ</span>
          </button>
          <button type="button" onClick={() => setScenarioOpen(true)}>
            <Sliders className="w-5 h-5 text-amber-700" />
            <span>เคสทดสอบ</span>
          </button>
        </nav>
      )}
      {/* Floating PWA Install Prompt */}
      <PwaInstallPrompt />

      {/* Stakeholder Scenario Switcher & Tool Modal */}
      <ScenarioModal isOpen={scenarioOpen} onClose={() => setScenarioOpen(false)} />

      {/* Global Toast Alert */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-sm border border-slate-700 animate-slide-up"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
