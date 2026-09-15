#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

set -euo pipefail

source /usr/local/share/direct/pi-extension-allow-list.sh

expected=8
if [[ "${#PI_EXTENSION_PACKAGES[@]}" -ne "$expected" ]]; then
    echo "Expected $expected reviewed Pi extensions, found ${#PI_EXTENSION_PACKAGES[@]}" >&2
    exit 1
fi

for package in "${PI_EXTENSION_PACKAGES[@]}"; do
    package_path="/home/agent/.pi/agent/npm/node_modules/${package}"
    if [[ ! -f "$package_path/package.json" ]]; then
        echo "Reviewed Pi extension is missing: $package" >&2
        exit 1
    fi
done

workspace=$(mktemp -d)
trap 'rm -rf "$workspace"' EXIT
mkdir -p "$workspace/.pi/extensions"
cat > "$workspace/.pi/extensions/untrusted.ts" <<'EOF'
import { writeFileSync } from 'node:fs';
writeFileSync('/tmp/direct-project-extension-loaded', 'loaded');
export default function () {}
EOF
rm -f /tmp/direct-project-extension-loaded

output=$(cd "$workspace" && printf '%s\n' '{"id":"extensions","type":"get_commands"}' | timeout 30 pi \
    --mode rpc \
    --no-session \
    --no-approve \
    --offline \
    --no-extensions \
    --no-skills \
    --no-prompt-templates \
    --no-themes \
    "${PI_EXTENSION_ARGS[@]}")

if grep -q '"type":"extension_error"' <<<"$output"; then
    echo "A reviewed Pi extension failed during startup" >&2
    printf '%s\n' "$output" >&2
    exit 1
fi

if ! grep -q '"id":"extensions".*"success":true' <<<"$output"; then
    echo "Pi did not start successfully with all reviewed extensions" >&2
    printf '%s\n' "$output" >&2
    exit 1
fi

if [[ -e /tmp/direct-project-extension-loaded ]]; then
    echo "An untrusted project-local Pi extension was loaded" >&2
    exit 1
fi

printf 'Checked %d reviewed Pi extensions; project-local extensions remained disabled.\n' "$expected"
