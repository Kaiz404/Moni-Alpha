import { useEffect, useState } from 'react';

export type ProcessId = 'notifications' | 'debug-log';

export type CapturedLog = {
  ts: number;
  process: ProcessId;
  line: string;
};

export const PROCESS_LABELS: Record<ProcessId, string> = {
  notifications: 'Notifications',
  'debug-log': 'Debug Log',
};

function resolveProcessFromLine(line: string): ProcessId {
  if (line.includes('[NotifCapture]') || line.includes('[NotifProc]')) return 'notifications';
  if (line.includes('[BGProc]') && line.includes('notification')) return 'notifications';
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
