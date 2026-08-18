import { createMDX } from 'fumadocs-mdx/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'raw.githubusercontent.com',
        pathname: '/tuntun0609/**',
        protocol: 'https',
      },
    ],
  },
  async rewrites() {
    return [
      {
        destination: '/vendor/scanic/scanic-mlDetector.js',
        source: '/_next/static/chunks/scanic-mlDetector.js',
      },
      {
        destination: '/vendor/scanic/scanic-ort.wasm.min.js',
        source: '/_next/static/chunks/scanic-ort.wasm.min.js',
      },
      {
        destination: '/llms.mdx/blog/:path*',
        source: '/blog/:path*.md',
      },
    ]
  },
}

const withMDX = createMDX()

export default withMDX(nextConfig)
