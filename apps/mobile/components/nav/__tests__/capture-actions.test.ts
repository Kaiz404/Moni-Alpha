import { captureActionDestination } from '../capture-actions';

describe('capture action destinations', () => {
  it.each([
    ['scan', '/scan/receipt'],
    ['expense', '/transaction/new?type=expense'],
    ['income', '/transaction/new?type=income'],
  ] as const)('routes %s to %s', (action, destination) => {
    expect(captureActionDestination(action)).toBe(destination);
  });
});
