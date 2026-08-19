// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Triaging.for_TriageClassification.when_parsing;

public class and_the_response_is_wrapped_in_a_code_fence : Specification
{
    TriageClassification? _result;

    void Because() => _result = TriageClassification.Parse(
        """
        Sure, here you go:
        ```json
        { "kind": "docs", "feasibility": "needsMoreInformation", "priority": "notSet", "labels": [], "area": "Documentation", "model": "haiku" }
        ```
        """);

    [Fact] void should_still_parse_it() => _result!.Kind.ShouldEqual(IssueKind.Docs);
    [Fact] void should_parse_the_area() => _result!.Area.ShouldEqual(new IssueArea("Documentation"));
}
#endif
