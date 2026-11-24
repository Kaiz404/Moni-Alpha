import {Composition} from 'remotion';
import {FPS} from '../../brand';
import {CalloutFilm} from './CalloutFilm';
import {cuts, totalDur} from './shots';

export const compositions = (
  <>
    {cuts.map((cut) => (
      <Composition
        key={cut.id}
        id={cut.id}
        component={CalloutFilm}
        defaultProps={{cut}}
        width={cut.layout === 'portrait' ? 1080 : 1920}
        height={cut.layout === 'portrait' ? 1080 * (16 / 9) : 1080}
        fps={FPS}
        durationInFrames={Math.round(totalDur(cut.shots) * FPS)}
      />
    ))}
  </>
);
