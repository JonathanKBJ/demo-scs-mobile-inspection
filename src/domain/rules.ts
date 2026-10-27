import type { ContractDraft, ChecklistItem, ContractStatus } from '../types/contract';
import { firstDueDays } from './calculations';
import { financeDocumentsComplete } from './financeDocuments';

export const STEPS = [
  'ตัวตน / ประวัติ',
  'ผู้เช่าซื้อและที่อยู่',
  'การงานและรายได้',
  'ผู้ค้ำประกัน',
  'สินค้าและงวดผ่อน',
  'พิกัดติดตาม',
  'รูปหลักฐาน',
  'เอกสารและการยืนยัน',
  'ตรวจความครบถ้วน',
] as const;

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export const usesGuarantor = (d: ContractDraft): boolean => d.contractType !== 'CASH';

export const editable = (d: ContractDraft): boolean =>
  !d.openedAt && d.credit.status !== 'rejected' && (!d.submittedAt || Boolean(d.soldAt));

export const photoLimit = (key: string): number => (key === 'place' ? 10 : 4);

export const present = (x: unknown): boolean => String(x ?? '').trim().length > 0;

export const identityComplete = (d: ContractDraft, who: 'buyer' | 'guarantor'): boolean =>
  d.identities[who].confirmed &&
  ['readcard', 'previous', 'ocr'].includes(d.identities[who].method) &&
  ['id', 'first', 'last'].every((k) => present(d[who][k as keyof typeof d[typeof who]]));

export function historyReportMatches(d: ContractDraft, who: 'buyer' | 'guarantor'): boolean {
  const report = d.identities[who].report;
  const person = d[who];
  return Boolean(
    report && report.source === 'demo' && identityComplete(d, who) &&
    report.personId === person.id &&
    report.personName === [person.title, person.first, person.last].filter(Boolean).join(' ') &&
    ['none', 'normal', 'installment', 'bad_debt', 'unknown'].includes(report.risk) &&
    Array.isArray(report.contracts) && Array.isArray(report.scans) &&
    d.identities[who].history === (['none', 'normal'].includes(report.risk) ? 'normal' : 'review')
  );
}

export const historyComplete = (d: ContractDraft): boolean =>
  d.consent &&
  identityComplete(d, 'buyer') &&
  (!usesGuarantor(d) || (identityComplete(d, 'guarantor') && d.buyer.id !== d.guarantor.id)) &&
  (['buyer', ...(usesGuarantor(d) ? (['guarantor'] as const) : [])] as const).every((w) =>
    historyReportMatches(d, w)
  );

export function materialSnapshot(d: ContractDraft): string {
  return JSON.stringify({
    type: d.contractType,
    buyer: [d.buyer.first, d.buyer.last, d.buyer.id],
    guarantor: d.guarantor,
    terms: d.terms,
  });
}

export function signedChanged(d: ContractDraft): boolean {
  return Boolean(d.signedSnapshot && d.signedSnapshot !== materialSnapshot(d));
}

