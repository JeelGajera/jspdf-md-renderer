import jsPDF from 'jspdf';
import { ParsedElement } from './parsedElement';
import { ResolvedRenderOption } from './renderOption';
import type { RenderStore } from '../store/renderStore';

/**
 * Block renderers a caller can replace or decorate.
 *
 * Mirrors the hook model `jspdf-autotable` uses: rather than growing an option
 * for every conceivable visual tweak, hand the caller the drawing context and
 * let them solve their own edge cases without waiting for a release.
 */
export type ComponentName =
    | 'heading'
    | 'paragraph'
    | 'list'
    | 'listItem'
    | 'blockquote'
    | 'code'
    | 'table'
    | 'image'
    | 'hr';

/**
 * Everything an override needs to draw a block, plus the escape hatches back
 * into the built-in renderer.
 *
 * This shape is public API and is expensive to change, so it carries the
 * derived geometry an override would otherwise have to recompute — the indent
 * in document units, the left edge, and the width available for content.
 */
export interface ComponentContext {
    /** The document being drawn into. */
    doc: jsPDF;
    /** The element this renderer was invoked for. */
    element: ParsedElement;
    /** Nesting level: 0 at the top, incremented inside lists and blockquotes. */
    indentLevel: number;
    /** `indentLevel * page.indent`, in document units. */
    indent: number;
    /** Left edge for this block's content, in document units. */
    x: number;
    /** Current vertical position, in document units. */
    y: number;
    /** Width available to this block, already reduced by `indent`. */
    maxWidth: number;
    /** Cursor and page state. Advance `store.updateY` as you draw. */
    store: RenderStore;
    /** The fully resolved options for this render. */
    options: ResolvedRenderOption;

    /**
     * Runs the built-in renderer for this element.
     *
     * Call it to decorate rather than replace — draw a background, call
     * `next()`, draw an overlay. Calling it more than once is a no-op after the
     * first, so a decorator cannot accidentally draw the block twice.
     */
    next: () => void;

    /**
     * Renders an arbitrary element through the normal pipeline, including any
     * overrides. Use it to lay out a block's children.
     */
    render: (element: ParsedElement, indentLevel?: number) => void;
}

export type ComponentRenderer = (context: ComponentContext) => void;

/**
 * Per-block renderer overrides.
 *
 * An override that throws is reported as a `COMPONENT_OVERRIDE_FAILED` warning
 * and the built-in renderer runs instead, so a mistake in caller code degrades
 * to default output rather than losing the block or failing the render.
 */
export type ComponentOverrides = Partial<
    Record<ComponentName, ComponentRenderer>
>;
