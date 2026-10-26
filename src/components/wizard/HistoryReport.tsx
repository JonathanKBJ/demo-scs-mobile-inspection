import { contractStatusLabel, historyRiskLabel, termStatusLabel, termStatusTone } from '../../domain/customerHistory';
import type { PersonHistoryReport, HistoricalContract } from '../../domain/customerHistory';

const tones: Record<string, string> = {
  paid: 'bg-emerald-600',
  waiting: 'bg-slate-300',
  partial: 'bg-cyan-700',
  overdue: 'bg-red-600',
  overduePartial: 'bg-red-900',
  late3: 'bg-lime-600',
  late15: 'bg-yellow-500',
  late30: 'bg-orange-500',
  late60: 'bg-rose-600',
  lateOver60: 'bg-purple-700',
  unknown: 'bg-slate-700',
};

const legends = [
  ['paid', 'ชำระตรงเวลา'],
  ['waiting', 'รอชำระ'],
  ['partial', 'ชำระบางส่วน'],
  ['overdue', 'ค้างชำระ'],
  ['overduePartial', 'ค้างชำระ / ชำระบางส่วน'],
  ['late3', 'ช้าไม่เกิน 3 วัน'],
  ['late15', 'ช้า 4–15 วัน'],
  ['late30', 'ช้า 16–30 วัน'],
  ['late60', 'ช้า 31–60 วัน'],
  ['lateOver60', 'ช้าเกิน 60 วัน'],
  ['unknown', 'ไม่ทราบสถานะ'],
];

const date = (value: string | null) =>
  !value || !Number.isFinite(Date.parse(value))
    ? 'ไม่ระบุ'
    : new Date(value).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

export const datetime = (value: string) =>
  !Number.isFinite(Date.parse(value)) ? 'ไม่ระบุ' : new Date(value).toLocaleString('th-TH');

