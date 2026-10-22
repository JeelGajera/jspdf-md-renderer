import jsPDF from 'jspdf';
import {
    CodeBlockHighlightFn,
    CodeBlockHighlightRun,
    ParsedElement,
} from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { RenderStore } from '../../store/renderStore';

/**
 * Expand tabs to tab stops (issue #76). A tab advances the cursor to the next
 * multiple of `tabSize`, so a tab after two characters becomes two spaces at a
 * tab size of 4 rather than a fixed four-space run. Widths are measured in
 * characters: the code font is monospace, so one character column equals one
 * glyph width.
 */
const expandTabsToStops = (text: string, tabSize: number): string => {
    if (!text.includes('\t')) {
        return text;
    }

    return text
        .split('\n')
        .map((line) => {
            let column = 0;
            let expanded = '';
            for (const char of line) {
                if (char === '\t') {
                    const spaces = tabSize - (column % tabSize);
                    expanded += ' '.repeat(spaces);
                    column += spaces;
                } else {
                    expanded += char;
                    column += 1;
                }
            }
            return expanded;
        })
        .join('\n');
};

/**
 * Call the `codeBlock.highlight` hook and turn its per-source-line runs into
 * one run array per display line (issue #86).
 *
 * The hook works on source lines, but the renderer draws display lines: a
 * long source line may wrap, and each wrapped fragment keeps the colour of
 * the run it came from. Runs are consumed by character count, not measured
 * width — the code font is monospace and `splitTextToSize` splits
 * deterministically. Note the wrapped fragments do NOT tile the source
 * line: the splitter drops exactly the single space it wraps on (and drops
 * nothing when it chops a long word mid-word), so each fragment is located
 * at its true source offset before its runs are attributed. A hook result
 * that throws, has the wrong shape, or whose runs do not tile a source
 * line is ignored for the affected lines (with a `CODE_HIGHLIGHT_FAILED`
 * warning) and those lines render in the default text colour: a bad hook
 * never drops or duplicates text.
 */
