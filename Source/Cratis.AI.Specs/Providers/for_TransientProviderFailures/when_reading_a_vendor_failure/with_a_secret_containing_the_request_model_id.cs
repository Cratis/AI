// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_secret_containing_the_request_model_id : given.a_vendor_response
{
    const string Model = "o1";
    const string Secret = "AAAAAAAAAAAAAAAAAAAo1BBBBBBBBBBBBBBBBBBB";

    void Establish() => _response.Content = new StringContent($$$"""{"error":{"message":"model {{{Model}}} rejected token {{{Secret}}}"}}""");
    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAICompatible, Model, _providerId);

    [Fact] void should_withhold_the_whole_secret() => _failure.Body.ShouldNotContain(Secret);
    [Fact] void should_withhold_the_part_after_the_model_id() => _failure.Body.ShouldNotContain("BBBBBBBBBBBBBBBBBBB");
    [Fact] void should_keep_the_standalone_model_id_readable() => _failure.Body.ShouldContain($"model {Model} rejected");
}