export function checklist(d: ContractDraft, phase: 'sale' | 'opening' = d.soldAt ? 'opening' : 'sale'): ChecklistItem[] {
  const b = d.buyer;
  const g = d.guarantor;
  const t = d.terms;
  const l = d.location;
  const opening = phase === 'opening';
  const documentsComplete = financeDocumentsComplete(d);

  const current =
    b.currentSame ||
    (['currentAddress', 'currentProvince', 'currentDistrict', 'currentSubdistrict', 'currentPostcode'] as const).every(
      (k) => present(b[k])
    );

  const identity =
    historyComplete(d) &&
    ['normal', 'approved'].includes(d.credit.status) &&
    (['phone', 'birth', 'gender'] as const).every((k) => present(b[k]));

  const terms =
    (['product', 'price', 'principal', 'months', 'monthly'] as const).every((k) => present(t[k])) &&
    Number(t.price) > 0 &&
    Number(t.principal) > 0 &&
    Number.isInteger(+t.months) &&
    +t.months > 0 &&
    +t.monthly > 0 &&
    +t.down >= 0;

  const requirements: Array<[string, string, number]> = [
    ['บัตรผู้ซื้อ', 'id', 1],
    ['ภาพผู้ซื้อ', 'buyer', 1],
    ['รูปจุดติดตาม GPS', 'place', 5],
    ['ภาพรับสินค้า', 'delivery', 1],
  ];

  if (usesGuarantor(d)) {
    requirements.push(['บัตรผู้ค้ำ', 'guarantorId', 1], ['ภาพผู้ค้ำ', 'guarantor', 1]);
  }

  const missing = requirements
    .filter(([, key, count]) => (d.photos[key]?.length || 0) < count)
    .map(([name, key, count]) => `${name} ${d.photos[key]?.length || 0}/${count}`);

  const days = firstDueDays(d);
  const due =
    Number.isFinite(days) &&
    days >= 30 &&
    days <= 40 &&
    Number.isInteger(+t.dueDay) &&
    +t.dueDay >= 1 &&
    +t.dueDay <= 31;

  let identityDetail = 'ผู้เกี่ยวข้องยืนยันตัวตนและผ่านการพิจารณาแล้ว';
  if (!identity) {
    const parts: string[] = [];
    if (!d.consent) parts.push('ยังไม่รับทราบข้อตกลงสาธิต');
    if (!d.identities?.buyer?.confirmed) parts.push('ยังไม่ยืนยันตัวตนผู้ซื้อ');
    if (usesGuarantor(d) && !d.identities?.guarantor?.confirmed) parts.push('ยังไม่ยืนยันตัวตนผู้ค้ำ');
    if (d.identities?.buyer?.history === 'unchecked') parts.push('ยังไม่ตรวจประวัติผู้ซื้อ');
    if (usesGuarantor(d) && d.identities?.guarantor?.history === 'unchecked') parts.push('ยังไม่ตรวจประวัติผู้ค้ำ');
    if (!['normal', 'approved'].includes(d.credit?.status)) {
      if (d.credit?.status?.startsWith('pending')) parts.push('รอผลอนุมัติสินเชื่อ');
      else parts.push('รอผลตรวจ/อนุมัติประวัติ');
    }
    if (!present(b.phone)) parts.push('เบอร์โทรผู้ซื้อ');
    if (!present(b.birth)) parts.push('วันเกิดผู้ซื้อ');
    if (!present(b.gender)) parts.push('เพศผู้ซื้อ');
    identityDetail = parts.length ? 'ยังขาด: ' + parts.join(' • ') : 'ยืนยันตัวตน ตรวจประวัติผู้ซื้อ/ผู้ค้ำ และรอผลอนุมัติให้ครบ';
  }

  return [
    { label: 'ตัวตนและผลพิจารณา', step: 0, ok: identity, detail: identityDetail },
    {
      label: 'ข้อมูลติดต่อและที่อยู่',
      step: 1,
      ok:
        (['address', 'province', 'district', 'subdistrict', 'postcode', 'marital', 'homeType'] as const).every((k) =>
          present(b[k])
        ) && current,
      detail: 'ที่อยู่ตามบัตร ที่อยู่ปัจจุบัน และข้อมูลติดต่อ',
    },
    {
      label: 'การงานและรายได้',
      step: 2,
      ok: (['job', 'company', 'income', 'workAddress'] as const).every((k) => present(b[k])) && +b.income > 0,
      detail: 'อาชีพ ฐานรายได้ และที่อยู่ที่ทำงาน',
    },
    {
      label: 'ผู้ค้ำประกัน',
      step: 3,
      ok:
        !usesGuarantor(d) ||
        (['id', 'first', 'last', 'phone', 'relation', 'address', 'job', 'income', 'workAddress'] as const).every((k) =>
          present(g[k])
        ),
      detail: usesGuarantor(d)
        ? 'รายการปกติต้องมีข้อมูลและผลตรวจผู้ค้ำ'
        : 'สดพิเศษ: ใช้ข้อยกเว้นผู้ค้ำในขั้นตรวจร่าง',
    },
    {
      label: 'ข้อมูลร่างและเงื่อนไข',
      step: 4,
      ok: terms && (['pageGroup', 'owner', 'financeStaff'] as const).every((k) => present(d[k])),
      detail: 'สินค้า ยอด งวด กลุ่มเพจ พนักงานขาย และพนักงานสินเชื่อ',
    },
    {
      label: 'พิกัดสถานที่ติดตาม',
      step: 5,
      ok:
        !opening ||
        (present(l.lat) &&
          present(l.lng) &&
          present(l.landmark) &&
          Number.isFinite(+l.lat) &&
          Number.isFinite(+l.lng) &&
          Math.abs(+l.lat) <= 90 &&
          Math.abs(+l.lng) <= 180),
      detail: opening ? 'ตรวจพิกัดก่อนเปิดสัญญา' : 'เตรียมไว้ก่อนได้ • ตรวจบังคับก่อนเปิดสัญญาหลังทำขาย',
    },
    {
      label: 'รูปภาพและหลักฐาน',
      step: 6,
      ok: !opening || missing.length === 0,
      detail: opening
        ? missing.length
          ? 'ขาด ' + missing.join(', ')
          : 'หลักฐานครบ รวมรูป GPS อย่างน้อย 5 รูป'
        : 'เตรียมไว้ก่อนได้ • ตรวจหลักฐานและรูป GPS 5 รูปก่อนเปิดสัญญา',
    },
    {
      label: 'เอกสารและการยืนยัน',
      step: 7,
      ok: documentsComplete,
      detail: documentsComplete
        ? 'ยืนยันเอกสารทั้ง 4 รายการตามข้อมูลปัจจุบันแล้ว (สาธิต ไม่ใช่ลายเซ็นจริง)'
        : 'อ่านและยืนยันเอกสารทั้ง 4 รายการใหม่เมื่อข้อมูลหรือรุ่นเอกสารเปลี่ยน',
    },
    {
      label: 'วันชำระงวดแรก',
      step: 4,
      ok: !opening || due,
      detail: opening
        ? due
          ? `ห่างจากวันขาย ${days} วัน`
          : 'ต้องห่างวันขาย 30–40 วัน และระบุวันชำระประจำงวด'
        : 'ตรวจช่วง 30–40 วันอีกครั้งเมื่อมีวันขายจริง',
    },
  ];
}

