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
  ActionSheetIOS,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  enqueue,
  getAll,
  remove,
  type ProcessingQueueItem,
} from '@/lib/ai/processing-queue';
import { saveImageLocally } from '@/lib/receipts/images';
import { enqueueImageUpload } from '@/lib/receipts/upload-queue';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { getUserId } from '@/lib/supabase/client';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';
import { IconSymbol } from '@/components/ui/icon-symbol';

const TAG = '[Moni/Chat]';

/** Align with wallets tab: purple accents, slate surfaces */
const ACCENT = '#8494FF';
const ACCENT_DARK = '#4f54c4';
const SURFACE_BOTTOM = 'rgba(99, 103, 255, 0.7)';
const SURFACE_BOTTOM_DARK = 'rgba(42, 45, 92, 0.95)';

// ─── Types ───────────────────────────────────────────────────────────────────

type SubmissionEntry = {
  id: string;
  type: 'text' | 'image';
  text?: string;
  imageUri?: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  createdAt: string;
};

function mapQueueItemToEntry(item: ProcessingQueueItem): SubmissionEntry {
  return {
    id: item.id,
    type: item.type === 'notification' ? 'text' : item.type,
    text:
      item.type === 'text'
        ? item.text
        : item.type === 'image'
          ? item.userContext
          : undefined,
    imageUri: item.type === 'image' ? item.imageUri : undefined,
    status:
      item.status === 'pending'
        ? 'queued'
        : item.status === 'processing'
          ? 'processing'
          : item.status,
    createdAt: item.createdAt,
  };
}

