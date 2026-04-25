import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // CRITICAL: dangerouslyAllowSVG MUST stay false (REQ-098, SEC-N4)
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
    ],
  },
  experimental: {
    // Pino + OTel instrumentation work well with serverComponentsExternalPackages
    serverComponentsExternalPackages: ['pino', 'pino-pretty', '@opentelemetry/sdk-node'],
  },
}

export default withPayload(nextConfig)
