import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty', '@opentelemetry/sdk-node'],
  },
}

export default withPayload(nextConfig)
