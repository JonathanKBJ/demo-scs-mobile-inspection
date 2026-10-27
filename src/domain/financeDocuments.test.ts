import { describe, expect, test } from 'vitest';
import type { ContractDraft } from '../types/contract';
import {
  acceptFinanceDocument,
  FINANCE_DOCUMENT_VERSION,
  financeDocumentSnapshot,
  financeDocumentsComplete,
  isFinanceDocumentAccepted,
  REQUIRED_FINANCE_DOCUMENTS,
} from './financeDocuments';
import { checklist, editable } from './rules';
import { migrateDraft, openContract, recordSale, seeds, submit } from './workflow';

function acknowledgeAll(d: ContractDraft): void {
  for (const id of REQUIRED_FINANCE_DOCUMENTS) acceptFinanceDocument(d, id);
}

const documentCheck = (d: ContractDraft, phase: 'sale' | 'opening' = 'sale') =>
  checklist(d, phase).find((item) => item.step === 7)!;

describe('finance document acknowledgments', () => {
  test('four independent explicit records gate submission; legacy boolean is not consent', () => {
    const d = seeds()[0];
    d.documentReviewed = true;
    expect(financeDocumentsComplete(d)).toBe(false);
    expect(() => submit(d)).toThrow();
    for (const [index, id] of REQUIRED_FINANCE_DOCUMENTS.entries()) {
      acceptFinanceDocument(d, id);
      expect(isFinanceDocumentAccepted(d, id)).toBe(true);
      expect(d.financeAcceptances![id]!.version).toBe(FINANCE_DOCUMENT_VERSION);
      expect(Number.isFinite(Date.parse(d.financeAcceptances![id]!.at))).toBe(true);
      expect(documentCheck(d).ok).toBe(index === 3);
    }
    expect(() => submit(d)).not.toThrow();
  });

  test('all personalized material changes and document versions require fresh acknowledgment', () => {
    const mutations: Array<(d: ContractDraft) => void> = [
      (d) => { d.id += '-new'; },
      (d) => { d.buyer.first = 'ผู้ซื้อใหม่'; },
      (d) => { d.buyer.currentAddress = 'ที่อยู่ใหม่'; },
      (d) => { d.buyer.workAddress = 'ที่ทำงานใหม่'; },
      (d) => { d.guarantor.phone = 'ใหม่'; },
      (d) => { d.shop = 'สาขาใหม่'; },
      (d) => { d.contractType = 'CASH'; },
      (d) => { d.terms.monthly = 2000; },
      (d) => { d.terms.firstDue = '2026-11-26'; },
    ];
    for (const mutate of mutations) {
      const d = seeds()[0];
      acknowledgeAll(d);
      mutate(d);
      for (const id of REQUIRED_FINANCE_DOCUMENTS) expect(isFinanceDocumentAccepted(d, id)).toBe(false);
      expect(documentCheck(d).ok).toBe(false);
      expect(documentCheck(d, 'opening').ok).toBe(false);
      acknowledgeAll(d);
      expect(financeDocumentsComplete(d)).toBe(true);
    }
    const d = seeds()[0];
    acknowledgeAll(d);
    d.financeAcceptances!.annex!.version = 'obsolete';
    expect(financeDocumentsComplete(d)).toBe(false);
    expect(isFinanceDocumentAccepted(d, 'hirePurchase')).toBe(true);
    acceptFinanceDocument(d, 'annex');
    d.financeAcceptances!.payment!.at = '';
    expect(financeDocumentsComplete(d)).toBe(false);
  });

  test('audit metadata, sale processing and JSON key order do not invalidate records', () => {
    const d = seeds()[0];
    acknowledgeAll(d);
    const snapshot = financeDocumentSnapshot(d);
    d.updatedAt = '2026-10-28T00:00:00.000Z';
    d.history.push({ at: d.updatedAt, by: 'test', text: 'saved' });
    d.signatures.buyer = 'demo-image';
    d.documentReviewed = false;
    d.identities.buyer.report!.checkedAt = d.updatedAt;
    d.buyer = Object.fromEntries(Object.entries(d.buyer).reverse()) as unknown as ContractDraft['buyer'];
    expect(financeDocumentSnapshot(d)).toBe(snapshot);
    expect(() => submit(d)).not.toThrow();
    expect(() => recordSale(d, '2026-10-22')).not.toThrow();
    expect(financeDocumentSnapshot(d)).toBe(snapshot);
    expect(financeDocumentsComplete(d)).toBe(true);
    expect(financeDocumentsComplete(migrateDraft(JSON.parse(JSON.stringify(d))))).toBe(true);
  });

  test('irrelevant guarantor information for cash does not alter the snapshot', () => {
    const d = seeds()[0];
    d.contractType = 'CASH';
    acknowledgeAll(d);
    d.guarantor.first = 'ไม่เกี่ยวข้องกับรายการสด';
    expect(financeDocumentsComplete(d)).toBe(true);
  });

  test('sale result and opening cannot bypass changed personalized data', () => {
    const d = seeds()[0];
    acknowledgeAll(d);
    submit(d);
    d.buyer.address = 'ที่อยู่หลังส่งทำขาย';
    expect(() => recordSale(d, '2026-10-22')).toThrow();
    acknowledgeAll(d);
    expect(() => recordSale(d, '2026-10-22')).not.toThrow();
    d.terms.firstDue = '2026-11-26';
    d.terms.dueDay = 26;
    d.photos.delivery = [d.photos.buyer[0]];
    expect(() => openContract(d)).toThrow();
    acknowledgeAll(d);
    expect(() => openContract(d)).not.toThrow();
    expect(editable(d)).toBe(false);
  });

  test('migration preserves missing or stale acknowledgments without fabricating consent', () => {
    const old = seeds()[0];
    old.documentReviewed = true;
    expect(financeDocumentsComplete(migrateDraft(old))).toBe(false);
    acknowledgeAll(old);
    old.buyer.address = 'แก้ข้อมูลเก่าที่บันทึกไว้';
    expect(financeDocumentsComplete(migrateDraft(old))).toBe(false);
    const [ready, sold, pending] = seeds();
    expect(financeDocumentsComplete(ready)).toBe(false);
    expect(financeDocumentsComplete(sold)).toBe(true);
    expect(financeDocumentsComplete(pending)).toBe(false);
    expect(sold.history.some((item) => item.text.includes('DEMO'))).toBe(true);
  });
});