function sortEntriesDesc(items: SubmissionEntry[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSpeechRecognizing, setIsSpeechRecognizing] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>([]);

  const flatListRef = useRef<FlatList>(null);
  /** Prevents double-send before state clears (same-tick duplicate taps). */
  const sendGuardRef = useRef(false);
  /** IDs optimistically shown but not yet written to the MMKV queue. */
  const pendingCommitIdsRef = useRef<Set<string>>(new Set());
  const speechBaseRef = useRef('');
  const speechActiveRef = useRef(false);

  const accentIcon = isDark ? '#c4c9ff' : ACCENT;
  const slateIcon = isDark ? '#e2e8f0' : '#475569';
  const borderTop = isDark ? 'border-slate-700' : 'border-slate-200';
  const inputBg = isDark ? 'bg-slate-800' : 'bg-slate-100';
  const screenBg = isDark ? 'bg-gray-900' : 'bg-white';

  const refreshFromQueue = useCallback(() => {
    setSubmissions((prev) => {
      const fromQueue = getAll().map(mapQueueItemToEntry);
      const queueIds = new Set(fromQueue.map((i) => i.id));
      const inFlight = prev.filter(
        (s) => pendingCommitIdsRef.current.has(s.id) && !queueIds.has(s.id),
      );
      return sortEntriesDesc([...fromQueue, ...inFlight]);
    });
  }, []);

  useEffect(() => {
    refreshFromQueue();
  }, [refreshFromQueue]);

  useFocusEffect(
    useCallback(() => {
      refreshFromQueue();
    }, [refreshFromQueue]),
  );

  useEffect(() => {
    const t = setInterval(() => {
      const queue = getAll();
      setSubmissions((prev) => {
        if (prev.length === 0) return prev;
        let changed = false;
        const next = prev.map((s) => {
          const q = queue.find((i) => i.id === s.id);
          if (!q) return s;
          const st: SubmissionEntry['status'] =
            q.status === 'pending'
              ? 'queued'
              : q.status === 'processing'
                ? 'processing'
                : q.status;
          if (st !== s.status) {
            changed = true;
            return { ...s, status: st };
          }
          return s;
        });
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(t);
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
    if (speechActiveRef.current) return;
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
  }, [input]);

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
          Alert.alert(
            'Permission needed',
            'Camera permission is required to take photos.',
          );
          return;
        }
      }

      const result =
        source === 'camera'
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

  // ── Submit handler (optimistic UI; queue commit runs after) ───────────────

  const commitQueueItem = useCallback(
    async (id: string, createdAt: string, text: string, pickedImage: string | null) => {
      try {
        const locationSnapshot = await captureLocationSnapshot();

        if (pickedImage) {
          const localUri = await saveImageLocally(pickedImage);
          setSubmissions((prev) =>
            prev.map((s) =>
              s.id === id && s.type === 'image' ? { ...s, imageUri: localUri } : s,
            ),
          );

          const queueItem: ProcessingQueueItem = {
            id,
            type: 'image',
            imageUri: localUri,
            userContext: text || undefined,
            createdAt,
            status: 'pending',
            locationSnapshot,
          };
          enqueue(queueItem);

          try {
            const userId = await getUserId();
            if (userId) {
              enqueueImageUpload({ proposalId: id, localUri, userId });
            }
          } catch {
            // non-critical
          }
        } else {
          const queueItem: ProcessingQueueItem = {
            id,
            type: 'text',
            text,
            createdAt,
            status: 'pending',
            locationSnapshot,
          };
          enqueue(queueItem);
        }

        startBackgroundProcessor().catch((e) =>
          console.warn(TAG, 'Background processor start failed:', e),
        );

        pendingCommitIdsRef.current.delete(id);
      } catch (e) {
        console.error(TAG, 'Queue commit failed:', e);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, status: 'error' as const } : s,
          ),
        );
        Alert.alert('Error', 'Failed to queue your input. Please try again.');
      }
    },
    [],
  );

  const handleSend = useCallback(() => {
    if (sendGuardRef.current) return;

    const text = input.trim();
    const pickedImage = attachedImage;
    if (!text && !pickedImage) return;

    sendGuardRef.current = true;
    const id = randomUUID();
    const now = new Date().toISOString();
    pendingCommitIdsRef.current.add(id);

    const optimisticEntry: SubmissionEntry = pickedImage
      ? {
          id,
          type: 'image',
          text: text || undefined,
          imageUri: pickedImage,
          status: 'queued',
          createdAt: now,
        }
      : {
          id,
          type: 'text',
          text,
          status: 'queued',
          createdAt: now,
        };

    setInput('');
    setAttachedImage(null);
    setSubmissions((prev) => sortEntriesDesc([optimisticEntry, ...prev]));

    queueMicrotask(() => {
      sendGuardRef.current = false;
    });

    void commitQueueItem(id, now, text, pickedImage);
  }, [input, attachedImage, commitQueueItem]);

  const dismissCompleted = useCallback((id: string) => {
    remove(id);
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Main UI ────────────────────────────────────────────────────────────────

  const hasContent = input.trim().length > 0 || !!attachedImage;
  /** Mic when empty (or actively listening — don't flip to send mid-utterance). */
  const showMicMode = isSpeechRecognizing || !hasContent;
  const inputPlaceholder = isSpeechRecognizing
    ? 'Listening… speak now'
    : 'Describe a transaction...';

  const bottomPad = Math.max(insets.bottom, 5) + 20;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        className={`flex-1 ${screenBg}`}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={{ flex: 1 }}
      >
        <View className="px-6 pt-5 pb-2 flex-row items-center">
          <Text className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
            Moni Agent
          </Text>
        </View>

        <View
          className="flex-1 rounded-t-2xl mt-1 overflow-hidden"
          style={{
            backgroundColor: isDark ? SURFACE_BOTTOM_DARK : SURFACE_BOTTOM,
          }}
        >
          <View
            className="flex-1 rounded-t-2xl px-3 pt-4 pb-2"
            style={{
              backgroundColor: isDark
                ? 'rgba(15, 23, 42, 0.95)'
                : 'rgba(250, 250, 250, 0.92)',
            }}
          >
            <FlatList
              ref={flatListRef}
              data={submissions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SubmissionCard
                  entry={item}
                  isDark={isDark}
                  onDismissDone={
                    item.status === 'done'
                      ? () => dismissCompleted(item.id)
                      : undefined
                  }
                />
              )}
              contentContainerStyle={{
                paddingHorizontal: 8,
                paddingBottom: 8,
                flexGrow: 1,
              }}
              ListEmptyComponent={<EmptyState isDark={isDark} />}
              inverted={submissions.length > 0}
            />
          </View>
        </View>

        {attachedImage && (
          <View className="px-4 pb-2 pt-1">
            <View
              className={`flex-row items-center rounded-xl p-2 border shadow-sm ${
                isDark
                  ? 'bg-slate-800 border-slate-600'
                  : 'bg-white border-slate-300'
              }`}
            >
              <Image
                source={{ uri: attachedImage }}
                style={{ width: 56, height: 56, borderRadius: 8 }}
                contentFit="cover"
              />
              <Text
                className={`flex-1 text-sm ml-3 ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}
                numberOfLines={1}
              >
                Receipt attached
              </Text>
              <Pressable
                onPress={() => setAttachedImage(null)}
                className="w-9 h-9 items-center justify-center"
                hitSlop={8}
              >
                <IconSymbol name="close" size={22} color={slateIcon} />
              </Pressable>
            </View>
          </View>
        )}

        <View
          className={`flex-row items-end px-4 pt-2 border-t ${borderTop} ${
            isDark ? 'bg-slate-900' : 'bg-white'
          }`}
          style={{ paddingBottom: bottomPad }}
        >
          <Pressable
            className={`w-11 h-11 rounded-full items-center justify-center mr-2 ${
              isDark ? 'bg-slate-800' : 'bg-slate-100'
            }`}
            onPress={showImageOptions}
          >
            <IconSymbol name="photo-camera" size={24} color={accentIcon} />
          </Pressable>

          <TextInput
            className={`flex-1 rounded-2xl px-4 py-3 text-base mr-2 border ${inputBg} ${
              isDark
                ? 'text-white border-slate-600'
                : 'text-slate-900 border-slate-200'
            }`}
            style={{ maxHeight: 112 }}
            placeholder={inputPlaceholder}
            placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isSpeechRecognizing}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSend}
          />

          {showMicMode ? (
            <Pressable
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{
                backgroundColor: isSpeechRecognizing
                  ? isDark
                    ? '#b91c1c'
                    : '#dc2626'
                  : isDark
                    ? ACCENT_DARK
                    : ACCENT,
              }}
              onPressIn={startSpeech}
              onPressOut={stopSpeech}
              accessibilityLabel={
                isSpeechRecognizing ? 'Listening' : 'Hold to speak'
              }
            >
              <IconSymbol
                name="mic"
                size={24}
                color="#ffffff"
              />
            </Pressable>
          ) : (
            <TouchableOpacity
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? ACCENT_DARK : ACCENT }}
              onPress={handleSend}
              disabled={!hasContent || isSpeechRecognizing}
              activeOpacity={0.7}
            >
              <IconSymbol name="send" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SubmissionCard({
  entry,
  isDark,
  onDismissDone,
}: {
  entry: SubmissionEntry;
  isDark: boolean;
  onDismissDone?: () => void;
}) {
  const statusConfig = {
    queued: {
      label: 'Queued',
      color: isDark ? 'bg-amber-900/80' : 'bg-amber-100',
      textColor: isDark ? 'text-amber-200' : 'text-amber-800',
    },
    processing: {
      label: 'Processing',
      color: isDark ? 'bg-indigo-900/80' : 'bg-indigo-100',
      textColor: isDark ? 'text-indigo-200' : 'text-indigo-800',
    },
    done: {
      label: 'Done',
      color: isDark ? 'bg-emerald-900/80' : 'bg-emerald-100',
      textColor: isDark ? 'text-emerald-200' : 'text-emerald-800',
    },
    error: {
      label: 'Error',
      color: isDark ? 'bg-red-900/80' : 'bg-red-100',
      textColor: isDark ? 'text-red-200' : 'text-red-800',
    },
  }[entry.status];

  const isNew = Date.now() - new Date(entry.createdAt).getTime() < 5000;
  const cardBorder = isDark ? 'border-slate-600' : 'border-slate-300';
  const cardBg = isDark ? 'bg-slate-800' : 'bg-white';

  const inner = (
    <View className={`mb-3 ${isNew ? 'opacity-100' : 'opacity-95'}`}>
      <View
        className={`rounded-2xl p-4 border shadow-sm ${cardBorder} ${cardBg}`}
      >
        <View className="flex-row items-center mb-2 gap-2">
          <IconSymbol
            name={entry.type === 'image' ? 'image' : 'chat-bubble-outline'}
            size={18}
            color={isDark ? '#94a3b8' : '#64748b'}
          />
          <Text
            className={`flex-1 font-medium text-sm min-w-0 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
            numberOfLines={1}
          >
            {entry.text ||
              (entry.type === 'image' ? 'Receipt image' : 'Text input')}
          </Text>
          <View
            className={`px-2 py-0.5 rounded-full shrink-0 ${statusConfig.color}`}
          >
            <Text
              className={`text-xs font-medium ${statusConfig.textColor}`}
            >
              {statusConfig.label}
            </Text>
          </View>
          {onDismissDone ? (
            <Pressable
              onPress={onDismissDone}
              className="w-8 h-8 items-center justify-center rounded-full shrink-0"
              hitSlop={8}
              accessibilityLabel="Remove from list"
            >
              <IconSymbol
                name="close"
                size={20}
                color={isDark ? '#94a3b8' : '#64748b'}
              />
            </Pressable>
          ) : null}
        </View>

        {entry.imageUri && (
          <Image
            source={{ uri: entry.imageUri }}
            style={{
              width: '100%',
              height: 120,
              borderRadius: 8,
              marginBottom: 8,
            }}
            contentFit="cover"
          />
        )}

        {entry.status === 'queued' && (
          <Text
            className={`text-xs ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Processing in background — you can close the app.
          </Text>
        )}

        <Text
          className={`text-xs mt-1 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          {new Date(entry.createdAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );

  if (entry.status !== 'done' || !onDismissDone) {
    return inner;
  }

  return (
    <Swipeable
      friction={2}
      overshootRight={false}
      renderRightActions={(_progress, dragX) => (
        <RightDismissAction
          dragX={dragX}
          onPress={onDismissDone}
          isDark={isDark}
        />
      )}
    >
      {inner}
    </Swipeable>
  );
}

function RightDismissAction({
  dragX,
  onPress,
  isDark,
}: {
  dragX: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
  isDark: boolean;
}) {
  const trans = dragX.interpolate({
    inputRange: [-80, 0],
    outputRange: [0, 80],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        className="flex-1 rounded-2xl mr-1 items-center justify-center px-4"
        style={{
          backgroundColor: isDark ? '#7f1d1d' : '#fecaca',
        }}
      >
        <IconSymbol
          name="delete-outline"
          size={26}
          color={isDark ? '#fecaca' : '#991b1b'}
        />
        <Text
          className="text-xs font-semibold mt-0.5"
          style={{ color: isDark ? '#fecaca' : '#991b1b' }}
        >
          Remove
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
  },
});

function EmptyState({ isDark }: { isDark: boolean }) {
  const suggestions = [
    "Lunch at McDonald's RM12.50",
    'Grab ride RM8.90',
    'Salary RM2500 to bank',
    'Or snap a photo of your receipt',
  ];

  return (
    <View className="py-12 px-4 items-center">
      <View
        className="w-16 h-16 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: isDark ? ACCENT_DARK : `${ACCENT}33` }}
      >
        <IconSymbol name="bolt" size={36} color={isDark ? '#e0e7ff' : ACCENT} />
      </View>
      <Text
        className={`text-xl font-semibold mb-2 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        Quick Add Transaction
      </Text>
      <Text
        className={`text-center text-sm mb-8 leading-5 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        Describe a transaction or take a photo of a receipt.{'\n'}
        Queued for the AI backend — you can leave this screen after sending.
      </Text>
      <Text
        className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}
      >
        Try typing
      </Text>
      <View className="w-full">
        {suggestions.map((s) => (
          <View
            key={s}
            className={`rounded-xl px-4 py-3 mb-2 border ${
              isDark
                ? 'bg-slate-800 border-slate-600'
                : 'bg-white border-slate-300'
            }`}
          >
            <Text
              className={`text-sm ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {s}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}


