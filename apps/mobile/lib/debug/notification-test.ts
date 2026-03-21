import { runNotificationOrchestration } from '@/lib/ai/notification-orchestrator';
import { getOrLoadModel } from '@/lib/ai/model-manager';
import type { RawNotification } from '@/lib/ai/notification-processor';
import type { LogFn, DebugTestResult } from './types';

type TestCase = {
  id: string;
  app: string;
  text: string;
  expectedCreated: boolean;
};

const SAMPLE_NOTIFICATIONS: TestCase[] = [
  {
    id: '1',
    app: 'Touch n Go',
    text: 'You paid 15 USD to Amazon for order #1234.',
    expectedCreated: true,
  },
  {
    id: '2',
    app: 'My Wallet',
    text: 'Your account has been credited with 250 NGN from John.',
    expectedCreated: true,
  },
  {
    id: '3',
    app: 'ShopPromo',
    text: "Don't miss our sale this weekend!",
    expectedCreated: false,
  },
  {
    id: '4',
    app: 'AuthService',
    text: 'Your OTP is 123456. Do not share.',
    expectedCreated: false,
  },
];

export type NotificationTestCaseResult = {
  id: string;
  text: string;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  traces: string[];
};

export async function runNotificationTests(log: LogFn): Promise<DebugTestResult> {
  log('Loading model for notification tests...');
  const model = await getOrLoadModel();
  if (!model) {
    log('Model not available — cannot run notification tests');
    return { success: false, summary: 'Model not available' };
  }

  const results: NotificationTestCaseResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of SAMPLE_NOTIFICATIONS) {
    log(`\n--- Test ${tc.id}: ${tc.app} ---`);
    log(`Input: "${tc.text}"`);
    log(`Expected: ${tc.expectedCreated ? 'TRANSACTION' : 'NOT transaction'}`);

    const traces: string[] = [];

    try {
      const notification: RawNotification = {
        id: tc.id,
        app: tc.app,
        title: tc.app,
        text: tc.text,
        time: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
      };

      const result = await runNotificationOrchestration(model as any, notification, {
        trace: (event) => {
          const line = `${event.stage}.${event.event}${event.details ? ' ' + JSON.stringify(event.details) : ''}`;
          traces.push(line);
          log(`  [trace] ${line}`);
        },
        adapters: {
          getWallets: async () => [
            { id: 'w1', name: 'Touch n Go' },
            { id: 'w2', name: 'My Wallet' },
          ],
          createProposedTransaction: async () => ({ status: 'ok' }),
        },
      });

      const testPassed = result.created === tc.expectedCreated;
      log(`Result: created=${result.created} | ${testPassed ? 'PASS' : 'FAIL'}`);

      if (testPassed) passed++;
      else failed++;

      results.push({
        id: tc.id,
        text: tc.text,
        expected: tc.expectedCreated,
        actual: result.created,
        passed: testPassed,
        traces,
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      log(`ERROR: ${msg}`);
      failed++;
      results.push({
        id: tc.id,
        text: tc.text,
        expected: tc.expectedCreated,
        actual: false,
        passed: false,
        traces: [`error: ${msg}`],
      });
    }
  }

  log(`\n=== Results: ${passed}/${SAMPLE_NOTIFICATIONS.length} passed ===`);

  const allPassed = failed === 0;
  return {
    success: allPassed,
    summary: `${passed}/${SAMPLE_NOTIFICATIONS.length} tests passed${failed > 0 ? ` (${failed} failed)` : ''}`,
    details: JSON.stringify(results, null, 2),
  };
}
