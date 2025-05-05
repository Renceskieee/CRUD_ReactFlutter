// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/records': {
        target: 'http://192.168.0.157:3000', // Your API server address
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/records/, ''),
      },
    },
  },
});
