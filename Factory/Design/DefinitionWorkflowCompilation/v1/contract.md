<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Definition and workflow compilation contract v1

Status: proposed contract freeze for independent architecture and security review. This document is not implementation or acceptance evidence.

## Verdict boundary

This version defines one pure, in-memory `Factory.Core` operation. A caller supplies an already accepted immutable `SchemaResourceSet`, an enumerable of immutable `DefinitionDocument` values, and the exact workflow identifier to select. The compiler routes 13 definition kinds to exact admitted schema resources, validates every definition, compiles the selected workflow's dependency and capability semantics, and returns deterministic Factory-owned output.

This version does not discover a repository, read paths, resolve profiles, narrow policy, grant authority, materialize a snapshot, run preflight, recommend a workflow, evaluate a repository, invoke a CLI, schedule phases, call a provider, resolve credentials, approve an operation, publish, or write source. Those behaviors remain deferred to #48 and later #67 slices.

## Public ABI

All types below are in `Cratis.Factory.Definitions`. Public collection properties are backed by a fresh `ReadOnlyCollection<T>` over a private array. No public constructor accepts or retains a mutable collection. `Sha256Hash`, `CanonicalJsonValue`, `CanonicalJsonFailureCode`, `SchemaDiagnosticCode`, and `SchemaResourceSet` are the accepted existing Factory-owned types.

```csharp
public enum DefinitionKind
{
    Unknown = 0,
    CapabilityCatalog = 1,
    EvaluationCatalog = 2,
    Policy = 3,
    Profile = 4,
    ProjectManifest = 5,
    Workflow = 6,
    AgentContext = 7,
    ArtifactDescriptor = 8,
    ArtifactProvenance = 9,
    ArtifactReceipt = 10,
    PhaseEnvelope = 11,
    RunInputSet = 12,
    SanitizationAttestation = 13
}

public sealed class DefinitionDocument
{
    public DefinitionDocument(string? logicalId, DefinitionKind kind, ReadOnlySpan<byte> utf8);
    public string LogicalId { get; }
    public DefinitionKind Kind { get; }
    public ReadOnlySpan<byte> Utf8 { get; }
    public byte[] ToArray();
}

public static class DefinitionCompiler
{
    public static Sha256Hash AcceptedSchemaSetIdentity { get; }
    public static bool TryGetSchemaId(
        DefinitionKind kind,
        [NotNullWhen(true)] out string? schemaId);
    public static DefinitionCompilationResult Compile(
        SchemaResourceSet? schemas,
        IEnumerable<DefinitionDocument>? definitions,
        string? workflowId);
}

public enum DefinitionCompilationStatus
{
    Compiled = 0,
    Rejected = 1,
    DiagnosticLimitExceeded = 2,
    EvaluationLimitExceeded = 3
}

public sealed class DefinitionCompilationResult
{
    public DefinitionCompilationStatus Status { get; }
    public string WorkflowId { get; }
    public Sha256Hash? SchemaSetIdentity { get; }
    public Sha256Hash? DefinitionSetIdentity { get; }
    public IReadOnlyList<DefinitionDescriptor> Definitions { get; }
    public CompiledWorkflow? Workflow { get; }
    public IReadOnlyList<DefinitionDiagnostic> Diagnostics { get; }
}

public sealed record DefinitionDescriptor(
    string LogicalId,
    DefinitionKind Kind,
    string SchemaId,
    Sha256Hash SchemaClosureIdentity,
    Sha256Hash ContentHash);

public enum WorkflowPhaseKind
{
    Unknown = 0,
    Human = 1,
    Agent = 2,
    Code = 3
}

public sealed class CompiledPhaseDescriptor
{
    public string Id { get; }
    public int Ordinal { get; }
    public WorkflowPhaseKind Kind { get; }
    public IReadOnlyList<string> Needs { get; }
}

public sealed class CompiledWorkflow
{
    public string Id { get; }
    public string Version { get; }
    public Sha256Hash SourceContentHash { get; }
    public Sha256Hash ContentHash { get; }
    public IReadOnlyList<CompiledPhaseDescriptor> OrderedPhases { get; }
    public IReadOnlyList<string> RequiredGateIds { get; }
    public string SuccessPhase { get; }
    public CanonicalJsonValue Normalized { get; }
    public ReadOnlySpan<byte> Utf8 { get; }
    public byte[] ToArray();
    public void WriteTo(IBufferWriter<byte> destination);
}

public enum DefinitionDiagnosticSeverity
{
    Error = 0
}

public enum DefinitionDiagnosticStatus
{
    Violation = 0,
    Rejected = 1,
    LimitExceeded = 2
}

public enum DefinitionDiagnosticCode
{
    SchemaSetRequired = 0,
    SchemaSetNotAccepted = 1,
    NoDefinitions = 2,
    DefinitionLimitExceeded = 3,
    AggregateDefinitionBytesLimitExceeded = 4,
    DefinitionEnumerationFailed = 5,
    InvalidDefinitionLogicalId = 6,
    DuplicateDefinitionLogicalId = 7,
    UnsupportedDefinitionKind = 8,
    CanonicalDefinitionRejected = 9,
    DefinitionSchemaRejected = 10,
    DefinitionSchemaViolation = 11,
    DefinitionEvaluationLimitExceeded = 12,
    InvalidWorkflowId = 13,
    WorkflowNotFound = 14,
    DuplicateWorkflowId = 15,
    DuplicateWorkflowInputId = 16,
    DuplicatePhaseId = 17,
    DuplicatePhaseInputName = 18,
    DuplicateGateId = 19,
    DuplicateCapabilityId = 20,
    WorkflowInputLimitExceeded = 21,
    CapabilityLimitExceeded = 22,
    PhaseLimitExceeded = 23,
    PhaseInputLimitExceeded = 24,
    GateLimitExceeded = 25,
    DependencyEdgeLimitExceeded = 26,
    SemanticWorkLimitExceeded = 27,
    UnknownDependency = 28,
    DependencyCycle = 29,
    UnknownWorkflowInput = 30,
    UnknownProducerPhase = 31,
    ProducerNotAncestor = 32,
    UnknownCapability = 33,
    UnsupportedCapabilityUsage = 34,
    UnsupportedCapabilityGateKind = 35,
    UnknownSchemaReference = 36,
    UnknownCorrectionTarget = 37,
    CorrectionTargetNotAncestor = 38,
    AcceptanceUnknownGate = 39,
    AcceptanceMissingRequiredGate = 40,
    AcceptanceIncludesNonRequiredGate = 41,
    UnknownSuccessPhase = 42,
    SuccessPhaseHasDependents = 43,
    PhaseDoesNotLeadToSuccess = 44,
    UnsupportedPhaseScope = 45,
    NormalizedOutputLimitExceeded = 46,
    DiagnosticLimitExceeded = 47
}

public sealed record DefinitionDiagnostic(
    DefinitionDiagnosticCode Code,
    DefinitionDiagnosticSeverity Severity,
    DefinitionDiagnosticStatus Status,
    string LogicalId,
    string Location,
    string RelatedId,
    CanonicalJsonFailureCode? CanonicalCode,
    SchemaDiagnosticCode? SchemaCode);
```

