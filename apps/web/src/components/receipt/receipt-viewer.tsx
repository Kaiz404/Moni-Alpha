'use client';

import { Dialog, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '@/components/icon';
import { RESTING, clickZoom, containSize, flipFrom, viewTransform, wheelZoom, type View } from '@/lib/receipt-viewer';
import './receipt.css';

const EXPAND: KeyframeAnimationOptions = { duration: 280, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' };
const FADE: KeyframeAnimationOptions = { duration: 180, easing: 'ease' };
/** A press that travels further than this is a drag that pans, not a click that zooms. */
const DRAG_SLOP = 4;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The receipt full screen on black, as the phone's `ReceiptViewer`: it grows out of the thumbnail it was
 * opened from and shrinks back into it (a fade under Reduce motion). A click or the wheel zooms, a drag pans
 * the zoomed photo, and Esc, ×, or a click beside the photo closes it.
 */
export function ReceiptViewer({
  src,
  alt,
  origin,
  onClosed,
}: {
  src: string;
  alt: string;
  /** The thumbnail it grows out of; focus goes back to the button holding it. */
  origin: HTMLElement | null;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<View>(RESTING);
  const [dragging, setDragging] = useState(false);
  const photo = useRef<HTMLImageElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const closing = useRef(false);
  const grown = useRef(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const measure = useCallback(() => {
    const img = photo.current;
    const el = stage.current;
    if (!img || !el || !img.naturalWidth) return;
    const pad = getComputedStyle(el);
    const space = {
      width: el.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight),
      height: el.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom),
    };
    setSize(containSize(space, { width: img.naturalWidth, height: img.naturalHeight }));
  }, []);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  /** Where the photo sits at rest, whatever it is zoomed to now. */
  const restingBox = (img: HTMLImageElement) => {
    const box = img.getBoundingClientRect();
    return { x: box.left - view.x, y: box.top - view.y, width: box.width / view.scale, height: box.height / view.scale };
  };
  const flip = () => {
    const img = photo.current;
    const from = origin?.isConnected ? origin.getBoundingClientRect() : null;
    if (!img || !from || from.width === 0) return 'none';
    return flipFrom(from, restingBox(img));
  };
  /** The pointer on the photo's resting box, the point a zoom keeps under it. */
  const pointer = (event: { clientX: number; clientY: number }) => {
    const box = restingBox(photo.current!);
    return { x: event.clientX - box.x, y: event.clientY - box.y };
  };

  const grow = () => {
    const img = photo.current;
    if (!img) return;
    if (reduced()) {
      img.animate([{ opacity: 0 }, { opacity: 1 }], FADE);
      return;
    }
    img.animate([{ transform: flip(), opacity: 0.4 }, { transform: 'none', opacity: 1 }], EXPAND);
    stage.current?.animate([{ backgroundColor: 'rgba(0, 0, 0, 0)' }, { backgroundColor: 'rgb(0, 0, 0)' }], EXPAND);
  };

  // The photo grows once it has its size, so it lands where it rests.
  useLayoutEffect(() => {
    if (!size || grown.current) return;
    grown.current = true;
    grow();
  });

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const img = photo.current;
    const done = () => setOpen(false);
    if (!img || reduced()) {
      const fade = stage.current?.animate([{ opacity: 1 }, { opacity: 0 }], { ...FADE, fill: 'forwards' });
      return fade ? void fade.finished.then(done, done) : done();
    }
    const shrink = img.animate([{ transform: viewTransform(view) }, { transform: flip(), opacity: 0.4 }], { ...EXPAND, fill: 'forwards' });
    stage.current?.animate([{ backgroundColor: 'rgb(0, 0, 0)' }, { backgroundColor: 'rgba(0, 0, 0, 0)' }], { ...EXPAND, fill: 'forwards' });
    void shrink.finished.then(done, done);
  };

  // A native listener, since React's wheel listener is passive and the page must not scroll under the photo.
  const wheel = useRef((event: WheelEvent) => void event);
  wheel.current = (event) => {
    event.preventDefault();
    if (photo.current) setView(wheelZoom(view, pointer(event), event.deltaY));
  };
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stage.current = el;
    if (!el) return;
    const listen = (event: WheelEvent) => wheel.current(event);
    el.addEventListener('wheel', listen, { passive: false });
    return () => el.removeEventListener('wheel', listen);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (event.button !== 0) return;
    press.current = { x: event.clientX, y: event.clientY, view, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    const start = press.current;
    if (!start || start.view.scale === 1) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    start.moved = true;
    setDragging(true);
    setView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLImageElement>) => {
    const start = press.current;
    press.current = null;
    setDragging(false);
    if (!start || start.moved) return;
    setView(clickZoom(view, pointer(event)));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) onClosed();
      }}
    >
      <DialogContent
        className="receipt-viewer"
        finalFocus={() => origin?.closest('button') ?? origin}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DialogTitle className="sr-only">Receipt photo</DialogTitle>
        <div
          ref={stageRef}
          className="receipt-stage"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a user's own photo from storage, any size */}
          <img
            ref={photo}
            src={src}
            alt={alt}
            draggable={false}
            className="receipt-full"
            data-zoomed={view.scale > 1 || undefined}
            data-dragging={dragging || undefined}
            style={size ? { ...size, transform: viewTransform(view) } : { visibility: 'hidden' }}
            onLoad={measure}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              press.current = null;
              setDragging(false);
            }}
          />
        </div>
        <DialogClose className="receipt-close press" aria-label="Close the receipt" autoFocus>
          <Icon name="close" size={22} />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
