import { RenderOption } from "@jspdf/md-renderer/types";
import { MdTextRender } from "@jspdf/md-renderer";
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
    const maxContentHeight = height - topmargin
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
    await MdTextRender(doc,mdString, options)

    doc.output("dataurlnewwindow");
}