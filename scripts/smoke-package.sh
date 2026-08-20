#!/usr/bin/env bash
#
# Packs the library exactly as it would be published, installs the tarball into
# throwaway projects, and renders a document through every module format we
# advertise. Catches packaging regressions — missing files, broken "exports"
# subpaths, empty type declarations — that a source-tree test cannot see.
#
# The consumer projects are run against both ends of the declared peer range,
# because a peer range is a promise about what a consumer may already have
# installed, and a promise nothing exercises is a guess.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Packing"
TARBALL="$(cd "$ROOT" && npm pack --silent --pack-destination "$WORK")"
TARBALL="$WORK/$TARBALL"
tar -xzf "$TARBALL" -C "$WORK"
echo "    $TARBALL"

echo "==> Declaration files must not be empty (regression guard for issue #60)"
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

echo "==> Runtime deps are peers, not bundled dependencies"
node -e "
const p = require('$WORK/package/package.json');
const peers = p.peerDependencies || {};
for (const name of ['jspdf', 'jspdf-autotable', 'marked']) {
  if (!peers[name]) {
    console.error('FAIL: ' + name + ' is not declared as a peer dependency');
    process.exit(1);
  }
}
const runtime = Object.keys(p.dependencies || {});
if (runtime.length) {
  console.error('FAIL: expected no runtime dependencies, found ' + runtime.join(', '));
  process.exit(1);
}
console.log('    ok — ' + JSON.stringify(peers));
"

MD='# Smoke\n\nRendered **from the tarball** with a [link](https://example.com).\n\n- one\n- two\n'

# The legacy explicit-geometry configuration, which must keep working.
LEGACY_OPTS='{
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

# The minimal configuration introduced in 4.3.
MINIMAL_OPTS='{
  page: { margin: { top: 15, right: 15, bottom: 20, left: 15 } },
  font: { regular: { name: "helvetica", style: "normal" } },
  silent: true,
}'

# $1 label, $2 jspdf spec, $3 autotable spec, $4 directory suffix
run_consumer() {
    local label="$1" jspdf_spec="$2" autotable_spec="$3" dir="$WORK/consumer-$4"

    echo
    echo "==> Consumer with $label"
    mkdir -p "$dir"
    cd "$dir"
    npm init -y >/dev/null
    npm install --silent --no-audit --no-fund \
        "$TARBALL" "jspdf@$jspdf_spec" "jspdf-autotable@$autotable_spec" marked >/dev/null
    # Read package.json off disk: some packages restrict the "./package.json"
    # exports subpath, so require() of it is not portable.
    local ver
    ver=$(node -e "
      const fs = require('fs');
      const read = (n) => JSON.parse(
        fs.readFileSync('node_modules/' + n + '/package.json', 'utf8')
      ).version;
      console.log('jspdf ' + read('jspdf') + ', autotable ' + read('jspdf-autotable') + ', marked ' + read('marked'));
    ")
    echo "    resolved $ver"

    cat >cjs.cjs <<EOF
const { MdTextRender } = require('jspdf-md-renderer');
const { jsPDF } = require('jspdf');
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
MdTextRender(doc, "$MD", $LEGACY_OPTS).then((result) => {
  const out = doc.output('arraybuffer');
  if (out.byteLength < 500) throw new Error('CJS produced a suspiciously small PDF');
  if (typeof result.endY !== 'number') throw new Error('CJS render returned no result object');
  console.log('    CJS ok — ' + out.byteLength + ' bytes, endY ' + result.endY.toFixed(1));
});
EOF
    node cjs.cjs

    cat >esm.mjs <<EOF
import { MdTextRender, registerFont } from 'jspdf-md-renderer';
import { jsPDF } from 'jspdf';

if (typeof registerFont !== 'function') throw new Error('registerFont is not exported');

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const result = await MdTextRender(doc, "$MD", $MINIMAL_OPTS);
const out = doc.output('arraybuffer');
if (out.byteLength < 500) throw new Error('ESM produced a suspiciously small PDF');
if (result.warnings.length) throw new Error('unexpected warnings: ' + JSON.stringify(result.warnings));
if (result.pageCount !== 1) throw new Error('expected a single page, got ' + result.pageCount);
console.log('    ESM ok (minimal config) — ' + out.byteLength + ' bytes, ' + result.pageCount + ' page');
EOF
    node esm.mjs

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
console.log('    UMD ok — global JspdfMdRenderer.MdTextRender present');
EOF
    node umd.cjs
}

# Oldest and newest supported peers. Both are exercised by the unit suite too;
# this checks that a real consumer install resolves and runs.
run_consumer "oldest supported peers" "^2" "^3" old
run_consumer "newest supported peers" "^4" "^5" new

echo
echo "All package smoke checks passed."
