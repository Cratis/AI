#!/usr/bin/env bash
# Validates the AI corpus in this repo: structural integrity (frontmatter) and adapter
# health for each tool's actual conventions —
#   Copilot: .github/copilot-instructions.md, .github/instructions/<n>.instructions.md (applyTo),
#            .github/agents/<n>.agent.md, .github/prompts (folder), .github/skills (folder)
#   Claude:  .claude/CLAUDE.md, .claude/rules/<n>.md (paths), .claude/agents (folder),
#            .claude/commands/<n>.md, .claude/skills (folder)   [hooks live in .claude/settings.json]
#   Codex:   AGENTS.md, .agents/skills (folder)
# plus a set of content drift guards. Structural/adapter/Codex checks are FATAL; drift guards are
# WARNINGS. Portable: needs only bash + grep + sed (no ripgrep) — the one guard that wants more
# (validate-package-subpaths.sh: jq + node_modules) is delegated and no-ops without them.
# Run from anywhere; it cd's to root.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$root"

failed=0
fail() { printf 'ai-corpus FAIL: %s\n' "$1" >&2; failed=1; }
warn() { printf 'ai-corpus warn: %s\n' "$1" >&2; }

# ── Structural: required paths ──
for p in .ai .ai/rules .ai/agents .ai/prompts .ai/skills .ai/hooks; do
    [[ -e "$p" ]] || fail "missing required path: $p"
done

