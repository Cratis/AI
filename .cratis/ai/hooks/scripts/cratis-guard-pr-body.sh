#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# PreToolUse (Bash): release-note bodies are checked before gh pr create/edit.
# Node reads the hook JSON and tokenizes literal shell arguments without executing them.
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
    printf 'Warning: unchecked pull-request body: node is unavailable.\n' >&2
    exit 0
fi
status=0
node "$(dirname "${BASH_SOURCE[0]}")/cratis-check-pr.mjs" --hook || status=$?
# Unexpected runtime failures are not an allow verdict. Only the checker handles the
# documented offline/no-cache pass-through; its hook mode translates violations to 2.
if [ "$status" -ne 0 ]; then
    exit 2
fi
