import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet } from 'react-native';
import { useLlamaModel, CHAT_MODEL_ID } from '@/hooks/use-llama-model';
import { getModelPath, llama as llamaRuntime } from '@react-native-ai/llama';
import { runNotificationOrchestration } from '@/lib/ai/notification-orchestrator';
import type { RawNotification } from '@/lib/ai/notification-processor';
import { getWallets, createWallet } from '@/lib/supabase/wallets';
import { syncSystem } from '@/lib/powersync/Powersync';
import { randomUUID } from 'expo-crypto';

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
});

