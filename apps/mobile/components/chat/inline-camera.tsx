import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type InlineCameraProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
};

export function InlineCamera({ visible, onClose, onCapture }: InlineCameraProps) {
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
        onCapture(photo.uri);
        onClose();
      }
    } catch {
      Alert.alert('Could not capture', 'Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCapture, onClose]);

  const handlePickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onCapture(result.assets[0].uri);
      onClose();
    }
  }, [onCapture, onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {!permission?.granted ? (
          <View className="flex-1 items-center justify-center px-8">
            <MaterialIcons name="camera-alt" size={40} color="#ffffff" />
            <Text className="mt-4 text-center text-base text-white">
              Camera access is needed to scan receipts.
            </Text>
            <Pressable
              onPress={requestPermission}
              className="mt-6 rounded-full bg-white px-6 py-3"
            >
              <Text className="text-sm font-semibold text-black">Allow camera</Text>
            </Pressable>
            <Pressable onPress={onClose} className="mt-4 px-6 py-2" hitSlop={8}>
              <Text className="text-sm text-white/70">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flash} />

            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
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

            <View
              className="absolute left-0 right-0 flex-row items-center justify-between px-4"
              style={{ top: insets.top + 8 }}
            >
              <Pressable
                onPress={onClose}
                className="h-11 w-11 items-center justify-center rounded-full bg-black/40"
              >
                <MaterialIcons name="close" size={24} color="#ffffff" />
              </Pressable>
              <Text className="text-sm font-medium text-white/90">Line up the receipt</Text>
              <Pressable
                onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
                className="h-11 w-11 items-center justify-center rounded-full bg-black/40"
              >
                <MaterialIcons
                  name={flash === 'on' ? 'flash-on' : 'flash-off'}
                  size={22}
                  color="#ffffff"
                />
              </Pressable>
            </View>

            <View
              className="absolute left-0 right-0 flex-row items-center justify-center gap-10"
              style={{ bottom: insets.bottom + 28 }}
            >
              <Pressable
                onPress={handlePickFromLibrary}
                className="h-12 w-12 items-center justify-center rounded-full bg-black/40"
              >
                <MaterialIcons name="photo-library" size={22} color="#ffffff" />
              </Pressable>

              <Pressable
                onPress={handleCapture}
                disabled={capturing}
                className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-white/10"
              >
                {capturing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <View className="h-16 w-16 rounded-full bg-white" />
                )}
              </Pressable>

              <View className="h-12 w-12" />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
