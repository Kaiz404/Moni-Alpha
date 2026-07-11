import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  runNotificationTests,
  runQueueInspection,
  pruneQueue,
  injectTestNotificationCapture,
  getNotificationDiagnostics,
  PROCESS_LABELS,
  useCapturedProcessLogs,
  useNotificationMonitor,
  QUEUE_STATUS_LABELS,
  QUEUE_STATUS_COLORS,
  PERMISSION_COLORS,
  type DebugTestResult,
  type LogFn,
  type ProcessId,
} from '@/lib/debug';

type GridButton = {
  id: string;
  label: string;
  description: string;
  color: string;
  run: (log: LogFn) => Promise<DebugTestResult>;
};

function useDebugButtons(): GridButton[] {
  return [
    {
      id: 'simulate-capture',
      label: 'Simulate Capture',
      description: 'Write a test notification to MMKV',
      color: '#8b5cf6',
      run: injectTestNotificationCapture,
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
  ];
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
      <Text className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</Text>
      <View className="mt-1">{children}</View>
    </View>
  );
}

function NotificationPipelinePanel() {
  const { snapshot, permissionStatus, lastCheckedAt, refresh } = useNotificationMonitor();
  const { queue, recent, isAndroid } = snapshot;
  const diagnostics = getNotificationDiagnostics(permissionStatus);

  const permissionLabel =
    permissionStatus === 'authorized'
      ? 'Authorized'
      : permissionStatus === 'denied'
        ? 'Denied'
        : permissionStatus === 'unavailable'
          ? 'N/A (iOS)'
          : 'Unknown';

  const buildLabel = diagnostics.isExpoGo
    ? 'Expo Go (unsupported)'
    : diagnostics.isDevClient
      ? 'Dev client'
      : 'Production build';

  return (
    <View className="mx-3 mt-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-zinc-200 font-semibold text-base">Notification pipeline</Text>
        <TouchableOpacity onPress={refresh} hitSlop={8}>
          <Text className="text-xs text-blue-400">Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-zinc-500 text-xs mt-1 leading-4">
        Listener access (read other apps&apos; alerts). Not the same as App Info → Notifications.
      </Text>
      {lastCheckedAt ? (
        <Text className="text-[10px] text-zinc-600 mt-1">
          Permission re-checked {formatRelativeTime(lastCheckedAt)}
        </Text>
      ) : null}

      <View className="mt-4 gap-2">
        <View className="flex-row gap-2">
          <StatCard label="Permission">
            <View className="flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: PERMISSION_COLORS[permissionStatus] }}
              />
              <Text className="text-sm font-semibold text-zinc-100">{permissionLabel}</Text>
            </View>
          </StatCard>
          <StatCard label="Last captured">
            <Text className="text-sm font-semibold text-zinc-100">
              {formatRelativeTime(snapshot.lastReceivedAt)}
            </Text>
          </StatCard>
        </View>

        <View className="flex-row gap-2">
          <StatCard label="Captured">
            <Text className="text-sm font-semibold text-zinc-100">{snapshot.capturedTotal}</Text>
          </StatCard>
          <StatCard label="Prefilter pass">
            <Text className="text-sm font-semibold text-green-400">{snapshot.prefilterPassed}</Text>
          </StatCard>
          <StatCard label="Ignored">
            <Text className="text-sm font-semibold text-zinc-400">{snapshot.prefilterIgnored}</Text>
          </StatCard>
        </View>
      </View>

      <View className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-zinc-500">Queue (notifications only)</Text>
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: queue.running ? '#22c55e' : '#71717a' }}
            />
            <Text className="text-xs text-zinc-400">{queue.running ? 'Processing' : 'Idle'}</Text>
          </View>
        </View>
        <Text className="text-xs text-zinc-300 mt-1.5 font-mono leading-5">
          {queue.pending} pending · {queue.processing} active · {queue.done} done · {queue.error}{' '}
          error
        </Text>
      </View>

      <View className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5">
        <Text className="text-xs text-zinc-500">Native status</Text>
        <Text className="text-sm font-mono font-medium text-zinc-200 mt-0.5">{permissionStatus}</Text>
        <Text className="text-[10px] text-zinc-500 mt-1 leading-4">
          Queried live from Android — not cached. If this disagrees with system settings, pull to
          refresh or revisit this screen after changing access.
        </Text>
      </View>

      <View className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5">
        <Text className="text-xs text-zinc-500">Build</Text>
        <Text
          className="text-sm font-medium mt-0.5"
          style={{ color: diagnostics.isExpoGo ? '#f87171' : '#a5b4fc' }}
        >
          {buildLabel}
        </Text>
      </View>

      {!isAndroid ? (
        <Text className="text-xs text-zinc-500 mt-3 leading-4">
          Notification listener is Android-only.
        </Text>
      ) : recent.length === 0 ? (
        <View className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5">
          <Text className="text-xs font-semibold text-amber-300/90">No captures yet</Text>
          {diagnostics.troubleshooting.map((tip, i) => (
            <Text key={i} className="text-xs text-amber-200/70 mt-1.5 leading-4">
              • {tip}
            </Text>
          ))}
        </View>
      ) : (
        <View className="mt-4">
          <Text className="text-xs text-zinc-500 mb-2">Recent captures</Text>
          {recent.map((entry) => (
            <View
              key={entry.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 mb-2"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text className="text-sm font-semibold text-zinc-100 flex-1" numberOfLines={1}>
                  {entry.app}
                </Text>
                <View
                  className="rounded px-2 py-0.5 shrink-0"
                  style={{ backgroundColor: `${QUEUE_STATUS_COLORS[entry.queueStatus]}22` }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{ color: QUEUE_STATUS_COLORS[entry.queueStatus] }}
                  >
                    {QUEUE_STATUS_LABELS[entry.queueStatus]}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-zinc-400 mt-1 leading-4">{entry.preview}</Text>
              <Text className="text-[10px] text-zinc-600 mt-1">
                {formatRelativeTime(entry.receivedAt)}
                {!entry.prefilterPassed ? ' · prefilter rejected' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function DebugPage() {
  const buttons = useDebugButtons();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ id: string; result: DebugTestResult } | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [selectedProcessLog, setSelectedProcessLog] = useState<ProcessId>('debug-log');
  const scrollRef = useRef<ScrollView>(null);
  const { clearCapturedLogs, getFormattedLogs } = useCapturedProcessLogs();

  const uiLocked = runningId !== null;

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

  const handlePress = useCallback(
    async (btn: GridButton) => {
      if (runningId) return;

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
    [runningId, log],
  );

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="pb-20"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View className="px-3 pt-4 pb-2">
          <Text className="text-white text-lg font-bold">Debug Panel</Text>
          <Text className="text-zinc-500 text-xs mt-1">
            Tools for testing notification capture and the AI processing queue.
          </Text>
        </View>

        <NotificationPipelinePanel />

        <View className="flex-row flex-wrap px-3 mt-4">
          {buttons.map((btn) => {
            const isRunning = runningId === btn.id;
            const isDisabled = uiLocked && !isRunning;

            return (
              <View key={btn.id} className="w-1/3 p-1">
                <TouchableOpacity
                  onPress={() => handlePress(btn)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                  className="rounded-xl p-3 min-h-[80px] justify-between"
                  style={{
                    backgroundColor: isDisabled ? '#1a1a1a' : `${btn.color}18`,
                    borderWidth: 1,
                    borderColor: isRunning ? btn.color : isDisabled ? '#222' : `${btn.color}40`,
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {isRunning ? (
                    <ActivityIndicator size="small" color={btn.color} />
                  ) : (
                    <View
                      className="w-2 h-2 rounded-full mb-1"
                      style={{ backgroundColor: btn.color }}
                    />
                  )}
                  <Text
                    className="text-xs font-semibold mt-1"
                    style={{ color: isDisabled ? '#555' : '#e2e8f0' }}
                    numberOfLines={1}
                  >
                    {btn.label}
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

        <View className="mx-4 mt-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-zinc-400 text-xs font-semibold">Live logs</Text>
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
