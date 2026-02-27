<template>
    <ClientOnly>
        <div class="playground-container">
            <div class="playground-main">
                <div class="playground-editor">
                    <div class="pane-header py-1">
                        <span class="pane-icon">📝</span>
                        <span>Markdown Editor</span>
                    </div>
                    <textarea
                        v-model="mdContent"
                        class="editor-textarea"
                        spellcheck="false"
                        placeholder="Type your markdown here..."
                    ></textarea>
                </div>
                <div class="playground-preview">
                    <div class="pane-header">
                        <span class="pane-icon">📄</span>
                        <span>PDF Preview</span>
                        <div class="pane-actions">
                            <button
                                class="btn btn-primary"
                                @click="generatePDF"
                                :disabled="generating"
                            >
                                {{
                                    generating
                                        ? '⏳ Generating...'
                                        : 'Generate PDF'
                                }}
                            </button>
                            <button
                                class="btn btn-secondary"
                                @click="downloadPDF"
                                :disabled="!pdfBlobUrl"
                            >
                                Download
                            </button>
                        </div>
                    </div>
                    <div class="preview-frame">
                        <iframe
                            v-if="pdfBlobUrl"
                            :src="pdfBlobUrl"
                            class="pdf-iframe"
                            title="PDF Preview"
                        ></iframe>
                        <div v-else class="preview-placeholder">
                            <div class="placeholder-content">
                                <span class="placeholder-icon">📄</span>
                                <p>
                                    Click <strong>Generate PDF</strong> to see
                                    your preview
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="!hideOptions" class="playground-options">
                <div class="pane-header">
                    <span class="pane-icon">⚙️</span>
                    <span>Render Options</span>
                </div>
                <div class="options-grid">
                    <div class="option-group">
                        <label
                            >Font Size
                            <span class="option-val"
                                >{{ opts.defaultFontSize }}pt</span
                            ></label
                        >
                        <input
                            type="range"
                            v-model.number="opts.defaultFontSize"
                            min="8"
                            max="24"
                            step="1"
                        />
                    </div>
                    <div class="option-group">
                        <label
                            >Title Font Size
                            <span class="option-val"
                                >{{ opts.defaultTitleFontSize }}pt</span
                            ></label
                        >
                        <input
                            type="range"
                            v-model.number="opts.defaultTitleFontSize"
                            min="10"
                            max="30"
                            step="1"
                        />
                    </div>
                    <div class="option-group">
                        <label
                            >Line Spacing
                            <span class="option-val">{{
                                opts.lineSpace
                            }}</span></label
                        >
                        <input
                            type="range"
                            v-model.number="opts.lineSpace"
                            min="1"
                            max="10"
                            step="0.5"
                        />
                    </div>
                    <div class="option-group">
                        <label
                            >X Padding
                            <span class="option-val"
                                >{{ opts.xpading }}mm</span
                            ></label
                        >
                        <input
                            type="range"
                            v-model.number="opts.xpading"
                            min="5"
                            max="40"
                            step="1"
                        />
                    </div>
                    <div class="option-group">
                        <label
                            >Top Margin
                            <span class="option-val"
                                >{{ opts.topmargin }}mm</span
                            ></label
                        >
                        <input
                            type="range"
                            v-model.number="opts.topmargin"
                            min="5"
                            max="40"
                            step="1"
                        />
                    </div>
                    <div class="option-group">
                        <label
                            >Indent
                            <span class="option-val"
                                >{{ opts.indent }}mm</span
                            ></label
                        >
                        <input
                            type="range"
                            v-model.number="opts.indent"
                            min="4"
                            max="20"
                            step="1"
                        />
                    </div>
                    <div class="option-group">
                        <label>Orientation</label>
                        <select v-model="opts.orientation">
                            <option value="p">Portrait</option>
                            <option value="l">Landscape</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label>Text Alignment</label>
                        <select v-model="opts.textAlignment">
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                            <option value="justify">Justify</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label>Image Alignment</label>
                        <select v-model="opts.imageAlign">
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </div>
            </div>
            <div v-if="errorMsg" class="playground-error">
                ⚠️ {{ errorMsg }}
            </div>
        </div>
    </ClientOnly>
