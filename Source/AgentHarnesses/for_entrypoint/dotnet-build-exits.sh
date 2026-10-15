#!/usr/bin/env bash
# Verifies the base image disables MSBuild node reuse and the build server, so `dotnet build` on a
# multi-project solution exits and releases its redirected output instead of hanging a reader.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DOCKERFILE="${HERE}/../Dockerfile.base"
failures=0
for setting in MSBUILDDISABLENODEREUSE=1 DOTNET_CLI_USE_MSBUILD_SERVER=0; do
    if awk '/^ENV / { inside = 1 } inside { print } inside && !/\\$/ { inside = 0 }' "$DOCKERFILE" | grep -qE "(^|[[:space:]])${setting}([[:space:]]|\\\\|$)"; then
        echo "  PASS: Dockerfile.base sets ${setting}"
    else
        echo "  FAIL: Dockerfile.base does not set ${setting}"
        failures=$((failures + 1))
    fi
done
echo "checked 2 settings"
[[ $failures -eq 0 ]] || { echo "FAILED ($failures)"; exit 1; }
