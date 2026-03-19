import { useState, useEffect, useRef, useCallback } from 'react';
import {
  llama,
  downloadModel,
  isModelDownloaded,
  getModelPath,
} from '@react-native-ai/llama';

export const CHAT_MODEL_ID =
  'mradermacher/Qwen3.5-2B-GPT-5.1-HighIQ-INSTRUCT-i1-GGUF/Qwen3.5-2B-GPT-5.1-HighIQ-INSTRUCT.i1-Q4_K_M.gguf';

export type ModelStatus =
  | 'idle'
  | 'checking'
  | 'not-downloaded'
  | 'downloading'
  | 'preparing'
  | 'ready'
  | 'error';

const TAG = '[Moni/Model]';

export function useLlamaModel() {
  const [status, setStatus] = useState<ModelStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Keep model instance in a ref so it's not tied to render cycles
  const modelRef = useRef<ReturnType<typeof llama.languageModel> | null>(null);

  const prepare = useCallback(async () => {
    console.log(TAG, 'prepare() – loading model into memory, modelId:', CHAT_MODEL_ID);
    setStatus('preparing');
    setError(null);
    try {
      const modelPath = getModelPath(CHAT_MODEL_ID);
      console.log(TAG, 'model path:', modelPath);
      const model = llama.languageModel(modelPath, {
        contextParams: { n_ctx: 4096, n_gpu_layers: 99 },
      });
      console.log(TAG, 'calling model.prepare()…');
      await model.prepare();
      modelRef.current = model;
      console.log(TAG, '✅ model ready');
      setStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(TAG, '❌ prepare() failed:', msg, e);
      modelRef.current = null;
      setStatus('error');
      setError(msg);
    }
  }, []);

  const downloadAndPrepare = useCallback(async () => {
    console.log(TAG, 'downloadAndPrepare() called');
    setError(null);
    try {
      const alreadyDownloaded = await isModelDownloaded(CHAT_MODEL_ID);
      console.log(TAG, 'already downloaded?', alreadyDownloaded);
      if (!alreadyDownloaded) {
        setStatus('downloading');
        setDownloadProgress(0);
        console.log(TAG, 'starting download…');
        await downloadModel(CHAT_MODEL_ID, ({ percentage }) => {
          const pct = Math.round(percentage);
          setDownloadProgress(pct);
          if (pct % 10 === 0) {
            console.log(TAG, `download progress: ${pct}%`);
          }
        });
        console.log(TAG, 'download complete');
      }
      await prepare();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(TAG, '❌ downloadAndPrepare() failed:', msg, e);
      setStatus('error');
      setError(msg);
    }
  }, [prepare]);

  const unload = useCallback(async () => {
    console.log(TAG, 'unload() called');
    if (modelRef.current) {
      try {
        await modelRef.current.unload();
        console.log(TAG, 'model unloaded');
      } catch (e) {
        console.warn(TAG, 'unload() warning (ignored):', e);
      }
      modelRef.current = null;
    }
    setStatus('not-downloaded');
  }, []);

  // On mount: check if already downloaded and auto-prepare to minimise friction
  useEffect(() => {
    let cancelled = false;
    console.log(TAG, 'mount – checking if model is downloaded…');
    setStatus('checking');
    isModelDownloaded(CHAT_MODEL_ID)
      .then((downloaded) => {
        if (cancelled) return;
        console.log(TAG, 'isModelDownloaded:', downloaded);
        if (downloaded) {
          prepare();
        } else {
          setStatus('not-downloaded');
        }
      })
      .catch((e) => {
        console.error(TAG, 'isModelDownloaded() error:', e);
        if (!cancelled) setStatus('not-downloaded');
      });
    return () => {
      cancelled = true;
    };
  }, [prepare]);

  return {
    model: modelRef.current,
    status,
    downloadProgress,
    error,
    downloadAndPrepare,
    unload,
    isReady: status === 'ready',
  };
}
