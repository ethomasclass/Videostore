import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173 },
  // Relative asset paths, so a build can be served from any directory.
  base: './',
  build: { target: 'es2022' },
})
