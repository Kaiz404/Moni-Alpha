import { micLevel } from '@/lib/speech/speech-recognition';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: { supportsOnDeviceRecognition: () => true },
}));

describe('micLevel', () => {
  it.each([
    [-2, 0],
    [0, 0],
    [4, 0.5],
    [8, 1],
    [10, 1],
  ])('reads %d as %d', (value, level) => {
    expect(micLevel(value)).toBe(level);
  });
});