# ── Structural: rules (general.md is the intentionally frontmatter-less root) ──
for rule in .ai/rules/*.md; do
    [[ -e "$rule" ]] || continue
    [[ "$rule" == ".ai/rules/general.md" ]] && continue
    if [[ "$(sed -n '1p' "$rule")" != "---" ]]; then fail "$rule: missing YAML frontmatter"; continue; fi
    grep -Eq '^applyTo:' "$rule" || fail "$rule: frontmatter must include applyTo"
    # profile (optional) must be application|framework when present. Absence IS the universal
    # state — there is deliberately no explicit `profile: universal`, so a rule cannot encode the
    # same fact two ways (see managing-ai-rules.md, "Profiles").
    if grep -Eq '^profile:' "$rule" && ! grep -Eq '^profile:[[:space:]]*(application|framework)[[:space:]]*$' "$rule"; then
        fail "$rule: profile must be application or framework (omit it for a universal rule)"
    fi
done

# ── Structural: skills (name + description + audience marker) ──
#    A skill declares a non-default audience as an ALL-CAPS marker at the very start of its
#    description, followed by an em dash. The set is CLOSED — adding an audience means adding the
#    row in managing-ai-rules.md ("Skill audience markers") and the value here, in one commit.
#    `profile:` is a rules-only key and must never appear on a skill (Agent Skills allows only
#    name/description/license/allowed-tools/metadata/compatibility at the top level).
skill_audience_markers='FRAMEWORK PROFILE ONLY|DOCS MAINTAINER SKILL|CORPUS MAINTAINER SKILL|PLATFORM OPERATOR SKILL'
description_head() {  # first line of a skill's description value
    # Handles all three YAML spellings in use: `description: "..."`, a bare inline value, and a
    # value that begins on the line *after* `description:` (plain or block scalar). Quotes are
    # stripped only at the head, so escaped inner quotes never confuse the match.
    local p="$1" head
    head="$(grep -m1 -E '^description:' "$p" | sed -E 's/^description:[[:space:]]*//; s/^[|>][+-]?[0-9]*[[:space:]]*$//')"
    if [[ -z "$head" ]]; then head="$(sed -n '/^description:/,$p' "$p" | sed -n '2p')"; fi
    printf '%s' "$head" | sed -E 's/^[[:space:]]*//; s/^["'"'"']//'
}
for skill in .ai/skills/*/SKILL.md; do
    [[ -e "$skill" ]] || continue
    if [[ "$(sed -n '1p' "$skill")" != "---" ]]; then fail "$skill: missing YAML frontmatter"; continue; fi
    grep -Eq '^name:' "$skill" || fail "$skill: frontmatter must include name"
    if ! grep -Eq '^description:' "$skill"; then fail "$skill: frontmatter must include description"; continue; fi
    if grep -Eq '^profile:' "$skill"; then
        fail "$skill: profile: is a rules-only key — declare a skill's audience with a description marker"
    fi
    head="$(description_head "$skill")"
    if printf '%s' "$head" | grep -qE '^[A-Z][A-Z0-9 ]*[A-Z][[:space:]]*—' \
        && ! printf '%s' "$head" | grep -qE "^($skill_audience_markers)[[:space:]]*—"; then
        fail "$skill: unknown audience marker '$(printf '%s' "$head" | sed -E 's/[[:space:]]*—.*$//')' — the closed set is: ${skill_audience_markers//|/, }"
    fi
done

# ── Structural: prompts must be *.prompt.md with frontmatter + description ──
for p in .ai/prompts/*.md; do
    [[ -e "$p" ]] || continue
    case "$p" in *.prompt.md) ;; *) fail "$p: prompt must use the .prompt.md suffix (no plain-.md stubs)"; continue;; esac
    if [[ "$(sed -n '1p' "$p")" != "---" ]]; then fail "$p: missing frontmatter"; continue; fi
    grep -Eq '^description:' "$p" || fail "$p: prompt missing description frontmatter"
done

# ── Adapter integrity ──
#    GitHub: .github/instructions is a single FOLDER symlink → ../.ai/rules, so rules are
#      maintained in one place (no per-file adapter). Caveat: Copilot's applyTo discovery expects
#      the .instructions.md suffix, which a folder symlink does not provide — documented in
#      managing-ai-rules.md. The structural check here is that the folder symlink resolves to .ai/rules.
#    Claude: every rule still resolves through a per-file adapter (.claude/rules/<name>.md), which
#      may be a symlink OR a path-reference file — both encode the same relative target; the check is
#      that it *resolves* to the right rule, not its file type. ──
adapter_target() {  # prints the relative target encoded by an adapter (symlink target or file body)
    local p="$1"
    if [[ -L "$p" ]]; then readlink "$p"; else cat "$p"; fi
}
if [[ ! -L .github/instructions ]]; then fail ".github/instructions: expected folder symlink → ../.ai/rules"
elif [[ "$(readlink .github/instructions)" != "../.ai/rules" ]]; then fail ".github/instructions: expected target '../.ai/rules'"
elif [[ ! -d .github/instructions ]]; then fail ".github/instructions: symlink does not resolve to .ai/rules"; fi
for rule in .ai/rules/*.md; do
    [[ -e "$rule" ]] || continue
    name="$(basename "$rule" .md)"; [[ "$name" == general ]] && continue
    expected="../../.ai/rules/$name.md"
    cl=".claude/rules/$name.md"
    if [[ ! -e "$cl" ]]; then fail "$cl: missing Claude rule adapter"
    elif [[ "$(adapter_target "$cl")" != "$expected" ]]; then fail "$cl: expected target '$expected'"; fi
done

# ── Folder-level symlinks each tool consumes directly (same convention both sides) ──
#    Copilot: prompts (.github/prompts/*.prompt.md), skills (.github/skills/<n>/SKILL.md).
#    Claude:  agents (.claude/agents/<n>.md), skills (.claude/skills/<n>/SKILL.md).
for link in .github/prompts .github/skills .claude/agents .claude/skills; do
    if [[ ! -e "$link" ]]; then fail "missing link path: $link"
    elif [[ ! -L "$link" ]]; then fail "expected symlink but found regular path: $link"; fi
done

# ── Copilot custom-agent adapters: Copilot requires .github/agents/<name>.agent.md
#    (the .agent.md suffix); the Claude side uses the .claude/agents folder symlink above. ──
for agent in .ai/agents/*.md; do
    [[ -e "$agent" ]] || continue
    name="$(basename "$agent" .md)"
    gh=".github/agents/$name.agent.md"; expected="../../.ai/agents/$name.md"
    if [[ ! -e "$gh" ]]; then fail "$gh: missing Copilot agent adapter (.agent.md suffix required)"
    elif [[ "$(adapter_target "$gh")" != "$expected" ]]; then fail "$gh: expected target '$expected'"; fi
done

# ── Claude slash-command adapters: Claude reads commands from .claude/commands/<name>.md
#    (not .claude/prompts); the Copilot side uses the .github/prompts folder symlink. ──
for prompt in .ai/prompts/*.prompt.md; do
    [[ -e "$prompt" ]] || continue
    name="$(basename "$prompt" .prompt.md)"
    cl=".claude/commands/$name.md"; expected="../../.ai/prompts/$name.prompt.md"
    if [[ ! -e "$cl" ]]; then fail "$cl: missing Claude command adapter"
    elif [[ "$(adapter_target "$cl")" != "$expected" ]]; then fail "$cl: expected target '$expected'"; fi
done

# ── Orphan adapters: an adapter left behind after its canonical source was deleted ──
#    Every loop above walks the CANONICAL files and asks "does its adapter exist?", so a deleted
#    canonical file is simply never visited and its stale adapter stays invisible. Walk the
#    per-file adapter directories in the other direction and fail on one that no longer resolves.
#    Only files that ARE adapters are judged: a symlink, or a regular file whose entire body is a
#    single relative path. Repo-local content living beside the adapters is ignored, so this stays
#    correct in every repository the corpus is propagated to — it asserts internal consistency of
#    what the repo itself declares, never that a particular canonical name must exist.
for dir in .claude/rules .claude/commands .github/agents; do
    [[ -d "$dir" ]] || continue
    for adapter in "$dir"/*; do
        [[ -e "$adapter" || -L "$adapter" ]] || continue
        if [[ -L "$adapter" ]]; then
            [[ -e "$adapter" ]] || fail "$adapter: dangling adapter — '$(readlink "$adapter")' does not exist (canonical source deleted?)"
            continue
        fi
        target="$(adapter_target "$adapter")"
        # A path-reference adapter is exactly one relative-path line; anything else is content.
        [[ "$target" == ../* && "$target" != *$'\n'* ]] || continue
        [[ -e "$dir/$target" ]] || fail "$adapter: dangling adapter — '$target' does not exist (canonical source deleted?)"
    done
done

# ── General-rule root adapters ──
for f in .github/copilot-instructions.md .claude/CLAUDE.md; do
    [[ -e "$f" ]] || fail "missing general-rule adapter: $f"
done

# ── Codex adapters (we claim Codex support) ──
#    -e follows a symlink, so it catches a dangling one as well as an outright missing adapter;
#    a path-reference file satisfies it too.
[[ -e AGENTS.md ]]                     || fail "AGENTS.md: missing or dangling Codex root adapter (-> .ai/rules/general.md)"
[[ -L .agents/skills && -d .agents/skills ]] || fail ".agents/skills: missing or dangling Codex skills adapter (-> ../.ai/skills)"

# ── Hook files ──
for hook in .ai/hooks/pre-commit.md .ai/hooks/agent-stop.md; do
    [[ -e "$hook" ]] || fail "missing hook file: $hook"
done

# ── Content drift guards (WARN only — heuristic, never block on a false positive) ──
if grep -rnE '\.AutoMap\(\)' .ai/rules .ai/skills .ai/agents 2>/dev/null \
        | grep -vE ':[0-9]+:[[:space:]]*#' \
        | grep -vE '(NoAutoMap|never|not |n.t |default|only|disabl)' | grep -q .; then
    warn "possible stale .AutoMap() guidance — AutoMap is on by default; call .From<>() directly"
fi
if grep -rnE '\.instructions\.md' .ai/rules .ai/skills .ai/agents .ai/prompts .ai/hooks 2>/dev/null \
        | grep -vE 'managing-ai-rules|validate-ai-setup' | grep -q .; then
    warn "'.instructions.md' cross-link leaked into canonical docs — use ./<name>.md"
fi
# The event-type-migrations skill is the one place where an argument-carrying
# [EventType] is the subject matter, so exclude it by path rather than relying on
# the wording of a comment that happens to sit on the same line.
if grep -rnE '\[EventType\("|\[EventType\(name:|\[EventType\(id:' .ai/rules .ai/skills .ai/agents 2>/dev/null \
        | grep -vE '^\.ai/skills/event-type-migrations/' \
        | grep -viE 'never|no arg|not allowed' | grep -q .; then
    warn "stale [EventType] argument guidance — new events take no arguments (generation: only for migrations)"
fi
if grep -rnE 'Features/<Feature>/<Slice>|Features/<Feature>/<SliceName>|Source/Core/Features' .ai/rules .ai/skills .ai/agents .ai/prompts 2>/dev/null | grep -q .; then
    warn "possible retired top-level Features/ layout — use <Module>/<Feature>/<Slice>/ (Module optional)"
fi
if grep -rnE 'RouteAttribute|\[Route\(' .ai/rules .ai/skills .ai/agents 2>/dev/null | grep -q .; then
    warn "stale [Route] for model-bound queries — use [Path]"
fi
if grep -rniE 'custom exception to signal|framework converts it to (an? )?(error|failed)' .ai/rules .ai/skills .ai/prompts 2>/dev/null | grep -q .; then
    warn "stale business-rule guidance — return ValidationResult/Result<,>, not a thrown exception"
fi
# Every guard above asserts that a string should NOT appear. The one below is the other direction:
# it resolves each `@cratis/<pkg>/<subpath>` the corpus names against the installed package's
# exports map. It lives in its own script because it is the only check with a dependency beyond
# bash/grep/sed (jq) and on an installed node_modules — both of which it degrades around silently.
# Tested with -f, not -x, and invoked through `bash`: a checkout that lost the exec bit must not
# silently drop the guard.
if [[ -f .ai/hooks/scripts/validate-package-subpaths.sh ]]; then
    bash .ai/hooks/scripts/validate-package-subpaths.sh || true
fi

if [[ "$failed" -ne 0 ]]; then
    printf 'AI corpus validation FAILED.\n' >&2
    exit 1
fi
printf 'AI corpus validation passed.\n'
