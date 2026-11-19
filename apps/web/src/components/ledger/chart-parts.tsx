'use client';

import { nearestDay, type ChartLabel, type ChartTickMark } from '@repo/core';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * The element's size, kept current by a ResizeObserver; 0 × 0 until it is laid out. A callback ref, so
 * the observer follows the element React actually mounts, also after a hydration retry replaces it.
 */
export function useSize<T extends HTMLElement>(): [(element: T | null) => void, { width: number; height: number }] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.contentRect;
      setSize((current) =>
        Math.round(current.width) === Math.round(box.width) && Math.round(current.height) === Math.round(box.height)
          ? current
          : { width: Math.round(box.width), height: Math.round(box.height) },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, size];
}

/** The money labels in the axis column, right-aligned, one per gridline. */
export function AxisLabels({ labels, axis }: { labels: readonly ChartLabel[]; axis: number }) {
  return (
    <>
      {labels.map((label, index) => (
        <span key={index} className="chart-label num" data-tone={label.tone} style={{ top: label.y - 8, width: axis }}>
          {label.text}
        </span>
      ))}
    </>
  );
}

/** Dates under the plot, Today in bold. */
export function TickRow({ ticks }: { ticks: readonly ChartTickMark[] }) {
  return (
    <div className="chart-ticks" aria-hidden="true">
      {ticks.map((tick) => (
        <span key={tick.text} className="num" data-today={tick.today || undefined} style={{ left: tick.x - 30 }}>
          {tick.text}
        </span>
      ))}
    </div>
  );
}

/**
 * The pointer tooltip (W2-Features, Hover tooltips on charts): nothing at rest; pointing snaps to the
 * nearest day, and the Ink callout follows the pointer along the top of the plot.
 */
export function useHoverDay<D extends { x: number }>(days: readonly D[]) {
  const [day, setDay] = useState<D | null>(null);
  const handlers = {
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      setDay(nearestDay(days, event.clientX - box.left));
    },
    onPointerLeave: () => setDay(null),
  };
  return [day, handlers] as const;
}

export function Callout({ x, width, date, value }: { x: number; width: number; date: string; value: string }) {
  const left = Math.max(0, Math.min(width - 112, x - 56));
  return (
    <span className="chart-tip" role="status" style={{ left }}>
      <span className="chart-tip-date">{date}</span>
      <span className="num chart-tip-value">{value}</span>
    </span>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <p className="chart-empty">{children}</p>;
}
