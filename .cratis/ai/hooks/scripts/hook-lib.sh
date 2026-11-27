#!/usr/bin/env bash
# Shared helpers for the Cratis enforcement hooks.
#
# Sourced by cratis-guard-secrets.sh, cratis-guard-writes.sh, cratis-guard-store-mutations.sh,
# cratis-guard-shell-writes.sh and cratis-quality-gate.sh.
# Portable: bash 3.2 (macOS system bash) and up, BSD + GNU userland. No GNU-only flags,
# no `mapfile`/`readarray`, no associative arrays, no `eval`.
set -euo pipefail

# ── Environment ───────────────────────────────────────────────────────────────

# Root of the repository the hook is running for.
#
# The fallback walks up from this script, which is installed at
# <root>/.cratis/ai/hooks/scripts/hook-lib.sh - four levels, not three. Three landed on
# <root>/.cratis, so without CLAUDE_PROJECT_DIR every hook read a repository whose git
# directory, tracked files and project files were all missing, and silently did nothing.
hook_repo_root() {
    local d="${CLAUDE_PROJECT_DIR:-}"
    if [ -n "$d" ] && [ -d "$d" ]; then
        (cd "$d" && pwd)
        return 0
    fi
    (cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)
}

# True when the named command is on PATH.
hook_have() {
    command -v "$1" >/dev/null 2>&1
}

# Read all of stdin. Never fails on an empty pipe.
hook_read_stdin() {
    cat 2>/dev/null || true
}

# Shared installation hint, without a trailing newline so guards can append their warning.
hook_jq_install_hint() {
    printf 'Stop and ask the user to install jq (macOS: brew install jq; Debian/Ubuntu: sudo apt-get install jq;\n'
    printf 'Windows: winget install jqlang.jq), then retry.'
}

# Refuse the tool call when jq is missing: $1 is the guard name, $2 the variable that lets a person run without it.
# A guard that cannot read the tool call cannot check it, so this ends the sourcing script with exit 2
# (the deny signal every wired harness honors). It uses only builtins, so it works without jq.
hook_require_jq() {
    hook_have jq && return 0
    {
        printf 'BLOCKED by %s: jq is not installed, so this guard cannot read the tool call and refuses every call until it is.\n' "$1"
        hook_jq_install_hint
        printf ' Do not work around the guard.\n'
        printf 'A person who accepts running without this guard sets %s=1 in the environment the agent\n' "$2"
        printf 'harness was started from; setting it inside the command has no effect.\n'
    } >&2
    exit 2
}

# Extract a single scalar from a JSON document on $1 using the jq path in $2.
# Prints the empty string when jq is absent, the JSON is malformed, or the path is null.
hook_json() {
    local json="$1" path="$2"
    hook_have jq || return 0
    printf '%s' "$json" | jq -r "$path // empty" 2>/dev/null || true
}

# ── Paths ─────────────────────────────────────────────────────────────────────

# Absolutize $1 against $2 (a directory), leaving already-absolute paths untouched.
hook_abspath() {
    local p="$1" base="${2:-$PWD}"
    case "$p" in
        /*) printf '%s\n' "$p" ;;
        *) printf '%s\n' "${base%/}/$p" ;;
    esac
}

# Make $1 relative to the root $2 when it lives underneath it.
hook_relpath() {
    local p="$1" r="${2%/}"
    case "$p" in
        "$r"/*) printf '%s\n' "${p#"$r"/}" ;;
        *) printf '%s\n' "$p" ;;
    esac
}

# Glob dialect (gitignore/minimatch-like, matched against a repo-relative path):
#   **/   any number of leading directories (including none)
#   **    any characters, directory separators included
#   *     any characters except /
#   ?     one character except /
#
# The conversion is an awk source fragment that sourcing scripts prepend to their own awk
# programs, so every matcher converts globs the same way.
# shellcheck disable=SC2034
hook_glob_awk_lib='
        function g2re(g,    out, i, n, c, c2, c3) {
            out = "^"; n = length(g)
            for (i = 1; i <= n; i++) {
                c = substr(g, i, 1)
                if (c == "*") {
                    c2 = substr(g, i + 1, 1); c3 = substr(g, i + 2, 1)
                    if (c2 == "*" && c3 == "/") { out = out "(.*/)?"; i += 2 }
                    else if (c2 == "*")         { out = out ".*";     i += 1 }
                    else                        { out = out "[^/]*" }
                } else if (c == "?") {
                    out = out "[^/]"
                } else if (index(".[]()+^$\\{}|", c) > 0) {
                    out = out "\\" c
                } else {
                    out = out c
                }
            }
            return out "$"
        }
'

# ── Session state ─────────────────────────────────────────────────────────────

# Per-session scratch directory. Session ids are
# sanitized so a hostile value cannot escape the scratch root.
hook_state_dir() {
    local session="${1:-nosession}" base
    session="$(printf '%s' "$session" | tr -c 'A-Za-z0-9._-' '_')"
    [ -n "$session" ] || session="nosession"
    base="${TMPDIR:-/tmp}"
    base="${base%/}/cratis-hooks/$session"
    mkdir -p "$base" 2>/dev/null || return 1
    printf '%s\n' "$base"
}
