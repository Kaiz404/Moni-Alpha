import MoniAndroidApps from '@/modules/moni-android-apps';

/**
 * False only when Android says this build has no Maps key, because a MapView then crashes the app.
 * It asks the installed manifest and not the app config, which once said a key was there when it was not.
 * iOS, web, and a build older than this check have no answer and keep their map.
 */
export function mapsAvailable(): boolean {
  return MoniAndroidApps.hasGoogleMapsKey?.() ?? true;
}
