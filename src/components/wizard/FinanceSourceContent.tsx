import type { ContractDraft } from '../../types/contract';
import { usesGuarantor } from '../../domain/rules';
import { money } from '../../domain/calculations';
import type { FinanceSourcePage } from './financeSourceTypes';

const unknown = 'ยังไม่ระบุ';
const text = (value: unknown) => value === '' || value == null ? unknown : String(value);
const name = (person: { title: string; first: string; last: string }) => text([person.title, person.first, person.last].filter(Boolean).join(' '));
const address = (person: ContractDraft['buyer'], current = false) => text((current && !person.currentSame
  ? [person.currentAddress, person.currentSubdistrict, person.currentDistrict, person.currentProvince, person.currentPostcode]
  : [person.address, person.subdistrict, person.district, person.province, person.postcode]).filter(Boolean).join(' '));

function values(draft: ContractDraft): Record<string, string> {
  const result: Record<string, string> = { 'draft.id': draft.id, shop: text(draft.shop) };
  result['buyer.name'] = name(draft.buyer);
  for (const key of ['id', 'birth', 'gender', 'marital', 'phone', 'homeType', 'job', 'company', 'position', 'tenure', 'income', 'otherIncome', 'workPhone', 'workAddress', 'age', 'nationality', 'lineId', 'residenceYears', 'liveWith', 'dependentsCount', 'businessType', 'workDepartment', 'contactTime', 'previousCompany'] as const) result[`buyer.${key}`] = text(draft.buyer[key]);
  result['buyer.address'] = address(draft.buyer);
  result['buyer.currentAddress'] = address(draft.buyer, true);
  for (const [field, registered, current] of [
    ['currentStreet', 'address', 'currentAddress'],
    ['currentSubdistrict', 'subdistrict', 'currentSubdistrict'],
    ['currentDistrict', 'district', 'currentDistrict'],
    ['currentProvince', 'province', 'currentProvince'],
  ] as const) result[`buyer.${field}`] = text(draft.buyer[draft.buyer.currentSame ? registered : current]);
  result['guarantor.name'] = usesGuarantor(draft) ? name(draft.guarantor) : 'ไม่ใช้ผู้ค้ำประกัน';
  for (const key of ['id', 'phone', 'relation', 'address', 'job', 'company', 'income', 'workAddress', 'age', 'lineId', 'residenceYears', 'position', 'workDepartment', 'workPhone', 'tenure'] as const) result[`guarantor.${key}`] = usesGuarantor(draft) ? text(draft.guarantor[key]) : 'ไม่ใช้ผู้ค้ำประกัน';
  for (const key of ['product', 'qty', 'price', 'down', 'principal', 'monthly', 'months', 'firstDue', 'dueDay', 'brand', 'model', 'serial', 'productType', 'totalHirePurchasePrice', 'lastDue'] as const) result[`terms.${key}`] = text(draft.terms[key]);
  for (const key of ['price', 'down', 'principal', 'monthly'] as const) result[`terms.${key}`] = draft.terms[key] === '' ? unknown : `${money(draft.terms[key])} บาท`;
  for (const key of ['income', 'otherIncome'] as const) result[`buyer.${key}`] = draft.buyer[key] === '' ? unknown : `${money(draft.buyer[key])} บาท`;
  result['guarantor.income'] = usesGuarantor(draft) ? (draft.guarantor.income === '' ? unknown : `${money(draft.guarantor.income)} บาท`) : 'ไม่ใช้ผู้ค้ำประกัน';
  return result;
}

export function FinanceSourceContent({ draft, pages }: { draft: ContractDraft; pages: readonly FinanceSourcePage[] }) {
  const data = values(draft);
  const populate = (source: string) => source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => data[key] ?? unknown);
  return <div className="finance-source-pages">{pages.map((page) => <section key={page.page} id={`finance-source-page-${page.page}`} className="finance-source-paper" aria-labelledby={`finance-source-title-${page.page}`}>
    <header><span className="finance-source-page-number">ต้นฉบับหน้า {page.page}</span><h3 id={`finance-source-title-${page.page}`}>{page.title}</h3></header>
    {page.blocks.map((block, index) => {
      const content = populate(block.text);
      switch (block.kind) {
        case 'heading': return <h4 key={index}>{content}</h4>;
        case 'field': {
          const val = block.value ? data[block.value] : undefined;
          const isUnknown = !val || val === unknown;
          // Clean up trailing dots/placeholders from template text for clean reading
          const cleanLabel = content.replace(/\.{3,}/g, '').trim();
          return (
            <dl key={index} className={`finance-source-field ${isUnknown ? 'is-empty' : 'is-filled'}`}>
              <dt>{cleanLabel}</dt>
              <dd>{isUnknown ? <span className="finance-empty-badge">ยังไม่ระบุ</span> : val}</dd>
            </dl>
          );
        }
        case 'signature': {
          const role = block.signatureRole || 'buyer';
          const sigImg = draft.signatures?.[role];
          const sigName = role === 'buyer' ? name(draft.buyer) : role === 'guarantor' ? (usesGuarantor(draft) ? name(draft.guarantor) : 'ไม่ใช้ผู้ค้ำ') : role === 'staff' ? (draft.financeStaff || 'เจ้าหน้าที่สินเชื่อ') : 'บุคคลที่เกี่ยวข้อง';
          return <div key={index} className="finance-source-signature">
            <p>{content}</p>
            {sigImg ? (
              <div className="finance-sig-signed">
                <img src={sigImg} alt={`ลายเซ็น ${content}`} className="finance-sig-image" />
                <span className="finance-sig-name">ลงชื่อแล้วโดย: {sigName}</span>
              </div>
            ) : (
              <span className="finance-sig-placeholder">พื้นที่ลงชื่อ — เดโมยังไม่มีการลงนาม</span>
            )}
          </div>;
        }
        case 'image': {
          const dimensions = block.src?.includes('finance-payment-first') ? { width: 1365, height: 605 } : block.src?.includes('finance-payment-following') ? { width: 1165, height: 500 } : undefined;
          return <figure key={index} className="finance-source-illustration">{block.src && <img src={`${import.meta.env.BASE_URL}${block.src.replace(/^\//, '')}`} alt={content} loading="eager" {...dimensions} />}<figcaption>{content}<br />ภาพจากต้นฉบับเพื่อประกอบการทดลองอ่าน ไม่ใช่ช่องทางที่ตรวจสอบสำหรับชำระเงินจริง</figcaption></figure>;
        }
        case 'note': return <p key={index} className="finance-source-note">{content}</p>;
        default: return <p key={index}>{content}</p>;
      }
    })}
  </section>)}</div>;
}
