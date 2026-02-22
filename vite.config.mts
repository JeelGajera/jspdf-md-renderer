import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'JspdfMdRenderer',
            formats: ['es', 'cjs', 'umd'],
            fileName: (format) => {
                if (format === 'es') return 'index.mjs';
                if (format === 'cjs') return 'index.js';
                return 'index.umd.js';
            },
        },
        rollupOptions: {
            external: ['jspdf', 'marked', 'jspdf-autotable'],
            output: {
                globals: {
                    jspdf: 'jspdf',
                    marked: 'marked',
                    'jspdf-autotable': 'jspdfAutoTable',
                },
            },
        },
    },
    plugins: [dts({ rollupTypes: true })],
});
