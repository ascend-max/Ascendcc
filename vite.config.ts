import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    // Exact preview host for this cloud workspace (never a blanket style.dev allowlist).
    allowedHosts: ['pv-8af5eab4769a-f67f86f6-5a8e-47f0-b00f-26236e6a5ce4.style.dev'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
