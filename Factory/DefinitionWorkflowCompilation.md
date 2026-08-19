# Native definition and workflow compilation

`Cratis.Factory.Core` compiles an explicit set of caller-owned definition bytes
into one deterministic normalized workflow. The v1 compiler is a pure semantic
boundary: it accepts an already loaded schema set, definition documents, and a
workflow ID. It does not discover a repository, read files, invoke Git, inspect
the environment, contact a provider, resolve credentials, approve work, or
write source.

The implementation follows the semantic rules in the accepted
[`DefinitionWorkflowCompilation/v1`](./Design/DefinitionWorkflowCompilation/v1/contract.md)
contract. Explicit permanent native specifications own product correctness and
construct caller bytes with native expected facts. The immutable v1 corpus is
historical design and migration evidence only; its expected semantic results do
not accept, reject, or redefine compiler behavior. Frozen-tree acceptance
remains a separate verification step.

## Public API

Create each input as a `DefinitionDocument(logicalId, kind, utf8)`. Construction
defensively copies at most 2,000,001 bytes, and `Utf8` exposes only a read-only
view. Call:

```csharp
DefinitionCompilationResult result = DefinitionCompiler.Compile(
    acceptedSchemas,
    definitions,
    "investigate-cratis-issue");
```

`DefinitionCompiler.TryGetSchemaId()` exposes the closed route table, and
`DefinitionCompiler.AcceptedSchemaSetIdentity` identifies the only admitted
schema set. `DefinitionCompilationResult` contains the status, safe workflow ID,
schema- and definition-set identities, ordered definition descriptors, optional
`CompiledWorkflow`, and ordered diagnostics. All returned collections and byte
surfaces are immutable defensive values. `CompiledWorkflow.ToArray()` returns a
fresh copy; `WriteTo()` writes the complete bytes to a caller-owned
`IBufferWriter<byte>`.

The result status is one of `Compiled`, `Rejected`,
`DiagnosticLimitExceeded`, or `EvaluationLimitExceeded`. Compilation is total
for caller-data failures. Only `OutOfMemoryException`, `StackOverflowException`,
and `AccessViolationException` escape enumeration handling, and
`CompiledWorkflow.WriteTo(null)` deliberately throws `ArgumentNullException`.

## Definition routes

The closed `DefinitionKind` set maps to the accepted v1/v2 schema resources:

| Kind | Schema |
| --- | --- |
| `CapabilityCatalog` | `factory/v1/capability-catalog.schema.json` |
| `EvaluationCatalog` | `factory/v1/evaluation-catalog.schema.json` |
| `Policy` | `factory/v1/policy.schema.json` |
| `Profile` | `factory/v1/profile.schema.json` |
| `ProjectManifest` | `factory/v1/project-manifest.schema.json` |
| `Workflow` | `factory/v1/workflow.schema.json` |
| `AgentContext` | `factory/v2/agent-context.schema.json` |
| `ArtifactDescriptor` | `factory/v2/artifact-descriptor.schema.json` |
| `ArtifactProvenance` | `factory/v2/artifact-provenance.schema.json` |
| `ArtifactReceipt` | `factory/v2/artifact-receipt.schema.json` |
| `PhaseEnvelope` | `factory/v2/phase-envelope.schema.json` |
| `RunInputSet` | `factory/v2/run-input-set.schema.json` |
| `SanitizationAttestation` | `factory/v2/sanitization-attestation.schema.json` |

Each abbreviated entry is rooted at `https://schemas.cratis.io/`. `Unknown`
and out-of-range enum values have no route.

## Frozen limits

| Resource | Maximum |
| --- | ---: |
| Definitions | 256 |
| Aggregate definition bytes | 8,000,000 |
| Bytes per definition | 2,000,000 |
| Retained bytes per definition | 2,000,001 |
| Logical-ID Unicode scalars | 256 |
| Capabilities / workflow inputs / phases | 16 each |
| Phase inputs | 64 |
| Gates | 32 |
| Dependency edges | 64 |
| Semantic work units | 256 |
| Retained diagnostics | 256 |
| Normalized bytes | 2,000,000 |

Admission, limit precedence, schema projections, semantic checks, diagnostic
ordering, topological ordering, normalized bytes, and hashes are deterministic.
Workflow semantics cover dependencies, workflow and producer inputs,
capabilities and usages, correction ancestry, required acceptance gates,
terminal reachability, and phase scopes.

