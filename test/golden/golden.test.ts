import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MdTextRender } from '../../src/index';
import { goldenOptions, recordDoc } from './recorder';

/**
 * Golden layout regression suite.
 *
 * Each fixture is rendered through a real jsPDF instance and its full drawing
 * transcript — every glyph run, rule, box and image, with coordinates — is
 * snapshotted. Any change that moves content on the page shows up here as a
 * diff with exact before/after positions.
 *
 * When a change intentionally alters layout, review the snapshot diff carefully
 * before running `vitest -u`. The diff is the record of what the change did to
 * user-visible output.
 */

const FIXTURE_DIR = join(__dirname, 'fixtures');

const fixtures = readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

describe('golden layout snapshots', () => {
    it('has a fixture corpus', () => {
        expect(fixtures.length).toBeGreaterThan(15);
    });

    for (const fixture of fixtures) {
        it(`renders ${fixture} identically`, async () => {
            const markdown = readFileSync(join(FIXTURE_DIR, fixture), 'utf-8');
            const { doc, transcript } = recordDoc();

            let endY = -1;
            await MdTextRender(
                doc,
                markdown,
                goldenOptions({ endCursorYHandler: (y) => (endY = y) }),
            );

            const pages = (
                doc.internal as unknown as { getNumberOfPages: () => number }
            ).getNumberOfPages();

            await expect(
                `pages: ${pages}\nendY: ${endY.toFixed(3)}\n\n${transcript()}`,
            ).toMatchFileSnapshot(`./__snapshots__/${fixture}.txt`);
        });
    }
});

describe('golden snapshots with decorations', () => {
    it('renders a multi-page document with header and footer', async () => {
        const markdown = readFileSync(
            join(FIXTURE_DIR, '18-page-break.md'),
            'utf-8',
        );
        const { doc, transcript } = recordDoc();

        await MdTextRender(
            doc,
            markdown,
            goldenOptions({
                header: { text: 'Quarterly Report', align: 'center' },
                footer: { showPageNumbers: true, align: 'right' },
            }),
        );

        await expect(transcript()).toMatchFileSnapshot(
            './__snapshots__/decorations.txt',
        );
    });

    it('renders a themed document exercising the styling options', async () => {
        const markdown = readFileSync(
            join(FIXTURE_DIR, '22-mixed-document.md'),
            'utf-8',
        );
        const { doc, transcript } = recordDoc();

        await MdTextRender(
            doc,
            markdown,
            goldenOptions({
                heading: { h1: 26, h2: 20, color: '#1A365D', bottomSpacing: 4 },
                paragraph: { color: '#2D3748', bottomSpacing: 4 },
                blockquote: { barColor: '#4A90D9', barWidth: 2 },
                codeBlock: { backgroundColor: '#F6F8FA', padding: 5 },
                content: { textAlignment: 'left' },
            }),
        );

        await expect(transcript()).toMatchFileSnapshot(
            './__snapshots__/themed.txt',
        );
    });
});
