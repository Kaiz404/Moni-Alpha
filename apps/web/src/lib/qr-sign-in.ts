import { z } from 'zod';

/**
 * Sign in with your phone: the browser's half. `qr-start` opens a request, `qr-poll` answers with the
 * newest code (it rotates every 60 s) until the phone approves, then hands out a magic-link token hash
 * once. Contract: docs/ARCHITECTURE.md § Auth.
 */
export const POLL_MS = 3000;

const startSchema = z.object({
  pollSecret: z.string().min(1),
  code: z.string().min(1),
  codeExpiresAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const pollSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('waiting'), code: z.string().min(1), codeExpiresAt: z.string().datetime() }),
  z.object({ status: z.literal('approved'), tokenHash: z.string().min(1) }),
  z.object({ status: z.literal('expired') }),
]);

export type QrStart = z.infer<typeof startSchema>;
export type QrPoll = z.infer<typeof pollSchema>;

export const parseQrStart = (body: unknown): QrStart => startSchema.parse(body);
export const parseQrPoll = (body: unknown): QrPoll => pollSchema.parse(body);

export type QrState =
  | { kind: 'starting' }
  | { kind: 'showing'; pollSecret: string; code: string; codeExpiresAt: number; expiresAt: number }
  | { kind: 'approved'; tokenHash: string }
  | { kind: 'expired' }
  | { kind: 'failed'; message: string };

export type QrEvent =
  | { type: 'started'; start: QrStart }
  | { type: 'polled'; poll: QrPoll }
  | { type: 'failed'; message: string }
  | { type: 'restart' };

export function qrReducer(state: QrState, event: QrEvent): QrState {
  switch (event.type) {
    case 'restart':
      return { kind: 'starting' };
    case 'failed':
      return { kind: 'failed', message: event.message };
    case 'started':
      return {
        kind: 'showing',
        pollSecret: event.start.pollSecret,
        code: event.start.code,
        codeExpiresAt: Date.parse(event.start.codeExpiresAt),
        expiresAt: Date.parse(event.start.expiresAt),
      };
    case 'polled': {
      if (state.kind !== 'showing') return state;
      const { poll } = event;
      if (poll.status === 'approved') return { kind: 'approved', tokenHash: poll.tokenHash };
      if (poll.status === 'expired') return { kind: 'expired' };
      return { ...state, code: poll.code, codeExpiresAt: Date.parse(poll.codeExpiresAt) };
    }
  }
}

/** When to poll next: every few seconds, and the moment the shown code lapses so it rotates at once. */
export function nextPollDelay(state: QrState, now: number): number | null {
  if (state.kind !== 'showing') return null;
  return Math.min(POLL_MS, Math.max(0, state.codeExpiresAt - now));
}

/** "New code in 0:42": whole seconds left on the shown code, rounded up, never below 0:00. */
export function countdown(codeExpiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((codeExpiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** What the QR holds. The phone's scanner reads `moni://` (daily) and `moni-e2e://` (Moni E2E). */
export function signInLink(code: string, scheme: string): string {
  return `${scheme}://sign-in?code=${encodeURIComponent(code)}`;
}
