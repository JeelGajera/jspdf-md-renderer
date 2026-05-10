<template>
    <ClientOnly>
        <div class="playground-container">
            <div class="playground-main">
                <div class="playground-editor">
                    <div class="pane-header">
                        <span class="pane-icon">🧪</span>
                        <span>Playground Input</span>
                        <div class="tab-group">
                            <button
                                class="tab-btn"
                                :class="{ active: activeTab === 'markdown' }"
                                @click="activeTab = 'markdown'"
                            >
                                Markdown
                            </button>
                            <button
                                class="tab-btn"
                                :class="{ active: activeTab === 'options' }"
                                @click="activeTab = 'options'"
                            >
                                Render Options (JSON)
                            </button>
                        </div>
                    </div>

                    <textarea
                        v-if="activeTab === 'markdown'"
                        v-model="mdContent"
                        class="editor-textarea"
                        spellcheck="false"
                        placeholder="Type your markdown here..."
                    ></textarea>

                    <div v-else class="options-pane">
                        <div class="options-help">
                            Provide a partial or full
                            <code>RenderOption</code> object in JSON. It is
                            merged with playground defaults before rendering.
                        </div>
                        <textarea
                            v-model="optionsJson"
                            class="editor-textarea options-textarea"
                            spellcheck="false"
                            placeholder='{ "heading": { "h1": 28 } }'
                        ></textarea>
                        <div v-if="optionsStatusError" class="options-error">
                            {{ optionsStatusError }}
                        </div>
                        <div v-else-if="optionsStatusText" class="options-ok">
                            {{ optionsStatusText }}
                        </div>
                    </div>
                </div>

                <div class="playground-preview">
                    <div class="pane-header">
                        <span class="pane-icon">📄</span>
                        <span>PDF Preview</span>
                        <div class="pane-actions">
                            <button
                                class="btn btn-primary"
                                @click="generatePDF"
                                :disabled="generating || !validationState.valid"
                            >
                                {{
                                    generating
                                        ? 'Generating...'
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
                                <p>Generate PDF to preview output.</p>
                            </div>
                        </div>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { validateOptions } from 'jspdf-md-renderer';

const props = defineProps({
    defaultMd: { type: String, default: '' },
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

const DEFAULT_JSON_OPTIONS = {
    page: {
        defaultFontSize: 11,
        lineSpace: 3,
    },
    heading: {
        h1: 24,
        h2: 20,
        bottomSpacing: 2,
    },
    spacing: {
        afterParagraph: 3,
        afterHeading: 0,
    },
    footer: {
        showPageNumbers: true,
        align: 'right',
    },
};

const activeTab = ref('markdown');
const mdContent = ref(props.defaultMd || DEFAULT_MD);
const optionsJson = ref(JSON.stringify(DEFAULT_JSON_OPTIONS, null, 2));

const pdfBlobUrl = ref(null);
const pdfBlob = ref(null);
const generating = ref(false);
const errorMsg = ref('');

function cleanup() {
    if (pdfBlobUrl.value) {
        URL.revokeObjectURL(pdfBlobUrl.value);
        pdfBlobUrl.value = null;
    }
}

onBeforeUnmount(cleanup);
onMounted(() => {
    if (props.defaultMd) {
        setTimeout(() => generatePDF(), 250);
    }
});

function deepMerge(target, source) {
    const output = { ...target };
    for (const [key, value] of Object.entries(source || {})) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            typeof output[key] === 'object' &&
            output[key] !== null
        ) {
            output[key] = deepMerge(output[key], value);
        } else {
            output[key] = value;
        }
    }
    return output;
}

function parseUserOptions() {
    const parsed = JSON.parse(optionsJson.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Options must be a JSON object.');
    }
    return parsed;
}

const baseOptions = {
    cursor: { x: 10, y: 10 },
    page: {
        format: 'a4',
        unit: 'mm',
        orientation: 'portrait',
        maxContentWidth: 190,
        maxContentHeight: 287,
        lineSpace: 3,
        defaultLineHeightFactor: 1.4,
        defaultFontSize: 11,
        defaultTitleFontSize: 14,
        topmargin: 10,
        xpading: 10,
        xmargin: 10,
        indent: 8,
    },
    font: {
        bold: { name: 'helvetica', style: 'bold' },
        regular: { name: 'helvetica', style: 'normal' },
        light: { name: 'helvetica', style: 'light' },
        code: { name: 'courier', style: 'normal' },
    },
    endCursorYHandler: () => {},
};

const validationState = computed(() => {
    try {
        const userOptions = parseUserOptions();
        const renderOptions = deepMerge(baseOptions, userOptions);
        validateOptions(renderOptions);
        return {
            valid: true,
            renderOptions,
            error: '',
        };
    } catch (err) {
        return {
            valid: false,
            renderOptions: null,
            error: err.message || 'Invalid options.',
        };
    }
});

const optionsStatusText = computed(() =>
    validationState.value.valid ? 'Options look valid.' : '',
);

const optionsStatusError = computed(() =>
    validationState.value.valid ? '' : validationState.value.error,
);

async function createRenderOptions() {
    if (!validationState.value.valid || !validationState.value.renderOptions) {
        return null;
    }
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
        unit: 'mm',
        format: validationState.value.renderOptions.page.format,
        orientation: validationState.value.renderOptions.page.orientation,
    });
    return {
        doc,
        renderOptions: validationState.value.renderOptions,
    };
}