</template>

<script setup>
import { ref, onBeforeUnmount, onMounted } from 'vue';

const props = defineProps({
    defaultMd: { type: String, default: '' },
    defaultOptions: { type: Object, default: () => ({}) },
    hideOptions: { type: Boolean, default: false },
});

const DEFAULT_MD = `# Hello World

This is a **live preview** of jspdf-md-renderer. Edit this markdown and click **Generate PDF** to see the result.

## Features

- **Bold** and *italic* text rendering
- Ordered and unordered lists
- \`Inline code\` support
- [Hyperlinks](https://github.com/JeelGajera/jspdf-md-renderer)

## Code Block

\`\`\`javascript
import { MdTextRender } from 'jspdf-md-renderer';
const doc = new jsPDF();
await MdTextRender(doc, markdown, options);
doc.save('output.pdf');
\`\`\`

## Table Example

| Feature | Status |
| ------- | ------ |
| Headings | ✅ |
| Lists | ✅ |
| Tables | ✅ |
| Images | ✅ |

> **Tip:** Adjust the options below to customize the PDF output.

---

*Powered by jspdf-md-renderer*
`;

const mdContent = ref(props.defaultMd || DEFAULT_MD);
const pdfBlobUrl = ref(null);
const pdfBlob = ref(null);
const generating = ref(false);
const errorMsg = ref('');

const opts = ref({
    defaultFontSize: 12,
    defaultTitleFontSize: 14,
    lineSpace: 1.5,
    xpading: 10,
    topmargin: 10,
    indent: 10,
    orientation: 'p',
    textAlignment: 'left',
    imageAlign: 'left',
    ...props.defaultOptions,
});

function cleanup() {
    if (pdfBlobUrl.value) {
        URL.revokeObjectURL(pdfBlobUrl.value);
        pdfBlobUrl.value = null;
    }
}

onBeforeUnmount(cleanup);

// Auto-generate on mount for pages with embedded playground
onMounted(() => {
    if (props.defaultMd) {
        // Small delay to ensure CDN scripts are loaded
        setTimeout(() => generatePDF(), 500);
    }
});

async function generatePDF() {
    generating.value = true;
    errorMsg.value = '';
    cleanup();

    try {
        // Dynamically load to avoid SSR issues and use local bundle instead of CDN
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const { MdTextRender } = await import('jspdf-md-renderer');

        const o = opts.value;
        const isLandscape = o.orientation === 'l';
        const pageWidth = isLandscape ? 297 : 210;
        const pageHeight = isLandscape ? 210 : 297;
        const maxContentWidth = pageWidth - 2 * o.xpading;

        const doc = new jsPDF({
            unit: 'mm',
            format: 'a4',
            orientation: o.orientation,
        });

        const renderOptions = {
            cursor: { x: o.xpading, y: o.topmargin },
            page: {
                format: 'a4',
                orientation: o.orientation,
                maxContentWidth,
                maxContentHeight: pageHeight,
                lineSpace: o.lineSpace,
                defaultLineHeightFactor: 1.2,
                defaultFontSize: o.defaultFontSize,
                defaultTitleFontSize: o.defaultTitleFontSize,
                topmargin: o.topmargin,
                xpading: o.xpading,
                xmargin: o.xpading,
                indent: o.indent,
            },
            font: {
                bold: { name: 'helvetica', style: 'bold' },
                regular: { name: 'helvetica', style: 'normal' },
                light: { name: 'helvetica', style: 'light' },
            },
            content: {
                textAlignment: o.textAlignment,
            },
            image: {
                defaultAlign: o.imageAlign,
            },
            endCursorYHandler: () => {},
        };

        await MdTextRender(doc, mdContent.value, renderOptions);

        const blob = doc.output('blob');
        pdfBlob.value = blob;
        pdfBlobUrl.value = URL.createObjectURL(blob);
    } catch (err) {
        console.error('PDF generation error:', err);
        errorMsg.value = `Error: ${err.message || 'Failed to generate PDF'}`;
    } finally {
        generating.value = false;
    }
}

