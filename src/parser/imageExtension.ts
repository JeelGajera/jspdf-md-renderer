/**
 * Internal hash prefix used to encode image attributes in the URL fragment.
 * This is stripped during token conversion and never reaches the image fetcher.
 */
const ATTR_HASH_PREFIX = '__jmr_';

/**
 * Regex to match an image tag followed by an attribute block.
 * Captures:
 *   Group 1: Everything before the closing `)` (i.e., `![alt](url`)
 *   Group 2: The image URL inside the parentheses
 *   Group 3: The attribute block content (e.g., `width=200 height=150 align=center`)
 *
 * Pattern: ![...](url){key=value ...}
 */
const IMAGE_WITH_ATTRS_REGEX = /(!\[[^\]]*\]\()([^)]+)(\))\s*\{([^}]+)\}/g;

/**
 * Regex to extract individual key=value pairs from the attribute block.
 */
const ATTR_PAIR_REGEX = /(\w+)\s*=\s*(\w+)/g;

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
 * Encodes image attributes into a URL hash fragment.
 * Example: {width: 200, height: 100, align: 'center'} → '#__jmr_w=200&h=100&a=center'
 */
const encodeAttrsToFragment = (attrs: ImageAttributes): string => {
    const parts: string[] = [];
    if (attrs.width !== undefined) parts.push(`w=${attrs.width}`);
    if (attrs.height !== undefined) parts.push(`h=${attrs.height}`);
    if (attrs.align) parts.push(`a=${attrs.align}`);
    return parts.length > 0 ? `#${ATTR_HASH_PREFIX}${parts.join('&')}` : '';
};

/**
 * Parses an attribute string like "width=200 height=150 align=center"
 * into a structured object.
 */
const parseRawAttributes = (attrString: string): ImageAttributes => {
    const attrs: ImageAttributes = {};
    let match;

    while ((match = ATTR_PAIR_REGEX.exec(attrString)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2];

        switch (key) {
            case 'width':
            case 'w': {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num > 0) attrs.width = num;
                break;
            }
            case 'height':
            case 'h': {
                const num = parseInt(value, 10);
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
 * Pre-processes markdown text to embed image attributes into URL fragments.
 *
 * Transforms `![alt](url){width=200 align=center}` into
 * `![alt](url#__jmr_w=200&a=center)` so that each image token
 * carries its own attributes — no shared state needed.
 *
 * Supported attributes:
 * - `width` or `w`: Image width in pixels (number)
 * - `height` or `h`: Image height in pixels (number)
 * - `align`: Image alignment - 'left', 'center', or 'right'
 *
 * @param text - The raw markdown text
 * @returns The cleaned markdown text with attributes encoded in URLs
 */
export const preprocessImageAttributes = (text: string): string => {
    return text.replace(
        IMAGE_WITH_ATTRS_REGEX,
        (_fullMatch, before, url, closeParen, attrsContent) => {
            const attrs = parseRawAttributes(attrsContent);
            const fragment = encodeAttrsToFragment(attrs);
            // Reconstruct: ![alt](url#__jmr_w=200&h=100)
            return `${before}${url}${fragment}${closeParen}`;
        },
    );
};

/**
 * Extracts image attributes from a URL that may contain an encoded fragment.
 * Returns the clean URL (without the attribute fragment) and parsed attributes.
 *
 * @param href - The image URL, possibly containing `#__jmr_...` fragment
 * @returns Object with cleanHref and parsed attrs
 */
export const parseImageAttrsFromHref = (
    href: string,
): { cleanHref: string; attrs: ImageAttributes } => {
    const fragmentIdx = href.indexOf(`#${ATTR_HASH_PREFIX}`);
    if (fragmentIdx === -1) {
        return { cleanHref: href, attrs: {} };
    }

    const cleanHref = href.substring(0, fragmentIdx);
    const fragment = href.substring(fragmentIdx + 1 + ATTR_HASH_PREFIX.length);

    const attrs: ImageAttributes = {};
    const pairs = fragment.split('&');
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        switch (key) {
            case 'w': {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num > 0) attrs.width = num;
                break;
            }
            case 'h': {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num > 0) attrs.height = num;
                break;
            }
            case 'a': {
                if (
                    VALID_ALIGNMENTS.includes(
                        value as (typeof VALID_ALIGNMENTS)[number],
                    )
                ) {
                    attrs.align = value as ImageAttributes['align'];
                }
                break;
            }
        }
    }

    return { cleanHref, attrs };
};
