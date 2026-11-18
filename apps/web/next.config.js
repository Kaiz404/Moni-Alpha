/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/brand', '@repo/core', '@repo/design', '@repo/types'],
};

export default nextConfig;
