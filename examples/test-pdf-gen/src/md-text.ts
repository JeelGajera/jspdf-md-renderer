// export const mdString = "# jsPDF Markdown Renderer\r\n\r\nA jsPDF utility to render Markdown directly into formatted PDFs with custom designs.\r\n\r\n## Table of Contents\r\n\r\n- [Installation](#installation)\r\n- [Usage](#usage)\r\n- [API](#api)\r\n- [Examples](#examples)\r\n- [Contributing](#contributing)\r\n- [License](#license)\r\n\r\n## Installation\r\n\r\nTo install the library, you can use npm:\r\n\r\n```sh\r\nnpm install jspdf-md-renderer\r\n```\r\n\r\n## Usage\r\n\r\n### Basic Example\r\n\r\nHere is a basic example of how to use the library to generate a PDF from Markdown content:\r\n\r\n```ts\r\nimport { jsPDF } from 'jspdf';\r\nimport { MdTextRender } from 'jspdf-md-renderer';\r\n\r\nconst mdString = `\r\n# Main Title\r\n\r\nThis is a brief introduction paragraph. It sets the tone for the document and introduces the main topic in a concise manner.\r\n\r\n## Section 1: Overview\r\n\r\nHere is a medium-length paragraph that goes into more detail about the first section. It explains the context, provides background information, and sets up the discussion for the subsections.\r\n\r\n## Section 2: Lists and Examples\r\n\r\nThis section showcases how to create simple and nested lists.\r\n\r\n### Simple List\r\n\r\n- Item 1\r\n- Item 2\r\n- Item 3\r\n\r\n### Nested List\r\n\r\n1. First Level 1\r\n   - First Level 2\r\n     - First Level 3\r\n2. Second Level 1\r\n   - Second Level 2\r\n   - Another Second Level 2\r\n     - Nested deeper\r\n\r\n### Mixed List Example\r\n\r\n- Topic 1\r\n  1. Subtopic 1.1\r\n  2. Subtopic 1.2\r\n- Topic 2\r\n  - Subtopic 2.1\r\n  - Subtopic 2.2\r\n    1. Nested Subtopic 2.2.1\r\n    2. Nested Subtopic 2.2.2\r\n\r\n`;\r\n\r\nconst generatePDF = async () => {\r\n    const doc = new jsPDF({\r\n        unit: 'mm',\r\n        format: 'a4',\r\n        orientation: 'portrait',\r\n    });\r\n\r\n    const options = {\r\n        cursor: { x: 10, y: 10 },\r\n        page: {\r\n            format: 'a4',\r\n            unit: 'mm',\r\n            orientation: 'portrait',\r\n            maxContentWidth: 190,\r\n            maxContentHeight: 277,\r\n            lineSpace: 1.5,\r\n            defaultLineHeightFactor: 1.2,\r\n            defaultFontSize: 12,\r\n            defaultTitleFontSize: 14,\r\n            topmargin: 10,\r\n            xpading: 10,\r\n            xmargin: 10,\r\n            indent: 10,\r\n        },\r\n        font: {\r\n            bold: { name: 'helvetica', style: 'bold' },\r\n            regular: { name: 'helvetica', style: 'normal' },\r\n            light: { name: 'helvetica', style: 'light' },\r\n        },\r\n        endCursorYHandler: (y) => {\r\n            console.log('End cursor Y position:', y);\r\n        },\r\n    };\r\n\r\n    await MdTextRender(doc, mdString, options);\r\n    doc.save('example.pdf');\r\n};\r\n\r\ngeneratePDF();\r\n```\r\n\r\n## API\r\n\r\n### `MdTextRender`\r\n\r\nRenders parsed markdown text into a jsPDF document.\r\n\r\n#### Parameters\r\n\r\n- `doc`: The jsPDF document instance.\r\n- `text`: The markdown content to render.\r\n- `options`: The render options (fonts, page margins, etc.).\r\n\r\n### `MdTextParser`\r\n\r\nParses markdown into tokens and converts to a custom parsed structure.\r\n\r\n#### Parameters\r\n\r\n- `text`: The markdown content to parse.\r\n\r\n#### Returns\r\n\r\n- `Promise<ParsedElement[]>`: Parsed markdown elements.\r\n\r\n\r\n## Supported Markdown Elements\r\n\r\nThe following Markdown elements are currently supported by `jspdf-md-renderer`:\r\n\r\n- **Headings**: `#`, `##`, `###`, etc.\r\n- **Paragraphs**\r\n- **Lists**:\r\n  - Unordered lists: `-`, `*`, `+`\r\n  - Ordered lists: `1.`, `2.`, `3.`, etc.\r\n\r\n\r\n## Examples\r\n\r\nYou can find more examples in the [examples](examples/test-pdf-gen) directory.\r\n\r\n## Contributing\r\n\r\nContributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.\r\n\r\n## License\r\n\r\nThis project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.\r\n"
// export const mdString = "# Sample Markdown Document\n\n## Headings\n\n# Heading Level 1\n## Heading Level 2\n### Heading Level 3\n#### Heading Level 4\n##### Heading Level 5\n###### Heading Level 6\n\n---\n\n## Emphasis\n\n- *Italic* text using asterisks.\n- _Italic_ text using underscores.\n- **Bold** text using double asterisks.\n- __Bold__ text using double underscores.\n- ***Bold and Italic*** text using triple asterisks.\n\n---\n\n## Lists\n\n### Unordered List\n- Item 1\n  - Subitem 1.1\n  - Subitem 1.2\n- Item 2\n\n### Ordered List\n5. Item 1\n6. Item 2\n   7. Subitem 2.1\n   2. Subitem 2.2\n\n---\n\n## Links and Images\n\n[OpenAI](https://openai.com)\n\n![Sample Image](https://via.placeholder.com/150 \"Placeholder Image\")\n\n---\n\n## Code\n\n### Inline Code\nThis is `inline code`.\n\n### Code Block\n```javascript\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}\nconsole.log(greet('Markdown'));\n```"

export const mdString = `
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


`;