`WriteTo(null)` throws `ArgumentNullException`. A non-null `IBufferWriter<byte>` receives the complete `Utf8` sequence in one or more ordinary `GetSpan`/`Advance` operations; an exception thrown by that caller-owned writer is propagated unchanged. `DefinitionDocument` construction, `ToArray`, and `WriteTo` remain subject to ordinary CLR allocation failure. `TryGetSchemaId`, `Compile`, and every property getter are otherwise total for every runtime-representable input, including `null` arguments, `null` sequence elements introduced through nullable-oblivious code, and enumerators that throw. An enumeration exception is non-fatal unless it is `OutOfMemoryException`, `StackOverflowException`, or `AccessViolationException`; those three process/resource failures are propagated and are outside the result contract. No other caller-data condition throws.

`DefinitionDocument` stores `logicalId ?? string.Empty`, stores `kind`, and defensively copies at most 2,000,001 bytes. The retained maximum-plus-one byte gives the compiler an exact oversized-document sentinel without retaining an unbounded caller buffer. `Utf8`, `CompiledWorkflow.Utf8`, and `CanonicalJsonValue.Utf8` are read-only views of private arrays; every `ToArray` returns a new array. The compiler never retains caller arrays, enumerable instances, enumerators, `JsonDocument` instances, or mutable collection references.

## Exact routes

`TryGetSchemaId` returns `false`, assigns `null`, and performs no other work for `Unknown` and every out-of-range enum value. It returns the following exact identifiers for the closed set:

| Kind | Exact schema resource |
| --- | --- |
| `CapabilityCatalog` | `https://schemas.cratis.io/factory/v1/capability-catalog.schema.json` |
| `EvaluationCatalog` | `https://schemas.cratis.io/factory/v1/evaluation-catalog.schema.json` |
| `Policy` | `https://schemas.cratis.io/factory/v1/policy.schema.json` |
| `Profile` | `https://schemas.cratis.io/factory/v1/profile.schema.json` |
| `ProjectManifest` | `https://schemas.cratis.io/factory/v1/project-manifest.schema.json` |
| `Workflow` | `https://schemas.cratis.io/factory/v1/workflow.schema.json` |
| `AgentContext` | `https://schemas.cratis.io/factory/v2/agent-context.schema.json` |
| `ArtifactDescriptor` | `https://schemas.cratis.io/factory/v2/artifact-descriptor.schema.json` |
| `ArtifactProvenance` | `https://schemas.cratis.io/factory/v2/artifact-provenance.schema.json` |
| `ArtifactReceipt` | `https://schemas.cratis.io/factory/v2/artifact-receipt.schema.json` |
| `PhaseEnvelope` | `https://schemas.cratis.io/factory/v2/phase-envelope.schema.json` |
| `RunInputSet` | `https://schemas.cratis.io/factory/v2/run-input-set.schema.json` |
| `SanitizationAttestation` | `https://schemas.cratis.io/factory/v2/sanitization-attestation.schema.json` |

The admitted document's `$schema` and `documentKind` are schema-constrained facts, never routing authority. The caller's enum selects the route. This slice does not add or weaken a schema.

The only accepted schema set has identity `sha256:0c0d49351caaf538c37ac785d03cec872f8ed6dde1a02257aef7e6f265390d99`, exactly 29 top-level documents, 29 resources, 369 reference edges, and zero anchors. `Compile` compares the identity, document/resource/reference/anchor counts, every sorted document descriptor, every sorted resource descriptor, and all 13 successful closures against the frozen values in `corpus.json`. An identity match alone is insufficient. A mismatch returns `SchemaSetNotAccepted` and never validates a definition.

## Limits and accounting

All maxima are inclusive:

| Limit | Maximum |
| --- | ---: |
| Definitions | 256 |
| Aggregate retained definition bytes | 8,000,000 |
| Bytes retained by one definition | 2,000,001; 2,000,000 is admissible canonical input |
| Unicode scalars in a logical ID or requested workflow ID | 256 |
| Capabilities across all catalogs | 16 |
| Workflow inputs in the selected workflow | 16 |
| Phases in the selected workflow | 16 |
| Phase inputs across the selected workflow | 64 |
| Gates across the selected workflow | 32 |
| Dependency edges across the selected workflow | 64 |
| Semantic work units | 256 |
| Returned diagnostics | 256 |
| Normalized canonical bytes | 2,000,000 |

These semantic maxima are deliberately below the accepted canonical and schema-validation work ceilings. The exact maximum and maximum-plus-one documents in the corpus both pass the accepted routed schema before the compiler applies its own count. This prevents an underlying `CanonicalDefinitionRejected` or `DefinitionEvaluationLimitExceeded` from making a compiler limit unreachable. The accepted workflow schema's larger `phases.maxItems = 4096` is unchanged.

