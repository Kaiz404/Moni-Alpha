import {
  mdiBellRingOutline,
  mdiCameraOutline,
  mdiCar,
  mdiCart,
  mdiKeyboardOutline,
  mdiMicrophone,
  mdiShopping,
  mdiSilverwareForkKnife,
} from '@mdi/js';
import type { CSSProperties, ReactNode } from 'react';
import { Cat } from '@/components/brand';
import { MdiIcon } from './parts';

const CATEGORY = {
  food: { color: 'var(--color-coral)', icon: mdiSilverwareForkKnife },
  transport: { color: 'var(--color-sky)', icon: mdiCar },
  groceries: { color: 'var(--color-mint)', icon: mdiCart },
  shopping: { color: 'var(--color-peach)', icon: mdiShopping },
} as const;

type Category = keyof typeof CATEGORY;

function Bubble({ category, size, glyph }: { category: Category; size: number; glyph: number }) {
  const { color, icon } = CATEGORY[category];
  return (
    <span className="bn-rb" style={{ width: size, height: size, background: color }}>
      <MdiIcon path={icon} size={glyph} />
    </span>
  );
}

/** A filed payment, as the fan cards and the receipt show it. */
function MiniRow({ category, name, meta, amount }: { category: Category; name: string; meta: string; amount: string }) {
  return (
    <div className="bn-mini">
      <Bubble category={category} size={34} glyph={17} />
      <span className="bn-mini-text">
        <span className="bn-mini-line">
          <span className="bn-mini-name">{name}</span>
          <span className="num bn-mini-amt">{amount}</span>
        </span>
        <span className="bn-mini-meta">{meta}</span>
      </span>
    </div>
  );
}

function FanCard({ icon, label, tag, top, row }: { icon: string; label: string; tag?: string; top: ReactNode; row: ReactNode }) {
  return (
    <div className="bn-fc">
      <span className="bn-chip">
        <span className="bn-rb bn-chip-icon">
          <MdiIcon path={icon} size={18} />
        </span>
        {label}
        {tag && <span className="bn-tag">{tag}</span>}
      </span>
      <div className="bn-fc-top">{top}</div>
      {row}
    </div>
  );
}

export function BentoFan() {
  return (
    <div className="bn-fan" aria-hidden="true">
      <FanCard
        icon={mdiKeyboardOutline}
        label="Type it"
        top={
          <span className="bn-say bn-say-field">
            mamak ali 13.20
            <i className="bn-caret" />
          </span>
        }
        row={<MiniRow category="food" name="Mamak Ali" meta="Food & Dining, Cash" amount="−RM13.20" />}
      />
      <FanCard
        icon={mdiMicrophone}
        label="Say it"
        top={<span className="bn-say">“paid 6 ringgit parking at KLCC”</span>}
        row={<MiniRow category="transport" name="Parking KLCC" meta="Transport, today" amount="−RM6.00" />}
      />
      <FanCard
        icon={mdiCameraOutline}
        label="Snap a receipt"
        top={
          <span className="bn-mrc">
            <b>BANGSAR SHOPPING CTR</b>
            <i style={{ width: '80%' }} />
            <i style={{ width: '56%' }} />
            <span className="bn-tot">
              <span>TOTAL</span>
              <span className="num">86.00</span>
            </span>
          </span>
        }
        row={<MiniRow category="food" name="Dinner at Bangsar Shopping Centre" meta="Food & Dining, Sat 10 Oct" amount="−RM86.00" />}
      />
      <FanCard
        icon={mdiBellRingOutline}
        label="Bank alerts"
        tag="Android"
        top={
          <span className="bn-alert">
            <b>Maybank</b> You’ve spent RM86.40 at JAYA GROCER on 14/10 12:50.
          </span>
        }
        row={<MiniRow category="groceries" name="Jaya Grocer" meta="Groceries, Maybank" amount="−RM86.40" />}
      />
    </div>
  );
}

export function BentoReceipt() {
  return (
    <div className="bn-snap" aria-hidden="true">
      <div className="bn-rcpt">
        <b className="bn-rcpt-shop">UNIQLO</b>
        <span className="bn-rcpt-where">MID VALLEY 06/10/2026</span>
        {[86, 64, 78, 52].map((w) => (
          <span key={w} className="bn-rl" style={{ width: `${w}%` }} />
        ))}
        <span className="bn-tot">
          <span>TOTAL</span>
          <span className="num">129.90</span>
        </span>
        <span className="bn-tot bn-lift">
          <span>TOTAL</span>
          <span className="num">129.90</span>
        </span>
        <span className="bn-scan" />
      </div>
      <div className="bn-snap-res">
        <MiniRow category="shopping" name="Uniqlo" meta="Shopping, Maybank, Tue 6 Oct" amount="−RM129.90" />
      </div>
    </div>
  );
}

/** Spent per month in ringgit, May to October so far; the plot tops out at RM2,000 and the budget is RM1,800. */
const MONTHS = [
  { label: 'May', spent: 1720.4 },
  { label: 'Jun', spent: 1655.1 },
  { label: 'Jul', spent: 1812.75 },
  { label: 'Aug', spent: 1690.2 },
  { label: 'Sep', spent: 1744.3 },
  { label: 'Oct', spent: 1116.2, current: true },
];

export function BentoChart() {
  return (
    <div className="bn-chart" aria-hidden="true">
      <span className="bn-bud" />
      <span className="bn-bud-l num">RM1,800 budget</span>
      {MONTHS.map(({ label, spent, current }, i) => (
        <span
          key={label}
          className={current ? 'bn-col bn-col-now' : 'bn-col'}
          style={{ '--i': i, '--v': spent / 2000 } as CSSProperties}
        >
          <span className="bn-bar">{!current && <i className="bn-bar-hi" />}</span>
          <span className="bn-bl">{label}</span>
        </span>
      ))}
      <span className="bn-tip">
        <b className="num">RM1,116.20 so far</b>
        <span className="num">RM443 left for 18 days</span>
      </span>
    </div>
  );
}

export function BentoDebts() {
  return (
    <div className="bn-debts" aria-hidden="true">
      <div className="bn-nt">
        <Cat size={40} ground="deep" tile id="lp-bento-debt" />
        <span className="bn-nt-text">
          <span className="bn-nt-app">Moni, Thu 29 Oct</span>
          <b className="bn-nt-title">Aiman pays you back tomorrow</b>
          <span className="bn-nt-line">RM150.00 for the Penang trip hotel share.</span>
        </span>
      </div>
      <div className="bn-people">
        <div className="bn-prow">
          <span className="bn-rb bn-initial bn-initial-mint">
            A
          </span>
          <span className="bn-prow-text">
            <span className="bn-prow-name">Aiman owes you</span>
            <span className="bn-prow-meta">Due Fri 30 Oct</span>
          </span>
          <b className="num bn-owed">RM150.00</b>
        </div>
        <div className="bn-prow">
          <span className="bn-rb bn-initial bn-initial-lilac">
            M
          </span>
          <span className="bn-prow-text">
            <span className="bn-prow-name">You owe Mei</span>
            <span className="bn-prow-meta">Due Tue 20 Oct</span>
          </span>
          <b className="num">RM40.00</b>
        </div>
      </div>
    </div>
  );
}
