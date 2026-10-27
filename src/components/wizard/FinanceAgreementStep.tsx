import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, LockKeyhole, PenTool, X } from 'lucide-react';
import type { ContractDraft } from '../../types/contract';
import { useContractStore } from '../../store/useContractStore';
import { editable } from '../../domain/rules';
import { money } from '../../domain/calculations';
import {
  acceptFinanceDocument, financeDocumentSnapshot, isFinanceDocumentAccepted,
  REQUIRED_FINANCE_DOCUMENTS, type FinanceDocumentId,
} from '../../domain/financeDocuments';
import { useMobileBack } from '../../utils/mobileNavigation';
import { financeSourceCorePages } from './financeSourceCore';
import { SignaturePad } from '../common/SignaturePad';
import { financeSourceSupportingPages } from './financeSourceSupporting';
import { FinanceSourceContent } from './FinanceSourceContent';
import './FinanceAgreementStep.css';

const originalUrl = `${import.meta.env.BASE_URL}finance-agreement-source.pdf`;
const unknown = 'ยังไม่ระบุ';
const text = (value: unknown) => value === '' || value === null || value === undefined ? unknown : String(value);
const amount = (value: string | number) => value === '' ? unknown : `${money(value)} บาท`;
const personName = (person: { title: string; first: string; last: string }) =>
  [person.title, person.first, person.last].filter(Boolean).join(' ') || unknown;

type PreviewDocumentId = 'supporting3' | 'supporting5' | 'supporting7' | 'allPages';
type ReaderDocumentId = FinanceDocumentId | PreviewDocumentId;
const sourcePages = [...financeSourceCorePages, ...financeSourceSupportingPages].sort((a, b) => a.page - b.page);
const documents: Record<ReaderDocumentId, { title: string; pages: string; pageNumbers: number[]; summary: string }> = {
  hirePurchase: { title: 'สัญญาเช่าซื้อและเงื่อนไข', pages: '1–2', pageNumbers: [1, 2], summary: 'ข้อมูลคู่สัญญา สินค้า และเงื่อนไขเช่าซื้อฉบับเต็ม' },
  disclosure: { title: 'หนังสือยินยอมเปิดเผยข้อมูล', pages: '4', pageNumbers: [4], summary: 'ข้อความเรื่องการเปิดเผยข้อมูลฉบับเต็ม แยกจากสัญญาเช่าซื้อ' },
  payment: { title: 'คำชี้แจงช่องทางชำระเงิน', pages: '6', pageNumbers: [6], summary: 'ข้อความและภาพประกอบช่องทางชำระเงินจากต้นฉบับ' },
  annex: { title: 'หนังสือผนวกท้ายสัญญา', pages: '8', pageNumbers: [8], summary: 'ข้อความเงื่อนไขผนวกท้ายสัญญาฉบับเต็ม' },
  supporting3: { title: 'หนังสือรับรองจากผู้บังคับบัญชา', pages: '3', pageNumbers: [3], summary: '' },
  supporting5: { title: 'ใบขอติดตั้งเครื่องปรับอากาศ', pages: '5', pageNumbers: [5], summary: '' },
  supporting7: { title: 'หนังสือรับรองลูกบ้านหรือผู้เช่า', pages: '7', pageNumbers: [7], summary: '' },
  allPages: { title: 'พรีวิวเอกสารครบ 8 หน้า', pages: '1–8', pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8], summary: '' },
};
function isRequiredDocument(id: ReaderDocumentId): id is FinanceDocumentId {
  return REQUIRED_FINANCE_DOCUMENTS.some((required) => required === id);
}

