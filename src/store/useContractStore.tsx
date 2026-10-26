import { mobileNav } from '../utils/mobileNavigation';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ContractDraft, UserRole } from '../types/contract';
import {
  seeds,
  makeDraft,
  submit,
  recordSale,
  openContract,
  demoImage,
  migrateDraft,
  inspectDemoHistory,
} from '../domain/workflow';
import {
  checklist,
  invalidateReview,
  historyReportMatches,
  resetReviewFromReports,
  usesGuarantor,
} from '../domain/rules';
import { localDay } from '../domain/calculations';

const STORAGE_KEY = 'siamchai-dcr-pwa-v1';

export interface UserProfile {
  name: string;
  role: UserRole;
  shop: string;
}

export function loadSavedDrafts(): ContractDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((draft) => migrateDraft(draft));
      }
    }
  } catch (err) {
    console.error('Failed to load drafts from storage:', err);
  }
  return seeds();
}

export function saveDraftsToStorage(drafts: ContractDraft[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.error('Failed to save drafts to storage:', err);
  }
}

export interface ContractContextValue {
  drafts: ContractDraft[];
  activeDraftId: string | null;
  activeDraft: ContractDraft | null;
  activeStep: number;
  currentView: 'tasks' | 'editor' | 'detail';
  filter: string;
  search: string;
  user: UserProfile;
  isDirty: boolean;
  toast: string | null;
  setFilter: (f: string) => void;
  setSearch: (s: string) => void;
  setUser: (u: UserProfile) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  createDraft: () => string;
  selectDraft: (id: string, step?: number, view?: 'tasks' | 'editor' | 'detail') => void;
  setActiveStep: (step: number) => void;
  updateActiveDraft: (updater: (draft: ContractDraft) => void) => void;
  saveCurrentDraft: () => void;
  submitCurrentDraft: () => boolean;
  recordSaleCurrentDraft: (saleDate?: string) => boolean;
  openCurrentContract: () => boolean;
  fillDemoData: () => void;
  loadScenario: (presetIndex: number) => void;
  exportStateJson: () => string;
  importStateJson: (json: string) => boolean;
  resetToInitialSeeds: () => void;
}

const ContractContext = createContext<ContractContextValue | null>(null);

