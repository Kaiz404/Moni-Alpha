import { generateText } from 'ai';
import { getOrLoadModel, isVisionMultimodalEnabled } from '@/lib/ai/model-manager';
import { resizeImageToVisionMax, VISION_MAX_EDGE_PX } from '@/lib/storage/image-storage';
import type { LogFn, DebugTestResult } from './types';

const DESCRIBE_SYSTEM =
  'You are a helpful assistant. Answer only from what is visible in the image.';

const DESCRIBE_USER =
  'Describe this image in 2–6 short sentences. Mention visible text, numbers, currency, and whether it looks like a receipt, screenshot, or photo.';

/** Long VL runs can be slow; cap wait so the UI never looks dead forever. */
const VISION_TIMEOUT_MS = 180_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

function mediaTypeForUri(uri: string): 'image/jpeg' | 'image/png' {
  return uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
}

/**
 * Loads the shared LLM and asks it to describe the image (vision smoke test).
 * Requires mmproj / vision-capable load; otherwise returns a clear failure.
 */
export async function runVisionImageDescribeTest(
  imageUri: string,
  log: LogFn,
): Promise<DebugTestResult> {
  log('=== Vision smoke test ===');
  log(`Image URI: ${imageUri.slice(0, 80)}${imageUri.length > 80 ? '…' : ''}`);

  const visionUri = await resizeImageToVisionMax(imageUri);
  if (visionUri !== imageUri) {
    log(`Downscaled for vision (max ${VISION_MAX_EDGE_PX}px edge): ${visionUri.slice(0, 80)}…`);
  }

  log('Loading model (getOrLoadModel)...');
  const model = await getOrLoadModel();
  if (!model) {
    log('FAIL: Model not in memory — use “Load Model” or download first.');
    return { success: false, summary: 'Model not loaded' };
  }

  const visionOk = isVisionMultimodalEnabled();
  log(`isVisionMultimodalEnabled(): ${visionOk ? 'true (mmproj loaded)' : 'false (text-only load)'}`);

  if (!visionOk) {
    log(
      'FAIL: Current model session has no vision stack. Multimodal init failed or mmproj missing.',
    );
    log('Tip: ensure mmproj is downloaded and the model prepared with projector.');
    return {
      success: false,
      summary: 'Vision not active — text-only model session',
    };
  }

  const mediaType = mediaTypeForUri(visionUri);

  try {
    log(`Running generateText (multimodal, ${VISION_TIMEOUT_MS / 1000}s max)...`);

    const result = await withTimeout(
      generateText({
        model,
        system: DESCRIBE_SYSTEM,
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: DESCRIBE_USER },
              { type: 'file' as const, mediaType, data: visionUri },
            ],
          },
        ],
        temperature: 0.2,
      }),
      VISION_TIMEOUT_MS,
      'vision-describe',
    );

    const text = (result.text ?? '').trim();
    if (!text) {
      log('FAIL: Empty model response');
      return { success: false, summary: 'Empty description' };
    }

    log('');
    log('--- Model description ---');
    log(text);
    log('-------------------------');

    return {
      success: true,
      summary: `Description (${text.length} chars)`,
      details: text,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`generateText failed: ${msg}`);
    log('Trying native context.completion fallback...');

    try {
      const ctx = model.getContext?.();
      if (!ctx?.completion) {
        return { success: false, summary: `Vision error: ${msg}` };
      }

      // llama.rn supports image_paths; TS types may omit it
      const raw = (await withTimeout(
        ctx.completion({
          prompt: `${DESCRIBE_SYSTEM}\n\n${DESCRIBE_USER}`,
          image_paths: [visionUri],
          n_predict: 256,
          temperature: 0.2,
        } as Parameters<typeof ctx.completion>[0]),
        VISION_TIMEOUT_MS,
        'native-completion',
      )) as { text?: string };

      const text = (raw?.text ?? '').trim();
      if (!text) {
        return { success: false, summary: `Vision error: ${msg}` };
      }

      log('');
      log('--- Model description (native completion) ---');
      log(text);
      log('--------------------------------------------');

      return {
        success: true,
        summary: `Description via native (${text.length} chars)`,
        details: text,
      };
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      log(`Native fallback failed: ${msg2}`);
      return {
        success: false,
        summary: `Vision failed: ${msg}`,
        details: msg2,
      };
    }
  }
}
