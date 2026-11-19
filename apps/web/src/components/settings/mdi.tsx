import {
  mdiAccountOutline,
  mdiBellOutline,
  mdiCameraOutline,
  mdiCheckBold,
  mdiChevronDown,
  mdiChevronRight,
  mdiCloseCircleOutline,
  mdiDotsHorizontal,
  mdiDownload,
  mdiEyeOutline,
  mdiFileDelimitedOutline,
  mdiFileUploadOutline,
  mdiInformationOutline,
  mdiKeyboardOutline,
  mdiMagnify,
  mdiMinus,
  mdiPencil,
  mdiPencilOutline,
  mdiShieldLockOutline,
  mdiStoreOutline,
  mdiSwapVertical,
} from '@mdi/js';

/** The MDI paths only Settings draws, kept here so the shell's icon list stays as the shell needs it. */
export const SETTINGS_ICONS = {
  alerts: mdiBellOutline,
  add: mdiKeyboardOutline,
  receipts: mdiCameraOutline,
  check: mdiCheckBold,
  chevronDown: mdiChevronDown,
  forget: mdiCloseCircleOutline,
  more: mdiDotsHorizontal,
  download: mdiDownload,
  eye: mdiEyeOutline,
  csv: mdiFileDelimitedOutline,
  upload: mdiFileUploadOutline,
  info: mdiInformationOutline,
  search: mdiMagnify,
  none: mdiMinus,
  pen: mdiPencil,
  rename: mdiPencilOutline,
  store: mdiStoreOutline,
} as const;

export const SECTION_ICONS = {
  profile: mdiAccountOutline,
  ai: mdiShieldLockOutline,
  merchants: mdiStoreOutline,
  import: mdiSwapVertical,
  chevron: mdiChevronRight,
} as const;

export function Mdi({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} style={{ flex: 'none' }}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}