async function generatePDF() {
    generating.value = true;
    errorMsg.value = '';
    cleanup();

    try {
        const payload = await createRenderOptions();
        if (!payload) {
            throw new Error('Cannot generate PDF until options JSON is valid.');
        }

        const { doc, renderOptions } = payload;
        await import('jspdf-autotable');
        const { MdTextRender } = await import('jspdf-md-renderer');

        await MdTextRender(doc, mdContent.value, renderOptions);

        const blob = doc.output('blob');
        pdfBlob.value = blob;
        pdfBlobUrl.value = URL.createObjectURL(blob);
    } catch (err) {
        console.error('PDF generation error:', err);
        errorMsg.value = err.message || 'Failed to generate PDF';
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
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    overflow: hidden;
    background: var(--vp-c-bg);
}

.playground-main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 680px;
}

@media (max-width: 900px) {
    .playground-main {
        grid-template-columns: 1fr;
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
}

.pane-actions {
    margin-left: auto;
    display: flex;
    gap: 0.5rem;
}

.pane-icon {
    font-size: 1rem;
}

.tab-group {
    margin-left: auto;
    display: flex;
    gap: 0.4rem;
}

.tab-btn {
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg);
    color: var(--vp-c-text-2);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
}

.tab-btn.active {
    color: var(--vp-c-brand-1);
    border-color: var(--vp-c-brand-1);
}

.playground-editor {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--vp-c-divider);
}

@media (max-width: 900px) {
    .playground-editor {
        border-right: none;
        border-bottom: 1px solid var(--vp-c-divider);
    }
}

.editor-textarea {
    flex: 1;
    min-height: 560px;
    border: none;
    outline: none;
    resize: none;
    padding: 1rem;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-family: 'SF Mono', Monaco, Consolas, 'Roboto Mono', monospace;
    font-size: 0.86rem;
    line-height: 1.55;
}

.options-pane {
    display: flex;
    flex-direction: column;
    min-height: 560px;
}

.options-help {
    padding: 0.75rem 1rem;
    font-size: 0.78rem;
    color: var(--vp-c-text-2);
    border-bottom: 1px solid var(--vp-c-divider);
}

.options-textarea {
    min-height: 420px;
}

.options-error {
    padding: 0.75rem 1rem;
    color: #b91c1c;
    background: #fef2f2;
    border-top: 1px solid #fecaca;
    font-size: 0.8rem;
}

.options-ok {
    padding: 0.75rem 1rem;
    color: #065f46;
    background: #ecfdf5;
    border-top: 1px solid #a7f3d0;
    font-size: 0.8rem;
}

.preview-frame {
    flex: 1;
    min-height: 560px;
}
.pdf-iframe {
    width: 100%;
    height: 100%;
    min-height: 560px;
    border: none;
    background: #f5f5f5;
}
.preview-placeholder {
    min-height: 560px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--vp-c-bg-soft);
}
.placeholder-content {
    text-align: center;
    color: var(--vp-c-text-3);
}
.placeholder-icon {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.6rem;
    opacity: 0.45;
}

.btn {
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary {
    background: #1d4ed8;
    color: #ffffff;
    border-color: #1e40af;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.btn-primary:hover:not(:disabled) {
    background: #1e40af;
    border-color: #1d4ed8;
}

.dark .btn-primary {
    background: #38bdf8;
    color: #082f49;
    border-color: #0ea5e9;
    box-shadow: none;
}

.dark .btn-primary:hover:not(:disabled) {
    background: #7dd3fc;
    border-color: #38bdf8;
}

.btn-secondary {
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
}

.btn:disabled {
    opacity: 0.72;
    cursor: not-allowed;
}

.btn-primary:disabled {
    background: #cbd5e1;
    color: #475569;
    border-color: #cbd5e1;
}

.dark .btn-primary:disabled {
    background: #334155;
    color: #94a3b8;
    border-color: #475569;
}

.playground-error {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    color: #991b1b;
    border-top: 1px solid #fecaca;
    font-size: 0.85rem;
}
</style>
