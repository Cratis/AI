# Redesign Foundation Validation Record

**Executed:** 2026-08-20
**Scope:** Decision, catalog/schema v2, ownership inventory, fixture-only
materializer, and project-context contract
**Distribution decision:** Unresolved; no runtime or release conformance claimed

## Protected worktree baseline

The baseline was recorded before implementation under
`/tmp/cratis-ai-redesign-baseline.ozfZUi`.

- branch: `main`;
- local revision: `158bcabfcac1ac2042696c7f747436cf783c0482`;
- upstream: `origin/main` at
  `b795d5307e20f7f7458a67708b4f26975e223796`;
- divergence: zero local commits ahead and four commits behind;
- staged paths: zero;
- unstaged tracked paths: five;
- untracked paths at baseline: 85, including transient Pi artifacts;
- ignored paths at baseline: 142;
- protected changed-path hash records: 90.

The specifically protected files were:

- `.ai/hooks/agent-stop.md`;
- `.ai/hooks/pre-commit.md`;
- `.ai/hooks/scripts/validate-ai-setup.sh`;
- `.gitignore`;
- `Documentation/index.md`.

They were not edited, staged, reverted, cleaned, or absorbed. Redesign documents,
catalogs, and tooling that already existed were extended only where the
canonical implementation prompt required a deliverable. Transient `.pi/tasks`,
`.pi/delegate`, and `.pi/fusion` content was neither cleaned nor inventoried as
policy.

## Authority check

Authenticated, read-only `gh issue view --json` calls re-read bodies and all
comments for:

- `Cratis/.github#24`;
- `Cratis/Workflows#68`;
- `Cratis/AI#126`;
- `Cratis/AI#127`.

All four issues remained open. Workflows#68 had one maintainer comment. It
confirmed the propagation-control toolkit had landed but explicitly left the
authoritative distribution model, versioning and override policy, canary,
wrapper retirement, and freeze lifting open.

The recorded decision is therefore `unresolved`. This foundation created no
live target source tree, plugin or package manifest, install instruction,
release ref, archive, publication workflow, propagation change, commit, push,
or pull request.

## Before-edit signals

The required pre-edit signals were:

```text
.ai/hooks/scripts/validate-ai-setup.sh
  exit 0; AI corpus validation passed
  advisories: the same three legacy AutoMap, .instructions.md, and Features/
  warnings recorded by the reevaluation

node tooling/validate-catalogs.mjs
  exit 0; 3 legacy catalogs and 3 schemas passed

node --test tooling/specs/catalog-validation.spec.mjs
  exit 0; 10/10 passed

strict JSON parsing
  exit 0 for every legacy catalog and schema
```

The three corpus advisories were treated as unchanged legacy warnings, not as
new-tooling success.

## Implemented validation surfaces

Catalog v2 contains:

- 43 source records;
- 43 target records: 35 public and eight engineering;
- 42 migration records covering all sources exactly once;
- 64 evidence records;
- 100 evidence-bound ecosystem facts;
- separate `coverageState` and `claimState` values;
- one blocked planned public artifact and one sanitized fixture-only artifact;
- a schema-backed repository inventory grouped by explicit path patterns,
  expected counts, and sorted SHA-256 path-list digests.

No target is approved and every target has `includeInRuntime: false`.

The dependency-free schema validator now rejects unsupported JSON Schema
keywords explicitly. This is the permitted no-dependency alternative to
silently ignoring Draft 2020-12 vocabulary; it is not a claim that the custom
validator implements all of Draft 2020-12.

The materializer specs cover exact selection, empty staging, regular-file and
realpath containment, symlinks, special files, traversal, absolute paths,
hidden paths, duplicate/case/Unicode collisions, forbidden categories, local
or secret-shaped content, escaping/unresolved/unlinked resources, sorted file
hashes, recursive skill discovery, and safe bounded fixture archive
pack/unpack/revalidation.

The project-context specs cover canonical precedence, legacy fallback,
no-context state, minimal `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` locators,
application and framework fixtures, and preservation of existing project-owned
bootstraps.

## Final commands and outcomes

The final validation set is:

