/** Light is the default, as on the phone. System follows the browser's colour scheme. */
export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_KEY = 'moni-theme';

export function parseThemePref(value: string | null): ThemePref {
  return value === 'dark' || value === 'system' ? value : 'light';
}

/** The `data-theme` a preference sets on <html>; system sets none, so tokens.css follows the media query. */
export function themeAttribute(pref: ThemePref): 'light' | 'dark' | null {
  return pref === 'system' ? null : pref;
}

/** Runs before first paint so a dark page never flashes light. Mirrors parseThemePref and themeAttribute. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='system')document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;
