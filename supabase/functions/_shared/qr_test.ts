import { assertEquals } from 'jsr:@std/assert@1';

import { approveCheck, browserLabel, clientIp, pollStep, type QrRequest } from './qr.ts';

const at = (time: string) => new Date(`2026-11-19T${time}Z`);

const waiting: QrRequest = {
  code: 'code-1',
  codeExpiresAt: at('10:01:00'),
  expiresAt: at('10:10:00'),
  browser: 'Chrome on Windows',
  tokenHash: null,
};

Deno.test('a poll inside the code minute shows the same code', () => {
  assertEquals(pollStep(waiting, at('10:00:30')), {
    kind: 'waiting',
    code: 'code-1',
    codeExpiresAt: at('10:01:00'),
  });
});

Deno.test('a poll after the code minute rotates it for another minute', () => {
  assertEquals(pollStep(waiting, at('10:01:00')), {
    kind: 'rotate',
    staleCode: 'code-1',
    nextCodeExpiresAt: at('10:02:00'),
  });
});

Deno.test('the last rotation ends with the request, not a minute later', () => {
  assertEquals(pollStep({ ...waiting, codeExpiresAt: at('10:09:00') }, at('10:09:30')), {
    kind: 'rotate',
    staleCode: 'code-1',
    nextCodeExpiresAt: at('10:10:00'),
  });
});

Deno.test('a lapsed or missing request reads as expired, approved or not', () => {
  assertEquals(pollStep(waiting, at('10:10:00')), { kind: 'expired' });
  assertEquals(pollStep({ ...waiting, tokenHash: 'hash' }, at('10:10:01')), { kind: 'expired' });
  assertEquals(pollStep(null, at('10:00:00')), { kind: 'expired' });
});

Deno.test('an approved request hands out its token hash even after the code minute', () => {
  assertEquals(pollStep({ ...waiting, tokenHash: 'hash' }, at('10:05:00')), {
    kind: 'approved',
    tokenHash: 'hash',
  });
});

Deno.test('the phone may approve a live code once', () => {
  assertEquals(approveCheck(waiting, at('10:00:59')), { ok: true, browser: 'Chrome on Windows' });
  assertEquals(approveCheck({ ...waiting, tokenHash: 'hash' }, at('10:00:30')), { ok: false, reason: 'used' });
});

Deno.test('a code past its minute, or an unknown one, cannot be approved', () => {
  assertEquals(approveCheck(waiting, at('10:01:00')), { ok: false, reason: 'expired' });
  assertEquals(approveCheck(null, at('10:00:00')), { ok: false, reason: 'expired' });
});

Deno.test('the browser label names the browser and the system', () => {
  const chrome =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const edge = `${chrome} Edg/131.0.0.0`;
  const safari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
  const firefox = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
  assertEquals(browserLabel(chrome), 'Chrome on Windows');
  assertEquals(browserLabel(edge), 'Edge on Windows');
  assertEquals(browserLabel(safari), 'Safari on Mac');
  assertEquals(browserLabel(firefox), 'Firefox on Linux');
  assertEquals(browserLabel('curl/8.5.0'), 'a browser');
  assertEquals(browserLabel(null), 'a browser');
});

Deno.test('the client address is the first forwarded hop', () => {
  assertEquals(clientIp('203.0.113.7, 10.0.0.1'), '203.0.113.7');
  assertEquals(clientIp(null), 'unknown');
});
