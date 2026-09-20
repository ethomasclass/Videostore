import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173 },
  // Relative asset paths, so a build can be served from any directory.
  base: './',
  build: {
    target: 'es2022',
    // Inline every asset as a data URI. The published build is one HTML page plus one script,
    // so a poster emitted as a separate file would simply 404.
    assetsInlineLimit: 65536,
  },
})
