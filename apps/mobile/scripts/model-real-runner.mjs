/*
  Attempt to run a small real-model test using the local model path.
  Usage:
    LOCAL_MODEL_PATH="C:\\Users\\User\\.lmstudio\\models\\qwen3.5-2b" node model-real-runner.mjs

  This script will try to load '@react-native-ai/llama' and instantiate a model.
  If the runtime environment here doesn't support the native model runtime, the script will print guidance.
*/
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

async function tryRun() {
  const modelPathEnv = process.env.LOCAL_MODEL_PATH || process.argv[2];
  if (!modelPathEnv) {
    console.error('Please set LOCAL_MODEL_PATH env var or pass the model path as first arg.');
    console.error('Example: LOCAL_MODEL_PATH="C:\\Users\\User\\.lmstudio\\models\\qwen3.5-2b" node model-real-runner.mjs');
    process.exit(2);
  }
  const resolved = path.resolve(modelPathEnv);
  if (!fs.existsSync(resolved)) {
    console.error('Model path does not exist:', resolved);
    process.exit(2);
  }

  let llama;
  try {
    llama = require('@react-native-ai/llama');
  } catch (e) {
    console.error('Could not require @react-native-ai/llama from Node.');
    console.error('This runtime may be intended for React Native native modules and not available in Node.');
    console.error('If you want to run the local model tests on-device, run a script inside the app runtime or provide a Node-compatible runtime.');
    console.error('Attempting to continue with best-effort instructions...');
    console.error(e.message);
    process.exit(1);
  }

  // Try to instantiate a language model (best-effort). APIs may differ per version.
  try {
    console.log('Attempting to create language model with path:', resolved);
    const lm = await llama.languageModel({ modelPath: resolved });
    console.log('Model instantiated. Running a simple generation test...');

    const prompt = 'Is this notification a transaction?\nNotification: You paid 15 USD to Amazon for order #1234.';
    // Try a simple generate call depending on provided API
    if (typeof lm.generate === 'function') {
      const out = await lm.generate({ prompt, maxTokens: 128 });
      console.log('Generation output:', out);
    } else if (typeof llama.generateText === 'function') {
      const out = await llama.generateText({ model: lm, prompt });
      console.log('Generation output:', out);
    } else {
      console.warn('Model object does not expose a compatible generate API. Inspect `lm` object manually.');
      console.log(Object.keys(lm));
    }

    // clean up if supported
    if (typeof lm.close === 'function') await lm.close();
    console.log('Done. If this worked, you can adapt this script to call the notification analysis prompt and process results.');
  } catch (err) {
    console.error('Failed to instantiate or run the local model.');
    console.error('Reason:', err && err.message ? err.message : err);
    console.error('Notes:');
    console.error('- Ensure your environment provides native bindings for the runtime used by @react-native-ai/llama.');
    console.error('- On-device (React Native) is the recommended environment for this package.');
    process.exit(1);
  }
}

tryRun();
