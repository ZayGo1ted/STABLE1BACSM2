
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This mapping ensures process.env.API_KEY is available in the browser context
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env': process.env
  }
});
