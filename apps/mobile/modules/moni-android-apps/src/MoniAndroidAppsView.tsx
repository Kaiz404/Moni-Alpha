import { requireNativeView } from 'expo';
import * as React from 'react';

import { MoniAndroidAppsViewProps } from './MoniAndroidApps.types';

const NativeView: React.ComponentType<MoniAndroidAppsViewProps> =
  requireNativeView('MoniAndroidApps');

export default function MoniAndroidAppsView(
  props: MoniAndroidAppsViewProps,
) {
  return <NativeView {...props} />;
}
