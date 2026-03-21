import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { useLlamaModel } from '@/hooks/use-llama-model';
import { enqueue, getAll, pruneCompleted, type ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { saveImageLocally } from '@/lib/storage/image-storage';
import { enqueueImageUpload } from '@/lib/storage/image-upload-queue';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { syncSystem } from '@/lib/powersync/Powersync';

const TAG = '[Moni/Chat]';

// ─── Types ───────────────────────────────────────────────────────────────────

type SubmissionEntry = {
  id: string;
  type: 'text' | 'image';
  text?: string;
  imageUri?: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  createdAt: string;
};

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { status, downloadProgress, error, downloadAndPrepare } = useLlamaModel();

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSpeechRecognizing, setIsSpeechRecognizing] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const speechBaseRef = useRef('');
  const speechActiveRef = useRef(false);
  const isReady = status === 'ready';

  // Load existing queue items on mount
  useEffect(() => {
    const items = getAll();
    setSubmissions(
      items.map((item) => ({
        id: item.id,
        type: item.type === 'notification' ? 'text' : item.type,
        text: item.type === 'text' ? item.text : item.type === 'image' ? item.userContext : undefined,
        imageUri: item.type === 'image' ? item.imageUri : undefined,
        status: item.status === 'pending' || item.status === 'processing' ? 'queued' : item.status,
        createdAt: item.createdAt,
      })),
    );
  }, []);

  // ── Speech recognition ─────────────────────────────────────────────────────

  useSpeechRecognitionEvent('start', () => {
    speechActiveRef.current = true;
    setIsSpeechRecognizing(true);
  });

  useSpeechRecognitionEvent('end', () => {
    speechActiveRef.current = false;
    setIsSpeechRecognizing(false);
  });

  useSpeechRecognitionEvent('error', () => {
    speechActiveRef.current = false;
    setIsSpeechRecognizing(false);
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    const transcript: string = event?.results?.[0]?.transcript ?? '';
    const text = transcript.trim();
    if (!text) return;
    const base = speechBaseRef.current ?? '';
    const prefix = base.trim().length ? `${base.trimEnd()} ` : '';
    setInput(prefix + text);
  });

  const startSpeech = useCallback(async () => {
    if (!isReady || isSending || speechActiveRef.current) return;
    try {
      const perms = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!perms.granted) {
        const req = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!req.granted) return;
      }
      speechBaseRef.current = input;
      speechActiveRef.current = true;
      setIsSpeechRecognizing(true);
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch {
      speechActiveRef.current = false;
      setIsSpeechRecognizing(false);
    }
  }, [input, isReady, isSending]);

  const stopSpeech = useCallback(() => {
    if (!speechActiveRef.current) return;
    speechActiveRef.current = false;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setIsSpeechRecognizing(false);
    }
  }, []);

  // ── Image picker ───────────────────────────────────────────────────────────

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera permission is required to take photos.');
          return;
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        setAttachedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn(TAG, 'Image picker error:', e);
    }
  }, []);

  const showImageOptions = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage('camera');
          if (buttonIndex === 2) pickImage('library');
        },
      );
    } else {
      Alert.alert('Attach Image', 'Choose an option', [
        { text: 'Take Photo', onPress: () => pickImage('camera') },
        { text: 'Choose from Gallery', onPress: () => pickImage('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [pickImage]);

  // ── Submit handler ─────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const hasImage = !!attachedImage;
    if (!text && !hasImage) return;
    if (isSending) return;

    setIsSending(true);
    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      let queueItem: ProcessingQueueItem;
      let entry: SubmissionEntry;

      if (hasImage) {
        // Save image to persistent storage
        const localUri = await saveImageLocally(attachedImage!);

        queueItem = {
          id,
          type: 'image',
          imageUri: localUri,
          userContext: text || undefined,
          createdAt: now,
          status: 'pending',
        };

        entry = {
          id,
          type: 'image',
          text: text || undefined,
          imageUri: localUri,
          status: 'queued',
          createdAt: now,
        };

        // Queue the image for Supabase upload (async, best-effort)
        try {
          const userId = await syncSystem.supabaseConnector.getUserId();
          if (userId) {
            enqueueImageUpload({ proposalId: id, localUri, userId });
          }
        } catch {
          // Upload queue failure is non-critical
        }
      } else {
        queueItem = {
          id,
          type: 'text',
          text,
          createdAt: now,
          status: 'pending',
        };

        entry = {
          id,
          type: 'text',
          text,
          status: 'queued',
          createdAt: now,
        };
      }

      // Enqueue for processing
      enqueue(queueItem);
      setSubmissions((prev) => [entry, ...prev]);

      // Clear inputs
      setInput('');
      setAttachedImage(null);

      // Start background processing
      startBackgroundProcessor().catch((e) =>
        console.warn(TAG, 'Background processor start failed:', e),
      );
    } catch (e) {
      console.error(TAG, 'Send failed:', e);
      Alert.alert('Error', 'Failed to queue your input. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [input, attachedImage, isSending]);

  // ── Model setup screens ────────────────────────────────────────────────────

  if (
    status === 'not-downloaded' ||
    status === 'checking' ||
    status === 'downloading' ||
    status === 'preparing'
  ) {
    return (
      <ModelSetupScreen
        status={status}
        downloadProgress={downloadProgress}
        error={error}
        onDownload={downloadAndPrepare}
      />
    );
  }

  if (status === 'error') {
    return <ModelErrorScreen error={error} onRetry={downloadAndPrepare} />;
  }

  // ── Main UI ────────────────────────────────────────────────────────────────

  const hasInput = input.trim().length > 0 || !!attachedImage;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={flatListRef}
        data={submissions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SubmissionCard entry={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        ListEmptyComponent={<EmptyState />}
        inverted={submissions.length > 0}
      />

      {/* Image preview */}
      {attachedImage && (
        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-2">
            <Image
              source={{ uri: attachedImage }}
              style={{ width: 56, height: 56, borderRadius: 8 }}
              contentFit="cover"
            />
            <Text className="flex-1 text-gray-600 dark:text-gray-400 text-sm ml-3" numberOfLines={1}>
              Receipt attached
            </Text>
            <Pressable
              onPress={() => setAttachedImage(null)}
              className="w-8 h-8 items-center justify-center"
            >
              <Text className="text-gray-400 text-lg">x</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View className="flex-row items-end px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {/* Image picker */}
        <Pressable
          className="w-11 h-11 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-800 mr-2"
          onPress={showImageOptions}
          disabled={isSending}
        >
          <Text className="text-lg">📷</Text>
        </Pressable>

        {/* Text input */}
        <TextInput
          className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 text-base text-gray-900 dark:text-white mr-2"
          style={{ maxHeight: 112 }}
          placeholder="Describe a transaction, or attach a receipt..."
          placeholderTextColor="#9CA3AF"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!isSending && !isSpeechRecognizing}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />

        {/* Voice button */}
        <Pressable
          className={`w-11 h-11 rounded-full items-center justify-center mr-2 ${
            isSpeechRecognizing ? 'bg-red-600' : 'bg-gray-100 dark:bg-gray-800'
          }`}
          onPressIn={startSpeech}
          onPressOut={stopSpeech}
          disabled={isSending}
          accessibilityLabel={isSpeechRecognizing ? 'Listening' : 'Hold to speak'}
        >
          <Text className={`${isSpeechRecognizing ? 'text-white' : 'text-gray-900 dark:text-white'} text-lg`}>
            🎤
          </Text>
        </Pressable>

        {/* Send button */}
        <TouchableOpacity
          className={`w-11 h-11 rounded-full items-center justify-center ${
            hasInput && !isSending ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          onPress={handleSend}
          disabled={!hasInput || isSending || isSpeechRecognizing}
          activeOpacity={0.7}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white text-lg font-bold">↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SubmissionCard({ entry }: { entry: SubmissionEntry }) {
  const statusConfig = {
    queued: { label: 'Queued', color: 'bg-amber-100 dark:bg-amber-900', textColor: 'text-amber-700 dark:text-amber-300', icon: '⏳' },
    processing: { label: 'Processing', color: 'bg-blue-100 dark:bg-blue-900', textColor: 'text-blue-700 dark:text-blue-300', icon: '⚙️' },
    done: { label: 'Done', color: 'bg-green-100 dark:bg-green-900', textColor: 'text-green-700 dark:text-green-300', icon: '✓' },
    error: { label: 'Error', color: 'bg-red-100 dark:bg-red-900', textColor: 'text-red-700 dark:text-red-300', icon: '!' },
  }[entry.status];

  const isNew = Date.now() - new Date(entry.createdAt).getTime() < 5000;

  return (
    <View className={`mb-3 ${isNew ? 'opacity-100' : 'opacity-90'}`}>
      <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
        <View className="flex-row items-center mb-2">
          <Text className="text-sm mr-2">{entry.type === 'image' ? '📷' : '💬'}</Text>
          <Text className="flex-1 text-gray-900 dark:text-white font-medium text-sm" numberOfLines={1}>
            {entry.text || (entry.type === 'image' ? 'Receipt image' : 'Text input')}
          </Text>
          <View className={`px-2 py-0.5 rounded-full flex-row items-center ${statusConfig.color}`}>
            <Text className={`text-xs font-medium ${statusConfig.textColor}`}>
              {statusConfig.icon} {statusConfig.label}
            </Text>
          </View>
        </View>

        {entry.imageUri && (
          <Image
            source={{ uri: entry.imageUri }}
            style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 8 }}
            contentFit="cover"
          />
        )}

        {entry.status === 'queued' && (
          <Text className="text-gray-500 dark:text-gray-400 text-xs">
            Processing in background — you can close the app.
          </Text>
        )}

        <Text className="text-gray-400 dark:text-gray-500 text-xs mt-1">
          {new Date(entry.createdAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

function EmptyState() {
  const suggestions = [
    'Lunch at McDonald\'s RM12.50',
    'Grab ride RM8.90',
    'Salary RM2500 to bank',
    'Or snap a photo of your receipt',
  ];

  return (
    <View className="py-12 px-4 items-center">
      <View className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950 items-center justify-center mb-4">
        <Text className="text-3xl">⚡</Text>
      </View>
      <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Quick Add Transaction
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8 leading-5">
        Describe a transaction or take a photo of a receipt.{'\n'}
        AI processes it in the background — you can close the app right after.
      </Text>
      <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Try typing
      </Text>
      <View className="w-full">
        {suggestions.map((s) => (
          <View key={s} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-2">
            <Text className="text-gray-700 dark:text-gray-300 text-sm">{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ModelSetupScreen({
  status,
  downloadProgress,
  error,
  onDownload,
}: {
  status: string;
  downloadProgress: number;
  error: string | null;
  onDownload: () => void;
}) {
  const isLoading =
    status === 'downloading' || status === 'preparing' || status === 'checking';

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center px-8">
      <View className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-950 items-center justify-center mb-6">
        <Text className="text-4xl">🤖</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
        AI Transaction Processor
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center text-sm leading-5 mb-8">
        An on-device model processes your text and receipt inputs into transaction proposals — all privately on your device.
      </Text>

      {isLoading ? (
        <View className="items-center w-full">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-blue-600 dark:text-blue-400 font-medium mt-4 text-center">
            {status === 'downloading'
              ? `Downloading model… ${downloadProgress}%`
              : status === 'preparing'
              ? 'Loading model into memory…'
              : 'Checking…'}
          </Text>
          {status === 'downloading' && (
            <View className="w-full mt-3">
              <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <View
                  className="h-2 bg-blue-600 rounded-full"
                  style={{ width: `${downloadProgress}%` }}
                />
              </View>
              <Text className="text-gray-400 dark:text-gray-500 text-xs text-center mt-1.5">
                ~2 GB · includes vision capability · stored on your device
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          <View className="w-full bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6">
            {[
              { label: 'Model', value: 'Qwen 2.5 3B VL (Q3)' },
              { label: 'Size', value: '~2 GB (model + vision)' },
              { label: 'Capabilities', value: 'Text + Receipt images' },
              { label: 'Privacy', value: 'Runs entirely on device' },
            ].map(({ label, value }) => (
              <View
                key={label}
                className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <Text className="text-gray-500 dark:text-gray-400 text-sm">{label}</Text>
                <Text className="text-gray-900 dark:text-white text-sm font-medium">{value}</Text>
              </View>
            ))}
          </View>

          {error && (
            <Text className="text-red-500 text-sm text-center mb-4">{error}</Text>
          )}

          <TouchableOpacity
            className="bg-blue-600 w-full py-4 rounded-2xl items-center"
            onPress={onDownload}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">
              Download & Set Up Model
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function ModelErrorScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center px-8">
      <Text className="text-5xl mb-4">⚠️</Text>
      <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Failed to Load Model
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6 leading-5">
        {error ?? 'An unexpected error occurred while loading the AI model.'}
      </Text>
      <TouchableOpacity
        className="bg-blue-600 px-8 py-4 rounded-2xl"
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Text className="text-white font-semibold">Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}
