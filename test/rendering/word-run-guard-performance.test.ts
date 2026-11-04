import { afterEach, describe, expect, it } from 'vitest';
import { MdTextRender } from '../../src/index';
import { setWordRunMergingEnabled } from '../../src/layout/lineRenderer';
import { goldenOptions, recordDoc } from '../golden/recorder';

/**
 * Review follow-up on issue #111: the guard-failure path used to rescan
 * the remaining suffix of a rejected run for every following word
 * (findMergeableRun per word), which made a focused 5,000-word single
 * wide-line case quadratic — about 2.3 s on this machine vs ~0.1 s for the
 * pre-PR per-word path. The run end is now cached across the run's words,
 * so the work stays linear in the word count.
 *
 * Helvetica is used because its jsPDF widths differ from the viewer AFM
 * widths, so the per-word guard rejects the run — the exact path that used
 * to rescan. The wide maxContentWidth keeps all 5,000 words on one line.
 */

const WORD_COUNT = 5000;
const MARKDOWN = Array(WORD_COUNT).fill('word').join(' ');
const WIDE = goldenOptions({ page: { maxContentWidth: 200000 } });

const renderTimed = async (
    mergeRuns: boolean,
): Promise<{ ms: number; words: number }> => {
    setWordRunMergingEnabled(mergeRuns);
    try {
        const { doc, ops } = recordDoc();
        const t0 = Date.now();
        await MdTextRender(doc, MARKDOWN, WIDE);
        const ms = Date.now() - t0;
        const words = ops
            .filter((o) => o.op === 'text')
            .flatMap((o) => (o.text as string).split(' '))
            .filter((w) => w.length > 0).length;
        return { ms, words };
    } finally {
        setWordRunMergingEnabled(true);
    }
};

describe('word-run guard-failure work (issue #111 follow-up)', () => {
    afterEach(() => {
        setWordRunMergingEnabled(true);
    });

    it('renders a 5,000-word guard-failing line in bounded work', async () => {
        const perWord = await renderTimed(false);
        const merged = await renderTimed(true);

        // All 5,000 words still render, whether merged or per-word.
        expect(merged.words).toBe(WORD_COUNT);
        expect(merged.words).toBe(perWord.words);

        // Linear work, not the old quadratic rescan: merging on must stay
        // within a small multiple of the per-word path (the old code ran
        // ~20x slower than it here). The floor keeps tiny timings from
        // failing on jitter.
        expect(merged.ms).toBeLessThan(Math.max(perWord.ms, 50) * 5);
    });
});
