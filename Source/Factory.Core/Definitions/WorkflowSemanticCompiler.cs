// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.Definitions;

static class WorkflowSemanticCompiler
{
    const string SchemaPrefix = "../Contracts/v1/";
    const string SchemaResourcePrefix = "https://schemas.cratis.io/factory/v1/";

    public static CompiledWorkflow? Compile(
        SchemaResourceSet schemas,
        IReadOnlyList<AdmittedDefinition> definitions,
        AdmittedDefinition selected,
        Sha256Hash definitionSetIdentity,
        DefinitionDiagnosticCollection diagnostics)
    {
        var workflow = selected.Value.RootElement;
        var logicalId = selected.Descriptor.LogicalId;
        var capabilities = ReadCapabilities(definitions, diagnostics);
        var inputs = workflow.GetProperty("inputs").EnumerateArray().ToArray();
        var phases = workflow.GetProperty("phases").EnumerateArray().Select(ReadPhase).ToArray();
        var acceptanceIds = workflow.GetProperty("acceptance").GetProperty("requiredGateIds").EnumerateArray().Select(GetString).ToArray();
        var successPhase = workflow.GetProperty("terminal").GetProperty("successPhase").GetString()!;

        var phaseInputs = phases.Sum(_ => _.Inputs.Length);
        var gates = phases.Sum(_ => _.Gates.Length);
        var dependencyEdges = phases.Sum(_ => _.Needs.Length);
        var corrections = phases.Count(_ => _.Correction.HasValue);
        var semanticWork = SaturatingWork(
            definitions.Count,
            capabilities.Count,
            inputs.Length,
            phases.Length,
            phaseInputs,
            gates,
            dependencyEdges,
            corrections,
            acceptanceIds.Length);

        if (capabilities.Count > 16) diagnostics.Add(DefinitionDiagnosticCode.CapabilityLimitExceeded, location: "capabilities");
        if (inputs.Length > 16) diagnostics.Add(DefinitionDiagnosticCode.WorkflowInputLimitExceeded, logicalId, "workflow/inputs");
        if (phases.Length > 16) diagnostics.Add(DefinitionDiagnosticCode.PhaseLimitExceeded, logicalId, "workflow/phases");
        if (phaseInputs > 64) diagnostics.Add(DefinitionDiagnosticCode.PhaseInputLimitExceeded, logicalId, $"workflow/phases/{phases[0].Id}/inputs");
        if (gates > 32) diagnostics.Add(DefinitionDiagnosticCode.GateLimitExceeded, logicalId, $"workflow/phases/{phases[0].Id}/gates");
        if (dependencyEdges > 64) diagnostics.Add(DefinitionDiagnosticCode.DependencyEdgeLimitExceeded, logicalId, "workflow/phases/needs");
        if (semanticWork > 256 && phaseInputs < 64) diagnostics.Add(DefinitionDiagnosticCode.SemanticWorkLimitExceeded, logicalId, "workflow");
        if (diagnostics.HasDiagnostics)
        {
            return null;
        }

        var inputIds = AddDuplicates(
            inputs.Select(_ => GetString(_.GetProperty("id"))),
            id => diagnostics.Add(DefinitionDiagnosticCode.DuplicateWorkflowInputId, logicalId, $"workflow/inputs/{id}", id));
        var phaseIds = AddDuplicates(
            phases.Select(_ => _.Id),
            id => diagnostics.Add(DefinitionDiagnosticCode.DuplicatePhaseId, logicalId, $"workflow/phases/{id}", id));
        foreach (var phase in phases)
        {
            AddDuplicates(
                phase.Inputs.Select(_ => GetString(_.GetProperty("name"))),
                name => diagnostics.Add(DefinitionDiagnosticCode.DuplicatePhaseInputName, logicalId, $"workflow/phases/{phase.Id}/inputs/{name}", name));
        }
        var allGates = phases.SelectMany(_ => _.Gates.Select(gate => new GateInfo(_.Id, gate))).ToArray();
        var gateIds = AddDuplicates(
            allGates.Select(_ => GetString(_.Gate.GetProperty("id"))),
            id =>
            {
                var owner = allGates.First(_ => GetString(_.Gate.GetProperty("id")) == id).PhaseId;
                diagnostics.Add(DefinitionDiagnosticCode.DuplicateGateId, logicalId, $"workflow/phases/{owner}/gates/{id}", id);
            });

        ValidateSchemaReferences(schemas, logicalId, inputs, phases, diagnostics);
        var uniquePhaseIds = phaseIds.Count == phases.Length;
        var graphValid = false;
        Dictionary<string, HashSet<string>> ancestors = new(StringComparer.Ordinal);
        Dictionary<string, List<string>> dependents = new(StringComparer.Ordinal);
        if (uniquePhaseIds)
        {
            (graphValid, ancestors, dependents) = ValidateGraph(logicalId, phases, phaseIds, diagnostics);
        }

        if (graphValid)
        {
            ValidateInputs(logicalId, phases, inputIds, phaseIds, ancestors, diagnostics);
        }
        ValidateCapabilities(logicalId, phases, capabilities, diagnostics);
        if (graphValid)
        {
            ValidateCorrections(logicalId, phases, phaseIds, ancestors, diagnostics);
        }
        ValidateAcceptance(logicalId, allGates, gateIds, acceptanceIds, diagnostics);
        ValidateTerminal(logicalId, phases, phaseIds, successPhase, graphValid, ancestors, dependents, diagnostics);
        ValidateScopes(logicalId, phases, diagnostics);

        if (diagnostics.HasDiagnostics || !graphValid)
        {
            return null;
        }

        return Normalize(
            schemas,
            definitions,
            selected,
            definitionSetIdentity,
            inputs,
            TopologicalOrder(phases),
            capabilities,
            acceptanceIds,
            successPhase,
            diagnostics);
    }

