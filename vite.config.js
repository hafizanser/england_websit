import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative so the build works when served from a
// sub-folder under XAMPP (e.g. http://localhost/FMCG_project/dist/). The app
// uses HashRouter so deep links and refreshes work without server rewrites.
// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into cacheable chunks
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          icons: ['@phosphor-icons/react'],
        },
      },
    },
  },
})
