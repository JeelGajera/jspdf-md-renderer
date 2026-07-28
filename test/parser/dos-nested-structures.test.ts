import { describe, it, expect } from 'vitest';
import { MdTextParser } from '../../src/parser/MdTextParser';
import { MarkdownParsingLimitError } from '../../src/security/pre-parse-guards';

describe('Parser resource-exhaustion hardening', () => {
    it('rejects deeply nested blockquotes before they can crash the parser', async () => {
        const md = '> '.repeat(5000) + 'text'; // previously caused an uncaught RangeError
        await expect(MdTextParser(md)).rejects.toThrow(MarkdownParsingLimitError);
    });

    it('rejects deeply chained nested lists before they can exhaust memory', async () => {
        let md = '';
        for (let i = 0; i < 1500; i++) md += ' '.repeat(i * 2) + '- item\n';
        await expect(MdTextParser(md)).rejects.toThrow(MarkdownParsingLimitError);
    }, 15000); // generous timeout: this must fail FAST via the pre-parse heuristic,
    // but give CI some headroom in case the heuristic itself is slow

    it('rejects input above the absolute hard length ceiling regardless of security option', async () => {
        const md = 'a'.repeat(2_000_001);
        await expect(MdTextParser(md)).rejects.toThrow(MarkdownParsingLimitError);
    });

    it('still parses a realistic, modestly nested blockquote (no false positive)', async () => {
        const md = '> '.repeat(20) + 'a normal deeply quoted comment';
        await expect(MdTextParser(md)).resolves.toBeDefined();
    });

    it('still parses a realistic, modestly nested list (no false positive)', async () => {
        let md = '';
        for (let i = 0; i < 15; i++) md += ' '.repeat(i * 2) + `- item ${i}\n`;
        await expect(MdTextParser(md)).resolves.toBeDefined();
    });

    it('the pre-parse structural scan itself stays fast on large legitimate input', async () => {
        const md = Array.from(
            { length: 5000 },
            (_, i) => `Paragraph number ${i} with some normal prose text.`,
        ).join('\n\n');
        const start = Date.now();
        await MdTextParser(md);
        expect(Date.now() - start).toBeLessThan(1000);
    });
});