    static List<CapabilityInfo> ReadCapabilities(
        IReadOnlyList<AdmittedDefinition> definitions,
        DefinitionDiagnosticCollection diagnostics)
    {
        var capabilities = new List<CapabilityInfo>();
        foreach (var definition in definitions.Where(_ => _.Descriptor.Kind is DefinitionKind.CapabilityCatalog))
        {
            var catalog = definition.Value.RootElement;
            foreach (var capability in catalog.GetProperty("capabilities").EnumerateArray())
            {
                capabilities.Add(new(definition, capability));
            }
        }
        foreach (var duplicate in capabilities.GroupBy(_ => _.Id, StringComparer.Ordinal).Where(_ => _.Count() > 1))
        {
            diagnostics.Add(
                DefinitionDiagnosticCode.DuplicateCapabilityId,
                duplicate.First().Definition.Descriptor.LogicalId,
                $"capabilities/{duplicate.Key}",
                duplicate.Key);
        }
        return capabilities;
    }

    static PhaseInfo ReadPhase(JsonElement phase) => new(
        phase,
        GetString(phase.GetProperty("id")),
        phase.GetProperty("kind").GetString() switch
        {
            "human" => WorkflowPhaseKind.Human,
            "agent" => WorkflowPhaseKind.Agent,
            "code" => WorkflowPhaseKind.Code,
            _ => WorkflowPhaseKind.Unknown
        },
        [.. phase.GetProperty("needs").EnumerateArray().Select(GetString)],
        [.. phase.GetProperty("inputs").EnumerateArray()],
        [.. phase.GetProperty("gates").EnumerateArray()],
        phase.TryGetProperty("correction", out var correction) ? correction : null);

    static void ValidateSchemaReferences(
        SchemaResourceSet schemas,
        string logicalId,
        JsonElement[] inputs,
        PhaseInfo[] phases,
        DefinitionDiagnosticCollection diagnostics)
    {
        foreach (var input in inputs)
        {
            var id = GetString(input.GetProperty("id"));
            ResolveSchema(schemas, GetString(input.GetProperty("schema")), logicalId, $"workflow/inputs/{id}", diagnostics);
        }
        foreach (var phase in phases)
        {
            ResolveSchema(schemas, GetString(phase.Value.GetProperty("outputSchema")), logicalId, $"workflow/phases/{phase.Id}/output-schema", diagnostics);
        }
    }

