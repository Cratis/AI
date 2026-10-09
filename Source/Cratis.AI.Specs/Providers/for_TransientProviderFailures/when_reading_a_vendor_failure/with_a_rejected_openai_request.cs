// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_rejected_openai_request : given.a_vendor_response
{
    void Establish()
    {
        _response.StatusCode = HttpStatusCode.BadRequest;
        _response.Content = new StringContent("""{"error":{"type":"invalid_request_error","code":"model_not_found"}}""");
    }

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAI, "gpt-4", _providerId);

    [Fact] void should_name_the_vendor_model_status_type_and_code() => _failure.Result.FailureReason.ShouldContain("OpenAI model gpt-4 returned 400 invalid_request_error (model_not_found)");
    [Fact] void should_be_permanent() => _failure.Result.IsTransient.ShouldBeFalse();
}
