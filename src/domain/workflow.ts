import type { ContractDraft, ContractType, UserRole } from '../types/contract';
import { localDay } from './calculations';
import { createDemoHistory, historyRiskLabel } from './customerHistory';
import type { HistoryPerson, HistoryScenario } from './customerHistory';
import {
  checklist,
  editable,
  historyComplete,
  historyReportMatches,
  identityComplete,
  invalidateReview,
  resetReviewFromReports,
  present,
  usesGuarantor,
} from './rules';

export function makeDraft(id: string): ContractDraft {
  return {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: 'พนักงานขายตัวอย่าง',
    shop: 'สาขาตัวอย่าง 01',
    channel: 'หน้าร้าน',
    contractType: 'NORMAL',
    pageGroup: '',
    financeStaff: '',
    note: '',
    buyer: {
      id: '',
      title: 'นาย',
      first: '',
      last: '',
      birth: '',
      gender: '',
      phone: '',
      email: '',
      marital: '',
      homeType: '',
      address: '',
      province: '',
      district: '',
      subdistrict: '',
      postcode: '',
      currentSame: true,
      currentAddress: '',
      currentProvince: '',
      currentDistrict: '',
      currentSubdistrict: '',
      currentPostcode: '',
      job: '',
      company: '',
      position: '',
      tenure: '',
      income: '',
      otherIncome: '',
      workPhone: '',
      workAddress: '',
    },
    guarantor: {
      required: true,
      id: '',
      title: 'นางสาว',
      first: '',
      last: '',
      phone: '',
      relation: '',
      address: '',
      job: '',
      income: '',
      company: '',
      workAddress: '',
    },
    identities: {
      buyer: { confirmed: false, method: '', history: 'unchecked', report: null },
      guarantor: { confirmed: false, method: '', history: 'unchecked', report: null },
    },
    terms: {
      product: '',
      qty: 1,
      price: '',
      down: '',
      principal: '',
      months: '',
      monthly: '',
      firstDue: '',
      dueDay: '',
      fee: '',
    },
    location: { lat: '', lng: '', link: '', landmark: '', type: 'ที่อยู่ปัจจุบัน' },
    consent: false,
    ocrConfirmed: false,
    credit: { status: 'unchecked', reason: '', note: '', requiresLevel2: false, decisions: [] },
    photos: {},
    signatures: {},
    signedSnapshot: '',
    documentReviewed: false,
    submittedAt: null,
    soldAt: null,
    saleDate: '',
    openedAt: null,
    saleRef: '',
    barcode: '',
    notificationStatus: 'not_sent',
    history: [],
  };
}

export function migrateDraft(old: Partial<ContractDraft> & { id: string }): ContractDraft {
  const base = makeDraft(old.id);
  const rejection = old.credit?.status === 'rejected' ? { ...base.credit, ...old.credit } : null;
  const d: ContractDraft = {
    ...base,
    ...old,
    buyer: { ...base.buyer, ...(old.buyer || {}) },
    guarantor: { ...base.guarantor, ...(old.guarantor || {}) },
    terms: { ...base.terms, ...(old.terms || {}) },
    location: { ...base.location, ...(old.location || {}) },
    credit: { ...base.credit, ...(old.credit || {}) },
    identities: {
      buyer: { ...base.identities.buyer, ...old.identities?.buyer },
      guarantor: { ...base.identities.guarantor, ...old.identities?.guarantor },
    },
  };
  d.guarantor.required = usesGuarantor(d);
  if (!old.identities) {
    d.identities.buyer = { confirmed: Boolean(old.ocrConfirmed), method: 'ocr', history: 'unchecked' };
    d.credit = { ...base.credit };
    if (!d.soldAt && !d.openedAt) d.submittedAt = null;
    if (d.soldAt && !d.saleDate) d.saleDate = localDay(new Date(d.soldAt));
    d.history = [
      ...(old.history || []),
      {
        at: new Date().toISOString(),
        by: 'Prototype v0.2',
        text: 'ปรับข้อมูลจาก v0.1: เก็บข้อมูลเดิมและให้ตรวจเงื่อนไขใหม่ก่อนดำเนินการต่อ',
      },
    ];
  }
  let missingReport = false;
  for (const who of ['buyer', 'guarantor'] as const) {
    if (!historyReportMatches(d, who)) {
      d.identities[who].report = null;
      d.identities[who].history = 'unchecked';
      if (who === 'buyer' || usesGuarantor(d)) missingReport = true;
    }
  }
  if (missingReport || !d.consent) {
    invalidateReview(d);
    if (!d.soldAt && !d.openedAt) d.submittedAt = null;
  }
  // Missing legacy evidence requires a recheck, never reopening a cancelled draft.
  if (rejection) d.credit = rejection;
  return d;
}

