import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionOptions,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

import { categories$, wallets$ } from '@/lib/store';

const TAG = '[Moni/Speech]';

export const SPEECH_LOCALE = 'en-US';

const STATIC_CONTEXTUAL_STRINGS = [
  'transfer',
  'expense',
  'income',
  'receipt',
  'refund',
  'budget',
  'Starbucks',
  'Subway',
  'Grab',
  "McDonald's",
  'Walmart',
  'Amazon',
  'dollars',
  'fifty',
  'twenty',
  'hundred',
  'thousand',
  'lunch',
  'dinner',
  'coffee',
  'groceries',
  'gas',
  'rent',
  'USD',
  'SGD',
  'EUR',
  'GBP',
  'MYR',
];

/** Finance + user wallet/category names to bias the on-device recognizer. */
export function getSpeechContextualStrings(): string[] {
  const dynamic: string[] = [];

  const wallets = wallets$.peek() as Record<string, { name?: string; deleted?: boolean }> | null;
  for (const row of Object.values(wallets ?? {})) {
    if (row?.name && !row.deleted) dynamic.push(row.name);
  }

  const categories = categories$.peek() as Record<string, { name?: string; deleted?: boolean }> | null;
  for (const row of Object.values(categories ?? {})) {
    if (row?.name && !row.deleted) dynamic.push(row.name);
  }

  return [...new Set([...STATIC_CONTEXTUAL_STRINGS, ...dynamic])].slice(0, 100);
}

/** Shared live-transcription defaults — on-device, continuous, punctuation, finance biasing. */
export function buildSpeechRecognitionOptions(
  overrides?: Partial<ExpoSpeechRecognitionOptions>,
): ExpoSpeechRecognitionOptions {
  const onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();

  return {
    lang: SPEECH_LOCALE,
    interimResults: true,
    continuous: true,
    requiresOnDeviceRecognition: onDevice,
    addsPunctuation: onDevice,
    contextualStrings: getSpeechContextualStrings(),
    ...overrides,
  };
}

export async function ensureSpeechPermissions(): Promise<boolean> {
  const perms = await ExpoSpeechRecognitionModule.getPermissionsAsync();
  if (perms.granted) return true;
  const req = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return req.granted;
}

/**
 * Ensures the Android offline speech model is present for {@link SPEECH_LOCALE}.
 * On API 33, may open a system download dialog when `allowDialog` is true.
 */
export async function prepareOfflineSpeechModel(options?: {
  allowDialog?: boolean;
}): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) return;

  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    if (installedLocales.includes(SPEECH_LOCALE)) return;

    if (typeof Platform.Version === 'number' && Platform.Version < 34 && !options?.allowDialog) {
      return;
    }

    await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: SPEECH_LOCALE,
    });
  } catch (e) {
    console.warn(TAG, 'Offline model prep failed:', e);
  }
}

export function getTranscriptFromResult(event: ExpoSpeechRecognitionResultEvent): string {
  return event?.results?.[0]?.transcript?.trim() ?? '';
}

/** Prefix existing input/text with a new live transcript segment. */
export function mergeTranscriptWithBase(base: string, transcript: string): string {
  const trimmed = transcript.trim();
  if (!trimmed) return base;
  const prefix = base.trim().length ? `${base.trimEnd()} ` : '';
  return prefix + trimmed;
}
