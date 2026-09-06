# Maintainer runbook — installing Cratis AI, and the one thing that still publishes

Audience: a Cratis maintainer with owner rights.

This page used to be long because deploying the marketplace used to be a
project: a protected release branch, a `dist/*` tag ruleset, a staged generated
tree verified by seven checks, checksums and provenance to keep in sync, and an
environment approval gating a publish job. **None of that exists any more.**

Cratis AI is markdown — skills, rules, and agent guidance. It is installed
directly from this repository's default branch. There is nothing to deploy.

## Installing

```text
/plugin marketplace add Cratis/AI
/plugin install cratis@cratis
```

```bash
codex plugin marketplace add Cratis/AI
copilot plugin marketplace add Cratis/AI
copilot plugin install cratis@cratis
```

Maintainers who also want the engineering skills install the second plugin from
the same marketplace:

```text
/plugin install cratis-engineering@cratis
```

No ref, no version, no tag. A host reads the marketplace manifest on `main` and
resolves the plugin's `source` — an ordinary directory in this repository.

## The entire distribution surface

Four committed files:

| File | Read by |
| --- | --- |
| [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) | Claude Code |
| [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) | Codex |
| [`.github/plugin/marketplace.json`](../.github/plugin/marketplace.json) | GitHub Copilot |
| [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json) | Cursor |

Each declares two plugins whose `source` is
`{"source": "github", "repo": "Cratis/AI", "path": "skills"}` and
`{"source": "github", "repo": "Cratis/AI", "path": "engineering"}`. They are
hand-authored and reviewed like any other file — no generator, no staging step,
no freshness check, and no bytes to keep in sync.

**Why every entry sets `strict: false`.** `source.path` names the *plugin root*,
and with the default `strict: true` a host requires a plugin manifest
(`.claude-plugin/plugin.json`) in that root. Neither `skills/` nor
`engineering/` carries one, and adding one would put a generated-looking
manifest back into the tree. `strict: false` makes the marketplace entry the
whole definition instead, so each entry names its own component paths — `skills`
is `./` for the `skills/` root, whose children are the skill directories, and
`./skills` for the `engineering/` root, whose skills sit one level down.

Validate a manifest change locally before pushing:

```bash
claude plugin validate .
```

`engineering/` is maintainer-audience content, not confidential content, so it
ships from the same public marketplace rather than through a separate mechanism.

**Adding a skill is the whole deployment.** A skill directory added under
`skills/` or `engineering/skills/` is live for every host on the next merge to
`main`. Editing a manifest is only needed to add or rename a *plugin*.

`tooling/specs/marketplace-pointer-manifests.spec.mjs` asserts the manifests
stay in this shape — same two plugins, same repository, no `ref`, `strict:
false`, and each declared `skills` path resolving to a real directory of
`SKILL.md` files.

The Claude Code and GitHub Copilot manifest shapes are verified against those
hosts' published plugin references. The Codex (`.agents/plugins/`) and Cursor
(`.cursor-plugin/`) manifests reuse the same entry shape but their schemas were
not re-verified against a published reference during this change; treat them as
best-effort until a real install is recorded.

### Hosts that read a repository root

Gemini CLI (`gemini-extension.json`) and Pi (`package.json`) look for a manifest
at the repository root rather than following a marketplace manifest. This
repository's root carries neither, so those two hosts have **no working install
today**. The command shapes are recorded in
[`distribution/marketplace-requirements.json`](../distribution/marketplace-requirements.json)
with a constraint saying exactly that. Adding a root manifest for them is an
open decision, not a regression from the retired model — the retired model
deliberately withheld root manifests so no host would discover the authored
`skills/` tree, which is now precisely what we *want* every host to discover.

### Install evidence needs re-running

The host preflights under `distribution/evidence/s9-*` were recorded against
`dist/vX.Y.Z` refs on the deleted `distribution` branch. Those refs do not
resolve, so that evidence does not carry over. Re-record per host — Claude Code,
Codex, Copilot, Cursor — against `Cratis/AI` with no ref, in the existing
evidence format.

## What actually publishes: `@cratis/ai-fundamentals`

One real publishing pipeline remains, and it is unrelated to the plugin path:
[`.github/workflows/release-passive-previews.yml`](../.github/workflows/release-passive-previews.yml)
publishes the `@cratis/ai-fundamentals` npm package on a merge to `main` under a
release-intent label, using the normal `cratis/release-action` flow.

- npm **trusted publishing** (OIDC), no token secret. The trusted publisher is
  bound to provider `github-actions`, organization `Cratis`, repository `AI`,
  workflow **`release-passive-previews.yml`**, environment `npm-stage`.
  **Renaming that file breaks publishing** — the binding is on the exact
  filename, which is why it does not follow the `publish.yml` convention.
- `id-token: write` is scoped to the publish job, never at workflow level.
  `tooling/specs/workflow-safety.spec.mjs` asserts this.
- Releases stay on `0.x.y` and publish to npm `latest`.
- The job requires npm **11.5.1 or newer** and Node 24.

Setup is recorded as complete in
[`distribution/npm-stage-contract.json`](../distribution/npm-stage-contract.json):
`@cratis` scope ownership and public registry status verified on 2026-08-27, and
the `0.0.0-bootstrap.0` placeholder published and deprecated.

## Protected environments

| Environment | Live state | Used by |
| --- | --- | --- |
| `npm-stage` | Configured, branch policy restricting it to `main`, **no required reviewer** | `release-passive-previews.yml`'s publish job |
| `distribution-canary` | Configured, required reviewer `woksin` | **Nothing** — every workflow that declared it is deleted |

`npm-stage` having no required reviewer matches
`npm-stage-contract.json`'s `environmentApprovalRequired: false`. If you add a
reviewer, update that field in the same change.

`distribution-canary` is now unreferenced. Deleting it is safe but is a separate
decision; it is left in place so the removal is deliberate rather than a side
effect.

## Still outstanding, and unchanged by any of this

- **Vendor marketplace listings** — [Cratis/AI#147](https://github.com/Cratis/AI/issues/147).
  OpenAI and Cursor portal submissions need an owner-authenticated publisher
  account and a review submission. `distribution/marketplace-publications.json`
  is still `{"publications": []}` with `defaultPolicy: "deny"`; record a
  publication there only once a listing is actually live.
- **Canary consumer and subscriber ring** — [Cratis/Workflows#71](https://github.com/Cratis/Workflows/issues/71).
  Without an authorized canary consumer, no real host lifecycle evidence can be
  produced, so no profile leaves the basic assurance lane
  ([`distribution/assurance-lanes.json`](../distribution/assurance-lanes.json)).
- **Archiving `Cratis/AI.Distribution`** — [Cratis/AI#264](https://github.com/Cratis/AI/issues/264)
  Phase 5. Its published `v0.1.0`–`v0.3.0` tags stay resolvable forever; update
  its `README.md` to point at the `Cratis/AI` commands, then archive. **Never
  delete the repository or its tags.** The `Cratis/AI.Distribution` half of
  [Cratis/Workflows#72](https://github.com/Cratis/Workflows/issues/72) — the
  cross-repository GitHub App — can be closed as no longer required; no
  workflow mints that token any more.

Marketplace listing is orthogonal to technical support. A live listing never
implies behavior support, broad-rollout approval, or a stable support claim.
