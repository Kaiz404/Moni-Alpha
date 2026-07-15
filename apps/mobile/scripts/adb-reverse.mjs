#!/usr/bin/env node
/**
 * Forward Metro (8081) from the USB-attached device to this machine.
 * Required for WSL2 + physical Android over usbipd — the phone cannot reach the WSL IP (172.x).
 */
import { execSync } from 'node:child_process';

try {
  const out = execSync('adb devices', { encoding: 'utf8' });
  const serials = out
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);

  if (serials.length === 0) {
    console.warn('[adb-reverse] No device in "device" state — skip (emulator/Wi‑Fi may not need this).');
    process.exit(0);
  }

  for (const serial of serials) {
    execSync(`adb -s ${serial} reverse tcp:8081 tcp:8081`, { stdio: 'inherit' });
    console.log(`[adb-reverse] tcp:8081 → host (device ${serial})`);
  }
} catch (e) {
  console.warn('[adb-reverse] adb not available:', e.message ?? e);
  process.exit(0);
}
