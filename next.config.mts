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
}

const withMDX = createMDX()

export default withMDX(nextConfig)
