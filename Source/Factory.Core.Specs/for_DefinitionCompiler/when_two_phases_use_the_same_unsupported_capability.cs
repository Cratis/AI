// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_two_phases_use_the_same_unsupported_capability : given_an_accepted_definition_schema_set
{
    const string CapabilityId = "factory-verify-evidence";
    DefinitionCompilationResult _result = null!;

    void Because()
    {
        var catalog = CapabilityCatalog("native-capabilities", Capability(CapabilityId, ["gate"], ["command"]));
        _result = Compile(
            ValidWorkflow(
                AgentPhase("investigate", CapabilityId),
                CodePhase("verify-workspace", CapabilityId, ["investigate"])),
            Catalog(catalog));
    }

    [Fact] void should_reject_the_workflow() => _result.Status.ShouldEqual(DefinitionCompilationStatus.Rejected);
    [Fact] void should_report_every_offending_reference() => _result.Diagnostics.Count.ShouldEqual(2);
    [Fact] void should_report_the_agent_phase_location_first() => _result.Diagnostics[0].ShouldEqual(ExpectedAt("investigate"));
    [Fact] void should_report_the_code_phase_location_second() => _result.Diagnostics[1].ShouldEqual(ExpectedAt("verify-workspace"));

    static DefinitionDiagnostic ExpectedAt(string phaseId) => new(
        DefinitionDiagnosticCode.UnsupportedCapabilityUsage,
        DefinitionDiagnosticSeverity.Error,
        DefinitionDiagnosticStatus.Rejected,
        WorkflowId,
        $"workflow/phases/{phaseId}",
        CapabilityId,
        null,
        null);
}
