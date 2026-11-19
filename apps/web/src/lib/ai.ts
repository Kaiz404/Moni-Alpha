'use client';

import { syncState, when } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { createAiClient, withConsent, type AiClient } from '@repo/ai';
import { aiUseAllowed, applyChange, UNASKED, type AiConsent, type ConsentChange } from '@repo/core';
import { recordAiConsent } from '@repo/data';
import type { AiUse } from '@repo/types';
import { moniStore } from '@/lib/moni-store';

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL?.replace(/\/$/, '') ?? '';

/** How long the first consent fetch may take before the user counts as unasked. */
const FIRST_FETCH_MS = 5_000;

/** The choice as this tab knows it. Nothing known yet reads as unasked, so nothing is sent. */
export async function currentAiConsent(): Promise<AiConsent> {
  const consent$ = moniStore().aiConsent$;
  const known = consent$.peek();
  if (known) return known;
  const state$ = syncState(consent$);
  await Promise.race([
    when(() => consent$.get() !== undefined || state$.error.get() !== undefined),
    new Promise((resolve) => setTimeout(resolve, FIRST_FETCH_MS)),
  ]);
  return consent$.peek() ?? UNASKED;
}

/** Undefined until the first fetch lands. */
export function useAiConsent(): AiConsent | undefined {
  return useValue(moniStore().aiConsent$);
}

/** True once the consent rows have pulled (or failed to), so a switch never starts from a guess. */
export function useAiConsentSettled(): boolean {
  return useValue(() => {
    const state = syncState(moniStore().aiConsent$);
    return state.isLoaded.get() || Boolean(state.error.get());
  });
}

/**
 * Moves the switches at once, records the change, then refreshes the session so the next AI call
 * carries the new `ai_consent` claim. A refused change moves the switches back and throws.
 */
export async function changeAiConsent(change: ConsentChange): Promise<void> {
  if (!Object.keys(change).length) return;
  const store = moniStore();
  const before = store.aiConsent$.peek() ?? UNASKED;
  store.aiConsent$.set(applyChange(before, change, new Date().toISOString()));
  try {
    await recordAiConsent(store.supabase, change);
  } catch (error) {
    store.aiConsent$.set(before);
    throw error;
  }
  await store.supabase.auth.refreshSession().catch(() => {});
  await syncState(store.aiConsent$).get().sync?.();
}

const unavailable: AiClient = {
  extractFromText: async () => ({ status: 'unavailable', reason: 'no AI gateway' }),
  extractFromImage: async () => ({ status: 'unavailable', reason: 'no AI gateway' }),
  extractFromNotification: async () => ({ status: 'unavailable', reason: 'no AI gateway' }),
  analyzeFinances: async () => ({ status: 'unavailable', reason: 'no AI gateway' }),
  suggestBudget: async () => ({ status: 'unavailable', reason: 'no AI gateway' }),
};

/** The gateway client for one use, asking the user's consent before every call. */
export function webAiClient(use: AiUse): AiClient {
  const consent = async () => aiUseAllowed(await currentAiConsent(), use);
  if (!AI_API_URL) return withConsent(unavailable, consent);
  const supabase = moniStore().supabase;
  return createAiClient({
    baseUrl: AI_API_URL,
    getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    encodeImage: async () => null,
    consent,
  });
}
