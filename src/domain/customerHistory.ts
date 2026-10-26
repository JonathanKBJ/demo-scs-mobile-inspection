export type HistoryPerson = 'buyer' | 'guarantor';
export type HistoryScenario = 'normal' | 'installment' | 'bad_debt' | 'no_history' | 'staff' | 'error';
export type HistoryRisk = 'none' | 'normal' | 'installment' | 'bad_debt' | 'unknown';

export interface HistoryTerm {
  number: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  dueAmount: number;
  paidAmount: number;
}

export interface HistoricalContract {
  id: string;
  code: string;
  signedDate: string;
  shopName: string;
  status: string;
  score: number | null;
  product: string;
  serialNumber: string;
  paymentPrice: number;
  totalPaid: number;
  balance: number;
  terms: HistoryTerm[];
}

export interface HistoryScan {
  name: string;
  scannedAt: string;
  displayName: string;
  method: 'READCARDMOBILE' | 'NOTREADCARD';
}

export interface HistoryEmployee {
  shop: string;
  department: string;
  startedAt: string;
  endedAt: string | null;
}

export interface PersonHistoryReport {
  source: 'demo';
  checkedAt: string;
  checkedBy: string;
  personId: string;
  personName: string;
  phone: string;
  cardAddress: string;
  currentAddress: string;
  workAddress: string;
  risk: HistoryRisk;
  score: number | null;
  contracts: HistoricalContract[];
  scans: HistoryScan[];
  employee: HistoryEmployee | null;
}

export const historyScenarios: readonly { value: HistoryScenario; label: string }[] = [
  { value: 'normal', label: 'สาธิต: ประวัติปกติ / ปิดสัญญา' },
  { value: 'installment', label: 'สาธิต: ติดผ่อน / ชำระบางส่วน / ค้างชำระ' },
  { value: 'bad_debt', label: 'สาธิต: ลูกหนี้เสีย' },
  { value: 'no_history', label: 'สาธิต: ไม่มีประวัติ' },
  { value: 'staff', label: 'สาธิต: พนักงาน' },
  { value: 'error', label: 'สาธิต: บริการขัดข้อง' },
];

export function historyRiskLabel(risk: HistoryRisk, canInspect = true): string {
  if (!canInspect) {
    switch (risk) {
      case 'none':
      case 'normal': return 'ขายได้';
      case 'installment': return 'ขายไม่ได้(ติดผ่อน)';
      case 'bad_debt': return 'ขายไม่ได้(ลูกหนี้เสีย)';
      default: return 'ไม่ทราบผล';
    }
  }
  switch (risk) {
    case 'none': return 'ไม่มีประวัติ';
    case 'normal': return 'ปกติ';
    case 'installment': return 'ติดผ่อน';
    case 'bad_debt': return 'ลูกหนี้เสีย';
    default: return 'ไม่ทราบผล';
  }
}

const contractLabels: Record<string, string> = {
  NORMAL: 'ปกติ', DEBT: 'ค้างชำระ', CLOSE_CANCEL: 'ปิด/ยกเลิก',
  CLOSE_NORMAL: 'ปิด/ปกติ', CLOSE_RETURN: 'ปิด/คืนของ',
  CLOSE_CONFISCATE: 'ปิด/ยึดคืนของ', CLOSE_BAD_DEBT: 'ปิด/หนี้สูญ',
  CLOSE_CHANGE: 'ปิด/เปลี่ยนของ', CA_NORMAL: 'CA ปกติ', CA_DEBT: 'CA ค้างชำระ',
  CA_CLOSE: 'ปิด/CA', CA_CONFISCATE: 'ปิดCA/ยึดคืนของ',
  CA_CLOSE_BAD_DEBT: 'ปิด/หนี้สูญ CA', CLOSE_RETURN_PRODUCT: 'ปิด/ลูกค้าคืนสินค้า',
};

export function contractStatusLabel(status: string): string {
  return Object.prototype.hasOwnProperty.call(contractLabels, status)
    ? contractLabels[status] : `ไม่ทราบสถานะ (${status || 'ไม่มีรหัส'})`;
}

