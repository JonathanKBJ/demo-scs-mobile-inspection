import type { PersonHistoryReport } from '../domain/customerHistory';

export type ContractType = 'NORMAL' | 'CASH';

export type IdentityMethod = 'readcard' | 'previous' | 'ocr' | 'manual' | '';
export type IdentityHistory = 'normal' | 'review' | 'unchecked';
export type CreditStatus = 'unchecked' | 'normal' | 'pending' | 'pending2' | 'approved' | 'rejected';
export type UserRole = 'sales' | 'inspector' | 'inspector2';

export interface IdentityProfile {
  confirmed: boolean;
  method: IdentityMethod;
  history: IdentityHistory;
  report?: PersonHistoryReport | null;
}

export interface BuyerInfo {
  id: string;
  title: string;
  first: string;
  last: string;
  birth: string;
  gender: 'ชาย' | 'หญิง' | '';
  phone: string;
  email: string;
  marital: string;
  homeType: string;
  address: string;
  province: string;
  district: string;
  subdistrict: string;
  postcode: string;
  currentSame: boolean;
  currentAddress: string;
  currentProvince: string;
  currentDistrict: string;
  currentSubdistrict: string;
  currentPostcode: string;
  job: string;
  company: string;
  position: string;
  tenure: string;
  income: string | number;
  otherIncome: string | number;
  workPhone: string;
  workAddress: string;
}

export interface GuarantorInfo {
  required: boolean;
  id: string;
  title: string;
  first: string;
  last: string;
  phone: string;
  relation: string;
  address: string;
  job: string;
  income: string | number;
  company: string;
  workAddress: string;
}

export interface ContractTerms {
  product: string;
  qty: number;
  price: string | number;
  down: string | number;
  principal: string | number;
  months: string | number;
  monthly: string | number;
  firstDue: string;
  dueDay: string | number;
  fee: string | number;
}

export interface ContractLocation {
  lat: string | number;
  lng: string | number;
  link: string;
  landmark: string;
  type: string;
}

export interface DecisionRecord {
  level: number;
  approve: boolean;
  note: string;
  percent: number | null;
  reason: string;
  at: string;
}

export interface CreditState {
  status: CreditStatus;
  reason: string;
  note: string;
  requiresLevel2: boolean;
  decisions: DecisionRecord[];
}

export interface PhotoAttachment {
  id: string;
  src: string;
  name: string;
  at: string;
  by: string;
  demo?: boolean;
}

export interface HistoryItem {
  at: string;
  text: string;
  by: string;
}

export interface ContractDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  shop: string;
  channel: string;
  contractType: ContractType;
  pageGroup: string;
  financeStaff: string;
  note: string;
  buyer: BuyerInfo;
  guarantor: GuarantorInfo;
  identities: {
    buyer: IdentityProfile;
    guarantor: IdentityProfile;
  };
  terms: ContractTerms;
  location: ContractLocation;
  consent: boolean;
  ocrConfirmed: boolean;
  credit: CreditState;
  photos: Record<string, PhotoAttachment[]>;
  signatures: Record<string, string>;
  signedSnapshot: string;
  documentReviewed: boolean;
  submittedAt: string | null;
  soldAt: string | null;
  saleDate: string;
  openedAt: string | null;
  saleRef: string;
  barcode: string;
  notificationStatus: string;
  history: HistoryItem[];
}

export interface ChecklistItem {
  label: string;
  step: number;
  ok: boolean;
  detail: string;
}

export interface ContractStatus {
  key: 'draft' | 'ready' | 'submitted' | 'pending' | 'pending2' | 'sold' | 'opened' | 'cancelled';
  label: string;
  tone: 'amber' | 'green' | 'blue' | 'red';
}
