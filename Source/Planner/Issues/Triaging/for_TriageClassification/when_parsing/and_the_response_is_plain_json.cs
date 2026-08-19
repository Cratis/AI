// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Triaging.for_TriageClassification.when_parsing;

public class and_the_response_is_plain_json : Specification
{
    TriageClassification? _result;

    void Because() => _result = TriageClassification.Parse(
        """
        {
          "kind": "bug",
          "feasibility": "agentCanDo",
          "priority": "high",
          "labels": ["bug", "regression"],
          "area": "Chronicle kernel",
          "model": "sonnet"
        }
        """);

    [Fact] void should_parse_the_kind() => _result!.Kind.ShouldEqual(IssueKind.Bug);
    [Fact] void should_parse_the_feasibility() => _result!.Feasibility.ShouldEqual(IssueFeasibility.AgentCanDo);
    [Fact] void should_parse_the_priority() => _result!.Priority.ShouldEqual(Priority.High);
    [Fact] void should_parse_the_labels() => _result!.Labels.Count().ShouldEqual(2);
    [Fact] void should_parse_the_area() => _result!.Area.ShouldEqual(new IssueArea("Chronicle kernel"));
    [Fact] void should_parse_the_model() => _result!.Model.ShouldEqual(new ModelName("sonnet"));
}
#endif
