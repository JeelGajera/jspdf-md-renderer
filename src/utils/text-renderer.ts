import jsPDF from 'jspdf';
import { RenderStore } from '../store/renderStore';
import { renderPlainText } from '../layout';

export class TextRenderer {
    /**
     * Renders text with automatic line wrapping and page breaking.
     * @param doc jsPDF instance
     * @param text Text to render
     * @param store RenderStore instance to use
     * @param x X coordinate (if not provided, uses store.X)
     * @param y Y coordinate (if not provided, uses store.Y)
     * @param maxWidth Max width for text wrapping
     * @param justify Whether to justify the text
     */
    static renderText(
        doc: jsPDF,
        text: string,
        store: RenderStore,
        x: number = store.X,
        y: number = store.Y,
        maxWidth: number,
        justify: boolean = false,
    ) {
        return renderPlainText(doc, text, x, y, maxWidth, store, {
            alignment: justify ? 'justify' : 'left',
        });
    }
}
