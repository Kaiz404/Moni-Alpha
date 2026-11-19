'use client';

import { useState } from 'react';

/** The settings card's AI row. A sample: it switches here and changes nothing on the visitor's account. */
export function PrivacyAiSwitch() {
  const [on, setOn] = useState(true);
  return (
    <button type="button" role="switch" aria-checked={on} className="pv-row pv-row-button" onClick={() => setOn(!on)}>
      <span className="pv-row-text">
        <span className="pv-row-title">Read alerts, receipts and voice with AI</span>
        <span className="pv-row-sub" aria-live="polite">
          {on ? 'On. Moni asked before the first one.' : 'Off. Typing still works. Alerts, receipts and voice need it.'}
        </span>
      </span>
      <span className="pv-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
