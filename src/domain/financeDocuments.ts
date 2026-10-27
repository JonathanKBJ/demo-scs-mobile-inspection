import type { ContractDraft, FinanceDocumentId } from '../types/contract';

export type { FinanceDocumentId, FinanceDocumentAcceptance } from '../types/contract';

// Bump whenever the reader's terms or source-backed document content changes.
export const FINANCE_DOCUMENT_VERSION = 'finance-demo-2026-10-27-v2-full-text';

export const REQUIRED_FINANCE_DOCUMENTS: readonly FinanceDocumentId[] = [
  'hirePurchase',
  'disclosure',
  'payment',
  'annex',
];

export function financeDocumentSnapshot(d: ContractDraft): string {
  const material = {
    id: d.id,
    contractType: d.contractType,
    buyer: d.buyer,
    guarantor: d.contractType === 'CASH' ? null : d.guarantor,
    shop: d.shop,
    owner: d.owner,
    channel: d.channel,
    pageGroup: d.pageGroup,
    financeStaff: d.financeStaff,
    terms: d.terms,
  };
  // Sort object keys so persisted key insertion order is not a material change.
  // Audit fields, signatures and saleDate (assigned after consent) are not document input.
  return JSON.stringify(material, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return value;
  });
}

export function isFinanceDocumentAccepted(d: ContractDraft, id: FinanceDocumentId): boolean {
  const acceptance = d.financeAcceptances?.[id];
  return Boolean(
    acceptance &&
      typeof acceptance.at === 'string' &&
      Number.isFinite(Date.parse(acceptance.at)) &&
      acceptance.version === FINANCE_DOCUMENT_VERSION &&
      acceptance.snapshot === financeDocumentSnapshot(d),
  );
}

export function financeDocumentsComplete(d: ContractDraft): boolean {
  return REQUIRED_FINANCE_DOCUMENTS.every((id) => isFinanceDocumentAccepted(d, id));
}

export function acceptFinanceDocument(d: ContractDraft, id: FinanceDocumentId): void {
  d.financeAcceptances ??= {};
  d.financeAcceptances[id] = {
    at: new Date().toISOString(),
    snapshot: financeDocumentSnapshot(d),
    version: FINANCE_DOCUMENT_VERSION,
  };
}
