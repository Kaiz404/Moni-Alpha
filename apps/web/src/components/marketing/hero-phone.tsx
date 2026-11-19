import { mdiBattery, mdiChevronRight, mdiMedicalBag, mdiSignal, mdiSilverwareForkKnife, mdiWifi } from '@mdi/js';
import { Cat } from '@/components/brand';
import { HeroBubble } from './hero-parts';
import { MdiIcon } from './parts';

const ROWS = [
  { icon: mdiSilverwareForkKnife, tone: 'coral', name: 'Mamak Ali', meta: 'Today, Cash', amount: '−RM13.20' },
  { icon: mdiMedicalBag, tone: 'pink', name: 'Guardian', meta: 'Yesterday', amount: '−RM15.90' },
  { icon: mdiSilverwareForkKnife, tone: 'coral', name: 'GRAB*FOOD', meta: 'Yesterday', amount: '−RM45.90' },
];

/** The phone's Home: safe to spend today, the review pill and Recent. RM24's digits settle as the hero opens. */
export function HeroPhone() {
  return (
    <div className="hero-ph">
      <div className="hp-status">
        <span>2:06</span>
        <span className="hp-status-icons">
          <MdiIcon path={mdiSignal} size={13} />
          <MdiIcon path={mdiWifi} size={13} />
          <MdiIcon path={mdiBattery} size={13} />
        </span>
      </div>
      <div className="hp-screen">
        <div className="hp-head">
          <span className="hp-me">K</span>
          <span className="hp-hello">
            <span className="hp-date">Wednesday, 14 Oct</span>
            <span className="hp-name">Afternoon, Kai</span>
          </span>
          <span className="hp-ask">
            <Cat size={24} ground="dark" id="lp-hero-ph" />
          </span>
        </div>
        <div className="hp-safe">
          <span className="hx-cap">SAFE TO SPEND TODAY</span>
          <span className="hp-amount num">
            <span className="hp-digits">
              {[...'RM24'].map((ch, i) => (
                <span key={i} className="hp-dgm">
                  <span className="hp-dg">{ch}</span>
                </span>
              ))}
            </span>
            <span className="hp-sub hp-per">a day</span>
          </span>
          <span className="hp-bar">
            <span className="hp-fill" />
          </span>
          <span className="num hp-sub hp-left">RM443 left for 18 days</span>
        </div>
        <div className="hp-review">
          <span className="hp-review-text">
            <span className="hp-review-title">3 to review</span>
            <span className="num hp-review-sub">RM115.80 waiting</span>
          </span>
          <span className="hx-btn hw-btn-ink hp-review-btn">
            Review
            <MdiIcon path={mdiChevronRight} size={16} />
          </span>
        </div>
        <div className="hp-rows">
          {ROWS.map((row) => (
            <div key={row.name} className="hp-row">
              <HeroBubble size={34} glyph={17} icon={row.icon} tone={row.tone} />
              <span className="hx-rt">
                <span className="hx-rn hp-rn">{row.name}</span>
                <span className="hx-rm hp-rm">{row.meta}</span>
              </span>
              <span className="num hp-amt">{row.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
