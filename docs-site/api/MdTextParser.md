---
title: MdTextParser
description: API reference for the MdTextParser function.
llm_summary: |
  MdTextParser(text: string): Promise<ParsedElement[]>
  Parses markdown into structured tokens. Uses marked lexer internally. Pre-processes image
  attribute blocks {width=N align=X} by encoding into URL fragments. Returns array of ParsedElement objects.
---

# MdTextParser

Parses raw Markdown into structured tokens that can be inspected or processed programmatically.

## Signature

```ts
function MdTextParser(text: string): Promise<ParsedElement[]>
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Raw Markdown content to parse |

## Return Value

Returns a `Promise<ParsedElement[]>` — an array of parsed elements representing the Markdown structure.

## `ParsedElement` Type

```ts
type ParsedElement = {
  type: string         // Token type (e.g., 'heading', 'paragraph', 'list')
  content?: string     // Text content
  depth?: number       // Heading depth (1-6)
  items?: ParsedElement[]  // Child elements
  ordered?: boolean    // Whether a list is ordered
  start?: number       // Start number for ordered lists
  lang?: string        // Code block language
  code?: string        // Code block content
  src?: string         // Image source URL
  alt?: string         // Image alt text
  href?: string        // Link URL
  text?: string        // Link text
  header?: ParsedElement[]   // Table header cells
  rows?: ParsedElement[][]   // Table body rows
  data?: string        // Raw data
  width?: number       // Image width (from attributes)
  height?: number      // Image height (from attributes)
  align?: 'left' | 'center' | 'right'  // Image alignment
  naturalWidth?: number    // Intrinsic image width (set during prefetch)
  naturalHeight?: number   // Intrinsic image height (set during prefetch)
}
```

## Usage

```ts
import { MdTextParser } from 'jspdf-md-renderer'

const elements = await MdTextParser(`
# Hello

This is a **paragraph** with *formatting*.

- Item 1
- Item 2
`)

console.log(elements)
// [
//   { type: 'heading', depth: 1, content: 'Hello', items: [...] },
//   { type: 'paragraph', content: '...', items: [...] },
//   { type: 'list', ordered: false, items: [...] },
// ]
```

## How It Works

1. **Pre-process** — image attribute blocks (`{width=200 align=center}`) are encoded into URL fragments
2. **Tokenize** — the markdown is parsed using `marked.lexer()` with GFM enabled
3. **Convert** — tokens are mapped to `ParsedElement` objects via type-specific handlers

::: info Advanced Usage
`MdTextParser` is useful for inspecting the parsed structure before rendering, or for building custom renderers on top of the token stream.
:::
