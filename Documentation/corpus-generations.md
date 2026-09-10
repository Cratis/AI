---
applyTo: "**"
---

# Corpus generations inventory

Audience: Cratis engineering maintainers. Not required for adopting Cratis AI.

Which corpus generation each Cratis repository runs, so the retirement in this
repository (#256) has a sequenced, checkable migration order instead of
folklore. Verified against each repository's working tree and git history on
2026-09-10; **unverified** marks repositories not checked out locally that
day — verify before acting on them.

## The generations

| Generation | Meaning |
| --- | --- |
| `legacy-propagated` | An `.ai/` tree copied from the old all-to-all propagation: pre-two-profile rules, no mutation protocol, no subscription. |
| `two-profile` | The current corpus shape: application/framework profiles, the Interactive Agent Mutation Protocol, `.cratis/PROJECT.md` as canonical project context. |
| `subscription` | A `.cratis/ai.json` pinning `cratis/*` profiles at exact versions with reviewed updates — the designed end state once the versioned flow publishes. |
| `marketplace` | No local corpus tree: the host installs the `Cratis/AI` marketplace plugins straight off `main` (#264). |

## The inventory

| Repository | Generation | Evidence (2026-09-10) |
| --- | --- | --- |
| `Cratis/AI` | two-profile (source) | Authors the corpus; marketplace manifests at root |
| `Cratis/Chronicle` | two-profile | Modern `general.md` with both profiles and the mutation protocol; repo-local kernel-tracing skill (PR #4014) |
| `Cratis/Arc`, `Cratis/Fundamentals`, `Cratis/Components`, `Cratis/Documentation` | two-profile | Modern rules observed during the 2026-09 distribution work |
| `Cratis/Chronicle.Kotlin` | legacy-propagated | `.ai/` last touched 2026-08-26; no two-profile rules, no subscription |
| `Cratis/Chronicle.Elixir` | legacy-propagated | `.ai/` last touched 2026-07-24 |
| `Cratis/Chronicle.TypeScript` | legacy-propagated | `.ai/` last touched 2026-08-05 |
| `Cratis/Ante` | legacy-propagated | `.ai/` last touched 2026-08-26 |
| `Cratis/Dockerfiles` | legacy-propagated | `.ai/` last touched 2026-04-29 |
| `cratis.studio` | legacy-propagated | `.ai/` last touched 2026-05-16 |
| `Cratis/.github` | legacy-propagated | `.ai/` last touched 2026-06-07 |
| `Cratis/CLI` | none observed | No `.ai/`/`.agents/` tree in the local checkout — verify |
| `Cratis/StudioIssues` | none observed | No corpus in the local checkout — verify |
| `cratis.github.io` | **unverified** | Not checked out locally |

No repository carries a `.cratis/ai.json` subscription yet; the subscription
controller has no live target until the versioned flow publishes (#255, #181).

## Migration order (#256)

1. **Repositories that build code** (`Chronicle.Kotlin`, `Chronicle.Elixir`,
   `Chronicle.TypeScript`): upgrade to the two-profile corpus — copy the
   current rule set, keep repository-local skills, each as one PR in that
   repository referencing #256.
2. **Repositories that only carry conventions** (`Ante`, `Dockerfiles`,
   `Cratis/.github`, `cratis.github.io`): prefer the marketplace plugins over
   any local tree — delete the propagated `.ai/` copy once nothing references
   it, or move to a subscription when the versioned flow publishes.
3. **`cratis.studio`**: private; keep the local overlay minimal and take the
   public behavior from the marketplace.
4. In this repository, legacy `.ai/skills` retirement continues skill by
   skill: a canonical twin replaces the legacy source, the audit row moves,
   the twin is deleted.

Update this page when a repository's generation changes — it is the record
issue #256 asked for, and an unrecorded migration is an unfinished one.
