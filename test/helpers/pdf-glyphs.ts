import { inflateSync } from 'node:zlib';
import { STANDARD_FONT_WIDTHS } from '../../src/layout/standardFontWidths';

/**
 * PDF-level glyph-origin extraction for the issue #111 regression test.
 *
 * The test renders each golden fixture twice — once with word-run merging
 * and once with the pre-PR per-word path — and asserts every word lands
 * within 0.01pt of its old x. Draw-call transcripts cannot see this: a
 * merged `(w1 w2) Tj` records one x, but a viewer positions `w2` with the
 * font's real advance widths, so only parsing the actual PDF bytes proves
 * the glyphs did not move.
 *
 * The extractor is deliberately independent of jsPDF's measurement: glyph
 * advances come from the Adobe AFM widths of the 14 standard PDF fonts
 * (the same tables a viewer applies, since the PDF carries no /Widths for
 * them). Characters outside 32..126 use a fixed 0.5em fallback — they can
 * never appear inside a merged run (the merge guard falls back to per-word
 * drawing for them), so the fallback only ever splits runs that are
 * byte-identical in both PDFs.
 */

export interface PdfWord {
    word: string;
    xPt: number;
    yPt: number;
    page: number;
}

/** jsPDF /BaseFont name -> AFM table key. */
const BASE_FONT_TO_KEY: Record<string, string> = {
    Helvetica: 'helvetica/normal',
    'Helvetica-Bold': 'helvetica/bold',
    'Helvetica-Oblique': 'helvetica/italic',
    'Helvetica-BoldOblique': 'helvetica/bolditalic',
    'Times-Roman': 'times/normal',
    'Times-Bold': 'times/bold',
    'Times-Italic': 'times/italic',
    'Times-BoldItalic': 'times/bolditalic',
    Courier: 'courier/normal',
    'Courier-Bold': 'courier/bold',
    'Courier-Oblique': 'courier/italic',
    'Courier-BoldOblique': 'courier/bolditalic',
};

const widthOf = (fontKey: string, charCode: number): number | null => {
    const table = STANDARD_FONT_WIDTHS[fontKey];
    if (!table || charCode < 32 || charCode > 126) return null;
    return table[charCode - 32] / 1000;
};

/** Advance of one char code in pt, at the given font size. */
const charAdvancePt = (
    charCode: number,
    fontKey: string,
    fontSizePt: number,
): number => {
    const w = widthOf(fontKey, charCode);
    return (w === null ? 0.5 : w) * fontSizePt;
};

const stringAdvancePt = (
    text: string,
    fontKey: string,
    fontSizePt: number,
    charSpacePt: number,
): number => {
    let adv = 0;
    for (let i = 0; i < text.length; i++) {
        adv += charAdvancePt(text.charCodeAt(i), fontKey, fontSizePt) + charSpacePt;
    }
    return adv;
};

interface PdfObject {
    id: number;
    dict: string;
    stream: Buffer | null;
}

const parseObjects = (pdf: string): Map<number, PdfObject> => {
    const objects = new Map<number, PdfObject>();
    const re = /(\d+) (\d+) obj([\s\S]*?)endobj/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pdf)) !== null) {
        const id = parseInt(m[1], 10);
        const body = m[3];
        const streamIdx = body.indexOf('stream');
        let dict = body;
        let stream: Buffer | null = null;
        if (streamIdx >= 0) {
            dict = body.slice(0, streamIdx);
            let start = streamIdx + 6;
            if (body[start] === '\r' && body[start + 1] === '\n') start += 2;
            else if (body[start] === '\n' || body[start] === '\r') start += 1;
            const endIdx = body.lastIndexOf('endstream');
            const raw = Buffer.from(body.slice(start, endIdx), 'latin1');
            try {
                stream = /FlateDecode/.test(dict) ? inflateSync(raw) : raw;
            } catch {
                stream = raw;
            }
        }
        objects.set(id, { id, dict, stream });
    }
    return objects;
};

const refId = (ref: string): number => parseInt(ref.split(' ')[0], 10);

interface PageStreams {
    streams: Buffer[];
    /** Resource name (F1, F2, ...) -> AFM table key. */
    fontMap: Map<string, string>;
}

