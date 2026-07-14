import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { enqueue, type ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { saveImageLocally } from '@/lib/receipts/images';
import { enqueueImageUpload } from '@/lib/receipts/upload-queue';
import { getUserId } from '@/lib/supabase/client';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';

const TAG = '[Moni/Scan]';

/** Queues a captured/picked receipt image through the same pipeline as the Moni Agent tab. */
async function queueReceiptImage(uri: string) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const [locationSnapshot, localUri] = await Promise.all([
    captureLocationSnapshot(),
    saveImageLocally(uri),
  ]);

  const queueItem: ProcessingQueueItem = {
    id,
    type: 'image',
    imageUri: localUri,
    createdAt,
    status: 'pending',
    locationSnapshot,
  };
  enqueue(queueItem);

  try {
    const userId = await getUserId();
    if (userId) enqueueImageUpload({ proposalId: id, localUri, userId });
  } catch {
    // non-critical — upload queue will retry on its own
  }

  startBackgroundProcessor().catch((e) => console.warn(TAG, 'Background processor start failed:', e));
}

export default function ScanReceiptScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        await queueReceiptImage(photo.uri);
        router.back();
      }
    } catch (e) {
      console.warn(TAG, 'Capture failed:', e);
      Alert.alert('Could not capture', 'Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const handlePickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setCapturing(true);
      try {
        await queueReceiptImage(result.assets[0].uri);
        router.back();
      } finally {
        setCapturing(false);
      }
    }
  }, []);

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <MaterialIcons name="camera-alt" size={40} color="#ffffff" />
        <Text className="mt-4 text-center text-base text-white">
          Camera access is needed to scan receipts.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="mt-6 rounded-full bg-white px-6 py-3">
          <Text className="text-sm font-semibold text-black">Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-2" hitSlop={8}>
          <Text className="text-sm text-white/70">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flash} />

      {/* Frame guide overlay */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: '78%',
            height: '58%',
            borderRadius: 24,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.85)',
          }}
        />
      </View>

      {/* Top bar */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-4"
        style={{ top: insets.top + 8 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Close scanner"
          className="h-11 w-11 items-center justify-center rounded-full bg-black/40">
          <MaterialIcons name="close" size={24} color="#ffffff" />
        </Pressable>
        <Text className="text-sm font-medium text-white/90">Line up the receipt</Text>
        <Pressable
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          accessibilityLabel="Toggle flash"
          className="h-11 w-11 items-center justify-center rounded-full bg-black/40">
          <MaterialIcons name={flash === 'on' ? 'flash-on' : 'flash-off'} size={22} color="#ffffff" />
        </Pressable>
      </View>

      {/* Bottom bar */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-center gap-10"
        style={{ bottom: insets.bottom + 28 }}>
        <Pressable
          onPress={handlePickFromLibrary}
          accessibilityLabel="Choose from library"
          className="h-12 w-12 items-center justify-center rounded-full bg-black/40">
          <MaterialIcons name="photo-library" size={22} color="#ffffff" />
        </Pressable>

        <Pressable
          onPress={handleCapture}
          disabled={capturing}
          accessibilityLabel="Capture receipt"
          className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-white/10">
          {capturing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View className="h-16 w-16 rounded-full bg-white" />
          )}
        </Pressable>

        <View className="h-12 w-12" />
      </View>
    </View>
  );
}
