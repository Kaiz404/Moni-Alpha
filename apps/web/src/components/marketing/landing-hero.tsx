import { HeroPhone } from './hero-phone';
import { HeroWindow } from './hero-window';
import { Moment, ReplayButton } from './moment';
import { StorePill, WebButton } from './parts';
import './hero.css';

/** W2-LandingL1's hero: the promise, the two ways in, then the web Home rising with the phone settling RM24. */
export function LandingHero() {
  return (
    <section id="hero" aria-labelledby="hero-h" className="lp-hero">
      <div className="hero-text">
        <h1 id="hero-h" className="hero-h1">
          Know what’s safe <br className="hero-br" />
          to spend, every day.
        </h1>
        <p className="hero-lede">
          Type it, snap it, say it, or let Moni read your bank alerts. Moni <span className="hero-wide">files each payment and </span>
          tells you what you can spend today.
        </p>
        <div className="lp-actions hero-actions">
          <StorePill />
          <WebButton />
        </div>
        <span className="hero-small">On the web now, Android app coming soon. Any currency, you pick the main one.</span>
      </div>
      <Moment autoplay className="hero-stage">
        <div className="hero-scene" aria-hidden="true">
          <div className="hero-scale">
            <HeroWindow />
            <HeroPhone />
          </div>
        </div>
        <div className="hero-replay">
          <ReplayButton label="Replay the opening" />
        </div>
      </Moment>
    </section>
  );
}
