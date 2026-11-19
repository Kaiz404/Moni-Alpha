import {
  mdiBank,
  mdiCar,
  mdiCart,
  mdiCash,
  mdiCellphone,
  mdiChartBox,
  mdiCheck,
  mdiCheckAll,
  mdiChevronDown,
  mdiChevronRight,
  mdiCogOutline,
  mdiHandshakeOutline,
  mdiHome,
  mdiHomeLightningBolt,
  mdiLockOutline,
  mdiMedicalBag,
  mdiPlus,
  mdiReceiptText,
  mdiRepeat,
  mdiShopping,
  mdiSilverwareForkKnife,
  mdiSwapHorizontal,
  mdiTrayFull,
  mdiViewDashboardEditOutline,
  mdiWalletOutline,
} from '@mdi/js';
import { AskMoniMark, Cat, Wordmark } from '@/components/brand';
import { Fact } from './fact';
import { HeroBubble } from './hero-parts';
import { MdiIcon } from './parts';

/** The web app's Home in a browser window: W2-Home's first screen at 1440 x 900, drawn at 0.8. */
export function HeroWindow() {
  return (
    <div className="hero-win">
      <div className="hw-chrome">
        <span className="hw-dot" />
        <span className="hw-dot" />
        <span className="hw-dot" />
        <span className="hw-grow" />
        <span className="hw-address">
          <MdiIcon path={mdiLockOutline} size={13} />
          <Fact name="domain" />
        </span>
        <span className="hw-grow" />
        <span className="hw-chrome-end" />
      </div>
      <div className="hw-frame">
        <div className="hw-home">
          <Sidebar />
          <div className="hw-main">
            <div className="hw-head">
              <span className="hw-head-text">
                <span className="hw-date">Wednesday, 14 Oct</span>
                <span className="hw-title">Afternoon, Kai</span>
              </span>
              <span className="hw-head-tools">
                <span className="hx-btn hw-btn-out">
                  <MdiIcon path={mdiViewDashboardEditOutline} size={20} />
                  Customise
                </span>
                <span className="hw-cmd">
                  <span className="hw-cmd-mark">
                    <AskMoniMark size={24} onInk id="lp-hero-cmd" />
                  </span>
                  <span className="hw-cmd-text">Search or ask Moni</span>
                  <span className="hx-kbd">Ctrl K</span>
                </span>
              </span>
            </div>
            <div className="hw-row1">
              <SpentCard />
              <ReviewCard />
            </div>
            <div className="hw-row2">
              <RecentCard />
              <div className="hw-col">
                <NextDaysCard />
                <PlacesCard />
              </div>
              <WalletsCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { icon: mdiHome, label: 'Home' },
  { icon: mdiReceiptText, label: 'Activity' },
  { icon: mdiChartBox, label: 'Budget' },
  { icon: mdiHandshakeOutline, label: 'Debts' },
];

function Sidebar() {
  return (
    <div className="hw-side">
      <span className="hw-logo">
        <Cat size={36} ground="deep" tile id="lp-hero-sb" />
        <Wordmark size={28} onInk />
      </span>
      <span className="hw-add">
        <MdiIcon path={mdiPlus} size={24} />
        <span className="hw-grow">Add</span>
        <span className="hx-kbd hw-add-kbd">N</span>
      </span>
      <span className="hw-gap" />
      {NAV.map((item, i) => (
        <span key={item.label} className="hw-navi" data-current={i === 0 || undefined}>
          <MdiIcon path={item.icon} size={22} />
          {item.label}
        </span>
      ))}
      <span className="hw-rule" />
      <span className="hw-navi">
        <MdiIcon path={mdiTrayFull} size={22} />
        <span className="hw-grow">Review</span>
        <span className="hw-count num">3</span>
      </span>
      <span className="hw-navi hw-navi-ask">
        <AskMoniMark size={24} onInk id="lp-hero-sbask" />
        <span className="hw-grow">Ask Moni</span>
        <span className="hx-kbd hw-ink-kbd">/</span>
      </span>
      <span className="hw-grow" />
      <span className="hw-navi hw-me">
        <span className="hw-me-tile">K</span>
        <span className="hw-me-text">
          <span>Kai</span>
          <span className="hw-me-sub">Settings</span>
        </span>
        <MdiIcon path={mdiCogOutline} size={20} />
      </span>
    </div>
  );
}

const PACE_LINE =
  '62.0,222.5 79.9,213.3 97.7,198.3 115.6,183.4 133.5,175.1 151.3,158.8 169.2,148.3 187.1,139.9 204.9,135.0 222.8,116.3 240.7,107.2 258.5,102.5 276.4,95.3 294.3,93.8';

const PACE_TICKS = [
  { left: 32, label: '1 Oct' },
  { left: 157.1, label: '8' },
  { left: 264.3, label: 'Today', today: true },
  { left: 407.2, label: '22' },
  { left: 532.3, label: '29' },
];

function SpentCard() {
  return (
    <div className="hx-card hw-spent">
      <div className="hw-spent-top">
        <span className="hx-cap">SPENT IN OCTOBER</span>
        <span className="hw-spent-tools">
          <span className="hx-kbd">P</span>
          <span className="hx-kbd">D</span>
          <span className="hw-seg">
            <span className="hw-seg-on">Pace</span>
            <span>Daily</span>
          </span>
        </span>
      </div>
      <div className="hw-chart">
        <div className="hw-plot">
          <svg width="604" height="232" viewBox="0 0 604 232" className="hw-plot-svg">
            <line x1="62" y1="14" x2="598" y2="14" className="hw-grid" />
            <line x1="62" y1="119" x2="598" y2="119" className="hw-grid hw-grid-mid" />
            <line x1="62" y1="224" x2="598" y2="224" className="hw-grid" />
            <path d={`M62.0,224.0 L${PACE_LINE.replaceAll(' ', ' L')} L294.3,224.0 Z`} className="hw-area" />
            <line x1="62" y1="224" x2="598" y2="14" className="hw-even" />
            <polyline points={PACE_LINE} className="hw-line" />
            <circle cx="598" cy="14" r="5" className="hw-goal" />
          </svg>
          <span className="hw-y num hw-y-budget" style={{ top: 6 }}>
            RM1,800
          </span>
          <span className="hw-y num" style={{ top: 111 }}>
            RM900
          </span>
          <span className="hw-y num" style={{ top: 216 }}>
            RM0
          </span>
          <span className="hw-budget">Budget</span>
          <span className="hw-cursor" />
          <span className="hw-cursor-dot" />
          <span className="hw-tip">
            <span className="hw-tip-day">Sun 11 Oct</span>
            <span className="num hw-tip-value">RM1,001.00</span>
          </span>
        </div>
        <div className="hw-ticks">
          {PACE_TICKS.map((tick) => (
            <span key={tick.label} className="num" data-today={tick.today || undefined} style={{ left: tick.left }}>
              {tick.label}
            </span>
          ))}
        </div>
      </div>
      <span className="num hw-spent-foot">RM443 left for 18 days · RM24 a day</span>
    </div>
  );
}

const CAPTURES = [
  {
    icon: mdiSilverwareForkKnife,
    name: 'GRAB*FOOD',
    amount: 'RM23.40',
    meta: 'Usual for you · Maybank · 12:41 pm',
    usual: true,
  },
  {
    icon: mdiCart,
    name: 'Jaya Grocer',
    amount: 'RM86.40',
    meta: 'Usual for you · Maybank · 12:50 pm',
    usual: true,
  },
  {
    icon: mdiCar,
    name: 'Parking KLCC',
    amount: 'RM6.00',
    meta: 'Needs a wallet · Moni chat · 1:30 pm',
    usual: false,
  },
];

function ReviewCard() {
  return (
    <div className="hx-card hw-review">
      <div className="hw-review-head">
        <span className="hw-review-text">
          <span className="hx-title num">3 captures to review</span>
          <span className="num hw-on-lilac">RM115.80 waiting</span>
        </span>
        <span className="hw-link hw-link-ink">
          Review
          <MdiIcon path={mdiChevronRight} size={18} />
        </span>
      </div>
      <div className="hw-captures">
        {CAPTURES.map((c) => (
          <div key={c.name} className="hw-crow">
            <span className="hw-clink">
              <HeroBubble size={34} glyph={17} icon={c.icon} tone="dashed" />
              <span className="hx-rt">
                <span className="hw-cline">
                  <span className="hx-rn hw-cname">{c.name}</span>
                  <span className="num hw-camt">{c.amount}</span>
                </span>
                <span className="hx-rm" data-tone={c.usual ? 'lilac' : 'lemon'}>
                  {c.meta}
                </span>
              </span>
            </span>
            {c.usual ? (
              <span className="hx-btn hw-appr hw-btn-key">
                <MdiIcon path={mdiCheck} size={18} />
                Approve
              </span>
            ) : (
              <span className="hx-btn hw-appr hw-btn-sand">
                <MdiIcon path={mdiWalletOutline} size={18} />
                Wallet
                <MdiIcon path={mdiChevronDown} size={16} />
              </span>
            )}
          </div>
        ))}
      </div>
      <span className="hw-grow" />
      <span className="hx-btn hw-btn-ink hw-usual">
        <MdiIcon path={mdiCheckAll} size={20} />
        <span className="hw-grow">Approve all 2 usual</span>
        <MdiIcon path={mdiChevronRight} size={20} />
      </span>
    </div>
  );
}

const RECENT = [
  {
    icon: mdiSilverwareForkKnife,
    tone: 'coral',
    name: 'Mamak Ali',
    meta: 'Today · Cash',
    amount: '−RM13.20',
  },
  {
    icon: mdiSwapHorizontal,
    tone: 'sand',
    name: 'Touch ’n Go reload',
    meta: 'Yesterday',
    amount: 'RM100.00',
    auto: true,
  },
  {
    icon: mdiMedicalBag,
    tone: 'pink',
    name: 'Guardian',
    meta: 'Yesterday · Touch ’n Go',
    amount: '−RM15.90',
  },
  {
    icon: mdiSilverwareForkKnife,
    tone: 'coral',
    name: 'GRAB*FOOD',
    meta: 'Yesterday · Maybank',
    amount: '−RM45.90',
  },
  {
    icon: mdiCar,
    tone: 'sky',
    name: 'Shell',
    meta: 'Mon 12 Oct · Maybank',
    amount: '−RM30.40',
  },
];

function CardHead({ title, link }: { title: string; link: string }) {
  return (
    <div className="hw-card-head">
      <span className="hx-title">{title}</span>
      <span className="hw-link">
        {link}
        <MdiIcon path={mdiChevronRight} size={18} />
      </span>
    </div>
  );
}

function RecentCard() {
  return (
    <div className="hx-card hw-recent">
      <CardHead title="Recent" link="See all" />
      {RECENT.map((row) => (
        <div key={row.name} className="hw-trow">
          <HeroBubble size={42} glyph={20} icon={row.icon} tone={row.tone} />
          <span className="hx-rt">
            <span className="hx-rn">{row.name}</span>
            <span className="hx-rm">
              {row.auto && <span className="hx-auto">Auto</span>}
              {row.meta}
            </span>
          </span>
          <span className="num hw-tamt" data-transfer={row.auto || undefined}>
            {row.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

const TICK_LEFTS = [7.2, 28.9, 50.5, 72.2, 93.8, 115.5, 137.1, 158.8, 180.4, 202, 223.7, 245.3, 267, 288.6, 310.2];

const DUE_DOTS = [
  { left: 23.6, tone: 'lemon' },
  { left: 131.9, tone: 'block-lilac' },
  { left: 175.1, tone: 'lemon' },
  { left: 240.1, tone: 'aqua' },
];

const DUE = [
  {
    when: 'Tomorrow',
    icon: mdiRepeat,
    tone: 'lemon',
    name: 'Netflix',
    amount: 'RM54.90',
  },
  {
    when: 'Tue 20 Oct',
    tone: 'block-lilac',
    initial: 'M',
    name: 'To Mei',
    amount: 'RM40.00',
  },
  {
    when: 'Thu 22 Oct',
    icon: mdiRepeat,
    tone: 'lemon',
    name: 'Spotify',
    amount: 'RM16.90',
    auto: true,
  },
  {
    when: 'Sun 25 Oct',
    icon: mdiHomeLightningBolt,
    tone: 'aqua',
    name: 'Unifi fibre',
    amount: 'RM129.00',
  },
];

function NextDaysCard() {
  return (
    <div className="hx-card hw-next">
      <div className="hw-next-head">
        <span className="hx-title">Next 14 days</span>
        <span className="num hw-meta">RM240.80, set aside</span>
      </div>
      <div className="hw-timeline">
        <span className="hw-tl-line" />
        <span className="hw-tl-today" />
        {TICK_LEFTS.map((left, i) => (
          <span key={left} className="hw-tl-tick" data-week={i % 7 === 0 || undefined} style={{ left }} />
        ))}
        {DUE_DOTS.map((dot) => (
          <span key={dot.left} className="hw-tl-dot" data-tone={dot.tone} style={{ left: dot.left }} />
        ))}
        <span className="hw-tl-label hw-tl-now">Today</span>
        <span className="hw-tl-label hw-tl-mid">Wed 21</span>
        <span className="hw-tl-label hw-tl-end">Wed 28</span>
      </div>
      <div>
        {DUE.map((row) => (
          <div key={row.name} className="hw-nrow">
            <span className="hw-when" data-soon={row.when === 'Tomorrow' || undefined}>
              {row.when}
            </span>
            <HeroBubble size={26} glyph={14} icon={row.icon} tone={row.tone}>
              <span className="hw-initial">{row.initial}</span>
            </HeroBubble>
            <span className="hw-nname">
              {row.name}
              {row.auto && <span className="hx-auto">Auto</span>}
            </span>
            <span className="num hw-namt">{row.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PINS = [
  { left: 57, top: 9, icon: mdiCart, tone: 'mint', amount: 'RM293' },
  {
    left: 179,
    top: 38,
    icon: mdiShopping,
    tone: 'peach',
    amount: 'RM241',
  },
  {
    left: 19,
    top: 56,
    icon: mdiSilverwareForkKnife,
    tone: 'coral',
    amount: 'RM106',
  },
];

function PlacesCard() {
  return (
    <div className="hx-card hw-places">
      <CardHead title="Where you spend" link="Open map" />
      <div className="hw-map">
        <svg width="100%" height="90" viewBox="0 0 319 90" preserveAspectRatio="none" className="hw-map-svg">
          <path d="M0,63 C95.7,55.8 175.45,85.5 319,72" className="hw-road" strokeWidth="14" />
          <path d="M197.78,0 C191.4,36 239.25,54 223.3,90" className="hw-road" strokeWidth="10" />
          <path d="M47.85,0 L79.75,90" className="hw-road" strokeWidth="6" />
          <path d="M255.2,4.5 C287.1,27 303.05,36 319,34.2" className="hw-water" strokeWidth="8" />
        </svg>
        {PINS.map((pin) => (
          <span key={pin.amount} className="hw-pin" style={{ left: pin.left, top: pin.top }}>
            <HeroBubble size={26} glyph={15} icon={pin.icon} tone={pin.tone} />
            <span className="num">{pin.amount}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function WalletsCard() {
  return (
    <div className="hx-card hw-wallets">
      <CardHead title="Wallets" link="All wallets" />
      <div className="hw-check">
        <div className="hw-wrow-line">
          <HeroBubble size={32} glyph={18} icon={mdiBank} tone="block-lemon" />
          <span className="hw-wname">Maybank Savings</span>
          <span className="num hw-wamt">RM2,281.80</span>
        </div>
        <span className="hx-cap hw-check-cap">CHECK-IN · LAST DONE 40 DAYS AGO</span>
        <span className="num hw-check-q">Is Maybank Savings still RM2,281.80?</span>
        <div className="hw-check-actions">
          <span className="hx-btn hw-btn-mint">
            <MdiIcon path={mdiCheck} size={18} />
            That’s right
          </span>
          <span className="hx-btn hw-btn-paper">Fix it</span>
          <span className="hw-not-now">Not now</span>
        </div>
      </div>
      <div className="hw-wrow">
        <HeroBubble size={32} glyph={18} icon={mdiCellphone} tone="block-lilac" />
        <span className="hw-wname">Touch ’n Go eWallet</span>
        <span className="num hw-wamt">RM86.40</span>
      </div>
      <div className="hw-wrow">
        <HeroBubble size={32} glyph={18} icon={mdiCash} tone="block-mint" />
        <span className="hw-wname">Cash</span>
        <span className="num hw-wamt">RM63.60</span>
      </div>
      <span className="hw-grow" />
      <span className="hw-wnote">Wise USD keeps its own currency, on All wallets</span>
    </div>
  );
}
