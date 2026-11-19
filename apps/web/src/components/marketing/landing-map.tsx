import { MapPlaces } from './map-places';
import { Moment, ReplayButton } from './moment';
import { LandingH2 } from './parts';
import './map.css';

export function LandingMap() {
  return (
    <section id="map" aria-labelledby="map-h" className="lp-sec mp-sec">
      <div className="mp-head">
        <LandingH2 id="map-h">See where the money went.</LandingH2>
        <p className="lp-body">Payments with a place land on the map. Point at a place to light its pin.</p>
      </div>
      <Moment className="mp-moment">
        <MapPlaces />
        <ReplayButton label="Replay the map" />
      </Moment>
    </section>
  );
}