```bash
.ai/hooks/scripts/validate-ai-setup.sh
node tooling/generate-catalog-v2.mjs
node tooling/generate-repository-inventory.mjs
node tooling/validate-catalogs.mjs
node --test tooling/specs/*.spec.mjs
node -e 'JSON.parse(...)'  # every catalog and schema
```

Outcomes:

- corpus validation: passed with only the same three legacy advisories;
- catalog validation: passed for three legacy catalogs, seven v2 catalogs, and
  four schema documents;
- Node specifications: 36/36 passed;
- strict JSON parsing: passed for every catalog and schema;
- primary LSP diagnostics: zero errors and zero warnings after unused generator
  symbols were removed;
- scoped Markdown lint: zero findings with MD013 disabled for established
  long-form tables and URLs;
- scoped link checks: local links passed; authenticated GitHub authority links
  were already read successfully;
- session diagnostics: no blocking issue in changed files; Marksman reported
  one false positive for the fixture link to the existing
  `references/guide.md`, which was dispositioned with direct path and test
  evidence;
- `git diff --check`: passed;
- named protected-file SHA-256 comparison: unchanged;
- staged paths: zero.

The final worktree remained `main` four commits behind `origin/main`, with five
unstaged tracked paths, zero staged paths, 118 untracked paths, and 142 ignored
paths. The five tracked paths were the same protected pre-existing changes.
Comparison of all 90 baseline hash records found only five intentional
deliverable extensions: the canonical handover, implementation plan, public
architecture decision log, catalog validator, and catalog validation entry
point. The five specifically protected files were byte-for-byte unchanged.

The inventory was regenerated last because it explicitly admits current
redesign files and seals grouped path counts/digests. Its 33 groups account for
365 tracked and admitted paths. Catalog validation then proves every tracked and
admitted path is assigned exactly once.

## Limitations and unavailable validators

The following were not run or claimed:

- `gh skill publish --dry-run`, because local GitHub CLI 2.71.2 has no `skill`
  command;
- Agent Plugin, native wrapper, npm package, or marketplace validation, because
  no manifest or release artifact exists;
- paid or unavailable client installation tests;
- npm organization membership, package permission, or trusted-publisher setup;
- application/framework fleet pilots;
- package, archive, installation, publication, canary, update, or rollback.

The fixture archive is deliberately a bounded JSON test format. It proves safe
path/digest handling for the foundation; it is not a release archive format.
A green result establishes only the catalog, inventory, fixture materializer,
and bootstrap contract described here.

## Post-foundation authority and integrity update — 2026-08-20

Option A+ was accepted after the historical foundation run and recorded on
[Workflows#68](https://github.com/Cratis/Workflows/issues/68#issuecomment-5363284054)
and the
[organization epic](https://github.com/Cratis/.github/issues/24#issuecomment-5363284173).
The catalog now records that architecture as accepted while keeping live
materialization and runtime eligibility false because no target is approved.

The repository advanced from `158bcab` to
`b795d5307e20f7f7458a67708b4f26975e223796` through the Ensemble vocabulary and
vertical-slice whitespace pull requests. The foundation generator now binds
source records to that immutable baseline. Semantic validation verifies exact
source-directory closure and recomputes the digest from both current files and
the immutable revision tree. Local evidence reports carry an exact repository
path and SHA-256 digest.

The repository inventory now distinguishes its immutable base revision from the
current index: it records the complete base delta and a SHA-256 digest over all
index entries except its own generated output. This keeps clean tracked
checkouts representable without self-referential hashes.

Independent review added regressions for approval gating, dangling evidence,
archive byte/entry/total limits, canonical Base64, invalid UTF-8, expanded
secret/private-address detection, and cleanup after late validation failure.
The refreshed isolated-worktree suite passes 47 Node specifications. The pinned
`verify-ai-corpus.yml` workflow reproduces generation, catalog validation,
specs, strict JSON parsing, corpus validation, and whitespace checks on pull
requests.

This remains catalog, inventory, fixture-materializer, context-bootstrap, and
repository-validation evidence only; no plugin, package, distribution
repository, marketplace, or release conformance is claimed.
