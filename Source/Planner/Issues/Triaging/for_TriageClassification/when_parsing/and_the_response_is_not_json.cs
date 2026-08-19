// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Triaging.for_TriageClassification.when_parsing;

public class and_the_response_is_not_json : Specification
{
    TriageClassification? _result;

    void Because() => _result = TriageClassification.Parse("I could not classify this issue.");

    [Fact] void should_parse_to_nothing() => Assert.Null(_result);
}
#endif
