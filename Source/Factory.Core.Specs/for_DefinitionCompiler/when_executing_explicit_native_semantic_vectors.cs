// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_executing_explicit_native_semantic_vectors : given_an_accepted_definition_schema_set
{
    readonly List<string> _failures = [];
    int _vectorCount;
    int _coveredCodeCount;

    void Because()
    {
        var vectors = NativeVectors();
        _vectorCount = vectors.Count;
        _coveredCodeCount = vectors.SelectMany(_ => _.Expected).Select(_ => _.Code).Distinct().Count();
        foreach (var vector in vectors)
        {
            var result = Compile(vector.Workflow, vector.Additional);
            if (result.Status is not DefinitionCompilationStatus.Rejected)
            {
                _failures.Add($"{vector.Id}: status {result.Status}");
                continue;
            }
            var actual = result.Diagnostics.Select(_ => new ExpectedDiagnostic(_.Code, _.Location, _.RelatedId, _.LogicalId)).ToArray();
            if (!actual.SequenceEqual(vector.Expected))
            {
                _failures.Add($"{vector.Id}: expected [{string.Join(';', vector.Expected)}] actual [{string.Join(';', actual)}]");
            }
        }
    }

    [Fact] void should_execute_all_explicit_vectors() => _vectorCount.ShouldEqual(23);
    [Fact] void should_cover_every_non_limit_workflow_semantic_code() => _coveredCodeCount.ShouldEqual(23);
    [Fact] void should_match_every_explicit_native_fact() => _failures.ShouldBeEmpty();

    static IReadOnlyList<NativeVector> NativeVectors()
    {
        var duplicateInputs = ValidWorkflow(
            new JsonArray(HumanPhase("finish")),
            new JsonArray(WorkflowInput("objective"), WorkflowInput("objective")),
            null,
            "finish");

        var duplicatePhases = ValidWorkflow(
            new JsonArray(
                HumanPhase("same", gates: new JsonArray(Gate("first-gate", "approval", true))),
                HumanPhase("same", gates: new JsonArray(Gate("second-gate", "approval", true)))),
            null,
            null,
            "same");

        var duplicatePhaseInputs = ValidWorkflow(HumanPhase(
            "finish",
            inputs: new JsonArray(WorkflowInputBinding("value", "objective"), WorkflowInputBinding("value", "objective"))));

        var duplicateGates = ValidWorkflow(
            new JsonArray(
                HumanPhase("first", gates: new JsonArray(Gate("shared", required: true))),
                HumanPhase("finish", ["first"], gates: new JsonArray(Gate("shared", required: true)))),
            null,
            new JsonArray("shared"),
            "finish");

        var duplicateCapabilities = ValidWorkflow(AgentPhase("finish", "shared"));
        var duplicateCatalog = Catalog(CapabilityCatalog(
            "native-capabilities",
            Capability("shared", ["agent"]),
            Capability("shared", ["agent"])));

        var unknownDependency = ValidWorkflow(HumanPhase("finish", ["ghost"]));
        var cycle = ValidWorkflow(
            new JsonArray(HumanPhase("first", ["finish"]), HumanPhase("finish", ["first"])),
            null,
            null,
            "finish");
        var unknownInput = ValidWorkflow(HumanPhase("finish", inputs: new JsonArray(WorkflowInputBinding("value", "ghost"))));
        var unknownProducer = ValidWorkflow(HumanPhase("finish", inputs: new JsonArray(PhaseOutputBinding("value", "ghost"))));

        var producerNotAncestor = ValidWorkflow(
            HumanPhase("producer"),
            HumanPhase("consumer", inputs: new JsonArray(PhaseOutputBinding("value", "producer"))),
            HumanPhase("finish", ["producer", "consumer"]));

        var unknownCapability = ValidWorkflow(AgentPhase("finish", "ghost"));
        var unsupportedCapability = ValidWorkflow(AgentPhase("finish", "phase-only"));
        var phaseOnlyCatalog = Catalog(CapabilityCatalog("native-capabilities", Capability("phase-only", ["phase"])));

        var unsupportedGateKind = ValidWorkflow(HumanPhase(
            "finish",
            gates: new JsonArray(Gate("check", "command", true, "command-only"))));
        var commandOnlyCatalog = Catalog(CapabilityCatalog(
            "native-capabilities",
            Capability("command-only", ["gate"], [])));

        var unknownSchema = ValidWorkflow(
            new JsonArray(HumanPhase("finish")),
            new JsonArray(WorkflowInput("objective", "../Contracts/v1/ghost.schema.json")),
            null,
            "finish");

        var unknownCorrection = ValidWorkflow(HumanPhase("finish"));
        unknownCorrection["phases"]![0]!["correction"] = Correction("ghost");

        var correctionNotAncestor = ValidWorkflow(
            HumanPhase("target"),
            HumanPhase("correcting"),
            HumanPhase("finish", ["target", "correcting"]));
        correctionNotAncestor["phases"]![1]!["correction"] = Correction("target");

        var unknownAcceptance = ValidWorkflow(
            new JsonArray(HumanPhase("finish", gates: new JsonArray(Gate("known")))),
            null,
            new JsonArray("ghost"),
            "finish");
        var missingAcceptance = ValidWorkflow(
            new JsonArray(HumanPhase(
                "finish",
                gates: new JsonArray(Gate("included", "approval", true), Gate("required", "approval", true)))),
            null,
            new JsonArray("included"),
            "finish");
        var nonRequiredAcceptance = ValidWorkflow(
            new JsonArray(HumanPhase("finish", gates: new JsonArray(Gate("optional")))),
            null,
            new JsonArray("optional"),
            "finish");

        var unknownSuccess = ValidWorkflow(
            new JsonArray(HumanPhase("finish")),
            null,
            null,
            "ghost");
        var successWithDependent = ValidWorkflow(
            new JsonArray(HumanPhase("success"), HumanPhase("dependent", ["success"])),
            null,
            null,
            "success");
        var disconnected = ValidWorkflow(
            new JsonArray(HumanPhase("orphan"), HumanPhase("finish")),
            null,
            null,
            "finish");

        var unsupportedScope = ValidWorkflow(HumanPhase("finish"));
        unsupportedScope["phases"]![0]!["policy"]!["writeScopes"] = new JsonArray("source");

        return
        [
            Vector("duplicate-workflow-input", duplicateInputs, Diagnostic(DefinitionDiagnosticCode.DuplicateWorkflowInputId, "workflow/inputs/objective", "objective")),
            Vector("duplicate-phase", duplicatePhases, Diagnostic(DefinitionDiagnosticCode.DuplicatePhaseId, "workflow/phases/same", "same")),
            Vector("duplicate-phase-input", duplicatePhaseInputs, Diagnostic(DefinitionDiagnosticCode.DuplicatePhaseInputName, "workflow/phases/finish/inputs/value", "value")),
            Vector("duplicate-gate", duplicateGates, Diagnostic(DefinitionDiagnosticCode.DuplicateGateId, "workflow/phases/first/gates/shared", "shared")),
            Vector("duplicate-capability", duplicateCapabilities, Diagnostic(DefinitionDiagnosticCode.DuplicateCapabilityId, "capabilities/shared", "shared", "native-capabilities"), duplicateCatalog),
            Vector("unknown-dependency", unknownDependency, Diagnostic(DefinitionDiagnosticCode.UnknownDependency, "workflow/phases/finish/needs", "ghost")),
            Vector("dependency-cycle", cycle, Diagnostic(DefinitionDiagnosticCode.DependencyCycle, "workflow")),
            Vector("unknown-workflow-input", unknownInput, Diagnostic(DefinitionDiagnosticCode.UnknownWorkflowInput, "workflow/phases/finish/inputs/value", "ghost")),
            Vector("unknown-producer", unknownProducer, Diagnostic(DefinitionDiagnosticCode.UnknownProducerPhase, "workflow/phases/finish/inputs/value", "ghost")),
            Vector("producer-not-ancestor", producerNotAncestor, Diagnostic(DefinitionDiagnosticCode.ProducerNotAncestor, "workflow/phases/consumer/inputs/value", "producer")),
            Vector("unknown-capability", unknownCapability, Diagnostic(DefinitionDiagnosticCode.UnknownCapability, "workflow/phases/finish", "ghost")),
            Vector("unsupported-capability", unsupportedCapability, Diagnostic(DefinitionDiagnosticCode.UnsupportedCapabilityUsage, "workflow/phases/finish", "phase-only"), phaseOnlyCatalog),
            Vector("unsupported-gate-kind", unsupportedGateKind, Diagnostic(DefinitionDiagnosticCode.UnsupportedCapabilityGateKind, "workflow/phases/finish/gates/check", "command-only"), commandOnlyCatalog),
            Vector("unknown-schema", unknownSchema, Diagnostic(DefinitionDiagnosticCode.UnknownSchemaReference, "workflow/inputs/objective", "https://schemas.cratis.io/factory/v1/ghost.schema.json")),
            Vector("unknown-correction", unknownCorrection, Diagnostic(DefinitionDiagnosticCode.UnknownCorrectionTarget, "workflow/phases/finish/correction", "ghost")),
            Vector("correction-not-ancestor", correctionNotAncestor, Diagnostic(DefinitionDiagnosticCode.CorrectionTargetNotAncestor, "workflow/phases/correcting/correction", "target")),
            Vector("unknown-acceptance", unknownAcceptance, Diagnostic(DefinitionDiagnosticCode.AcceptanceUnknownGate, "workflow/acceptance", "ghost")),
            Vector("missing-acceptance", missingAcceptance, Diagnostic(DefinitionDiagnosticCode.AcceptanceMissingRequiredGate, "workflow/acceptance", "required")),
            Vector("non-required-acceptance", nonRequiredAcceptance, Diagnostic(DefinitionDiagnosticCode.AcceptanceIncludesNonRequiredGate, "workflow/acceptance", "optional")),
            Vector("unknown-success", unknownSuccess, Diagnostic(DefinitionDiagnosticCode.UnknownSuccessPhase, "workflow/terminal", "ghost")),
            Vector(
                "success-with-dependent",
                successWithDependent,
                [
                    Diagnostic(DefinitionDiagnosticCode.SuccessPhaseHasDependents, "workflow/terminal", "dependent"),
                    Diagnostic(DefinitionDiagnosticCode.PhaseDoesNotLeadToSuccess, "workflow/terminal", "dependent")
                ]),
            Vector("phase-does-not-lead-to-success", disconnected, Diagnostic(DefinitionDiagnosticCode.PhaseDoesNotLeadToSuccess, "workflow/terminal", "orphan")),
            Vector("unsupported-scope", unsupportedScope, Diagnostic(DefinitionDiagnosticCode.UnsupportedPhaseScope, "workflow/phases/finish/policy/write-scopes"))
        ];
    }

    static NativeVector Vector(string id, JsonObject workflow, ExpectedDiagnostic expected, params DefinitionDocument[] additional) =>
        new(id, workflow, additional, [expected]);

    static NativeVector Vector(string id, JsonObject workflow, ExpectedDiagnostic[] expected, params DefinitionDocument[] additional) =>
        new(id, workflow, additional, expected);

    static ExpectedDiagnostic Diagnostic(
        DefinitionDiagnosticCode code,
        string location,
        string relatedId = "",
        string logicalId = WorkflowId) => new(code, location, relatedId, logicalId);

    sealed record NativeVector(
        string Id,
        JsonObject Workflow,
        DefinitionDocument[] Additional,
        ExpectedDiagnostic[] Expected);

    sealed record ExpectedDiagnostic(
        DefinitionDiagnosticCode Code,
        string Location,
        string RelatedId,
        string LogicalId);
}