    static (bool Valid, Dictionary<string, HashSet<string>> Ancestors, Dictionary<string, List<string>> Dependents) ValidateGraph(
        string logicalId,
        PhaseInfo[] phases,
        HashSet<string> phaseIds,
        DefinitionDiagnosticCollection diagnostics)
    {
        var hasUnknown = false;
        var dependents = phaseIds.ToDictionary(_ => _, _ => new List<string>(), StringComparer.Ordinal);
        var indegree = phaseIds.ToDictionary(_ => _, _ => 0, StringComparer.Ordinal);
        foreach (var phase in phases)
        {
            foreach (var need in phase.Needs)
            {
                if (!phaseIds.Contains(need))
                {
                    diagnostics.Add(DefinitionDiagnosticCode.UnknownDependency, logicalId, $"workflow/phases/{phase.Id}/needs", need);
                    hasUnknown = true;
                }
                else
                {
                    dependents[need].Add(phase.Id);
                    indegree[phase.Id]++;
                }
            }
        }
        if (hasUnknown)
        {
            return (false, new(StringComparer.Ordinal), dependents);
        }

        var ready = new PriorityQueue<string, string>(StringComparer.Ordinal);
        foreach (var pair in indegree.Where(_ => _.Value == 0)) ready.Enqueue(pair.Key, pair.Key);
        var count = 0;
        while (ready.TryDequeue(out var current, out _))
        {
            count++;
            foreach (var dependent in dependents[current])
            {
                if (--indegree[dependent] == 0) ready.Enqueue(dependent, dependent);
            }
        }
        if (count != phases.Length)
        {
            diagnostics.Add(DefinitionDiagnosticCode.DependencyCycle, logicalId, "workflow");
            return (false, new(StringComparer.Ordinal), dependents);
        }

        var byId = phases.ToDictionary(_ => _.Id, StringComparer.Ordinal);
        var ancestors = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var phase in TopologicalOrder(phases))
        {
            var set = new HashSet<string>(StringComparer.Ordinal);
            foreach (var need in phase.Needs)
            {
                set.Add(need);
                set.UnionWith(ancestors[need]);
            }
            ancestors[phase.Id] = set;
        }
        return (true, ancestors, dependents);
    }

    static void ValidateInputs(
        string logicalId,
        PhaseInfo[] phases,
        HashSet<string> workflowInputIds,
        HashSet<string> phaseIds,
        Dictionary<string, HashSet<string>> ancestors,
        DefinitionDiagnosticCollection diagnostics)
    {
        foreach (var phase in phases)
        {
            foreach (var input in phase.Inputs)
            {
                var name = GetString(input.GetProperty("name"));
                var source = input.GetProperty("source");
                if (GetString(source.GetProperty("kind")) == "workflow-input")
                {
                    var id = GetString(source.GetProperty("id"));
                    if (!workflowInputIds.Contains(id)) diagnostics.Add(DefinitionDiagnosticCode.UnknownWorkflowInput, logicalId, $"workflow/phases/{phase.Id}/inputs/{name}", id);
                }
                else
                {
                    var producer = GetString(source.GetProperty("phaseId"));
                    if (!phaseIds.Contains(producer)) diagnostics.Add(DefinitionDiagnosticCode.UnknownProducerPhase, logicalId, $"workflow/phases/{phase.Id}/inputs/{name}", producer);
                    else if (!ancestors[phase.Id].Contains(producer)) diagnostics.Add(DefinitionDiagnosticCode.ProducerNotAncestor, logicalId, $"workflow/phases/{phase.Id}/inputs/{name}", producer);
                }
            }
        }
    }

    static void ValidateCapabilities(
        string logicalId,
        PhaseInfo[] phases,
        IReadOnlyList<CapabilityInfo> capabilities,
        DefinitionDiagnosticCollection diagnostics)
    {
        var lookup = capabilities.GroupBy(_ => _.Id, StringComparer.Ordinal).Where(_ => _.Count() == 1).ToDictionary(_ => _.Key, _ => _.Single(), StringComparer.Ordinal);
        foreach (var phase in phases.Where(_ => _.Kind is WorkflowPhaseKind.Agent or WorkflowPhaseKind.Code))
        {
            var id = GetString(phase.Value.GetProperty("capability"));
            if (!lookup.TryGetValue(id, out var capability)) diagnostics.Add(DefinitionDiagnosticCode.UnknownCapability, logicalId, $"workflow/phases/{phase.Id}", id);
            else if (!capability.Usages.Contains(phase.Kind is WorkflowPhaseKind.Agent ? "agent" : "phase")) diagnostics.Add(DefinitionDiagnosticCode.UnsupportedCapabilityUsage, logicalId, $"workflow/phases/{phase.Id}", id);
        }
        foreach (var phase in phases)
        {
            foreach (var gate in phase.Gates.Where(_ => _.TryGetProperty("capability", out _)))
            {
                var id = GetString(gate.GetProperty("capability"));
                var gateId = GetString(gate.GetProperty("id"));
                if (!lookup.TryGetValue(id, out var capability)) diagnostics.Add(DefinitionDiagnosticCode.UnknownCapability, logicalId, $"workflow/phases/{phase.Id}/gates/{gateId}", id);
                else if (!capability.Usages.Contains("gate")) diagnostics.Add(DefinitionDiagnosticCode.UnsupportedCapabilityUsage, logicalId, $"workflow/phases/{phase.Id}/gates/{gateId}", id);
                else if (!capability.AllowedGateKinds.Contains(GetString(gate.GetProperty("kind")))) diagnostics.Add(DefinitionDiagnosticCode.UnsupportedCapabilityGateKind, logicalId, $"workflow/phases/{phase.Id}/gates/{gateId}", id);
            }
        }
    }

    static void ValidateCorrections(
        string logicalId,
        PhaseInfo[] phases,
        HashSet<string> phaseIds,
        Dictionary<string, HashSet<string>> ancestors,
        DefinitionDiagnosticCollection diagnostics)
    {
        foreach (var phase in phases.Where(_ => _.Correction.HasValue))
        {
            var target = GetString(phase.Correction.GetValueOrDefault().GetProperty("targetPhase"));
            if (!phaseIds.Contains(target)) diagnostics.Add(DefinitionDiagnosticCode.UnknownCorrectionTarget, logicalId, $"workflow/phases/{phase.Id}/correction", target);
            else if (target != phase.Id && !ancestors[phase.Id].Contains(target)) diagnostics.Add(DefinitionDiagnosticCode.CorrectionTargetNotAncestor, logicalId, $"workflow/phases/{phase.Id}/correction", target);
        }
    }

    static void ValidateAcceptance(
        string logicalId,
        GateInfo[] gates,
        HashSet<string> gateIds,
        string[] acceptanceIds,
        DefinitionDiagnosticCollection diagnostics)
    {
        var required = gates.Where(_ => _.Gate.GetProperty("requiredForAcceptance").GetBoolean()).Select(_ => GetString(_.Gate.GetProperty("id"))).ToHashSet(StringComparer.Ordinal);
        var included = acceptanceIds.ToHashSet(StringComparer.Ordinal);
        foreach (var id in included.Where(_ => !gateIds.Contains(_))) diagnostics.Add(DefinitionDiagnosticCode.AcceptanceUnknownGate, logicalId, "workflow/acceptance", id);
        foreach (var id in required.Where(_ => !included.Contains(_))) diagnostics.Add(DefinitionDiagnosticCode.AcceptanceMissingRequiredGate, logicalId, "workflow/acceptance", id);
        foreach (var id in included.Where(_ => gateIds.Contains(_) && !required.Contains(_))) diagnostics.Add(DefinitionDiagnosticCode.AcceptanceIncludesNonRequiredGate, logicalId, "workflow/acceptance", id);
    }

    static void ValidateTerminal(
        string logicalId,
        PhaseInfo[] phases,
        HashSet<string> phaseIds,
        string successPhase,
        bool graphValid,
        Dictionary<string, HashSet<string>> ancestors,
        Dictionary<string, List<string>> dependents,
        DefinitionDiagnosticCollection diagnostics)
    {
        if (!phaseIds.Contains(successPhase))
        {
            diagnostics.Add(DefinitionDiagnosticCode.UnknownSuccessPhase, logicalId, "workflow/terminal", successPhase);
            return;
        }
        if (!graphValid) return;
        if (dependents[successPhase].Count > 0) diagnostics.Add(DefinitionDiagnosticCode.SuccessPhaseHasDependents, logicalId, "workflow/terminal", dependents[successPhase].Order(StringComparer.Ordinal).First());
        foreach (var phase in phases.Where(_ => _.Id != successPhase && !ancestors[successPhase].Contains(_.Id))) diagnostics.Add(DefinitionDiagnosticCode.PhaseDoesNotLeadToSuccess, logicalId, "workflow/terminal", phase.Id);
    }

    static void ValidateScopes(string logicalId, PhaseInfo[] phases, DefinitionDiagnosticCollection diagnostics)
    {
        foreach (var phase in phases)
        {
            var policy = phase.Value.GetProperty("policy");
            foreach (var scope in new[] { "writeScopes", "networkScopes", "secretScopes" })
            {
                if (policy.GetProperty(scope).GetArrayLength() > 0)
                {
                    var locationName = scope switch
                    {
                        "writeScopes" => "write-scopes",
                        "networkScopes" => "network-scopes",
                        _ => "secret-scopes"
                    };
                    diagnostics.Add(DefinitionDiagnosticCode.UnsupportedPhaseScope, logicalId, $"workflow/phases/{phase.Id}/policy/{locationName}");
                }
            }
        }
    }

    static CompiledWorkflow? Normalize(
        SchemaResourceSet schemas,
        IReadOnlyList<AdmittedDefinition> definitions,
        AdmittedDefinition selected,
        Sha256Hash definitionSetIdentity,
        JsonElement[] inputs,
        PhaseInfo[] ordered,
        IReadOnlyList<CapabilityInfo> capabilities,
        string[] acceptanceIds,
        string successPhase,
        DefinitionDiagnosticCollection diagnostics)
    {
        var catalogs = new JsonArray();
        foreach (var definition in definitions.Where(_ => _.Descriptor.Kind is DefinitionKind.CapabilityCatalog)
                     .OrderBy(_ => GetString(_.Value.RootElement.GetProperty("id")), StringComparer.Ordinal)
                     .ThenBy(_ => _.Descriptor.LogicalId, StringComparer.Ordinal))
        {
            catalogs.Add((JsonNode)new JsonObject
            {
                ["contentHash"] = definition.Descriptor.ContentHash.Value,
                ["id"] = GetString(definition.Value.RootElement.GetProperty("id")),
                ["version"] = GetString(definition.Value.RootElement.GetProperty("version"))
            });
        }

        var normalizedInputs = new JsonArray();
        foreach (var input in inputs)
        {
            var normalizedInput = new JsonObject
            {
                ["id"] = GetString(input.GetProperty("id")),
                ["schema"] = SchemaObject(schemas, GetString(input.GetProperty("schema"))),
                ["source"] = GetString(input.GetProperty("source"))
            };
            if (input.TryGetProperty("preflightValue", out var preflightValue)) normalizedInput["preflightValue"] = GetString(preflightValue);
            normalizedInputs.Add((JsonNode)normalizedInput);
        }

        var normalizedPhases = new JsonArray();
        var descriptors = new List<CompiledPhaseDescriptor>();
        for (var ordinal = 0; ordinal < ordered.Length; ordinal++)
        {
            var phase = ordered[ordinal];
            var phaseCapabilities = NormalizeCapabilities(phase, capabilities);
            var normalizedPhase = new JsonObject
            {
                ["capabilities"] = phaseCapabilities,
                ["execution"] = Execution(phase),
                ["gates"] = Clone(phase.Value.GetProperty("gates")),
                ["id"] = phase.Id,
                ["inputs"] = Clone(phase.Value.GetProperty("inputs")),
                ["kind"] = phase.Value.GetProperty("kind").GetString(),
                ["needs"] = new JsonArray([.. phase.Needs.Order(StringComparer.Ordinal).Select(_ => (JsonNode)JsonValue.Create(_))]),
                ["ordinal"] = ordinal,
                ["outputSchema"] = SchemaObject(schemas, GetString(phase.Value.GetProperty("outputSchema"))),
                ["policy"] = Clone(phase.Value.GetProperty("policy"))
            };
            if (phase.Correction.HasValue) normalizedPhase["correction"] = Clone(phase.Correction.Value);
            normalizedPhases.Add((JsonNode)normalizedPhase);
            descriptors.Add(new(phase.Id, ordinal, phase.Kind, phase.Needs.Order(StringComparer.Ordinal)));
        }

        var source = selected.Value.RootElement;
        var workflow = new JsonObject
        {
            ["capabilityCatalogs"] = catalogs,
            ["id"] = GetString(source.GetProperty("id")),
            ["inputs"] = normalizedInputs,
            ["orderedPhases"] = normalizedPhases,
            ["requiredGateIds"] = new JsonArray([.. acceptanceIds.Order(StringComparer.Ordinal).Select(_ => (JsonNode)JsonValue.Create(_))]),
            ["sourceContentHash"] = selected.Descriptor.ContentHash.Value,
            ["terminal"] = Clone(source.GetProperty("terminal")),
            ["version"] = GetString(source.GetProperty("version"))
        };
        var root = new JsonObject
        {
            ["algorithm"] = "factory-definition-workflow-compilation-v1",
            ["definitionSetIdentity"] = definitionSetIdentity.Value,
            ["protocolVersion"] = "1",
            ["schemaSetIdentity"] = AcceptedDefinitionSchemas.Identity,
            ["workflow"] = workflow
        };
        if (!CanonicalJson.TryParse(Serialize(root), out var preHash, out _))
        {
            diagnostics.Add(DefinitionDiagnosticCode.NormalizedOutputLimitExceeded, selected.Descriptor.LogicalId, "normalized");
            return null;
        }
        var contentHash = Sha256Hash.Calculate(preHash.Utf8);
        root["contentHash"] = contentHash.Value;
        if (!CanonicalJson.TryParse(Serialize(root), out var normalized, out _) || normalized.Utf8.Length > 2_000_000)
        {
            diagnostics.Add(DefinitionDiagnosticCode.NormalizedOutputLimitExceeded, selected.Descriptor.LogicalId, "normalized");
            return null;
        }
        return new(
            GetString(source.GetProperty("id")),
            GetString(source.GetProperty("version")),
            selected.Descriptor.ContentHash,
            contentHash,
            descriptors,
            acceptanceIds.Order(StringComparer.Ordinal),
            successPhase,
            normalized);
    }

    static JsonArray NormalizeCapabilities(PhaseInfo phase, IReadOnlyList<CapabilityInfo> capabilities)
    {
        var lookup = capabilities.GroupBy(_ => _.Id, StringComparer.Ordinal).Where(_ => _.Count() == 1).ToDictionary(_ => _.Key, _ => _.Single(), StringComparer.Ordinal);
        var values = new List<JsonObject>();
        if (phase.Kind is WorkflowPhaseKind.Agent or WorkflowPhaseKind.Code)
        {
            var id = GetString(phase.Value.GetProperty("capability"));
            values.Add(CapabilityObject(lookup[id], phase.Kind is WorkflowPhaseKind.Agent ? "agent" : "phase", phase.Id));
        }
        foreach (var gate in phase.Gates.Where(_ => _.TryGetProperty("capability", out _)))
        {
            var id = GetString(gate.GetProperty("capability"));
            values.Add(CapabilityObject(lookup[id], "gate", GetString(gate.GetProperty("id"))));
        }
        return [.. values.OrderBy(_ => _["usage"]!.GetValue<string>(), StringComparer.Ordinal)
            .ThenBy(_ => _["sourceId"]!.GetValue<string>(), StringComparer.Ordinal)
            .ThenBy(_ => _["id"]!.GetValue<string>(), StringComparer.Ordinal)
            .Cast<JsonNode>()];
    }

    static JsonObject CapabilityObject(CapabilityInfo capability, string usage, string sourceId) => new()
    {
        ["effect"] = GetString(capability.Value.GetProperty("effect")),
        ["id"] = capability.Id,
        ["policyCapability"] = GetString(capability.Value.GetProperty("policyCapability")),
        ["sourceId"] = sourceId,
        ["usage"] = usage
    };

    static JsonObject Execution(PhaseInfo phase) => phase.Kind switch
    {
        WorkflowPhaseKind.Human => new() { ["approval"] = Clone(phase.Value.GetProperty("approval")), ["kind"] = "human" },
        WorkflowPhaseKind.Agent => new()
        {
            ["capability"] = GetString(phase.Value.GetProperty("capability")),
            ["kind"] = "agent",
            ["purpose"] = GetString(phase.Value.GetProperty("purpose")),
            ["role"] = GetString(phase.Value.GetProperty("role"))
        },
        _ => new() { ["capability"] = GetString(phase.Value.GetProperty("capability")), ["kind"] = "code" }
    };

    static JsonObject SchemaObject(SchemaResourceSet schemas, string reference)
    {
        var schemaId = ResolveSchemaId(reference);
        return new()
        {
            ["closureIdentity"] = schemas.GetClosure(schemaId).Closure!.Identity.Value,
            ["schemaId"] = schemaId
        };
    }

    static bool ResolveSchema(
        SchemaResourceSet schemas,
        string reference,
        string logicalId,
        string location,
        DefinitionDiagnosticCollection diagnostics)
    {
        var schemaId = ResolveSchemaId(reference);
        if (schemas.GetClosure(schemaId).Status is SchemaClosureStatus.Resolved) return true;
        diagnostics.Add(DefinitionDiagnosticCode.UnknownSchemaReference, logicalId, location, schemaId);
        return false;
    }

    static string ResolveSchemaId(string reference) => SchemaResourcePrefix + reference[SchemaPrefix.Length..];

    static PhaseInfo[] TopologicalOrder(PhaseInfo[] phases)
    {
        var byId = phases.ToDictionary(_ => _.Id, StringComparer.Ordinal);
        var indegree = phases.ToDictionary(_ => _.Id, _ => _.Needs.Length, StringComparer.Ordinal);
        var dependents = phases.ToDictionary(_ => _.Id, _ => new List<string>(), StringComparer.Ordinal);
        foreach (var phase in phases)
        {
            foreach (var need in phase.Needs) dependents[need].Add(phase.Id);
        }
        var ready = new PriorityQueue<string, string>(StringComparer.Ordinal);
        foreach (var pair in indegree.Where(_ => _.Value == 0)) ready.Enqueue(pair.Key, pair.Key);
        var ordered = new List<PhaseInfo>();
        while (ready.TryDequeue(out var current, out _))
        {
            ordered.Add(byId[current]);
            foreach (var dependent in dependents[current])
            {
                if (--indegree[dependent] == 0) ready.Enqueue(dependent, dependent);
            }
        }
        return [.. ordered];
    }

    static HashSet<string> AddDuplicates(IEnumerable<string> values, Action<string> add)
    {
        var array = values.ToArray();
        foreach (var duplicate in array.GroupBy(_ => _, StringComparer.Ordinal).Where(_ => _.Count() > 1).Select(_ => _.Key)) add(duplicate);
        return array.ToHashSet(StringComparer.Ordinal);
    }

    static int SaturatingWork(params int[] values)
    {
        var result = values[0] + values[1] + values[2] + values[3];
        result += 4 * values[4];
        result += 4 * values[5];
        result += 3 * values[6];
        result += values[7];
        result += 2 * values[8];
        return Math.Min(result, 257);
    }

    static JsonNode Clone(JsonElement element) => JsonNode.Parse(element.GetRawText())!;
    static string GetString(JsonElement element) => element.GetString()!;

    static byte[] Serialize(JsonNode node)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using var writer = new Utf8JsonWriter(buffer);
        node.WriteTo(writer);
        writer.Flush();
        return buffer.WrittenSpan.ToArray();
    }

    sealed record CapabilityInfo(AdmittedDefinition Definition, JsonElement Value)
    {
        public string Id => GetString(Value.GetProperty("id"));
        public HashSet<string> Usages => Value.GetProperty("usages").EnumerateArray().Select(GetString).ToHashSet(StringComparer.Ordinal);
        public HashSet<string> AllowedGateKinds => Value.TryGetProperty("allowedGateKinds", out var kinds)
            ? kinds.EnumerateArray().Select(GetString).ToHashSet(StringComparer.Ordinal)
            : [];
    }

    sealed record PhaseInfo(
        JsonElement Value,
        string Id,
        WorkflowPhaseKind Kind,
        string[] Needs,
        JsonElement[] Inputs,
        JsonElement[] Gates,
        JsonElement? Correction);

    sealed record GateInfo(string PhaseId, JsonElement Gate);
}
