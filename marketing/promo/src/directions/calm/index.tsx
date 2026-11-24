import {Composition} from 'remotion';
import {FPS} from '../../brand';
import {CalmFilm} from './CalmFilm';
import {heroShots} from './shots';
import {starts} from './timeline';

const frames = Math.round(starts(heroShots).total * FPS);

export const compositions = (
  <>
    <Composition id="CalmHero" component={CalmFilm} defaultProps={{shots: heroShots, layout: 'portrait' as const}} width={1080} height={1920} fps={FPS} durationInFrames={frames} />
    <Composition id="CalmHeroLandscape" component={CalmFilm} defaultProps={{shots: heroShots, layout: 'landscape' as const}} width={1920} height={1080} fps={FPS} durationInFrames={frames} />
  </>
);
