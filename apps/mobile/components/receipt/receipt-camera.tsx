import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { OpenCV } from 'react-native-fast-opencv';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type Frame,
} from 'react-native-vision-camera';
import { useRunOnJS, useWorklet } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { findReceiptQuad } from '@/lib/receipts/detect-core';
import { processReceiptStill } from '@/lib/receipts/preprocess';
import { DETECT_FRAME_WIDTH, STABILITY_MS } from '@/lib/receipts/types';
import type { Quad } from '@/lib/receipts/types';
import { mapFrameQuadToView, ReceiptQuadOverlay } from './receipt-quad-overlay';

export type ReceiptCameraProps = {
  onComplete: (processedUri: string) => void;
  onCancel: () => void;
  /** Layout only — both variants render an edge-to-edge camera. */
  variant?: 'fullscreen' | 'modal';
};

const TAG = '[ReceiptCamera]';

/**
 * Shared receipt scanner: live brand corner-bracket overlay gated on a stable detected quad,
 * manual shutter, and the same detect → crop → document-scan pipeline for both the camera
 * capture and the gallery picker. Used by the FAB scan screen and the chat inline camera.
 */
export function ReceiptCamera({ onComplete, onCancel }: ReceiptCameraProps) {
  const insets = useSafeAreaInsets();
  const { primary } = useThemeTokens();

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const { resize } = useResizePlugin();
  const camera = useRef<Camera>(null);

  const [torch, setTorch] = useState<'off' | 'on'>('off');
  const [receiptReady, setReceiptReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [displayQuad, setDisplayQuad] = useState<Quad | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const previewLayoutRef = useRef({ width: 0, height: 0 });

  const handleDetection = useRunOnJS(
    (frameQuad: Quad | null, frameWidth: number, frameHeight: number, found: boolean) => {
      const { width, height } = previewLayoutRef.current;
      if (frameQuad != null && width > 0 && height > 0) {
        setDisplayQuad(mapFrameQuadToView(frameQuad, frameWidth, frameHeight, width, height));
      } else {
        setDisplayQuad(null);
      }

      const now = Date.now();
      if (found) {
        if (stableSinceRef.current == null) stableSinceRef.current = now;
        setReceiptReady(now - stableSinceRef.current >= STABILITY_MS);
      } else {
        stableSinceRef.current = null;
        setReceiptReady(false);
      }
    },
    [],
  );

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';

      const ratio = DETECT_FRAME_WIDTH / frame.width;
      const width = DETECT_FRAME_WIDTH;
      const height = Math.round(frame.height * ratio);

      const resized = resize(frame, {
        scale: { width, height },
        pixelFormat: 'bgr',
        dataType: 'uint8',
      });
      const mat = OpenCV.bufferToMat('uint8', height, width, 3, resized);
      const quad = findReceiptQuad(mat, width, height);

      runAtTargetFps(15, () => {
        'worklet';
        const frameQuad = quad
          ? (quad.map((p) => ({ x: p.x / ratio, y: p.y / ratio })) as Quad)
          : null;
        handleDetection(frameQuad, frame.width, frame.height, quad != null);
      });

      OpenCV.clearBuffers();
    },
    [handleDetection],
  );

  const processStillWorklet = useWorklet('default', processReceiptStill);

  const resetDetectionState = useCallback(() => {
    stableSinceRef.current = null;
    setReceiptReady(false);
    setDisplayQuad(null);
  }, []);

  const onPreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    previewLayoutRef.current = { width, height };
  }, []);

  const runProcessing = useCallback(
    async (base64: string, rejectMessage: string) => {
      setProcessing(true);
      try {
        const destinationFile = new File(Paths.cache, `${randomUUID()}.jpg`);
        const destinationPath = destinationFile.uri.replace(/^file:\/\//, '');
        const result = await processStillWorklet(base64, destinationPath);
        if (result.ok) {
          onComplete(destinationFile.uri);
          return;
        }
        Alert.alert("Couldn't find a receipt", rejectMessage);
        resetDetectionState();
      } catch (e) {
        console.warn(TAG, 'processing failed:', e);
        Alert.alert("Couldn't process receipt", 'Please try again.');
      } finally {
        setProcessing(false);
      }
    },
    [processStillWorklet, onComplete, resetDetectionState],
  );

  const handleCapture = useCallback(async () => {
    if (processing || !receiptReady) return;
    try {
      const photo = await camera.current?.takePhoto();
      if (!photo) return;
      const base64 = await readAsStringAsync(`file://${photo.path}`, {
        encoding: EncodingType.Base64,
      });
      await runProcessing(base64, 'Hold the receipt steady, filling most of the frame, and try again.');
    } catch (e) {
      console.warn(TAG, 'capture failed:', e);
      Alert.alert("Couldn't capture", 'Please try again.');
    }
  }, [processing, receiptReady, runProcessing]);

  const handlePickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    await runProcessing(result.assets[0].base64, 'Try another photo with a receipt clearly visible.');
  }, [runProcessing]);

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <MaterialIcons name="camera-alt" size={40} color="#ffffff" />
        <Text className="mt-4 text-center text-base text-white">
          Camera access is needed to scan receipts.
        </Text>
        <Pressable onPress={requestPermission} className="mt-6 rounded-full bg-white px-6 py-3">
          <Text className="text-sm font-semibold text-black">Allow camera</Text>
        </Pressable>
        <Pressable onPress={onCancel} className="mt-4 px-6 py-2" hitSlop={8}>
          <Text className="text-sm text-white/70">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Text className="text-center text-base text-white">No camera device found.</Text>
        <Pressable onPress={onCancel} className="mt-4 px-6 py-2" hitSlop={8}>
          <Text className="text-sm text-white/70">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const hintText = processing
    ? 'Processing receipt…'
    : receiptReady
      ? 'Hold steady and capture'
      : 'Point at a receipt';

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1" onLayout={onPreviewLayout}>
        <Camera
          ref={camera}
          style={{ flex: 1 }}
          device={device}
          isActive={!processing}
          photo
          torch={torch}
          frameProcessor={frameProcessor}
        />
        <ReceiptQuadOverlay quad={displayQuad} color={primary} />
      </View>

      {/* Top bar */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-4"
        style={{ top: insets.top + 8 }}>
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Close scanner"
          className="h-11 w-11 items-center justify-center rounded-full bg-black/40">
          <MaterialIcons name="close" size={24} color="#ffffff" />
        </Pressable>
        <Text className="text-sm font-medium text-white/90">{hintText}</Text>
        <Pressable
          onPress={() => setTorch((t) => (t === 'off' ? 'on' : 'off'))}
          accessibilityLabel="Toggle flash"
          className="h-11 w-11 items-center justify-center rounded-full bg-black/40">
          <MaterialIcons name={torch === 'on' ? 'flash-on' : 'flash-off'} size={22} color="#ffffff" />
        </Pressable>
      </View>

      {/* Bottom bar */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-center gap-10"
        style={{ bottom: insets.bottom + 28 }}>
        <Pressable
          onPress={handlePickFromLibrary}
          disabled={processing}
          accessibilityLabel="Choose from library"
          className="h-12 w-12 items-center justify-center rounded-full bg-black/40">
          <MaterialIcons name="photo-library" size={22} color="#ffffff" />
        </Pressable>

        <Pressable
          onPress={handleCapture}
          disabled={processing || !receiptReady}
          accessibilityLabel="Capture receipt"
          className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80"
          style={{ opacity: receiptReady || processing ? 1 : 0.4 }}>
          {processing ? (
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
