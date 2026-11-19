import { buildChatSnapshot } from '@repo/core';
import { getAiClient } from '@/lib/ai/client';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { financeProjection$ } from '@/lib/finance/projection';
import { getUserId } from '@/lib/supabase/client';
import { profilePreferences$ } from '@/lib/store';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';
import { exportHistoryForApi } from './messages';

export type AnalyzeFinancesResult = { ok: true; reply: string } | { ok: false; reason: string };

export async function analyzeUserFinances(message: string): Promise<AnalyzeFinancesResult> {
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false, reason: 'Not authenticated' };
    const snapshot = buildChatSnapshot({
      projection: financeProjection$.peek(),
      userId,
      overrides: listRecurringOverrides(userId),
      message,
      now: new Date(),
      calendar: deviceCalendar,
    });

    const result = await getAiClient('chat').analyzeFinances({
      message,
      snapshot,
      history: exportHistoryForApi(),
      tone: profilePreferences$.peek()?.moni_tone,
    });

    if (result.status === 'ok') {
      return { ok: true, reply: result.reply };
    }
    return { ok: false, reason: result.reason };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Analysis failed',
    };
  }
}
