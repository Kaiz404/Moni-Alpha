import { syncState, when } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { recordAiConsent } from '@repo/data';
import type { AiUse } from '@repo/types';

import { aiConsent$ } from '@/lib/store';
import { supabase } from '@/lib/supabase/client';

import { aiUseAllowed, applyChange, UNASKED, type AiConsent, type ConsentChange } from '@repo/core';

/** A fresh install waits this long for the first fetch before it treats the user as unasked. */
const FIRST_FETCH_MS = 5_000;

/** The choice as this phone knows it. Nothing known yet reads as unasked, so nothing is sent. */
export async function currentAiConsent(): Promise<AiConsent> {
  const known = aiConsent$.peek();
  if (known) return known;
  const state$ = syncState(aiConsent$);
  await Promise.race([
    when(() => aiConsent$.get() !== undefined || state$.error.get() !== undefined),
    new Promise((resolve) => setTimeout(resolve, FIRST_FETCH_MS)),
  ]);
  return aiConsent$.peek() ?? UNASKED;
}

export async function aiUseAllowedNow(use: AiUse): Promise<boolean> {
  return aiUseAllowed(await currentAiConsent(), use);
}

export function useAiConsent(): AiConsent | undefined {
  return useValue(aiConsent$);
}

/**
 * Moves the switches at once, records the change, then refreshes the session so the next AI call
 * carries the new `ai_consent` claim. A change the server refused moves the switches back and
 * throws.
 */
export async function changeAiConsent(change: ConsentChange): Promise<void> {
  if (!Object.keys(change).length) return;
  const before = aiConsent$.peek() ?? UNASKED;
  aiConsent$.set(applyChange(before, change, new Date().toISOString()));
  try {
    await recordAiConsent(supabase, change);
  } catch (error) {
    aiConsent$.set(before);
    throw error;
  }
  await supabase.auth.refreshSession().catch(() => {});
  await syncState(aiConsent$).get().sync?.();
}
