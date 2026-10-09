// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_long_configured_model_id : given.a_vendor_response
{
    const string Model = "configured-model-with-a-long-version-20241022";

    void Establish() => _response.Content = new StringContent("request rejected");
    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, Model, _providerId);
    [Fact] void should_not_redact_the_configured_model() => _failure.Model.ShouldEqual(Model);
    [Fact] void should_record_the_configured_model_without_redaction() => _failure.Result.Model!.Value.ShouldEqual(Model);
    [Fact] void should_name_the_configured_model_without_redaction() => _failure.Result.FailureReason.ShouldContain(Model);
}