export function setContractType(d: ContractDraft, type: ContractType): void {
  if (!editable(d) || d.soldAt || ['pending', 'pending2'].includes(d.credit.status)) {
    throw new Error('เปลี่ยนประเภทได้ก่อนส่งทำขายและเมื่อไม่รอพิจารณาเท่านั้น');
  }
  if (!['NORMAL', 'CASH'].includes(type)) throw new Error('ประเภทไม่ถูกต้อง');
  d.contractType = type;
  d.guarantor.required = usesGuarantor(d);
  resetReviewFromReports(d);
}

function assertHistoryEditable(d: ContractDraft, who: HistoryPerson): void {
  if (!editable(d) || ['pending', 'pending2'].includes(d.credit.status)) {
    throw new Error('แก้ไขผลตรวจไม่ได้ระหว่างรอพิจารณาหรือเมื่อรายการปิดแล้ว');
  }
  if (!['buyer', 'guarantor'].includes(who)) throw new Error('บุคคลไม่ถูกต้อง');
  if (who === 'guarantor' && !usesGuarantor(d)) throw new Error('สดพิเศษไม่ต้องตรวจผู้ค้ำประกัน');
  if (!d.consent) throw new Error('กรุณารับทราบข้อตกลงสาธิตก่อนยืนยันตัวตนและตรวจประวัติ');
}

export function confirmDemoIdentity(d: ContractDraft, who: HistoryPerson, method: 'readcard' | 'ocr'): void {
  assertHistoryEditable(d, who);
  if (!['readcard', 'ocr'].includes(method)) throw new Error('วิธียืนยันตัวตนไม่ถูกต้อง');
  const person = d[who];
  const other = d[who === 'buyer' ? 'guarantor' : 'buyer'];
  const id = person.id || (who === 'buyer' ? 'DEMO-ID-001' : 'DEMO-CO-001');
  if (usesGuarantor(d) && id === other.id) throw new Error('ผู้ซื้อและผู้ค้ำต้องไม่เป็นบุคคลเดียวกัน');
  invalidateReview(d, who);
  Object.assign(person, {
    id,
    first: person.first || (who === 'buyer' ? 'ธนกร' : 'มาลี'),
    last: person.last || 'ใจดี',
    phone: person.phone || 'DEMO-PHONE',
    address: person.address || '88 ถนนตัวอย่าง นนทบุรี (ข้อมูลสมมติ)',
    workAddress: person.workAddress || '99 บริษัทตัวอย่าง นนทบุรี (ข้อมูลสมมติ)',
  });
  if (who === 'buyer') {
    d.buyer.birth ||= '1995-05-14';
    d.buyer.gender ||= 'ชาย';
    d.ocrConfirmed = true;
  }
  d.identities[who].confirmed = true;
  d.identities[who].method = method;
}

export function inspectDemoHistory(d: ContractDraft, who: HistoryPerson, scenario: HistoryScenario, actor: string): void {
  assertHistoryEditable(d, who);
  if (!identityComplete(d, who)) throw new Error('ยืนยันตัวตนบุคคลนี้ก่อนตรวจประวัติ');
  if (usesGuarantor(d) && d.buyer.id === d.guarantor.id) throw new Error('ผู้ซื้อและผู้ค้ำต้องไม่เป็นบุคคลเดียวกัน');
  d.identities[who].report = null;
  d.identities[who].history = 'unchecked';
  invalidateReview(d);
  const person = d[who];
  const at = new Date().toISOString();
  const report = createDemoHistory(who, scenario, {
    id: person.id,
    name: [person.title, person.first, person.last].filter(Boolean).join(' '),
    phone: person.phone,
    cardAddress: person.address,
    currentAddress: who === 'buyer' && !d.buyer.currentSame ? d.buyer.currentAddress : person.address,
    workAddress: person.workAddress,
  }, at, actor);
  d.identities[who].report = report;
  d.identities[who].history = ['none', 'normal'].includes(report.risk) ? 'normal' : 'review';
  resetReviewFromReports(d);
  d.history.push({ at, by: actor, text: `ตรวจประวัติ${who === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ค้ำ'} (ข้อมูลสาธิต): ${historyRiskLabel(report.risk)}` });
}


export function requestReview(d: ContractDraft, reason: string, requiresLevel2 = false): void {
  if (!editable(d) || !historyComplete(d)) throw new Error('ยืนยันตัวตนและตรวจประวัติผู้เกี่ยวข้องให้ครบก่อนส่งตรวจ');
  if (['pending', 'pending2'].includes(d.credit.status)) throw new Error('รายการนี้ส่งตรวจแล้ว');
  if (!present(reason)) throw new Error('กรุณาระบุเหตุที่ต้องตรวจสอบ');
  d.credit = { ...d.credit, status: 'pending', reason, note: '', requiresLevel2, decisions: [] };
}

