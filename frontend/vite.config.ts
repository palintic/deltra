import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
      '/nongps': {
        target: 'http://localhost:8080',
      },
      '/replay': {
        target: 'http://localhost:8080',
      },
      '/prs': {
        target: 'http://localhost:8080',
      },
      '/gpx-files': {
        target: 'http://localhost:8080',
      },
    },
  },
})
