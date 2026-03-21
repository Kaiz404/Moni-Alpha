import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MAIN_MODEL_ID,
  areModelsDownloaded,
  downloadModels,
  getOrLoadModel,
  unloadModel as unloadModelManager,
  type LoadedModel,
  type ModelDownloadProgress,
} from '@/lib/ai/model-manager';

export { MAIN_MODEL_ID as CHAT_MODEL_ID };

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
  const modelRef = useRef<LoadedModel | null>(null);

  const prepare = useCallback(async () => {
    console.log(TAG, 'prepare()');
    setStatus('preparing');
    setError(null);
    try {
      const model = await getOrLoadModel();
      if (!model) throw new Error('Model could not be loaded');
      modelRef.current = model;
      console.log(TAG, 'model ready');
      setStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(TAG, 'prepare failed:', msg);
      modelRef.current = null;
      setStatus('error');
      setError(msg);
    }
  }, []);

  const downloadAndPrepare = useCallback(async () => {
    console.log(TAG, 'downloadAndPrepare()');
    setError(null);
    try {
      const { main } = await areModelsDownloaded();
      if (!main) {
        setStatus('downloading');
        setDownloadProgress(0);
        await downloadModels((p: ModelDownloadProgress) => {
          const combined = Math.round((p.mainPct * 0.85) + (p.mmProjPct * 0.15));
          setDownloadProgress(combined);
        });
      }
      await prepare();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(TAG, 'downloadAndPrepare failed:', msg);
      setStatus('error');
      setError(msg);
    }
  }, [prepare]);

  const unload = useCallback(async () => {
    console.log(TAG, 'unload()');
    await unloadModelManager();
    modelRef.current = null;
    setStatus('not-downloaded');
  }, []);

  useEffect(() => {
    let cancelled = false;
    console.log(TAG, 'mount – checking model status');
    setStatus('checking');
    areModelsDownloaded()
      .then(({ main }) => {
        if (cancelled) return;
        if (main) {
          prepare();
        } else {
          setStatus('not-downloaded');
        }
      })
      .catch(() => {
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
