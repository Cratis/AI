// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Canonicalization;
using Cratis.Factory.Definitions;
using Cratis.Factory.Hashing;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_compiling_an_explicit_native_workflow : given_an_accepted_definition_schema_set
{
    const string ExpectedDefinitionSetIdentity = "sha256:4205abcd12c032dbd5878b2f56079a3c4b2fdcc532969297ff015f84912489b9";
    const string ExpectedSourceHash = "sha256:a9612ad729772efdb696a6bc020beeb0fe80019fad43b918f732978643da0408";
    const string ExpectedContentHash = "sha256:83b1989d3f53408c678c211636e22650a2774b528127707030fb3b187c525918";
    const string ExpectedWholeHash = "sha256:1331ac3947f0b16a194eb6c53bf02c90bb33c54480aede35962cbfd105a88ce7";
    DefinitionCompilationResult _result = null!;
    DefinitionCompilationResult[] _parallel = null!;
    byte[] _firstCopy = null!;
    byte[] _secondCopy = null!;

    void Because()
    {
        var workflow = ExplicitWorkflow();
        var catalog = ExplicitCatalog();
        _result = Compile(workflow, Catalog(catalog));
        _firstCopy = _result.Workflow!.ToArray();
        _firstCopy[0] ^= 0xff;
        _secondCopy = _result.Workflow.ToArray();
        _parallel = new DefinitionCompilationResult[128];
        Parallel.For(
            0,
            _parallel.Length,
            new ParallelOptions { MaxDegreeOfParallelism = 8 },
            index => _parallel[index] = Compile(ExplicitWorkflow(), Catalog(ExplicitCatalog())));
    }

    [Fact] void should_compile_without_diagnostics() => _result.Status.ShouldEqual(DefinitionCompilationStatus.Compiled);
    [Fact] void should_publish_the_accepted_schema_identity() => _result.SchemaSetIdentity!.Value.ShouldEqual("sha256:0c0d49351caaf538c37ac785d03cec872f8ed6dde1a02257aef7e6f265390d99");
    [Fact] void should_publish_the_exact_definition_set_identity() => _result.DefinitionSetIdentity!.Value.ShouldEqual(ExpectedDefinitionSetIdentity);
    [Fact] void should_publish_the_exact_source_hash() => _result.Workflow!.SourceContentHash.Value.ShouldEqual(ExpectedSourceHash);
    [Fact] void should_publish_the_exact_content_hash() => _result.Workflow!.ContentHash.Value.ShouldEqual(ExpectedContentHash);
    [Fact] void should_publish_the_exact_whole_hash() => Sha256Hash.Calculate(_result.Workflow!.Utf8).Value.ShouldEqual(ExpectedWholeHash);
    [Fact] void should_use_deterministic_topological_order() => _result.Workflow!.OrderedPhases.Select(_ => _.Id).ShouldEqual(["analyze", "verify", "accept"]);
    [Fact] void should_assign_consecutive_ordinals() => _result.Workflow!.OrderedPhases.Select(_ => _.Ordinal).ShouldEqual([0, 1, 2]);
    [Fact] void should_sort_acceptance_gate_ids() => _result.Workflow!.RequiredGateIds.SequenceEqual(["accept-accepted", "analyze-valid", "verify-command"]).ShouldBeTrue();
    [Fact] void should_publish_the_exact_success_phase() => _result.Workflow!.SuccessPhase.ShouldEqual("accept");
    [Fact] void should_publish_canonical_normalized_bytes() => CanonicalJson.Parse(_result.Workflow!.Utf8).Utf8.SequenceEqual(_result.Workflow.Utf8).ShouldBeTrue();
    [Fact] void should_defensively_copy_normalized_bytes() => _secondCopy[0].ShouldNotEqual(_firstCopy[0]);
    [Fact] void should_be_byte_identical_at_degree_eight() => _parallel.All(_ => _.Workflow!.Utf8.SequenceEqual(_secondCopy)).ShouldBeTrue();
    [Fact] void should_be_diagnostic_identical_at_degree_eight() => _parallel.All(_ => _.Diagnostics.Count == 0 && _.Status == _result.Status).ShouldBeTrue();

    static JsonObject ExplicitWorkflow()
    {
        var analyze = AgentPhase(
            "analyze",
            "agent-read",
            inputs: new JsonArray(WorkflowInputBinding("objective", "objective")));
        analyze["correction"] = Correction("analyze");
        var verify = CodePhase(
            "verify",
            "phase-verify",
            ["analyze"],
            new JsonArray(PhaseOutputBinding("analysis", "analyze")),
            new JsonArray(Gate("verify-command", "command", true, "gate-verify")));
        return ValidWorkflow(
            analyze,
            verify,
            HumanPhase("accept", ["verify"], inputs: new JsonArray(PhaseOutputBinding("verification", "verify"))));
    }

    static JsonObject ExplicitCatalog() => CapabilityCatalog(
        "native-capabilities",
        Capability("agent-read", ["agent"]),
        Capability("gate-verify", ["gate"], ["command"]),
        Capability("phase-verify", ["phase"]));
}
