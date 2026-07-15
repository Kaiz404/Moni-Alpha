import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { scanDocument } from 'moni-document-scanner';

import { normalizeScanUri } from '@/lib/receipts/normalize-scan';

export type ReceiptCameraProps = {
  onComplete: (processedUri: string) => void;
  onCancel: () => void;
  /** Layout only — Android opens ML Kit's native scanner UI. */
  variant?: 'fullscreen' | 'modal';
};

const TAG = '[ReceiptCamera]';

function UnsupportedReceiptScanner({ onCancel }: Pick<ReceiptCameraProps, 'onCancel'>) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 items-center justify-center bg-black px-8">
      <MaterialIcons name="receipt-long" size={40} color="#ffffff" />
      <Text className="mt-4 text-center text-base text-white">
        Receipt scanning is only available on Android.
      </Text>
      <Pressable
        onPress={onCancel}
        className="mt-6 rounded-full bg-white px-6 py-3"
        style={{ marginTop: insets.top + 24 }}>
        <Text className="text-sm font-semibold text-black">Go back</Text>
      </Pressable>
    </View>
  );
}

/**
 * Android receipt scan via Google ML Kit's native document scanner UI.
 * Launches on mount when the hosting screen/modal is visible.
 */
function MlKitReceiptScanner({ onComplete, onCancel }: ReceiptCameraProps) {
  const insets = useSafeAreaInsets();
  const scanningRef = useRef(false);
  const [processing, setProcessing] = useState(false);

  const launchScanner = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;

    try {
      const result = await scanDocument({
        maxNumDocuments: 1,
        scannerMode: 'full',
        galleryImportAllowed: true,
      });

      const pageUri = result.pages[0]?.uri;
      if (!pageUri) {
        Alert.alert("Couldn't scan receipt", 'No image was returned. Please try again.');
        onCancel();
        return;
      }

      setProcessing(true);
      const normalized = await normalizeScanUri(pageUri);
      onComplete(normalized);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.toLowerCase().includes('cancel')) {
        onCancel();
        return;
      }
      console.warn(TAG, 'scan failed:', e);
      Alert.alert("Couldn't scan receipt", 'Please try again.');
      onCancel();
    } finally {
      scanningRef.current = false;
      setProcessing(false);
    }
  }, [onComplete, onCancel]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void launchScanner();
    }, 150);
    return () => clearTimeout(timer);
  }, [launchScanner]);

  const hintText = processing ? 'Processing receipt…' : 'Opening scanner…';

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#ffffff" size="large" />
        <Text className="mt-4 text-sm text-white/80">{hintText}</Text>
      </View>

      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-4"
        style={{ top: insets.top + 8 }}>
        <Pressable
          onPress={onCancel}
          disabled={processing}
          accessibilityLabel="Close scanner"
          className="h-11 w-11 items-center justify-center rounded-full bg-black/40">
          <MaterialIcons name="close" size={24} color="#ffffff" />
        </Pressable>
        <Text className="text-sm font-medium text-white/90">{hintText}</Text>
        <View className="h-11 w-11" />
      </View>
    </View>
  );
}

/** Receipt scanner — Android only (ML Kit via `moni-document-scanner`). */
export function ReceiptCamera(props: ReceiptCameraProps) {
  if (Platform.OS !== 'android') {
    return <UnsupportedReceiptScanner onCancel={props.onCancel} />;
  }
  return <MlKitReceiptScanner {...props} />;
}
