// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderQuotaHeaders.when_parsing_a_duration;

public class and_it_is_a_single_unit : Specification
{
    [Fact] void should_parse_seconds() => AIProviderQuotaHeaders.ParseDuration("1s").ShouldEqual(TimeSpan.FromSeconds(1));
    [Fact] void should_parse_minutes() => AIProviderQuotaHeaders.ParseDuration("6m").ShouldEqual(TimeSpan.FromMinutes(6));
}