function DraftDetails({ draft: d }: { draft: ContractDraft }) {
  const buyer = d.buyer;
  const fields: [string, string][] = [
    ['ผู้ซื้อ', personName(buyer)], ['สินค้า', text(d.terms.product)],
    ['ราคาสินค้า', amount(d.terms.price)], ['เงินดาวน์', amount(d.terms.down)],
    ['ยอดจัด', amount(d.terms.principal)], ['ค่างวดตามข้อมูลปัจจุบัน', amount(d.terms.monthly)],
    ['จำนวนงวด', d.terms.months === '' ? unknown : `${d.terms.months} งวด`],
    ['งวดแรก', text(d.terms.firstDue)], ['วันครบกำหนดแต่ละเดือน', text(d.terms.dueDay)],
  ];
  return <dl className="finance-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function SourceLink({ pages }: { pages?: string }) {
  return <a className="finance-source" href={originalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />ต้นฉบับ PDF ทั้ง 8 หน้า{pages ? ` · อ้างอิงหน้า ${pages}` : ''}<span className="sr-only"> (เปิดแท็บใหม่)</span></a>;
}

function DocumentReader({ draft, id, mode, canAccept, onClose, onConfirm }: {
  draft: ContractDraft; id: ReaderDocumentId; mode: 'preview' | 'read'; canAccept: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const doc = documents[id];
  const pages = sourcePages.filter((page) => doc.pageNumbers.includes(page.page));
  useMobileBack(mode === 'read', onClose, 'finance-document-reader');
  useMobileBack(mode === 'preview', onClose, 'finance-document-preview');
  useEffect(() => {
    const element = dialog.current;
    const focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowBefore = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    reader.current?.focus({ preventScroll: true });
    const measure = () => {
      const content = reader.current;
      if (!content) return;
      const imagesReady = Array.from(content.querySelectorAll('img')).every((image) => image.complete);
      if (imagesReady && content.scrollTop + content.clientHeight >= content.scrollHeight - 2) setReachedBottom(true);
    };
    const observer = new ResizeObserver(measure);
    if (reader.current) {
      observer.observe(reader.current);
      for (const child of reader.current.children) observer.observe(child);
      reader.current.addEventListener('load', measure, true);
      reader.current.addEventListener('error', measure, true);
    }
    measure();
    return () => {
      observer.disconnect();
      reader.current?.removeEventListener('load', measure, true);
      reader.current?.removeEventListener('error', measure, true);
      element?.close();
      document.body.style.overflow = overflowBefore;
      focusBefore?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="finance-dialog" aria-labelledby="finance-reader-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="finance-dialog-header">
      <div><p className="finance-demo">{mode === 'preview' ? 'พรีวิวเอกสาร' : 'อ่านก่อนยืนยัน'} · ร่างสาธิต</p><h2 id="finance-reader-title">{doc.title}</h2></div>
      <button type="button" className="finance-icon-button" onClick={onClose} aria-label="ปิดเอกสาร"><X size={22} /></button>
    </header>
    {id === 'allPages' && <nav className="finance-page-nav" aria-label="ไปยังหน้าต้นฉบับ">{pages.map((page) => <button type="button" className="finance-button" key={page.page} onClick={() => {
      const content = reader.current;
      const target = content?.querySelector(`#finance-source-page-${page.page}`);
      if (content && target) content.scrollTo({ top: content.scrollTop + target.getBoundingClientRect().top - content.getBoundingClientRect().top - 16 });
    }}>หน้า {page.page}</button>)}</nav>}
    <div ref={reader} tabIndex={0} role="region" aria-label="เนื้อหาเอกสาร เลื่อนเพื่ออ่านจนจบ" className="finance-reader" onScroll={(event) => {
      const element = event.currentTarget;
      if (Array.from(element.querySelectorAll('img')).every((image) => image.complete) && element.scrollTop + element.clientHeight >= element.scrollHeight - 2) setReachedBottom(true);
    }}>
      <div className="finance-notice"><strong>ถอดข้อความจากต้นฉบับเพื่อทดลองอ่านบนเว็บ ไม่ใช่ PDF ที่ลงนาม</strong><p>แสดงข้อความหน้า {doc.pages} พร้อมข้อมูลร่างปัจจุบัน ช่องที่ไม่มีข้อมูลแสดง “ยังไม่ระบุ” ข้อความ [อ่านไม่ชัดในต้นฉบับ] ต้องตรวจภาพต้นฉบับ ไม่มีการสร้างลายเซ็นหรือการลงนามแทนบุคคลอื่น</p></div>
      <FinanceSourceContent draft={draft} pages={pages} />
      <aside className="finance-warning" aria-label="ข้อจำกัดของเดโม ไม่ใช่ข้อความต้นฉบับ"><AlertTriangle size={20} aria-hidden="true" /><div><strong>หมายเหตุของระบบสาธิต — ไม่ใช่ส่วนหนึ่งของต้นฉบับ</strong><p>ข้อความถอดจากเอกสารไม่ใช่การรับรองความชอบด้วยกฎหมายหรือสิทธิเรียกเก็บ ต้องตรวจต้นฉบับและทบทวนกฎหมาย/ความเป็นส่วนตัวก่อนใช้จริง การรับทราบของผู้ซื้อไม่ใช่ความยินยอมหรือลายเซ็นแทนผู้ค้ำ ผู้รับรอง หรือเจ้าของที่พัก</p>{doc.pageNumbers.includes(6) && <p>ภาพหน้า 6 เป็นภาพประกอบจากต้นฉบับ ไม่ใช่เครื่องมือรับชำระเงินที่ผ่านการตรวจสอบ ห้ามใช้ภาพ เลขบัญชี หรือ QR ในเดโมเพื่อชำระเงินจริง ให้ตรวจสอบกับบริษัทก่อนทุกครั้ง</p>}</div></aside>
      <SourceLink pages={doc.pages} />
      <p className="finance-reader-end">จบข้อความเอกสารหน้า {doc.pages} · ไม่มีการลงนามจริง การรับทราบบันทึกเฉพาะในระบบสาธิต</p>
    </div>
    <footer className="finance-dialog-footer">
      {mode === 'read' && canAccept && isRequiredDocument(id) ? <>
        <p className="finance-read-status" role="status">{reachedBottom ? 'อ่านถึงท้ายแล้ว กรุณาเลือกยืนยันด้วยตนเอง' : 'เลื่อนอ่านในกรอบเอกสารจนถึงท้าย เพื่อเปิดช่องรับทราบ'}</p>
        <label className="check-label finance-ack"><input type="checkbox" checked={acknowledged} disabled={!reachedBottom} onChange={(event) => setAcknowledged(event.target.checked)} /><span>{id === 'disclosure' ? 'ฉันได้อ่านร่างเรื่องการเปิดเผยข้อมูลแยกต่างหาก และรับทราบข้อจำกัดของเดโม' : 'ฉันได้อ่านและรับทราบร่างเอกสารฉบับนี้ รวมถึงข้อจำกัดของเดโม'}</span></label>
        <div className="finance-dialog-actions"><button type="button" className="finance-button" onClick={onClose}>ยกเลิก</button><button type="button" className="finance-button finance-primary" disabled={!reachedBottom || !acknowledged} onClick={() => { if (reachedBottom && acknowledged && canAccept && isRequiredDocument(id)) onConfirm(); }}>ยืนยันรับทราบเอกสารนี้</button></div>
      </> : <div className="finance-dialog-actions"><p>{mode === 'preview' ? 'โหมดพรีวิวไม่บันทึกการรับทราบ' : 'ร่างนี้อ่านได้อย่างเดียว ไม่สามารถเปลี่ยนการรับทราบ'}</p><button type="button" className="finance-button" onClick={onClose}>กลับรายการเอกสาร</button></div>}
    </footer>
  </dialog>;
}

export function FinanceAgreementStep() {
  const { activeDraft, updateActiveDraft, user } = useContractStore();
  const [opened, setOpened] = useState<{ id: ReaderDocumentId; mode: 'read' | 'preview' } | null>(null);
  if (!activeDraft) return null;
  const d = activeDraft;
  const snapshot = financeDocumentSnapshot(d);
  const canAccept = editable(d) && !['pending', 'pending2'].includes(d.credit.status) && user.role === 'sales';
  const count = REQUIRED_FINANCE_DOCUMENTS.filter((id) => isFinanceDocumentAccepted(d, id)).length;
  return <section className="finance-agreement" aria-labelledby="finance-heading">
    <header className="finance-heading"><div><h2 id="finance-heading">ตรวจเอกสารก่อนยืนยัน</h2><p>ตรวจข้อมูลของคุณ → อ่านเอกสารแต่ละฉบับจนจบ → เลือกรับทราบและยืนยัน</p></div><span className="finance-demo-badge">DEMO · ไม่มีการลงนามจริง</span></header>
    <div className="finance-all-preview"><div><strong>อ่านข้อความจริงครบทั้ง 8 หน้า</strong><p>รวมเอกสารประกอบและพื้นที่ลงชื่อ พรีวิวนี้ไม่บันทึกการรับทราบ</p></div><button type="button" className="finance-button finance-primary" onClick={() => setOpened({ id: 'allPages', mode: 'preview' })}>พรีวิวเอกสารครบ 8 หน้า</button></div>
    <div className="finance-layout">
      <aside className="finance-summary"><h3>สรุปข้อมูลการเงินของคุณ</h3><DraftDetails draft={d} /><p className="finance-muted">ใช้ยอดจากข้อมูลปัจจุบันของระบบ ไม่แสดงอัตราดอกเบี้ยหรือยอดเช่าซื้อรวมที่ต้นฉบับยังไม่ได้ระบุ หากแก้ข้อมูล ต้องอ่านและยืนยันใหม่</p><SourceLink /></aside>
      <div className="finance-document-list"><div className="finance-list-heading"><h3>เอกสารที่ผู้ซื้อรับทราบ</h3><span aria-live="polite">{count} / 4 ฉบับ</span></div>
        {!canAccept && <p className="finance-notice"><LockKeyhole size={17} aria-hidden="true" /> ร่างนี้อ่านได้อย่างเดียว เปิดพรีวิวได้ แต่บันทึกการรับทราบไม่ได้</p>}
        {REQUIRED_FINANCE_DOCUMENTS.map((id) => { const doc = documents[id]; const accepted = isFinanceDocumentAccepted(d, id); return <article className="finance-document-row" key={id}>
          <div className="finance-document-title"><FileText size={21} aria-hidden="true" /><div><h4>{doc.title}</h4><p>ต้นฉบับหน้า {doc.pages}</p></div></div>
          <span className={`finance-status ${accepted ? 'is-accepted' : ''}`}>{accepted && <CheckCircle2 size={15} aria-hidden="true" />}{accepted ? 'รับทราบแล้ว' : 'รออ่านและยืนยัน'}</span>
          <p className="finance-document-summary">{doc.summary}</p>
          <div className="finance-row-actions"><button type="button" className="finance-button" onClick={() => setOpened({ id, mode: 'preview' })}>พรีวิวเอกสาร<span className="sr-only"> {doc.title}</span></button><button type="button" className="finance-button finance-primary" onClick={() => setOpened({ id, mode: 'read' })}>{canAccept ? (accepted ? 'อ่านและยืนยันอีกครั้ง' : 'อ่านและยืนยัน') : 'อ่านเอกสาร'}<span className="sr-only"> {doc.title}</span></button></div>
        </article>; })}
      </div>
    </div>
    {/* Signature Section */}
    <div className="mt-6 space-y-4">
      <div className="border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PenTool className="w-5 h-5 text-red-600" />
              บันทึกลายมือชื่อบนหน้าจอ (Digital Signature)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ลงชื่อบนหน้าจอเพื่อนำลายเซ็นไปประทับในจุดลงนามของเอกสารทั้งหมด และการกดยืนยันรับทราบในเอกสารแต่ละฉบับจะถือเป็นการยืนยันความถูกต้องด้วย
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignaturePad
            label="ลายมือชื่อผู้เช่าซื้อ"
            sublabel="เซ็นเพื่อประทับลงในสัญญาเช่าซื้อ หนังสือเปิดเผยข้อมูล และใบเสร็จ"
            signerName={personName(d.buyer)}
            value={d.signatures?.buyer}
            onSave={(dataUrl) =>
              updateActiveDraft((draft) => {
                draft.signatures.buyer = dataUrl;
              })
            }
            onClear={() =>
              updateActiveDraft((draft) => {
                delete draft.signatures.buyer;
              })
            }
          />
          {d.contractType !== 'CASH' && (
            <SignaturePad
              label="ลายมือชื่อผู้ค้ำประกัน"
              sublabel="เซ็นเพื่อประทับในส่วนของผู้ค้ำประกันและหนังสือแนบท้าย"
              signerName={personName(d.guarantor)}
              value={d.signatures?.guarantor}
              onSave={(dataUrl) =>
                updateActiveDraft((draft) => {
                  draft.signatures.guarantor = dataUrl;
                })
              }
              onClear={() =>
                updateActiveDraft((draft) => {
                  delete draft.signatures.guarantor;
                })
              }
            />
          )}
        </div>
      </div>
    </div>
    <section className="finance-supporting" aria-labelledby="finance-supporting-heading"><h3 id="finance-supporting-heading">เอกสารประกอบของบุคคลที่สาม · ใช้เมื่อเกี่ยวข้อง</h3><p>ไม่รวมใน 4 ฉบับที่ผู้ซื้อรับทราบ ผู้ซื้อลงนามแทนผู้บังคับบัญชา เจ้าของที่พัก หรือผู้ดูแลไม่ได้</p><ul>
      <li><strong>หน้า 3 · หนังสือรับรองจากผู้บังคับบัญชา</strong><span>ใช้เมื่อจำเป็นต้องให้ที่ทำงานรับทราบ ผู้รับรองต้องลงนามเอง</span><button type="button" className="finance-button" onClick={() => setOpened({ id: 'supporting3', mode: 'preview' })}>พรีวิวเอกสาร<span className="sr-only"> หน้า 3</span></button></li>
      <li><strong>หน้า 5 · ใบขอติดตั้งเครื่องปรับอากาศ</strong><span>ใช้เมื่อเป็นเครื่องปรับอากาศและที่พักเช่า ต้องขออนุญาตเจ้าของ/ผู้แทน</span><button type="button" className="finance-button" onClick={() => setOpened({ id: 'supporting5', mode: 'preview' })}>พรีวิวเอกสาร<span className="sr-only"> หน้า 5</span></button></li>
      <li><strong>หน้า 7 · หนังสือรับรองลูกบ้านหรือผู้เช่า</strong><span>ใช้เมื่อเกี่ยวข้องกับหอพักหรือที่พักเช่า ผู้ดูแลต้องรับรองเอง</span><button type="button" className="finance-button" onClick={() => setOpened({ id: 'supporting7', mode: 'preview' })}>พรีวิวเอกสาร<span className="sr-only"> หน้า 7</span></button></li>
    </ul><SourceLink pages="3, 5, 7" /></section>
    <p className="finance-disclaimer">ถอดข้อความจากต้นฉบับเพื่อทดลองอ่านบนเว็บ ไม่ใช่สัญญาที่ลงนามหรือการตรวจรับรองทางกฎหมาย การรับทราบ 4 ฉบับแยกกันและบันทึกเฉพาะในระบบสาธิต พรีวิวเอกสารประกอบและพรีวิวครบ 8 หน้าไม่มีการรับทราบ</p>
    {opened && <DocumentReader key={`${opened.id}:${opened.mode}:${snapshot}`} draft={d} id={opened.id} mode={opened.mode} canAccept={canAccept} onClose={() => setOpened(null)} onConfirm={() => {
      if (!canAccept || opened.mode !== 'read' || !isRequiredDocument(opened.id)) return;
      const requiredId = opened.id;
      const expectedSnapshot = snapshot;
      updateActiveDraft((draft) => {
        if (editable(draft) && !['pending', 'pending2'].includes(draft.credit.status) && financeDocumentSnapshot(draft) === expectedSnapshot) acceptFinanceDocument(draft, requiredId);
      });
      setOpened(null);
    }} />}
  </section>;
}
