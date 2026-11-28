#!/usr/bin/env bash
# PostToolUse hook (Write|Edit|MultiEdit|NotebookEdit): advisory pattern pass over the file just written.
#
# Runs the patterns in cratis-patterns.json against that one file and adds a reminder to context on a
# match. It never blocks (always exits 0), costs no tokens until something matches, and reports each
# pattern once per file per session. A match is a text match, not a build result.
#
# CRATIS_HOOKS_SKIP_SCAN=1 turns the pass off. CRATIS_HOOKS_PATTERNS=<path> replaces the pattern file.
set -euo pipefail

# shellcheck source=SCRIPTDIR/hook-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/hook-lib.sh"

[ "${CRATIS_HOOKS_SKIP_SCAN:-0}" = "1" ] && exit 0
hook_have jq || exit 0
input="$(hook_read_stdin)"
[ -n "$input" ] || exit 0

root="$(hook_repo_root)"
cwd="$(hook_json "$input" '.cwd')"
file="$(hook_json "$input" '.tool_input.file_path // .tool_input.notebook_path')"
[ -n "$file" ] || exit 0
file="$(hook_abspath "$file" "${cwd:-$root}")"
[ -f "$file" ] || exit 0

# Text files up to 2 MB only: this hook must stay cheap.
LC_ALL=C grep -Iq . "$file" 2>/dev/null || exit 0
[ "$(wc -c <"$file")" -le 2000000 ] || exit 0

rel="$(hook_relpath "$file" "$root")"
patterns="${CRATIS_HOOKS_PATTERNS:-$(dirname "${BASH_SOURCE[0]}")/cratis-patterns.json}"
[ -f "$patterns" ] || exit 0
state="$(hook_state_dir "$(hook_json "$input" '.session_id')")" || exit 0
seen="$state/pattern-scan.seen"

# Comment lines are dropped and the rest joined, so a pattern can span a wrapped parameter list.
code="$(LC_ALL=C grep -Ev '^[[:space:]]*(//|/\*|\*)' "$file" | tr '\n' ' ' || true)"

findings=""
while IFS=$'\037' read -r id files exclude pattern requires absent message; do
    [ -n "$id" ] || continue
    [[ $rel =~ $files ]] || continue
    if [ -n "$exclude" ] && [[ $rel =~ $exclude ]]; then continue; fi
    LC_ALL=C grep -Eq -- "$pattern" <<<"$code" || continue
    if [ -n "$requires" ] && ! LC_ALL=C grep -Eq -- "$requires" <<<"$code"; then continue; fi
    if [ -n "$absent" ] && LC_ALL=C grep -Eq -- "$absent" <<<"$code"; then continue; fi
    if grep -qxF -- "$id $rel" "$seen" 2>/dev/null; then continue; fi
    printf '%s\n' "$id $rel" >>"$seen"
    findings="${findings}${rel}: ${message}"$'\n'
done < <(jq -r '.patterns[] | select(.enabled != false)
    | [.id, .files, (.exclude // ""), .pattern, (.requires // ""), (.absent // ""), .message]
    | join("\u001f")' "$patterns" 2>/dev/null || true)

[ -n "$findings" ] || exit 0
jq -n --arg ctx "Cratis pattern check on the file you just edited (advisory text match, not a build):
$findings" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
exit 0
