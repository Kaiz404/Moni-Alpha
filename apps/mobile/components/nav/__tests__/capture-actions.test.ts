import { captureActionDestination } from '../capture-actions';

describe('capture action destinations', () => {
  it.each([
    ['scan', '/scan/receipt'],
    ['transaction', '/transaction/new'],
    ['chat', '/(tabs)/chat'],
    ['debt', '/debt/new'],
  ] as const)('routes %s to %s', (action, destination) => {
    expect(captureActionDestination(action)).toBe(destination);
  });
});
