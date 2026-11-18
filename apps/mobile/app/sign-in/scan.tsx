import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { signInCode } from '@/lib/auth/sign-in-link';
import { tid } from '@/lib/test-ids';

/** Profile › Scan to sign in: the camera reads the QR on the Moni website and hands its code to `/sign-in`. */
export default function ScanToSignInScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [wrongCode, setWrongCode] = useState(false);
  // The camera reports the same QR many times a second; the first good one wins.
  const handled = useRef(false);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    const code = signInCode(data);
    if (!code) {
      setWrongCode(true);
      return;
    }
    handled.current = true;
    router.replace({ pathname: '/sign-in', params: { code } });
  };

  return (
    <Page
      screen="profile"
      kind="pushed"
      title="Scan to sign in"
    >
      <View className="flex-1 gap-5 px-5 pb-6">
        <Text
          variant="body"
          className="text-ink-2"
        >
          On the Moni website, choose Sign in with your phone, then point the camera at the code.
        </Text>

        {permission?.granted ? (
          <View className="aspect-square w-full overflow-hidden rounded-card bg-foreground">
            <CameraView
              testID={tid('profile', 'scan-sign-in', 'camera')}
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScanned}
            />
          </View>
        ) : permission ? (
          <View className="gap-4 rounded-card bg-card p-card">
            <Text
              variant="body"
              className="text-foreground"
            >
              Moni needs the camera to read the code.
            </Text>
            {permission.canAskAgain ? (
              <Button
                testID={tid('profile', 'scan-sign-in', 'allow')}
                label="Allow the camera"
                icon="camera-outline"
                onPress={() => void requestPermission()}
              />
            ) : (
              <Button
                testID={tid('profile', 'scan-sign-in', 'settings')}
                variant="secondary"
                label="Open Android settings"
                onPress={() => void Linking.openSettings()}
              />
            )}
          </View>
        ) : null}

        {wrongCode ? (
          <Text
            variant="body"
            className="text-over"
            accessibilityLiveRegion="polite"
          >
            {"That isn't a Moni sign-in code."}
          </Text>
        ) : null}
      </View>
    </Page>
  );
}
