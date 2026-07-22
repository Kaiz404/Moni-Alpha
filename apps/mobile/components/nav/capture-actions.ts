/** IDs and destinations for the explicit actions in Moni's capture menu. */
export type CaptureActionId = 'scan' | 'expense' | 'income';

export type CaptureActionDestination =
  | '/scan/receipt'
  | '/transaction/new?type=expense'
  | '/transaction/new?type=income';

const destinations: Record<CaptureActionId, CaptureActionDestination> = {
  scan: '/scan/receipt',
  expense: '/transaction/new?type=expense',
  income: '/transaction/new?type=income',
};

export function captureActionDestination(action: CaptureActionId): CaptureActionDestination {
  return destinations[action];
}
