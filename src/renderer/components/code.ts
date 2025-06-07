import jsPDF from 'jspdf';
import { ParsedElement } from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hasRawBullet: boolean,
) => {
    const indent = indentLevel * RenderStore.options.page.indent;
    if (
        RenderStore.Y +
            doc.splitTextToSize(
                element.code ?? '',
                RenderStore.options.page.maxContentWidth - indent,
            ).length *
                getCharHight(doc) -
            2 * getCharHight(doc) >=
        RenderStore.options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, RenderStore.options);
    }

    const totalHeight =
        doc.splitTextToSize(
            element.code ?? '',
            RenderStore.options.page.maxContentWidth - indent,
        ).length * getCharHight(doc);
    RenderStore.updateY(RenderStore.options.page.lineSpace, 'add');
    doc.setFillColor('#EEEEEE');
    doc.setDrawColor('#eee');
    doc.roundedRect(
        RenderStore.X,
        RenderStore.Y - RenderStore.options.page.lineSpace,
        RenderStore.options.page.maxContentWidth,
        totalHeight,
        2,
        2,
        'FD',
    );
    doc.setFontSize(10);
    doc.text(
        element.lang ?? '',
        RenderStore.X +
            RenderStore.options.page.maxContentWidth -
            doc.getTextWidth(element.lang ?? '') -
            RenderStore.options.page.lineSpace / 2,
        RenderStore.Y,
    );
    doc.setFontSize(RenderStore.options.page.defaultFontSize);
    doc.text(element.code ?? '', RenderStore.X + 4, RenderStore.Y);

    RenderStore.updateY(totalHeight, 'add');
};

export default renderCodeBlock;
