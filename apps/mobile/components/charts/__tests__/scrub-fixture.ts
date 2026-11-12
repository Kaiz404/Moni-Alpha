import { act } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

/**
 * A finger on a range chart, one event at a time as the phone sends them, so a test can read the
 * tooltip while the finger is still down. `chart` is the plot's prefix, as `home.chart`.
 */
export function finger(chart: string) {
  const emit = (gesture: 'drag' | 'hold', event: object) =>
    DeviceEventEmitter.emit('onGestureHandlerEvent', {
      handlerTag: getByGestureTestId(`${chart}.${gesture}`).handlerTag,
      numberOfPointers: 1,
      y: 80,
      translationY: 0,
      ...event,
    });
  // A gesture rebuilt by the last render reaches the handler registry a tick later, as on a phone.
  const send = (run: () => void) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      run();
    });
  let active: 'drag' | 'hold' | null = null;
  return {
    /** The finger lands; neither gesture has started yet. */
    down: (x: number) =>
      send(() => {
        emit('drag', { oldState: State.UNDETERMINED, state: State.BEGAN, x });
        emit('hold', { oldState: State.UNDETERMINED, state: State.BEGAN, x });
      }),
    /** A sideways move past the slop: the drag starts and the hold fails. */
    drag: (x: number) =>
      send(() => {
        active = 'drag';
        emit('drag', { oldState: State.BEGAN, state: State.ACTIVE, x });
        emit('hold', { oldState: State.BEGAN, state: State.FAILED, x });
      }),
    /** Still for 200 ms: the hold starts and cancels the drag. */
    hold: (x: number) =>
      send(() => {
        active = 'hold';
        emit('hold', { oldState: State.BEGAN, state: State.ACTIVE, x });
        emit('drag', { oldState: State.BEGAN, state: State.CANCELLED, x });
      }),
    move: (x: number) => send(() => emit(active!, { state: State.ACTIVE, x })),
    up: (x: number) =>
      send(() => {
        if (active) emit(active, { oldState: State.ACTIVE, state: State.END, x });
        else {
          emit('drag', { oldState: State.BEGAN, state: State.FAILED, x });
          emit('hold', { oldState: State.BEGAN, state: State.FAILED, x });
        }
        active = null;
      }),
    /** The finger heads up the page before either gesture starts. */
    scroll: (x: number) =>
      send(() => {
        emit('drag', { oldState: State.BEGAN, state: State.FAILED, x, translationY: -20 });
        emit('hold', { oldState: State.BEGAN, state: State.FAILED, x, translationY: -20 });
      }),
  };
}
