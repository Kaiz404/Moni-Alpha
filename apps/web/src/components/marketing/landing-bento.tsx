import './bento.css';
import { BentoCard } from './bento-card';
import { BentoChat } from './bento-chat';
import { BentoChart, BentoDebts, BentoFan, BentoReceipt } from './bento-visuals';
import { LandingH2 } from './parts';

export function LandingBento() {
  return (
    <section id="how" aria-labelledby="how-h" className="lp-sec">
      <div className="bn-intro">
        <LandingH2 id="how-h">Built for the minute after you pay.</LandingH2>
        <p className="lp-body bn-intro-body">
          Add on your phone in a few taps. Sort on the web with a keyboard and big tables. Same account on both.
        </p>
      </div>
      <div className="bn-grid">
        <BentoCard
          kind="fan"
          title="Four ways in, one list to check"
          body="Type it, say it, snap the receipt, or let your bank’s alerts do it. Every one lands in Review the same way."
          replayLabel="Replay the four ways in"
        >
          <BentoFan />
        </BentoCard>
        <BentoCard kind="snap" title="Snap a receipt" body="Moni reads the shop and the total, then files it." replayLabel="Replay the receipt">
          <BentoReceipt />
        </BentoCard>
        <BentoCard
          kind="bars"
          title="Every month, side by side"
          body="October so far against the five months before it, under your budget line."
          replayLabel="Replay the chart"
        >
          <BentoChart />
        </BentoCard>
        <BentoCard
          kind="chat"
          title="Ask Moni to change things"
          body="Moni chat drafts the change on every row it found. Nothing changes until you approve it."
          replayLabel="Replay the chat"
        >
          <BentoChat />
        </BentoCard>
        <BentoCard
          kind="debts"
          title="Who owes you, and when"
          body="Note a debt once. Moni reminds you the day before it’s due."
          replayLabel="Replay the reminder"
        >
          <BentoDebts />
        </BentoCard>
      </div>
    </section>
  );
}
