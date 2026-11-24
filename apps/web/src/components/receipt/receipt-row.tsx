'use client';

import { receiptPath } from '@repo/core';
import { useRef, useState } from 'react';
import { Glyph } from '@/components/ledger/glyph';
import { signReceiptPhoto, useReceiptPhoto } from '@/lib/receipt-photo';
import { ReceiptViewer } from './receipt-viewer';
import './receipt.css';

/**
 * A transaction's receipt as the phone's detail link: the photo as the bubble, "Receipt photo" over "Open the
 * slip", opening the photo full screen. Nothing shows when no photo is uploaded; the web cannot add one yet.
 */
export function ReceiptRow({ stored, name }: { stored: string | null; name: string }) {
  const photo = useReceiptPhoto(stored);
  const thumb = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  if (receiptPath(stored) === null) return null;
  return (
    <>
      <button
        type="button"
        className="receipt-row press"
        onClick={() =>
          void (photo ? Promise.resolve(photo) : signReceiptPhoto(stored)).then((url) => {
            if (url) setOpen(url);
          })
        }
      >
        <span ref={thumb} className="receipt-thumb">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a user's own photo from storage, any size
            <img src={photo} alt="" />
          ) : (
            <Glyph name="receipt-text-outline" size={20} />
          )}
        </span>
        <span className="receipt-row-text">
          <b>Receipt photo</b>
          <span>Open the slip</span>
        </span>
        <Glyph name="chevron-right" size={20} />
      </button>
      {open && <ReceiptViewer src={open} alt={`Receipt from ${name}`} origin={thumb.current} onClosed={() => setOpen(null)} />}
    </>
  );
}

/** A receipt photo shown whole, as Review's source (the phone's check page header): a press opens it full screen. */
export function ReceiptPhotoButton({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const frame = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={frame} type="button" className={`receipt-photo press ${className ?? ''}`} aria-label="Open the receipt full screen" onClick={() => setOpen(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a user's own photo from storage, any size */}
        <img src={src} alt={alt} />
        <span className="receipt-expand" aria-hidden="true">
          <Glyph name="arrow-expand" size={18} />
        </span>
      </button>
      {open && <ReceiptViewer src={src} alt={alt} origin={frame.current} onClosed={() => setOpen(false)} />}
    </>
  );
}
