import {
  areModelsDownloaded,
  getOrLoadModel,
  unloadModel,
  downloadModels,
  deleteAllModels,
  MAIN_MODEL_ID,
  MMPROJ_ID,
  type LoadedModel,
  type ModelDownloadProgress,
} from '@/lib/ai/model-manager';
import { isModelDownloaded, getModelPath } from '@react-native-ai/llama';
import type { LogFn, DebugTestResult } from './types';

export type ModelInfo = {
  mainDownloaded: boolean;
  mmProjDownloaded: boolean;
  mainPath: string | null;
  mmProjPath: string | null;
  loaded: boolean;
  modelInstance: LoadedModel | null;
};

let cachedInstance: LoadedModel | null = null;

export async function getModelInfo(log: LogFn): Promise<ModelInfo> {
  log('Checking model download status...');
  const { main, mmProj } = await areModelsDownloaded();

  let mainPath: string | null = null;
  let mmProjPath: string | null = null;

  if (main) {
    try {
      mainPath = getModelPath(MAIN_MODEL_ID);
    } catch { /* not available */ }
  }
  if (mmProj) {
    try {
      mmProjPath = getModelPath(MMPROJ_ID);
    } catch { /* not available */ }
  }

  log(`Main model: ${main ? 'downloaded' : 'NOT downloaded'}`);
  log(`Vision projector: ${mmProj ? 'downloaded' : 'NOT downloaded'}`);
  if (mainPath) log(`Main path: ${mainPath}`);
  if (mmProjPath) log(`MMProj path: ${mmProjPath}`);

  const loaded = cachedInstance !== null;
  log(`Model loaded in memory: ${loaded ? 'YES' : 'NO'}`);

  return {
    mainDownloaded: main,
    mmProjDownloaded: mmProj,
    mainPath,
    mmProjPath,
    loaded,
    modelInstance: cachedInstance,
  };
}

export async function loadModel(log: LogFn): Promise<DebugTestResult> {
  try {
    log('Loading model via getOrLoadModel()...');
    const start = Date.now();
    const model = await getOrLoadModel();
    const elapsed = Date.now() - start;

    if (!model) {
      log('Model returned null — likely not downloaded');
      return { success: false, summary: 'Model not available (not downloaded?)' };
    }

    cachedInstance = model;
    log(`Model loaded successfully in ${elapsed}ms`);
    return { success: true, summary: `Model loaded (${elapsed}ms)` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Load failed: ${msg}`);
    return { success: false, summary: `Load failed: ${msg}` };
  }
}

export async function unload(log: LogFn): Promise<DebugTestResult> {
  try {
    log('Unloading model...');
    await unloadModel();
    cachedInstance = null;
    log('Model unloaded');
    return { success: true, summary: 'Model unloaded' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Unload failed: ${msg}`);
    return { success: false, summary: `Unload failed: ${msg}` };
  }
}

export async function runModelStatusCheck(log: LogFn): Promise<DebugTestResult> {
  try {
    const info = await getModelInfo(log);

    log('');
    log('=== Model Status Summary ===');
    log(`Main model (${MAIN_MODEL_ID.split('/').pop()}):`);
    log(`  Downloaded: ${info.mainDownloaded ? 'YES' : 'NO'}`);
    log(`  Path: ${info.mainPath ?? 'N/A'}`);
    log('');
    log(`Vision projector (${MMPROJ_ID.split('/').pop()}):`);
    log(`  Downloaded: ${info.mmProjDownloaded ? 'YES' : 'NO'}`);
    log(`  Path: ${info.mmProjPath ?? 'N/A'}`);
    log('');
    log(`Loaded in memory: ${info.loaded ? 'YES' : 'NO'}`);

    if (!info.mainDownloaded) {
      return { success: false, summary: 'Main model not downloaded' };
    }

    return {
      success: true,
      summary: `Main: OK | Vision: ${info.mmProjDownloaded ? 'OK' : 'N/A'} | Loaded: ${info.loaded ? 'Yes' : 'No'}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Status check failed: ${msg}`);
    return { success: false, summary: msg };
  }
}

export async function downloadModelsDebug(log: LogFn): Promise<DebugTestResult> {
  try {
    const { main, mmProj } = await areModelsDownloaded();
    if (main && mmProj) {
      log('All models already downloaded');
      return { success: true, summary: 'Models already downloaded' };
    }

    log('Starting model download...');
    log(`Main model: ${MAIN_MODEL_ID.split('/').pop()}`);
    log(`Vision projector: ${MMPROJ_ID.split('/').pop()}`);

    await downloadModels((p: ModelDownloadProgress) => {
      log(`Main: ${p.mainPct}% | MMProj: ${p.mmProjPct}%`);
    });

    log('Download complete');
    return { success: true, summary: 'Models downloaded successfully' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Download failed: ${msg}`);
    return { success: false, summary: `Download failed: ${msg}` };
  }
}

export async function deleteModelsDebug(log: LogFn): Promise<DebugTestResult> {
  try {
    log('Unloading model from memory...');
    log('Deleting all model files from disk...');
    await deleteAllModels();
    cachedInstance = null;
    log('All models deleted');
    return { success: true, summary: 'All models deleted' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Delete failed: ${msg}`);
    return { success: false, summary: `Delete failed: ${msg}` };
  }
}
