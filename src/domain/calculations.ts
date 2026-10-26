import type { ContractTerms } from '../types/contract';

export const money = (n: number | string | null | undefined): string =>
  Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });

export const localDay = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function autoCalculateTerms(terms: ContractTerms, field: string): ContractTerms {
  const price = parseFloat(String(terms.price)) || 0;
  const down = parseFloat(String(terms.down)) || 0;

  if (['price', 'down'].includes(field)) {
    if (terms.price !== '') {
      const principal = Math.max(0, price - down);
      terms.principal = String(principal);
    }
  }

  const principal = parseFloat(String(terms.principal)) || 0;
  const months = parseInt(String(terms.months), 10) || 0;

  if (['price', 'down', 'principal', 'months'].includes(field)) {
    if (months > 0 && terms.principal !== '') {
      terms.monthly = String(Math.round(principal / months));
    }
  }

  if (field === 'firstDue' && terms.firstDue && /^\d{4}-\d{2}-\d{2}$/.test(terms.firstDue)) {
    const day = parseInt(terms.firstDue.split('-')[2], 10);
    if (day >= 1 && day <= 31) {
      terms.dueDay = String(day);
    }
  }

  return terms;
}

export function firstDueDays(d: { terms: { firstDue?: string }; saleDate?: string }): number {
  const parse = (x: string | undefined): number => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x || '')) return NaN;
    const [y, m, day] = (x || '').split('-').map(Number);
    const n = Date.UTC(y, m - 1, day);
    return new Date(n).toISOString().slice(0, 10) === x ? n : NaN;
  };
  return (parse(d.terms.firstDue) - parse(d.saleDate)) / 86400000;
}

export interface ScheduleRow {
  date: Date;
  amount: number;
}

export function schedule(t: { firstDue?: string; dueDay?: string | number; months?: string | number; monthly?: string | number }): ScheduleRow[] {
  if (!t.firstDue || !Number(t.months)) return [];
  const [y, m, day] = t.firstDue.split('-').map(Number);
  const due = Number(t.dueDay) || day;
  if (!y || !m || !day) return [];

  return Array.from({ length: Math.min(60, Math.max(0, Number(t.months))) }, (_, i) => {
    const month = m - 1 + i;
    const last = new Date(y, month + 1, 0).getDate();
    return {
      date: new Date(y, month, Math.min(i === 0 ? day : due, last)),
      amount: Number(t.monthly) || 0,
    };
  });
}
