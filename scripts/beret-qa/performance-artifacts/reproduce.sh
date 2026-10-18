#!/usr/bin/env bash
set -euo pipefail
# Set ROOT to the directory containing sidekick-fixed-accessories and sidekick-beret-baseline.
: "${SIDEKICK_BENCH_ROOT:?Set SIDEKICK_BENCH_ROOT to the parent of both repository checkouts}"
export SIDEKICK_BENCH_ROOT
here=$(cd "$(dirname "$0")" && pwd)
export SIDEKICK_BENCH_OUTPUT=${SIDEKICK_BENCH_OUTPUT:-"$here/rerun"}
mkdir -p "$SIDEKICK_BENCH_OUTPUT"
loader="$SIDEKICK_BENCH_ROOT/sidekick-fixed-accessories/node_modules/tsx/dist/loader.mjs"
for item in '1 baseline' '2 candidate' '3 candidate' '4 baseline'; do
 read -r seq variant <<< "$item"
 node --import "$loader" "$here/benchmark-abba.mjs" "$variant" "$seq" > "$SIDEKICK_BENCH_OUTPUT/abba-$seq-$variant.log"
done
node --import "$loader" "$here/cached-cold-counts.mjs" > "$SIDEKICK_BENCH_OUTPUT/cached-cold-counts.log"
