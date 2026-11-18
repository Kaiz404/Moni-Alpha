import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { countNeedsAi } from '@/lib/ai/processing-queue';
import { currentAiConsent } from '@/lib/ai/consent/state';

let asked = false;

async function askOnce() {
  if (asked || countNeedsAi('alerts') === 0) return;
  if ((await currentAiConsent()).kind !== 'unasked') return;
  asked = true;
  router.push({ pathname: '/ai-consent', params: { use: 'alerts' } });
}

/**
 * A bank alert is the first AI use that happens with no one watching: it waits in the queue as
 * `needs_ai`. The next time the app is open, a user who was never asked sees the opt-in page,
 * once per launch.
 */
export function AlertsConsentPrompt() {
  useEffect(() => {
    void askOnce();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void askOnce();
    });
    return () => sub.remove();
  }, []);
  return null;
}