function downloadPDF() {
    if (!pdfBlob.value) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob.value);
    link.download = 'jspdf-md-renderer-output.pdf';
    link.click();
    URL.revokeObjectURL(link.href);
}
</script>

<style scoped>
.playground-container {
    width: 100%;
    max-width: 100%;
    margin: 1.5rem 0;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    overflow: hidden;
    background: var(--vp-c-bg);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.playground-main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: clamp(600px, 80vh, 1200px);
    height: 100%;
}

@media (max-width: 768px) {
    .playground-main {
        grid-template-columns: 1fr;
        min-height: auto;
    }
}

.pane-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--vp-c-bg-soft);
    border-bottom: 1px solid var(--vp-c-divider);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--vp-c-text-1);
}

.pane-icon {
    font-size: 1rem;
}

.pane-actions {
    margin-left: auto;
    display: flex;
    gap: 0.5rem;
}

.playground-editor {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--vp-c-divider);
}

@media (max-width: 768px) {
    .playground-editor {
        border-right: none;
        border-bottom: 1px solid var(--vp-c-divider);
    }
}

.editor-textarea {
    flex: 1;
    height: 100%;
    min-height: 500px;
    padding: 1rem;
    border: none;
    outline: none;
    resize: none;
    font-family:
        'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    tab-size: 2;
}

.playground-preview {
    display: flex;
    flex-direction: column;
}

.preview-frame {
    flex: 1;
    height: 100%;
    min-height: 500px;
}

.pdf-iframe {
    width: 100%;
    height: 100%;
    min-height: 500px;
    border: none;
    background: #f5f5f5;
}

.preview-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 500px;
    background: var(--vp-c-bg-soft);
}

.placeholder-content {
    text-align: center;
    color: var(--vp-c-text-3);
}

.placeholder-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 0.75rem;
    opacity: 0.4;
}

.placeholder-content p {
    font-size: 0.9rem;
}

.playground-options {
    border-top: 1px solid var(--vp-c-divider);
}

.options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    padding: 1rem;
}

.option-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.option-group label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--vp-c-text-2);
    display: flex;
    justify-content: space-between;
}

.option-val {
    color: var(--vp-c-brand-1);
    font-weight: 600;
}

.option-group input[type='range'] {
    width: 100%;
    accent-color: var(--vp-c-brand-1);
}

.option-group select {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 0.8rem;
}

.btn {
    padding: 0.4rem 0.85rem;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary {
    background: var(--vp-button-brand-bg, #222);
    color: #fff; /* Ensure text is white in light mode */
}

.dark .btn-primary {
    background: #eeeeee !important;
    color: #111111 !important; /* Force dark text in dark mode */
}

.btn-primary:hover:not(:disabled) {
    background: var(--vp-button-brand-hover-bg, #444);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dark .btn-primary:hover:not(:disabled) {
    background: #cccccc !important;
}

.btn-secondary {
    background: transparent;
    color: var(--vp-c-text-1);
    border: 1px solid var(--vp-c-divider);
}

.btn-secondary:hover:not(:disabled) {
    background: var(--vp-c-bg-mute);
    transform: translateY(-1px);
}

.playground-error {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    color: #991b1b;
    font-size: 0.85rem;
    border-top: 1px solid #fecaca;
}

.dark .playground-error {
    background: rgba(239, 68, 68, 0.1);
    color: #fca5a5;
    border-top-color: rgba(239, 68, 68, 0.2);
}

.py-1 {
    padding-top: 1.2rem;
    padding-bottom: 1.2rem;
}
</style>