const resolveHighlightRuns = (
    doc: jsPDF,
    store: RenderStore,
    content: string,
    maxWidth: number,
    highlight: CodeBlockHighlightFn,
    lang: string | undefined,
    defaultColor: string,
): CodeBlockHighlightRun[][] => {
    const sourceLines = content.split('\n');
    const plainLine = (line: string): CodeBlockHighlightRun[][] =>
        doc
            .splitTextToSize(line, maxWidth)
            .map((text: string) => [{ text, color: defaultColor }]);

    const fail = (message: string): CodeBlockHighlightRun[][] => {
        store.warn({
            code: 'CODE_HIGHLIGHT_FAILED',
            message,
            context: lang,
        });
        return sourceLines.flatMap(plainLine);
    };

    let hookResult: unknown;
    try {
        hookResult = highlight(content, lang);
    } catch (error) {
        return fail(
            `codeBlock.highlight threw and was ignored: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
    if (!Array.isArray(hookResult)) {
        return fail(
            'codeBlock.highlight must return one array of runs per source line; ignoring it.',
        );
    }
    if (hookResult.length !== sourceLines.length) {
        return fail(
            `codeBlock.highlight returned ${hookResult.length} line(s) for ` +
                `${sourceLines.length} source line(s); ignoring it.`,
        );
    }

    const badLines: number[] = [];
    const resolved = sourceLines.flatMap((line, index) =>
        distributeRuns(
            doc,
            line,
            maxWidth,
            hookResult[index],
            defaultColor,
            index + 1,
            badLines,
        ),
    );
    if (badLines.length > 0) {
        store.warn({
            code: 'CODE_HIGHLIGHT_FAILED',
            message:
                'codeBlock.highlight runs did not match the source text on ' +
                `line(s) ${badLines.join(', ')}; those lines render in the ` +
                'default text colour.',
            context: lang,
        });
    }
    return resolved;
};

/**
 * Split one source line into display lines and attribute each wrapped
 * fragment to the run it came from. Returns the fallback (a single
 * default-coloured run per display line) and records the line in `badLines`
 * when the runs are malformed or do not tile the source line.
 */
const distributeRuns = (
    doc: jsPDF,
    line: string,
    maxWidth: number,
    runs: unknown,
    defaultColor: string,
    lineNumber: number,
    badLines: number[],
): CodeBlockHighlightRun[][] => {
    const plain = (): CodeBlockHighlightRun[][] =>
        doc
            .splitTextToSize(line, maxWidth)
            .map((text: string) => [{ text, color: defaultColor }]);

    if (!Array.isArray(runs)) {
        badLines.push(lineNumber);
        return plain();
    }
    const validRuns: CodeBlockHighlightRun[] = [];
    for (const run of runs) {
        if (
            typeof run?.text !== 'string' ||
            (run.color !== undefined && typeof run.color !== 'string')
        ) {
            badLines.push(lineNumber);
            return plain();
        }
        validRuns.push({ text: run.text, color: run.color ?? defaultColor });
    }
    if (validRuns.map((run) => run.text).join('') !== line) {
        badLines.push(lineNumber);
        return plain();
    }

    const wrapped = doc.splitTextToSize(line, maxWidth);
    const displayLines: CodeBlockHighlightRun[][] = [];
    // Source offsets, not fragment lengths, drive run attribution (issue
    // #86 review). splitTextToSize drops exactly the single space it wraps
    // on and drops nothing when it chops a long word mid-word, so consuming
    // fragment.length from the runs lets the source offset fall behind by
    // one character per wrap: every later fragment then draws the wrong
    // slice of run text. A fragment therefore starts one character past the
    // previous fragment's end iff the source character there is the dropped
    // wrap space.
    let runIndex = 0;
    let runOffset = 0;
    let consumed = 0; // source characters the run cursors have passed
    let sourceOffset = 0; // source offset of the current fragment

    const advanceRunsTo = (target: number): boolean => {
        let skip = target - consumed;
        while (skip > 0 && runIndex < validRuns.length) {
            const run = validRuns[runIndex];
            const step = Math.min(run.text.length - runOffset, skip);
            runOffset += step;
            consumed += step;
            skip -= step;
            if (runOffset >= run.text.length) {
                runIndex += 1;
                runOffset = 0;
            }
        }
        return skip === 0;
    };

    for (const fragment of wrapped) {
        const start = sourceOffset;
        const end = start + fragment.length;
        // Defensive: a fragment that does not sit at its computed source
        // offset means the splitter behaved unexpectedly; fall back to the
        // plain rendering rather than shift text out of place.
        if (line.slice(start, end) !== fragment || !advanceRunsTo(start)) {
            badLines.push(lineNumber);
            return plain();
        }
        const display: CodeBlockHighlightRun[] = [];
        while (consumed < end && runIndex < validRuns.length) {
            const run = validRuns[runIndex];
            const take = Math.min(run.text.length - runOffset, end - consumed);
            if (take > 0) {
                display.push({
                    text: run.text.slice(runOffset, runOffset + take),
                    color: run.color,
                });
            }
            runOffset += take;
            consumed += take;
            if (runOffset >= run.text.length) {
                runIndex += 1;
                runOffset = 0;
            }
        }
        if (consumed < end) {
            // Unreachable when the runs tile the line, but never drop text.
            display.push({
                text: line.slice(consumed, end),
                color: defaultColor,
            });
        }
        displayLines.push(display);
        sourceOffset = end + (line[end] === ' ' ? 1 : 0);
    }
    return displayLines;
};

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    store: RenderStore,
) => {
    // Save current font state
    const savedFont = doc.getFont();
    const savedFontSize = doc.getFontSize();
    const savedTextColor = doc.getTextColor();
    const savedDrawColor = doc.getDrawColor();
    const savedFillColor = doc.getFillColor();

    // Set code font BEFORE measurements to ensure proper width/height calculation
    const codeFont = store.options.font.code || {
        name: 'courier',
        style: 'normal',
    };
    doc.setFont(codeFont.name, codeFont.style);
    const codeOpts = store.options.codeBlock ?? {};
    const codeFontSizeScale = codeOpts.fontSizeScale ?? 0.9;
    const codeFontSize = store.options.page.defaultFontSize * codeFontSizeScale;
    const labelFontSize = Math.max(6, codeFontSize * 0.85);
    doc.setFontSize(codeFontSize);

    const indent = indentLevel * store.options.page.indent;
    const padding = codeOpts.padding ?? 4;
    const maxWidth = store.options.page.maxContentWidth - indent - padding * 2;

    // Calculate line height using jsPDF's internal method for consistency
    const lineHeightFactor = doc.getLineHeightFactor();
    const lineHeight =
        (codeFontSize / doc.internal.scaleFactor) * lineHeightFactor;

    // Trim content to remove trailing whitespace/newlines that cause extra space
    const rawContent = element.code ?? '';
    // trimEnd strips exactly what `/[\r\n\s]+$/` did, in linear time; the
    // regex rescanned every whitespace run from each of its positions.
    // Tabs render one character wide in the code font, so expand them to tab
    // stops before measuring (issue #76).
    const tabSize = codeOpts.tabSize as number; // validated in validateOptions (issue #76)
    const content = expandTabsToStops(rawContent.trimEnd(), tabSize);

    // Guard against empty content
    if (!content) {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedFontSize);
        return;
    }

    const defaultTextColor = codeOpts.textColor ?? '#000000';

    // Split into lines. With a highlight hook the hook's per-source-line runs
    // are resolved to one run array per display line, so wrapped fragments
    // keep their colour; without a hook this stays null and the plain path
    // below — the one the golden snapshots pin — runs untouched (issue #86).
    const highlight = codeOpts.highlight;
    let lines: string[];
    let lineRuns: CodeBlockHighlightRun[][] | null = null;
    if (typeof highlight === 'function') {
        lineRuns = resolveHighlightRuns(
            doc,
            store,
            content,
            maxWidth,
            highlight,
            element.lang,
            defaultTextColor,
        );
        lines = lineRuns.map((runs) =>
            runs.map((run) => run.text).join(''),
        );
    } else {
        lines = doc.splitTextToSize(content, maxWidth);
    }

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
        lineRuns?.pop();
    }

    if (lines.length === 0) {
        doc.setFont(savedFont.fontName, savedFont.fontStyle);
        doc.setFontSize(savedFontSize);
        return;
    }

    // Config for code block
    const bgColor = codeOpts.backgroundColor ?? '#F6F8FA';
    const drawColor = codeOpts.borderColor ?? '#E1E4E8';
    const radius = codeOpts.borderRadius ?? 2;

    let currentLineIndex = 0;
    // Guards against a page geometry in which no chunk can ever fit. Without
    // it, a page whose usable height is smaller than one line of code makes
    // the loop add pages forever: it breaks the page, recomputes the same
    // impossible fit, and breaks again, until the process runs out of memory.
    let brokeForCurrentChunk = false;

    while (currentLineIndex < lines.length) {
        const availableHeight = store.options.page.maxContentHeight - store.Y;
        const remainingLines = lines.length - currentLineIndex;

        // Calculate how many lines fit on this page (accounting for padding
        // and, on the first chunk, the language label's own row)
        const pendingLabelHeight =
            currentLineIndex === 0 &&
            element.lang &&
            codeOpts.showLanguageLabel !== false
                ? labelFontSize / doc.internal.scaleFactor
                : 0;
        const effectiveAvailable =
            availableHeight - padding * 2 - pendingLabelHeight;
        let linesToRenderCount = Math.floor(effectiveAvailable / lineHeight);

        if (linesToRenderCount <= 0) {
            if (!brokeForCurrentChunk) {
                // A fresh page may have room where the current one did not.
                brokeForCurrentChunk = true;
                HandlePageBreaks(doc, store);
                continue;
            }
            // We already moved to a fresh page and a single line still does
            // not fit, so no page ever will. Render one line anyway and let it
            // overflow: losing the block entirely, or looping, is worse.
            store.warn({
                code: 'CODE_BLOCK_OVERFLOW',
                message:
                    'Code block line height exceeds the usable page height ' +
                    '(content bottom - top margin - 2 * codeBlock.padding). ' +
                    'Rendering one line per page; content may overflow the ' +
                    'page bounds. Increase the page height or reduce ' +
                    'codeBlock.padding or the font size.',
                context: element.lang,
            });
            linesToRenderCount = 1;
        }

        // A chunk is about to be emitted, so the next shortfall is allowed one
        // fresh page of its own.
        brokeForCurrentChunk = false;

        if (linesToRenderCount > remainingLines) {
            linesToRenderCount = remainingLines;
        }

        const linesToRender = lines.slice(
            currentLineIndex,
            currentLineIndex + linesToRenderCount,
        );
        const runsToRender = lineRuns
            ? lineRuns.slice(
                  currentLineIndex,
                  currentLineIndex + linesToRenderCount,
              )
            : null;
        const isFirstChunk = currentLineIndex === 0;
        const isLastChunk =
            currentLineIndex + linesToRenderCount >= lines.length;

        const textBlockHeight = linesToRenderCount * lineHeight;

        // The label sits in its own row above the code. Previously it shared a
        // baseline with the first line and the two overlapped.
        const showLabel =
            isFirstChunk &&
            !!element.lang &&
            codeOpts.showLanguageLabel !== false;
        const labelHeight = showLabel
            ? labelFontSize / doc.internal.scaleFactor
            : 0;

        if (isFirstChunk) {
            store.updateY(padding, 'add');
        }

        // Box geometry honours the block's indent, so a code block nested in a
        // list item or blockquote no longer starts at the page margin and
        // overhang the content column.
        const boxX = store.X + indent;
        const boxWidth = Math.max(
            0,
            store.options.page.maxContentWidth - indent,
        );

        // Draw Background
        doc.setFillColor(bgColor);
        doc.setDrawColor(drawColor);
        doc.roundedRect(
            boxX,
            store.Y - padding,
            boxWidth,
            textBlockHeight +
                labelHeight +
                (isFirstChunk ? padding : 0) +
                (isLastChunk ? padding : 0),
            radius,
            radius,
            'FD',
        );

        // Render Language Label (only on first chunk)
        if (showLabel) {
            const savedCodeFontSize = doc.getFontSize();
            doc.setFontSize(labelFontSize);
            doc.setTextColor(codeOpts.labelColor ?? '#666666');
            doc.text(
                element.lang as string,
                boxX +
                    boxWidth -
                    doc.getTextWidth(element.lang as string) -
                    padding,
                store.Y,
                { baseline: 'top' },
            );
            doc.setFontSize(savedCodeFontSize);
            doc.setTextColor(savedTextColor);
            store.updateY(labelHeight, 'add');
        }

        // Render code text line by line
        let yPos = store.Y;
        doc.setTextColor(defaultTextColor);
        if (runsToRender !== null) {
            // Highlighted: draw each run in its own colour, advancing the
            // cursor by the fragment's measured width. The code font is
            // monospace, so the fragments tile the line exactly.
            for (const runs of runsToRender) {
                let xPos = boxX + padding;
                for (const run of runs) {
                    if (run.text === '') {
                        continue;
                    }
                    const color = run.color ?? defaultTextColor;
                    if (color !== defaultTextColor) {
                        doc.setTextColor(color);
                    }
                    doc.text(run.text, xPos, yPos, { baseline: 'top' });
                    xPos += doc.getTextWidth(run.text);
                    if (color !== defaultTextColor) {
                        doc.setTextColor(defaultTextColor);
                    }
                }
                yPos += lineHeight;
            }
        } else {
            for (const line of linesToRender) {
                doc.text(line, boxX + padding, yPos, { baseline: 'top' });
                yPos += lineHeight;
            }
        }
        doc.setTextColor(savedTextColor);

        // Update Y cursor by exact amount rendered
        store.updateY(textBlockHeight, 'add');

        // Record visual bottom (including potential bottom padding)
        store.recordContentY(store.Y + (isLastChunk ? padding : 0));

        if (isLastChunk) {
            store.updateY(padding, 'add');
        }

        currentLineIndex += linesToRenderCount;

        // If we still have lines, break to next page
        if (currentLineIndex < lines.length) {
            HandlePageBreaks(doc, store);
        }
    }

    // Restore font state
    doc.setFont(savedFont.fontName, savedFont.fontStyle);
    doc.setFontSize(savedFontSize);
    doc.setTextColor(savedTextColor);
    doc.setDrawColor(savedDrawColor);
    doc.setFillColor(savedFillColor);
    store.updateY(store.options.spacing?.afterCodeBlock ?? 3, 'add');
};

export default renderCodeBlock;
