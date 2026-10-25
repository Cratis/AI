// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_an_openai_insufficient_quota : given.a_vendor_response
{
    void Establish() =>
        _response.Content = new StringContent("""{"error":{"type":"insufficient_quota","code":"insufficient_quota","message":"You exceeded your current quota, please check your plan and billing details."}}""");

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAI, "gpt-4", _providerId);

    [Fact] void should_name_the_code() => _failure.Result.FailureReason.ShouldContain("(insufficient_quota)");
    [Fact] void should_be_quota_exhausted() => _failure.Result.IsQuotaExhausted.ShouldBeTrue();
    [Fact] void should_not_be_retried_as_throttling() => _failure.Result.IsTransient.ShouldBeFalse();
}
