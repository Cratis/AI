// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Definitions;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.for_DefinitionCompiler;

public class given_an_accepted_definition_schema_set : Specification
{
    protected const string WorkflowId = "native-workflow";
    protected SchemaResourceSet Schemas = null!;

    void Establish()
    {
        var load = SchemaResourceSet.Load(NativeDefinitionCompilerInputs.SchemaDocuments());
        load.Status.ShouldEqual(SchemaLoadStatus.Loaded);
        Schemas = load.ResourceSet!;
        Schemas.Identity.ShouldEqual(DefinitionCompiler.AcceptedSchemaSetIdentity);
        Schemas.Documents.Count.ShouldEqual(29);
        Schemas.Resources.Count.ShouldEqual(29);
        Schemas.ReferenceCount.ShouldEqual(369);
        Schemas.AnchorCount.ShouldEqual(0);
    }

    protected DefinitionCompilationResult Compile(JsonObject workflow, params DefinitionDocument[] additional) =>
        DefinitionCompiler.Compile(Schemas, [Workflow(workflow), .. additional], WorkflowId);

    protected static DefinitionDocument Workflow(JsonObject value, string logicalId = WorkflowId) =>
        new(logicalId, DefinitionKind.Workflow, Canonical(value));

    protected static DefinitionDocument Catalog(JsonObject value, string logicalId = "native-capabilities") =>
        new(logicalId, DefinitionKind.CapabilityCatalog, Canonical(value));

    protected static DefinitionDocument Native(string logicalId, DefinitionKind kind) =>
        new(logicalId, kind, NativeDefinitionCompilerInputs.Definition(kind));

    protected static JsonObject ValidWorkflow(params JsonObject[] phases) => ValidWorkflow(new JsonArray(phases), null, null, null);

    protected static JsonObject ValidWorkflow(
        JsonArray phases,
        JsonArray? inputs,
        JsonArray? requiredGateIds,
        string? successPhase)
    {
        inputs ??= new JsonArray(WorkflowInput("objective"));
        requiredGateIds ??= new JsonArray([.. phases
            .SelectMany(phase => phase!["gates"]!.AsArray())
            .Where(gate => gate!["requiredForAcceptance"]!.GetValue<bool>())
            .Select(gate => (JsonNode)JsonValue.Create(gate!["id"]!.GetValue<string>()))]);
        successPhase ??= phases[^1]!["id"]!.GetValue<string>();
        return new()
        {
            ["$schema"] = "../Contracts/v1/workflow.schema.json",
            ["acceptance"] = new JsonObject { ["requiredGateIds"] = requiredGateIds },
            ["description"] = "Explicit native specification workflow.",
            ["documentKind"] = "workflow",
            ["id"] = WorkflowId,
            ["inputs"] = inputs,
            ["phases"] = phases,
            ["profileRequirements"] = new JsonObject { ["allOf"] = new JsonArray("repository-known") },
            ["schemaVersion"] = "1",
            ["terminal"] = new JsonObject
            {
                ["onAttemptsExhausted"] = "fail-run",
                ["onFailure"] = "fail-run",
                ["successPhase"] = successPhase
            },
            ["version"] = "1.0.0"
        };
    }

    protected static JsonObject HumanPhase(
        string id,
        string[]? needs = null,
        JsonArray? inputs = null,
        JsonArray? gates = null) => new()
    {
        ["approval"] = new JsonObject { ["decision"] = "accepted" },
        ["description"] = "Explicit human phase.",
        ["gates"] = gates ?? new JsonArray(Gate($"{id}-accepted", "approval", true)),
        ["id"] = id,
        ["inputs"] = inputs ?? [],
        ["kind"] = "human",
        ["needs"] = Strings(needs ?? []),
        ["outputSchema"] = "../Contracts/v1/approval-decision.schema.json",
        ["policy"] = Policy()
    };

