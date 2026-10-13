import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 相對路徑：打包後的 dist/ 可以直接放到任何子目錄底下
  base: './',
  plugins: [react()],
});
