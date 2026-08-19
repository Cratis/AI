// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Definitions;

namespace Cratis.Factory.DefinitionWorkflowCompilation;

public static class DefinitionWorkflowCorpusGenerator
{
    public static IReadOnlyList<DefinitionDocument> Generate(string generator, int boundary, byte[] artifactDescriptor)
    {
        return generator switch
        {
            "definition-count" => [.. Enumerable.Range(0, boundary).Select(index =>
                new DefinitionDocument($"definition-{index:000}", DefinitionKind.ArtifactDescriptor, artifactDescriptor))],
            "aggregate-definition-bytes" => GenerateAggregate(boundary),
            "logical-id-scalars" => [new(new string('a', boundary), DefinitionKind.ArtifactDescriptor, artifactDescriptor)],
            "capability-count" => GenerateCapabilityCount(boundary),
            "workflow-input-count" => [Document("workflow-input-limit-workflow", WorkflowInputWorkflow(boundary))],
            "phase-count" => [Document("phase-limit-workflow", PhaseCountWorkflow(boundary))],
            "phase-input-count" => [Document("phase-input-limit-workflow", PhaseInputWorkflow(boundary))],
            "gate-count" => [Document("gate-limit-workflow", GateCountWorkflow(boundary))],
            "dependency-edge-count" => [Document("dependency-edge-limit-workflow", DependencyWorkflow(boundary))],
            "semantic-work" => GenerateSemanticWork(boundary),
            _ => throw new UnknownDefinitionWorkflowGenerator()
        };
    }

    static IReadOnlyList<DefinitionDocument> GenerateAggregate(int boundary)
    {
        var final = boundary - 6_000_000;
        return [.. Enumerable.Range(0, 4).Select(index =>
            new DefinitionDocument($"aggregate-{index}", DefinitionKind.Unknown, new byte[index == 3 ? final : 2_000_000]))];
    }

    static IReadOnlyList<DefinitionDocument> GenerateCapabilityCount(int count) =>
    [
        Document("capability-limit-workflow", Workflow(
            "capability-limit-workflow",
            [AgentPhase("run", "missing-capability")],
            null,
            null,
            null)),
        new("generated-catalog", DefinitionKind.CapabilityCatalog, Canonical(CapabilityCatalog(count)))
    ];

    static IReadOnlyList<DefinitionDocument> GenerateSemanticWork(int boundary)
    {
        var phases = DependencyPhases(22, 8);
        var first = phases[0]!.AsObject();
        first.Remove("approval");
        first["kind"] = "agent";
        first["role"] = "worker";
        first["purpose"] = "work";
        first["capability"] = "missing-capability";
        first["inputs"] = new JsonArray([.. Enumerable.Range(0, 20).Select(index => (JsonNode)new JsonObject
        {
            ["name"] = $"i{index:00}",
            ["source"] = new JsonObject { ["kind"] = "workflow-input", ["id"] = "objective" }
        })]);
        phases[7]!.AsObject()["gates"] = new JsonArray([.. Enumerable.Range(0, 16).Select(index => (JsonNode)new JsonObject
        {
            ["id"] = $"g{index:00}",
            ["kind"] = "schema",
            ["requiredForAcceptance"] = true
        })]);
        AddCorrection(phases[1]!.AsObject(), "p001");
        AddCorrection(phases[2]!.AsObject(), "p002");
        if (boundary == 257) AddCorrection(phases[3]!.AsObject(), "p003");
        return
        [
            Document("semantic-work-limit-workflow", Workflow("semantic-work-limit-workflow", phases, null, null, null)),
            new("semantic-work-catalog", DefinitionKind.CapabilityCatalog, Canonical(CapabilityCatalog(1)))
        ];
    }

    static JsonObject WorkflowInputWorkflow(int count)
    {
        var inputs = new JsonArray([.. Enumerable.Range(0, count).Select(index => (JsonNode)new JsonObject
        {
            ["id"] = $"input-{index:0000}",
            ["schema"] = "../Contracts/v1/factory-objective.schema.json",
            ["source"] = "request"
        })]);
        return Workflow("workflow-input-limit-workflow", [HumanPhase("accept", [], "accepted", [])], inputs, null, "ghost-phase");
    }

    static JsonObject PhaseCountWorkflow(int count) => Workflow(
        "phase-limit-workflow",
        new JsonArray([.. Enumerable.Range(0, count).Select(index => (JsonNode)HumanPhase($"phase-{index:00}", [], null, []))]),
        null,
        new JsonArray("ghost-gate"),
        "ghost-phase");

    static JsonObject PhaseInputWorkflow(int count)
    {
        var bindings = new JsonArray([.. Enumerable.Range(0, count).Select(index => (JsonNode)new JsonObject
        {
            ["name"] = $"input-{index:00}",
            ["source"] = new JsonObject { ["kind"] = "workflow-input", ["id"] = "objective" }
        })]);
        return Workflow("phase-input-limit-workflow", [HumanPhase("accept", [], "accepted", bindings)], null, null, "ghost-phase");
    }

    static JsonObject GateCountWorkflow(int count)
    {
        var phase = HumanPhase("accept", [], null, []);
        phase["gates"] = new JsonArray([.. Enumerable.Range(0, count).Select(index => (JsonNode)new JsonObject
        {
            ["id"] = $"gate-{index:00}",
            ["kind"] = "schema",
            ["requiredForAcceptance"] = false
        })]);
        return Workflow("gate-limit-workflow", [phase], null, new JsonArray("gate-00"), null);
    }