    protected static JsonObject AgentPhase(
        string id,
        string capability,
        string[]? needs = null,
        JsonArray? inputs = null,
        JsonArray? gates = null) => new()
    {
        ["capability"] = capability,
        ["description"] = "Explicit agent phase.",
        ["gates"] = gates ?? new JsonArray(Gate($"{id}-valid", required: true)),
        ["id"] = id,
        ["inputs"] = inputs ?? [],
        ["kind"] = "agent",
        ["needs"] = Strings(needs ?? []),
        ["outputSchema"] = "../Contracts/v1/phase-envelope.schema.json",
        ["policy"] = Policy(),
        ["purpose"] = "work",
        ["role"] = "worker"
    };

    protected static JsonObject CodePhase(
        string id,
        string capability,
        string[]? needs = null,
        JsonArray? inputs = null,
        JsonArray? gates = null) => new()
    {
        ["capability"] = capability,
        ["description"] = "Explicit code phase.",
        ["gates"] = gates ?? new JsonArray(Gate($"{id}-valid", required: true)),
        ["id"] = id,
        ["inputs"] = inputs ?? [],
        ["kind"] = "code",
        ["needs"] = Strings(needs ?? []),
        ["outputSchema"] = "../Contracts/v1/gate-report.schema.json",
        ["policy"] = Policy()
    };

    protected static JsonObject WorkflowInput(string id, string schema = "../Contracts/v1/factory-objective.schema.json") => new()
    {
        ["id"] = id,
        ["schema"] = schema,
        ["source"] = "request"
    };

    protected static JsonObject WorkflowInputBinding(string name, string id) => new()
    {
        ["name"] = name,
        ["source"] = new JsonObject { ["id"] = id, ["kind"] = "workflow-input" }
    };

    protected static JsonObject PhaseOutputBinding(string name, string phaseId) => new()
    {
        ["name"] = name,
        ["source"] = new JsonObject { ["kind"] = "phase-output", ["phaseId"] = phaseId }
    };

    protected static JsonObject Gate(
        string id,
        string kind = "schema",
        bool required = false,
        string? capability = null,
        JsonObject? configuration = null)
    {
        var gate = new JsonObject
        {
            ["id"] = id,
            ["kind"] = kind,
            ["requiredForAcceptance"] = required
        };
        if (capability is not null) gate["capability"] = capability;
        if (configuration is not null) gate["configuration"] = configuration;
        return gate;
    }

    protected static JsonObject Capability(
        string id,
        string[] usages,
        string[]? allowedGateKinds = null)
    {
        var capability = new JsonObject
        {
            ["description"] = "Explicit native capability.",
            ["effect"] = "read",
            ["id"] = id,
            ["policyCapability"] = "read-repository",
            ["usages"] = Strings(usages)
        };
        if (allowedGateKinds is not null) capability["allowedGateKinds"] = Strings(allowedGateKinds);
        if (usages.Contains("gate") || usages.Contains("phase")) capability["outputSchema"] = "../../Contracts/v1/gate-report.schema.json";
        return capability;
    }

    protected static JsonObject CapabilityCatalog(string id, params JsonObject[] capabilities) => new()
    {
        ["$schema"] = "../../Contracts/v1/capability-catalog.schema.json",
        ["capabilities"] = new JsonArray(capabilities),
        ["documentKind"] = "capability-catalog",
        ["id"] = id,
        ["schemaVersion"] = "1",
        ["version"] = "1.0.0"
    };

    protected static JsonObject Policy() => new()
    {
        ["maxAttempts"] = 1,
        ["networkScopes"] = new JsonArray(),
        ["secretScopes"] = new JsonArray(),
        ["timeoutSeconds"] = 60,
        ["writeScopes"] = new JsonArray()
    };

    protected static JsonObject Correction(string target) => new()
    {
        ["maxRounds"] = 1,
        ["targetPhase"] = target,
        ["triggers"] = new JsonArray("output-invalid")
    };

    protected static byte[] Canonical(JsonNode value)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using var writer = new Utf8JsonWriter(buffer);
        value.WriteTo(writer);
        writer.Flush();
        return CanonicalJson.Parse(buffer.WrittenSpan).ToArray();
    }

    protected static JsonArray Strings(IEnumerable<string> values) =>
        new([.. values.Select(_ => (JsonNode)JsonValue.Create(_))]);
}
