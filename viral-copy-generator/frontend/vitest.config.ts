import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import type { Plugin } from 'vite'

// COOP/COEP plugin (mirrors vite.config.ts — required for crossOriginIsolated in
// browser-mode tests so that ffmpeg.wasm + SharedArrayBuffer + TF.js WebGL all work
// under the same runtime conditions as production. Vitest extends vite config natively;
// we re-declare the plugin here rather than importing vite.config.ts so the test config
// stays self-contained and the dev server config is unaffected.
const coopCoep: Plugin = {
  name: 'coop-coep',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), coopCoep],
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    projects: [
      {
        // happy-dom — fast unit tests for React components (UploadDropzone, AnalysisError, etc.)
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/lib/engine.test.ts', 'src/lib/engine.*.test.ts'],
        },
      },
      {
        // Browser mode — chromium via playwright. Required for engine.ts tests:
        // ffmpeg.wasm needs WebAssembly + crossOriginIsolated; TF.js needs WebGL.
        extends: true,
        test: {
          name: 'browser',
          include: ['src/lib/engine.test.ts', 'src/lib/engine.*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
