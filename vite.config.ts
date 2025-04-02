import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['jspdf', 'marked'],
      output: {
        globals: {
          jspdf: 'jsPDF',
          marked: 'marked',
        },
      },
    },
  },
  plugins: [dts({ rollupTypes: true })],
}); 