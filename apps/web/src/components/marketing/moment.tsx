'use client';

import { mdiReplay } from '@mdi/js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MdiIcon } from './parts';

type MomentApi = {
  /** True from the first time the moment comes into view (or at once with `autoplay`). */
  playing: boolean;
  replay: () => void;
  /** True after Replay was pressed: the remounted Replay button takes focus back. */
  refocus: boolean;
};

const MomentContext = createContext<MomentApi>({ playing: false, replay: () => {}, refocus: false });

export function useMoment(): MomentApi {
  return useContext(MomentContext);
}

/**
 * One of the landing page's moments. Its markup rests at the moment's end, so it reads without JS. The first
 * time it scrolls into view it plays once: `data-play="on"` starts the CSS animations under it, and children
 * that step through states start their timers on mount when `useMoment().playing` is true. Replay remounts
 * the children, which restarts both.
 */
export function Moment({ children, autoplay = false, className }: { children: ReactNode; autoplay?: boolean; className?: string }) {
  const [run, setRun] = useState(autoplay ? 1 : 0);
  const [refocus, setRefocus] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (run > 0 || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setRun(1);
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [run]);

  return (
    <MomentContext.Provider value={{
        playing: run > 0,
        refocus,
        replay: () => {
          setRefocus(true);
          setRun((n) => n + 1);
        },
      }}>
      <div ref={ref} key={run} className={['moment', className].filter(Boolean).join(' ')} data-play={run > 0 ? 'on' : 'off'}>
        {children}
      </div>
    </MomentContext.Provider>
  );
}

export function ReplayButton({ label, onDeep = false }: { label: string; onDeep?: boolean }) {
  const { replay, refocus } = useMoment();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (refocus) button.current?.focus({ preventScroll: true });
  }, [refocus]);
  return (
    <button ref={button} type="button" className={onDeep ? 'lp-replay lp-replay-deep pr' : 'lp-replay pr'} onClick={replay} aria-label={label}>
      <MdiIcon path={mdiReplay} size={18} />
      Replay
    </button>
  );
}
