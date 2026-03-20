import { useState, useEffect, useRef, useCallback } from 'react';
import {
  llama,
  downloadModel,
  isModelDownloaded,
  getModelPath,
  removeModel,
} from '@react-native-ai/llama';

export const CHAT_MODEL_ID = 'Qwen/Qwen2.5-3B-Instruct-GGUF/qwen2.5-3b-instruct-q3_k_m.gguf';
// export const CHAT_MODEL_ID = 'mradermacher/Qwen3.5-2B-GPT-5.1-HighIQ-INSTRUCT-i1-GGUF/Qwen3.5-2B-GPT-5.1-HighIQ-INSTRUCT.i1-Q4_K_M.gguf';
// export const CHAT_MODEL_ID = 'unsloth/gemma-3-1b-it-GGUF/gemma-3-1b-it-IQ4_NL.gguf';
// export const CHAT_MODEL_ID = 'unsloth/Qwen3.5-4B-GGUF/Qwen3.5-4B-IQ4_NL.gguf';
// export const CHAT_MODEL_ID = 'unsloth/Qwen3.5-0.8B-GGUF/Qwen3.5-0.8B-Q4_K_M.gguf'
// export const CHAT_MODEL_ID = 'unsloth/Qwen3.5-0.8B-GGUF/Qwen3.5-0.8B-Q3_K_M.gguf'

export type ModelStatus =
  | 'idle'
  | 'checking'
  | 'not-downloaded'
  | 'downloading'
  | 'preparing'
  | 'ready'
  | 'error';

const TAG = '[Moni/Model]';

const PREPARE_CONTEXT_ATTEMPTS = [
  { n_ctx: 4096, n_gpu_layers: 99 },
  { n_ctx: 2048, n_gpu_layers: 0 },
  { n_ctx: 1024, n_gpu_layers: 0 },
] as const;

export function useLlamaModel() {
  const [status, setStatus] = useState<ModelStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Keep model instance in a ref so it's not tied to render cycles
  const modelRef = useRef<ReturnType<typeof llama.languageModel> | null>(null);

  const createAndPrepareWithFallback = useCallback(async (modelPath: string) => {
    let lastError: unknown;

    for (const params of PREPARE_CONTEXT_ATTEMPTS) {
      let model: ReturnType<typeof llama.languageModel> | null = null;
      try {
        console.log(TAG, 'prepare attempt with params:', params);
        model = llama.languageModel(modelPath, { contextParams: params });
        await model.prepare();
        console.log(TAG, 'prepare attempt succeeded with params:', params);
        return model;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(TAG, 'prepare attempt failed:', params, msg);
        try {
          await model?.unload();
        } catch {
          // best effort cleanup
        }
      }
    }

    throw lastError ?? new Error('Failed to load model');
  }, []);

  const prepare = useCallback(async () => {
    console.log(TAG, 'prepare() – loading model into memory, modelId:', CHAT_MODEL_ID);
    setStatus('preparing');
    setError(null);
    try {
      const downloaded = await isModelDownloaded(CHAT_MODEL_ID);
      if (!downloaded) {
        throw new Error('Model file is not downloaded yet');
      }

      if (modelRef.current) {
        console.log(TAG, 'existing model found in memory, unloading before prepare...');
        try {
          await modelRef.current.unload();
        } catch (unloadErr) {
          console.warn(TAG, 'existing model unload warning (continuing):', unloadErr);
        }
        modelRef.current = null;
      }

      const modelPath = getModelPath(CHAT_MODEL_ID);
      console.log(TAG, 'model path:', modelPath);
      // n_gpu_layers: 99  → offload all layers to GPU
      //   iOS:     Metal GPU (enabled by default in release builds)
      //   Android: OpenCL GPU — requires the llama.rn plugin to be built with
      //            enableOpenCL: true in app.json (already set). OpenCL offload
      //            is the primary speed-up on Android; it can cut inference time
      //            by 3-5× vs pure CPU on Adreno/Mali GPUs.
      // n_threads: 4  → number of CPU threads used for layers NOT offloaded to GPU.
      //   On most mobile SoCs, 4 performance cores is optimal. Increasing beyond
      //   this adds scheduling overhead without proportional gain on small models.
      // use_mlock: true → pin model weights in RAM so the OS cannot swap them out
      //   mid-inference (reduces latency spikes on memory-constrained devices).
      const model = llama.languageModel(modelPath, {
        contextParams: {
          n_ctx: 4096,
          n_gpu_layers: 99,
          n_threads: 4,
          use_mlock: true,
        },
      });
      console.log(TAG, 'calling model.prepare()…');
      await model.prepare();

      let model: ReturnType<typeof llama.languageModel>;
      try {
        model = await createAndPrepareWithFallback(modelPath);
      } catch (firstPrepareError) {
        const firstPrepareMsg =
          firstPrepareError instanceof Error
            ? firstPrepareError.message
            : String(firstPrepareError);
        console.warn(TAG, 'initial prepare failed, attempting redownload recovery:', firstPrepareMsg);

        try {
          await removeModel(CHAT_MODEL_ID);
          console.log(TAG, 'stale model removed');
        } catch (removeErr) {
          console.warn(TAG, 'removeModel warning (continuing):', removeErr);
        }

        setStatus('downloading');
        setDownloadProgress(0);
        await downloadModel(CHAT_MODEL_ID, ({ percentage }) => {
          const pct = Math.round(percentage);
          setDownloadProgress(pct);
        });

        setStatus('preparing');
        const recoveredPath = getModelPath(CHAT_MODEL_ID);
        console.log(TAG, 'recovered model path:', recoveredPath);
        model = await createAndPrepareWithFallback(recoveredPath);
      }

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
  }, [createAndPrepareWithFallback]);

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
