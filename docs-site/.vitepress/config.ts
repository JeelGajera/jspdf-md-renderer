import { defineConfig } from 'vitepress'

export default defineConfig({
    base: '/jspdf-md-renderer',
    cleanUrls: true,
    title: 'jspdf-md-renderer',
    description: 'Render Markdown to PDF with jsPDF — fully customizable',

    head: [
        ['link', { rel: 'icon', href: '/jspdf-md-renderer/favicon.ico' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
        ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', rel: 'stylesheet' }],
    ],

    themeConfig: {
        logo: { light: '/logo.svg', dark: '/logo-dark.svg' },
        siteTitle: 'jspdf-md-renderer',

        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'API', link: '/api/options' },
            { text: 'Elements', link: '/elements/headings' },
            { text: 'Examples', link: '/examples/resume' },
            { text: 'Playground', link: '/playground/' },
            { text: 'npm', link: 'https://www.npmjs.com/package/jspdf-md-renderer' },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Guide',
                    items: [
                        { text: 'Getting Started', link: '/guide/getting-started' },
                        { text: 'Installation', link: '/guide/installation' },
                        { text: 'Basic Usage', link: '/guide/basic-usage' },
                        { text: 'Browser Usage', link: '/guide/browser-usage' },
                    ],
                },
            ],
            '/api/': [
                {
                    text: 'API Reference',
                    items: [
                        { text: 'Options Reference', link: '/api/options' },
                        { text: 'MdTextRender', link: '/api/MdTextRender' },
                        { text: 'MdTextParser', link: '/api/MdTextParser' },
                    ],
                },
            ],
            '/elements/': [
                {
                    text: 'Markdown Elements',
                    items: [
                        { text: 'Headings', link: '/elements/headings' },
                        { text: 'Paragraphs', link: '/elements/paragraphs' },
                        { text: 'Text Styles', link: '/elements/text-styles' },
                        { text: 'Lists', link: '/elements/lists' },
                        { text: 'Links', link: '/elements/links' },
                        { text: 'Images', link: '/elements/images' },
                        { text: 'Tables', link: '/elements/tables' },
                        { text: 'Code Blocks', link: '/elements/code-blocks' },
                        { text: 'Blockquotes', link: '/elements/blockquotes' },
                        { text: 'Horizontal Rules', link: '/elements/horizontal-rules' },
                    ],
                },
            ],
            '/examples/': [
                {
                    text: 'Examples',
                    items: [
                        { text: 'Resume / CV', link: '/examples/resume' },
                        { text: 'Invoice', link: '/examples/invoice' },
                        { text: 'Technical Report', link: '/examples/report' },
                        { text: 'Custom Fonts', link: '/examples/custom-fonts' },
                    ],
                },
            ],
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/JeelGajera/jspdf-md-renderer' },
        ],

        editLink: {
            pattern: 'https://github.com/JeelGajera/jspdf-md-renderer/edit/master/docs-site/:path',
            text: 'Edit this page on GitHub',
        },

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © <a href="https://github.com/JeelGajera" target="_blank" rel="noopener">Jeel Gajera</a>',
        },

        search: { provider: 'local' },
    },
})
