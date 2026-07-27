#!/usr/bin/env bash
#
# Fails when `@playwright/test` and the browsers nixpkgs ships have drifted
# apart.
#
# The e2e setup couples two things that nothing else keeps together: the
# browsers come from `playwright-driver.browsers` (see the `playwright` shell in
# flake.nix), which pins one set of browser revisions, and the npm package that
# drives them is pinned by hand to match. A routine `pnpm update -L`, or a bump
# of the nixpkgs branch in flake.lock, moves one side and not the other.
#
# The symptom is a launch failing with "Executable doesn't exist", which names
# neither the pin nor the flake and sends people to `playwright install` —
# which "fixes" it locally by fetching browsers from outside nix, and leaves CI
# broken. This check exists to say what actually happened instead.
#
# Run it directly, or as `pnpm check:playwright-pin`. CI runs it in
# .github/workflows/e2e-tests.yml before the suite, so the diagnosis arrives
# ahead of the failure it explains.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f node_modules/@playwright/test/package.json ]; then
  echo "@playwright/test is not installed — run 'pnpm install' first." >&2
  exit 1
fi

# The version actually on disk, not the spec: that is what would be driving the
# browsers, and with a range spec the two can differ.
installed=$(node -p "require('./node_modules/@playwright/test/package.json').version")
spec=$(node -p "require('./package.json').devDependencies['@playwright/test']")

# Read through the flake's own locked input rather than a branch name, so this
# cannot disagree with the browsers the shell would actually hand out. Pinning
# the branch here instead (`github:NixOS/nixpkgs/nixos-26.05#…`) would keep
# reporting success after flake.lock moved somewhere else.
driver=$(nix eval --raw --impure --expr \
  '(builtins.getFlake (toString ./.)).inputs.nixpkgs.legacyPackages.${builtins.currentSystem}.playwright-driver.version')

failed=false

# An exact spec is half of what makes the pin hold: with a caret, a plain
# `pnpm install` on a fresh clone can resolve to a newer package than the one
# the lockfile was written against, and the mismatch below arrives on someone
# else's machine rather than on the commit that caused it.
case "$spec" in
  [0-9]*)
    ;;
  *)
    echo "The @playwright/test spec is '$spec', which is a range, not a pin." >&2
    echo "Set it to an exact version (no ^ or ~) in package.json." >&2
    failed=true
    ;;
esac

if [ "$installed" != "$driver" ]; then
  echo "@playwright/test and the nixpkgs browsers have drifted apart:" >&2
  echo "  @playwright/test (installed): $installed" >&2
  echo "  playwright-driver (flake.lock): $driver" >&2
  echo >&2
  echo "Launching a browser will fail with \"Executable doesn't exist\"." >&2
  echo "Bring them back together with:" >&2
  echo >&2
  echo "  pnpm add -D @playwright/test@$driver" >&2
  echo >&2
  echo "or, to move the other side instead, update flake.lock and re-run this." >&2
  failed=true
fi

if [ "$failed" = true ]; then
  exit 1
fi

echo "@playwright/test $installed matches the nixpkgs playwright-driver."
