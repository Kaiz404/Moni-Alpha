import { Icon } from '@/components/icon';
import { PanelCat } from './auth-frame';

/** The panel beside Create account and Check your email: what Moni does, drawn with sample figures. */
export function PromoPanel() {
  return (
    <aside className="auth-panel" aria-label="About Moni">
      <span className="auth-panel-kicker">Moni, on the web and your phone</span>
      <h2>Know what&apos;s safe to spend.</h2>
      <p>Type it, snap a receipt, or let bank alerts do it. Moni sorts every payment and keeps one plain number.</p>
      <div className="promo-card" aria-hidden="true">
        <span className="caps">Safe to spend today</span>
        <div className="num" style={{ fontSize: 52, lineHeight: '56px', fontWeight: 700, letterSpacing: '-0.03em', marginTop: 6 }}>
          RM24
        </div>
        <div style={{ fontSize: 15, color: 'var(--color-ink-2)' }}>RM443 left for 18 days, RM24 a day</div>
        <div className="promo-track">
          <span />
        </div>
        <div className="meta">RM1,116.20 of RM1,800 spent in October</div>
        <div className="promo-capture">
          <span className="promo-bubble">
            <Icon name="silverware-fork-knife" size={20} />
          </span>
          <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: 15 }}>GRAB*FOOD</strong>
            <span style={{ fontSize: 13, color: 'var(--color-on-lilac)' }}>Usual for you</span>
          </span>
          <strong className="num" style={{ fontSize: 15 }}>
            RM23.40
          </strong>
          <span className="promo-approve">
            <Icon name="check" size={18} />
            Approve
          </span>
        </div>
      </div>
      <PanelCat />
    </aside>
  );
}
