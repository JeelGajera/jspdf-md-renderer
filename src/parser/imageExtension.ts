import { RenderWarnings } from '../store/renderWarnings';

/**
 * Image attributes: `![alt](src){width=200 height=150 align=center}`.
 *
 * The `{…}` block is not markdown, so marked leaves it as the start of the text
 * token that follows the image. It is read from there, after parsing.
 *
 * Earlier versions instead rewrote the raw document with a regex before it
 * reached marked. That regex backtracked quadratically on crafted input — a few
 * hundred kilobytes of `![` blocked the event loop for minutes — and because it
 * ran ahead of the parser it also rewrote attribute syntax inside code spans and
 * fenced code, and broke images that carried a title. Working on tokens avoids
 * all three: marked has already claimed code and titles, and only the start of a
 * single token is ever examined.
 */

/**
 * The attribute block at the start of the text that follows an image.
 * Anchored, so it is attempted once per image and runs in linear time.
 */
const LEADING_ATTR_BLOCK = /^\s*\{([^}]+)\}/;

/**
 * Regex to extract individual key=value pairs from the attribute block.
 * Supports:
 * - Bare values: width=200
 * - Quoted values: width="200.5" or width='200'
 * - Decimal values: width=200.5
 */
const ATTR_PAIR_REGEX = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([\w.+-]+))/g;
const MAX_ATTR_BLOCK_LENGTH = 500;

/** Valid alignment values */
const VALID_ALIGNMENTS = ['left', 'center', 'right'] as const;

/**
 * Parsed image attributes.
 */
export interface ImageAttributes {
    width?: number;
    height?: number;
    align?: 'left' | 'center' | 'right';
}

/**
 * Parses an attribute string like "width=200 height=150 align=center"
 * into a structured object.
 */
const parseRawAttributes = (
    attrString: string,
    warnings?: RenderWarnings,
): ImageAttributes => {
    const attrs: ImageAttributes = {};
    if (attrString.length > MAX_ATTR_BLOCK_LENGTH) {
        // The image still renders, at its intrinsic size and default
        // alignment — so without a warning the only symptom is a picture
        // that quietly ignored the size the author asked for.
        warnings?.warn({
            code: 'IMAGE_ATTRS_IGNORED',
            message:
                `Image attribute block is ${attrString.length} characters, over the ` +
                `${MAX_ATTR_BLOCK_LENGTH} character limit. Width, height and alignment ` +
                'were ignored for this image.',
        });
        return attrs;
    }

    ATTR_PAIR_REGEX.lastIndex = 0;
    let match;

    while ((match = ATTR_PAIR_REGEX.exec(attrString)) !== null) {
        const key = match[1].toLowerCase();
        const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();

        switch (key) {
            case 'width':
            case 'w': {
                const num = parseFloat(value);
                if (!isNaN(num) && num > 0) attrs.width = num;
                break;
            }
            case 'height':
            case 'h': {
                const num = parseFloat(value);
                if (!isNaN(num) && num > 0) attrs.height = num;
                break;
            }
            case 'align': {
                const alignVal = value.toLowerCase();
                if (
                    VALID_ALIGNMENTS.includes(
                        alignVal as (typeof VALID_ALIGNMENTS)[number],
                    )
                ) {
                    attrs.align = alignVal as ImageAttributes['align'];
                }
                break;
            }
        }
    }

    return attrs;
};

/**
 * Reads an attribute block from the start of the text that follows an image.
 *
 * Supported attributes:
 * - `width` or `w`: Image width in pixels (number)
 * - `height` or `h`: Image height in pixels (number)
 * - `align`: Image alignment - 'left', 'center', or 'right'
 *
 * @param text - The text immediately after the image token
 * @param warnings - Collector for attributes that could not be applied
 * @returns The parsed attributes and the text left after the block, or null
 *          when the text does not start with an attribute block
 */
export const takeImageAttributes = (
    text: string,
    warnings?: RenderWarnings,
): { attrs: ImageAttributes; rest: string } | null => {
    const match = LEADING_ATTR_BLOCK.exec(text);
    if (!match) return null;
    return {
        attrs: parseRawAttributes(match[1], warnings),
        rest: text.slice(match[0].length),
    };
};
