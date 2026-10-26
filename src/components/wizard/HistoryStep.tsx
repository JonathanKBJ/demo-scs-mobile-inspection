import { useState } from 'react';
import { useContractStore } from '../../store/useContractStore';
import {
  editable,
  historyComplete,
  historyReportMatches,
  invalidateReview,
  usesGuarantor,
} from '../../domain/rules';
import {
  confirmDemoIdentity,
  inspectDemoHistory,
  setContractType,
  requestReview,
  decideReview,
} from '../../domain/workflow';
import { historyScenarios } from '../../domain/customerHistory';
import type { HistoryPerson, HistoryScenario } from '../../domain/customerHistory';
import { HistoryReport, Facts, datetime } from './HistoryReport';
import type { ContractDraft, UserRole } from '../../types/contract';

const inputClass =
  'w-full min-w-0 min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100';
const buttonClass =
  'min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed';

export function HistoryStep() {
  const { activeDraft: d, updateActiveDraft, user, setUser } = useContractStore();
  const [scenarios, setScenarios] = useState<Record<HistoryPerson, HistoryScenario>>({
    buyer: 'normal',
    guarantor: 'normal',
  });
  const [errors, setErrors] = useState<Partial<Record<HistoryPerson | 'review', string>>>({});
  const [reason, setReason] = useState('');
  const [level2, setLevel2] = useState(false);
  const [note, setNote] = useState('');
  const [percent, setPercent] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [ack, setAck] = useState(false);

  if (!d) return null;

  const pending = ['pending', 'pending2'].includes(d.credit.status);
  const locked = !editable(d) || pending;
  const approved = d.credit.status === 'approved';

  const run = (key: HistoryPerson | 'review', fn: () => void) => {
    try {
      fn();
      setErrors(prev => ({ ...prev, [key]: '' }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [key]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const mutate = (fn: (draft: ContractDraft) => void) => updateActiveDraft(fn);

  const check = (who: HistoryPerson) =>
    run(who, () => {
      mutate(draft => {
        draft.identities[who].report = null;
        draft.identities[who].history = 'unchecked';
        invalidateReview(draft);
      });
      mutate(draft => inspectDemoHistory(draft, who, scenarios[who], user.name));
    });

  const required: HistoryPerson[] = usesGuarantor(d) ? ['buyer', 'guarantor'] : ['buyer'];
  const hasFlag = required.some(who => d.identities[who].history === 'review');

  const statusLabels = {
    unchecked: 'ยังตรวจไม่ครบ / รอผลตรวจ',
    normal: 'ประวัติปกติครบแล้ว',
    pending: 'รอพิจารณาระดับ 1',
    pending2: 'รอพิจารณาระดับ 2',
    approved: 'อนุมัติสาธิตแล้ว',
    rejected: 'ไม่อนุมัติสาธิต',
  };

  const expectedRole = d.credit.status === 'pending' ? 'inspector' : 'inspector2';

  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-bold text-amber-950">ตรวจประวัติลูกค้า · DEMO</h3>
        <p className="mt-1 text-sm text-amber-900">
          ข้อมูลทั้งหมดเป็นชุดข้อมูลจำลองในเครื่อง ไม่เชื่อมฐานประวัติจริง บัตรจริง OCR จริง
          หรือระบบอนุมัติจริง
        </p>
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input
            id="history-consent"
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0"
            checked={d.consent}
            disabled={locked || approved}
            onChange={e => {
              const consent = e.target.checked;
              run('review', () =>
                mutate(draft => {
                  draft.consent = consent;
                  if (!consent) {
                    for (const who of ['buyer', 'guarantor'] as const) {
                      draft.identities[who].report = null;
                      draft.identities[who].history = 'unchecked';
                    }
                    invalidateReview(draft);
                  }
                }),
              );
            }}
          />
          <span>
            ลูกค้ารับทราบและยินยอมให้ตรวจประวัติและประเมินวงเงินเช่าซื้อสาธิต (Consent)
          </span>
        </label>
      </div>

      <label className="block text-sm font-semibold">
        ประเภทสัญญา
        <select
          id="history-contract-type"
          className={`${inputClass} mt-2`}
          value={d.contractType}
          disabled={locked || approved || Boolean(d.soldAt)}
          onChange={e =>
            run('review', () =>
              mutate(draft => setContractType(draft, e.target.value as 'NORMAL' | 'CASH')),
            )
          }
        >
          <option value="NORMAL">ปกติ — ต้องมีผู้ค้ำประกัน</option>
          <option value="CASH">สดพิเศษ (CASH) — ไม่ต้องมีผู้ค้ำ</option>
        </select>
      </label>

      {pending && (
        <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
          อยู่ระหว่างพิจารณา จึงปิดการยืนยันตัวตนและตรวจซ้ำ
          เพื่อไม่ให้ผลเปลี่ยนระหว่างอนุมัติ
        </p>
      )}

      {approved && !locked && (
        <div className="rounded-xl border border-amber-200 p-4 text-sm">
          <p>อนุมัติแล้ว หากต้องการตรวจใหม่ ให้ยกเลิกผลอนุมัติเดิมอย่างชัดเจนก่อน</p>
          <button
            type="button"
            className={`${buttonClass} mt-3`}
            onClick={() =>
              run('review', () =>
                mutate(draft => {
                  for (const who of required) {
                    draft.identities[who].report = null;
                    draft.identities[who].history = 'unchecked';
                  }
                  invalidateReview(draft);
                }),
              )
            }
          >
            เริ่มตรวจใหม่ / ยกเลิกผลอนุมัติเดิม
          </button>
        </div>
      )}

      {required.map(who => {
        const p = d[who];
        const identity = d.identities[who];
        const label = who === 'buyer' ? 'ผู้เช่าซื้อ' : 'ผู้ค้ำประกัน';
        const report =
          d.consent &&
          identity.confirmed &&
          identity.history !== 'unchecked' &&
          historyReportMatches(d, who)
            ? identity.report
            : null;

        return (
          <section
            key={who}
            data-testid={`history-${who}`}
            className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900">ตัวตนและประวัติ{label}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                {identity.confirmed ? 'ยืนยันตัวตนแล้ว' : 'ยังไม่ยืนยันตัวตน'}
              </span>
            </div>

            <Facts
              items={[
                [
                  'ชื่อ–นามสกุลปัจจุบัน',
                  p.first || p.last ? [p.title, p.first, p.last].filter(Boolean).join(' ') : 'ยังไม่มีข้อมูล',
                ],
                ['เลขบัตรประชาชนปัจจุบัน', p.id || 'ยังไม่มีข้อมูล'],
                ['เบอร์โทรปัจจุบัน', p.phone],
                ['วิธียืนยัน', identity.method || 'ยังไม่ยืนยัน'],
              ]}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={locked || approved || !d.consent}
                onClick={() =>
                  run(who, () => mutate(draft => confirmDemoIdentity(draft, who, 'readcard')))
                }
              >
                ยืนยันอ่านบัตร{label} (DEMO)
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={locked || approved || !d.consent}
                onClick={() => run(who, () => mutate(draft => confirmDemoIdentity(draft, who, 'ocr')))}
              >
                ยืนยัน OCR {label} (DEMO)
              </button>
              <button
                type="button"
                className={`${buttonClass} text-red-700`}
                disabled={locked || approved}
                onClick={() =>
                  run(who, () =>
                    mutate(draft => {
                      invalidateReview(draft, who);
                      draft.identities[who].confirmed = false;
                      draft.identities[who].method = '';
                      draft.identities[who].history = 'unchecked';
                      draft.identities[who].report = null;
                      if (who === 'buyer') draft.ocrConfirmed = false;
                    }),
                  )
                }
              >
                ล้างการยืนยันและผลตรวจ{label}
              </button>
            </div>

            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <label htmlFor={`history-scenario-${who}`} className="block text-sm font-semibold">
                สถานการณ์สาธิต{label}
              </label>
              <select
                id={`history-scenario-${who}`}
                className={inputClass}
                value={scenarios[who]}
                disabled={locked || approved}
                onChange={e =>
                  setScenarios(prev => ({ ...prev, [who]: e.target.value as HistoryScenario }))
                }
              >
                {historyScenarios.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                id={`history-check-${who}`}
                className="min-h-11 w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={locked || approved || !d.consent || !identity.confirmed}
                onClick={() => check(who)}
              >
                {report ? 'ตรวจประวัติใหม่' : 'ตรวจประวัติ'}
                {label} (DEMO)
              </button>
              <p className="text-xs text-slate-600">
                เลือกชุดข้อมูลแล้วกดตรวจ ผลได้จากรายงานจำลอง ไม่ใช่การเลือกอนุมัติเอง
              </p>
            </div>

            {errors[who] && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">
                ตรวจไม่สำเร็จ: {errors[who]} — ไม่มีผลตรวจที่ใช้ได้ กรุณาลองใหม่
              </p>
            )}

            {report ? (
              <HistoryReport report={report} canInspect={user.role !== 'sales'} />
            ) : (
              !errors[who] && (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  {!d.consent
                    ? 'ยังไม่ได้ให้ความยินยอม — ยังไม่มีผลตรวจ'
                    : !identity.confirmed
                      ? 'ยังไม่ยืนยันตัวตน — ยืนยันอ่านบัตรหรือ OCR สาธิตก่อน'
                      : identity.report && identity.report.personId !== p.id
                        ? 'เลขบัตรเปลี่ยน ผลเดิมไม่ใช่ของบุคคลนี้ กรุณาตรวจใหม่'
                        : 'ยืนยันตัวตนแล้ว แต่ยังไม่ได้ตรวจประวัติ — ไม่มีคะแนนหรือผลตรวจจนกว่าจะกดตรวจ'}
                </p>
              )
            )}
          </section>
        );
      })}

      {!usesGuarantor(d) && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <h3 className="font-bold">ผู้ค้ำประกัน: ไม่จำเป็นสำหรับ CASH</h3>
          <p className="mt-1">
            ข้ามการยืนยันตัวตนและตรวจประวัติผู้ค้ำ ไม่ใช้ผลผู้ซื้อแทนผู้ค้ำ
          </p>
        </section>
      )}

      <section
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        aria-labelledby="history-review-heading"
      >
        <h3 id="history-review-heading" className="font-bold">
          การพิจารณาประวัติสาธิต
        </h3>
        <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm font-semibold">
          สถานะปัจจุบัน: {statusLabels[d.credit.status]}
        </p>

        <label className="block text-sm font-semibold">
          บทบาทสาธิต
          <select
            id="history-demo-role"
            className={`${inputClass} mt-2`}
            value={user.role}
            onChange={e => setUser({
              ...user,
              role: e.target.value as UserRole,
              name: e.target.value === 'inspector2'
                ? 'ผู้ตรวจระดับ 2 (สาธิต)'
                : e.target.value === 'inspector'
                  ? 'ผู้ตรวจระดับ 1 (สาธิต)'
                  : 'พนักงานขายตัวอย่าง',
            })}
          >
            <option value="sales">พนักงานขาย (DEMO)</option>
            <option value="inspector">ผู้ตรวจระดับ 1 (DEMO)</option>
            <option value="inspector2">ผู้ตรวจระดับ 2 (DEMO)</option>
          </select>
        </label>
        <p className="text-xs text-slate-600">
          สลับบทบาทเพื่อทดลองหน้าจอเท่านั้น ไม่ใช่การรับรองสิทธิ์หรือการควบคุมสิทธิ์ในระบบจริง
        </p>

        {d.credit.reason && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm">
            <strong>
              {['pending', 'pending2', 'approved', 'rejected'].includes(d.credit.status)
                ? 'เหตุผลที่ส่งตรวจ:'
                : 'หมายเหตุผลตรวจ:'}
            </strong>{' '}
            {d.credit.reason}
            {['pending', 'pending2', 'approved', 'rejected'].includes(d.credit.status) && (
              <>
                <br />
                {d.credit.requiresLevel2 ? 'ต้องพิจารณาระดับ 2' : 'พิจารณาระดับ 1'}
              </>
            )}
          </p>
        )}

        {!pending && !approved && editable(d) && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              เหตุผลส่งตรวจ (จำเป็น)
              <textarea
                id="history-review-reason"
                className={`${inputClass} mt-2`}
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={!historyComplete(d) || !hasFlag}
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={level2}
                disabled={!historyComplete(d) || !hasFlag}
                onChange={e => setLevel2(e.target.checked)}
              />
              ต้องพิจารณาระดับ 2
            </label>
            <button
              type="button"
              id="history-request-review"
              className={buttonClass}
              disabled={!historyComplete(d) || !hasFlag || !reason.trim()}
              onClick={() => run('review', () => mutate(draft => requestReview(draft, reason, level2)))}
            >
              ส่งพิจารณาประวัติสาธิต
            </button>
            <p className="text-xs text-slate-600">
              {!historyComplete(d)
                ? 'ต้องตรวจผู้เกี่ยวข้องให้ครบก่อน จึงส่งพิจารณาได้'
                : !hasFlag
                  ? 'ผลปกติครบแล้ว ไม่ต้องส่งพิจารณาเพิ่มเติม'
                  : 'ผลติดเงื่อนไขครบแล้ว ยังไม่ส่งจนกว่าจะกดปุ่มส่งพิจารณา'}
            </p>
          </div>
        )}

        {pending &&
          (user.role === expectedRole ? (
            <div className="space-y-3">
              <h4 className="text-sm font-bold">
                แบบพิจารณาระดับ {d.credit.status === 'pending' ? 1 : 2} (DEMO)
              </h4>
              <label className="block text-sm">
                หมายเหตุการพิจารณา (จำเป็น)
                <textarea
                  id="history-decision-note"
                  className={`${inputClass} mt-2`}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
                อ่านเหตุผลที่ส่งตรวจแล้ว
              </label>
              <label className="block text-sm">
                เปอร์เซ็นต์รับ 0–100 (เมื่ออนุมัติ)
                <input
                  id="history-decision-percent"
                  type="number"
                  min="0"
                  max="100"
                  className={`${inputClass} mt-2`}
                  value={percent}
                  onChange={e => setPercent(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                เหตุผลประกอบ (จำเป็นเมื่อรับ 100%)
                <textarea
                  id="history-decision-reason"
                  className={`${inputClass} mt-2`}
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[true, false].map(approve => (
                  <button
                    key={String(approve)}
                    type="button"
                    id={approve ? 'history-approve' : 'history-reject'}
                    className={`${buttonClass} ${approve ? 'text-emerald-800' : 'text-red-700'}`}
                    onClick={() =>
                      run('review', () => {
                        mutate(draft =>
                          decideReview(draft, user.role, {
                            approve,
                            note,
                            percent,
                            reason: decisionReason,
                            readReason: ack,
                          }),
                        );
                        setNote('');
                        setPercent('');
                        setDecisionReason('');
                        setAck(false);
                      })
                    }
                  >
                    {approve ? 'อนุมัติสาธิต' : 'ไม่อนุมัติสาธิต'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-blue-800">
              เลือกบทบาทสาธิตผู้ตรวจระดับ {d.credit.status === 'pending' ? 1 : 2} เพื่อทดลองพิจารณา
            </p>
          ))}

        {errors.review && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {errors.review}
          </p>
        )}

        {d.credit.decisions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-bold">ผลการพิจารณาที่บันทึก (DEMO)</h4>
            {d.credit.decisions.map((decision, i) => (
              <div key={`${decision.at}-${i}`} className="rounded-xl border border-slate-200 p-3">
                <Facts
                  items={[
                    [
                      'ระดับ / ผล',
                      `${decision.level} / ${decision.approve ? 'อนุมัติสาธิต' : 'ไม่อนุมัติสาธิต'}`,
                    ],
                    ['เปอร์เซ็นต์รับ', decision.percent === null ? '—' : `${decision.percent}%`],
                    ['หมายเหตุ', decision.note],
                    ['เหตุผลประกอบ', decision.reason],
                    ['เวลา', datetime(decision.at)],
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