    static JsonObject DependencyWorkflow(int count) => Workflow(
        "dependency-edge-limit-workflow",
        DependencyPhases(count, 16),
        null,
        new JsonArray("ghost-gate"),
        "ghost-phase");

    static JsonArray DependencyPhases(int edgeCount, int phaseCount)
    {
        var phases = new JsonArray();
        for (var index = 0; index < phaseCount; index++)
        {
            phases.Add((JsonNode)HumanPhase($"p{index:000}", index == 0 ? [] : [$"p{index - 1:000}"], null, []));
        }
        var remaining = edgeCount - (phaseCount - 1);
        for (var target = 2; target < phaseCount && remaining > 0; target++)
        {
            for (var source = 0; source < target - 1 && remaining > 0; source++)
            {
                phases[target]!.AsObject()["needs"]!.AsArray().Add($"p{source:000}");
                remaining--;
            }
        }
        if (remaining != 0) throw new UnknownDefinitionWorkflowGenerator();
        return phases;
    }

    static JsonObject HumanPhase(string id, string[] needs, string? gate, JsonArray inputs)
    {
        var gates = gate is null
            ? []
            : new JsonArray(new JsonObject { ["id"] = gate, ["kind"] = "approval", ["requiredForAcceptance"] = true });
        return new()
        {
            ["approval"] = new JsonObject { ["decision"] = "accepted" },
            ["description"] = "Deterministic human phase.",
            ["gates"] = gates,
            ["id"] = id,
            ["inputs"] = inputs,
            ["kind"] = "human",
            ["needs"] = new JsonArray([.. needs.Select(_ => (JsonNode)JsonValue.Create(_))]),
            ["outputSchema"] = "../Contracts/v1/approval-decision.schema.json",
            ["policy"] = Policy()
        };
    }

    static JsonObject AgentPhase(string id, string capability) => new()
    {
        ["capability"] = capability,
        ["description"] = "Generated phase.",
        ["gates"] = new JsonArray(new JsonObject { ["id"] = "run-valid", ["kind"] = "schema", ["requiredForAcceptance"] = true }),
        ["id"] = id,
        ["inputs"] = new JsonArray(),
        ["kind"] = "agent",
        ["needs"] = new JsonArray(),
        ["outputSchema"] = "../Contracts/v1/phase-envelope.schema.json",
        ["policy"] = Policy(),
        ["purpose"] = "work",
        ["role"] = "worker"
    };

    static JsonObject Policy() => new()
    {
        ["maxAttempts"] = 1,
        ["networkScopes"] = new JsonArray(),
        ["secretScopes"] = new JsonArray(),
        ["timeoutSeconds"] = 60,
        ["writeScopes"] = new JsonArray()
    };

    static JsonObject Workflow(string id, JsonArray phases, JsonArray? inputs, JsonArray? required, string? success)
    {
        inputs ??= new JsonArray(new JsonObject
        {
            ["id"] = "objective",
            ["schema"] = "../Contracts/v1/factory-objective.schema.json",
            ["source"] = "request"
        });
        required ??= new JsonArray([.. phases.SelectMany(phase => phase!["gates"]!.AsArray())
            .Where(gate => gate!["requiredForAcceptance"]!.GetValue<bool>())
            .Select(gate => (JsonNode)JsonValue.Create(gate!["id"]!.GetValue<string>()))]);
        success ??= phases[^1]!["id"]!.GetValue<string>();
        return new()
        {
            ["$schema"] = "../Contracts/v1/workflow.schema.json",
            ["acceptance"] = new JsonObject { ["requiredGateIds"] = required },
            ["description"] = "Deterministic contract vector.",
            ["documentKind"] = "workflow",
            ["id"] = id,
            ["inputs"] = inputs,
            ["phases"] = phases,
            ["profileRequirements"] = new JsonObject { ["allOf"] = new JsonArray("repository-known") },
            ["schemaVersion"] = "1",
            ["terminal"] = new JsonObject { ["onAttemptsExhausted"] = "fail-run", ["onFailure"] = "fail-run", ["successPhase"] = success },
            ["version"] = "1.0.0"
        };
    }

    static JsonObject CapabilityCatalog(int count) => new()
    {
        ["$schema"] = "../../Contracts/v1/capability-catalog.schema.json",
        ["capabilities"] = new JsonArray(Enumerable.Range(0, count).Select(index => (JsonNode)new JsonObject
        {
            ["description"] = "Generated capability.",
            ["effect"] = "read",
            ["id"] = $"capability-{index:0000}",
            ["policyCapability"] = "read-repository",
            ["usages"] = new JsonArray("agent")
        }).ToArray()),
        ["documentKind"] = "capability-catalog",
        ["id"] = "generated-catalog",
        ["schemaVersion"] = "1",
        ["version"] = "1.0.0"
    };

    static void AddCorrection(JsonObject phase, string target) => phase["correction"] = new JsonObject
    {
        ["maxRounds"] = 1,
        ["targetPhase"] = target,
        ["triggers"] = new JsonArray("output-invalid")
    };

    static DefinitionDocument Document(string logicalId, JsonObject value) => new(logicalId, DefinitionKind.Workflow, Canonical(value));

    static byte[] Canonical(JsonNode value)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using var writer = new Utf8JsonWriter(buffer);
        value.WriteTo(writer);
        writer.Flush();
        return CanonicalJson.Parse(buffer.WrittenSpan).ToArray();
    }
}

public sealed class UnknownDefinitionWorkflowGenerator : Exception;
