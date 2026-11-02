#!/usr/bin/env bash
# PreToolUse hook (Bash) — hard block on shell commands that print credentials into the transcript.
#
# secrets.md says a credential must never enter an agent transcript, and lists the command classes that
# print one: full Kubernetes specs and secrets, the process environment, container inspection, secret-manager
# reads and credential files. The parser accepts a closed subset of literal simple commands, lists, pipelines,
# subshells, quoted parameters/substitutions and literal heredocs. It refuses arithmetic, backticks, shell state
# builtins and every unmodeled grammar or invocation form. Executable children, supported shell -c programs and
# transparent carrier payloads all go through the same invocation/effect classifier; quoted inert prose is data.
# Exit 2 blocks the tool call and sends stderr back to the model; a clean command exits 0 with no output. The guard
# fails closed: missing jq or node, a missing helper, empty, malformed, multi-document or wrongly typed input, a NUL
# in the command, and syntax the parser cannot analyze safely all exit 2 with an actionable diagnostic.
#
# The parsing and classification live in cratis-shell-parser.mjs and cratis-guard-secrets.mjs; this script validates
# the hook input and hands the command to them on stdin.
#
# It sees only submitted command text. Credential-shaped parameter names block; other computed operands require
# a positive data-only schema. Literal script files, explicit repository tasks, unknown ordinary executables,
# inherited tool configuration and recursive searches without a named file are outside source inspection.
# Data projections are not proof of absence of data access. This is neither a sandbox nor an executable allowlist.
# A redirect exempts nothing: `env > f` is blocked like `env`. See .cratis/ai/hooks/README.md.
#
# Escape hatch for a human who authorized the read — set in the environment the agent harness was started
# from, never inside the command (an assignment in the command is ignored):
#   CRATIS_HOOKS_ALLOW_SECRET_READS=1
set -euo pipefail

# SCRIPTDIR, not a path relative to the caller: shellcheck resolves a plain relative `source=`
# against the current working directory, and these hooks are linted from wherever CI happens to run.
script_directory="${BASH_SOURCE[0]%/*}"
[ "$script_directory" != "${BASH_SOURCE[0]}" ] || script_directory=.

# The human launch-environment opt-out needs nothing from the helper library.
[ "${CRATIS_HOOKS_ALLOW_SECRET_READS:-0}" = "1" ] && exit 0

# A guard whose helper library is missing or unloadable cannot protect anything: refuse with a fixed message
# (exit 2), never the shell's own exit 1 from a failed source.
if [ ! -f "$script_directory/hook-lib.sh" ]; then
    printf '%s\n' 'BLOCKED by cratis-guard-secrets: a guard helper file is missing (hook-lib.sh). Use instead: run cratis ai update to restore the managed hooks; do not work around the guard.' >&2
    exit 2
fi
# shellcheck source=SCRIPTDIR/hook-lib.sh
if ! . "$script_directory/hook-lib.sh"; then
    printf '%s\n' 'BLOCKED by cratis-guard-secrets: a guard helper file could not be loaded (hook-lib.sh). Use instead: run cratis ai update to restore the managed hooks; do not work around the guard.' >&2
    exit 2
fi

guard=cratis-guard-secrets
hook_have jq || hook_refuse_input "$guard" 'jq is not installed'
hook_have node || hook_refuse_input "$guard" 'node is not installed'
classifier="$script_directory/cratis-guard-secrets.mjs"
[ -f "$classifier" ] && [ -f "$script_directory/cratis-shell-parser.mjs" ] || hook_refuse_input "$guard" 'a guard helper file is missing'

# One jq process validates stdin: exactly one JSON object; tool_name absent or a string; for a shell call (tool_name
# Bash or absent, or any tool whose input carries a command) tool_input an object and command a non-empty string
# without NUL. Any other tool is not a shell command. The command is emitted NUL-terminated after a verdict frame and
# before a final END frame; nothing is decided until all three have been read.
applicable="" command_text="" trailer=""
{
    IFS= read -r -d '' applicable || hook_refuse_input "$guard" 'the validator produced no verdict'
    IFS= read -r -d '' command_text || hook_refuse_input "$guard" 'the validator output was truncated'
    IFS= read -r -d '' trailer || hook_refuse_input "$guard" 'the validator output was truncated'
} < <(jq -j -s '
    if length != 1 then error("documents") else .[0] end
    | if type != "object" then error("object") else . end
    | . as $root
    | (if has("tool_name") then (.tool_name | if type == "string" then . else error("tool") end) else null end) as $tool
    | if ($tool == null or $tool == "Bash" or (((.tool_input | type) == "object") and (.tool_input | has("command")))) then
        ($root | if (.tool_input | type) == "object" then .tool_input else error("tool_input") end) as $input
        | ($input | if (.command | type) == "string" and (.command | length) > 0 and ((.command | contains("\u0000")) | not) then .command else error("command") end) as $command
        | ["Y", $command, "END"]
      else
        ["N", "", "END"]
      end
    | .[] | ., "\u0000"
' 2>/dev/null) || hook_refuse_input "$guard" 'the validator could not run'
[ "$trailer" = END ] || hook_refuse_input "$guard" 'the validator did not finish'
[ "$applicable" = Y ] || exit 0

# Take the classifier's status from PIPESTATUS: 0 clean, 2 blocked or refused; anything else is a failure to classify.
# A clean verdict is exit 0 AND the classifier's own marker on stdout: exit 0 alone (a classifier that never ran)
# is not permission.
set +e
classifier_output=$(printf '%s' "$command_text" | node "$classifier"; exit "${PIPESTATUS[1]}")
status=$?
set -e
case "$status" in
    0) [ "$classifier_output" = 'cratis-guard-secrets: clean' ] || hook_refuse_input "$guard" 'the classifier did not report a verdict' ; exit 0 ;;
    2) exit 2 ;;
    *) hook_refuse_input "$guard" 'the classifier failed' ;;
esac
