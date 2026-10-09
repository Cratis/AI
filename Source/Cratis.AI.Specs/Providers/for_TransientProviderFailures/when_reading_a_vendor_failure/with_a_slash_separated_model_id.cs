// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_slash_separated_model_id : given.a_vendor_response
{
    const string Model = "anthropic/claude-3-5-sonnet-20241022";
    const string VendorModel = "accounts/fireworks/models/qwen3-coder-480b";

    void Establish() => _response.Content = new StringContent($$$"""{"error":{"message":"{{{Model}}} {{{VendorModel}}} risk-mitigation failed"}}""");
    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAICompatible, Model, _providerId);
    [Fact] void should_preserve_the_configured_model() => _failure.Model.ShouldEqual(Model);
    [Fact] void should_record_the_configured_model() => _failure.Result.Model!.Value.ShouldEqual(Model);
    [Fact] void should_name_the_configured_model_in_the_reason() => _failure.Result.FailureReason.ShouldContain(Model);
    [Fact] void should_preserve_the_slash_separated_model_in_the_vendor_body() => _failure.Body.ShouldContain(VendorModel);
    [Fact] void should_not_redact_a_key_prefix_in_the_middle_of_a_word() => _failure.Body.ShouldContain("risk-mitigation");
}
