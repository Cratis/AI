# Phase 0 Verification Record

**Recorded:** 2026-08-20
**Branch:** `main` tracking `origin/main`
**Scope:** First redesign implementation session

## Session-start worktree baseline

The fresh session-start status was:

```text
## main...origin/main
 M .ai/hooks/agent-stop.md
 M .ai/hooks/pre-commit.md
 M .ai/hooks/scripts/validate-ai-setup.sh
 M .gitignore
?? AI-REPOSITORY-REDESIGN-HANDOVER.md
```

The unstaged diff summary was:

```text
 .ai/hooks/agent-stop.md                |  8 ++++
 .ai/hooks/pre-commit.md                |  6 +++
 .ai/hooks/scripts/validate-ai-setup.sh | 71 +++++++++++++++++++++++-----------
 .gitignore                             |  5 +++
 4 files changed, 67 insertions(+), 23 deletions(-)
```

There were no staged changes. The untracked handover existed before
implementation work began.

These five paths are protected pre-existing work for this session. The
redesign scaffold must not overwrite, revert, stage, or include them without
explicit approval:

- `.ai/hooks/agent-stop.md`;
- `.ai/hooks/pre-commit.md`;
- `.ai/hooks/scripts/validate-ai-setup.sh`;
- `.gitignore`;
- `AI-REPOSITORY-REDESIGN-HANDOVER.md` until the maintainer explicitly
  authorized the decision update recorded later on 2026-08-20.

## npm name verification

Registry requests returned `Not found` for:

- `@cratis/ai`;
- `@cratis/mcp`;
- `@cratis/pi`.

None of the three names is currently published in the public npm registry.
Existing packages including `@cratis/arc` and `@cratis/components` establish
active use of the `@cratis` scope. npm documents an organization scope as the
matching organization's unique namespace.

This environment is not authenticated to npm. `npm whoami` returned
`ENEEDAUTH`, so current-user organization membership and permission to publish
new packages were not verified. No name was claimed and no package was
published.

Maintainers approved the three names. Trusted-publisher and organization access
must still be configured and verified before release.

## Ecosystem verification result

The official sources listed in `catalog/ecosystem-versions.json` were rechecked
on 2026-08-20 for:

- Agent Plugins and Agent Skills;
- GitHub CLI skills;
- GitHub Copilot plugins and marketplaces;
- OpenAI, ChatGPT, and Codex plugins;
- Claude Code plugins and marketplaces;
- Gemini CLI extensions and gallery releases;
- Cursor Agent Plugin and native plugin formats;
- Pi packages, skills, and extensions;
- Junie extension structure.

No verified ecosystem fact changed from the handover's 2026-08-20 research
baseline. The handover was later updated only to record explicit maintainer
architecture and ownership decisions.

The installed GitHub CLI is version `2.71.2` and reports
`unknown command "skill"`. Live official documentation confirms `gh skill` is
preview functionality. `gh skill publish --dry-run` therefore cannot run with
the local CLI in this session.

Junie remains provisional. The official repository documents extension
structure but does not document a general public third-party marketplace
submission process.

## Maintainer decisions recorded after the initial scaffold

- Keep one public `Cratis/AI` repository with separate public-product and
  co-located engineering artifact boundaries.
- Do not create a second repository now; use `Cratis/AI.Cratis` only if a later
  split becomes necessary.
- Replace broad propagation with native public and engineering installation.
- Use `.cratis/PROJECT.md` for harness-neutral project context.
- Move `add-traces` and broad C# conventions to engineering ownership.
- Use a gated vertical-slice merge and retain focused performance review after
  correcting duplicated guidance.
- Approve `cratis` and the proposed npm package names.
- Do not rewrite public history.

Trusted-publisher setup is still required before release. Exact Stagehand and
Ensemble ownership will be resolved through the Phase 1 artifact inventory.
