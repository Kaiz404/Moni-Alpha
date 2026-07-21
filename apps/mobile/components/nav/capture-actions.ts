/** IDs and destinations for the four explicit actions in Moni's capture menu. */
export type CaptureActionId = 'scan' | 'transaction';

export type CaptureActionDestination =
  | '/scan/receipt'
  | '/transaction/new'

const destinations: Record<CaptureActionId, CaptureActionDestination> = {
  scan: '/scan/receipt',
  transaction: '/transaction/new',
};

export function captureActionDestination(action: CaptureActionId): CaptureActionDestination {
  return destinations[action];
}