Semantic work is measured once after complete schema admission and before semantic diagnostics. Use saturating integer arithmetic and stop at 257. The exact formula is:

```text
definitions
+ capabilities
+ workflowInputs
+ phases
+ (4 * phaseInputs)
+ (4 * gates)
+ (3 * dependencyEdges)
+ corrections
+ (2 * acceptanceIds)
```

The ten corpus generators bind count, byte, scalar, and work maximum/maximum-plus-one behavior. A host remains responsible for aggregate concurrency and process-wide admission. Core limits are per call.

## Totality, precedence, and partial results

The compiler executes these stages in order:

1. Check `schemas` for null and exact accepted-set equivalence. Null returns `SchemaSetRequired` and a null schema-set identity. A non-null mismatch returns `SchemaSetNotAccepted` and that supplied set's `Identity`. Both return empty workflow ID, no definition identity/descriptors/workflow, and perform no enumeration.
2. Validate `workflowId`. Null, empty, unsafe, non-kebab-case, control-bearing, or over-256-scalar values become an empty public workflow ID and return `InvalidWorkflowId` without enumerating definitions.
3. Enumerate definitions exactly once into private bounded copies. A null or empty enumerable returns `NoDefinitions`. A null element is retained as an invalid-element marker. If `GetEnumerator`, `MoveNext`, `Current`, or `Dispose` throws a non-fatal exception, discard every retained element and return only `DefinitionEnumerationFailed`; this dominates even a limit already observed before `Dispose`. Never echo exception type, message, data, or stack. Stop at the first element proving the definition-count or aggregate-byte limit, dispose the enumerator, and do not call `MoveNext` again. If both limits become provable on that element, return both sorted limit diagnostics. No content diagnostic survives a collection-limit result.
4. Admission checks every retained element in source ordinal order but publishes diagnostics only in the global sort order. A null element maps only to `InvalidDefinitionLogicalId` with empty logical ID. Check safe logical ID, duplicate logical ID, supported kind, canonical JSON, and exact routed-schema validation. Unsupported kinds are not parsed or schema-validated. Schema validation is attempted only after canonical parsing succeeds. An invalid logical ID is never copied to any diagnostic field; its own and any compound content diagnostics use empty `LogicalId`. It is still checked for kind/canonical/schema safety. Duplicate IDs do not suppress the members' other admission checks. Any admission failure publishes no descriptors, no definition-set identity, and no workflow.
5. After every definition is admitted, publish descriptors and definition-set identity, then select exactly one workflow whose admitted JSON body `id` equals the requested workflow ID. Zero matches returns `WorkflowNotFound`; more than one returns `DuplicateWorkflowId`. Both retain the complete descriptors and definition-set identity.
6. Measure structural counts and semantic work before graph traversal. Every exceeded structural limit is reported; `SemanticWorkLimitExceeded` is reported after the structural diagnostics. Any such limit short-circuits semantic checks and normalized output.
7. Run semantic passes in the exact order below, accumulating independent failures. A pass skips only a check whose prerequisite is invalid as explicitly stated. Semantic rejection retains the complete descriptors and identity but has no workflow.
8. Normalize only when no diagnostic exists. If canonical output would exceed 2,000,000 bytes, return `NormalizedOutputLimitExceeded`, retain descriptors and identity, and publish no workflow.

Overall status is selected after bounded diagnostic collection with this strict precedence:

```text
any DefinitionEvaluationLimitExceeded or schema EvaluationLimitExceeded
    => EvaluationLimitExceeded
else any diagnostic overflow or schema DiagnosticLimitExceeded
    => DiagnosticLimitExceeded
else any diagnostic
    => Rejected
else
    => Compiled
```

The compiler tracks evaluation-limit and overflow facts independently of retained diagnostic membership. Therefore an evaluation-limit diagnostic evicted by the bounded ordinal set still selects `EvaluationLimitExceeded`; the corpus case `evaluation-wins-over-diagnostic-overflow` freezes that compound result.

Native schema projection is exact. `Valid` contributes nothing. For `Invalid`, emit one `DefinitionSchemaViolation` per native diagnostic. For `Rejected`, emit one `DefinitionSchemaRejected` per native diagnostic. For `EvaluationLimitExceeded`, emit one `DefinitionEvaluationLimitExceeded` per native diagnostic. Each projection has the definition logical ID, location `definitions/schema`, empty related ID, null canonical code, and the exact native `SchemaDiagnosticCode`; native instance/keyword locations and prose are discarded. For `DiagnosticLimitExceeded`, project every available non-sentinel native diagnostic by its native status (`Violation` to `DefinitionSchemaViolation`, `Rejected` to `DefinitionSchemaRejected`, `LimitExceeded` to `DefinitionEvaluationLimitExceeded`), discard the native `DiagnosticLimitExceeded` entry, and add the single global sentinel below. A malformed native result with no diagnostic still produces one matching Factory code with null `SchemaCode`, so schema failure can never disappear. `EvaluationLimitExceeded` wins over simultaneous rejection or diagnostic overflow.

All diagnostic severities are `Error`. `DefinitionSchemaViolation` has diagnostic status `Violation`. The twelve limit codes `DefinitionLimitExceeded`, `AggregateDefinitionBytesLimitExceeded`, `DefinitionEvaluationLimitExceeded`, `WorkflowInputLimitExceeded`, `CapabilityLimitExceeded`, `PhaseLimitExceeded`, `PhaseInputLimitExceeded`, `GateLimitExceeded`, `DependencyEdgeLimitExceeded`, `SemanticWorkLimitExceeded`, `NormalizedOutputLimitExceeded`, and `DiagnosticLimitExceeded` have diagnostic status `LimitExceeded`. Every other code has diagnostic status `Rejected`.

