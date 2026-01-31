import { jsPDF } from 'jspdf';
import { ParsedElement } from '../../types';
import { RenderStore } from '../../store/renderStore';

const renderImage = (
    doc: jsPDF,
    element: ParsedElement,
    indentLevel: number,
) => {
    if (!element.data) {
        return;
    }

    const options = RenderStore.options;
    const currentX = RenderStore.X + indentLevel * options.page.indent;
    let currentY = RenderStore.Y;

    // Check available width
    const maxWidth =
        options.page.maxContentWidth - indentLevel * options.page.indent;

    try {
        const props = doc.getImageProperties(element.data);
        const imgWidth = props.width;
        const imgHeight = props.height;

        // Calculate scaled dimensions to fit maxWidth
        let finalWidth = imgWidth;
        let finalHeight = imgHeight;

        const aspectRatio = imgWidth / imgHeight;

        // We can restrict max width to the page content width
        if (finalWidth > 0) {
            finalWidth = maxWidth;
            finalHeight = finalWidth / aspectRatio;
        }

        // Check for page break
        if (currentY + finalHeight > options.page.maxContentHeight) {
            doc.addPage();
            currentY = options.page.topmargin;
            RenderStore.updateY(currentY);
        }

        // Detect format from data URI or extension
        let imgFormat = element.src?.split('.').pop()?.toUpperCase() || 'JPEG';
        if (element.data.startsWith('data:image/png')) imgFormat = 'PNG';
        else if (
            element.data.startsWith('data:image/jpeg') ||
            element.data.startsWith('data:image/jpg')
        )
            imgFormat = 'JPEG';
        else if (element.data.startsWith('data:image/webp')) imgFormat = 'WEBP';

        doc.addImage(
            element.data,
            imgFormat,
            currentX,
            currentY,
            finalWidth,
            finalHeight,
        );

        RenderStore.updateY(finalHeight, 'add');
        RenderStore.recordContentY();
    } catch (e) {
        console.warn('Failed to render image', e);
    }
};

export default renderImage;
