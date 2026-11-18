import { AI_USES, type AiConsentRow, type AiConsentScope, type AiUse } from '@repo/types';

/**
 * The user's choice about Moni's AI. `unasked` until the master switch has a row: a new user, or
 * one from before the opt-in existed. A use works only while the master and its own switch are on.
 */
export type AiConsent =
  | { kind: 'unasked' }
  | { kind: 'answered'; on: boolean; at: string; uses: Record<AiUse, boolean> };

export const UNASKED: AiConsent = { kind: 'unasked' };

/** The reason a gated AI call answers with, and the queue's cue to wait instead of retrying. */
export const AI_CONSENT_REASON = 'consent';

/** One row per scope, the newest, as `ai_consent_current` returns them. */
export function consentFromRows(rows: readonly AiConsentRow[]): AiConsent {
  const master = rows.find((row) => row.use === 'all');
  if (!master) return UNASKED;
  const granted = (use: AiUse) => rows.find((row) => row.use === use)?.granted === true;
  return {
    kind: 'answered',
    on: master.granted,
    at: master.created_at,
    uses: Object.fromEntries(AI_USES.map((use) => [use, granted(use)])) as Record<AiUse, boolean>,
  };
}

export function aiUseAllowed(consent: AiConsent, use: AiUse): boolean {
  return consent.kind === 'answered' && consent.on && consent.uses[use];
}

export type ConsentChange = Partial<Record<AiConsentScope, boolean>>;

/**
 * What "Turn on Moni's AI" on the opt-in page records. The first answer turns on everything the
 * page described; later, it turns on the master and the use that asked, and leaves the user's
 * other switches as they set them.
 */
export function turnOnFor(consent: AiConsent, use: AiUse): ConsentChange {
  if (consent.kind === 'unasked')
    return { all: true, ...Object.fromEntries(AI_USES.map((each) => [each, true])) };
  return { all: true, [use]: true };
}

/** "Not now": the first answer is recorded as off, so the record shows the user was asked. */
export function notNow(consent: AiConsent): ConsentChange {
  return consent.kind === 'unasked' ? { all: false } : {};
}

/** The choice once these changes land, for the switches to move before the server answers. */
export function applyChange(consent: AiConsent, change: ConsentChange, at: string): AiConsent {
  if (!Object.keys(change).length) return consent;
  const base =
    consent.kind === 'answered'
      ? consent
      : {
          kind: 'answered' as const,
          on: false,
          at,
          uses: Object.fromEntries(AI_USES.map((use) => [use, false])) as Record<AiUse, boolean>,
        };
  const uses = { ...base.uses };
  for (const use of AI_USES) if (change[use] !== undefined) uses[use] = change[use];
  return change.all === undefined
    ? { ...base, uses }
    : { kind: 'answered', on: change.all, at, uses };
}
