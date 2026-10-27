export interface FinanceSourceBlock {
  kind: 'heading' | 'paragraph' | 'field' | 'signature' | 'note' | 'image';
  text: string;
  /** Optional draft-value key for a field. Unknown source fields stay unfilled. */
  value?: string;
  /** Optional role identifier for signature blocks ('buyer' | 'guarantor' | 'staff' | 'thirdParty'). */
  signatureRole?: 'buyer' | 'guarantor' | 'staff' | 'thirdParty';
  /** Public asset relative to Vite BASE_URL; only for original scan illustrations. */
  src?: string;
}

export interface FinanceSourcePage {
  page: number;
  title: string;
  blocks: readonly FinanceSourceBlock[];
}
