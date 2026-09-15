// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderQuotaHeaders.when_parsing_a_duration;

public class and_it_combines_several_units : Specification
{
    [Fact]
    void should_sum_every_segment() =>
        AIProviderQuotaHeaders.ParseDuration("2h30m3s").ShouldEqual(TimeSpan.FromHours(2) + TimeSpan.FromMinutes(30) + TimeSpan.FromSeconds(3));

    [Fact]
    void should_parse_a_zero_seconds_tail() =>
        AIProviderQuotaHeaders.ParseDuration("6m0s").ShouldEqual(TimeSpan.FromMinutes(6));
}
