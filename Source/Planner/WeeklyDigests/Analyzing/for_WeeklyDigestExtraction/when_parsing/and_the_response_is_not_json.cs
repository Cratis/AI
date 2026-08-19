// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.WeeklyDigests.Analyzing.for_WeeklyDigestExtraction.when_parsing;

public class and_the_response_is_not_json : Specification
{
    WeeklyDigestExtraction? _result;

    void Because() => _result = WeeklyDigestExtraction.Parse("I could not summarize this.");

    [Fact] void should_parse_to_nothing() => Assert.Null(_result);
}
#endif
