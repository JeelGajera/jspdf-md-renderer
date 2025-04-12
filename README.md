# jsPDF Markdown Renderer

A jsPDF utility to render Markdown directly into formatted PDFs with custom designs.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Installation

To install the library, you can use npm:

```sh
npm install jspdf-md-renderer
```

## Usage

### Basic Example

Here is a basic example of how to use the library to generate a PDF from Markdown content:

```ts
import { jsPDF } from 'jspdf';
import { MdTextRender } from 'jspdf-md-renderer';

const mdString = `
# Main Title

This is a brief introduction paragraph. It sets the tone for the document and introduces the main topic in a concise manner.

## Section 1: Overview

Here is a medium-length paragraph that goes into more detail about the first section. It explains the context, provides background information, and sets up the discussion for the subsections.

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

### Emphasis and Strong Emphasis
- *Italic* text using asterisks.
- _Italic_ text using underscores.
- **Bold** text using double asterisks.
- __Bold__ text using double underscores.
- ***Bold and Italic*** text using triple asterisks.
- ___Bold and Italic___ text using triple underscores.

`;

const generatePDF = async () => {
    const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
    });

    const options = {
        cursor: { x: 10, y: 10 },
        page: {
            format: 'a4',
            unit: 'mm',
            orientation: 'portrait',
            maxContentWidth: 190,
            maxContentHeight: 277,
            lineSpace: 1.5,
            defaultLineHeightFactor: 1.2,
            defaultFontSize: 12,
            defaultTitleFontSize: 14,
            topmargin: 10,
            xpading: 10,
            xmargin: 10,
            indent: 10,
        },
        font: {
            bold: { name: 'helvetica', style: 'bold' },
            regular: { name: 'helvetica', style: 'normal' },
            light: { name: 'helvetica', style: 'light' },
        },
        endCursorYHandler: (y) => {
            console.log('End cursor Y position:', y);
        },
    };

    await MdTextRender(doc, mdString, options);
    doc.save('example.pdf');
};

generatePDF();
```

## API

### `MdTextRender`

Renders parsed markdown text into a jsPDF document.

#### Parameters

- `doc`: The jsPDF document instance.
- `text`: The markdown content to render.
- `options`: The render options (fonts, page margins, etc.).

### `MdTextParser`

Parses markdown into tokens and converts to a custom parsed structure.

#### Parameters

- `text`: The markdown content to parse.

#### Returns

- `Promise<ParsedElement[]>`: Parsed markdown elements.

## Supported Markdown Elements

The following Markdown elements are currently supported by `jspdf-md-renderer`:

### Already Implemented:
- **Headings**: `#`, `##`, `###`, etc.
- **Paragraphs**
- **Lists**:
    - Unordered lists: `-`, `*`, `+`
    - Ordered lists: `1.`, `2.`, `3.`, etc.
- **Horizontal Rules**: `---`, `***`, `___`
- **Text Styles**:
    - Bold: `**bold**` or `__bold__`
    - Italic: `*italic*` or `_italic_`
    - Bold Italic: `***bold italic***` or `___bold italic___`
- **Code Blocks** (fenced and indented):
    ````markdown
    ```js
    console.log('Hello, world!');
    ```
    ````

### Proposed for Future Implementation:
- **Blockquotes**:
    ```markdown
    > This is a blockquote.
    ```
- **Images**:
    ```markdown
    ![Alt text](https://example.com/image.png)
    ```
- **Links**:
    ```markdown
    [GitHub](https://github.com)
    ```
- **Inline Code**:
    ```markdown
    This is an `inline code` example.
    ```
- **Tables**:
    ```markdown
    | Header 1 | Header 2 | Header 3 |
    | -------- | -------- | -------- |
    | Row 1    | Data     | Value    |
    | Row 2    | Data     | Value    |
    ```

## Examples

Output of above basic Example => [Sample Generated PDF](examples/test-pdf-gen/markdown_rendering_example.pdf)
You can find more examples in the [examples](examples/test-pdf-gen) directory.

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
