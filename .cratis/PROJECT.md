# Cratis/AI — project context

This repository is the source of the Cratis AI corpus: the skills, profiles,
catalogs, distribution contracts, and marketplace plugins every other Cratis
repository consumes. It is a corpus of markdown, JSON, and JavaScript — there
is no build; correctness is enforced by validators and generated-file checks.

## Layout

| Path | Holds |
| --- | --- |
| `skills/` | canonical public skill sources (`<id>/SKILL.md` + references/assets) |
| `engineering/` | maintainer-audience skill sources, plugin manifests, and `sources-staged/` (migrated general sources awaiting authoring) |
| `.ai/` | the legacy local corpus this repository still authors and retires skill by skill; other repositories no longer carry a copy |
| `profiles/` | one JSON file per profile under `profiles/public/` and `profiles/cratis-engineering/` |
| `catalog/`, `catalog/v2/` | the capability catalog; `v2` files are **generated** by `tooling/generate-catalog-v2.mjs` |
| `distribution/` | release contracts, the generated `profile-catalog.json`, and the subscription schema |
| `tooling/` | validators, generators, and `tooling/specs/` (node:test) |
| `evals/`, `pilots/`, `evidence/` | evaluation and evidence material |

## Commands

```bash
node tooling/generate-profile-catalog.mjs        # after editing any profile file
node tooling/generate-catalog-v2.mjs             # after editing catalog sources or evidence
node tooling/generate-human-catalog.mjs          # regenerates catalog/generated/human-catalog
node tooling/generate-repository-inventory.mjs   # after adding/removing corpus paths
node tooling/validate-catalogs.mjs
node tooling/profile-subscription-validation.mjs
node --test tooling/specs/<name>.spec.mjs        # run the affected specs; CI runs them all
```

Generated files stay committed; CI runs the generators and fails on
`git diff --exit-code`. Never hand-edit `distribution/profile-catalog.json`,
`catalog/v2/*`, or `catalog/generated/*`.

## Invariants

- Every claim carries an evidence state (authored / generated / evaluated /
  supported / unavailable); nothing is called supported without evidence.
- Skills are passive markdown — no hooks, no executable code, no credentials.
- The `cratis/engineering` subtree is the maintainer channel; compositions
  never cross audiences. Subscriptions may deliberately mix channels
  (documentation next to an engineering cell) and then leave `channel` unset.
- New skill sources follow `Documentation/skill-authoring-contract.md`;
  `engineering/sources-staged/` holds migrated source material only — it is
  never projected or served.

## AI-assisted development

`.cratis/ai.json` records this repository's own profile selection
(`cratis/documentation` + `cratis/engineering/typescript`). The marketplace
plugins (`cratis@cratis` public, `cratis-engineering@cratis` maintainer) serve
the skills from this repository's default branch — see the
[harness guide](https://www.cratis.io/ai/harnesses/) for per-harness install.

Contributors: propose general behavior changes **here** through the authoring
contract; a consuming repository never edits shared corpus bytes locally.
Repository-specific facts belong in the owning repository's
`.cratis/PROJECT.md`, never in a skill.
