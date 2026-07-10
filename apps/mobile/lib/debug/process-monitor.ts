import { useEffect, useMemo, useState } from 'react';
import BackgroundService from 'react-native-background-actions';
import { isBackgroundProcessorRunning } from '@/lib/ai/background-processor';
import { isHeartbeatRunning } from './heartbeat-test';
import { getNotificationProcessSnapshot } from './notification-process-reader';

export type ProcessId =
  | 'ui-action'
  | 'vision-smoke'
  | 'heartbeat'
  | 'llm-processor'
  | 'notifications'
  | 'bg-service'
  | 'debug-log';

export type ProcessState = {
  id: ProcessId;
  label: string;
  state: 'running' | 'idle';
  runningForMs: number;
  startedAt: number | null;
  /** Extra one-line stats (e.g. notification queue counts). */
  detail?: string;
};

export type CapturedLog = {
  ts: number;
  process: ProcessId;
  line: string;
};

export const PROCESS_LABELS: Record<ProcessId, string> = {
  'ui-action': 'UI Action',
  'vision-smoke': 'Vision Smoke',
  heartbeat: 'Heartbeat',
  'llm-processor': 'AI Processor',
  notifications: 'Notifications',
  'bg-service': 'BG Service',
  'debug-log': 'Debug Log',
};

export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function resolveProcessFromLine(line: string): ProcessId {
  if (line.includes('[HeartbeatTest]')) return 'heartbeat';
  if (line.includes('[NotifProc]')) return 'notifications';
  if (line.includes('[BGProc]')) {
    // Same BG task; split logs when the queue item is a notification.
    if (line.includes(': notification')) return 'notifications';
    return 'llm-processor';
  }
  if (line.includes('[Debug]')) return 'debug-log';
  return 'debug-log';
}

function toTimestampedLine(ts: number, line: string): string {
  const t = new Date(ts);
  const stamp = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(
    2,
    '0',
  )}:${String(t.getSeconds()).padStart(2, '0')}`;
  return `[${stamp}] ${line}`;
}

export function useDebugProcessMonitor(params: {
  uiActionRunning: boolean;
  visionRunning: boolean;
}): ProcessState[] {
  const { uiActionRunning, visionRunning } = params;
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [llmProcessorRunning, setLlmProcessorRunning] = useState(false);
  const [bgServiceRunning, setBgServiceRunning] = useState(false);
  const [notificationRunning, setNotificationRunning] = useState(false);
  const [notificationDetail, setNotificationDetail] = useState('');
  const [tickMs, setTickMs] = useState(() => Date.now());
  const [processStartedAt, setProcessStartedAt] = useState<Partial<Record<ProcessId, number>>>({});

  useEffect(() => {
    const tick = () => {
      setHeartbeatRunning(isHeartbeatRunning());
      setLlmProcessorRunning(isBackgroundProcessorRunning());
      setBgServiceRunning(BackgroundService.isRunning());
      const notif = getNotificationProcessSnapshot();
      setNotificationRunning(notif.running);
      setNotificationDetail(
        `notif Q: ${notif.pending}p ${notif.processing}a ${notif.done}d ${notif.error}e` +
          (notif.nextPendingIsNotification ? ' · next=notif' : ''),
      );
      setTickMs(Date.now());
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const runningMap: Record<ProcessId, boolean> = {
      'ui-action': uiActionRunning,
      'vision-smoke': visionRunning,
      heartbeat: heartbeatRunning,
      'llm-processor': llmProcessorRunning,
      notifications: notificationRunning,
      'bg-service': bgServiceRunning,
      'debug-log': true,
    };

    setProcessStartedAt((prev) => {
      const next: Partial<Record<ProcessId, number>> = { ...prev };
      (Object.keys(runningMap) as ProcessId[]).forEach((id) => {
        if (id === 'debug-log') return;
        if (runningMap[id]) {
          if (!next[id]) next[id] = now;
        } else {
          next[id] = undefined;
        }
      });
      return next;
    });
  }, [uiActionRunning, visionRunning, heartbeatRunning, llmProcessorRunning, notificationRunning, bgServiceRunning]);

  return useMemo(() => {
    const defs: Array<{ id: ProcessId; label: string; running: boolean; detail?: string }> = [
      { id: 'ui-action', label: PROCESS_LABELS['ui-action'], running: uiActionRunning },
      { id: 'vision-smoke', label: PROCESS_LABELS['vision-smoke'], running: visionRunning },
      { id: 'heartbeat', label: PROCESS_LABELS.heartbeat, running: heartbeatRunning },
      { id: 'llm-processor', label: PROCESS_LABELS['llm-processor'], running: llmProcessorRunning },
      {
        id: 'notifications',
        label: PROCESS_LABELS.notifications,
        running: notificationRunning,
        detail: notificationDetail,
      },
      { id: 'bg-service', label: PROCESS_LABELS['bg-service'], running: bgServiceRunning },
    ];

    return defs.map((proc) => {
      const startedAt = processStartedAt[proc.id] ?? null;
      return {
        id: proc.id,
        label: proc.label,
        state: proc.running ? 'running' : 'idle',
        startedAt,
        runningForMs: proc.running && startedAt ? tickMs - startedAt : 0,
        detail: proc.detail,
      };
    });
  }, [
    uiActionRunning,
    visionRunning,
    heartbeatRunning,
    llmProcessorRunning,
    notificationRunning,
    notificationDetail,
    bgServiceRunning,
    processStartedAt,
    tickMs,
  ]);
}

export function useCapturedProcessLogs() {
  const [capturedLogs, setCapturedLogs] = useState<CapturedLog[]>([]);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    const capture = (args: unknown[]) => {
      const line = args.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
      const process = resolveProcessFromLine(line);
      setCapturedLogs((prev) => {
        const entry: CapturedLog = { ts: Date.now(), process, line };
        const next = [...prev, entry];
        return next.slice(-1000);
      });
    };

    console.log = (...args: unknown[]) => {
      capture(args);
      originalLog(...args);
    };
    console.error = (...args: unknown[]) => {
      capture(args);
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  const clearCapturedLogs = () => setCapturedLogs([]);

  const getFormattedLogs = (process: ProcessId, limit = 160): string[] => {
    return capturedLogs
      .filter((entry) => entry.process === process)
      .slice(-limit)
      .map((entry) => toTimestampedLine(entry.ts, entry.line));
  };

  return {
    capturedLogs,
    clearCapturedLogs,
    getFormattedLogs,
  };
}
