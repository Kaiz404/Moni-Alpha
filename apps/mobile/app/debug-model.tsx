import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLlamaModel, CHAT_MODEL_ID } from '@/hooks/use-llama-model';
import { getModelPath, llama as llamaRuntime } from '@react-native-ai/llama';
import { runNotificationOrchestration } from '@/lib/ai/notification-orchestrator';
import type { RawNotification } from '@/lib/ai/notification-processor';
import { getWallets, createWallet } from '@/lib/supabase/wallets';
import { syncSystem } from '@/lib/powersync/Powersync';
import { randomUUID } from 'expo-crypto';
import BackgroundService from 'react-native-background-actions';
import {
  enqueue,
  getAll,
  getPendingCount,
  pruneCompleted,
  type ProcessingQueueItem,
} from '@/lib/ai/processing-queue';
import {
  startBackgroundProcessor,
  stopBackgroundProcessor,
  isBackgroundProcessorRunning,
} from '@/lib/ai/background-processor';
import { areModelsDownloaded } from '@/lib/ai/model-manager';

// ─── Heartbeat task (pure service-alive test, no LLM) ────────────────────────

const HEARTBEAT_BG_OPTIONS = {
  taskName: 'MoniHeartbeatTest',
  taskTitle: 'Background Service Test',
  taskDesc: 'Moni is verifying background execution...',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' },
  color: '#10b981',
  linkingURI: 'moni://',
  parameters: { durationMs: 60_000, intervalMs: 3_000 },
};

async function heartbeatTask(taskData?: { durationMs?: number; intervalMs?: number }) {
  const duration = taskData?.durationMs ?? 60_000;
  const interval = taskData?.intervalMs ?? 3_000;
  const start = Date.now();
  let tick = 0;

  console.log('[HeartbeatTest] Service started — will run for', duration / 1000, 'seconds. Exit the app now to test.');

  while (BackgroundService.isRunning() && Date.now() - start < duration) {
    tick++;
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`[HeartbeatTest] tick ${tick} — ${elapsed}s elapsed — service alive`);
    await new Promise<void>((r) => setTimeout(r, interval));
  }

  const totalElapsed = Math.round((Date.now() - start) / 1000);
  console.log(`[HeartbeatTest] Finished — ${totalElapsed}s, ${tick} ticks`);
}

// ─────────────────────────────────────────────────────────────────────────────

type TestResult = {
  id: string;
  notification: string;
  passed: boolean;
  details?: string;
  traces?: string[];
};

function parseTraceStage(line: string): 'orchestrator' | 'classifier' | 'wallet-resolver' | 'creator' | 'other' {
  if (line.startsWith('orchestrator.')) return 'orchestrator';
  if (line.startsWith('classifier.')) return 'classifier';
  if (line.startsWith('wallet-resolver.')) return 'wallet-resolver';
  if (line.startsWith('creator.')) return 'creator';
  return 'other';
}

