import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.UPSTASH_REDIS_REST_URL': JSON.stringify(env.UPSTASH_REDIS_REST_URL || env.VITE_UPSTASH_REDIS_REST_URL),
      'process.env.UPSTASH_REDIS_REST_TOKEN': JSON.stringify(env.UPSTASH_REDIS_REST_TOKEN || env.VITE_UPSTASH_REDIS_REST_TOKEN),
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    server: {
      port: 3000
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});