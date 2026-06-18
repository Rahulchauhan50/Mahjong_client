import liveUiEditorBabelPlugin from './live-ui-editor.babel-plugin.js';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import liveUiEditorStableIds from './live-ui-editor.vite-plugin.js';

export default defineConfig({
  plugins: [
    liveUiEditorStableIds(),
    react({ babel: { plugins: [liveUiEditorBabelPlugin] } }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
