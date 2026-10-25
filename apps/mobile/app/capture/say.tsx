import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CaptureResult } from '@/components/capture/capture-result-card';
import { Listening, SayDenied } from '@/components/capture/listening';
import {
  CaptureAdded,
  CaptureFailed,
  CaptureReading,
} from '@/components/capture/scan-stages';
import { useCaptureFlow } from '@/components/capture/use-capture-flow';
import {
  buildSpeechRecognitionOptions,
  getTranscriptFromResult,
  prepareOfflineSpeechModel,
} from '@/lib/speech/speech-recognition';

type Mic = 'starting' | 'listening' | 'denied';

const LEVEL_EASE = { duration: 100, easing: Easing.bezier(0.23, 1, 0.32, 1) };
const LOUD = 8;

function stopListening() {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {
    // Already stopped.
  }
}

/**
 * Say it: on-device speech becomes text, Moni reads it, and the check page
 * approves it straight to the ledger (V2A-CaptureSay, Heard, Denied).
 */
export default function SayScreen() {
  const flow = useCaptureFlow('voice');
  const { stage, read, dispatch } = flow;
  const [mic, setMic] = useState<Mic>('starting');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const committed = useRef('');
  const reduceMotion = useReducedMotion();
  const level = useSharedValue(reduceMotion ? 1 : 0);

  const listen = useCallback(async () => {
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setMic('denied');
      return permission.canAskAgain;
    }
    await prepareOfflineSpeechModel({ allowDialog: true });
    committed.current = '';
    setTranscript('');
    setSeconds(0);
    setMic('listening');
    ExpoSpeechRecognitionModule.start(
      buildSpeechRecognitionOptions({
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      }),
    );
    return true;
  }, []);

  useEffect(() => {
    if (stage.name !== 'capture') return;
    void listen();
    return stopListening;
  }, [listen, stage.name]);

  useEffect(() => {
    if (stage.name !== 'capture' || mic !== 'listening') return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [mic, stage.name]);

  useSpeechRecognitionEvent('volumechange', (event) => {
    if (reduceMotion) return;
    level.set(withTiming(Math.min(1, Math.max(0, event.value / LOUD)), LEVEL_EASE));
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = getTranscriptFromResult(event);
    if (!text) return;
    const joined = committed.current ? `${committed.current} ${text}` : text;
    if (event.isFinal) committed.current = joined;
    setTranscript(joined);
  });

  const done = () => {
    stopListening();
    void read({ source: 'voice', text: transcript.trim() });
  };

  const again = () => {
    setMic('starting');
    dispatch({ type: 'retry' });
  };

  switch (stage.name) {
    case 'capture':
      return mic === 'denied' ? (
        <SayDenied
          onTurnOn={() =>
            void listen().then((canAsk) => {
              if (!canAsk) void Linking.openSettings();
            })
          }
        />
      ) : (
        <Listening
          seconds={seconds}
          transcript={transcript}
          offline={ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()}
          level={level}
          onDone={done}
        />
      );
    case 'reading':
      return <CaptureReading quote={stage.quote} />;
    case 'result':
      return (
        <CaptureResult
          quote={stage.quote}
          draft={stage.draft}
          onEdit={(patch) => dispatch({ type: 'edit', patch })}
          again={{ label: 'Say again', icon: 'refresh', onPress: again }}
          onApprove={() => void flow.approve()}
          approving={flow.approving}
        />
      );
    case 'approved':
      return flow.added ? (
        <CaptureAdded
          row={flow.added}
          categoryName={flow.categoryName}
          another={{ label: 'Say another', onPress: again }}
        />
      ) : null;
    case 'failed':
      return (
        <CaptureFailed
          quote={stage.quote}
          failure={stage.failure}
          title="Say it"
          onRetry={again}
        />
      );
  }
}