const collectPages = (objects: Map<number, PdfObject>): PageStreams[] => {
    let pagesObj: PdfObject | undefined;
    for (const obj of objects.values()) {
        if (/\/Type\s*\/Pages/.test(obj.dict)) {
            pagesObj = obj;
            break;
        }
    }
    if (!pagesObj) return [];
    const kidsMatch = /\/Kids\s*\[([^\]]*)\]/.exec(pagesObj.dict);
    const kids = kidsMatch
        ? kidsMatch[1].match(/\d+ \d+ R/g)!.map(refId)
        : [];
    return kids.map((kidId) => {
        const page = objects.get(kidId);
        const streams: Buffer[] = [];
        const fontMap = new Map<string, string>();
        if (page) {
            const contentsMatch = /\/Contents\s*(\[([^\]]*)\]|(\d+) (\d+) R)/.exec(
                page.dict,
            );
            const refs: string[] = [];
            if (contentsMatch) {
                if (contentsMatch[2] !== undefined) {
                    refs.push(...contentsMatch[2].match(/\d+ \d+ R/g)!);
                } else {
                    refs.push(`${contentsMatch[3]} ${contentsMatch[4]} R`);
                }
            }
            for (const ref of refs) {
                const s = objects.get(refId(ref));
                if (s?.stream) streams.push(s.stream);
            }
            // /Resources is usually an indirect object; /Font may be inline
            // or indirect within it.
            const resMatch = /\/Resources\s+(\d+) (\d+) R/.exec(page.dict);
            const resObj = resMatch
                ? objects.get(parseInt(resMatch[1], 10))
                : undefined;
            const resDict = resObj ? resObj.dict : page.dict;
            const fontDictMatch = /\/Font\s*<<([^>]*)>>/.exec(resDict);
            let fontEntries = '';
            if (fontDictMatch) {
                fontEntries = fontDictMatch[1];
            } else {
                const fontRefMatch = /\/Font\s+(\d+) (\d+) R/.exec(resDict);
                if (fontRefMatch) {
                    const fontDictObj = objects.get(parseInt(fontRefMatch[1], 10));
                    if (fontDictObj) fontEntries = fontDictObj.dict;
                }
            }
            for (const fm of fontEntries.matchAll(/\/(\S+)\s+(\d+) (\d+) R/g)) {
                const fontObj = objects.get(parseInt(fm[2], 10));
                const baseMatch = fontObj && /\/BaseFont\s*\/(\S+)/.exec(fontObj.dict);
                if (baseMatch) {
                    const key = BASE_FONT_TO_KEY[baseMatch[1]];
                    if (key) fontMap.set(fm[1], key);
                }
            }
        }
        return { streams, fontMap };
    });
};

type Token =
    | { t: 'num'; v: number }
    | { t: 'str'; v: string }
    | { t: 'name'; v: string }
    | { t: 'op'; v: string }
    | { t: 'arr'; v: Token[] };

const tokenize = (s: string): Token[] => {
    const tokens: Token[] = [];
    let i = 0;
    const n = s.length;
    while (i < n) {
        const ch = s[i];
        if (ch === '%') {
            while (i < n && s[i] !== '\n') i++;
            continue;
        }
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (ch === '(') {
            let j = i + 1;
            let out = '';
            while (j < n) {
                const c = s[j];
                if (c === '\\') {
                    const e = s[j + 1];
                    if (e === 'n') out += '\n';
                    else if (e === 'r') out += '\r';
                    else if (e === 't') out += '\t';
                    else if (e !== undefined && /[0-7]/.test(e)) {
                        const oct = s.slice(j + 1, j + 4).match(/^[0-7]{1,3}/)![0];
                        out += String.fromCharCode(parseInt(oct, 8));
                        j += 1 + oct.length;
                        continue;
                    } else if (e !== undefined) {
                        out += e;
                    }
                    j += 2;
                    continue;
                }
                if (c === ')') break;
                out += c;
                j++;
            }
            tokens.push({ t: 'str', v: out });
            i = j + 1;
            continue;
        }
        if (ch === '<' && s[i + 1] !== '<') {
            let j = i + 1;
            let hex = '';
            while (j < n && s[j] !== '>') {
                if (!/\s/.test(s[j])) hex += s[j];
                j++;
            }
            let out = '';
            for (let k = 0; k < hex.length; k += 2) {
                out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
            }
            tokens.push({ t: 'str', v: out });
            i = j + 1;
            continue;
        }
        if (ch === '[') {
            let depth = 1;
            let j = i + 1;
            while (j < n && depth > 0) {
                if (s[j] === '(') {
                    let k = j + 1;
                    while (k < n) {
                        if (s[k] === '\\') k += 2;
                        else if (s[k] === ')') break;
                        else k++;
                    }
                    j = k + 1;
                    continue;
                }
                if (s[j] === '[') depth++;
                else if (s[j] === ']') depth--;
                j++;
            }
            tokens.push({ t: 'arr', v: tokenize(s.slice(i + 1, j - 1)) });
            i = j;
            continue;
        }
        if (ch === '/') {
            let j = i + 1;
            while (j < n && !/[\s()<>[\]/]/.test(s[j])) j++;
            tokens.push({ t: 'name', v: s.slice(i + 1, j) });
            i = j;
            continue;
        }
        let j = i;
        while (j < n && !/[\s()<>[\]/]/.test(s[j])) j++;
        const w = s.slice(i, j);
        tokens.push(
            /^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)
                ? { t: 'num', v: parseFloat(w) }
                : { t: 'op', v: w },
        );
        i = j;
    }
    return tokens;
};

