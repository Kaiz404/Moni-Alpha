import {Composition} from 'remotion';
import {FPS} from '../../brand';
import {EditorialFilm} from './EditorialFilm';
import {cutLength, editorialCuts} from './shots';

export const compositions = (
  <>
    {Object.entries(editorialCuts).map(([id, e]) => (
      <Composition
        key={id}
        id={id}
        component={EditorialFilm}
        defaultProps={{cut: e.cut, layout: e.layout}}
        width={e.layout === 'portrait' ? 1080 : 1920}
        height={e.layout === 'portrait' ? 1920 : 1080}
        fps={FPS}
        durationInFrames={Math.round(cutLength(e.cut) * FPS)}
      />
    ))}
  </>
);
