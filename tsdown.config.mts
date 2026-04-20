import { defineConfig } from 'tsdown';
import { readFileSync } from 'node:fs';

const licenseContent = readFileSync('./LICENSE', 'utf-8');
const bannerText = `/*!\n * jspdf-md-renderer\n * \n${licenseContent.split('\n').map(line => ` * ${line}`).join('\n')}\n */`;

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['es', 'cjs', 'umd'],
    globalName: 'JspdfMdRenderer',
    platform: 'neutral',
    outDir: 'dist',
    clean: true,
    dts: true,
    deps: {
        neverBundle: ['jspdf', 'marked', 'jspdf-autotable']
    },
    outputOptions: (options) => {
        options.globals = {
            jspdf: 'jspdf',
            marked: 'marked',
            'jspdf-autotable': 'jspdfAutoTable'
        };
        return options;
    },
    banner: bannerText
});
