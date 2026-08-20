import { jsPDF } from 'jspdf';
import { RenderOption } from '../../src/types/renderOption';

/**
 * Golden-output harness.
 *
 * jsPDF rendering is deterministic: the same markdown and options always produce
 * the same sequence of drawing operations at the same coordinates. This module
 * records that sequence from a *real* jsPDF instance so layout can be asserted
 * directly, rather than inferred from which functions happened to be called.
 *
 * Snapshots produced here are the regression net for geometry. If a change moves
 * anything on the page, the diff says exactly what moved and by how much.
 */

/** Coordinates are rounded so insignificant float noise cannot churn snapshots. */
const PRECISION = 3;

const round = (n: number): number => {
    if (!Number.isFinite(n)) return n;
    const r = Number(n.toFixed(PRECISION));
    // Normalise -0 to 0 so it renders consistently in snapshots.
    return Object.is(r, -0) ? 0 : r;
};

const fmt = (n: unknown): string =>
    typeof n === 'number' ? String(round(n)) : String(n);

export interface RecordedDoc {
    doc: jsPDF;
    /** Human-readable, line-per-operation transcript used for snapshotting. */
    transcript: () => string;
    /** Structured operations, for assertions that need to search or count. */
    ops: RecordedOp[];
}

export interface RecordedOp {
    op: string;
    page: number;
    [key: string]: unknown;
}

/**
 * Wraps a real jsPDF instance and records every drawing operation, tagged with
 * the page it landed on.
 */
export const recordDoc = (
    options: { unit?: string; format?: string; orientation?: string } = {},
): RecordedDoc => {
    const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        ...options,
    } as ConstructorParameters<typeof jsPDF>[0]);

    const ops: RecordedOp[] = [];
     
    const internal = doc.internal as any;
    const currentPage = (): number =>
        internal.getCurrentPageInfo?.().pageNumber ?? 1;

    const record = (op: string, fields: Record<string, unknown>) => {
        ops.push({ op, page: currentPage(), ...fields });
    };

     
    const d = doc as any;

    const origText = d.text.bind(doc);
    d.text = (
        text: string | string[],
        x: number,
        y: number,
         
        opts?: any,
         
        ...rest: any[]
    ) => {
        record('text', {
            text: Array.isArray(text) ? text.join('\\n') : text,
            x,
            y,
            align: opts?.align,
            baseline: opts?.baseline,
            font: `${doc.getFont().fontName}/${doc.getFont().fontStyle}`,
            size: doc.getFontSize(),
            color: doc.getTextColor(),
        });
        return origText(text, x, y, opts, ...rest);
    };

    const origRect = d.rect.bind(doc);
    d.rect = (x: number, y: number, w: number, h: number, style?: string) => {
        record('rect', {
            x,
            y,
            w,
            h,
            style,
            fill: doc.getFillColor(),
            draw: doc.getDrawColor(),
        });
        return origRect(x, y, w, h, style);
    };

    const origRounded = d.roundedRect.bind(doc);
    d.roundedRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        rx: number,
        ry: number,
        style?: string,
    ) => {
        record('roundedRect', {
            x,
            y,
            w,
            h,
            rx,
            ry,
            style,
            fill: doc.getFillColor(),
            draw: doc.getDrawColor(),
        });
        return origRounded(x, y, w, h, rx, ry, style);
    };

    const origLine = d.line.bind(doc);
    d.line = (x1: number, y1: number, x2: number, y2: number) => {
        record('line', {
            x1,
            y1,
            x2,
            y2,
            draw: doc.getDrawColor(),
            width: doc.getLineWidth(),
        });
        return origLine(x1, y1, x2, y2);
    };

    const origAddImage = d.addImage.bind(doc);
     
    d.addImage = (data: any, format: string, x: number, y: number, w: number, h: number, ...rest: any[]) => {
        record('image', {
            format,
            x,
            y,
            w,
            h,
            bytes: typeof data === 'string' ? data.length : undefined,
        });
        return origAddImage(data, format, x, y, w, h, ...rest);
    };

    const origLink = d.link.bind(doc);
     
    d.link = (x: number, y: number, w: number, h: number, opts: any) => {
        record('link', { x, y, w, h, url: opts?.url });
        return origLink(x, y, w, h, opts);
    };

    const origAddPage = d.addPage.bind(doc);
     
    d.addPage = (...args: any[]) => {
        const result = origAddPage(...args);
        ops.push({ op: 'addPage', page: currentPage() });
        return result;
    };

    const transcript = () =>
        ops
            .map((o) => {
                const { op, page, ...fields } = o;
                const body = Object.entries(fields)
                    .filter(([, v]) => v !== undefined)
                    .map(([k, v]) =>
                        k === 'text' ? `${k}=${JSON.stringify(v)}` : `${k}=${fmt(v)}`,
                    )
                    .join(' ');
                return `p${page} ${op.padEnd(11)} ${body}`.trimEnd();
            })
            .join('\n');

    return { doc, transcript, ops };
};

/**
 * Baseline render options used by the golden fixtures. Deliberately explicit —
 * a fixture that wants to exercise a specific option overrides it, so the
 * snapshot always shows the full geometry that produced it.
 */
export const goldenOptions = (
    overrides: Partial<RenderOption> = {},
): RenderOption =>
    ({
        cursor: { x: 10, y: 10 },
        page: {
            format: 'a4',
            unit: 'mm',
            orientation: 'portrait',
            maxContentWidth: 190,
            maxContentHeight: 277,
            lineSpace: 3,
            defaultLineHeightFactor: 1.4,
            defaultFontSize: 11,
            defaultTitleFontSize: 14,
            topmargin: 10,
            xpading: 10,
            xmargin: 10,
            indent: 8,
            ...(overrides.page ?? {}),
        },
        font: {
            bold: { name: 'helvetica', style: 'bold' },
            regular: { name: 'helvetica', style: 'normal' },
            light: { name: 'helvetica', style: 'normal' },
            italic: { name: 'helvetica', style: 'italic' },
            boldItalic: { name: 'helvetica', style: 'bolditalic' },
            code: { name: 'courier', style: 'normal' },
            ...(overrides.font ?? {}),
        },
        endCursorYHandler: () => {},
        ...overrides,
    }) as RenderOption;

/**
 * A 1x1 transparent PNG, used wherever a fixture needs a real image without
 * touching the network.
 */
export const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
