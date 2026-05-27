#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$root"

errors=()

record_error() {
    errors+=("$1")
}

exists() {
    [[ -e "$1" ]]
}

# Required paths for canonical source model
required_paths=(
    ".ai"
    ".ai/rules"
    ".ai/agents"
    ".ai/prompts"
    ".ai/skills"
    ".ai/hooks"
    "Documentation"
)

for path in "${required_paths[@]}"; do
    if ! exists "$path"; then
        record_error "Missing required path: $path"
    fi
done

# In this canonical repo, .github and .claude should point to .ai content through symlinks.
symlink_targets=(
    ".github/agents"
    ".github/prompts"
    ".github/skills"
    ".github/hooks"
    ".claude/agents"
    ".claude/prompts"
    ".claude/skills"
    ".claude/hooks"
)

for link_path in "${symlink_targets[@]}"; do
    if ! exists "$link_path"; then
        record_error "Missing required link path: $link_path"
        continue
    fi

    if [[ ! -L "$link_path" ]]; then
        record_error "Expected symlink but found regular path: $link_path"
    fi
done

# Every rule must have applyTo frontmatter.
while IFS= read -r -d '' rule_file; do
    if ! grep -Eq '^---' "$rule_file"; then
        record_error "Rule missing frontmatter: $rule_file"
        continue
    fi

    if ! grep -Eq '^applyTo:' "$rule_file"; then
        record_error "Rule missing applyTo: $rule_file"
    fi
done < <(find .ai/rules -type f -name '*.md' -print0 2>/dev/null || true)

# Prompt files with .prompt.md suffix should have frontmatter and a description.
while IFS= read -r -d '' prompt_file; do
    if ! grep -Eq '^---' "$prompt_file"; then
        record_error "Prompt missing frontmatter: $prompt_file"
        continue
    fi

    if ! grep -Eq '^description:' "$prompt_file"; then
        record_error "Prompt missing description frontmatter: $prompt_file"
    fi
done < <(find .ai/prompts -type f -name '*.prompt.md' -print0 2>/dev/null || true)

# Hook files should exist.
for hook_file in .ai/hooks/pre-commit.md .ai/hooks/agent-stop.md; do
    if ! exists "$hook_file"; then
        record_error "Missing hook file: $hook_file"
    fi
done

if [[ ${#errors[@]} -gt 0 ]]; then
    printf '%s\n' "AI setup validation failed with ${#errors[@]} issue(s):"
    for err in "${errors[@]}"; do
        printf ' - %s\n' "$err"
    done
    exit 1
fi

printf '%s\n' "AI setup validation passed."
