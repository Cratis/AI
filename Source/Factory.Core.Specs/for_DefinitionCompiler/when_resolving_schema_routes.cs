// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_resolving_schema_routes : Specification
{
    IReadOnlyList<(DefinitionKind Kind, string SchemaId)> _routes = null!;
    bool _unknownResolved;
    bool _outOfRangeResolved;

    void Because()
    {
        _routes = [.. Enumerable.Range(1, 13).Select(value =>
        {
            var kind = (DefinitionKind)value;
            DefinitionCompiler.TryGetSchemaId(kind, out var schemaId);
            return (kind, schemaId!);
        })];
        _unknownResolved = DefinitionCompiler.TryGetSchemaId(DefinitionKind.Unknown, out _);
        _outOfRangeResolved = DefinitionCompiler.TryGetSchemaId((DefinitionKind)int.MaxValue, out _);
    }

    [Fact] void should_resolve_the_closed_thirteen_kind_set() => _routes.Count.ShouldEqual(13);
    [Fact] void should_resolve_every_exact_native_route() => _routes.SequenceEqual(
    new (DefinitionKind Kind, string SchemaId)[]
    {
        (DefinitionKind.CapabilityCatalog, "https://schemas.cratis.io/factory/v1/capability-catalog.schema.json"),
        (DefinitionKind.EvaluationCatalog, "https://schemas.cratis.io/factory/v1/evaluation-catalog.schema.json"),
        (DefinitionKind.Policy, "https://schemas.cratis.io/factory/v1/policy.schema.json"),
        (DefinitionKind.Profile, "https://schemas.cratis.io/factory/v1/profile.schema.json"),
        (DefinitionKind.ProjectManifest, "https://schemas.cratis.io/factory/v1/project-manifest.schema.json"),
        (DefinitionKind.Workflow, "https://schemas.cratis.io/factory/v1/workflow.schema.json"),
        (DefinitionKind.AgentContext, "https://schemas.cratis.io/factory/v2/agent-context.schema.json"),
        (DefinitionKind.ArtifactDescriptor, "https://schemas.cratis.io/factory/v2/artifact-descriptor.schema.json"),
        (DefinitionKind.ArtifactProvenance, "https://schemas.cratis.io/factory/v2/artifact-provenance.schema.json"),
        (DefinitionKind.ArtifactReceipt, "https://schemas.cratis.io/factory/v2/artifact-receipt.schema.json"),
        (DefinitionKind.PhaseEnvelope, "https://schemas.cratis.io/factory/v2/phase-envelope.schema.json"),
        (DefinitionKind.RunInputSet, "https://schemas.cratis.io/factory/v2/run-input-set.schema.json"),
        (DefinitionKind.SanitizationAttestation, "https://schemas.cratis.io/factory/v2/sanitization-attestation.schema.json")
    }).ShouldBeTrue();
    [Fact] void should_not_resolve_unknown() => _unknownResolved.ShouldBeFalse();
    [Fact] void should_not_resolve_out_of_range_values() => _outOfRangeResolved.ShouldBeFalse();
    [Fact] void should_bind_the_accepted_schema_set_identity() => DefinitionCompiler.AcceptedSchemaSetIdentity.Value.ShouldEqual("sha256:0c0d49351caaf538c37ac785d03cec872f8ed6dde1a02257aef7e6f265390d99");
}
