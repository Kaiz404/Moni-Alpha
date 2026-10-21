import { tid } from '../test-ids';

describe('tid', () => {
  it('joins the screen and kebab-cased parts with dots', () => {
    expect(tid('home', 'recent', 'row', 'a1b2-c3')).toBe('home.recent.row.a1b2-c3');
    expect(tid('wallet', 'balanceFix', 'Touch n Go', 2)).toBe('wallet.balance-fix.touch-n-go.2');
  });
});
