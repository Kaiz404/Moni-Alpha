import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import BackgroundService from 'react-native-background-actions';
import {
  runModelStatusCheck,
  loadModel,
  unloadModel,
  downloadModelsDebug,
  deleteModelsDebug,
  startHeartbeat,
  stopHeartbeat,
  isHeartbeatRunning,
  runLLMBackgroundTest,
  stopLLMProcessor,
  runNotificationTests,
  seedHeatmapData,
  clearHeatmapSeedData,
  seedVisualDemoData,
  clearVisualSeedData,
  runQueueInspection,
  pruneQueue,
  getQueueSnapshot,
  runVisionImageDescribeTest,
  PROCESS_LABELS,
  formatDuration,
  useDebugProcessMonitor,
  useCapturedProcessLogs,
  type DebugTestResult,
  type LogFn,
  type ProcessId,
} from '@/lib/debug';

// ─── Grid button definitions ─────────────────────────────────────────────────

type GridButton = {
  id: string;
  label: string;
  description: string;
  color: string;
  activeColor?: string;
  run: (log: LogFn) => Promise<DebugTestResult>;
  /** For toggle-style buttons (heartbeat, etc.) */
  isActive?: () => boolean;
  onActivePress?: (log: LogFn) => Promise<void>;
  activeLabel?: string;
};

function useDebugButtons(): GridButton[] {
  return [
    {
      id: 'model-download',
      label: 'Download Models',
      description: 'Download LLM + vision projector',
      color: '#059669',
      run: downloadModelsDebug,
    },
    {
      id: 'model-delete',
      label: 'Delete Models',
      description: 'Remove all model files',
      color: '#dc2626',
      run: deleteModelsDebug,
    },
    {
      id: 'model-status',
      label: 'Model Status',
      description: 'Check download & load state',
      color: '#3b82f6',
      run: runModelStatusCheck,
    },
    {
      id: 'model-load',
      label: 'Load Model',
      description: 'Load LLM into memory',
      color: '#8b5cf6',
      run: loadModel,
    },
    {
      id: 'model-unload',
      label: 'Unload Model',
      description: 'Free model from memory',
      color: '#6366f1',
      run: unloadModel,
    },
    {
      id: 'heartbeat',
      label: 'Heartbeat',
      description: 'BG service alive test (no LLM)',
      color: '#10b981',
      activeColor: '#dc2626',
      isActive: isHeartbeatRunning,
      activeLabel: 'Stop Heartbeat',
      run: startHeartbeat,
      onActivePress: stopHeartbeat,
    },
    {
      id: 'llm-bg',
      label: 'LLM Background',
      description: 'Enqueue + process in BG service',
      color: '#4f46e5',
      run: runLLMBackgroundTest,
    },
    {
      id: 'stop-processor',
      label: 'Stop Processor',
      description: 'Kill background LLM processor',
      color: '#ef4444',
      run: stopLLMProcessor,
    },
    {
      id: 'notif-test',
      label: 'Notification Test',
      description: 'Run 4 classification test cases',
      color: '#f59e0b',
      run: runNotificationTests,
    },
    {
      id: 'queue-inspect',
      label: 'Queue Inspector',
      description: 'View processing queue state',
      color: '#06b6d4',
      run: runQueueInspection,
    },
    {
      id: 'queue-prune',
      label: 'Prune Queue',
      description: 'Clear all queue items',
      color: '#64748b',
      run: pruneQueue,
    },
    {
      id: 'seed-heatmap',
      label: 'Seed Heatmap',
      description: 'Insert 60 test locations',
      color: '#22c55e',
      run: seedHeatmapData,
    },
    {
      id: 'clear-heatmap',
      label: 'Clear Heatmap',
      description: 'Remove seeded data',
      color: '#b91c1c',
      run: clearHeatmapSeedData,
    },
    {
      id: 'seed-visual',
      label: 'Seed Visual',
      description: 'Insert Touch n Go chart demo data',
      color: '#f59e0b',
      run: seedVisualDemoData,
    },
    {
      id: 'clear-visual',
      label: 'Clear Visual',
      description: 'Remove Touch n Go visual demo',
      color: '#ea580c',
      run: clearVisualSeedData,
    },
  ];
}

