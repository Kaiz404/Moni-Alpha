import BackgroundService from 'react-native-background-actions';
import type { LogFn, DebugTestResult } from './types';

const HEARTBEAT_OPTIONS = {
  taskName: 'MoniHeartbeatTest',
  taskTitle: 'Background Service Test',
  taskDesc: 'Moni is verifying background execution...',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' as const },
  color: '#10b981',
  linkingURI: 'moni://',
  parameters: { durationMs: 60_000, intervalMs: 3_000 },
};

let running = false;

async function heartbeatTask(taskData?: { durationMs?: number; intervalMs?: number }) {
  const duration = taskData?.durationMs ?? 60_000;
  const interval = taskData?.intervalMs ?? 3_000;
  const start = Date.now();
  let tick = 0;

  console.log('[HeartbeatTest] Service started — will run for', duration / 1000, 'seconds');

  while (BackgroundService.isRunning() && Date.now() - start < duration) {
    tick++;
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`[HeartbeatTest] tick ${tick} — ${elapsed}s elapsed — service alive`);
    await new Promise<void>((r) => setTimeout(r, interval));
  }

  const totalElapsed = Math.round((Date.now() - start) / 1000);
  console.log(`[HeartbeatTest] Finished — ${totalElapsed}s, ${tick} ticks`);
}

export function isHeartbeatRunning(): boolean {
  return running;
}

export async function startHeartbeat(log: LogFn): Promise<DebugTestResult> {
  if (running) {
    log('Heartbeat already running');
    return { success: false, summary: 'Already running — stop first' };
  }

  if (BackgroundService.isRunning()) {
    try { await BackgroundService.stop(); } catch { /* stale service cleanup */ }
  }

  log('Starting heartbeat service (60s, 3s ticks)...');
  log('Watch adb logcat for [HeartbeatTest] ticks after you exit the app.');
  running = true;

  try {
    await BackgroundService.start(heartbeatTask, HEARTBEAT_OPTIONS);
    log('Foreground service is UP — ticking in background');
    return { success: true, summary: 'Heartbeat running — exit app to verify' };
  } catch (e: any) {
    running = false;
    const msg = e?.message ?? String(e);
    log(`Failed to start: ${msg}`);
    return { success: false, summary: `Start failed: ${msg}` };
  }
}

export async function stopHeartbeat(log: LogFn): Promise<void> {
  log('Stopping heartbeat service...');
  try { await BackgroundService.stop(); } catch { /* ignore */ }
  running = false;
  log('Heartbeat stopped');
}
