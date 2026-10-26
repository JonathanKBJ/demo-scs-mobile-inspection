import { describe, test, expect } from 'vitest';
import {
  seeds,
  makeDraft,
  migrateDraft,
  submit,
  setContractType,
  confirmDemoIdentity,
  inspectDemoHistory,
  requestReview,
  decideReview,
  recordSale,
  openContract,
} from './workflow';
import {
  checklist,
  editable,
  status,
  usesGuarantor,
  invalidateReview,
  photoLimit,
} from './rules';
import {
  schedule,
  firstDueDays,
  autoCalculateTerms,
} from './calculations';
import type { ReviewDecisionInput } from './workflow';
import { termStatusTone, termStatusLabel, contractStatusLabel } from './customerHistory';

const decision: ReviewDecisionInput = {
  approve: true,
  note: 'review complete',
  percent: '50',
  reason: '',
  readReason: true,
};

describe('Siamchai DCR Workflow & Domain Rules', () => {
  test('normal guarantor gate and cash exception', () => {
    const d = seeds()[0];
    d.guarantor.required = false;
    d.guarantor.id = '';
    expect(usesGuarantor(d)).toBe(true);
    expect(() => submit(d)).toThrow();
    setContractType(d, 'CASH');
    expect(d.credit.status).toBe('normal');
    expect(() => submit(d)).not.toThrow();
    expect(() => setContractType(d, 'NORMAL')).toThrow();
  });

  test('type changes reuse normal reports but never retain flagged approvals', () => {
    const normal = seeds()[0];
    const buyerReport = normal.identities.buyer.report;
    const guarantorReport = normal.identities.guarantor.report;
    setContractType(normal, 'CASH');
    expect(normal.credit.status).toBe('normal');
    expect(checklist(normal)[0].ok).toBe(true);
    setContractType(normal, 'NORMAL');
    expect(normal.credit.status).toBe('normal');
    expect(checklist(normal)[0].ok).toBe(true);
    expect(normal.identities.buyer.report).toBe(buyerReport);
    expect(normal.identities.guarantor.report).toBe(guarantorReport);

    const missingGuarantor = seeds()[0];
    setContractType(missingGuarantor, 'CASH');
    invalidateReview(missingGuarantor, 'guarantor');
    inspectDemoHistory(missingGuarantor, 'buyer', 'normal', 'test');
    expect(missingGuarantor.credit.status).toBe('normal');
    setContractType(missingGuarantor, 'NORMAL');
    expect(missingGuarantor.credit.status).toBe('unchecked');
    expect(checklist(missingGuarantor)[0].ok).toBe(false);

    const flagged = seeds()[2];
    decideReview(flagged, 'inspector', decision);
    decideReview(flagged, 'inspector2', decision);
    expect(flagged.credit.status).toBe('approved');
    setContractType(flagged, 'CASH');
    expect(flagged.credit.status).toBe('unchecked');
    expect(flagged.credit.decisions).toEqual([]);
    expect(flagged.credit.requiresLevel2).toBe(false);
    expect(checklist(flagged)[0].ok).toBe(false);
    requestReview(flagged, 'review for changed contract type');
    expect(flagged.credit.status).toBe('pending');
  });

  test('sale defers GPS delivery and due date; opening checks five photos', () => {
    const d = seeds()[0];
    d.photos.place = [];
    d.location.lat = '';
    submit(d);
    expect(status(d).key).toBe('submitted');
    recordSale(d, '2026-10-22');
    expect(status(d).key).toBe('sold');
    expect(() => openContract(d)).toThrow();
    const b = seeds()[1];
    b.photos.place.pop();
    expect(() => openContract(b)).toThrow();
    b.photos.place.push({
      id: 'demo-place',
      src: 'demo',
      name: 'demo',
      at: new Date().toISOString(),
      by: 'test',
    });
    openContract(b);
    expect(status(b).key).toBe('opened');
    expect(b.notificationStatus).toBe('not_sent');
    expect(photoLimit('place')).toBeGreaterThanOrEqual(5);
  });

  test('first due 30 to 40 days inclusive and valid calendar dates', () => {
    const dates: Array<[string, boolean]> = [
      ['2026-11-20', false],
      ['2026-11-21', true],
      ['2026-12-01', true],
      ['2026-12-02', false],
    ];
    for (const [date, pass] of dates) {
      const d = seeds()[1];
      d.saleDate = '2026-10-22';
      d.terms.firstDue = date;
      const openingChecks = checklist(d, 'opening');
      expect(openingChecks[openingChecks.length - 1].ok).toBe(pass);
    }
    const d = seeds()[0];
    submit(d);
    expect(() => recordSale(d, '2026-02-31')).toThrow();
    d.saleDate = '2026-01-31';
    d.terms.firstDue = '2026-02-31';
    expect(Number.isNaN(firstDueDays(d))).toBe(true);
  });

  test('sale and opening require earlier states and cannot repeat', () => {
    const d = seeds()[0];
    expect(() => recordSale(d)).toThrow();
    expect(() => openContract(d)).toThrow();
    submit(d);
    expect(() => submit(d)).toThrow();
    recordSale(d);
    expect(() => recordSale(d)).toThrow();
    const b = seeds()[1];
    openContract(b);
    expect(() => openContract(b)).toThrow();
    expect(() => submit(makeDraft('EMPTY'))).toThrow();
  });

  test('both people need verified identity and history; reopening rechecks GPS and gender', () => {
    const d = seeds()[0];
    invalidateReview(d, 'guarantor');
    expect(() => submit(d)).toThrow();
    expect(() => inspectDemoHistory(d, 'guarantor', 'normal', 'test')).toThrow();
    expect(() => requestReview(d, 'reason')).toThrow();
    d.credit.status = 'normal';
    expect(() => submit(d)).toThrow();
    const b = seeds()[1];
    b.location.lat = 100;
    expect(() => openContract(b)).toThrow();
    b.location.lat = 13.8;
    b.buyer.gender = '';
    expect(() => openContract(b)).toThrow();
  });

  test('two levels require correct roles and pending cannot bypass', () => {
    const d = seeds()[2];
    expect(() => decideReview(d, 'sales', decision)).toThrow();
    expect(() => decideReview(d, 'inspector2', decision)).toThrow();
    expect(() => inspectDemoHistory(d, 'buyer', 'normal', 'test')).toThrow();
    decideReview(d, 'inspector', decision);
    expect(status(d).key).toBe('pending2');
    expect(() => submit(d)).toThrow();
    expect(() => decideReview(d, 'inspector', decision)).toThrow();
    decideReview(d, 'inspector2', decision);
    expect(d.credit.decisions.length).toBe(2);
    submit(d);
    const single = seeds()[0];
    requestReview(single, 'review');
    decideReview(single, 'inspector', decision);
    expect(status(single).key).toBe('ready');
  });

  test('approval read reason note percent and 100 percent reason gate', () => {
    const patches: Array<Partial<ReviewDecisionInput>> = [
      { readReason: false },
      { percent: '' },
      { percent: '101' },
      { note: '' },
      { percent: '100' },
    ];
    for (const patch of patches) {
      const d = seeds()[2];
      expect(() => decideReview(d, 'inspector', { ...decision, ...patch })).toThrow();
      expect(d.credit.status).toBe('pending');
    }
    const d = seeds()[2];
    decideReview(d, 'inspector', { ...decision, percent: '100', reason: 'accepted reason' });
  });

  test('rejection cancels and identity change invalidates approval', () => {
    const d = seeds()[2];
    decideReview(d, 'inspector', { approve: false, note: 'rejected' });
    expect(status(d).key).toBe('cancelled');
    expect(() => submit(d)).toThrow();
    expect(() => decideReview(d, 'inspector', decision)).toThrow();
    const b = seeds()[2];
    decideReview(b, 'inspector', decision);
    decideReview(b, 'inspector2', decision);
    invalidateReview(b, 'buyer');
    expect(b.credit.status).toBe('unchecked');
    expect(b.credit.decisions).toEqual([]);
    expect(() => submit(b)).toThrow();
  });

  test('legacy migration retains evidence signatures and rechecks gates', () => {
    const rawOld = seeds()[0] as unknown as Record<string, unknown>;
    delete rawOld.identities;
    delete rawOld.contractType;
    (rawOld.guarantor as Record<string, unknown>).required = false;
    (rawOld.signatures as Record<string, unknown>).buyer = 'legacy';
    rawOld.submittedAt = new Date().toISOString();
    const d = migrateDraft(rawOld as unknown as Parameters<typeof migrateDraft>[0]);
    expect(d.photos.place.length).toBe(5);
    expect(d.signatures.buyer).toBe('legacy');
    expect(d.submittedAt).toBeNull();
    expect(d.guarantor.required).toBe(true);
    expect(d.credit.status).toBe('unchecked');
    expect(d.history.length).toBe((seeds()[0].history?.length || 0) + 1);
    const b = seeds()[2];
    decideReview(b, 'inspector', decision);
    expect(migrateDraft(JSON.parse(JSON.stringify(b))).credit).toEqual(b.credit);
  });

  test('migration never reopens a rejected draft when legacy reports are missing', () => {
    const rejected = seeds()[2];
    decideReview(rejected, 'inspector', { approve: false, note: 'เคยไม่อนุมัติ' });
    for (const legacyWithoutIdentities of [false, true]) {
      const saved = JSON.parse(JSON.stringify(rejected)) as Parameters<typeof migrateDraft>[0];
      if (legacyWithoutIdentities) delete saved.identities;
      else {
        delete saved.identities!.buyer.report;
        delete saved.identities!.guarantor.report;
      }
      const migrated = migrateDraft(saved);
      expect(migrated.credit).toEqual(rejected.credit);
      expect(migrated.identities.buyer.report).toBeNull();
      expect(migrated.identities.buyer.history).toBe('unchecked');
      expect(status(migrated).key).toBe('cancelled');
      expect(editable(migrated)).toBe(false);
      expect(() => confirmDemoIdentity(migrated, 'buyer', 'readcard')).toThrow();
      expect(() => submit(migrated)).toThrow();
    }
    const emptyRejected = makeDraft('MIGRATION-REJECTED');
    emptyRejected.credit.status = 'rejected';
    emptyRejected.credit.note = 'เคยไม่อนุมัติ';
    const migrated = migrateDraft(emptyRejected);
    expect(migrated.credit).toEqual(emptyRejected.credit);
    expect(editable(migrated)).toBe(false);
    expect(status(migrated).key).toBe('cancelled');
  });

  test('signature policy stays optional; schedule month end remains correct', () => {
    submit(seeds()[0]);
    openContract(seeds()[1]);
    const rows = schedule({ firstDue: '2026-11-29', dueDay: 29, months: 11, monthly: 1500 });
    expect(rows[3].date.getDate()).toBe(28);
    expect(rows[4].date.getDate()).toBe(29);
  });

  test('checklist detail clarifies missing identity items and passes upon full confirmation', () => {
    const d = makeDraft('TEST-CHECK');
    expect(checklist(d, 'sale')[0].ok).toBe(false);
    expect(checklist(d, 'sale')[0].detail.includes('ยังขาด')).toBe(true);
    d.consent = true;
    Object.assign(d.buyer, {
      id: 'ID-1',
      first: 'A',
      last: 'B',
      birth: '1990-01-01',
      gender: 'ชาย',
      phone: '0812345678',
    });
    d.identities.buyer = { confirmed: true, method: 'readcard', history: 'unchecked' };
    Object.assign(d.guarantor, { id: 'ID-2', first: 'C', last: 'D' });
    d.identities.guarantor = { confirmed: true, method: 'readcard', history: 'unchecked' };
    inspectDemoHistory(d, 'buyer', 'normal', 'test');
    inspectDemoHistory(d, 'guarantor', 'normal', 'test');
    expect(checklist(d, 'sale')[0].ok).toBe(true);
    expect(checklist(d, 'sale')[0].detail).toBe('ผู้เกี่ยวข้องยืนยันตัวตนและผ่านการพิจารณาแล้ว');
  });

  test('autoCalculateTerms calculates principal, monthly, and syncs dueDay', () => {
    const t = {
      product: '',
      qty: 1,
      price: '20000',
      down: '5000',
      principal: '',
      months: '10',
      monthly: '',
      firstDue: '2026-11-25',
      dueDay: '',
      fee: '',
    };
    autoCalculateTerms(t, 'price');
    expect(t.principal).toBe('15000');
    expect(t.monthly).toBe('1500');
    autoCalculateTerms(t, 'firstDue');
    expect(t.dueDay).toBe('25');
    t.down = '2000';
    autoCalculateTerms(t, 'down');
    expect(t.principal).toBe('18000');
    expect(t.monthly).toBe('1800');
  });

  test('recordSale auto-opens contract immediately when opening checklist is complete', () => {
    const d = seeds()[1];
    delete (d as Partial<typeof d>).soldAt;
    d.submittedAt = new Date().toISOString();
    expect(checklist(d, 'opening').every((c) => c.ok)).toBe(true);
    recordSale(d, '2026-10-22');
    expect(status(d).key).toBe('opened');
    expect(d.openedAt).toBeTruthy();
  });

  test('both flagged histories finish before explicit review; duplicate review is refused', () => {
    const d = seeds()[0];
    inspectDemoHistory(d, 'buyer', 'installment', 'buyer checker');
    expect(d.credit.status).toBe('unchecked');
    inspectDemoHistory(d, 'guarantor', 'bad_debt', 'guarantor checker');
    expect(d.credit.status).toBe('unchecked');
    expect(d.identities.buyer.history).toBe('review');
    expect(d.identities.guarantor.history).toBe('review');
    expect(d.identities.buyer.report?.risk).toBe('installment');
    expect(d.identities.guarantor.report?.risk).toBe('bad_debt');
    expect(() => requestReview(d, '')).toThrow();
    requestReview(d, 'flagged reports', true);
    expect(() => requestReview(d, 'duplicate')).toThrow();
    expect(() => confirmDemoIdentity(d, 'buyer', 'ocr')).toThrow();
    decideReview(d, 'inspector', decision);
    expect(d.credit.status).toBe('pending2');
    decideReview(d, 'inspector2', decision);
    expect(d.credit.status).toBe('approved');
    inspectDemoHistory(d, 'buyer', 'normal', 'recheck');
    expect(d.credit.status).toBe('unchecked');
    expect(d.credit.decisions).toEqual([]);
    expect(() => submit(d)).toThrow();
  });

  test('consent and bound reports are mandatory, not saved enum approvals', () => {
    const d = makeDraft('CONSENT');
    expect(() => confirmDemoIdentity(d, 'buyer', 'readcard')).toThrow();
    expect(d.consent).toBe(false);
    d.consent = true;
    confirmDemoIdentity(d, 'buyer', 'ocr');
    confirmDemoIdentity(d, 'guarantor', 'readcard');
    expect(() => requestReview(d, 'missing reports')).toThrow();
    inspectDemoHistory(d, 'buyer', 'normal', 'test');
    inspectDemoHistory(d, 'guarantor', 'normal', 'test');
    requestReview(d, 'manual review');
    d.consent = false;
    expect(() => decideReview(d, 'inspector', decision)).toThrow();
    d.consent = true;
    d.buyer.id = 'CHANGED';
    expect(() => decideReview(d, 'inspector', decision)).toThrow();
    const loaded = migrateDraft(d);
    expect(loaded.identities.buyer.report).toBeNull();
    expect(loaded.credit.status).toBe('unchecked');
    expect(loaded.credit.decisions).toEqual([]);
  });

  test('no-history is normal with no score, cash skips guarantor and same person is refused', () => {
    const d = makeDraft('CASH');
    d.consent = true;
    setContractType(d, 'CASH');
    confirmDemoIdentity(d, 'buyer', 'readcard');
    inspectDemoHistory(d, 'buyer', 'no_history', 'test');
    expect(d.credit.status).toBe('normal');
    expect(d.identities.buyer.report?.score).toBeNull();
    expect(d.identities.buyer.report?.contracts).toEqual([]);
    expect(() => confirmDemoIdentity(d, 'guarantor', 'readcard')).toThrow();
    expect(() => inspectDemoHistory(d, 'guarantor', 'normal', 'test')).toThrow();
    setContractType(d, 'NORMAL');
    expect(d.credit.status).toBe('unchecked');
    d.guarantor.id = d.buyer.id;
    expect(() => confirmDemoIdentity(d, 'guarantor', 'ocr')).toThrow();
  });

  test('failed recheck clears prior success and identity invalidation removes report', () => {
    const d = seeds()[0];
    expect(() => inspectDemoHistory(d, 'buyer', 'error', 'test')).toThrow('สาธิตขัดข้อง');
    expect(d.identities.buyer.report).toBeNull();
    expect(d.identities.buyer.history).toBe('unchecked');
    expect(d.credit.status).toBe('unchecked');
    expect(d.identities.buyer.confirmed).toBe(true);
    inspectDemoHistory(d, 'buyer', 'normal', 'test');
    invalidateReview(d, 'buyer');
    expect(d.identities.buyer.report).toBeNull();
    expect(d.identities.buyer.confirmed).toBe(false);
  });

  test('legacy enums cannot fabricate reports; renamed people lose report authorization', () => {
    const d = seeds()[0];
    delete d.identities.buyer.report;
    const loaded = migrateDraft(d);
    expect(loaded.identities.buyer.report).toBeNull();
    expect(loaded.identities.buyer.history).toBe('unchecked');
    expect(() => submit(loaded)).toThrow();
    const renamed = seeds()[0];
    renamed.buyer.first = 'another person';
    expect(checklist(renamed)[0].ok).toBe(false);
    expect(migrateDraft(renamed).identities.buyer.report).toBeNull();
  });

  test('history amounts reconcile and unknown statuses never appear paid', () => {
    const d = seeds()[0];
    for (const scenario of ['normal', 'installment', 'bad_debt'] as const) {
      inspectDemoHistory(d, 'buyer', scenario, 'test');
      for (const contract of d.identities.buyer.report!.contracts) {
        expect(contract.totalPaid).toBe(contract.terms.reduce((sum, term) => sum + term.paidAmount, 0));
        expect(contract.paymentPrice).toBe(contract.totalPaid + contract.balance);
      }
    }
    const term = { number: 1, dueDate: '2026-01-01', paidDate: '2026-01-02', status: 'UNRECOGNIZED', dueAmount: 1000, paidAmount: 1000 };
    expect(termStatusTone(term)).toBe('unknown');
    expect(termStatusLabel(term)).toContain('ไม่ทราบ');
    expect(contractStatusLabel('UNKNOWN')).toContain('ไม่ทราบ');
    expect(termStatusTone({ ...term, status: 'WAIT_PAID', dueDate: '2026-02-31' })).toBe('unknown');
    for (const [days, tone] of [[1, 'late3'], [3, 'late3'], [4, 'late15'], [15, 'late15'], [16, 'late30'], [30, 'late30'], [31, 'late60'], [60, 'late60'], [61, 'lateOver60']] as const) {
      const paidDate = new Date(Date.UTC(2026, 0, 1 + days)).toISOString();
      expect(termStatusTone({ ...term, status: 'OVERDUE_PAID', paidDate })).toBe(tone);
    }
  });
});