export interface ReviewDecisionInput {
  approve: boolean;
  note: string;
  percent?: string | number;
  reason?: string;
  readReason?: boolean;
}

export function decideReview(
  d: ContractDraft,
  role: UserRole,
  { approve, note, percent, reason, readReason }: ReviewDecisionInput
): void {
  const expected = d.credit.status === 'pending' ? 'inspector' : d.credit.status === 'pending2' ? 'inspector2' : null;
  if (!expected || role !== expected || d.openedAt) throw new Error('บทบาทนี้พิจารณาระดับดังกล่าวไม่ได้');
  if (!historyComplete(d)) throw new Error('ความยินยอมหรือรายงานเปลี่ยน กรุณาตรวจประวัติใหม่');
  if (!present(note)) throw new Error('กรุณาใส่หมายเหตุ');
  if (
    approve &&
    (!readReason || !present(percent) || !Number.isFinite(+percent!) || +percent! < 0 || +percent! > 100)
  ) {
    throw new Error('อ่านเหตุผลและระบุเปอร์เซ็นต์รับ 0–100');
  }
  if (approve && +percent! === 100 && !present(reason)) throw new Error('รับ 100% ต้องระบุเหตุผลประกอบ');

  const level = d.credit.status === 'pending' ? 1 : 2;
  d.credit.decisions.push({
    level,
    approve,
    note,
    percent: approve ? +percent! : null,
    reason: reason || '',
    at: new Date().toISOString(),
  });
  d.credit.note = note;
  d.credit.status = !approve ? 'rejected' : level === 1 && d.credit.requiresLevel2 ? 'pending2' : 'approved';
}

export function submit(d: ContractDraft): ContractDraft {
  if (d.submittedAt || d.soldAt || d.openedAt) throw new Error('รายการนี้ส่งทำขายแล้ว');
  if (!checklist(d, 'sale').every((c) => c.ok)) throw new Error('ข้อมูลยังไม่ครบ กรุณาตรวจรายการที่ขาด');
  d.submittedAt = new Date().toISOString();
  return d;
}

export function recordSale(d: ContractDraft, saleDate: string = localDay()): ContractDraft {
  if (!d.submittedAt || d.soldAt || d.openedAt || !checklist(d, 'sale').every((c) => c.ok)) {
    throw new Error('รายการยังไม่พร้อมรับผลขาย');
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) ||
    !Number.isFinite(Date.parse(saleDate)) ||
    new Date(saleDate).toISOString().slice(0, 10) !== saleDate
  ) {
    throw new Error('วันขายไม่ถูกต้อง');
  }
  d.soldAt = new Date().toISOString();
  d.saleDate = saleDate;
  d.saleRef = 'DEMO-SALE-' + d.id.slice(-6);
  d.barcode = 'DEMO-ITEM-001';
  if (checklist(d, 'opening').every((c) => c.ok)) {
    d.openedAt = new Date().toISOString();
  }
  return d;
}

export function openContract(d: ContractDraft): ContractDraft {
  if (!d.soldAt || !d.saleRef || d.openedAt) throw new Error('ต้องมีผลขายและเลขที่ขายก่อนเปิดสัญญา');
  if (!checklist(d, 'opening').every((c) => c.ok)) throw new Error('ข้อมูลเปิดสัญญายังไม่ครบ กรุณาตรวจ Checklist');
  d.openedAt = new Date().toISOString();
  return d;
}

