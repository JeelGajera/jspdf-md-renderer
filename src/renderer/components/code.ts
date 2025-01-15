import jsPDF from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderOption } from '../../types';
import { HandlePageBreaks } from '../../utils/handlePageBreak';
import { getCharHight } from '../../utils/doc-helpers';

const renderCodeBlock = (
    doc: jsPDF,
    element: ParsedElement,
    x: number,
    y: number,
    indentLevel: number,
    hasRawBullet: boolean,
    options: RenderOption,
): number => {
    const indent = indentLevel * options.page.indent;
    if (
        y +
            doc.splitTextToSize(
                element.code ?? '',
                options.page.maxContentWidth - indent,
            ).length *
                getCharHight(doc, options) -
            2 * getCharHight(doc, options) >=
        options.page.maxContentHeight
    ) {
        HandlePageBreaks(doc, options);
        y = options.page.topmargin;
    }

    const totalHeight = doc.splitTextToSize(
        element.code ?? '',
        options.page.maxContentWidth - indent,
    ).length * getCharHight(doc, options) ;
    y+=options.page.lineSpace
    doc.setFillColor("#EEEEEE")
    doc.setDrawColor('#eee')
    doc.roundedRect(x,y-options.page.lineSpace,options.page.maxContentWidth,totalHeight,2,2,"FD")
    // doc.rect(x,y-options.page.lineSpace,options.page.maxContentWidth,totalHeight,"F")
    // doc.setTextColor('#')
    doc.setFontSize(10)
    doc.text(element.lang??'',x+options.page.maxContentWidth-doc.getTextWidth(element.lang??'')-options.page.lineSpace/2,y)
    doc.setFontSize(options.page.defaultFontSize)
    // y+=options.page.lineSpace
    doc.text(element.code ?? '', x+4, y);

    y += totalHeight
    return y;
};

export default renderCodeBlock;