Diagnostic collection retains the ordinally smallest 256 diagnostics in a bounded max-heap according to the global comparer. Observing a 257th distinct or repeated candidate sets overflow; thereafter replace the current greatest retained candidate only when the new candidate compares smaller. At completion, an overflowed collection removes its greatest retained candidate and adds one `DiagnosticLimitExceeded` sentinel, then globally sorts the resulting 256 diagnostics. Thus the result contains the ordinally smallest 255 candidate diagnostics plus the sentinel, input enumeration order cannot change the retained multiset, and truncation is explicit. The sentinel has empty identifiers, location `diagnostics`, no component codes, and `LimitExceeded` status; it is not forcibly last.

The global comparer is: `LogicalId` ordinal, `Location` ordinal, numeric `Code`, `RelatedId` ordinal, nullable numeric `CanonicalCode` (`null` first), then nullable numeric `SchemaCode` (`null` first). Severity and status are fixed by code and are not additional ties. Repeated equal diagnostics are retained; multiplicity is material.

## Semantic passes

All identifiers used in public diagnostics have already passed the schema's kebab-case constraint. Locations are fixed vocabulary plus safe IDs; raw values, paths, descriptions, configuration values, and source ordinals are never exposed.

1. Build capabilities from every admitted catalog sorted by descriptor order and catalog array order. Duplicate capability IDs produce `DuplicateCapabilityId` at `capabilities/<id>` and invalidate only lookup of that ID. Count all entries, including duplicates.
2. Read selected workflow inputs, phases, phase inputs, gates, dependencies, corrections, acceptance IDs, and terminal fields. Duplicate IDs/names produce their corresponding codes. A duplicated phase ID invalidates graph, producer, correction, and terminal reachability passes but does not suppress capability, schema-reference, scope, acceptance-membership, or other duplicate diagnostics.
3. Resolve every workflow and phase output schema reference by the exact grammar `../Contracts/v1/<name>.schema.json` to `https://schemas.cratis.io/factory/v1/<name>.schema.json`. The exact resource and closure must exist in the accepted set; otherwise report `UnknownSchemaReference`.
4. For a graph with unique phase IDs, report each unknown dependency, then run cycle detection over known edges. If any dependency is unknown or a cycle exists, skip ancestor-dependent producer/correction/reachability checks. Kahn ordering is still not attempted on rejection.
5. For graph-valid workflows, verify workflow-input bindings; verify phase-output producers exist and are strict transitive ancestors. A phase can never consume its own output. Unused declared workflow inputs are allowed.
6. Verify phase and gate capability references. `agent` phases require `agent` usage; `code` phases require `phase` usage; gates with a capability require `gate` usage and their exact gate kind in `allowedGateKinds`. A duplicated capability ID produces no usage verdict for that ID. Capability descriptions and output schema do not enter normalized bytes.
7. A correction target must be the current phase or an ancestor. Unknown target and non-ancestor are distinct.
8. Acceptance must equal the mathematical set of all gates whose `requiredForAcceptance` is true. Report unknown IDs, omitted required IDs, and included known non-required IDs independently.
9. The success phase must exist, have no dependents, and have every other phase as an ancestor. Skip dependent/reachability checks if the success phase is unknown or the graph is invalid.
10. `writeScopes`, `networkScopes`, and `secretScopes` must each be empty. Emit one `UnsupportedPhaseScope` per non-empty collection at `workflow/phases/<phase-id>/policy/<scope-name>`.
11. For a valid graph, use Kahn's algorithm with a min-heap ordered by `StringComparer.Ordinal` phase ID. Push initially ready IDs and newly ready IDs into the same heap. This phase-ID rule, not source-array position, is the only topological tie-break. Each emitted phase gets the zero-based ordinal.

## Diagnostic locations and component projection

General locations are `schema-set`, `workflow-id`, `definitions`, `definitions/logical-id`, `definitions/kind`, `definitions/bytes`, `definitions/schema`, `workflow`, `capabilities/<id>`, `workflow/inputs/<id>`, `workflow/phases/<id>`, `workflow/phases/<id>/inputs/<name>`, `workflow/phases/<id>/needs`, `workflow/phases/<id>/gates/<gate-id>`, `workflow/phases/<id>/correction`, `workflow/phases/<id>/output-schema`, `workflow/phases/<id>/policy/<scope-name>`, `workflow/acceptance`, `workflow/terminal`, `normalized`, and `diagnostics`.

Canonical rejection uses `definitions/bytes`, sets `CanonicalCode`, and leaves `SchemaCode` null. Schema results use `definitions/schema`, leave `CanonicalCode` null, and preserve the exact native `SchemaDiagnosticCode`. Compiler-level schema projection intentionally collapses native instance and keyword locations to prevent definition property names from becoming a second public location vocabulary; the native code remains sufficient for stable classification. All other diagnostics have both component codes null.

## Definition and closure identities

For every admitted definition, canonicalize its complete JSON value under Factory canonical JSON v1 and calculate `ContentHash` over those exact canonical bytes. Existing document `contentHash` properties are ordinary included properties in this slice; v2 self-hash verification remains deferred.

Descriptors sort by `LogicalId` ordinal and then numeric `Kind`. The definition-set identity is SHA-256 over canonical JSON with this exact shape and no self-hash field:

```json
{
  "algorithm": "factory-definition-set-v1",
  "definitions": [
    {
      "contentHash": "sha256:<lowercase>",
      "kind": 1,
      "logicalId": "example",
      "schemaClosureIdentity": "sha256:<lowercase>",
      "schemaId": "https://schemas.cratis.io/factory/v1/capability-catalog.schema.json"
    }
  ],
  "schemaSetIdentity": "sha256:0c0d49351caaf538c37ac785d03cec872f8ed6dde1a02257aef7e6f265390d99"
}
```

Every descriptor closure must be a resolved closure from the exact accepted set. Definition hashes and set identities are integrity evidence only; they do not prove origin or authority.

## Normalized output

The normalized value uses algorithm `factory-definition-workflow-compilation-v1`. It contains no description, raw definition, path, repository fact, profile, policy decision, grant, provider, role implementation, or source order except where author array order is explicitly semantic.