export function demoImage(label: string, color = '#c92327'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="600" height="360" rx="24" fill="#f4f1ee"/><rect x="24" y="24" width="552" height="312" rx="16" fill="white" stroke="#e7dfd9"/><circle cx="300" cy="130" r="48" fill="${color}" opacity=".13"/><path d="M276 130h48m-24-24v48" stroke="${color}" stroke-width="5"/><text x="300" y="230" text-anchor="middle" font-family="sans-serif" font-size="27" fill="#252525">${label}</text><text x="300" y="285" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#888">DEMO • NOT A REAL DOCUMENT</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function seeds(): ContractDraft[] {
  const a = makeDraft('DEMO-202610-001');
  Object.assign(a.buyer, {
    id: 'DEMO-ID-001',
    first: 'ธนกร',
    last: 'ใจดี',
    birth: '1995-05-14',
    gender: 'ชาย',
    phone: 'DEMO-PHONE',
    marital: 'โสด',
    homeType: 'บ้านตนเอง',
    address: '88/14 หมู่ 3 (ข้อมูลสมมติ)',
    province: 'นนทบุรี',
    district: 'เมืองนนทบุรี',
    subdistrict: 'บางกระสอ',
    postcode: '11000',
    job: 'พนักงานบริษัท',
    company: 'บริษัท ตัวอย่าง จำกัด',
    position: 'เจ้าหน้าที่',
    tenure: '3 ปี',
    income: 22000,
    workAddress: '99 ถนนตัวอย่าง นนทบุรี (ข้อมูลสมมติ)',
  });
  Object.assign(a.guarantor, {
    id: 'DEMO-CO-001',
    first: 'มาลี',
    last: 'ใจดี',
    phone: 'DEMO-CO-PHONE',
    relation: 'พี่น้อง',
    address: 'ที่อยู่ผู้ค้ำสมมติ นนทบุรี',
    job: 'ค้าขาย',
    income: 18000,
    workAddress: 'ร้านค้าสมมติ นนทบุรี',
  });
  Object.assign(a.terms, {
    product: 'โทรศัพท์มือถือ รุ่นตัวอย่าง 128 GB',
    qty: 1,
    price: 18000,
    down: 1500,
    principal: 16500,
    months: 11,
    monthly: 1500,
    firstDue: '',
    dueDay: 29,
  });
  Object.assign(a.location, {
    lat: 13.85,
    lng: 100.51,
    landmark: 'บ้านตัวอย่างหลังมุม ใกล้ร้านค้า (ข้อมูลสมมติ)',
  });
  a.pageGroup = 'เพจสาขาตัวอย่าง';
  a.financeStaff = 'สินเชื่อตัวอย่าง';
  a.consent = true;
  a.ocrConfirmed = true;
  a.credit.status = 'normal';

  for (const who of ['buyer', 'guarantor'] as const) {
    a.identities[who] = { confirmed: true, method: 'readcard', history: 'unchecked', report: null };
    inspectDemoHistory(a, who, 'normal', a.owner);
  }

  for (const [key, label] of [
    ['id', 'บัตรจำลอง'],
    ['buyer', 'ผู้ซื้อจำลอง'],
    ['guarantorId', 'บัตรผู้ค้ำจำลอง'],
    ['guarantor', 'ผู้ค้ำจำลอง'],
  ] as const) {
    a.photos[key] = [{ id: key, src: demoImage(label), name: label, at: a.createdAt, by: a.owner, demo: true }];
  }

  a.photos.place = Array.from({ length: 5 }, (_, i) => ({
    id: 'place' + i,
    src: demoImage('จุดติดตาม ' + (i + 1)),
    name: 'GPS สาธิต ' + (i + 1),
    at: a.createdAt,
    by: a.owner,
    demo: true,
  }));
  a.history = [
    { at: a.createdAt, text: 'ร่างผ่านการตรวจสาธิต พร้อมทำขาย • รูปรับสินค้าเพิ่มก่อนเปิดสัญญา', by: a.owner },
  ];

  const b = JSON.parse(JSON.stringify(a)) as ContractDraft;
  b.id = 'DEMO-202610-002';
  b.buyer.first = 'สมชาย';
  inspectDemoHistory(b, 'buyer', 'normal', b.owner);
  submit(b);
  recordSale(b);

  const first = new Date(b.saleDate + 'T12:00:00');
  first.setDate(first.getDate() + 35);
  b.terms.firstDue = localDay(first);
  b.terms.dueDay = first.getDate();
  b.photos.delivery = [
    {
      id: 'delivery2',
      src: demoImage('รับสินค้าจำลอง', '#188657'),
      name: 'รับสินค้า (สาธิต)',
      at: a.createdAt,
      by: a.owner,
      demo: true,
    },
  ];
  b.history = [{ at: b.soldAt!, text: 'รับผลขายพร้อมเลขที่ขาย (จำลอง) • รอตรวจและเปิดสัญญา', by: b.owner }];

  const c = JSON.parse(JSON.stringify(a)) as ContractDraft;
  c.id = 'DEMO-202610-003';
  c.buyer.first = 'กมล';
  inspectDemoHistory(c, 'buyer', 'installment', c.owner);
  requestReview(c, 'ตัวอย่างผลตรวจโทรศัพท์ซ้ำ • ผลวงเงิน/โควตาจำลองต้องตรวจระดับ 2', true);
  c.history = [{ at: c.createdAt, text: 'ส่งตรวจระดับ 1 (จำลอง) • ต้องตรวจต่อระดับ 2', by: c.owner }];

  return [a, b, c];
}
