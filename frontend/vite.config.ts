import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // 监听所有网络接口，允许外部访问
    port: 5173,
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