// Accept ISO calendar dates only; Date.parse alone silently normalizes impossible dates.
function dateMillis(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(0, 0, 0, 0);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export type HistoryTermTone = 'paid' | 'waiting' | 'partial' | 'overduePartial' | 'overdue' | 'late3' | 'late15' | 'late30' | 'late60' | 'lateOver60' | 'unknown';

export function termStatusTone(term: HistoryTerm): HistoryTermTone {
  const due = dateMillis(term.dueDate);
  const paid = term.paidDate === null ? null : dateMillis(term.paidDate);
  if (due === null || (term.paidDate !== null && paid === null)) return 'unknown';
  switch (term.status) {
    case 'WAIT': return 'waiting';
    case 'WAIT_PARTIAL': return 'partial';
    case 'OVERDUE_PARTIAL': return 'overduePartial';
    case 'OVERDUE': return 'overdue';
    case 'WAIT_PAID': return paid === null || paid > due ? 'unknown' : 'paid';
    case 'OVERDUE_PAID': {
      if (paid === null || paid <= due) return 'unknown';
      const days = (paid - due) / 86_400_000;
      if (days <= 3) return 'late3';
      if (days <= 15) return 'late15';
      if (days <= 30) return 'late30';
      if (days <= 60) return 'late60';
      return 'lateOver60';
    }
    default: return 'unknown';
  }
}

export function termStatusLabel(term: HistoryTerm): string {
  const tone = termStatusTone(term);
  const labels: Record<HistoryTermTone, string> = {
    paid: 'ชำระแล้ว', waiting: 'รอชำระ', partial: 'ชำระบางส่วน', overdue: 'ค้างชำระ',
    overduePartial: 'ค้างชำระ / ชำระบางส่วน',
    late3: 'ชำระช้าไม่เกิน 3 วัน', late15: 'ชำระช้า 4–15 วัน',
    late30: 'ชำระช้า 16–30 วัน', late60: 'ชำระช้า 31–60 วัน',
    lateOver60: 'ชำระช้าเกิน 60 วัน', unknown: 'ไม่ทราบสถานะ / วันที่ไม่สมบูรณ์',
  };
  return labels[tone];
}

export function createDemoHistory(
  who: HistoryPerson,
  scenario: HistoryScenario,
  person: { id: string; name: string; phone: string; cardAddress: string; currentAddress: string; workAddress: string },
  at: string,
  by: string,
): PersonHistoryReport {
  if (scenario === 'error') throw new Error('บริการตรวจสอบประวัติสาธิตขัดข้อง กรุณาลองใหม่ (ไม่ได้เชื่อมต่อระบบจริง)');
  const timestamp = dateMillis(at);
  if (timestamp === null) throw new Error('วันเวลาตรวจสอบประวัติสาธิตไม่ถูกต้อง');
  const day = (offset: number) => new Date(timestamp + offset * 86_400_000).toISOString();
  const term = (number: number, offset: number, status: string, paidAmount: number, lateDays = 0): HistoryTerm => ({
    number, dueDate: day(offset), paidDate: paidAmount > 0 ? day(offset + lateDays) : null,
    status, dueAmount: 1000, paidAmount,
  });
  const contract = (status: string, index: number, terms: HistoryTerm[]): HistoricalContract => {
    const total = terms.reduce((sum, item) => sum + item.dueAmount, 0);
    const paid = terms.reduce((sum, item) => sum + item.paidAmount, 0);
    return {
      id: `DEMO-${who}-${scenario}-${index + 1}`, code: `DEMO-${who === 'buyer' ? 'B' : 'G'}-${String(index + 1).padStart(3, '0')}`,
      signedDate: day(-450 - index * 30), shopName: 'สาขาตัวอย่าง (ข้อมูลสาธิต)', status,
      score: (scenario === 'bad_debt' ? 25 : scenario === 'installment' ? 61 : 88) - index * 3, product: 'เครื่องใช้ไฟฟ้าตัวอย่าง (สาธิต)',
      serialNumber: `DEMO-SN-${who}-${index + 1}`, paymentPrice: total, totalPaid: paid,
      balance: total - paid, terms,
    };
  };
  let contracts: HistoricalContract[] = [];
  if (scenario === 'normal' || scenario === 'staff') {
    const statuses = ['CLOSE_NORMAL', 'CLOSE_CANCEL', 'CLOSE_RETURN', 'CLOSE_CHANGE', 'CLOSE_RETURN_PRODUCT'];
    contracts = statuses.map((status, index) => contract(status, index, [
      term(1, -400 - index * 30, 'WAIT_PAID', 1000),
      term(2, -370 - index * 30, 'OVERDUE_PAID', 1000, [2, 10, 20, 45, 75][index % 5]),
    ]));
  } else if (scenario === 'installment') {
    contracts = ['NORMAL', 'DEBT', 'CA_NORMAL', 'CA_DEBT'].map((status, index) => contract(status, index,
      status === 'DEBT' || status === 'CA_DEBT' ? [
        term(1, -120, 'WAIT_PAID', 1000), term(2, -90, 'OVERDUE_PAID', 1000, 10),
        term(3, -60, 'OVERDUE_PARTIAL', 400, 5), term(4, -30, 'OVERDUE', 0),
        term(5, 15, 'WAIT_PARTIAL', 200, -20), term(6, 45, 'WAIT', 0),
      ] : [
        term(1, -120, 'WAIT_PAID', 1000), term(2, -90, 'WAIT_PAID', 1000),
        term(3, -60, 'WAIT_PAID', 1000), term(4, -30, 'WAIT_PAID', 1000),
        term(5, 15, 'WAIT_PARTIAL', 200, -20), term(6, 45, 'WAIT', 0),
      ],
    ));
  } else if (scenario === 'bad_debt') {
    contracts = ['CLOSE_BAD_DEBT', 'CA_CLOSE_BAD_DEBT', 'CLOSE_CONFISCATE', 'CA_CONFISCATE'].map((status, index) => contract(status, index, [
      term(1, -240, 'OVERDUE_PAID', 1000, 75), term(2, -210, 'OVERDUE_PARTIAL', 300, 20),
      term(3, -180, 'OVERDUE', 0),
    ]));
  }
  return {
    source: 'demo', checkedAt: at, checkedBy: by, personId: person.id, personName: person.name,
    phone: person.phone,
    cardAddress: person.cardAddress || (scenario === 'no_history' ? '' : 'ที่อยู่ตามบัตรเดิม: 1 ถนนตัวอย่าง เขตสาธิต (ข้อมูลสมมติ)'),
    currentAddress: person.currentAddress || (scenario === 'no_history' ? '' : 'ที่อยู่ปัจจุบันเดิม: 2 ถนนตัวอย่าง เขตสาธิต (ข้อมูลสมมติ)'),
    workAddress: person.workAddress || (scenario === 'no_history' ? '' : 'ที่ทำงานเดิม: 3 อาคารตัวอย่าง เขตสาธิต (ข้อมูลสมมติ)'),
    risk: scenario === 'no_history' ? 'none' : scenario === 'bad_debt' ? 'bad_debt' : scenario === 'installment' ? 'installment' : 'normal',
    score: contracts[0]?.score ?? null,
    contracts,
    scans: scenario === 'no_history' ? [] : [
      { name: person.name, scannedAt: day(-1), displayName: 'พนักงานตัวอย่าง ก (สาธิต)', method: 'READCARDMOBILE' },
      { name: person.name, scannedAt: day(-35), displayName: 'พนักงานตัวอย่าง ข (สาธิต)', method: 'NOTREADCARD' },
    ],
    employee: scenario === 'staff' ? {
      shop: 'สาขาตัวอย่าง (สาธิต)', department: 'ฝ่ายขายตัวอย่าง (สาธิต)', startedAt: day(-730), endedAt: null,
    } : null,
  };
}
