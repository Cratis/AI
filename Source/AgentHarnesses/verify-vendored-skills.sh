#!/usr/bin/env bash
# Verifies the Claude Skills vendored into the worker image (Cratis/Stagehand#118) are structurally
# sound and actually reach the image - without needing a full `docker build`, the same reasoning
# for_entrypoint/*.sh follows by stubbing out the real binaries instead of running them.
#
# Two things can silently rot here: a vendored SKILL.md losing its required frontmatter (nobody
# would notice until a worker tried to load it), and Dockerfile.claude's COPY lines drifting out of
# sync with the actual vendored paths on disk (a rename on either side breaks the other silently,
# since nothing else here would fail to build).
#
# Not wired into CI - see the note on the sibling for_entrypoint/*.sh scripts, which this mirrors:
# the worker images are built solely in publish.yml, never in build.yml. Run by hand after touching
# anything under skills/ or Dockerfile.claude.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="${HERE}/skills"
DOCKERFILE="${HERE}/Dockerfile.claude"
FAILURES=0

fail() {
    echo "FAIL: $1" >&2
    FAILURES=$((FAILURES + 1))
}

# Every vendored skill needs a SKILL.md with the frontmatter Claude Code requires - the same
# structural check .ai/hooks/scripts/validate-ai-setup.sh applies to this repository's own
# .ai/skills, applied here because this tree is a separate one it does not scan.
while IFS= read -r -d '' skill; do
    if [[ "$(sed -n '1p' "$skill")" != "---" ]]; then
        fail "$skill: missing YAML frontmatter"
        continue
    fi
    grep -Eq '^name:' "$skill" || fail "$skill: frontmatter must include name"
    grep -Eq '^description:' "$skill" || fail "$skill: frontmatter must include description"
done < <(find "$SKILLS_DIR" -mindepth 2 -iname 'SKILL.md' -print0)

skill_count=$(find "$SKILLS_DIR" -mindepth 2 -iname 'SKILL.md' | wc -l | tr -d ' ')
if [[ "$skill_count" -lt 2 ]]; then
    fail "expected at least the react-agent-skills collection plus cratis-primereact-ui-basics, found only $skill_count SKILL.md file(s) under $SKILLS_DIR"
fi

# Every top-level vendored/authored skill package needs its own provenance record - either
# vendored (CRATIS-PROVENANCE.md, upstream LICENSE) or authored (PROVENANCE.md).
for package in "$SKILLS_DIR"/*/; do
    name="$(basename "$package")"
    if [[ ! -f "${package}PROVENANCE.md" && ! -f "${package}CRATIS-PROVENANCE.md" ]]; then
        fail "$name: no PROVENANCE.md or CRATIS-PROVENANCE.md - where this came from and under what license is undocumented"
    fi
done

# Dockerfile.claude must actually copy what is vendored on disk - a rename on either side must fail
# this rather than silently building an image missing the skills.
grep -Fq 'COPY --chown=agent:agent skills/react-agent-skills/skills/ /home/agent/.claude/skills/' "$DOCKERFILE" \
    || fail "Dockerfile.claude no longer copies skills/react-agent-skills/skills/ into the image"
grep -Fq 'COPY --chown=agent:agent skills/cratis-primereact-ui-basics/ /home/agent/.claude/skills/cratis-primereact-ui-basics/' "$DOCKERFILE" \
    || fail "Dockerfile.claude no longer copies skills/cratis-primereact-ui-basics/ into the image"

if [[ "$FAILURES" -gt 0 ]]; then
    echo "$FAILURES check(s) failed" >&2
    exit 1
fi

echo "OK: $skill_count vendored skill(s), all with frontmatter and provenance, Dockerfile.claude copies both packages"