// ─── Vision smoke test: pick image → LLM describes it ────────────────────────

async function launchImageForVisionTest(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to take a photo.');
      return null;
    }
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return null;
    }
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

function showVisionImageOptions(onPick: (source: 'camera' | 'library') => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) onPick('camera');
        if (buttonIndex === 2) onPick('library');
      },
    );
  } else {
    Alert.alert('Vision test', 'Choose an image source', [
      { text: 'Take Photo', onPress: () => onPick('camera') },
      { text: 'Choose from Library', onPress: () => onPick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}

// ─── Status bar (live indicators) ────────────────────────────────────────────

function StatusBar() {
  const [snap, setSnap] = useState(() => getQueueSnapshot());
  const [heartbeat, setHeartbeat] = useState(false);
  const [bgService, setBgService] = useState(false);

  useEffect(() => {
    const poll = setInterval(() => {
      setSnap(getQueueSnapshot());
      setHeartbeat(isHeartbeatRunning());
      setBgService(BackgroundService.isRunning());
    }, 1000);
    return () => clearInterval(poll);
  }, []);

  const processorUp = snap.processorRunning || bgService || heartbeat;

  return (
    <View className="flex-row items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800">
      <View
        className="w-2.5 h-2.5 rounded-full mr-2"
        style={{ backgroundColor: processorUp ? '#22c55e' : '#6b7280' }}
      />
      <Text className="text-zinc-400 text-xs font-mono flex-1">
        {heartbeat
          ? 'Heartbeat running'
          : snap.processorRunning
            ? 'Processor running'
            : 'Idle'}
        {'  |  '}Q: {snap.pending}p {snap.processing}a {snap.done}d {snap.error}e
      </Text>
    </View>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DebugPage() {
  const buttons = useDebugButtons();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [visionBusy, setVisionBusy] = useState(false);
  const [visionPreviewUri, setVisionPreviewUri] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ id: string; result: DebugTestResult } | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [selectedProcessLog, setSelectedProcessLog] = useState<ProcessId>('debug-log');
  const scrollRef = useRef<ScrollView>(null);
  const processStates = useDebugProcessMonitor({
    uiActionRunning: runningId !== null,
    visionRunning: visionBusy,
  });
  const { clearCapturedLogs, getFormattedLogs } = useCapturedProcessLogs();

  const uiLocked = runningId !== null || visionBusy;

  const log: LogFn = useCallback((message: string) => {
    setLogLines((prev) => [...prev, message]);
    console.log('[Debug]', message);
  }, []);

  const clearLog = useCallback(() => {
    setLogLines([]);
    setLastResult(null);
    clearCapturedLogs();
  }, [clearCapturedLogs]);

  const selectedProcessLogs = getFormattedLogs(selectedProcessLog, 160);

  const runVisionDescribeFlow = useCallback(
    async (source: 'camera' | 'library') => {
      if (uiLocked) return;
      setVisionBusy(true);
      setLogLines([]);
      setLastResult(null);
      setVisionPreviewUri(null);
      try {
        const uri = await launchImageForVisionTest(source);
        if (!uri) {
          setLastResult({
            id: 'vision-smoke',
            result: { success: false, summary: 'No image selected' },
          });
          return;
        }
        setVisionPreviewUri(uri);
        log('Image captured — asking LLM to describe it...');
        const result = await runVisionImageDescribeTest(uri, log);
        setLastResult({ id: 'vision-smoke', result });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`Vision test error: ${msg}`);
        setLastResult({
          id: 'vision-smoke',
          result: { success: false, summary: `Error: ${msg}` },
        });
      } finally {
        setVisionBusy(false);
      }
    },
    [uiLocked, log],
  );

  const handlePress = useCallback(
    async (btn: GridButton) => {
      if (runningId || visionBusy) return;

      // Toggle buttons: if active, run the stop action
      if (btn.isActive?.() && btn.onActivePress) {
        setRunningId(btn.id);
        setLogLines([]);
        setLastResult(null);
        try {
          await btn.onActivePress(log);
          setLastResult({
            id: btn.id,
            result: { success: true, summary: `${btn.label} stopped` },
          });
        } finally {
          setRunningId(null);
        }
        return;
      }

      setRunningId(btn.id);
      setLogLines([]);
      setLastResult(null);
      try {
        const result = await btn.run(log);
        setLastResult({ id: btn.id, result });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        log(`Unhandled error: ${msg}`);
        setLastResult({
          id: btn.id,
          result: { success: false, summary: `Error: ${msg}` },
        });
      } finally {
        setRunningId(null);
      }
    },
    [runningId, visionBusy, log],
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar />

      <ScrollView
        ref={scrollRef}
        contentContainerClassName="pb-20"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-white text-lg font-bold">Debug Panel</Text>
          <Text className="text-zinc-500 text-xs mt-1">
            Tap any button to run a test. Results appear below.
          </Text>
        </View>

        {/* Vision smoke test */}
        <View className="mx-4 mt-4 rounded-xl border border-violet-900/60 bg-zinc-950/80 p-3">
          <Text className="text-violet-200 font-semibold text-sm">Vision smoke test</Text>
          <Text className="text-zinc-500 text-[10px] mt-1 leading-4">
            Pick a photo or use the camera, then the on-device LLM only describes what it sees.
            Requires vision (mmproj) — check Model Status if this always fails.
          </Text>

          <View className="flex-row flex-wrap gap-2 mt-3">
            <TouchableOpacity
              onPress={() => showVisionImageOptions(runVisionDescribeFlow)}
              disabled={uiLocked}
              activeOpacity={0.75}
              className="rounded-lg px-3 py-2.5 border border-violet-600/50 bg-violet-950/50"
              style={{ opacity: uiLocked ? 0.45 : 1 }}
            >
              {visionBusy ? (
                <ActivityIndicator size="small" color="#a78bfa" />
              ) : (
                <Text className="text-violet-100 text-xs font-semibold">Pick or capture…</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => runVisionDescribeFlow('camera')}
              disabled={uiLocked}
              className="rounded-lg px-3 py-2.5 border border-zinc-700 bg-zinc-900"
              style={{ opacity: uiLocked ? 0.45 : 1 }}
            >
              <Text className="text-zinc-300 text-xs">Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => runVisionDescribeFlow('library')}
              disabled={uiLocked}
              className="rounded-lg px-3 py-2.5 border border-zinc-700 bg-zinc-900"
              style={{ opacity: uiLocked ? 0.45 : 1 }}
            >
              <Text className="text-zinc-300 text-xs">Library</Text>
            </TouchableOpacity>
          </View>

          {visionPreviewUri ? (
            <View className="mt-3 rounded-lg overflow-hidden border border-zinc-800">
              <Image
                source={{ uri: visionPreviewUri }}
                style={{ width: '100%', height: 140, backgroundColor: '#0a0a0a' }}
                contentFit="contain"
              />
            </View>
          ) : null}
        </View>

        {/* Button Grid */}
        <View className="flex-row flex-wrap px-3 mt-1">
          {buttons.map((btn) => {
            const isActive = btn.isActive?.() ?? false;
            const isRunning = runningId === btn.id;
            const isDisabled = uiLocked && !isRunning;
            const displayLabel = isActive && btn.activeLabel ? btn.activeLabel : btn.label;
            const displayColor = isActive && btn.activeColor ? btn.activeColor : btn.color;

            return (
              <View key={btn.id} className="w-1/3 p-1">
                <TouchableOpacity
                  onPress={() => handlePress(btn)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                  className="rounded-xl p-3 min-h-[80px] justify-between"
                  style={{
                    backgroundColor: isDisabled ? '#1a1a1a' : `${displayColor}18`,
                    borderWidth: 1,
                    borderColor: isRunning ? displayColor : isDisabled ? '#222' : `${displayColor}40`,
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {isRunning ? (
                    <ActivityIndicator size="small" color={displayColor} />
                  ) : (
                    <View
                      className="w-2 h-2 rounded-full mb-1"
                      style={{
                        backgroundColor: isActive ? '#22c55e' : displayColor,
                      }}
                    />
                  )}
                  <Text
                    className="text-xs font-semibold mt-1"
                    style={{ color: isDisabled ? '#555' : '#e2e8f0' }}
                    numberOfLines={1}
                  >
                    {displayLabel}
                  </Text>
                  <Text
                    className="text-[10px] mt-0.5"
                    style={{ color: isDisabled ? '#444' : '#94a3b8' }}
                    numberOfLines={2}
                  >
                    {btn.description}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Process monitor */}
        <View className="mx-4 mt-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
          <Text className="text-zinc-200 font-semibold text-sm">Background process monitor</Text>
          <Text className="text-zinc-500 text-[10px] mt-1">
            Live state, running process count, and duration per process.
          </Text>

          <View className="flex-row flex-wrap mt-3">
            {processStates.map((proc) => (
              <View key={proc.id} className="w-1/2 p-1">
                <View
                  className="rounded-lg border p-2"
                  style={{
                    borderColor: proc.state === 'running' ? '#166534' : '#3f3f46',
                    backgroundColor: proc.state === 'running' ? '#052e16aa' : '#18181baa',
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] font-semibold text-zinc-200">{proc.label}</Text>
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: proc.state === 'running' ? '#22c55e' : '#71717a' }}
                    />
                  </View>
                  <Text className="text-[10px] text-zinc-400 mt-1">
                    State: {proc.state === 'running' ? 'Running' : 'Idle'}
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    Running for: {proc.state === 'running' ? formatDuration(proc.runningForMs) : '-'}
                  </Text>
                  {proc.detail ? (
                    <Text className="text-[9px] text-zinc-500 mt-1 leading-3" numberOfLines={2}>
                      {proc.detail}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <Text className="text-[10px] text-zinc-500 mt-2">
            Active: {processStates.filter((p) => p.state === 'running').length}/{processStates.length}
          </Text>
        </View>

        {/* Result banner */}
        {lastResult && (
          <View
            className="mx-4 mt-3 rounded-lg px-3 py-2"
            style={{
              backgroundColor: lastResult.result.success ? '#052e1680' : '#2a040480',
              borderWidth: 1,
              borderColor: lastResult.result.success ? '#16a34a50' : '#dc262650',
            }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: lastResult.result.success ? '#4ade80' : '#fca5a5' }}
            >
              {lastResult.result.success ? 'PASS' : 'FAIL'} — {lastResult.result.summary}
            </Text>
          </View>
        )}

        {/* Per-process logs */}
        <View className="mx-4 mt-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-zinc-400 text-xs font-semibold">Live process logs</Text>
            <TouchableOpacity onPress={clearLog}>
              <Text className="text-zinc-600 text-xs">Clear All Logs</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {(Object.keys(PROCESS_LABELS) as ProcessId[]).map((id) => (
              <TouchableOpacity
                key={id}
                onPress={() => setSelectedProcessLog(id)}
                className="rounded-md px-2.5 py-1.5 border"
                style={{
                  borderColor: selectedProcessLog === id ? '#3b82f6' : '#3f3f46',
                  backgroundColor: selectedProcessLog === id ? '#1e3a8a55' : '#18181b',
                }}
              >
                <Text
                  className="text-[10px]"
                  style={{ color: selectedProcessLog === id ? '#93c5fd' : '#a1a1aa' }}
                >
                  {PROCESS_LABELS[id]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {(selectedProcessLogs.length > 0 || logLines.length > 0) && (
          <View className="mx-4 mt-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-zinc-500 text-xs font-semibold">
                {PROCESS_LABELS[selectedProcessLog]} console
              </Text>
            </View>
            <View className="bg-zinc-950 rounded-lg border border-zinc-800 p-3">
              {(selectedProcessLogs.length > 0 ? selectedProcessLogs : logLines).map((line, i) => (
                <Text
                  key={i}
                  className="text-[11px] leading-4 font-mono"
                  style={{
                    color: line.startsWith('===')
                      ? '#60a5fa'
                      : line.startsWith('---')
                        ? '#a78bfa'
                        : line.includes('FAIL') || line.includes('failed') || line.includes('ERROR')
                          ? '#fca5a5'
                          : line.includes('PASS') || line.includes('success')
                            ? '#4ade80'
                            : '#d4d4d8',
                  }}
                  selectable
                >
                  {line}
                </Text>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
