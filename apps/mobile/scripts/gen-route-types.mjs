#!/usr/bin/env node
// Writes .expo/types/router.d.ts the way `expo start` does, so `tsc` checks
// every href against the routes in app/ without a running dev server.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(projectRoot, 'app');
process.env.EXPO_ROUTER_APP_ROOT = appRoot;

const fromProject = createRequire(path.join(projectRoot, 'package.json'));
const fromExpo = createRequire(fromProject.resolve('expo/package.json'));
const { requireContext } = fromProject('expo-router/internal/testing');
const { EXPO_ROUTER_CTX_IGNORE } = fromProject('expo-router/_ctx-shared');
const { getTypedRoutesDeclarationFile } = fromExpo('@expo/router-server/build/typed-routes/generate');

const appJson = JSON.parse(readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
const routerOptions = appJson.expo?.extra?.router ?? {};

const file = getTypedRoutesDeclarationFile(
  requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE),
  routerOptions,
);
if (!file) {
  console.error('gen-route-types: expo-router produced no declarations for app/');
  process.exit(1);
}

const outDir = path.join(projectRoot, '.expo', 'types');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'router.d.ts'), file);
