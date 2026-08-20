#!/usr/bin/env bash
#
# Packs the library exactly as it would be published, installs the tarball into a
# throwaway project, and renders a document through every module format we
# advertise. Catches packaging regressions — missing files, broken "exports"
# subpaths, empty type declarations — that a source-tree test cannot see.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Packing"
TARBALL="$(cd "$ROOT" && npm pack --silent --pack-destination "$WORK")"
TARBALL="$WORK/$TARBALL"
echo "    $TARBALL"

echo "==> Declaration files must not be empty (regression guard for issue #60)"
tar -xzf "$TARBALL" -C "$WORK"
for dts in package/dist/index.d.ts package/dist/index.d.mts; do
    if [ ! -s "$WORK/$dts" ]; then
        echo "FAIL: $dts is missing or empty in the tarball" >&2
        exit 1
    fi
    if ! grep -q 'MdTextRender' "$WORK/$dts"; then
        echo "FAIL: $dts does not declare MdTextRender" >&2
        exit 1
    fi
done
echo "    ok"

echo "==> Installing tarball into a clean project"
cd "$WORK"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund "$TARBALL" jspdf jspdf-autotable marked >/dev/null

MD='# Smoke\n\nRendered **from the tarball** with a [link](https://example.com).\n\n- one\n- two\n'
OPTS='{
  cursor: { x: 10, y: 10 },
  page: { format: "a4", unit: "mm", orientation: "portrait", maxContentWidth: 190,
          maxContentHeight: 277, lineSpace: 3, defaultLineHeightFactor: 1.4,
          defaultFontSize: 11, defaultTitleFontSize: 14, topmargin: 10,
          xpading: 10, xmargin: 10, indent: 8 },
  font: { bold: { name: "helvetica", style: "bold" },
          regular: { name: "helvetica", style: "normal" },
          light: { name: "helvetica", style: "normal" } },
  endCursorYHandler: () => {},
}'

echo "==> CommonJS require()"
cat >cjs.cjs <<EOF
const { MdTextRender } = require('jspdf-md-renderer');
const { jsPDF } = require('jspdf');
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
MdTextRender(doc, "$MD", $OPTS).then(() => {
  const out = doc.output('arraybuffer');
  if (out.byteLength < 500) throw new Error('CJS produced a suspiciously small PDF');
  console.log('    ok — ' + out.byteLength + ' bytes');
});
EOF
node cjs.cjs

echo "==> ESM import"
cat >esm.mjs <<EOF
import { MdTextRender } from 'jspdf-md-renderer';
import { jsPDF } from 'jspdf';
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
await MdTextRender(doc, "$MD", $OPTS);
const out = doc.output('arraybuffer');
if (out.byteLength < 500) throw new Error('ESM produced a suspiciously small PDF');
console.log('    ok — ' + out.byteLength + ' bytes');
EOF
node esm.mjs

echo "==> UMD bundle parses and registers a global"
cat >umd.cjs <<EOF
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const file = path.join(process.cwd(), 'node_modules/jspdf-md-renderer/dist/index.umd.js');
const src = fs.readFileSync(file, 'utf8');
const sandbox = { module: undefined, exports: undefined, require, console,
                  jspdf: require('jspdf'), marked: require('marked'),
                  'jspdf-autotable': require('jspdf-autotable') };
sandbox.self = sandbox; sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
if (typeof sandbox.JspdfMdRenderer?.MdTextRender !== 'function') {
  throw new Error('UMD bundle did not expose JspdfMdRenderer.MdTextRender');
}
console.log('    ok — global JspdfMdRenderer.MdTextRender present');
EOF
node umd.cjs

echo
echo "All package smoke checks passed."
