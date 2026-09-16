// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_AIModelCapabilities.when_building_a_display_name;

/// <summary>
/// A short segment (an acronym-like part - "gpt", "glm") is upper-cased whole; a longer one is
/// title-cased - without ever changing the underlying provider identifier itself.
/// </summary>
public class and_the_identifier_has_short_and_long_parts : Specification
{
    string _result;

    void Because() => _result = AIModelCapabilities.DisplayNameFor((ModelName)"gpt-5.2-preview");

    [Fact] void should_upper_case_the_short_segment() => _result.ShouldContain("GPT");
    [Fact] void should_title_case_the_longer_segment() => _result.ShouldContain("Preview");
}
