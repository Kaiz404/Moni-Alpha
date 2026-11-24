import {Composition} from 'remotion';
import {Probe} from './Probe';

export const BenchRoot = () => (
  <>
    <Composition id="Probe" component={Probe} width={640} height={200} fps={30} durationInFrames={1} />
  </>
);
