// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_an_anthropic_root_error : given.a_vendor_response
{
    void Establish() => _response.Content = new StringContent("""{"type":"rate_limit_error","message":"Error"}""");

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, "claude-sonnet-4", _providerId);

    [Fact] void should_name_the_asked_model_and_vendor_error() => _failure.Result.FailureReason.ShouldContain("Anthropic model claude-sonnet-4 returned 429 rate_limit_error");
}