The exact pre-self-hash shape is:

```json
{
  "algorithm": "factory-definition-workflow-compilation-v1",
  "definitionSetIdentity": "sha256:<definition-set>",
  "protocolVersion": "1",
  "schemaSetIdentity": "sha256:<accepted-set>",
  "workflow": {
    "capabilityCatalogs": [
      { "contentHash": "sha256:<definition>", "id": "catalog-id", "version": "1.0.0" }
    ],
    "id": "workflow-id",
    "inputs": [
      {
        "id": "input-id",
        "preflightValue": "repository-snapshot",
        "schema": { "closureIdentity": "sha256:<closure>", "schemaId": "https://schemas.cratis.io/factory/v1/repository-snapshot.schema.json" },
        "source": "preflight"
      }
    ],
    "orderedPhases": [
      {
        "capabilities": [
          { "effect": "read", "id": "capability-id", "policyCapability": "policy-id", "sourceId": "phase-or-gate-id", "usage": "agent" }
        ],
        "correction": { "maxRounds": 1, "targetPhase": "phase-id", "triggers": ["output-invalid"] },
        "execution": { "capability": "capability-id", "kind": "agent", "purpose": "purpose", "role": "role" },
        "gates": [],
        "id": "phase-id",
        "inputs": [],
        "kind": "agent",
        "needs": [],
        "ordinal": 0,
        "outputSchema": { "closureIdentity": "sha256:<closure>", "schemaId": "https://schemas.cratis.io/factory/v1/phase-envelope.schema.json" },
        "policy": { "maxAttempts": 1, "networkScopes": [], "secretScopes": [], "timeoutSeconds": 60, "writeScopes": [] }
      }
    ],
    "requiredGateIds": ["gate-id"],
    "sourceContentHash": "sha256:<canonical-source-definition>",
    "terminal": { "onAttemptsExhausted": "fail-run", "onFailure": "fail-run", "successPhase": "phase-id" },
    "version": "1.0.0"
  }
}
```

Add top-level `contentHash` after calculating SHA-256 over the canonical pre-self-hash value. `CompiledWorkflow.ContentHash` is that self hash. Canonicalize the complete value including `contentHash`; those bytes are `Normalized`, `Utf8`, `ToArray`, and `WriteTo`. Corpus `normalizedHash` is SHA-256 over the complete canonical bytes and is deliberately distinct from the embedded/self `contentHash`.

Canonical object property order is Unicode code-point order from Factory canonical JSON v1. Arrays have these exact orders:

- `capabilityCatalogs`: catalog `id`, then descriptor logical ID, both ordinal.
- workflow `inputs`: author order.
- `orderedPhases`: ordinal Kahn order.
- phase `needs`: ordinal phase ID.
- phase `inputs`: author order.
- phase `gates`: author order.
- phase `capabilities`: usage, source ID, capability ID, all ordinal.
- correction `triggers`: author order; schema uniqueness is preserved.
- `requiredGateIds`: ordinal gate ID.

Omit `preflightValue` for request inputs. Omit `correction` when absent. Execution has exactly one shape: human `{approval,kind}`, agent `{capability,kind,purpose,role}`, or code `{capability,kind}`. Human `approval`, phase `policy`, phase `inputs`, and `gates` are deep-copied schema-valid JSON and canonicalized; no optional field other than the two named omissions is dropped.

## Corpus and strict loading

`corpus.json` is the only v1 design corpus. It is a language-neutral contract artifact, not a runtime fixture and not product input. Its self `contentHash` is calculated with only the top-level `contentHash` omitted. A future permanent fixture may copy these accepted bytes only after independent review.

A corpus loader must reject, before executing a case:

- malformed UTF-8/JSON, duplicate keys, non-canonical numbers/Unicode, or a mismatched self hash;
- an unknown or missing member at every object level;
- an unknown enum/token, duplicate ID, duplicate route, duplicate artifact path, or duplicate case/generator/mapping ID;
- inconsistent counts, route table, accepted-set descriptors, artifact hashes, closure identities, case expected hashes/lengths/base64, generator boundary expectation, or comparison arithmetic;
- a path outside the repository-relative allowlist, a symlink-resolved escape, or bytes whose raw/canonical hash differs;
- a case whose inline base64, raw hash, canonical hash, descriptor identity, normalized bytes, normalized self hash, normalized whole hash, or ordered diagnostics disagree.

The artifact content-addresses all 29 physical schemas and 26 physical Stage 0 definitions by repository-relative path, raw SHA-256, and canonical hash. Inline mutations carry exact base64 and raw/canonical hashes. Generated boundaries are defined solely by the ten deterministic algorithms in the corpus and never by hidden adapter code.

The exact member sets are part of the corpus protocol. The top level contains only `protocolVersion`, `documentKind`, `algorithm`, `description`, `contentHash`, `stage0OracleSnapshot`, `acceptedSchemaSet`, `limits`, `schemaRoutes`, `definitionArtifacts`, `stage0Mappings`, `generators`, `cases`, `comparisonContract`, and `declaredCounts`. Nested object shapes are:

| Object | Exact members |
| --- | --- |
| Oracle snapshot | `root`, `platform`, `files`, `pythonInvocation`, `network`, `writes` |
| Oracle file | `path`, `rawSha256`, `sizeBytes` |
| Accepted schema set | `identity`, `documentCount`, `resourceCount`, `referenceCount`, `anchorCount`, `schemas` |
| Accepted schema | `id`, `schemaId`, `path`, `rawSha256`, `canonicalHash`, `closureIdentity`, `referenceCount` |
| Limits | `definitions`, `aggregateDefinitionBytes`, `definitionBytes`, `retainedDefinitionBytes`, `logicalIdScalars`, `capabilities`, `workflowInputs`, `phases`, `phaseInputs`, `gates`, `dependencyEdges`, `semanticWorkUnits`, `diagnostics`, `normalizedBytes` |
| Route | `kind`, `kindValue`, `schemaId`, `closureIdentity` |
| Definition artifact | `id`, `logicalId`, `kind`, `path`, `rawSha256`, `canonicalHash` |
| Stage 0 mapping | `id`, `source`, `observation`, `outputField` |
| Stage 0 expected observation | `observable`, `verdict`, `orderedPhaseIds` |
| Generator | `id`, `algorithm`, `maximum`, `maximumPlusOne`, `maximumExpected`, `maximumPlusOneExpected`, `maximumStage0Expected`, `maximumPlusOneStage0Expected` |
| Explicit case | `id`, `schemaSetInput`, `workflowId`, `definitions`, `enumerationFailureAfter`, `repeat`, `parallel`, `expected`, `stage0Expected` |
| Generated case | every explicit-case member plus `generatedInput` |
| Schema-set input | `mode`, `schemaId`, `inlineBase64`, `rawSha256`, `canonicalHash`, `expectedIdentity` |
| Generated input | `generator`, `boundary` |
| Null definition input | `nullElement` |
| Artifact definition input | `logicalId`, `kind`, `artifact` |
| Inline definition input | `logicalId`, `kind`, `inlineBase64`, `rawSha256`, `canonicalHash` |
| Expected result | `status`, `schemaSetIdentity`, `definitionSetIdentity`, `descriptors`, `workflowId`, `sourceContentHash`, `contentHash`, `normalizedBase64`, `normalizedLength`, `normalizedHash`, `diagnostics`, `diagnosticCount` |
| Descriptor | `logicalId`, `kind`, `kindValue`, `schemaId`, `schemaClosureIdentity`, `contentHash` |
| Diagnostic | `code`, `codeValue`, `severity`, `status`, `logicalId`, `location`, `relatedId`, `canonicalCode`, `schemaCode` |
| Comparison contract | `nativeMaterialFields`, `nativePairings`, `languageNeutralObservations`, `nativeBaseComparisons`, `nativeRepeatCaseCount`, `nativeRepeatCallsPerCase`, `nativeRepeatBundles`, `nativeRepeatComparisons`, `nativeParallelCaseIds`, `nativeParallelCallsPerCase`, `nativeParallelDegree`, `nativeParallelBundles`, `nativeParallelComparisons`, `stage0MaterialFields`, `stage0Pairings`, `stage0ApplicableObservations`, `stage0Comparisons`, `comparisonsPerConfiguration`, `configurations` |
| Declared counts | `schemas`, `schemaRoutes`, `definitionArtifacts`, `stage0Mappings`, `stage0ApplicableObservations`, `generators`, `generatorBoundaryObservations`, `cases`, `parallelCases`, `comparisonsPerConfiguration` |

Every listed member is required. `generatedInput` is required only for the generated-case variant and forbidden on the explicit variant. `artifact`, inline byte, and null-element definition shapes are mutually exclusive. Nullable values are represented by JSON `null`, never by omission. `schemaSetInput.mode` is exactly `accepted`, `null`, or `accepted-plus-inline`: `accepted` has only the frozen identity non-null; `null` has every other member null; and `accepted-plus-inline` carries the exact canonical extra schema bytes and recomputed supplied-set identity.

Every strict-loader `id` is globally unique across schema fixtures, definition artifacts, Stage 0 mappings, generators, and cases, not merely unique within its local array. Schema fixture IDs are `schema-v1-<file-stem>` or `schema-v2-<file-stem>`; therefore the two admitted phase-envelope documents are independently named `schema-v1-phase-envelope` and `schema-v2-phase-envelope`. Schema resource IDs remain their exact HTTPS identifiers and are checked in their separate resource-identity domain.

Every serialized enum token is checked against its declared domain before a case runs. This includes definition-kind tokens and numeric values; compilation result status; diagnostic code and numeric value; severity; diagnostic status; exact `CanonicalJsonFailureCode` names; exact `SchemaDiagnosticCode` names; schema-set mode; generator boundary; and Stage 0 verdict. Component codes use the public enum member name with no prefix: duplicate JSON keys serialize as `DuplicateObjectKey`, never `CanonicalDuplicateObjectKey`. Unknown, missing, mismatched, or differently cased values reject the corpus.

The frozen case set has exactly 64 unique IDs and exact outcomes: 17 `compiled`, 44 ordinary `rejected`, two `evaluation-limit-exceeded`, and one `diagnostic-limit-exceeded`. It includes null and structurally nonaccepted schema sets, throwing enumeration, null elements, compound admission and semantic failures, all 13 routes, every requested semantic rejection family, exact diagnostic overflow multiplicity, exact evaluation-limit projection, and a compound case proving evaluation-limit status wins even when bounded output retains only the global diagnostic-overflow sentinel. The public diagnostic enum and every corpus diagnostic cover numeric values 0 through 47 without inventing a Stage 0 diagnostic mapping.

### Exact generator algorithms

The following notation is language-neutral and exhaustive. `J(x)` is the accepted Factory canonical JSON v1 encoding of value `x`; generated JSON definition bytes are always `J(x)`. Ranges are start-inclusive/end-exclusive, decimal padding never truncates, and array order is construction order. Literal property names and strings below are exact.

`H(id, needs, gate, inputs)` constructs this human phase, where omitted `inputs` means `[]`; omitted `gate` means `gates: []`, otherwise `gates` is the one approval gate shown with its ID substituted:

```json
{"approval":{"decision":"accepted"},"description":"Deterministic human phase.","gates":[{"id":"<gate>","kind":"approval","requiredForAcceptance":true}],"id":"<id>","inputs":[],"kind":"human","needs":[],"outputSchema":"../Contracts/v1/approval-decision.schema.json","policy":{"maxAttempts":1,"networkScopes":[],"secretScopes":[],"timeoutSeconds":60,"writeScopes":[]}}
```

`W(id, phases, inputs, required, success)` constructs a workflow with the exact object below. Omitted `inputs` is the one `objective` request input shown. Omitted `required` is the IDs of all required gates scanned by phase then gate array order. Omitted `success` is the final phase ID.

