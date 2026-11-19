import {
  mdiArrowDown,
  mdiCheckBold,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronUp,
  mdiClose,
  mdiFitToScreenOutline,
  mdiMagnify,
  mdiMapMarkerOffOutline,
  mdiMapMarkerOutline,
  mdiMapMarkerPlusOutline,
  mdiMinus,
  mdiOpenInNew,
  mdiPlus,
  mdiShieldLockOutline,
  mdiTrayFull,
} from '@mdi/js';

const PATHS = {
  'arrow-down': mdiArrowDown,
  'check-bold': mdiCheckBold,
  'chevron-down': mdiChevronDown,
  'chevron-left': mdiChevronLeft,
  'chevron-up': mdiChevronUp,
  close: mdiClose,
  'fit-to-screen-outline': mdiFitToScreenOutline,
  magnify: mdiMagnify,
  'map-marker-off-outline': mdiMapMarkerOffOutline,
  'map-marker-outline': mdiMapMarkerOutline,
  'map-marker-plus-outline': mdiMapMarkerPlusOutline,
  minus: mdiMinus,
  'open-in-new': mdiOpenInNew,
  plus: mdiPlus,
  'shield-lock-outline': mdiShieldLockOutline,
  'tray-full': mdiTrayFull,
} as const;

/** The map's own MDI glyphs, kept here so the shell's icon list stays the shell's. */
export function Mdi({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} style={{ flex: 'none' }}>
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  );
}
