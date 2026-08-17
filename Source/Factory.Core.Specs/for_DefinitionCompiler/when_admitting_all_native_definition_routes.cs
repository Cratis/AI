// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_admitting_all_native_definition_routes : given_an_accepted_definition_schema_set
{
    readonly List<string> _failures = [];
    int _routeCount;

    void Because()
    {
        var routes = new NativeRoute[]
        {
            new(DefinitionKind.CapabilityCatalog),
            new(DefinitionKind.EvaluationCatalog),
            new(DefinitionKind.Policy),
            new(DefinitionKind.Profile),
            new(DefinitionKind.ProjectManifest),
            new(DefinitionKind.Workflow),
            new(DefinitionKind.AgentContext),
            new(DefinitionKind.ArtifactDescriptor),
            new(DefinitionKind.ArtifactProvenance),
            new(DefinitionKind.ArtifactReceipt),
            new(DefinitionKind.PhaseEnvelope),
            new(DefinitionKind.RunInputSet),
            new(DefinitionKind.SanitizationAttestation)
        };
        _routeCount = routes.Length;
        foreach (var route in routes)
        {
            var result = DefinitionCompiler.Compile(Schemas, [Native("native-route", route.Kind)], WorkflowId);
            if (result.Definitions.Count != 1 || result.Definitions[0].Kind != route.Kind) _failures.Add($"{route.Kind}: descriptor");
            if (!DefinitionCompiler.TryGetSchemaId(route.Kind, out var schemaId) || result.Definitions[0].SchemaId != schemaId)
            {
                _failures.Add($"{route.Kind}: schema route");
            }
            if (result.Diagnostics.Count != 1 || result.Diagnostics[0].Code != DefinitionDiagnosticCode.WorkflowNotFound)
            {
                _failures.Add($"{route.Kind}: admission");
            }
        }
    }

    [Fact] void should_execute_the_closed_thirteen_route_set() => _routeCount.ShouldEqual(13);
    [Fact] void should_admit_every_route_before_workflow_selection() => _failures.ShouldBeEmpty();

    sealed record NativeRoute(DefinitionKind Kind);
}
