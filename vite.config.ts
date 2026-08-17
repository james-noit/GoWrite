import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
