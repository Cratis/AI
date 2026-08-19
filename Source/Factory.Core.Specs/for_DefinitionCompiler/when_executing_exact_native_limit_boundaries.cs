// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_executing_exact_native_limit_boundaries : given_an_accepted_definition_schema_set
{
    readonly List<string> _failures = [];
    int _boundaryCount;

    void Because()
    {
        var artifact = Native("artifact", DefinitionKind.ArtifactDescriptor);
        var boundaries = new NativeLimitBoundary[]
        {
            new(
                "definitions",
                DefinitionCompiler.Compile(Schemas, Enumerable.Repeat(artifact, 256), WorkflowId),
                DefinitionCompiler.Compile(Schemas, Enumerable.Repeat(artifact, 257), WorkflowId),
                DefinitionDiagnosticCode.DefinitionLimitExceeded),
            new(
                "aggregate-definition-bytes",
                DefinitionCompiler.Compile(Schemas, AggregateDefinitions(8_000_000), WorkflowId),
                DefinitionCompiler.Compile(Schemas, AggregateDefinitions(8_000_001), WorkflowId),
                DefinitionDiagnosticCode.AggregateDefinitionBytesLimitExceeded),
            new(
                "logical-id-scalars",
                DefinitionCompiler.Compile(Schemas, [new(new string('a', 256), artifact.Kind, artifact.Utf8)], WorkflowId),
                DefinitionCompiler.Compile(Schemas, [new(new string('a', 257), artifact.Kind, artifact.Utf8)], WorkflowId),
                DefinitionDiagnosticCode.InvalidDefinitionLogicalId),
            Boundary("capabilities", CapabilityInput(16), CapabilityInput(17), DefinitionDiagnosticCode.CapabilityLimitExceeded),
            Boundary("workflow-inputs", WorkflowInputLimit(16), WorkflowInputLimit(17), DefinitionDiagnosticCode.WorkflowInputLimitExceeded),
            Boundary("phases", PhaseLimit(16), PhaseLimit(17), DefinitionDiagnosticCode.PhaseLimitExceeded),
            Boundary("phase-inputs", PhaseInputLimit(64), PhaseInputLimit(65), DefinitionDiagnosticCode.PhaseInputLimitExceeded),
            Boundary("gates", GateLimit(32), GateLimit(33), DefinitionDiagnosticCode.GateLimitExceeded),
            Boundary("dependency-edges", DependencyLimit(64), DependencyLimit(65), DefinitionDiagnosticCode.DependencyEdgeLimitExceeded),
            Boundary("semantic-work", SemanticWorkLimit(4), SemanticWorkLimit(5), DefinitionDiagnosticCode.SemanticWorkLimitExceeded)
        };

        _boundaryCount = boundaries.Length;
        foreach (var boundary in boundaries)
        {
            if (boundary.Maximum.Diagnostics.Any(_ => _.Code == boundary.Code)) _failures.Add($"{boundary.Id}: maximum rejected by {boundary.Code}");
            if (!boundary.MaximumPlusOne.Diagnostics.Any(_ => _.Code == boundary.Code))
            {
                _failures.Add($"{boundary.Id}: maximum-plus-one diagnostics differed");
            }
            if (boundary.MaximumPlusOne.Workflow is not null) _failures.Add($"{boundary.Id}: maximum-plus-one published workflow");
        }
    }

    [Fact] void should_execute_all_ten_frozen_boundaries() => _boundaryCount.ShouldEqual(10);
    [Fact] void should_admit_each_maximum_and_reject_each_maximum_plus_one() => _failures.ShouldBeEmpty();

    NativeLimitBoundary Boundary(
        string id,
        DefinitionDocument[] maximum,
        DefinitionDocument[] maximumPlusOne,
        DefinitionDiagnosticCode code) => new(
            id,
            DefinitionCompiler.Compile(Schemas, maximum, WorkflowId),
            DefinitionCompiler.Compile(Schemas, maximumPlusOne, WorkflowId),
            code);

    static IReadOnlyList<DefinitionDocument> AggregateDefinitions(int aggregateBytes) =>
    [
        new("aggregate-a", DefinitionKind.Unknown, new byte[2_000_000]),
        new("aggregate-b", DefinitionKind.Unknown, new byte[2_000_000]),
        new("aggregate-c", DefinitionKind.Unknown, new byte[2_000_000]),
        new("aggregate-d", DefinitionKind.Unknown, new byte[aggregateBytes - 6_000_000])
    ];

    static DefinitionDocument[] CapabilityInput(int count) =>
    [
        Workflow(ValidWorkflow(AgentPhase("finish", "capability-0000"))),
        Catalog(CapabilityCatalog(
            "native-capabilities",
            [.. Enumerable.Range(0, count).Select(index => Capability($"capability-{index:0000}", ["agent"]))]))
    ];

    static DefinitionDocument[] WorkflowInputLimit(int count) =>
    [Workflow(ValidWorkflow(
        new JsonArray(HumanPhase("finish")),
        new JsonArray([.. Enumerable.Range(0, count).Select(index => (JsonNode)WorkflowInput($"input-{index:00}"))]),
        null,
        "finish"))];

    static DefinitionDocument[] PhaseLimit(int count) =>
    [Workflow(ValidWorkflow(Chain(count), null, null, $"phase-{count - 1:00}"))];

    static DefinitionDocument[] PhaseInputLimit(int count) =>
    [Workflow(ValidWorkflow(HumanPhase(
        "finish",
        inputs: new JsonArray([.. Enumerable.Range(0, count).Select(index => (JsonNode)WorkflowInputBinding($"input-{index:00}", "objective"))]))))];

    static DefinitionDocument[] GateLimit(int count)
    {
        var gates = new JsonArray([.. Enumerable.Range(0, count).Select(index => (JsonNode)Gate($"gate-{index:00}", required: true))]);
        return [Workflow(ValidWorkflow(HumanPhase("finish", gates: gates)))];
    }

    static DefinitionDocument[] DependencyLimit(int count) =>
        [Workflow(ValidWorkflow(DependencyPhases(count), null, null, "phase-15"))];

    static DefinitionDocument[] SemanticWorkLimit(int correctionCount)
    {
        var phases = DependencyPhases(22, 8);
        for (var index = 0; index < 7; index++) phases[index]!["gates"] = new JsonArray();
        phases[0]!["inputs"] = new JsonArray([.. Enumerable.Range(0, 20).Select(index =>
            (JsonNode)WorkflowInputBinding($"input-{index:00}", "objective"))]);
        phases[7]!["gates"] = new JsonArray([.. Enumerable.Range(0, 16).Select(index =>
            (JsonNode)Gate($"gate-{index:00}", required: true))]);
        for (var index = 0; index < correctionCount; index++)
        {
            var phaseObject = phases[index]!.AsObject();
            phaseObject["correction"] = Correction(phaseObject["id"]!.GetValue<string>());
        }
        return [Workflow(ValidWorkflow(phases, null, null, "phase-07"))];
    }

    static JsonArray Chain(int count) => new([.. Enumerable.Range(0, count).Select(index =>
        (JsonNode)HumanPhase($"phase-{index:00}", index == 0 ? [] : [$"phase-{index - 1:00}"]))]);

    static JsonArray DependencyPhases(int edgeCount) => DependencyPhases(edgeCount, 16);

    static JsonArray DependencyPhases(int edgeCount, int phaseCount)
    {
        var phases = Chain(phaseCount);
        var remaining = edgeCount - (phaseCount - 1);
        for (var target = 2; target < phaseCount && remaining > 0; target++)
        {
            for (var source = 0; source < target - 1 && remaining > 0; source++)
            {
                phases[target]!["needs"]!.AsArray().Add($"phase-{source:00}");
                remaining--;
            }
        }
        remaining.ShouldEqual(0);
        return phases;
    }

    sealed record NativeLimitBoundary(
        string Id,
        DefinitionCompilationResult Maximum,
        DefinitionCompilationResult MaximumPlusOne,
        DefinitionDiagnosticCode Code);
}
