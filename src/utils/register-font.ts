import jsPDF from 'jspdf';

/**
 * Registers a custom font with a jsPDF document and returns the `font` config
 * that selects it.
 *
 * Using a non-core font otherwise means driving `addFileToVFS` and `addFont`
 * by hand and getting the style names to line up with what the renderer asks
 * for — it calls `doc.setFont(family, style)` with exactly `'normal'`,
 * `'bold'`, `'italic'` and `'bolditalic'`, and a mismatch silently falls back
 * to a core font rather than failing.
 *
 *     const inter = registerFont(doc, {
 *       family: 'Inter',
 *       variants: { normal: regularBase64, bold: boldBase64 },
 *     })
 *
 *     await MdTextRender(doc, md, { font: inter.font })
 */

/** The style names the renderer selects. `normal` is required. */
export interface FontVariants {
    normal: string;
    bold?: string;
    italic?: string;
    bolditalic?: string;
}

export type FontVariantName = keyof FontVariants;

export interface RegisterFontOptions {
    /** Family name used in `setFont`, e.g. `'Inter'`. */
    family: string;
    /** Base64 font data per style. A `data:` URI prefix is accepted and stripped. */
    variants: FontVariants;
    /**
     * Virtual filesystem names, if you need control over them.
     * Defaults to `<family>-<style>.ttf`.
     */
    fileNames?: Partial<Record<FontVariantName, string>>;
    /** Called for each variant that was requested but could not be registered. */
    onWarning?: (message: string) => void;
}

export interface RegisteredFont {
    family: string;
    /** Variants actually registered, in the order they were applied. */
    registered: FontVariantName[];
    /**
     * Drop straight into `RenderOption.font`. Styles with no data registered
     * fall back to the normal face, so text stays in the right family.
     */
    font: {
        regular: { name: string; style: string };
        bold: { name: string; style: string };
        italic: { name: string; style: string };
        boldItalic: { name: string; style: string };
    };
}

const VARIANT_ORDER: FontVariantName[] = [
    'normal',
    'bold',
    'italic',
    'bolditalic',
];

/**
 * Whether the document actually ended up with this family and style.
 *
 * jsPDF surfaces a malformed font through an internal event channel instead of
 * throwing, so registration can appear to succeed while leaving nothing usable
 * behind.
 */
const isRegistered = (
    doc: jsPDF,
    family: string,
    style: string,
): boolean => {
    const getFontList = (
        doc as unknown as { getFontList?: () => Record<string, string[]> }
    ).getFontList;
    if (typeof getFontList !== 'function') return true;
    try {
        const styles = getFontList.call(doc)?.[family];
        return Array.isArray(styles) && styles.includes(style);
    } catch {
        // If the list cannot be read, trust the call that did not throw.
        return true;
    }
};

/** Accepts either raw base64 or a `data:` URI, since both are common. */
const stripDataUri = (value: string): string => {
    const comma = value.indexOf(',');
    return value.startsWith('data:') && comma >= 0
        ? value.slice(comma + 1)
        : value;
};

export const registerFont = (
    doc: jsPDF,
    options: RegisterFontOptions,
): RegisteredFont => {
    const family = options?.family?.trim();
    if (!family) {
        throw new Error('[jspdf-md-renderer] registerFont: family is required');
    }

    const normalData = options?.variants?.normal;
    if (!normalData) {
        throw new Error(
            `[jspdf-md-renderer] registerFont: variants.normal is required for '${family}'. ` +
                'It is the face every other style falls back to.',
        );
    }

    const docWithVfs = doc as unknown as {
        addFileToVFS?: (name: string, data: string) => void;
        addFont?: (file: string, family: string, style: string) => void;
    };
    if (
        typeof docWithVfs.addFileToVFS !== 'function' ||
        typeof docWithVfs.addFont !== 'function'
    ) {
        throw new Error(
            '[jspdf-md-renderer] registerFont: this jsPDF build has no ' +
                'addFileToVFS/addFont, so custom fonts cannot be registered.',
        );
    }

    const warn =
        options.onWarning ??
        ((message: string) => console.warn(`[jspdf-md-renderer] ${message}`));

    const registered: FontVariantName[] = [];
    const missing: FontVariantName[] = [];

    for (const style of VARIANT_ORDER) {
        const raw = options.variants[style];
        if (!raw) {
            // `normal` is guaranteed above, so this is an optional face.
            missing.push(style);
            continue;
        }

        const fileName =
            options.fileNames?.[style] ?? `${family}-${style}.ttf`;

        try {
            docWithVfs.addFileToVFS(fileName, stripDataUri(raw));
            docWithVfs.addFont(fileName, family, style);

            // jsPDF reports a malformed font through its own event channel
            // rather than by throwing, so a try/catch alone would report
            // success for a face that was never usable. Confirm against the
            // document's font list instead.
            if (!isRegistered(doc, family, style)) {
                throw new Error(
                    'jsPDF did not accept the font data (it may be malformed ' +
                        'or missing a unicode cmap)',
                );
            }

            registered.push(style);
        } catch (error) {
            missing.push(style);
            warn(
                `registerFont: failed to register '${style}' for '${family}': ${String(error)}. ` +
                    'That style will fall back to the normal face.',
            );
        }
    }

    // One warning listing every gap, rather than one per style — registering a
    // family that only has a regular face is a legitimate thing to do, and
    // three separate warnings for it would be noise.
    if (missing.length > 0) {
        warn(
            `registerFont: '${family}' has no ${missing
                .map((m) => `'${m}'`)
                .join(', ')} variant. Those styles fall back to the normal face, ` +
                'so bold and italic text will not be visually distinct.',
        );
    }

    // A style with no data of its own must not select a face that was never
    // registered, or jsPDF silently substitutes a core font in another family.
    const styleOrNormal = (style: FontVariantName): string =>
        registered.includes(style) ? style : 'normal';

    return {
        family,
        registered,
        font: {
            regular: { name: family, style: 'normal' },
            bold: { name: family, style: styleOrNormal('bold') },
            italic: { name: family, style: styleOrNormal('italic') },
            boldItalic: { name: family, style: styleOrNormal('bolditalic') },
        },
    };
};
