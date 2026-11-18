/** The web app's `/privacy` page. Null in a build made without it, which then shows no link. */
export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || null;
