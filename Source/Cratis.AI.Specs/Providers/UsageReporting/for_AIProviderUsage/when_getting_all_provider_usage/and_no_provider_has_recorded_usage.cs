// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting.for_AIProviderUsage.when_getting_all_provider_usage;

public class and_no_provider_has_recorded_usage : given.all_dependencies
{
    async Task Because() => _result = await AIProviderUsage.AllAIProviderUsage(_sessions, _timeProvider);

    [Fact] void should_yield_no_usage() => _result.ShouldBeEmpty();
}
