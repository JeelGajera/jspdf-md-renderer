// src/renderer/components/heading.ts
import jsPDF from 'jspdf';
import { ParsedElement } from '../../types/parsedElement';
import { RenderStore } from '../../store/renderStore';
import { renderInlineContent, renderPlainText } from '../../layout';
import { getCharHight } from '../../utils/doc-helpers';
import { breakIfOverflow } from '../../utils/handlePageBreak';

const renderHeading = (
    doc: jsPDF,
    element: ParsedElement,
    indent: number,
    store: RenderStore,
) => {
    const savedColor = doc.getTextColor();
    const depth = element?.depth ?? 1;
    const headingKey = `h${depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    const fontSize =
        store.options.heading?.[headingKey] ??
        store.options.page.defaultFontSize;
    const headingColor =
        store.options.heading?.[`${headingKey}Color`] ??
        store.options.heading?.color ??
        '#000000';

    const savedSize = doc.getFontSize();
    doc.setFontSize(fontSize);
    doc.setFont(
        store.options.font.bold.name,
        store.options.font.bold.style || 'bold',
    );
    doc.setTextColor(headingColor);

    breakIfOverflow(doc, store, getCharHight(doc) * 1.8);

    const maxWidth = store.options.page.maxContentWidth - indent;

    if (element.items && element.items.length > 0) {
        renderInlineContent(
            doc,
            element.items,
            store.X + indent,
            store.Y,
            maxWidth,
            store,
            { alignment: 'left', trimLastLine: true },
        );
    } else {
        renderPlainText(
            doc,
            element?.content ?? '',
            store.X + indent,
            store.Y,
            maxWidth,
            store,
            { alignment: 'left', trimLastLine: true },
        );
    }

    const bottomSpacing =
        store.options.heading?.bottomSpacing ??
        store.options.spacing?.afterHeading ??
        2;
    store.updateY(bottomSpacing, 'add');

    doc.setFontSize(savedSize);
    doc.setFont(
        store.options.font.regular.name,
        store.options.font.regular.style,
    );
    doc.setTextColor(savedColor);
    store.updateX(store.options.page.xpading, 'set');
};

export default renderHeading;
