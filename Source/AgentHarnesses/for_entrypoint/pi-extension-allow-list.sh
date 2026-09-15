#!/usr/bin/env bash
# Verifies the Pi worker's reviewed extension boundary without requiring an image build.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${HERE}/.."
# shellcheck source=/dev/null
source "${ROOT}/pi-extensions/allow-list.sh"

expected=8
[[ "${#PI_EXTENSION_PACKAGES[@]}" -eq "$expected" ]] || {
    echo "Expected ${expected} reviewed Pi extensions, found ${#PI_EXTENSION_PACKAGES[@]}" >&2
    exit 1
}

for package in "${PI_EXTENSION_PACKAGES[@]}"; do
    version=$(jq -r --arg package "$package" '.dependencies[$package] // empty' "${ROOT}/pi-extensions/package.json")
    [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
        echo "Pi extension ${package} is absent or not pinned exactly" >&2
        exit 1
    }
    expected_path="/home/agent/.pi/agent/npm/node_modules/${package}"
    [[ " ${PI_EXTENSION_ARGS[*]} " == *" ${expected_path} "* ]] || {
        echo "Pi extension ${package} is installed but not explicitly loaded" >&2
        exit 1
    }
done

grep -Fq -- '--no-extensions' "${ROOT}/entrypoint.sh"
grep -Fq -- '"${PI_EXTENSION_ARGS[@]}"' "${ROOT}/entrypoint.sh"

printf 'Checked %d pinned Pi extensions and the explicit entrypoint allow-list.\n' "$expected"
