import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("react-router-dom") || id.includes("/react/") || id.includes("/react-dom/")) {
            return "vendor-react";
          }
          // Only the (lazy-loaded) Analytics page imports this - carved out
          // of vendor-mui so its ~230KB gzipped d3-based rendering layer
          // stays out of every other page's initial bundle.
          if (id.includes("@mui/x-charts") || id.includes("@mui/x-internals") || id.includes("d3-")) {
            return "vendor-charts";
          }
          if (id.includes("@mui") || id.includes("@emotion")) {
            return "vendor-mui";
          }
          return "vendor";
        }
      }
    }
  }
})
