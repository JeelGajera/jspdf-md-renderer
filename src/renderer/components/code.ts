import jsPDF from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderOption } from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';
import { RenderStore } from '../../store/renderStore';

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
    hasRawBullet: boolean,
    options: RenderOption,
) => {
    const indent = indentLevel * options.page.indent;
    if (
        RenderStore.Y +
        doc.splitTextToSize(
            element.code ?? '',
            options.page.maxContentWidth - indent,
        ).length *
        getCharHight(doc, options) -
        2 * getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        RenderStore.updateY(options.page.topmargin);
    }

    const totalHeight =
        doc.splitTextToSize(
            element.code ?? '',
            options.page.maxContentWidth - indent,
        ).length * getCharHight(doc, options);
    RenderStore.updateY(options.page.lineSpace, 'add');
    doc.setFillColor('#EEEEEE');
    doc.setDrawColor('#eee');
    doc.roundedRect(
        RenderStore.X,
        RenderStore.Y - options.page.lineSpace,
        options.page.maxContentWidth,
        totalHeight,
        2,
        2,
        'FD',
    );
    doc.setFontSize(10);
    doc.text(
        element.lang ?? '',
        RenderStore.X +
        options.page.maxContentWidth -
        doc.getTextWidth(element.lang ?? '') -
        options.page.lineSpace / 2,
        RenderStore.Y,
    );
    doc.setFontSize(options.page.defaultFontSize);
    doc.text(element.code ?? '', RenderStore.X + 4, RenderStore.Y);

    RenderStore.updateY(totalHeight, 'add');
};

export default renderCodeBlock;
