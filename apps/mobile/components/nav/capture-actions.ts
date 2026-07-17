/** IDs and destinations for the four explicit actions in Moni's capture menu. */
export type CaptureActionId = 'scan' | 'transaction' | 'chat' | 'debt';

export type CaptureActionDestination =
  | '/scan/receipt'
  | '/transaction/new'
  | '/(tabs)/chat'
  | '/debt/new';

const destinations: Record<CaptureActionId, CaptureActionDestination> = {
  scan: '/scan/receipt',
  transaction: '/transaction/new',
  chat: '/(tabs)/chat',
  debt: '/debt/new',
};

export function captureActionDestination(action: CaptureActionId): CaptureActionDestination {
  return destinations[action];
}
