import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandHeader } from '@/components/ui/brand-header';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  runNotificationTests,
  runQueueInspection,
  pruneQueue,
  injectTestNotificationCapture,
  PROCESS_LABELS,
  useCapturedProcessLogs,
  type DebugTestResult,
  type LogFn,
  type ProcessId,
} from '@/lib/debug';
import { NotificationPipelinePanel } from '@/components/debug/notification-pipeline-panel';

type GridButton = {
  id: string;
  label: string;
  description: string;
  tone: 'pending' | 'attention' | 'transfer' | 'muted';
  run: (log: LogFn) => Promise<DebugTestResult>;
};

function useDebugButtons(): GridButton[] {
  return [
    {
      id: 'simulate-capture',
      label: 'Simulate Capture',
      description: 'Write a test notification to MMKV',
      tone: 'pending',
      run: injectTestNotificationCapture,
    },
    {
      id: 'notif-test',
      label: 'Notification Test',
      description: 'Run 4 classification test cases',
      tone: 'attention',
      run: runNotificationTests,
    },
    {
      id: 'queue-inspect',
      label: 'Queue Inspector',
      description: 'View processing queue state',
      tone: 'transfer',
      run: runQueueInspection,
    },
    {
      id: 'queue-prune',
      label: 'Prune Queue',
      description: 'Clear all queue items',
      tone: 'muted',
      run: pruneQueue,
    },
  ];
}

export default function DebugPage() {
  const buttons = useDebugButtons();
  const tokens = useThemeTokens();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    id: string;
    result: DebugTestResult;
  } | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [selectedProcessLog, setSelectedProcessLog] =
    useState<ProcessId>('debug-log');
  const scrollRef = useRef<ScrollView>(null);
  const { clearCapturedLogs, getFormattedLogs } =
    useCapturedProcessLogs();

  const uiLocked = runningId !== null;
  const buttonColor = {
    pending: tokens.states.pending,
    attention: tokens.states.attention,
    transfer: tokens.transfer,
    muted: tokens.muted,
  } as const;

  const log: LogFn = useCallback((message: string) => {
    setLogLines((prev) => [...prev, message]);
    console.log('[Debug]', message);
  }, []);

  const clearLog = useCallback(() => {
    setLogLines([]);
    setLastResult(null);
    clearCapturedLogs();
  }, [clearCapturedLogs]);

  const selectedProcessLogs = getFormattedLogs(
    selectedProcessLog,
    160,
  );

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
    <SafeAreaView
      className="flex-1 bg-canvas"
      style={{ flex: 1 }}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="pb-20"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        <BrandHeader title="Debug tools" />
        <View className="px-5 pt-4 pb-2">
          <Text className="text-xs leading-4 text-muted">
            Tools for testing notification capture and the AI
            processing queue.
          </Text>
        </View>

        <NotificationPipelinePanel />

        <View className="flex-row flex-wrap px-3 mt-4">
          {buttons.map((btn) => {
            const isRunning = runningId === btn.id;
            const isDisabled = uiLocked && !isRunning;
            const color = buttonColor[btn.tone];

            return (
              <View
                key={btn.id}
                className="w-1/2 p-1"
              >
                <TouchableOpacity
                  onPress={() => handlePress(btn)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                  className="min-h-28 justify-between rounded-2xl border bg-card p-3"
                  style={{
                    backgroundColor: isDisabled
                      ? tokens.surface2
                      : color + '18',
                    borderWidth: 1,
                    borderColor: isRunning
                      ? color
                      : isDisabled
                        ? tokens.borderSubtle
                        : color + '40',
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {isRunning ? (
                    <ActivityIndicator
                      size="small"
                      color={color}
                    />
                  ) : (
                    <View
                      className="w-2 h-2 rounded-full mb-1"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <Text
                    className="text-xs font-semibold mt-1"
                    style={{
                      color: isDisabled
                        ? tokens.muted
                        : tokens.foreground,
                    }}
                    numberOfLines={1}
                  >
                    {btn.label}
                  </Text>
                  <Text
                    className="text-[10px] mt-0.5"
                    style={{
                      color: isDisabled
                        ? tokens.muted
                        : tokens.muted,
                    }}
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
            className={
              lastResult.result.success
                ? 'mx-5 mt-3 rounded-2xl border border-primary/30 bg-primary-muted px-4 py-3'
                : 'mx-5 mt-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3'
            }
          >
            <Text
              className="text-xs font-bold"
              style={{
                color: lastResult.result.success
                  ? tokens.success
                  : tokens.danger,
              }}
            >
              {lastResult.result.success ? 'PASS' : 'FAIL'} —{' '}
              {lastResult.result.summary}
            </Text>
          </View>
        )}

        <View className="mx-5 mt-5">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xs font-bold text-foreground">
              Live logs
            </Text>
            <TouchableOpacity onPress={clearLog}>
              <Text className="text-xs font-semibold text-primary">
                Clear All Logs
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {(Object.keys(PROCESS_LABELS) as ProcessId[]).map(
              (id) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setSelectedProcessLog(id)}
                  className="rounded-xl border px-3 py-2"
                  style={{
                    borderColor:
                      selectedProcessLog === id
                        ? tokens.primary
                        : tokens.border,
                    backgroundColor:
                      selectedProcessLog === id
                        ? tokens.primaryMuted
                        : tokens.card,
                  }}
                >
                  <Text
                    className="text-[10px]"
                    style={{
                      color:
                        selectedProcessLog === id
                        ? tokens.primary
                        : tokens.muted,
                    }}
                  >
                    {PROCESS_LABELS[id]}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>
        {(selectedProcessLogs.length > 0 || logLines.length > 0) && (
          <View className="mx-5 mt-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs font-bold text-muted">
                {PROCESS_LABELS[selectedProcessLog]} console
              </Text>
            </View>
            <View className="rounded-2xl border border-border bg-surface-2 p-3">
              {(selectedProcessLogs.length > 0
                ? selectedProcessLogs
                : logLines
              ).map((line, i) => (
                <Text
                  key={i}
                  className="text-[11px] leading-4 font-mono"
                  style={{
                    color: line.startsWith('===')
                      ? tokens.transfer
                      : line.startsWith('---')
                        ? tokens.states.pending
                        : line.includes('FAIL') ||
                            line.includes('failed') ||
                            line.includes('ERROR')
                          ? tokens.danger
                          : line.includes('PASS') ||
                              line.includes('success')
                            ? tokens.success
                            : tokens.foreground,
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
    </SafeAreaView>
  );
}
