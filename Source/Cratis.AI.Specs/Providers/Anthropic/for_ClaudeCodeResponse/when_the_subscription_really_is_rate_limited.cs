// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeResponse;

public class when_the_subscription_really_is_rate_limited : Specification
{
    LanguageModelResult _result = null!;

    void Because() => _result = ClaudeCodeResponse.Read(new(1, "{\"is_error\":true,\"api_error_status\":429}"), "claude-sonnet-4-6");

    [Fact] void should_not_succeed() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_allow_the_pool_to_try_another_member() => _result.IsTransient.ShouldBeTrue();
}
