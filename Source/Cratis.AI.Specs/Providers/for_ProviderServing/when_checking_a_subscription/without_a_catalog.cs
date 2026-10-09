// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_ProviderServing.when_checking_a_subscription;

public class without_a_catalog : Specification
{
    bool _serves;

    void Because() => _serves = new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test")
        .CanServe(DateTimeOffset.UtcNow);

    [Fact] void should_serve_completions_using_cli_defaults() => _serves.ShouldBeTrue();
}
