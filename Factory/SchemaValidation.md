# Native schema validation contract

`Cratis.Factory.Core` loads a caller-supplied, closed set of JSON Schema
resources and validates caller-supplied JSON instances in process. This is the
native Draft 2020-12 foundation for Factory contracts. It does not discover
repository files, infer a schema from a path or `documentKind`, evaluate Factory
policy, establish provenance or authority, or grant permission to execute
anything.

The supported boundary is immutable UTF-8 bytes plus explicit, language-neutral
schema identifiers. Core has no filesystem, network, process, Git, provider,
credential, environment, or source-writing capability. An `https` identifier is
an identifier only. It is never permission to retrieve a resource.

The native schema-validation slice is independently accepted. The confirmed
JsonSchema.Net 8.0.5 embedded-resource build failure is contained by the
accepted private static-rebasing design: Factory preflights every edge, builds
each resource through inert Factory-owned `$id` and `$anchor` handlers and a
fresh complete local registry with `Fetch = null`, then structurally verifies
the built edge set and exact local targets before publication. This design does
not use package-global state, reflection, lazy evaluation, a package fork, or a
change to accepted schema semantics.

The accepted language-neutral corpus contains 63 reusable schema documents,
135 cases, and 24 deterministic generator kinds. Its manifest
self-hash is
`sha256:1f6d84143094f33a440dbadbcc1d77e2c66cd2454b2b165825e8e32b88fafbb5`;
the raw file SHA-256 is
`e1e0ad907032e679db07709a03c15c9ea86f560176ff606b62660221405ba48c`.
Final acceptance reported 107/107 permanent schema specifications in both Debug
and Release and 7,339 temporary differential comparisons with zero failures in
each configuration over identical bytes. The complete `Factory.Core.Specs`
project passed 149/149 in each configuration. Build and specification evidence
is no longer macOS-only: the `Factory .NET libraries` CI job runs the Release
build, the Debug build, and the specs on both `ubuntu-latest` and
`windows-latest`, and Linux has already reported green. Trim and NativeAOT
evidence is a separate and much narrower claim, and it is still macOS arm64 only
— it comes from a local sandbox pinned to `osx-arm64` that no workflow runs, so
trim and NativeAOT execution on Windows and Linux does remain pending. Exact
maximum work is bounded per call, while hosts remain responsible for aggregate
work and concurrency.

## Loading a resource set

Callers construct `SchemaDocument` values and pass them to
`SchemaResourceSet.Load`. A document defensively copies its input bytes. Loading
returns a `SchemaLoadResult`; expected input failures are typed results, not
package exceptions. An oversized document retains only the canonical maximum
plus one rejection sentinel byte, so construction cannot allocate an unbounded
second copy before the typed input-size rejection.

Every document is parsed through Factory canonical JSON version 1. An object
schema must declare the exact Draft 2020-12 dialect and a top-level `$id` equal
to its caller-supplied logical identifier. A Boolean schema cannot carry `$id`,
so its required caller-supplied logical identifier is its resource identity.
Identifiers are absolute, fragment-free, query-free HTTPS URI strings within
the bounded printable-ASCII identifier syntax. Percent encoding carries any
non-ASCII URI data without putting Unicode formatting controls into typed
output. Source paths and the current working directory are never identities.

Loading walks only positions that Draft 2020-12 defines as schemas. A member
named `$ref`, `$id`, or `$anchor` inside instance-valued data such as `const` or
`enum` is data, not a schema declaration. The walk discovers embedded resources,
anchors, and reference edges; resolves relative identifiers against their
current resource; and rejects duplicate resources or anchors, malformed targets,
unsupported required vocabularies, and unresolved references before publishing
the set.

All absolute references must resolve to resources in the supplied set. Named
anchors and JSON Pointer fragments must resolve inside that closure. Repeated
references and productive recursive schemas are supported. A reference cycle
that can repeat without descending to a child instance location is rejected
before evaluation, preventing direct or mutual `$ref` recursion from exhausting
the process stack.

Package resolution is not closure authority. Core verifies every target first,
rewrites the private validator copy to exact pointers within the already
admitted documents, and supplies a private, isolated, per-document local
registry. Process-global package registrations and fetch hooks cannot affect
resolution or substitute for an explicit resource. Original bytes and their
canonical hashes remain unchanged.

