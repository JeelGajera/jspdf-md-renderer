import { describe, expect, it, vi } from 'vitest';
import renderTable from '../../src/renderer/components/table';
import { RenderStore } from '../../src/store/renderStore';
import { MdTokenType } from '../../src/enums/mdTokenType';
import { createRenderOptions } from '../helpers/renderOptions';
import { MockDoc } from '../helpers/mockDoc';

const { autoTableSpy } = vi.hoisted(() => ({
    autoTableSpy: vi.fn((doc: MockDoc, opts: { startY: number }) => {
        doc.lastAutoTable = { finalY: opts.startY + 20 };
    }),
}));

vi.mock('jspdf-autotable', () => ({
    default: autoTableSpy,
}));

describe('table renderer', () => {
    it('skips table without header', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        renderTable(
            doc as never,
            { type: MdTokenType.Table, rows: [] },
            0,
            store,
        );

        expect(autoTableSpy).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('normalizes rows and updates cursor from autoTable finalY', () => {
        const doc = new MockDoc();
        const store = new RenderStore(createRenderOptions());

        renderTable(
            doc as never,
            {
                type: MdTokenType.Table,
                header: [
                    { type: MdTokenType.TableHeader, content: 'A' },
                    { type: MdTokenType.TableHeader, content: 'B' },
                ],
                rows: [[{ type: MdTokenType.TableCell, content: '1' }]],
            },
            1,
            store,
        );

        expect(autoTableSpy).toHaveBeenCalledTimes(1);
        expect(store.Y).toBeGreaterThan(10);
    });

    it('wraps user table callbacks safely', () => {
        const doc = new MockDoc();
        const store = new RenderStore(
            createRenderOptions({
                table: {
                    didDrawCell: () => {
                        throw new Error('didDrawCell fail');
                    },
                    didDrawPage: () => {
                        throw new Error('didDrawPage fail');
                    },
                },
            }),
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        autoTableSpy.mockImplementationOnce((tableDoc: MockDoc, opts: any) => {
            opts.didDrawPage?.({});
            opts.didDrawCell?.({});
            tableDoc.lastAutoTable = { finalY: opts.startY + 5 };
        });

        renderTable(
            doc as never,
            {
                type: MdTokenType.Table,
                header: [{ type: MdTokenType.TableHeader, content: 'A' }],
                rows: [[{ type: MdTokenType.TableCell, content: '1' }]],
            },
            0,
            store,
        );

        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
