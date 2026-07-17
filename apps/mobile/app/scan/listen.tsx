import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';
import { PulsingOrb } from '@/components/scan/pulsing-orb';
import {
  buildSpeechRecognitionOptions,
  ensureSpeechPermissions,
  getTranscriptFromResult,
  prepareOfflineSpeechModel,
} from '@/lib/speech/speech-recognition';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  enqueue,
  type ProcessingQueueItem,
} from '@/lib/ai/processing-queue';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';

const TAG = '[Moni/Listen]';

type Phase = 'listening' | 'review' | 'sending';

export default function ScanListenScreen() {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const [phase, setPhase] = useState<Phase>('listening');
  const [transcript, setTranscript] = useState('');
  const startedRef = useRef(false);
  const committedTranscriptRef = useRef('');

  const start = useCallback(async () => {
    try {
      const granted = await ensureSpeechPermissions();
      if (!granted) {
        Alert.alert(
          'Permission needed',
          'Microphone permission is required to narrate a transaction.',
        );
        router.back();
        return;
      }

      await prepareOfflineSpeechModel({ allowDialog: true });

      committedTranscriptRef.current = '';
      startedRef.current = true;
      ExpoSpeechRecognitionModule.start(
        buildSpeechRecognitionOptions(),
      );
    } catch (e) {
      console.warn(TAG, 'Failed to start speech recognition:', e);
      router.back();
    }
  }, []);

  useEffect(() => {
    start();
    return () => {
      if (startedRef.current) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // already stopped
        }
      }
    };
  }, [start]);

  useSpeechRecognitionEvent(
    'result',
    (event: ExpoSpeechRecognitionResultEvent) => {
      const text = getTranscriptFromResult(event);
      if (!text) return;

      if (event.isFinal) {
        const committed = committedTranscriptRef.current;
        committedTranscriptRef.current = committed
          ? `${committed} ${text}`
          : text;
        setTranscript(committedTranscriptRef.current);
        return;
      }

      const committed = committedTranscriptRef.current;
      setTranscript(committed ? `${committed} ${text}` : text);
    },
  );

  useSpeechRecognitionEvent('error', () => {
    setPhase((p) => (p === 'listening' ? 'review' : p));
  });

  const handleStop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // no-op
    }
    setPhase('review');
  }, []);

  const handleSend = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      router.back();
      return;
    }
    setPhase('sending');
    try {
      const locationSnapshot = await captureLocationSnapshot();
      const queueItem: ProcessingQueueItem = {
        id: randomUUID(),
        type: 'text',
        text,
        createdAt: new Date().toISOString(),
        status: 'pending',
        locationSnapshot,
      };
      enqueue(queueItem);
      startBackgroundProcessor().catch((e) =>
        console.warn(TAG, 'Background processor start failed:', e),
      );
      router.back();
    } catch (e) {
      console.error(TAG, 'Failed to queue narration:', e);
      Alert.alert(
        'Error',
        'Could not queue your transaction. Please try again.',
      );
      setPhase('review');
    }
  }, [transcript]);

  return (
    <SafeAreaView
      edges={['bottom']}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Cancel"
          className="h-10 w-10 items-center justify-center rounded-full bg-background-muted"
        >
          <MaterialIcons
            name="close"
            size={22}
            color={tokens.foreground}
          />
        </Pressable>
        <Text className="text-sm font-semibold text-foreground">
          Narrate a transaction
        </Text>
        <View className="h-10 w-10" />
      </View>

      {phase !== 'review' ? (
        <View className="flex-1 items-center justify-center px-8">
          <PulsingOrb active={phase === 'listening'} />
          <Text className="mt-8 text-center text-base text-muted">
            {phase === 'listening'
              ? 'Listening… try "Lunch at Subway, twelve fifty"'
              : 'Sending to Moni…'}
          </Text>
          {transcript ? (
            <Text
              className="mt-4 text-center text-lg text-foreground"
              numberOfLines={3}
            >
              {transcript}
            </Text>
          ) : null}

          {phase === 'listening' ? (
            <Pressable
              onPress={handleStop}
              className="mt-10 flex-row items-center gap-2 rounded-full bg-primary px-8 py-4"
            >
              <MaterialIcons
                name="stop"
                size={20}
                color="#ffffff"
              />
              <Text className="text-base font-semibold text-primary-foreground">
                Done speaking
              </Text>
            </Pressable>
          ) : (
            <ActivityIndicator
              className="mt-10"
              color={tokens.primary}
            />
          )}
        </View>
      ) : (
        <View className="flex-1 px-6 pt-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Review before sending
          </Text>
          <TextInput
            className="min-h-[120px] rounded-2xl border border-border bg-card p-4 text-base text-foreground"
            value={transcript}
            onChangeText={setTranscript}
            multiline
            autoFocus
            placeholder="What did you spend on?"
            placeholderTextColor={tokens.muted}
          />

          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={() => {
                setTranscript('');
                committedTranscriptRef.current = '';
                setPhase('listening');
                start();
              }}
              className="flex-1 items-center rounded-xl border border-border bg-card py-3.5"
            >
              <Text className="text-base font-semibold text-foreground">
                Try again
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={!transcript.trim()}
              className={`flex-1 items-center rounded-xl py-3.5 ${transcript.trim() ? 'bg-primary' : 'bg-primary/50'}`}
            >
              <Text className="text-base font-semibold text-primary-foreground">
                Send
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
