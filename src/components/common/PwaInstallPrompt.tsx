import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    interface SafariNavigator extends Navigator {
      standalone?: boolean;
    }
    const nav = window.navigator as SafariNavigator;
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(nav.standalone);
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !('MSStream' in window);
    setIsIOS(isIosDevice);

    // Listen for Android / Chrome beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (isStandalone || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // 1. Android / Desktop Chrome Install Banner
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-96 rounded-2xl bg-white p-4 shadow-xl border border-slate-200 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 font-bold text-lg">
            ส
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900">ติดตั้งแอปสยามชัย DCR</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              เพิ่มลงหน้าจอโฮมเพื่อเปิดใช้งานได้รวดเร็วเต็มหน้าจอ และใช้งานแบบออฟไลน์ได้
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold shadow-sm hover:bg-red-700 transition"
              >
                <Download className="w-3.5 h-3.5" />
                ติดตั้งลงหน้าจอโฮม
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 rounded-lg text-slate-500 text-xs font-medium hover:bg-slate-100 transition"
              >
                ไว้ภายหลัง
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. iOS Safari Instruction Banner
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl bg-slate-900/95 backdrop-blur-md p-4 text-white shadow-2xl border border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-sm">
              ส
            </div>
            <span className="text-sm font-semibold">ติดตั้งลงหน้าจอโฮม iPhone / iPad</span>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1"
            aria-label="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-300 mt-2">
          เพื่อให้ใช้งานได้เต็มหน้าจอเสมือนแอปจริง:
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-amber-300 bg-slate-800/80 px-3 py-2 rounded-xl">
          <span>1. แตะปุ่มแชร์</span>
          <Share className="w-4 h-4 text-sky-400 inline" />
          <span>ที่แถบล่างสุด</span>
          <span>→ 2. เลือก</span>
          <PlusSquare className="w-4 h-4 text-emerald-400 inline" />
          <span className="font-semibold text-white">"เพิ่มไปยังหน้าจอโฮม"</span>
        </div>
      </div>
    );
  }

  return null;
};
