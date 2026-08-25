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
  whose `bytesIncluded` value is always `false`;
- `catalog/evidence.json` — reusable source locators separated from exact,
  validity-bounded observations, legacy fact bindings and non-supporting local
  gaps, plus digest inventory for every `distribution/evidence/*.json` file;
- `catalog/support-policy.json` — the explicit `asOf` date, evidence classes,
  monotonic technical tiers, assurance requirements, and orthogonal marketplace
  listing policy.

Generated targets, the transition `catalog/v2/evidence.json` projection,
coverage, support, migrations, artifacts, sources, and repository inventory
remain derived from the existing generators. Authored registries are never
overwritten by generation.

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

## Normalized evidence

An evidence source is a reusable locator and immutable revision or digest where
one exists. An observation binds that source to exactly one ecosystem,
artifact, output, profile, target, source contract, repository, host, or release.
It records the exact version, digest, harness, host version, assertion scope,
environment, observation date, inclusive validity end, limitations, evidence
class, and supersession history that are actually known. Missing values are not
inferred.

The 83 S0/S1 evidence IDs remain observation IDs in the authored catalog. The
110 legacy fact IDs bind only the minimum exact observations that currently
support each claim. The 11 legacy `localEvidence` strings remain explicit,
non-supporting gaps until immutable reports carry the command and transcript
requirements. Every distribution evidence JSON file is indexed by repository
path and SHA-256 as either supporting a named observation or inventory-only.
Historical files are never rewritten, and the source-evidence contract under
`evidence/source-evidence/contracts/v1` remains independent.

An observation is active only when `observedOn <= asOf <= validThrough`.
Expired and future observations stay visible as history but cannot satisfy a
gate. A supporting install-or-higher assertion requires exact command `argv`,
exit code, host/client version, artifact version and digest, environment, and
report or transcript digest. Behavior additionally requires discovery,
positive, and negative or near-miss evidence. Lifecycle requires install,
update, rollback, uninstall, and project-context preservation. Synthetic
fixtures can never satisfy install-tested or a higher tier.

## Computed technical support

`catalog/v2/support.json` is computed deterministically from S1 bindings,
assurance profiles, normalized evidence, and the authored policy. Technical
ranks are monotonic and cannot skip a lower rank:

| Rank | Tier |
| ---: | --- |
| 0 | unsupported |
| 1 | documented |
| 2 | generated |
| 3 | statically-validated |
| 4 | install-tested |
| 5 | behavior-tested |
| 6 | lifecycle-tested |
| 7 | release-tested |
| 8 | supported |

Release-tested requires an immutable released artifact digest, a canary, and
ecosystem-native provenance when that provenance exists. Supported additionally
requires a named release approval and every applicable artifact assurance.
Marketplace listing is a separate status: direct/native delivery can be
supported without a marketplace, while a binding that explicitly claims
marketplace availability must carry active listing evidence.

The generator uses only the authored `asOf` date. It does not read wall-clock
time, locale, the network, environment variables, or filesystem timestamps.
Current output remains fixture-only: every support claim and every runtime,
publication, promotion, and installation eligibility gate is false.

## Claims

This model proves representability, evidence accounting, and fail-closed support
computation only. It does not approve a capability, create a public artifact,
validate a plugin or package, list one in a marketplace, or authorize runtime
execution.
