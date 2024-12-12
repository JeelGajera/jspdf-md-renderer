import { RenderOption } from "@jspdf/md-renderer/types";
import { MdTextRender } from "@jspdf/md-renderer";
import jsPDF from "jspdf";

const mdString = `
# jspdf-md-renderer

A jsPDF utility to render Markdown directly into formatted PDFs with custom designs.
- list 1
- list 2
- list 3
`

export const pdfGenerator = async () => {
    const doc = new jsPDF({
        unit: 'mm',
        orientation: "p",
        putOnlyUsedFonts: true
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
    const maxContentHeight = height - topmargin
    const lineSpace = 6.2
    const defaultLineHeightFactor = 1.4
    const defaultFontSize = 11
    const defaultTitleFontSize = defaultFontSize + 2
    // const defaultSubTitleFontSize = defaultFontSize + 1
    const defaultHeadFontSize = 18
    // const toSetCurrPage = 1
    let y = topmargin
    doc.setCharSpace(0.2) // document char spacing


    doc.setDrawColor(248, 250, 252)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, width, 18, "FD")
    doc.setFontSize(defaultHeadFontSize)
    doc.setTextColor(151, 166, 186)
    const x = (maxLineWidth/2)+(doc.getTextWidth("Test Example")/2.5)
    doc.text("Test Example ", x, lineSpace*2, { align: "center" })
    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)
    doc.setFontSize(defaultFontSize)

    y += lineSpace
    const options: RenderOption = {
        cursor: {
            x: xpading,
            y: y
        },
        page: {
            defaultFontSize: defaultFontSize,
            defaultLineHeightFactor: defaultLineHeightFactor,
            defaultTitleFontSize: defaultTitleFontSize,
            indent: 4,
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
        pageBreakHandler: () => {}
    }
    await MdTextRender(doc,mdString, options)

    doc.output("dataurlnewwindow");
}