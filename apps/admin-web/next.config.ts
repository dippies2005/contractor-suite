import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ikrdsdarvhbsitpqstgv.supabase.co',
      },
    ],
  },
}

export default nextConfig