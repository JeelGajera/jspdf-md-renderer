import { MdTextRender, RenderOption } from "jspdf-md-renderer";
import jsPDF from "jspdf";
import { mdString } from "./md-text";

export const pdfGenerator = async () => {
    const doc = new jsPDF({
        unit: 'mm',
        orientation: "p",
        format: "a4",
        putOnlyUsedFonts: true,
        hotfixes: ["px_scaling"],
        userUnit: 96
    });

    // A4 PAGE SIZE 210 x 297 mm 
    // DEFAULT Page Config
    const width = 210
    const height = 297
    const xmargin = 8
    const topmargin = height * 0.1
    // const toppading = height * 0.05
    const xpading = 15
    const maxLineWidth = width - (2 * xpading)
    const maxContentHeight = height
    const lineSpace = 6.2
    const defaultIndent = 8;
    const defaultLineHeightFactor = 1.4
    const defaultFontSize = 11
    const defaultTitleFontSize = defaultFontSize + 2
    // const defaultSubTitleFontSize = defaultFontSize + 1
    const defaultHeadFontSize = 18
    // const toSetCurrPage = 1
    let y = topmargin
    doc.setCharSpace(0.2) // document char spacing


    doc.setFillColor('#EEEEEE')
    doc.setDrawColor('#686D76');
    doc.rect(0, 0, width, 18, "F")
    doc.setFontSize(defaultHeadFontSize)
    doc.setTextColor(151, 166, 186)
    doc.text("Sample Markdown Rendering Example", xpading, lineSpace*2, { align: "left" })
    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)
    doc.setFontSize(defaultFontSize)

    const options: RenderOption = {
        cursor: {
            x: xpading,
            y: y
        },
        page: {
            format: "a4",
            orientation: "p",
            defaultFontSize: defaultFontSize,
            defaultLineHeightFactor: defaultLineHeightFactor,
            defaultTitleFontSize: defaultTitleFontSize,
            indent: defaultIndent,
            lineSpace: lineSpace,
            maxContentHeight: maxContentHeight,
            maxContentWidth: maxLineWidth,
            topmargin: topmargin,
            xmargin: xmargin,
            xpading: xpading
        },
        endCursorYHandler: (endY) => { y = endY; },
        font: {
            bold: {
                name: "",
                style: ""
            },
            regular: {
                name: "",
                style: ""
            },
            light: {
                name: "",
                style: ""
            }
        },
    }
    await MdTextRender(doc, mdString, options)
    

    const footerY = Math.min(y + 10, height - 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(
        "Contribute to this project and learn more on GitHub:",
        xpading,
        footerY
    );
    doc.setTextColor(0, 0, 255);
    doc.textWithLink(
        "https://github.com/JeelGajera/jspdf-md-renderer",
        xpading,
        footerY + 6,
        { url: "https://github.com/JeelGajera/jspdf-md-renderer" }
    );

    doc.setProperties({
        title: "Markdown Rendering Example PDF",
        subject: "Markdown to PDF Example",
        author: "Jeel Gajera",
        keywords: "Markdown, jsPDF, PDF generation, example",
        creator: "jsPDF and Custom Renderer"
    });

    doc.output("dataurlnewwindow");
    // const filename = "markdown_rendering_example.pdf";
    // doc.save(filename);
}