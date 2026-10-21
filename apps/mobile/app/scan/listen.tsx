import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Page } from '@/components/ui/page';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
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
import {
  beginImmediateProposalReview,
  clearImmediateProposalReview,
  completeImmediateProposalReview,
} from '@/lib/proposals/immediate-review';
import { waitForProposal } from '@/lib/proposals/proposal-wait';
import { tid } from '@/lib/test-ids';

const TAG = '[Moni/Listen]';

type Phase = 'listening' | 'review' | 'sending';

export default function ScanListenScreen() {
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
      beginImmediateProposalReview(queueItem.id, {
        title: 'Preparing your review…',
        detail: 'Moni is checking the transaction you described.',
        icon: 'voice',
      });
      startBackgroundProcessor().catch((e) =>
        console.warn(TAG, 'Background processor start failed:', e),
      );
      void waitForProposal(queueItem.id).then((result) => {
        if (result === 'ready') {
          completeImmediateProposalReview(queueItem.id);
          return;
        }
        clearImmediateProposalReview(queueItem.id);
      });
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
    <Page
      screen="capture"
      kind="task"
      title="Narrate a transaction"
    >
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
              testID={tid('capture', 'done-speaking')}
              onPress={handleStop}
              className="mt-10 flex-row items-center gap-2 rounded-full bg-primary px-8 py-4"
            >
              <MaterialDesignIcons
                name="stop"
                size={20}
                color={tokens.primaryForeground}
              />
              <Text className="text-base font-display-semibold text-primary-foreground">
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
          <Text className="mb-2 text-xs font-display-semibold uppercase tracking-wide text-muted">
            Review before sending
          </Text>
          <TextInput
            testID={tid('capture', 'what-did-you')}
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
              testID={tid('capture', 'try-again')}
              onPress={() => {
                setTranscript('');
                committedTranscriptRef.current = '';
                setPhase('listening');
                start();
              }}
              className="flex-1 items-center rounded-xl bg-surface-2 py-3.5"
            >
              <Text className="text-base font-display-semibold text-foreground">
                Try again
              </Text>
            </Pressable>
            <Pressable
              testID={tid('capture', 'send')}
              onPress={handleSend}
              disabled={!transcript.trim()}
              className={`flex-1 items-center rounded-xl py-3.5 ${transcript.trim() ? 'bg-primary' : 'bg-primary/50'}`}
            >
              <Text className="text-base font-display-semibold text-primary-foreground">
                Send
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </Page>
  );
}
