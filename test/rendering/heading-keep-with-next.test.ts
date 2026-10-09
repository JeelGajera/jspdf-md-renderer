import { describe, expect, it, vi } from 'vitest';

import { MdTokenType } from '../../src/enums/mdTokenType';
import renderHeading from '../../src/renderer/components/heading';
import { RenderStore } from '../../src/store/renderStore';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';

vi.mock('../../src/layout', () => ({
    renderInlineContent: vi.fn(),
    renderPlainText: vi.fn(),
}));

describe('heading.keepWithNext', () => {
    const headingEl = {
        type: MdTokenType.Heading,
        depth: 2,
        content: 'Heading',
    };

    // h2 font size is 20, so the heading reserves 20 * 1.8 = 36 units of
    // height; with keepWithNext it also reserves one body line
    // (11 * 1.4 = 15.4), for 51.4 total. At Y = 60 on a 100-unit page the
    // heading alone fits but the heading plus a body line does not.
    const nearBottom = {
        cursor: { x: 10, y: 60 },
        page: { maxContentHeight: 100 },
    };

    it('keeps the heading where it fits when keepWithNext is off (default)', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions(nearBottom));

        renderHeading(doc as never, headingEl, 0, store);

        expect(doc.addPageCalls).toBe(0);
    });

    it('breaks before a heading that would strand alone when keepWithNext is on', () => {
        const doc = new MockDoc();
        const store = new RenderStore(
            createRenderOptions({ heading: { keepWithNext: true }, ...nearBottom }),
        );

        renderHeading(doc as never, headingEl, 0, store);

        expect(doc.addPageCalls).toBe(1);
    });

    it('does not break when the heading and body both fit', () => {
        const doc = new MockDoc();
        const store = new RenderStore(
            createRenderOptions({
                heading: { keepWithNext: true },
                cursor: { x: 10, y: 10 },
                page: { maxContentHeight: 100 },
            }),
        );

        renderHeading(doc as never, headingEl, 0, store);

        expect(doc.addPageCalls).toBe(0);
    });
});
