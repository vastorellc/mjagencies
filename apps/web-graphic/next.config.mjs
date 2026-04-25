import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // SEC-N4: SVG is not allowed via Next.js Image — sanitize via DOMPurify+SVGO instead
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
