import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GITHUB_PAGES_BASE는 GitHub Actions에서 "/저장소이름/" 형태로 주입됩니다.
// 로컬 개발 시에는 무시되고 '/'가 사용됩니다.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
});