const baht = (value: number) =>
  Number.isFinite(value)
    ? `${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
    : 'ไม่ทราบยอด';

export function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-slate-500">{label}</dt>
          <dd className="mt-0.5 font-medium text-slate-900 [overflow-wrap:anywhere]">{value || 'ไม่ระบุ'}</dd>
        </div>
      ))}
    </dl>
  );
}

function ContractCard({ contract: c }: { contract: HistoricalContract }) {
  return (
    <details className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer p-4 text-sm focus-visible:outline-red-600">
        <span className="font-bold [overflow-wrap:anywhere]">{c.code || 'ไม่ระบุเลขสัญญา'}</span>
        <span className="ml-2 text-slate-600">{contractStatusLabel(c.status)}</span>
        <div className="mt-2 text-slate-600">
          คะแนน {c.score ?? '—'} · {c.terms.length} งวด · คงเหลือ {baht(c.balance)}
        </div>
        <div className="mt-1 text-xs text-red-700">เปิดดูรายละเอียดสัญญาเดิม (DEMO)</div>
      </summary>

      <div className="space-y-4 border-t border-slate-100 p-4">
        <Facts
          items={[
            ['สถานะสัญญา', contractStatusLabel(c.status)],
            ['คะแนนสัญญา', c.score === null ? '— / ไม่มีคะแนน' : String(c.score)],
            ['เลขที่สัญญา', c.code],
            ['วันที่ทำสัญญา', date(c.signedDate)],
            ['สาขา', c.shopName],
            ['จำนวนงวด', `${c.terms.length} งวด`],
            ['สินค้า', c.product],
            ['S/N', c.serialNumber],
            ['ยอดผ่อน', baht(c.paymentPrice)],
            ['ชำระแล้ว', baht(c.totalPaid)],
            ['ยอดคงเหลือ', baht(c.balance)],
          ]}
        />

        <div>
          <h5 className="mb-2 text-sm font-semibold">สถานะการชำระรายงวด</h5>
          {c.terms.length ? (
            <>
              <div className="flex flex-wrap gap-1" aria-label="แถบสถานะรายงวด">
                {c.terms.map(t => (
                  <span
                    key={t.number}
                    role="img"
                    aria-label={`งวด ${t.number}: ${termStatusLabel(t)}`}
                    title={`งวด ${t.number}: ${termStatusLabel(t)}`}
                    className={`flex h-7 min-w-7 items-center justify-center rounded text-xs font-bold ${
                      termStatusTone(t) === 'waiting' || termStatusTone(t) === 'late15'
                        ? 'text-slate-950'
                        : 'text-white'
                    } ${tones[termStatusTone(t)] || tones.unknown}`}
                  >
                    {t.number}
                  </span>
                ))}
              </div>
              <details className="mt-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm text-slate-700">
                  วันและยอดชำระแต่ละงวด
                </summary>
                <ul className="space-y-2 text-sm">
                  {c.terms.map(t => (
                    <li
                      key={t.number}
                      className="rounded-lg bg-slate-50 p-3 [overflow-wrap:anywhere]"
                    >
                      งวด {t.number} — {termStatusLabel(t)}
                      <br />
                      ครบกำหนด {date(t.dueDate)} · ชำระ {date(t.paidDate)}
                      <br />
                      ยอดงวด {baht(t.dueAmount)} · จ่ายแล้ว {baht(t.paidAmount)}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p className="text-sm text-slate-500">ไม่มีข้อมูลงวด</p>
          )}
        </div>
      </div>
    </details>
  );
}

export function HistoryReport({ report: r, canInspect = true }: { report: PersonHistoryReport; canInspect?: boolean }) {
  return (
    <div className="min-w-0 space-y-4" data-testid="history-report">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="text-xs font-bold text-red-700">ผลประวัติจำลอง DEMO · ไม่ใช่ผลตรวจจริง</div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <strong className="text-lg text-slate-900">{historyRiskLabel(r.risk)}</strong>
            {!canInspect && (
              <p className="mt-1 text-sm text-slate-700">
                ป้ายสำหรับพนักงานขายสาธิต: {historyRiskLabel(r.risk, false)}
              </p>
            )}
          </div>
          <div>
            <div className="text-xs text-slate-600">คะแนนจากรายงานสาธิต</div>
            <div className="text-3xl font-bold text-slate-900">
              {r.score ?? '—'}
              <span className="ml-2 text-sm font-normal">{r.score === null ? 'ไม่มีคะแนน' : 'คะแนน'}</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          สัญญาเดิม {r.contracts.length} รายการ · รวม {r.contracts.reduce((n, c) => n + c.terms.length, 0)} งวด ·
          ประวัติอ่านบัตร {r.scans.length} ครั้ง
        </p>
        <p className="mt-2 text-xs text-slate-600">
          ป้ายสถานะตามบทบาทสาธิตเท่านั้น ไม่ใช่สิทธิ์ใช้งานหรือคำตัดสินขายจริง
        </p>
      </div>

      <Facts
        items={[
          ['ชื่อ–นามสกุลในประวัติ', r.personName],
          ['เลขบัตรประชาชนในประวัติ', r.personId],
          ['เบอร์โทรศัพท์เดิม', r.phone],
          ['ที่อยู่ตามบัตรเดิม', r.cardAddress],
          ['ที่อยู่ปัจจุบันเดิม', r.currentAddress],
          ['ที่อยู่ทำงานเดิม', r.workAddress],
          ['ตรวจเมื่อ', datetime(r.checkedAt)],
          ['ผู้ตรวจสาธิต', r.checkedBy],
        ]}
      />

      {r.employee && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-3 text-sm font-bold">ข้อมูลพนักงาน (DEMO)</h4>
          <Facts
            items={[
              ['สาขาที่ทำงาน', r.employee.shop],
              ['แผนก', r.employee.department],
              ['วันเริ่มงาน', date(r.employee.startedAt)],
              ['วันสิ้นสุดงาน', r.employee.endedAt ? date(r.employee.endedAt) : 'ยังทำงานอยู่'],
            ]}
          />
        </section>
      )}

      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          ประวัติอ่านบัตร / ตรวจตัวตน ({r.scans.length} ครั้ง)
        </summary>
        {r.scans.length ? (
          <ul className="mt-3 space-y-3">
            {r.scans.map((s, i) => (
              <li key={`${s.scannedAt}-${i}`} className="rounded-lg bg-slate-50 p-3">
                <Facts
                  items={[
                    ['ชื่อ', s.name],
                    ['วันและเวลา', datetime(s.scannedAt)],
                    ['ผู้ดำเนินการ', s.displayName],
                    [
                      'วิธี',
                      s.method === 'READCARDMOBILE'
                        ? 'READCARDMOBILE — อ่านบัตรมือถือ'
                        : s.method === 'NOTREADCARD'
                          ? 'NOTREADCARD — ดึงข้อมูล'
                          : 'ไม่ทราบวิธี',
                    ],
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">ไม่มีประวัติการอ่านบัตร</p>
        )}
      </details>

      <section className="space-y-3">
        <h4 className="text-sm font-bold">สัญญาในประวัติเดิม (ไม่ใช่ร่างปัจจุบัน) · DEMO</h4>
        {r.contracts.length ? (
          r.contracts.map(c => <ContractCard key={c.id} contract={c} />)
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            ไม่พบประวัติสัญญาในชุดข้อมูลสาธิตนี้ — ไม่ใช่ข้อผิดพลาดของบริการ
          </p>
        )}
      </section>

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">คำอธิบายสีสถานะรายงวด</summary>
        <ul className="grid gap-2 sm:grid-cols-2">
          {legends.map(([tone, label]) => (
            <li key={tone} className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-3 w-3 rounded ${tones[tone]}`} />
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-slate-500">
          มีคำอธิบายข้อความรายงวดเสมอ สีเทาเข้มคือไม่ทราบผล ไม่ถือว่าชำระปกติ
        </p>
      </details>
    </div>
  );
}
