// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_rejected_credential : given.a_vendor_response
{
    void Establish()
    {
        _response.StatusCode = HttpStatusCode.Unauthorized;
        _response.Content = new StringContent("""{"error":{"type":"authentication_error"}}""");
    }

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, "claude-sonnet-4", _providerId);

    [Fact] void should_name_the_vendor_model_and_status() => _failure.Result.FailureReason.ShouldContain("Anthropic model claude-sonnet-4 returned 401 authentication_error");
    [Fact] void should_be_permanent() => _failure.Result.IsTransient.ShouldBeFalse();
    [Fact] void should_not_wait_before_retrying() => _failure.Result.RetryAfter.ShouldBeNull();
}
