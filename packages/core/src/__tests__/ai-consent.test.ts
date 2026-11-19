import type { AiConsentScope } from '@repo/types';
import { describe, expect, it } from 'vitest';

import {
  aiUseAllowed,
  applyChange,
  consentFromRows,
  notNow,
  turnOnFor,
  UNASKED,
} from '../ai-consent';

const AT = '2026-10-14T01:12:00.000Z';
const row = (use: AiConsentScope, granted: boolean) => ({ use, granted, created_at: AT });

describe('the choice read from the consent record', () => {
  it('is unasked until the master switch has a row', () => {
    expect(consentFromRows([])).toEqual({ kind: 'unasked' });
    expect(consentFromRows([row('chat', true)])).toEqual({ kind: 'unasked' });
  });

  it('reads each use, and a use without a row as off', () => {
    expect(consentFromRows([row('all', true), row('chat', true), row('alerts', false)])).toEqual({
      kind: 'answered',
      on: true,
      at: AT,
      uses: { alerts: false, add: false, receipts: false, chat: true },
    });
  });

  it('lets a use through only while the master and its own switch are on', () => {
    const chatOnly = consentFromRows([row('all', true), row('chat', true)]);
    expect(aiUseAllowed(chatOnly, 'chat')).toBe(true);
    expect(aiUseAllowed(chatOnly, 'alerts')).toBe(false);
    const masterOff = consentFromRows([row('all', false), row('chat', true)]);
    expect(aiUseAllowed(masterOff, 'chat')).toBe(false);
    expect(aiUseAllowed(UNASKED, 'chat')).toBe(false);
  });
});

describe('the opt-in page', () => {
  it('turns everything on the first time', () => {
    expect(turnOnFor(UNASKED, 'chat')).toEqual({
      all: true,
      alerts: true,
      add: true,
      receipts: true,
      chat: true,
    });
  });

  it('later turns on only the master and the use that asked', () => {
    const answered = consentFromRows([row('all', false), row('alerts', false)]);
    expect(turnOnFor(answered, 'receipts')).toEqual({ all: true, receipts: true });
  });

  it('records the first Not now as off, and nothing after that', () => {
    expect(notNow(UNASKED)).toEqual({ all: false });
    expect(notNow(consentFromRows([row('all', false)]))).toEqual({});
  });
});

describe('the switches before the server answers', () => {
  it('moves the master and keeps the uses', () => {
    const before = consentFromRows([row('all', true), row('chat', true)]);
    expect(applyChange(before, { all: false }, 'later')).toEqual({
      kind: 'answered',
      on: false,
      at: 'later',
      uses: { alerts: false, add: false, receipts: false, chat: true },
    });
  });

  it('moves a use and keeps when the master last changed', () => {
    const before = consentFromRows([row('all', true)]);
    expect(applyChange(before, { add: true }, 'later')).toEqual({
      kind: 'answered',
      on: true,
      at: AT,
      uses: { alerts: false, add: true, receipts: false, chat: false },
    });
  });

  it('leaves an unasked user unasked when nothing changes', () => {
    expect(applyChange(UNASKED, {}, 'later')).toEqual({ kind: 'unasked' });
  });
});
