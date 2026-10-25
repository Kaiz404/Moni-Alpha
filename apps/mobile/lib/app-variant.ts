import Constants from 'expo-constants';

/** True only in the Moni E2E build, whose `app.config.ts` sets `extra.appVariant` from `APP_VARIANT=e2e`. */
export function isE2eBuild(): boolean {
  return Constants.expoConfig?.extra?.appVariant === 'e2e';
}
