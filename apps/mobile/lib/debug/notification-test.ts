import { runExtraction } from '@/lib/ai/run-extraction';
import type { RawNotification } from '@/lib/ai/notification-types';
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

export async function runNotificationTests(log: LogFn): Promise<DebugTestResult> {
  log('Running notification extraction via AI client (mock until Go backend exists)...');

  let passed = 0;
  for (const tc of SAMPLE_NOTIFICATIONS) {
    const notification: RawNotification = {
      id: `test-${tc.id}`,
      app: tc.app,
      title: tc.app,
      text: tc.text,
      time: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };

    const result = await runExtraction({
      id: `queue-${tc.id}`,
      type: 'notification',
      notification,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    // With mock backend, extraction is unavailable — expect skip for all.
    const actualCreated = result.created;
    const ok = actualCreated === false; // mock cannot create yet
    if (ok) passed++;
    log(
      `[${tc.id}] app=${tc.app} created=${actualCreated} reason=${result.reason} (expectedCreated=${tc.expectedCreated})`,
    );
  }

  return {
    success: passed === SAMPLE_NOTIFICATIONS.length,
    summary: `${passed}/${SAMPLE_NOTIFICATIONS.length} cases skipped as expected while AI backend is mocked`,
  };
}