interface GlyphRun {
    text: string;
    xPt: number;
    yPt: number;
    fontKey: string;
    fontSizePt: number;
}

const interpret = (
    tokens: Token[],
    fontOf: (resourceName: string) => string,
): GlyphRun[] => {
    const runs: GlyphRun[] = [];
    let tx = 0;
    let ty = 0;
    let fontSize = 0;
    let fontKey = '';
    let charSpace = 0;
    let leading = 0;
    let inText = false;
    const stack: Token[] = [];
    const popNum = (): number => {
        const t = stack.pop();
        return t && t.t === 'num' ? t.v : 0;
    };
    const emit = (text: string) => {
        if (inText) runs.push({ text, xPt: tx, yPt: ty, fontKey, fontSizePt: fontSize });
    };
    for (const tk of tokens) {
        if (tk.t !== 'op') {
            stack.push(tk);
            continue;
        }
        switch (tk.v) {
            case 'BT':
                inText = true;
                tx = 0;
                ty = 0;
                break;
            case 'ET':
                inText = false;
                break;
            case 'Td': {
                const dy = popNum();
                const dx = popNum();
                tx += dx;
                ty += dy;
                break;
            }
            case 'TD': {
                const dy = popNum();
                const dx = popNum();
                tx += dx;
                ty += dy;
                leading = -dy;
                break;
            }
            case 'Tm': {
                // a b c d e f Tm: the text position becomes (e, f); rotation
                // is ignored (jsPDF never emits rotated text here).
                const f = popNum();
                const e = popNum();
                popNum();
                popNum();
                popNum();
                popNum();
                tx = e;
                ty = f;
                break;
            }
            case 'T*':
                ty -= leading;
                break;
            case 'Tf': {
                const sizeTok = stack.pop();
                const nameTok = stack.pop();
                fontSize = sizeTok && sizeTok.t === 'num' ? sizeTok.v : 0;
                fontKey =
                    nameTok && nameTok.t === 'name' ? fontOf(nameTok.v) : '';
                break;
            }
            case 'Tc':
                charSpace = popNum();
                break;
            case 'Tw':
                popNum();
                break;
            case 'TL':
                leading = popNum();
                break;
            case 'Tj': {
                const t = stack.pop();
                if (t && t.t === 'str') emit(t.v);
                break;
            }
            case 'TJ': {
                const t = stack.pop();
                if (t && t.t === 'arr') {
                    for (const el of t.v) {
                        if (el.t === 'str') {
                            emit(el.v);
                            tx += stringAdvancePt(el.v, fontKey, fontSize, charSpace);
                        } else if (el.t === 'num') {
                            tx -= (el.v / 1000) * fontSize;
                        }
                    }
                }
                break;
            }
            case "'": {
                const t = stack.pop();
                ty -= leading;
                if (t && t.t === 'str') emit(t.v);
                break;
            }
            case '"': {
                popNum();
                popNum();
                const t = stack.pop();
                ty -= leading;
                if (t && t.t === 'str') emit(t.v);
                break;
            }
            default:
                // Any other operator consumes its operands.
                stack.length = 0;
                break;
        }
    }
    return runs;
};

/**
 * Renders are compared word by word. A run's words are split on ASCII spaces;
 * word k>0 starts at the run origin plus the viewer advance of the preceding
 * text (AFM widths + Tc), exactly how a viewer positions it inside a merged Tj.
 */
export const extractPdfWords = (pdfBytes: ArrayBuffer): PdfWord[] => {
    const pdf = Buffer.from(pdfBytes).toString('latin1');
    const objects = parseObjects(pdf);
    const pages = collectPages(objects);
    const words: PdfWord[] = [];
    pages.forEach((page, pageIndex) => {
        for (const stream of page.streams) {
            const content = stream.toString('latin1');
            if (!content.includes('BT')) continue;
            const runs = interpret(tokenize(content), (name) => page.fontMap.get(name) ?? '');
            for (const run of runs) {
                let x = run.xPt;
                const parts = run.text.split(' ');
                for (let k = 0; k < parts.length; k++) {
                    const word = parts[k];
                    if (word.length > 0) {
                        words.push({ word, xPt: x, yPt: run.yPt, page: pageIndex });
                    }
                    x += stringAdvancePt(word, run.fontKey, run.fontSizePt, 0);
                    if (k < parts.length - 1) {
                        x += stringAdvancePt(' ', run.fontKey, run.fontSizePt, 0);
                    }
                }
            }
        }
    });
    return words;
};
