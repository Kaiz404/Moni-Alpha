import {Composition} from 'remotion';
import {FPS} from './brand';
import {compositions as callouts} from './directions/callouts';
import {compositions as calm} from './directions/calm';
import {compositions as editorial} from './directions/editorial';
import {compositions as still} from './directions/still';
import {Film} from './film/Film';
import {shotStarts} from './film/timeline';
import {videos} from './videos';

export const Root = () => (
  <>
    {videos.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Film}
        defaultProps={{video: v}}
        width={v.layout === 'portrait' ? 1080 : 1920}
        height={v.layout === 'portrait' ? 1920 : 1080}
        fps={FPS}
        durationInFrames={Math.round(shotStarts(v.shots).total * FPS)}
      />
    ))}
    {calm}
    {still}
    {editorial}
    {callouts}
  </>
);