function TraceTimeline({ traces }: { traces: string[] }) {
  const groups: Record<string, string[]> = {
    orchestrator: [],
    classifier: [],
    'wallet-resolver': [],
    creator: [],
    other: [],
  };

  for (const line of traces) {
    groups[parseTraceStage(line)].push(line);
  }

  const orderedStages: Array<{ key: keyof typeof groups; title: string }> = [
    { key: 'orchestrator', title: 'Orchestrator' },
    { key: 'classifier', title: 'Classifier' },
    { key: 'wallet-resolver', title: 'Wallet Resolver' },
    { key: 'creator', title: 'Creator' },
    { key: 'other', title: 'Other' },
  ];

  return (
    <View style={styles.traceCard}>
      <Text style={styles.traceTitle}>Trace Timeline</Text>
      {orderedStages.map(({ key, title }) => {
        const lines = groups[key];
        if (!lines.length) return null;

        return (
          <View key={key} style={styles.traceGroup}>
            <Text style={styles.traceGroupTitle}>{title}</Text>
            {lines.map((line, idx) => (
              <Text key={`${key}-${idx}`} style={styles.traceLine}>
                • {line}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default function DebugModelRunner() {
  const [modelPath, setModelPath] = useState<string>('/sdcard/models/qwen3.5-2b');
  const [log, setLog] = useState<string>('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);

  // ── Background processor state ───────────────────────────────────────────
  const [bgRunning, setBgRunning] = useState(false);
  const [bgServiceRunning, setBgServiceRunning] = useState(false);
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [queueItems, setQueueItems] = useState<ProcessingQueueItem[]>([]);
  const [modelStatus, setModelStatus] = useState<{ main: boolean; mmProj: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshQueueState = useCallback(() => {
    setQueueItems(getAll());
    setBgRunning(isBackgroundProcessorRunning());
    setBgServiceRunning(BackgroundService.isRunning());
  }, []);

  // Poll queue + service status every second while screen is mounted
  useEffect(() => {
    refreshQueueState();
    areModelsDownloaded().then(setModelStatus).catch(() => {});
    pollRef.current = setInterval(refreshQueueState, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshQueueState]);

  const bgLog = useCallback((s: string) => {
    setLog((l) => (l ? l + '\n[BG] ' + s : '[BG] ' + s));
    console.log('[DebugRunner][BG]', s);
  }, []);

  /**
   * Pure heartbeat test — starts a foreground service that ticks every 3s for
   * 60s with no LLM involved. Exit the app during the test; if you see ticks
   * continuing in adb logcat the service is truly alive in the background.
   *
   * BackgroundService.start() resolves immediately once the Android service is
   * up — it does NOT wait for the task function to finish. So we must NOT call
   * stop() here; we let the task run to completion on its own and rely on the
   * bgServiceRunning poll to detect when it's done.
   */
  const testServiceHeartbeat = useCallback(async () => {
    if (heartbeatRunning) {
      bgLog('Heartbeat already running — use Stop to cancel it');
      return;
    }
    // Kill any stale service before starting fresh
    if (BackgroundService.isRunning()) {
      try { await BackgroundService.stop(); } catch { /* ignore */ }
    }
    bgLog('Starting heartbeat service (60s, 3s ticks)...');
    bgLog('Watch adb logcat for [HeartbeatTest] ticks after you exit the app.');
    setHeartbeatRunning(true);
    try {
      // Resolves as soon as the Android foreground service is up, NOT when done
      await BackgroundService.start(heartbeatTask, HEARTBEAT_BG_OPTIONS);
      bgLog('Service is UP — ticking in background. Green dot = alive.');
    } catch (e: any) {
      bgLog('Failed to start service: ' + (e?.message ?? String(e)));
      setHeartbeatRunning(false);
    }
    // Do NOT call stop() here — that would kill the task immediately.
    // The bgServiceRunning effect below resets heartbeatRunning when done.
  }, [bgLog, heartbeatRunning]);

  // Detect when the heartbeat service finishes on its own (duration elapsed or errored)
  const prevBgServiceRunningRef = useRef(false);
  useEffect(() => {
    if (prevBgServiceRunningRef.current && !bgServiceRunning && heartbeatRunning) {
      setHeartbeatRunning(false);
      bgLog('Heartbeat service completed / stopped');
    }
    prevBgServiceRunningRef.current = bgServiceRunning;
  }, [bgServiceRunning, heartbeatRunning, bgLog]);

  const stopHeartbeat = useCallback(async () => {
    bgLog('Stopping heartbeat service...');
    try { await BackgroundService.stop(); } catch { /* ignore */ }
    setHeartbeatRunning(false);
    bgLog('Heartbeat stopped');
  }, [bgLog]);

  /** Enqueue a real transaction text so the LLM runs inside the foreground service */
  const testLLMInBackground = useCallback(async () => {
    bgLog('Enqueueing LLM test item: "Coffee at Starbucks 12.50 USD"');
    enqueue({
      id: randomUUID(),
      type: 'text',
      text: 'Coffee at Starbucks 12.50 USD',
      createdAt: new Date().toISOString(),
      status: 'pending',
    });
    bgLog('Enqueueing second item: "Transfer 500 MYR to savings"');
    enqueue({
      id: randomUUID(),
      type: 'text',
      text: 'Transfer 500 MYR to savings',
      createdAt: new Date().toISOString(),
      status: 'pending',
    });
    refreshQueueState();
    bgLog(`Queue now has ${getPendingCount()} pending item(s). Starting processor...`);
    bgLog('You can now EXIT the app — the foreground service will keep running.');
    try {
      await startBackgroundProcessor();
      bgLog('Processor finished (or fell back to foreground)');
    } catch (e: any) {
      bgLog('startBackgroundProcessor() threw: ' + (e?.message ?? String(e)));
    }
    refreshQueueState();
  }, [bgLog, refreshQueueState]);

  const stopBgProcessor = useCallback(async () => {
    bgLog('Stopping background processor...');
    await stopBackgroundProcessor();
    bgLog('Stopped');
    refreshQueueState();
  }, [bgLog, refreshQueueState]);

  const clearQueue = useCallback(() => {
    pruneCompleted();
    refreshQueueState();
    bgLog('Queue pruned (completed/errored items removed)');
  }, [bgLog, refreshQueueState]);

  // ────────────────────────────────────────────────────────────────────────

  const append = (s: string) => {
    // update on-screen log
    setLog((l) => (l ? l + '\n' + s : s));
    // mirror to console for easy copying
    try {
      console.log('[DebugRunner]', s);
    } catch (_) {}
  };
  const appendObj = (label: string, obj: any) => {
    try {
      const txt = `${label}: ${JSON.stringify(obj, null, 2)}`;
      setLog((l) => (l ? l + '\n' + txt : txt));
      console.log('[DebugRunner]', label, obj);
    } catch (e) {
      const txt = `${label}: [unserializable object]`;
      setLog((l) => (l ? l + '\n' + txt : txt));
      try {
        console.log('[DebugRunner]', label, obj);
      } catch (_) {}
    }
  };

  const ensureSeedWallet = async () => {
    const wallets = await getWallets();
    if (wallets.length > 0) {
      return wallets[0].id;
    }

    const wallet = await createWallet({
      name: 'Heatmap Seed Wallet',
      type: 'cash',
      currency: 'USD',
      initialBalance: 1000,
      color: '#3b82f6',
      icon: 'wallet',
    });

    return wallet.id;
  };

  const seedHeatmapData = async () => {
    try {
      append('Seeding heatmap test transactions...');
      const { db, supabaseConnector } = syncSystem;
      const userId = await supabaseConnector.getUserId();
      if (!userId) {
        append('Seed failed: no authenticated user');
        return;
      }

      const walletId = await ensureSeedWallet();
      const now = Date.now();
      const metadata = JSON.stringify({ seedSource: 'heatmap-demo' });

      const clusters = [
        { lat: 3.139, lng: 101.6869, name: 'Kuala Lumpur', count: 24 },
        { lat: 3.0738, lng: 101.5183, name: 'Shah Alam', count: 12 },
        { lat: 3.1073, lng: 101.6067, name: 'Petaling Jaya', count: 16 },
        { lat: 1.4927, lng: 103.7414, name: 'Johor Bahru', count: 8 },
      ];

      let inserted = 0;

      for (const cluster of clusters) {
        for (let index = 0; index < cluster.count; index += 1) {
          const latJitter = (Math.random() - 0.5) * 0.01;
          const lngJitter = (Math.random() - 0.5) * 0.01;
          const txDate = new Date(now - (inserted + 1) * 3600_000).toISOString();

          await db
            .insertInto('transactions')
            .values({
              id: randomUUID(),
              user_id: userId,
              wallet_id: walletId,
              amount: (8 + Math.round(Math.random() * 120)).toString(),
              type: 'expense',
              category_id: null,
              transfer_to_wallet_id: null,
              linked_transaction_id: null,
              description: `Heatmap test transaction ${inserted + 1}`,
              merchant: `${cluster.name} Merchant ${index + 1}`,
              notes: 'Seeded for heatmap testing',
              transaction_date: txDate,
              location_latitude: (cluster.lat + latJitter).toFixed(8),
              location_longitude: (cluster.lng + lngJitter).toFixed(8),
              location_name: cluster.name,
              receipt_image_url: null,
              metadata,
            })
            .execute();

          inserted += 1;
        }
      }

      append(`Seed complete: inserted ${inserted} location transactions`);
      append('Open the Heatmap tab to view clustered hot zones');
    } catch (e: any) {
      append('Seed failed: ' + (e?.message ?? String(e)));
      appendObj('Seed error', e);
    }
  };

  const clearHeatmapSeedData = async () => {
    try {
      append('Removing seeded heatmap transactions...');
      const { db, supabaseConnector } = syncSystem;
      const userId = await supabaseConnector.getUserId();
      if (!userId) {
        append('Cleanup failed: no authenticated user');
        return;
      }

      await db
        .deleteFrom('transactions')
        .where('user_id', '=', userId)
        .where('metadata', 'like', '%"seedSource":"heatmap-demo"%')
        .execute();

      append('Seed cleanup complete');
    } catch (e: any) {
      append('Cleanup failed: ' + (e?.message ?? String(e)));
      appendObj('Cleanup error', e);
    }
  };

  function sampleNotifications() {
    return [
      {
        id: '1',
        app: 'Touch n Go',
        text: 'You paid 15 USD to Amazon for order #1234.',
        expectedCreated: true,
      },
      {
        id: '2',
        app: 'My Wallet',
        text: 'Your account has been credited with 250 NGN from John.',
        expectedCreated: true,
      },
      {
        id: '3',
        app: 'ShopPromo',
        text: "Don't miss our sale this weekend!",
        expectedCreated: false,
      },
      {
        id: '4',
        app: 'AuthService',
        text: 'Your OTP is 123456. Do not share.',
        expectedCreated: false,
      },
    ];
  }

  async function runModelTestsWithRuntime(modelPathToUse?: string) {
    const modelPathFinal = modelPathToUse ?? modelPath;
    append(`Starting model connection and test run against: ${modelPathFinal}`);
    setResults([]);
    try {
      // Try to probe the filesystem for diagnostics (optional)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RNFS = require('react-native-fs');
        try {
          const exists = await RNFS.exists(modelPathFinal);
          append(`RNFS: exists(${modelPathFinal}) => ${exists}`);
          if (exists) {
            try {
              const stat = await RNFS.stat(modelPathFinal);
              appendObj('RNFS: stat', stat);
            } catch (e) {
              append('RNFS: stat failed: ' + ((e as any)?.message ?? String(e)));
            }
            try {
              const files = await RNFS.readDir(modelPathFinal);
              append(`RNFS: readDir(${modelPathFinal}) -> ${files.length} entries`);
              appendObj('RNFS: readDir sample', files.slice(0, 10));
            } catch (e) {
              append('RNFS: readDir failed: ' + ((e as any)?.message ?? String(e)));
            }
          }
        } catch (e) {
          append('RNFS probe failed: ' + ((e as any)?.message ?? String(e)));
        }
      } catch (e) {
        append('RNFS not available in this runtime — skipping FS probe');
      }

      append('Using runtime llama API');
      let model: any;
      try {
        model = llamaRuntime.languageModel(modelPathFinal, {} as any);
        append('languageModel() returned');
      } catch (errLM) {
        append('languageModel() threw error: ' + ((errLM as any)?.message ?? String(errLM)));
        appendObj('languageModel error object', errLM);
        throw errLM;
      }

      append('Preparing model instance (this may take a moment)...');
      try {
        await model.prepare();
        append('Model prepared');
        setConnected(true);
      } catch (errPrep) {
        append('model.prepare() failed: ' + ((errPrep as any)?.message ?? String(errPrep)));
        appendObj('model.prepare() error object', errPrep);
        throw errPrep;
      }

      const samples = sampleNotifications();
      for (const s of samples) {
        append(`Running test: ${s.id}`);
        let details = '';
        let created = false;

        try {
          const notification: RawNotification = {
            id: s.id,
            app: s.app,
            title: s.app,
            text: s.text,
            time: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
          };

          const traceEvents: string[] = [];
          const createdPayloads: any[] = [];

          const orchestration = await runNotificationOrchestration(model as any, notification, {
            trace: (event) => {
              const line = `${event.stage}.${event.event} ${event.details ? JSON.stringify(event.details) : ''}`;
              traceEvents.push(line);
              append(`[Trace ${s.id}] ${line}`);
            },
            adapters: {
              getWallets: async () => [
                { id: 'w1', name: 'Touch n Go' },
                { id: 'w2', name: 'My Wallet' },
              ],
              createProposedTransaction: async (tx) => {
                createdPayloads.push(tx);
                return { status: 'ok' };
              },
            },
          });

          created = orchestration.created;
          details = [
            `orchestration: ${JSON.stringify(orchestration)}`,
            `createdPayloadCount: ${createdPayloads.length}`,
            ...traceEvents,
          ].join('\n');
        } catch (err: any) {
          details = `ERROR:${err?.message ?? String(err)}`;
          append(`orchestration failed for test ${s.id}: ${details}`);
        }

        const passed = created === s.expectedCreated;
        const res: TestResult = {
          id: s.id,
          notification: s.text,
          passed,
          details,
          traces: details
            .split('\n')
            .filter((line) =>
              /^(orchestrator|classifier|wallet-resolver|creator)\./.test(line),
            ),
        };
        setResults((r) => [...r, res]);
        append(`Test ${s.id} ${passed ? 'PASSED' : 'FAILED'}`);
      }

      if (typeof model.unload === 'function') await model.unload();
      append('All tests completed');
    } catch (err: any) {
      append('Error connecting/running model (top-level): ' + (err && err.message ? err.message : String(err)));
      appendObj('Top-level error object', err);
      setConnected(false);
    }
  }

  // Auto-download/prepare via shared hook and run tests when ready
  const { status, downloadAndPrepare } = useLlamaModel();

  useEffect(() => {
    (async () => {
      try {
        append('Triggering shared downloadAndPrepare()...');
        await downloadAndPrepare();
        append('downloadAndPrepare() returned — waiting for status ready');
      } catch (e: any) {
        append('downloadAndPrepare error: ' + (e?.message ?? String(e)));
      }
    })();
  }, [downloadAndPrepare]);

  useEffect(() => {
    if (status === 'ready') {
      try {
        const mp = getModelPath(CHAT_MODEL_ID as any);
        append('Shared hook reports ready; model path: ' + String(mp));
        runModelTestsWithRuntime(String(mp));
      } catch (e: any) {
        append('Failed to run runtime tests after ready: ' + (e?.message ?? String(e)));
      }
    }
  }, [status]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dev: Model Runtime Tester</Text>
      <Text style={styles.label}>Model path on device (ensure model files are available at this path):</Text>
      <TextInput value={modelPath} onChangeText={setModelPath} style={styles.input} placeholder="/sdcard/models/qwen3.5-2b" placeholderTextColor="#888" />
      <View style={{ marginTop: 12 }}>
        <Button title="Connect & Run Tests" onPress={() => runModelTestsWithRuntime()} />
      </View>

      <View style={{ marginTop: 12 }}>
        <Button title="Seed Heatmap Test Data" onPress={seedHeatmapData} />
      </View>

      <View style={{ marginTop: 12 }}>
        <Button title="Clear Heatmap Seed Data" onPress={clearHeatmapSeedData} color="#c0392b" />
      </View>

      {/* ── Background Processor Tests ─────────────────────────── */}
      <View style={styles.bgSection}>
        <Text style={styles.bgSectionTitle}>Background Processor</Text>

        {/* Service status */}
        <View style={styles.bgStatusRow}>
          <View style={[styles.bgDot, { backgroundColor: bgRunning || bgServiceRunning || heartbeatRunning ? '#22c55e' : '#6b7280' }]} />
          <Text style={styles.bgStatusText}>
            {heartbeatRunning
              ? 'Heartbeat service RUNNING'
              : bgRunning || bgServiceRunning
                ? 'Processor service RUNNING'
                : 'Service idle'}
          </Text>
        </View>

        {/* Model download status */}
        <View style={styles.bgStatusRow}>
          <Text style={styles.bgMeta}>
            Model: main={modelStatus == null ? '?' : modelStatus.main ? '✓' : '✗ not downloaded'}
            {'  '}mmproj={modelStatus == null ? '?' : modelStatus.mmProj ? '✓' : '✗'}
          </Text>
        </View>
        {modelStatus != null && !modelStatus.main && (
          <Text style={[styles.bgMeta, { color: '#f87171', marginTop: 2 }]}>
            ⚠ LLM test will skip — download the model from the model tab first.
          </Text>
        )}

        {/* Queue summary */}
        <View style={styles.bgStatusRow}>
          <Text style={styles.bgMeta}>
            Queue: {queueItems.filter(i => i.status === 'pending').length} pending
            {' · '}{queueItems.filter(i => i.status === 'processing').length} processing
            {' · '}{queueItems.filter(i => i.status === 'done').length} done
            {' · '}{queueItems.filter(i => i.status === 'error').length} error
          </Text>
        </View>

        {queueItems.length > 0 && (
          <ScrollView horizontal style={{ marginTop: 6 }}>
            <View>
              {queueItems.slice(-8).map((item) => (
                <Text key={item.id} style={styles.queueItem}>
                  [{item.status.toUpperCase().padEnd(10)}] {item.type} — {
                    item.type === 'text' ? item.text.slice(0, 45)
                    : item.type === 'notification' ? item.notification.text.slice(0, 45)
                    : item.imageUri.slice(-30)
                  }
                </Text>
              ))}
            </View>
          </ScrollView>
        )}

        <View style={{ marginTop: 10, gap: 8 }}>
          {/* Heartbeat — no LLM needed */}
          <TouchableOpacity
            style={[styles.bgButton, heartbeatRunning && styles.bgButtonActive]}
            onPress={heartbeatRunning ? stopHeartbeat : testServiceHeartbeat}
          >
            <Text style={styles.bgButtonText}>
              {heartbeatRunning ? '⏹ Stop Heartbeat Service' : '❤️ Test Service Alive (no LLM)'}
            </Text>
            <Text style={styles.bgButtonSub}>
              Starts a foreground service that ticks every 3s for 60s.
              Exit the app — watch adb logcat for [HeartbeatTest] ticks to confirm it keeps running.
            </Text>
          </TouchableOpacity>

          {/* LLM in background */}
          <TouchableOpacity style={[styles.bgButton, styles.bgButtonPrimary]} onPress={testLLMInBackground}>
            <Text style={[styles.bgButtonText, { color: '#fff' }]}>Test LLM in Background</Text>
            <Text style={[styles.bgButtonSub, { color: '#c7d2fe' }]}>
              Enqueues 2 transaction items → foreground service → loads model → runs inference.
              {!modelStatus?.main ? ' (model not downloaded — will skip immediately)' : ' Exit the app to verify.'}
            </Text>
          </TouchableOpacity>

          {/* Stop processor */}
          <TouchableOpacity style={[styles.bgButton, styles.bgButtonStop]} onPress={stopBgProcessor}>
            <Text style={[styles.bgButtonText, { color: '#fca5a5' }]}>Stop LLM Processor</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bgButton, { borderColor: '#374151' }]} onPress={clearQueue}>
            <Text style={[styles.bgButtonText, { color: '#9ca3af' }]}>Prune Completed Queue Items</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={styles.label}>Connection status: <Text style={{ fontWeight: '600' }}>{connected === null ? 'idle' : connected ? 'connected' : 'not connected'}</Text></Text>
      </View>

      <Text style={[styles.label, { marginTop: 12 }]}>Test results</Text>
      {results.map((r, idx) => (
        <View key={`${r.id}-${idx}`} style={{ marginTop: 8 }}>
          <Text style={styles.testTitle}>{r.id} — {r.passed ? 'PASS' : 'FAIL'}</Text>
          <Text style={styles.testNotif}>{r.notification}</Text>
          <Text style={styles.testDetails}>{r.details}</Text>
          {!!r.traces?.length && <TraceTimeline traces={r.traces} />}
        </View>
      ))}

      <Text style={[styles.label, { marginTop: 12 }]}>Log</Text>
      <Text style={styles.log}>{log}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#0b0b0b', minHeight: '100%' },
  title: { fontSize: 18, fontWeight: '600', color: '#fff' },
  label: { marginTop: 8, color: '#fff' },
  input: { borderColor: '#444', borderWidth: 1, padding: 8, marginTop: 8, color: '#fff', backgroundColor: '#111' },
  log: { marginTop: 8, fontFamily: 'monospace', color: '#fff' },
  testTitle: { color: '#fff', fontWeight: '700' },
  testNotif: { color: '#ddd' },
  testDetails: { color: '#9fe3c6', fontFamily: 'monospace', marginTop: 4 },
  traceCard: {
    marginTop: 8,
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#121212',
  },
  traceTitle: { color: '#fff', fontWeight: '700', marginBottom: 6 },
  traceGroup: { marginTop: 6 },
  traceGroupTitle: { color: '#9fb8ff', fontWeight: '600', marginBottom: 2 },
  traceLine: { color: '#d2d8e8', fontSize: 12, lineHeight: 17, fontFamily: 'monospace' },

  // Background processor section
  bgSection: {
    marginTop: 20,
    borderColor: '#1e3a5f',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#0d1b2a',
  },
  bgSectionTitle: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  bgStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bgDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  bgStatusText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 13,
  },
  bgMeta: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  queueItem: {
    color: '#7dd3fc',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  bgButton: {
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#111827',
  },
  bgButtonPrimary: {
    borderColor: '#4f46e5',
    backgroundColor: '#1e1b4b',
  },
  bgButtonStop: {
    borderColor: '#7f1d1d',
    backgroundColor: '#1c0505',
  },
  bgButtonActive: {
    borderColor: '#16a34a',
    backgroundColor: '#052e16',
  },
  bgButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  bgButtonSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 3,
  },
});

