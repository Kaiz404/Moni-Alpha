export { type DebugModule, type DebugTestResult, type LogFn } from './types';

export {
  runModelStatusCheck,
  loadModel,
  unload as unloadModel,
  getModelInfo,
  downloadModelsDebug,
  deleteModelsDebug,
} from './model-status';

export {
  startHeartbeat,
  stopHeartbeat,
  isHeartbeatRunning,
} from './heartbeat-test';

export {
  runLLMBackgroundTest,
  stopLLMProcessor,
} from './llm-background-test';

export { runNotificationTests } from './notification-test';

export { seedHeatmapData, clearHeatmapSeedData } from './heatmap-seed';
export { seedVisualDemoData, clearVisualSeedData } from './visual-seed';

export {
  runQueueInspection,
  pruneQueue,
  getQueueSnapshot,
} from './queue-inspector';

export { runVisionImageDescribeTest } from './vision-image-test';

export {
  PROCESS_LABELS,
  formatDuration,
  useDebugProcessMonitor,
  useCapturedProcessLogs,
  type ProcessId,
  type ProcessState,
} from './process-monitor';

export {
  getNotificationProcessSnapshot,
  type NotificationProcessSnapshot,
} from './notification-process-reader';
