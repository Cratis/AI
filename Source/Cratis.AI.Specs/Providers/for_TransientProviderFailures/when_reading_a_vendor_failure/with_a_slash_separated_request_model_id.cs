// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_slash_separated_request_model_id : given.a_vendor_response
{
    const string Model = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

    void Establish() => _response.Content = new StringContent($$$"""{"error":{"message":"The model {{{Model}}} is overloaded for provider {{{_providerId.Value}}}"}}""");
    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAICompatible, Model, _providerId);

    [Fact] void should_keep_the_request_model_readable_in_the_body() => _failure.Body.ShouldContain(Model);
    [Fact] void should_keep_the_provider_id_readable_in_the_body() => _failure.Body.ShouldContain(_providerId.Value.ToString());
    [Fact] void should_not_mark_any_redaction() => _failure.Body.ShouldNotContain("[redacted]");
}