```json
{"$schema":"../Contracts/v1/workflow.schema.json","acceptance":{"requiredGateIds":[]},"description":"Deterministic contract vector.","documentKind":"workflow","id":"<id>","inputs":[{"id":"objective","schema":"../Contracts/v1/factory-objective.schema.json","source":"request"}],"phases":[],"profileRequirements":{"allOf":["repository-known"]},"schemaVersion":"1","terminal":{"onAttemptsExhausted":"fail-run","onFailure":"fail-run","successPhase":"<success>"},"version":"1.0.0"}
```

`C(n)` constructs logical document `generated-catalog`: `$schema` is `../../Contracts/v1/capability-catalog.schema.json`; `schemaVersion` is `1`; `documentKind` is `capability-catalog`; `id` is `generated-catalog`; `version` is `1.0.0`; and `capabilities` contains, for each `i` in `0..n`, `{id: "capability-" + decimal(i,4), description: "Generated capability.", usages: ["agent"], effect: "read", policyCapability: "read-repository"}`.

`P(n, c)` constructs `c` phases `H("p" + decimal(i,3), needs, omitted, omitted)` for `i` in `0..c`. Phase zero has no dependency. Every later phase first receives the chain dependency `p(i-1)`. Let `remaining = n - (c - 1)`; visit `target` in `2..c` and, within it, `source` in `0..target-1`, appending `p(source)` to `p(target)` and decrementing `remaining` until it is zero. These loops exclude the already-added chain edge because the source upper bound is `target-2`. Any `n` that cannot make `remaining` exactly zero is a generator error. `P(n)` means `P(n, 16)`.

The ten generator IDs then mean exactly:

1. `definition-count`: for boundary `n`, emit `n` artifact-definition inputs containing the exact content-addressed `definition-artifact-descriptor-example` bytes, kind `artifact-descriptor`, and logical IDs `definition-` plus `decimal(i,3)` for `i` in `0..n`; request `missing-workflow`.
2. `aggregate-definition-bytes`: emit four inputs with kind numeric zero and logical IDs `aggregate-0` through `aggregate-3`. At maximum, each byte sequence is exactly 2,000,000 ASCII `0` bytes. At maximum-plus-one, the first three have 2,000,000 bytes and the fourth has 2,000,001. Request `missing-workflow`.
3. `logical-id-scalars`: emit one `artifact-descriptor` input containing the exact content-addressed artifact-descriptor example and logical ID consisting of exactly `n` lowercase ASCII `a` scalars; request `missing-workflow`.
4. `capability-count`: emit workflow logical ID `capability-limit-workflow` and catalog logical ID `generated-catalog`. The catalog value is `C(n)`. The workflow is `W` with one phase whose exact fields are `id: run`, `kind: agent`, description `Generated phase.`, empty needs/inputs, output schema `../Contracts/v1/phase-envelope.schema.json`, role `worker`, purpose `work`, capability `missing-capability`, the same policy object as `H`, and one schema gate `run-valid` required for acceptance. Other `W` arguments are omitted.
5. `workflow-input-count`: emit only logical workflow `workflow-input-limit-workflow`. Its inputs are `n` request entries `{id: "input-" + decimal(i,4), schema: "../Contracts/v1/factory-objective.schema.json", source: "request"}`. Its only phase is `H("accept", [], "accepted", [])`; `success` is `ghost-phase`; other `W` arguments are omitted.
6. `phase-count`: emit only logical workflow `phase-limit-workflow`, whose phases are `H("phase-" + decimal(i,2), [], omitted, [])` for `i` in `0..n`; `required` is `["ghost-gate"]` and `success` is `ghost-phase`.
7. `phase-input-count`: emit only logical workflow `phase-input-limit-workflow`. Its phase is `H("accept", [], "accepted", bindings)`, where `bindings` contains `{name: "input-" + decimal(i,2), source: {kind: "workflow-input", id: "objective"}}` for `i` in `0..n`; `success` is `ghost-phase`; other `W` arguments are omitted.
8. `gate-count`: start with `H("accept", [], omitted, [])`, replace its gates with `n` entries `{id: "gate-" + decimal(i,2), kind: "schema", requiredForAcceptance: false}`, and emit only `W("gate-limit-workflow", [phase], omitted, ["gate-00"], omitted)`.
9. `dependency-edge-count`: emit only `W("dependency-edge-limit-workflow", P(n), omitted, ["ghost-gate"], "ghost-phase")`.
10. `semantic-work`: start with `P(22, 8)`. Change `p000` to kind `agent`, remove `approval`, add role `worker`, purpose `work`, capability `missing-capability`, and replace inputs with 20 bindings `{name: "i" + decimal(i,2), source: {kind: "workflow-input", id: "objective"}}`. Replace `p007.gates` with 16 required schema gates `{id: "g" + decimal(i,2), kind: "schema", requiredForAcceptance: true}`. Add `{targetPhase: "p001", triggers: ["output-invalid"], maxRounds: 1}` to `p001.correction` and the corresponding self-target correction to `p002`. Maximum-plus-one additionally adds the corresponding self-target correction to `p003`. Emit this as logical workflow `semantic-work-limit-workflow` through `W` with all other arguments omitted, followed by logical catalog `semantic-work-catalog` whose document value is `C(1)`.

The corpus freezes the resulting descriptor hashes and complete expected result at both boundaries. The semantic maximum is exactly `2 + 1 + 1 + 8 + (4 * 20) + (4 * 16) + (3 * 22) + 2 + (2 * 16) = 256`; its plus-one correction makes 257. A generator must fail closed if its reconstructed canonical content hashes do not equal the expected descriptors, even when its semantic counts match.

## Stage 0 differential