export function status(d: ContractDraft): ContractStatus {
  if (d.openedAt) return { key: 'opened', label: 'FINISH · เปิดสัญญาแล้ว', tone: 'green' };
  if (d.credit.status === 'rejected') return { key: 'cancelled', label: 'CANCEL · ยกเลิกร่าง', tone: 'red' };
  if (d.credit.status === 'pending2') return { key: 'pending2', label: 'INSPECT_2 · รอตรวจระดับ 2', tone: 'amber' };
  if (d.credit.status === 'pending') return { key: 'pending', label: 'INSPECT · รอตรวจระดับ 1', tone: 'amber' };
  if (d.soldAt) return { key: 'sold', label: 'SELL · รอเปิดสัญญา', tone: 'blue' };
  if (d.submittedAt) return { key: 'submitted', label: 'WAIT · รอผลทำขาย', tone: 'blue' };
  if (checklist(d, 'sale').every((c) => c.ok)) return { key: 'ready', label: 'WAIT · พร้อมทำขาย', tone: 'green' };
  return { key: 'draft', label: 'ร่าง · ต้องทำต่อ', tone: 'amber' };
}

export function invalidateReview(d: ContractDraft, person?: 'buyer' | 'guarantor'): void {
  if (person) {
    d.identities[person].confirmed = false;
    d.identities[person].history = 'unchecked';
    d.identities[person].report = null;
    if (person === 'buyer') d.ocrConfirmed = false;
  }
  d.credit = {
    ...d.credit,
    status: 'unchecked',
    reason: 'ข้อมูลเปลี่ยน กรุณาประเมินผลตรวจใหม่',
    note: '',
    requiresLevel2: false,
    decisions: [],
  };
}

export function resetReviewFromReports(d: ContractDraft): void {
  invalidateReview(d);
  if (historyComplete(d) &&
    (['buyer', ...(usesGuarantor(d) ? (['guarantor'] as const) : [])] as const).every(
      (who) => d.identities[who].history === 'normal'
    )) {
    d.credit.status = 'normal';
    d.credit.reason = '';
  }
}