Core finalizes successful schema construction structurally rather than by
evaluating a warm-up instance. Core traverses the private built
graph, verifies every reference has exactly one resolved local subschema with
the expected source and base identity, and verifies each selected resource root
against admitted bytes. Per-resource rebasing prevents the package's premature
embedded-root registration behavior from bypassing this finalizer.

The published set and its ordered resource descriptors are immutable and safe
for parallel reads. `GetClosure` selects a root closure without evaluating an
instance. A closure follows every schema-applicator and reference edge reachable
from that root. Crossing a nested `$id` therefore admits that embedded resource
and its dependencies. Once a resource is admitted, every reference it owns is
closed transitively, including references declared in a dormant definition;
their targets can never be substituted later. An embedded sibling that cannot
be reached from the selected root remains outside the closure. `Validate`
accepts the resolved identifier of either a top-level or embedded resource as
its root.

## Supported Draft 2020-12 surface

The slice implements the vocabularies and keywords required by the committed
Factory v1 and v2 contracts:

- core and references: `$schema`, `$id`, `$ref`, `$defs`, `$anchor`, and
  `$vocabulary` admission;
- applicators: `additionalProperties`, `allOf`, `anyOf`, `contains`, `else`,
  `if`, `items`, `not`, `oneOf`, `properties`, `then`, and
  `unevaluatedProperties`;
- assertions: `const`, `enum`, `format`, `maxItems`, `maxLength`, `maximum`,
  `minItems`, `minLength`, `minimum`, `pattern`, `required`, `type`, and
  `uniqueItems`;
- annotations: `description`, `title`, and unknown non-vocabulary annotation
  members such as `x-cratis-multiline`.

Known Draft 2020-12 validation or applicator keywords outside this surface fail
closed as unsupported instead of being silently treated as annotations. Dynamic
references and dynamic anchors are not part of this slice.

Draft 2020-12 declares the format-annotation vocabulary. The temporary Python
environment nevertheless asserts formats for which optional checker packages
happen to be installed. Its discovered environment asserts `uuid` but not
`uri` or `date-time`. The native contract makes that behavior explicit and
stable: canonical hyphenated UUID strings are asserted; `uri`, `date-time`, and
other formats remain annotations.

Regular expressions use a bounded Factory handler rather than the wrapped
package's unbounded default. Patterns supported by the non-backtracking engine
are evaluated without backtracking. The three versioned lookaround forms used
by the committed Factory schemas are evaluated by deterministic linear scans,
without a regular-expression engine. Other lookaround, backreference, and
unsupported forms fail during schema loading.

## Stable results and diagnostics

Factory-owned result, status, severity, and diagnostic-code types are the only
public contract. JsonSchema.Net types, localized messages, exception text, raw
values, property names, source paths, and caller input ordinals are not exposed.

Instance and keyword locations use privacy-preserving structural pointers:

- `#` is the document root;
- array positions are nonnegative decimal segments;
- allowlisted schema-keyword segments remain readable in keyword locations;
- every object-member or other untrusted segment is `@` followed by the full
  lowercase SHA-256 digest of its UTF-8 value.

Hashing a segment preserves equality and ordering without disclosing its text.
Diagnostics are ordered ordinally by schema identifier, instance location,
keyword location, diagnostic code, diagnostic status, and severity. The order
does not depend on package traversal order, culture, filesystem enumeration, or
the current working directory.

## Resource limits

These are interim weighted-candidate limits, not historical Python behavior or
an independently accepted final boundary.

| Resource | Inclusive maximum |
| --- | ---: |
| Caller-supplied schema documents | 64 |
| Aggregate supplied schema bytes | 8,000,000 |
| Top-level plus embedded resources | 256 |
| Anchors | 1,024 |
| Reference edges | 512 |
| Consecutive non-instance-consuming reference depth | 64 |
| Schema positions across the resource set | 16,384 |
| Instance JSON values admitted for validation | 65,536 |
| Weighted validation work units per call | 32,767 |
| Instance JSON values for rich diagnostics | 4,096 |
| Weighted rich-diagnostic work units per call | 4,095 |
| Diagnostics returned by one operation | 256 |
| Identifier scalar values | 2,048 |
| Reference scalar values | 2,048 |
| Anchor scalar values | 256 |
| Pattern scalar values | 2,048 |

