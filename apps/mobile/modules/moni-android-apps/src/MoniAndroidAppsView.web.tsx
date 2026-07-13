import * as React from 'react';

import { MoniAndroidAppsViewProps } from './MoniAndroidApps.types';

export default function MoniAndroidAppsView(props: MoniAndroidAppsViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
