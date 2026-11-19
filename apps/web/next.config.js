import { fileURLToPath } from 'node:url';

// The monorepo root, stated so a git worktree nested inside the main checkout doesn't pick the outer lockfile.
const root = fileURLToPath(new URL('../..', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ai', '@repo/brand', '@repo/core', '@repo/data', '@repo/design', '@repo/types'],
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default nextConfig;
