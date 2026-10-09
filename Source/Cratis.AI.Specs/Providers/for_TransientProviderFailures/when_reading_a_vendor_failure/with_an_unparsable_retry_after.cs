// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_an_unparsable_retry_after : given.a_vendor_response
{
    void Establish() => _response.Headers.TryAddWithoutValidation("Retry-After", "later");

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAI, "gpt-4", _providerId);

    [Fact] void should_preserve_the_raw_value() => _failure.RetryAfter.ShouldEqual("later");
    [Fact] void should_not_invent_a_retry_wait() => _failure.Result.RetryAfter.ShouldBeNull();
}
