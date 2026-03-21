/**
 * Shared model lifecycle manager.
 *
 * Provides a singleton model instance that can be used by both the UI layer
 * (via useLlamaModel hook) and the background processor.
 *
 * Uses a single Qwen2.5-VL-3B-Instruct model for all flows (text, image,
 * notification). The mmproj projector enables vision capabilities when
 * processing receipt images.
 */
import {
  llama,
  downloadModel,
  isModelDownloaded,
  getModelPath,
  removeModel,
} from '@react-native-ai/llama';

// ─── Model IDs ──────────────────────────────────────────────────────────────

// export const MAIN_MODEL_ID = 'unsloth/Qwen2.5-VL-3B-Instruct-GGUF/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf';
export const MAIN_MODEL_ID = 'unsloth/Qwen3.5-0.8B-GGUF/Qwen3.5-0.8B-Q4_K_M.gguf';

// export const MMPROJ_ID = 'unsloth/Qwen2.5-VL-3B-Instruct-GGUF/mmproj-F16.gguf';
export const MMPROJ_ID = 'unsloth/Qwen3.5-0.8B-GGUF/mmproj-F16.gguf';

export type LoadedModel = ReturnType<typeof llama.languageModel>;

export type ModelDownloadProgress = {
  mainPct: number;
  mmProjPct: number;
};

// ─── Singleton state ────────────────────────────────────────────────────────

let modelInstance: LoadedModel | null = null;
let modelLoadPromise: Promise<LoadedModel | null> | null = null;

/** True only when the current instance was prepared with mmproj (vision). Text-only fallback sets this false. */
let visionMultimodalEnabled = false;

const TAG = '[ModelManager]';

/** Whether receipt images can use VL inference (mmproj loaded). If false, image flow uses text/context only. */
export function isVisionMultimodalEnabled(): boolean {
  return visionMultimodalEnabled;
}

const PREPARE_ATTEMPTS = [
  { n_ctx: 4096, n_gpu_layers: 99, n_threads: 4, use_mlock: true },
  { n_ctx: 2048, n_gpu_layers: 0, n_threads: 4, use_mlock: true },
  { n_ctx: 1024, n_gpu_layers: 0, n_threads: 4, use_mlock: false },
] as const;

// ─── Download ───────────────────────────────────────────────────────────────

export async function areModelsDownloaded(): Promise<{
  main: boolean;
  mmProj: boolean;
}> {
  const [main, mmProj] = await Promise.all([
    isModelDownloaded(MAIN_MODEL_ID),
    isModelDownloaded(MMPROJ_ID).catch(() => false),
  ]);
  return { main, mmProj };
}

export async function downloadModels(
  onProgress?: (p: ModelDownloadProgress) => void,
): Promise<void> {
  let mainPct = 0;
  let mmProjPct = 0;

  const report = () => onProgress?.({ mainPct, mmProjPct });

  const mainDownloaded = await isModelDownloaded(MAIN_MODEL_ID);
  if (!mainDownloaded) {
    await downloadModel(MAIN_MODEL_ID, ({ percentage }) => {
      mainPct = Math.round(percentage);
      report();
    });
  }
  mainPct = 100;
  report();

  const mmProjDownloaded = await isModelDownloaded(MMPROJ_ID).catch(() => false);
  if (!mmProjDownloaded) {
    try {
      await downloadModel(MMPROJ_ID, ({ percentage }) => {
        mmProjPct = Math.round(percentage);
        report();
      });
    } catch (e) {
      console.warn(TAG, 'mmproj download failed (vision will be unavailable):', e);
    }
  }
  mmProjPct = 100;
  report();
}

// ─── Load / unload ──────────────────────────────────────────────────────────

export async function getOrLoadModel(): Promise<LoadedModel | null> {
  if (modelInstance) return modelInstance;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = _doLoadModel().finally(() => {
    modelLoadPromise = null;
  });
  return modelLoadPromise;
}

