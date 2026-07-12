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

import { useThemeTokens } from '@/hooks/use-theme-tokens';
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
  const tokens = useThemeTokens();
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

  const accentIcon = tokens.primary;
  const slateIcon = tokens.muted;
  const borderTop = 'border-border';
  const inputBg = 'bg-card';
  const screenBg = 'bg-background';

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
          <Text className="mt-5 text-2xl font-bold text-foreground">
            Moni Agent
          </Text>
        </View>

        <View className="mt-1 flex-1 overflow-hidden rounded-t-2xl bg-primary-muted">
          <View className="flex-1 rounded-t-2xl bg-background px-3 pt-4 pb-2">
            <FlatList
              ref={flatListRef}
              data={submissions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SubmissionCard
                  entry={item}
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
              ListEmptyComponent={<EmptyState primary={tokens.primary} />}
              inverted={submissions.length > 0}
            />
          </View>
        </View>

        {attachedImage && (
          <View className="px-4 pb-2 pt-1">
            <View className="flex-row items-center rounded-xl border border-border bg-card p-2 shadow-sm">
              <Image
                source={{ uri: attachedImage }}
                style={{ width: 56, height: 56, borderRadius: 8 }}
                contentFit="cover"
              />
              <Text
                className="ml-3 flex-1 text-sm text-muted"
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
          className={`flex-row items-end border-t px-4 pt-2 ${borderTop} bg-background`}
          style={{ paddingBottom: bottomPad }}
        >
          <Pressable
            className="mr-2 h-11 w-11 items-center justify-center rounded-full bg-card"
            onPress={showImageOptions}
          >
            <IconSymbol name="photo-camera" size={24} color={accentIcon} />
          </Pressable>

          <TextInput
            className={`mr-2 flex-1 rounded-2xl border border-border px-4 py-3 text-base text-foreground ${inputBg}`}
            style={{ maxHeight: 112 }}
            placeholder={inputPlaceholder}
            placeholderTextColor={tokens.muted}
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
                  ? tokens.danger
                  : tokens.primary,
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
              style={{ backgroundColor: tokens.primary }}
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
  onDismissDone,
}: {
  entry: SubmissionEntry;
  onDismissDone?: () => void;
}) {
  const tokens = useThemeTokens();
  const statusConfig = {
    queued: {
      label: 'Queued',
      color: 'bg-warning/15',
      textColor: 'text-warning',
    },
    processing: {
      label: 'Processing',
      color: 'bg-primary-muted',
      textColor: 'text-primary',
    },
    done: {
      label: 'Done',
      color: 'bg-success/15',
      textColor: 'text-success',
    },
    error: {
      label: 'Error',
      color: 'bg-danger/15',
      textColor: 'text-danger',
    },
  }[entry.status];

  const isNew = Date.now() - new Date(entry.createdAt).getTime() < 5000;

  const inner = (
    <View className={`mb-3 ${isNew ? 'opacity-100' : 'opacity-95'}`}>
      <View className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <View className="mb-2 flex-row items-center gap-2">
          <IconSymbol
            name={entry.type === 'image' ? 'image' : 'chat-bubble-outline'}
            size={18}
            color={tokens.muted}
          />
          <Text className="min-w-0 flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
            {entry.text || (entry.type === 'image' ? 'Receipt image' : 'Text input')}
          </Text>
          <View className={`shrink-0 rounded-full px-2 py-0.5 ${statusConfig.color}`}>
            <Text className={`text-xs font-medium ${statusConfig.textColor}`}>
              {statusConfig.label}
            </Text>
          </View>
          {onDismissDone ? (
            <Pressable
              onPress={onDismissDone}
              className="h-8 w-8 shrink-0 items-center justify-center rounded-full"
              hitSlop={8}
              accessibilityLabel="Remove from list">
              <IconSymbol name="close" size={20} color={tokens.muted} />
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
          <Text className="text-xs text-muted">
            Processing in background — you can close the app.
          </Text>
        )}

        <Text className="mt-1 text-xs text-muted">
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
        <RightDismissAction dragX={dragX} onPress={onDismissDone} />
      )}>
      {inner}
    </Swipeable>
  );
}

function RightDismissAction({
  dragX,
  onPress,
}: {
  dragX: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const trans = dragX.interpolate({
    inputRange: [-80, 0],
    outputRange: [0, 80],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        className="mr-1 flex-1 items-center justify-center rounded-2xl bg-danger/20 px-4">
        <IconSymbol name="delete-outline" size={26} color={tokens.danger} />
        <Text className="mt-0.5 text-xs font-semibold text-danger">Remove</Text>
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

function EmptyState({ primary }: { primary: string }) {
  const suggestions = [
    "Lunch at McDonald's RM12.50",
    'Grab ride RM8.90',
    'Salary RM2500 to bank',
    'Or snap a photo of your receipt',
  ];

  return (
    <View className="items-center px-4 py-12">
      <View
        className="mb-4 h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `${primary}33` }}>
        <IconSymbol name="bolt" size={36} color={primary} />
      </View>
      <Text className="mb-2 text-xl font-semibold text-foreground">Quick Add Transaction</Text>
      <Text className="mb-8 text-center text-sm leading-5 text-muted">
        Describe a transaction or take a photo of a receipt.{'\n'}
        Queued for the AI backend — you can leave this screen after sending.
      </Text>
      <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Try typing
      </Text>
      <View className="w-full">
        {suggestions.map((s) => (
          <View key={s} className="mb-2 rounded-xl border border-border bg-card px-4 py-3">
            <Text className="text-sm text-foreground">{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}


