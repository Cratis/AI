// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Workers.for_WorkerSecrets.when_rendering;

/// <summary>
/// A kubeconfig is YAML, so multi-line values are the normal case rather than an edge case.
/// </summary>
public class and_a_value_spans_several_lines : Specification
{
    string _result;

    void Because() => _result = WorkerSecrets.Render(new Dictionary<string, string>
    {
        ["PLANNER_KUBECONFIG"] = "apiVersion: v1\nkind: Config"
    });

    [Fact] void should_keep_the_value_intact() => _result.ShouldContain("PLANNER_KUBECONFIG='apiVersion: v1\nkind: Config'\n");
}
#endif
