// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModels.when_discovering;

/// <summary>
/// A vendor with no listing has not answered "no models" - nobody asked it. The two are kept apart
/// so a surface can say which one happened, and so a tier never resolves off an empty answer that
/// was never actually given (#1187).
/// </summary>
public class and_no_listing_serves_the_provider_type : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    AIModelDiscoveryResult _result;

    void Establish() =>
        ProviderIs(_provider, new(_provider, AIProviderType.OpenAI, "sk-test"));

    async Task Because() => _result = await _availableModels.Discover(_provider);

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();

    [Fact] void should_answer_with_no_models() => _result.Models.ShouldBeEmpty();

    [Fact] void should_name_the_vendor_in_the_failure() => _result.Failure.ShouldContain("OpenAI");
}
