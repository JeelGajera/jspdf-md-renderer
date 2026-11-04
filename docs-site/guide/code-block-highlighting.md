---
title: Code Block Highlighting
description: Colour code block tokens with a synchronous highlight hook while the built-in renderer keeps the layout.
llm_summary: |
  codeBlock.highlight(code, lang) returns one array of { text, color } runs per source line.
  The renderer keeps the background box, padding, language label, wrapping and page breaking, and
  draws each run in its colour. Works with any synchronous highlighter; includes a self-contained
  recipe and notes on adapting highlight.js / Shiki output.
---

# Code Block Highlighting

Code blocks render in a single text colour by default. If you want syntax
colours, you do not need a [component override](/guide/component-overrides):
the `codeBlock.highlight` hook lets you colour tokens while the built-in
renderer keeps doing the layout — background box, padding, language label,
line wrapping, and page breaking.

The hook must be **synchronous**, like the renderers themselves, and the
library stays dependency-free: you convert your highlighter's output into
runs in your own code.

## The hook

```ts
import type { RenderOption } from 'jspdf-md-renderer'

const options: RenderOption = {
  codeBlock: {
    // One array of coloured runs per source line of code
    highlight: (code, lang) => {
      return code.split('\n').map((line) => [
        { text: line }, // no colour → codeBlock.textColor (default '#000000')
      ])
    },
  },
}
```

- `code` is the block's code with tabs already expanded and trailing
  whitespace trimmed.
- `lang` is the info string (`` ```js `` → `'js'`), or `undefined` when the
  fence has none.
- Return one array of `{ text, color }` runs per source line. A run's `color`
  is any value `jsPDF.setTextColor` accepts; omitting it renders the run in
  `codeBlock.textColor`.
- A long source line still wraps, and each wrapped fragment keeps the colour
  of the run it came from. Blocks still span pages.
- A hook that throws, returns the wrong number of lines, or whose runs do not
  tile their source line is ignored for the affected lines — with a
  `CODE_HIGHLIGHT_FAILED` warning — and those lines render in the default
  text colour. A bad hook never drops or duplicates text.
- Without the hook, output is byte-identical to the unhighlighted render.

## Recipe: a self-contained keyword highlighter

```ts
import { jsPDF } from 'jspdf'
import { MdTextRender, type RenderOption } from 'jspdf-md-renderer'

const KEYWORDS = new Set(['const', 'let', 'function', 'return', 'if', 'else'])

const highlightKeywords = (code: string) =>
  code.split('\n').map((line) => {
    const runs: Array<{ text: string; color?: string }> = []
    for (const match of line.matchAll(/(\w+)|(\W+)/g)) {
      const [token, word] = match
      runs.push({
        text: token,
        color: word && KEYWORDS.has(word) ? '#CF222E' : undefined,
      })
    }
    return runs
  })

const doc = new jsPDF({ unit: 'mm', format: 'a4' })

const options: RenderOption = {
  page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
  font: { regular: { name: 'helvetica', style: 'normal' } },
  codeBlock: { highlight: (code) => highlightKeywords(code) },
}

const result = await MdTextRender(
  doc,
  '```js\nconst answer = 42\n```',
  options,
)
doc.save('highlighted.pdf')
```

## Adapting a real highlighter

With [highlight.js](https://highlightjs.org/), convert the emitted spans to
runs — the walk below turns `hljs.highlight` output into the runs the hook
expects:

```ts
import hljs from 'highlight.js'

const highlightWithHljs = (code: string, lang?: string) => {
  const runs: Array<{ text: string; color?: string }> = []
  const html = lang
    ? hljs.highlight(code, { language: lang }).value
    : hljs.highlightAuto(code).value
  // html is a string of <span class="hljs-…">…</span> fragments; walk it,
  // mapping each hljs-* class to your palette and pushing { text, color }.
  return [runs] // one array per source line — split on newlines first
}
```

The same shape works for Shiki's `codeToHast` tokens or any other
highlighter: split the code into lines, then emit runs that tile each line's
text exactly.
