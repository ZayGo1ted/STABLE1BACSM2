// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables from `.env` files based on `mode` (development, production)
  const env = loadEnv(mode, process.cwd(), ''); // Loads all vars, not just prefixed ones

  return {
    plugins: [react()],
    define: {
      // Inject the NVIDIA_API_KEY at build time
      // If not found in .env or system env, it will be undefined in the client
      'process.env.NVIDIA_API_KEY': JSON.stringify(env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY)
    }
  };
});
