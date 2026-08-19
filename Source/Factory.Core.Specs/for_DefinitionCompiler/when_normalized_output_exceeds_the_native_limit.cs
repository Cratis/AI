// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_normalized_output_exceeds_the_native_limit : given_an_accepted_definition_schema_set
{
    DefinitionCompilationResult _result = null!;

    void Because()
    {
        var configuration = new JsonObject
        {
            ["first"] = new string('a', 999_450),
            ["second"] = new string('b', 999_450)
        };
        var phase = HumanPhase(
            "finish",
            gates: new JsonArray(Gate("finish-approved", "approval", true, configuration: configuration)));
        _result = Compile(ValidWorkflow(phase));
    }

    [Fact] void should_reject_normalization() => _result.Status.ShouldEqual(DefinitionCompilationStatus.Rejected);
    [Fact] void should_publish_only_the_normalized_output_limit() => _result.Diagnostics.Single().ShouldEqual(new DefinitionDiagnostic(
        DefinitionDiagnosticCode.NormalizedOutputLimitExceeded,
        DefinitionDiagnosticSeverity.Error,
        DefinitionDiagnosticStatus.LimitExceeded,
        WorkflowId,
        "normalized",
        string.Empty,
        null,
        null));
    [Fact] void should_not_publish_partial_normalized_bytes() => _result.Workflow.ShouldBeNull();
}
