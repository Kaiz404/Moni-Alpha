import {Composition} from 'remotion';
import {FPS} from '../../brand';
import {loops} from './shots';
import {layouts, Still} from './Still';
import {totalFrames} from './timeline';

export const compositions = (
  <>
    {loops.map((loop) => (
      <Composition
        key={loop.id}
        id={loop.id}
        component={Still}
        defaultProps={{frame: loop.frame, shots: loop.shots}}
        width={layouts[loop.frame].width}
        height={layouts[loop.frame].height}
        fps={FPS}
        durationInFrames={totalFrames(loop.shots)}
      />
    ))}
  </>
);
