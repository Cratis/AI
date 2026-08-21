# Capability catalog v2 model

**Status:** Authoring and review contract; no runtime approval

## Purpose

Catalog v2 separates shared ecosystem vocabulary from target-local behavior and
safety decisions. Shared facts are normalized once. A resolved target still
contains every fact needed to review its invocation, applicability, trust,
effects, dependencies, source authority, evidence, and approval.

This is a safety-local hybrid: normalization must not make a reviewer traverse a
large graph to discover whether a capability can write, publish, use a
credential, or run code.

## Authored registries

The following files are manually reviewed source:

- `catalog/v2/taxonomy.json` — closed identifiers for products, languages,
  architectures, personas, surfaces, repository profiles, trust, effects, and
  dependency behavior;
- `catalog/v2/source-contracts.json` — product repositories that may become
  authoritative for exact subjects after revision and digest verification;
- `catalog/v2/bundles.json` — explicit review-bundle roots and known capability
  gaps;
- `catalog/v2/upstream-companions.json` — direct-upstream companion metadata
  whose `bytesIncluded` value is always `false`.

Generated targets, evidence, coverage, migrations, artifacts, sources, and
repository inventory remain derived from the existing generators. Authored
registries are never overwritten by generation.

## Target-local safety fields

Every target records:

- capability kind and invocation class;
- lifecycle;
- explicit architecture, persona, surface, and repository-profile
  applicability;
- passive or executable trust plus assessed effects, confirmation, and
  independently evidenced authorization;
- typed hard, soft, or optional target, tool, internal-artifact, and
  project-context dependencies with explicit missing behavior;
- authoritative source-contract references and required authority subjects;
- existing trigger, collision, security, evaluation, approval, and runtime
  fields.

Capability kind, invocation, trust, approval, publication, and runtime
permission are independent. None implies another.

## Migration without guesses

Current targets are migrated with explicit `unclassified` values for every new
decision that lacks reviewed evidence. They remain candidates, carry no typed
dependency edge or source-contract claim, and stay runtime-ineligible.

An approved target must classify every new field, assess trust and effects,
classify dependency edges, bind source contracts, pass existing evaluation and
security gates, and carry exact approval evidence. Empty or unclassified values
never mean “all,” “none,” or “safe.”

## Dependency behavior

Typed dependency combinations are closed:

| Strength | Missing behavior |
| --- | --- |
| hard | block |
| soft | degrade or substitute |
| optional | omit |

Hard target dependencies and substitute chains cannot cycle. Substitution cannot
select the missing dependency, the owning target, or an upstream companion.
Bundles contain explicit target IDs; taxonomy selectors cannot expand them
silently. Hard closure must be listed, and selected soft or optional targets
must be reachable from bundle roots. Draft review bundles may name candidates
but are never publishable. A publishable bundle requires approved runtime
targets and no unresolved capability gap.

## Product source contracts

Cratis AI owns capability composition, evaluation, approval, and generation.
Product and client repositories own their current APIs, versions, examples, and
contributor facts.

A source contract begins `unverified` and cannot supply distribution input. It
must later bind an immutable revision, content digest, verification date, and
revision-matching repository evidence before that flag can change. Verified
contracts cannot overlap for the same product/subject authority. A classified
target names required authority subjects, and its selected contracts must cover
every target product and subject. Private Studio implementation is not a source
contract.

## Upstream companions

Companion records preserve URL, revision, version, license, owner, host, trust,
dependencies, collisions, and review expiry. They cannot satisfy a Cratis target
dependency, establish Cratis source authority, enter a bundle file list, or
contribute bytes. Installation remains an explicit direct relationship between
the user and upstream owner.

## Determinism and scale

Catalog ordering uses one ordinal comparator rather than process locale. Hard
and substitute cycle detection is iterative, including deep graphs. Immutable
source provenance loads each Git revision once and resolves its blobs through a
single batch process, keeping validation practical as the catalog grows.
Repository inventory uses set membership for bounded path checks.

## Claims

This model proves representability and fail-closed migration only. It does not
approve a capability, create a public artifact, validate a plugin or package,
or authorize runtime execution.