async function _doLoadModel(): Promise<LoadedModel | null> {
  try {
    const mainReady = await isModelDownloaded(MAIN_MODEL_ID);
    if (!mainReady) {
      console.warn(TAG, 'Main model not downloaded — cannot load');
      return null;
    }

    const mainPath = getModelPath(MAIN_MODEL_ID);

    let projectorPath: string | undefined;
    try {
      const mmProjReady = await isModelDownloaded(MMPROJ_ID);
      if (mmProjReady) {
        projectorPath = getModelPath(MMPROJ_ID);
      }
    } catch {
      // Vision unavailable, proceed text-only
    }

    const { model, visionEnabled } = await createAndPrepare(mainPath, projectorPath);
    visionMultimodalEnabled = visionEnabled;
    modelInstance = model;
    return model;
  } catch (e) {
    console.error(TAG, 'getOrLoadModel failed:', e);
    return null;
  }
}

type VisionOpts = {
  projectorPath: string;
  projectorUseGpu: boolean;
};

/**
 * Try to load and prepare the model with the given vision options (or text-only if omitted).
 * Returns the prepared model or throws the last error.
 */
async function tryPrepare(
  modelPath: string,
  vision: VisionOpts | undefined,
  label: string,
): Promise<LoadedModel> {
  let lastError: unknown;

  for (const params of PREPARE_ATTEMPTS) {
    let model: LoadedModel | null = null;
    try {
      console.log(
        TAG,
        'prepare attempt:',
        params,
        vision ? `${label} gpu=${vision.projectorUseGpu}` : '(text-only)',
      );
      model = llama.languageModel(modelPath, {
        contextParams: params,
        ...(vision
          ? {
              projectorPath: vision.projectorPath,
              projectorUseGpu: vision.projectorUseGpu,
            }
          : {}),
      });
      await model.prepare();
      console.log(TAG, 'prepare succeeded:', params, label);
      return model;
    } catch (err) {
      lastError = err;
      console.warn(
        TAG,
        'prepare failed:',
        params,
        err instanceof Error ? err.message : err,
      );
      try {
        await model?.unload();
      } catch {
        // best-effort cleanup
      }
    }
  }

  throw lastError ?? new Error('All prepare attempts failed');
}

/**
 * Load model. If mmproj is present, try vision first (GPU then CPU projector).
 * If multimodal init fails on this device (common), fall back to text-only — same GGUF, no projector.
 */
async function createAndPrepare(
  modelPath: string,
  projectorPath?: string,
): Promise<{ model: LoadedModel; visionEnabled: boolean }> {
  if (projectorPath) {
    for (const projectorUseGpu of [true, false] as const) {
      try {
        const model = await tryPrepare(
          modelPath,
          { projectorPath, projectorUseGpu },
          '+vision',
        );
        return { model, visionEnabled: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isMultimodal =
          /multimodal|projector|vision/i.test(msg) ||
          msg.includes('Failed to initialize multimodal');
        console.warn(
          TAG,
          `Vision path failed (gpu=${projectorUseGpu}):`,
          msg,
          isMultimodal ? '' : '(will try other options)',
        );
      }
    }

    console.warn(
      TAG,
      'Multimodal support unavailable on this device (projector init failed). Loading text-only — receipt images will use fallback extraction.',
    );
  }

  const model = await tryPrepare(modelPath, undefined, 'text-only');
  return { model, visionEnabled: false };
}

export async function unloadModel(): Promise<void> {
  if (modelInstance) {
    try {
      await modelInstance.unload();
    } catch (e) {
      console.warn(TAG, 'unload warning:', e);
    }
    modelInstance = null;
  }
  visionMultimodalEnabled = false;
}

/** Remove all downloaded model files from disk. Unloads first if in memory. */
export async function deleteAllModels(): Promise<void> {
  await unloadModel();
  try { await removeModel(MAIN_MODEL_ID); } catch { /* may not exist */ }
  try { await removeModel(MMPROJ_ID); } catch { /* may not exist */ }
}

/** Force re-download if the model file is corrupted. */
export async function redownloadAndLoad(): Promise<LoadedModel | null> {
  await unloadModel();
  try {
    await removeModel(MAIN_MODEL_ID);
  } catch {
    // might not exist
  }
  await downloadModels();
  return getOrLoadModel();
}
