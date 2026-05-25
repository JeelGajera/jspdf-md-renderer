import { describe, expect, it, vi } from 'vitest';
import { RenderStore } from '../../src/store/renderStore';
import { MdTokenType } from '../../src/enums/mdTokenType';
import renderListItem from '../../src/renderer/components/listItem';
import renderHeading from '../../src/renderer/components/heading';
import { validateOptions } from '../../src/utils/options-validation';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';

vi.mock('../../src/layout', () => ({
    renderInlineContent: vi.fn(),
    renderPlainText: vi.fn(),
}));

describe('rendering regressions', () => {
    it('keeps list bullet marker with first text line across page break', () => {
        const doc = new MockDoc();
        const opts = createRenderOptions({
            page: {
                ...createRenderOptions().page,
                maxContentHeight: 20,
                topmargin: 5,
            },
            cursor: { x: 10, y: 19 },
        });
        const store = new RenderStore(opts);

        const element = {
            type: MdTokenType.ListItem,
            content: 'This text should stay with bullet',
        };

        renderListItem(
            doc as never,
            element,
            1,
            store,
            () => {},
            1,
            false,
        );

        expect(doc.addPageCalls).toBe(1);
        expect(doc.textCalls[0]?.text.trim()).toBe('•');
        expect(doc.textCalls[0]?.y).toBe(opts.page.topmargin);
    });

    it('uses custom bullet for unordered items and numeric marker for ordered items', () => {
        const doc = new MockDoc();
        const opts = createRenderOptions({
            list: { bulletChar: '-> ', indentSize: 8, itemSpacing: 0 },
        });
        const store = new RenderStore(opts);

        renderListItem(
            doc as never,
            { type: MdTokenType.ListItem, content: 'unordered' },
            0,
            store,
            () => {},
            1,
            false,
        );
        renderListItem(
            doc as never,
            { type: MdTokenType.ListItem, content: 'ordered' },
            0,
            store,
            () => {},
            7,
            true,
        );

        expect(doc.textCalls[0]?.text).toBe('-> ');
        expect(doc.textCalls[1]?.text).toBe('7. ');
    });

    it('applies list spacing precedence: global spacing overrides list.itemSpacing', () => {
        const options = validateOptions({
            ...createRenderOptions(),
            list: {
                bulletChar: '• ',
                indentSize: 8,
                itemSpacing: 6,
            },
            spacing: {
                betweenListItems: 2,
            },
        });
        expect(options.spacing?.betweenListItems).toBe(2);

        const fallbackOnly = validateOptions({
            ...createRenderOptions(),
            list: {
                bulletChar: '• ',
                indentSize: 8,
                itemSpacing: 6,
            },
            spacing: {},
        });
        expect(fallbackOnly.spacing?.betweenListItems).toBe(6);
    });

    it('renders headings bold by default and regular when heading.bold is false', () => {
        const headingEl = {
            type: MdTokenType.Heading,
            depth: 2,
            content: 'Heading',
        };

        const docDefault = new MockDoc();
        const storeDefault = new RenderStore(createRenderOptions());
        renderHeading(docDefault as never, headingEl, 0, storeDefault);
        expect(
            docDefault.setFontCalls.some(
                (call) => call.name === 'helvetica' && call.style === 'bold',
            ),
        ).toBe(true);

        const docRegular = new MockDoc();
        const storeRegular = new RenderStore(
            createRenderOptions({
                heading: { bold: false },
            }),
        );
        renderHeading(docRegular as never, headingEl, 0, storeRegular);
        expect(
            docRegular.setFontCalls.some(
                (call) => call.name === 'helvetica' && call.style === 'bold',
            ),
        ).toBe(false);
        expect(
            docRegular.setFontCalls.some(
                (call) => call.name === 'helvetica' && call.style === 'normal',
            ),
        ).toBe(true);
    });
});