export const ContractProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [drafts, setDraftState] = useState<ContractDraft[]>(loadSavedDrafts);
  const draftsRef = useRef(drafts);
  const setDrafts = useCallback((next: React.SetStateAction<ContractDraft[]>) => {
    const value = typeof next === 'function' ? next(draftsRef.current) : next;
    draftsRef.current = value;
    setDraftState(value);
  }, []);
  const [activeDraftId, setActiveDraftState] = useState<string | null>(null);
  const activeDraftIdRef = useRef<string | null>(null);
  const setActiveDraftId = useCallback((id: string | null) => {
    activeDraftIdRef.current = id;
    setActiveDraftState(id);
  }, []);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [currentView, setCurrentView] = useState<'tasks' | 'editor' | 'detail'>('tasks');
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [user, setUser] = useState<UserProfile>({
    name: 'พนักงานขายตัวอย่าง',
    role: 'sales',
    shop: 'สาขาตัวอย่าง 01',
  });
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveDraftsToStorage(drafts);
  }, [drafts]);

  const activeDraft = drafts.find((d) => d.id === activeDraftId) || null;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const createDraft = useCallback(() => {
    const id = `DEMO-202610-${String(draftsRef.current.length + 1).padStart(3, '0')}`;
    const newDraft = makeDraft(id);
    setDrafts((prev) => [newDraft, ...prev]);
    setActiveDraftId(id);
    setActiveStep(0);
    setCurrentView('editor');
    setIsDirty(true);
    showToast(`สร้างร่างสัญญาใหม่ ${id} แล้ว`);
    return id;
  }, [drafts.length, showToast]);

  const selectDraft = useCallback(
    (id: string, step = 0, view: 'tasks' | 'editor' | 'detail' = 'editor') => {
      if (view === 'tasks') {
        mobileNav.clearToRoot();
      }
      setActiveDraftId(id);
      setActiveStep(step);
      setCurrentView(view);
      setIsDirty(false);
    },
    []
  );

  const updateActiveDraft = useCallback(
    (updater: (draft: ContractDraft) => void) => {
      const selectedId = activeDraftIdRef.current;
      if (!selectedId) return;
      setDrafts((prev) =>
        prev.map((d) => {
          if (d.id !== selectedId) return d;
          const cloneDraft = JSON.parse(JSON.stringify(d)) as ContractDraft;
          updater(cloneDraft);
          for (const who of ['buyer', 'guarantor'] as const) {
            const changed = (['id', 'title', 'first', 'last'] as const).some((key) => d[who][key] !== cloneDraft[who][key]);
            if (changed && !historyReportMatches(cloneDraft, who) &&
              JSON.stringify(d.identities[who]) === JSON.stringify(cloneDraft.identities[who])) {
              invalidateReview(cloneDraft, who);
            } else if (changed && cloneDraft.identities[who].report && !historyReportMatches(cloneDraft, who)) {
              invalidateReview(cloneDraft, who);
            }
          }
          if (d.contractType !== cloneDraft.contractType) {
            cloneDraft.guarantor.required = usesGuarantor(cloneDraft);
            resetReviewFromReports(cloneDraft);
          } else if (d.consent && !cloneDraft.consent) invalidateReview(cloneDraft);
          cloneDraft.updatedAt = new Date().toISOString();
          return cloneDraft;
        })
      );
      setIsDirty(true);
    },
    [setDrafts]
  );

  const saveCurrentDraft = useCallback(() => {
    if (!activeDraft) return;
    saveDraftsToStorage(draftsRef.current);
    setIsDirty(false);
    showToast(`บันทึกร่าง ${activeDraft.id} เรียบร้อยแล้ว`);
  }, [activeDraft, drafts, showToast]);

  const submitCurrentDraft = useCallback(() => {
    if (!activeDraft) return false;
    try {
      updateActiveDraft((d) => {
        submit(d);
        d.history.push({
          at: new Date().toISOString(),
          by: user.name,
          text: 'ส่งทำขาย (รอผลทำขาย)',
        });
      });
      setIsDirty(false);
      showToast(`ส่งทำขาย ${activeDraft.id} สำเร็จ`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`ส่งทำขายไม่สำเร็จ: ${msg}`);
      return false;
    }
  }, [activeDraft, updateActiveDraft, user.name, showToast]);

  const recordSaleCurrentDraft = useCallback(
    (saleDate = localDay()) => {
      if (!activeDraft) return false;
      try {
        updateActiveDraft((d) => {
          recordSale(d, saleDate);
          d.history.push({
            at: new Date().toISOString(),
            by: user.name,
            text: `บันทึกผลขาย ${d.saleRef} และ${d.openedAt ? 'เปิดสัญญาสำเร็จอัตโนมัติ' : 'รอเปิดสัญญา'}`,
          });
        });
        setIsDirty(false);
        showToast(
          checklist(activeDraft, 'opening').every((c) => c.ok)
            ? `บันทึกผลขายและเปิดสัญญา ${activeDraft.id} สำเร็จทันที`
            : `บันทึกผลขาย ${activeDraft.id} สำเร็จ (รอข้อมูลเปิดสัญญา)`
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`บันทึกผลขายไม่สำเร็จ: ${msg}`);
        return false;
      }
    },
    [activeDraft, updateActiveDraft, user.name, showToast]
  );

  const openCurrentContract = useCallback(() => {
    if (!activeDraft) return false;
    try {
      updateActiveDraft((d) => {
        openContract(d);
        d.history.push({
          at: new Date().toISOString(),
          by: user.name,
          text: 'เปิดสัญญาเช่าซื้อสำเร็จ (FINISH)',
        });
      });
      setIsDirty(false);
      showToast(`เปิดสัญญา ${activeDraft.id} สำเร็จเรียบร้อย`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`เปิดสัญญาไม่สำเร็จ: ${msg}`);
      return false;
    }
  }, [activeDraft, updateActiveDraft, user.name, showToast]);

  const fillDemoData = useCallback(() => {
    const current = draftsRef.current.find((draft) => draft.id === activeDraftIdRef.current);
    if (!current) return;
    if (current.openedAt || current.submittedAt || ['pending', 'pending2', 'rejected'].includes(current.credit.status)) {
      showToast('เติมข้อมูลได้เฉพาะร่างที่แก้ไขได้และไม่รอพิจารณา');
      return;
    }
    updateActiveDraft((d) => {
      Object.assign(d.buyer, {
        id: '1100400123456',
        first: 'ธนกร',
        last: 'ใจดี',
        birth: '1995-05-14',
        gender: 'ชาย',
        phone: '0812345678',
        email: 'thanakorn@example.com',
        marital: 'โสด',
        homeType: 'บ้านตนเอง',
        address: '88/14 หมู่ 3 ซอยสุขสวัสดิ์',
        province: 'นนทบุรี',
        district: 'เมืองนนทบุรี',
        subdistrict: 'บางกระสอ',
        postcode: '11000',
        currentSame: true,
        job: 'พนักงานบริษัทเอกชน',
        company: 'บริษัท ดิจิทัลไทย จำกัด',
        position: 'วิศวกรซอฟต์แวร์',
        tenure: '3 ปี',
        income: 35000,
        otherIncome: 5000,
        workPhone: '029876543',
        workAddress: '99 อาคารดิจิทัล ถนนรัตนาธิเบศร์ นนทบุรี 11000',
      });

      if (usesGuarantor(d)) {
        Object.assign(d.guarantor, {
          id: '1100400987654',
          first: 'มาลี',
          last: 'ใจดี',
          phone: '0898765432',
          relation: 'พี่สาว',
          address: '88/14 หมู่ 3 ซอยสุขสวัสดิ์ บางกระสอ นนทบุรี',
          job: 'เจ้าของกิจการ',
          income: 40000,
          company: 'ร้านมาลีการค้า',
          workAddress: 'ตลาดสดเทศบาลนนทบุรี',
        });
        d.identities.guarantor = { confirmed: true, method: 'readcard', history: 'unchecked', report: null };
        d.photos.guarantorId = [
          { id: 'gid1', src: demoImage('บัตรผู้ค้ำ'), name: 'บัตร ปชช. ผู้ค้ำ', at: d.createdAt, by: user.name, demo: true },
        ];
        d.photos.guarantor = [
          { id: 'gphoto1', src: demoImage('รูปผู้ค้ำ'), name: 'ภาพถ่ายคู่ผู้ค้ำ', at: d.createdAt, by: user.name, demo: true },
        ];
      }

      d.identities.buyer = { confirmed: true, method: 'readcard', history: 'unchecked', report: null };
      d.consent = true;
      d.ocrConfirmed = true;
      invalidateReview(d);
      inspectDemoHistory(d, 'buyer', 'normal', user.name);
      if (usesGuarantor(d)) inspectDemoHistory(d, 'guarantor', 'normal', user.name);

      Object.assign(d.terms, {
        product: 'iPhone 16 Pro 128GB (เครื่องศูนย์)',
        qty: 1,
        price: '39900',
        down: '3900',
        principal: '36000',
        months: '12',
        monthly: '3000',
        firstDue: '',
        dueDay: '28',
      });

      Object.assign(d.location, {
        lat: 13.859123,
        lng: 100.521456,
        link: 'https://maps.google.com/?q=13.859123,100.521456',
        landmark: 'บ้านเดี่ยวสองชั้น ประตูรั้วสีขาว ติดกับร้านสะดวกซื้อ',
        type: 'ที่อยู่ปัจจุบัน',
      });

      d.pageGroup = 'เพจสาขาตัวอย่าง นนทบุรี';
      d.financeStaff = 'น.ส. สุชาดา (สินเชื่อพื้นที่ 01)';
      d.documentReviewed = true;

      d.photos.id = [
        { id: 'bid1', src: demoImage('บัตรผู้ซื้อ'), name: 'บัตร ปชช. ผู้ซื้อ', at: d.createdAt, by: user.name, demo: true },
      ];
      d.photos.buyer = [
        { id: 'bphoto1', src: demoImage('รูปผู้ซื้อ'), name: 'ภาพถ่ายคู่ผู้ซื้อ', at: d.createdAt, by: user.name, demo: true },
      ];
      d.photos.place = Array.from({ length: 5 }, (_, i) => ({
        id: `place_${i}`,
        src: demoImage(`จุดติดตาม GPS ${i + 1}`),
        name: `ภาพสถานที่จุดติดตาม ${i + 1}`,
        at: d.createdAt,
        by: user.name,
        demo: true,
      }));
    });
    showToast('เติมข้อมูลตัวอย่างจำลองครบถ้วนเรียบร้อย');
  }, [activeDraftId, updateActiveDraft, user.name, showToast]);

  const loadScenario = useCallback(
    (presetIndex: number) => {
      const allSeeds = seeds();
      if (presetIndex < 0 || presetIndex >= allSeeds.length) return;
      const targetSeed = allSeeds[presetIndex];
      setDrafts((prev) => {
        const exists = prev.some((d) => d.id === targetSeed.id);
        if (exists) {
          return prev.map((d) => (d.id === targetSeed.id ? targetSeed : d));
        }
        return [targetSeed, ...prev];
      });
      setActiveDraftId(targetSeed.id);
      setActiveStep(0);
      setCurrentView('editor');
      showToast(`โหลดเคสทดสอบ: ${targetSeed.id} (${targetSeed.buyer.first}) เรียบร้อย`);
    },
    [showToast]
  );

  const exportStateJson = useCallback(() => {
    return JSON.stringify(draftsRef.current, null, 2);
  }, []);

  const importStateJson = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const imported = parsed.map((draft) => migrateDraft(draft));
          setDrafts(imported);
          saveDraftsToStorage(imported);
          showToast(`นำเข้าชุดข้อมูลสัญญา ${parsed.length} รายการสำเร็จ`);
          return true;
        }
        showToast('รูปแบบข้อมูล JSON ไม่ถูกต้อง');
        return false;
      } catch (err) {
        showToast('ไม่สามารถแยกวิเคราะห์ไฟล์ JSON ได้');
        return false;
      }
    },
    [showToast]
  );

  const resetToInitialSeeds = useCallback(() => {
    const s = seeds();
    setDrafts(s);
    saveDraftsToStorage(s);
    setActiveDraftId(null);
    setCurrentView('tasks');
    showToast('รีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้นสาธิตเรียบร้อย');
  }, [showToast]);

  return (
    <ContractContext.Provider
      value={{
        drafts,
        activeDraftId,
        activeDraft,
        activeStep,
        currentView,
        filter,
        search,
        user,
        isDirty,
        toast,
        setFilter,
        setSearch,
        setUser,
        showToast,
        clearToast,
        createDraft,
        selectDraft,
        setActiveStep,
        updateActiveDraft,
        saveCurrentDraft,
        submitCurrentDraft,
        recordSaleCurrentDraft,
        openCurrentContract,
        fillDemoData,
        loadScenario,
        exportStateJson,
        importStateJson,
        resetToInitialSeeds,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};

export function useContractStore(): ContractContextValue {
  const ctx = useContext(ContractContext);
  if (!ctx) {
    throw new Error('useContractStore must be used within a ContractProvider');
  }
  return ctx;
}