## Diagnostics

`DefinitionDiagnostic` carries only compiler-owned safe identifiers, stable
locations, and typed component codes. It never includes raw JSON, descriptions,
paths, exception text, package prose, or terminal controls. The numeric
`DefinitionDiagnosticCode` contract is:

```text
0 SchemaSetRequired                         24 PhaseInputLimitExceeded
1 SchemaSetNotAccepted                      25 GateLimitExceeded
2 NoDefinitions                             26 DependencyEdgeLimitExceeded
3 DefinitionLimitExceeded                   27 SemanticWorkLimitExceeded
4 AggregateDefinitionBytesLimitExceeded     28 UnknownDependency
5 DefinitionEnumerationFailed               29 DependencyCycle
6 InvalidDefinitionLogicalId                30 UnknownWorkflowInput
7 DuplicateDefinitionLogicalId              31 UnknownProducerPhase
8 UnsupportedDefinitionKind                 32 ProducerNotAncestor
9 CanonicalDefinitionRejected               33 UnknownCapability
10 DefinitionSchemaRejected                 34 UnsupportedCapabilityUsage
11 DefinitionSchemaViolation                35 UnsupportedCapabilityGateKind
12 DefinitionEvaluationLimitExceeded        36 UnknownSchemaReference
13 InvalidWorkflowId                        37 UnknownCorrectionTarget
14 WorkflowNotFound                         38 CorrectionTargetNotAncestor
15 DuplicateWorkflowId                      39 AcceptanceUnknownGate
16 DuplicateWorkflowInputId                 40 AcceptanceMissingRequiredGate
17 DuplicatePhaseId                         41 AcceptanceIncludesNonRequiredGate
18 DuplicatePhaseInputName                  42 UnknownSuccessPhase
19 DuplicateGateId                          43 SuccessPhaseHasDependents
20 DuplicateCapabilityId                    44 PhaseDoesNotLeadToSuccess
21 WorkflowInputLimitExceeded               45 UnsupportedPhaseScope
22 CapabilityLimitExceeded                  46 NormalizedOutputLimitExceeded
23 PhaseLimitExceeded                       47 DiagnosticLimitExceeded
```

Every diagnostic has severity `Error` and status `Violation`, `Rejected`, or
`LimitExceeded`. Canonical and schema failures additionally carry the stable
public component enum when applicable.

## Native specifications and historical migration evidence

Permanent framework-style specifications independently cover all 13 routes,
admission and status precedence, exact maximum/maximum-plus-one limits, every
workflow semantic rejection family, per-reference diagnostic multiplicity and
global ordering, normalized bytes and hashes, defensive copies, and 128 calls
at degree eight. Their inputs and expected facts are explicit native values;
they never load expected results from the definition corpus.

The original design corpus remains byte-unchanged as historical evidence:

- raw SHA-256:
  `0824257b772b3cc9d7ed318987edd59945629f7463801a0ffb4f8377daaa9f47`;
- canonical self-hash, omitting only top-level `contentHash`:
  `sha256:6387a2604e255c684fae1521ccf638e93f2a6596f202254a920564e850b8e2d5`;
- 29 schemas, 13 routes, 26 definition artifacts, 64 explicit cases, 10
  generators, 20 generator boundaries, and 84 historical observations.

The deletion-bound comparator under
[`Migration/DefinitionWorkflowCompilationParity`](./Migration/DefinitionWorkflowCompilationParity/)
retains a byte-identical migration snapshot, the three exact hashed Python
oracle modules, and the narrow Stage 0 verdict/phase-order observation. It
reports semantic drift honestly but returns it as explicitly non-blocking
historical information. It is neither a permanent specification nor product
authority and remains until the accepted deletion condition is durable.

## Deliberately deferred

This slice does not implement #48 discovery or profile resolution, filesystem
or Git discovery, preflight authority, evaluations, CLI behavior, Planner,
workers, Pi, providers, credentials, approvals, or publishing. Hashes establish
integrity only; a future host must independently bind repository revision,
policy, profile, approvals, credentials, and write/network scopes. #67, #47,
and G0 remain open, and Python plus all prior migration tools remain in place.
