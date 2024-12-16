import { RenderOption } from "jspdf-md-renderer/types";
import { MdTextRender } from "jspdf-md-renderer";
import jsPDF from "jspdf";

const mdString = `
# Main Title

This is a brief introduction paragraph. It sets the tone for the document and introduces the main topic in a concise manner.

## Section 1: Overview

Here is a medium-length paragraph that goes into more detail about the first section. It explains the context, provides background information, and sets up the discussion for the subsections.

### Subsection 1.1: Details

A longer paragraph with detailed explanations about the subsection. This paragraph is significantly longer to showcase how text can expand on key ideas, provide examples, and explain technical concepts in a way that engages the reader. It includes a lot of descriptive content to fill out the space and make the information comprehensive.

#### Sub-subsection 1.1.1: Specifics

An even shorter paragraph. Sometimes, brevity is key.

## Section 2: Lists and Examples

This section showcases how to create simple and nested lists.

### Simple List

- Item 1
- Item 2
- Item 3

### Nested List

1. First Level 1
   - First Level 2
     - First Level 3
2. Second Level 1
   - Second Level 2
   - Another Second Level 2
     - Nested deeper

### Mixed List Example

- Topic 1
  1. Subtopic 1.1
  2. Subtopic 1.2
- Topic 2
  - Subtopic 2.1
  - Subtopic 2.2
    1. Nested Subtopic 2.2.1
    2. Nested Subtopic 2.2.2

## Section 3: Conclusion

Finally, we wrap up with a short paragraph that highlights the key takeaways and invites the reader to reflect on the content.
`

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