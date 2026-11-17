import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isOneTimeCode,
  passesNotificationTransactionPrefilter,
  withoutOneTimeCode,
} from '../notification-filter.core.js';

type Case = { name: string; title: string; text: string; bigText?: string; subText?: string };

// The Go backend runs this same file, so the phone and the backend cannot disagree on a case.
const { codes, genuine } = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../backend/internal/extract/testdata/one_time_codes.json'),
    'utf8',
  ),
) as { codes: Case[]; genuine: Case[] };

describe('one-time codes never leave the phone', () => {
  it.each(codes.map((c) => [c.name, c] as const))('%s', (_name, code) => {
    expect(isOneTimeCode(code)).toBe(true);
    expect(passesNotificationTransactionPrefilter(code)).toBe(false);
  });

  it('holds on the research example, which quotes an amount and passes the money check alone', () => {
    expect(
      passesNotificationTransactionPrefilter({ title: '', text: 'TAC for a transfer of RM 300' }),
    ).toBe(false);
  });

  it('reads grouped messages, which the listener hands over and the money check ignores', () => {
    const notification = {
      title: 'Maybank',
      text: 'You paid RM20.00 to Ali',
      groupedMessages: [{ title: 'Maybank', text: 'Your TAC is 482910 for transfer of RM300.00' }],
    };
    expect(passesNotificationTransactionPrefilter(notification)).toBe(false);
  });

  it('keeps which app sent it and nothing it said', () => {
    const redacted = withoutOneTimeCode({
      app: 'com.maybank2u.life',
      packageName: 'com.maybank2u.life',
      title: 'Maybank2u',
      text: 'Your TAC is 482910',
      bigText: 'Your TAC is 482910 for transfer of RM300.00',
      subText: '482910',
      summaryText: '482910',
      extraInfoText: '482910',
      titleBig: '482910',
      groupedMessages: [{ title: 'Maybank', text: '482910' }],
    });
    expect(JSON.stringify(redacted)).not.toContain('482910');
    expect(redacted).toMatchObject({ packageName: 'com.maybank2u.life', oneTimeCode: true });
    expect(passesNotificationTransactionPrefilter(redacted)).toBe(false);
  });
});

// Not yet in testdata/one_time_codes.json: the Go copy in one_time_code.go needs the footer rule first.
const withSafetyFooter: Case[] = [
  {
    name: 'card ending beside a PIN footer',
    title: 'Maybank',
    text: 'RM50.00 debited from acct ending 1234 at KEDAI ABC. Never share your PIN.',
  },
  {
    name: 'a year beside a PIN footer',
    title: 'CIMB',
    text: 'You paid RM12.00 to KEDAI ABC on 17-Nov-2026. Never share your PIN.',
  },
  {
    name: 'a hotline beside a password footer',
    title: 'RHB',
    text: 'Received RM100.00 from ALI. Call 1300 88 6688 if this was not you. Do not reveal your password.',
  },
  {
    name: 'a card footer naming several details',
    title: 'Public Bank',
    text: 'PBB: RM230.00 spent at AEON 0412. Never share your card details, PIN or password.',
  },
];

describe('a summary notification', () => {
  const summary = (lines: { title: string; text: string }[]) => ({
    title: 'Maybank2u',
    text: '2 new notifications',
    groupedMessages: lines,
  });

  it('passes when only its grouped lines hold the payment', () => {
    expect(
      passesNotificationTransactionPrefilter(
        summary([
          { title: 'Maybank2u', text: 'You paid RM5.00 to KEDAI ABC' },
          { title: 'Maybank2u', text: 'Login from a new device' },
        ]),
      ),
    ).toBe(true);
  });

  it('is still ignored when no line holds a payment', () => {
    expect(
      passesNotificationTransactionPrefilter(
        summary([{ title: 'Maybank2u', text: 'Login from a new device' }]),
      ),
    ).toBe(false);
  });
});

describe('transaction alerts still pass', () => {
  it.each(withSafetyFooter.map((c) => [c.name, c] as const))('%s', (_name, alert) => {
    expect(isOneTimeCode(alert)).toBe(false);
    expect(passesNotificationTransactionPrefilter(alert)).toBe(true);
    expect(withoutOneTimeCode(alert)).toBe(alert);
  });

  it.each(genuine.map((c) => [c.name, c] as const))('%s', (_name, alert) => {
    expect(isOneTimeCode(alert)).toBe(false);
    expect(passesNotificationTransactionPrefilter(alert)).toBe(true);
    expect(withoutOneTimeCode(alert)).toBe(alert);
  });
});