The deletion-bound adapter runs only from the frozen physical snapshot recorded in `corpus.json`. It imports exact hashed `canonical_json.py`, `validate_factory.py`, and `compile_factory.py` with Python `-I -B`, disables bytecode writes, uses no environment-derived repository path, and receives the 29 schema and 26 definition bytes explicitly. It never invokes repository discovery, preflight, Git, network, provider, credential, source-write, or CLI behavior.

The comparison has two disjoint lanes. The language-neutral/native lane owns the complete v1 result contract, including every status, identity, descriptor, normalized byte, hash, and ordered diagnostic. Its expected values are reviewed corpus facts. Python neither creates nor confirms those diagnostics.

The Stage 0 lane is intentionally narrower. A case or generator boundary is observable only after the accepted common canonical/schema gateway and language-neutral enumeration/ID/kind/count admission succeed and publish a definition-set identity. This rule is structural and never selects an expectation by case or generator ID. For an observable input, the adapter invokes the exact frozen functions named in the two `stage0Mappings` entries:

1. Build explicit in-snapshot logical paths, call `compile_factory._find_document`, `validate_factory.validate_capability_catalogs`, and `validate_factory.validate_workflow`, and then call `compile_factory._validate_stage_zero_phase_scopes` for each phase. `verdict` is `accepted` only when lookup returns one workflow, validation appends zero error strings, and scope validation raises no `CompilationFailure`; otherwise it is `rejected`.
2. Only after `accepted`, call `compile_factory._topological_order` and record its exact returned phase-ID array as `orderedPhaseIds`. Rejected observations record null order.

The adapter observes only whether the Stage 0 error list is empty and whether `CompilationFailure` occurs. It never stores, compares, tokenizes, regexes, hashes, or otherwise interprets exception text or error prose. Stage 0 exposes no stable Factory diagnostic code, status taxonomy, identity, descriptor, normalized byte contract, or diagnostic ordering, so none is attributed to it. Non-observable inputs have `observable: false` and null Stage 0 fields and do not start Python. Adapter infrastructure failure is outside the comparison matrix, emits empty stderr and one host-owned failure, and discloses no raw value, path, exception, or prose.

Each Debug and Release configuration performs exactly 1,990 material comparisons over identical corpus bytes:

```text
language-neutral observations = 64 case records + (10 generators * 2 boundaries) = 84
native contract lane = 84 * 10 full fields * 1 expected/native pairing = 840
native repeat lane = 64 cases * 2 repeat calls * 4 aggregate bundles = 512
native parallel lane = 1 case * 128 calls * 4 aggregate bundles = 512
Stage 0 observable inputs = 47 cases + 16 generator boundaries = 63
Stage 0 lane = 63 * 2 stable fields * 1 expected/Python pairing = 126
total = 840 + 512 + 512 + 126 = 1,990
```

The ten native fields are status, schema-set identity, definition-set identity, complete descriptor sequence, workflow ID, source content hash, normalized base64, normalized whole hash, complete diagnostic sequence, and diagnostic count. The four native determinism bundles are outcome/identities, descriptors, workflow/bytes/hashes, and diagnostics/count. The sole parallel case is `route-workflow`; it runs 128 calls at degree eight. The only Stage 0 fields are `verdict` and `orderedPhaseIds`, paired only as frozen expected Stage 0 observation versus fresh Python observation. There is no expected/Python or native/Python pairing for the ten full contract fields. Each configuration must report 1,990/1,990 with zero failures.

## Security and authority exclusions

Permanent Core and permanent specifications must not reference or start filesystem/path/current-directory APIs, Git, network clients, DNS, HTTP, environment/configuration access, processes, Python, Node, Pi, providers, models, credential/secret resolvers, source writers, global schema registries, reflection/private package APIs, global locks, or lazy resolution. They consume only copied bytes, exact IDs, and the caller's already accepted immutable schema set. Diagnostics never contain raw JSON values, property names, descriptions, paths, exception data, package prose, or terminal controls.

The schema set, definition hash, closure hash, normalized hash, and content hash establish integrity only. They grant no authority. A future host must independently bind repository revision, policy, profile, approvals, credentials, and write/network scopes.

## Performance, determinism, and NativeAOT gates

These are acceptance ceilings for the future implementation on the existing macOS arm64 acceptance machine, not evidence from this design pass:

- committed 26-definition cold call: at most 1 second, 256 MiB cumulative thread allocation, and 128 MiB maximum RSS;
- committed warm mean over 20 calls: at most 250 ms and 128 MiB cumulative allocation per call;
- each exact structural maximum: at most 5 seconds, 2 GiB cumulative allocation, and 512 MiB maximum RSS;
- each maximum-plus-one early rejection: at most 250 ms and 64 MiB cumulative allocation;
- 128 committed calls at degree eight: byte-identical results, no exception, and no process-global state change.

A compiled consumer must publish self-contained, fully trimmed NativeAOT for `net10.0`/`osx-arm64`, embed all caller bytes, poison environment/current-directory/global schema state, and run in a sandbox denying network and file writes. It may perform ordinary runtime/loader reads but must prove zero repository/snapshot reads and zero fetches. Ceiling: 2 seconds and 128 MiB maximum RSS. Windows and Linux remain pending until actually executed.

## Future implementation write set and deletion condition

This design pass authorizes no product implementation. A later explicit implementation authorization may create only the reviewed Definitions source, framework-style specs, one language-neutral fixture derived byte-for-byte from this corpus, a deletion-bound migration comparator, and focused public contract documentation. It must not change accepted canonical/schema semantics, dependencies, solution/build files, discovery, preflight, CLI, evaluation, Planner, worker, provider, policy, profile, or publishing behavior without a separate versioned proposal.

The definition differential and its Python adapter may be deleted only after this slice has independent implementation, frozen-tree, performance, NativeAOT, and supported-platform acceptance and its evidence is durable. Python itself and the canonical/schema migration tools remain until canonical, schema, definition/workflow compilation, #48 discovery/profile resolution, authoritative preflight, evaluations, supported CLI, security, and supported-platform parity are all independently accepted. #67 and G0 remain open throughout this design review.
