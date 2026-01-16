// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Change this line to use NVIDIA_API_KEY
      'process.env.NVIDIA_API_KEY': JSON.stringify(env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY)
    }
  };
});