Each individual schema and instance also retains all accepted canonical JSON v1
limits, including 2,000,000 input and canonical bytes and container depth 64.
The language-neutral corpus binds every maximum and maximum-plus-one case.
Exceeding a closure, parsing, pattern, or diagnostic boundary produces a typed
rejection or bounded-failure status. Diagnostic truncation is never reported as
an ordinary complete invalid result.

## Weighted evaluation boundary

Before package evaluation, Core walks the actual instance and the selected
schema evaluation graph. A state is one actual-instance node paired with one
schema position. When distinct schema paths converge on the same state, their
path multiplicities are added and the state's cost is charged by that
multiplicity. This preserves the work of acyclic branching and reconverging
references instead of counting only unique reachable schema positions.

Schema edges select actual instance values as follows:

| Schema edge | Actual instance selection |
| --- | --- |
| References and same-instance applicators | The current value |
| A schema under `properties` | The matching named object member |
| `items` and `contains` | Every actual array item |
| `additionalProperties` | Actual object members not declared by `properties` |
| `unevaluatedProperties` | Every actual object value, conservatively |

`ValueCost` is the number of JSON values in a value's subtree plus one unit per
started 64 canonical UTF-8 bytes. Every reached schema position costs at least
one unit. `const` and `enum` add the `ValueCost` of compared schema and instance
values. Active `minLength`, `maxLength`, `pattern`, and asserted `uuid` checks
add string-scan units. `required`, `properties`, `additionalProperties`, and
`unevaluatedProperties` add weights for actual object-member counts and UTF-8
property-name scans; `unevaluatedProperties` also accounts for prior results on
the same instance. `uniqueItems` adds each actual array item's `ValueCost`. The
maximum weighted work observed across the committed schemas and examples is
18,894 units.

The private `SafeUniqueItems` handler canonicalizes each item, hashes it with
SHA-256, verifies exact canonical bytes on a digest match, and charges the
item's `ValueCost` to the runtime budget. The private reference handler also
charges every executed `$ref`. These runtime charges are backstops around the
package evaluation, not substitutes for the weighted preflight calculation.

The 32,767 validation and 4,095 rich-diagnostic work limits apply to each
`Validate` call. Core does not impose a process-wide concurrency or aggregate
work budget; hosts must bound concurrent calls and aggregate work according to
their own capacity and policy.

## Integrity identities

Each admitted document has the accepted canonical JSON content hash. The schema
set identity hashes a canonical manifest with algorithm
`factory-schema-resource-set-v1`, sorted logical document IDs, and their
canonical content hashes. A selected closure uses
`factory-schema-closure-v1` and additionally binds its root resource ID and the
sorted documents containing reachable resources. Closure resource, anchor, and
reference counts cover only those reachable resources; a containing document's
hash still binds every byte in that document. This composition remains within
the canonical JSON v1 output bound even when the aggregate supplied schema
bytes are at their maximum.

These hashes establish byte integrity and deterministic membership only. They do
not establish who authored a schema, whether the repository is authoritative,
whether an instance is semantically correct, whether policy approves it, or
whether any capability may execute.

## Package and migration boundary

JsonSchema.Net 8.0.5 is centrally pinned as the final MIT-licensed release
before the package changed to the OSMFEULA license in 9.0.0. Its
types and default pattern/format behavior remain internal implementation
details. The dependency must be reconsidered through the same conformance,
license, security, trimming, and NativeAOT gates before any upgrade.

Permanent .NET specifications consume the language-neutral schema corpus
without Python. `Factory/Migration/SchemaValidationParity` is a separate,
non-packable, non-publishable maintainer tool outside `Planner.slnx`; it compares
the same bytes and every material Factory-owned fact with the temporary Python
oracle. Schema parity is accepted, but deleting this migration tool or the Stage
0 Python validator is not authorized until every remaining native #67 behavior
has independent acceptance. Keep the language-neutral vectors and permanent
native specifications.
