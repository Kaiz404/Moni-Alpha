#!/usr/bin/env node
/**
 * Start Metro for a dev build reached over Tailscale instead of USB.
 * Needs WSL mirrored networking (or a native host) so this machine's Tailscale IP is local.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

// Tailscale assigns addresses from the CGNAT range 100.64.0.0/10.
const isTailscale = (address) => {
  const [a, b] = address.split('.').map(Number);
  return a === 100 && b >= 64 && b <= 127;
};

const host = Object.values(networkInterfaces())
  .flat()
  .find((iface) => iface?.family === 'IPv4' && isTailscale(iface.address))?.address;

if (!host) {
  console.error('[dev-tailscale] No Tailscale IPv4 address found. Is Tailscale connected?');
  process.exit(1);
}

console.log(`[dev-tailscale] On the phone (Tailscale on), open the dev build → http://${host}:8081`);
spawn('expo', ['start', '--dev-client', '--lan', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: host },
}).on('exit', (code) => process.exit(code ?? 0));
