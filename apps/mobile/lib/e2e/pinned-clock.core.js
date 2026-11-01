/**
 * Moves JS time to `iso` at launch and lets it tick, so seeded screens match the boards' sample day and
 * date-dependent flows do not change with the calendar. Only an e2e build with EXPO_PUBLIC_E2E_NOW calls
 * this. Android's own times, such as a notification's post time, stay real.
 */
function pinClock(iso) {
  const RealDate = Date;
  const offset = RealDate.parse(iso) - RealDate.now();
  const now = () => RealDate.now() + offset;
  function PinnedDate(...args) {
    if (!new.target) return new RealDate(now()).toString();
    return args.length ? new RealDate(...args) : new RealDate(now());
  }
  PinnedDate.prototype = RealDate.prototype;
  PinnedDate.now = now;
  PinnedDate.parse = RealDate.parse;
  PinnedDate.UTC = RealDate.UTC;
  globalThis.Date = PinnedDate;
}

module.exports = { pinClock };
