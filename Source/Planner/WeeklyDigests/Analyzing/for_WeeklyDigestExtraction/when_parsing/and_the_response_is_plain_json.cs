// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.WeeklyDigests.Analyzing.for_WeeklyDigestExtraction.when_parsing;

public class and_the_response_is_plain_json : Specification
{
    WeeklyDigestExtraction? _result;

    void Because() => _result = WeeklyDigestExtraction.Parse(
        """
        { "themes": ["Dashboard", "Bug fixes"], "description": "Wow, what a week - the team shipped a brand new dashboard." }
        """);

    [Fact] void should_parse_the_themes() => _result!.Themes.Count().ShouldEqual(2);
    [Fact] void should_parse_the_description() => _result!.Description.ShouldEqual(new WeeklyDigestDescription("Wow, what a week - the team shipped a brand new dashboard."));
}
#endif
