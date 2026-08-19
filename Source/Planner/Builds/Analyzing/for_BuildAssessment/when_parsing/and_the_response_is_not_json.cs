// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Builds.Analyzing.for_BuildAssessment.when_parsing;

public class and_the_response_is_not_json : Specification
{
    BuildAssessment? _result;

    void Because() => _result = BuildAssessment.Parse("I am not sure what is wrong.");

    [Fact] void should_parse_to_nothing() => Assert.Null(_result);
}
#endif
