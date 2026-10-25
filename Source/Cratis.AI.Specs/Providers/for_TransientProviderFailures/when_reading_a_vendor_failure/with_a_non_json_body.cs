// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_non_json_body : given.a_vendor_response
{
    void Establish() => _response.Content = new StringContent("Gateway is busy. " + string.Concat(Enumerable.Repeat("try later. ", 400)));

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.ZAI, "glm-4", _providerId);

    [Fact] void should_keep_the_vendor_text() => _failure.Body.ShouldContain("Gateway is busy.");
    [Fact] void should_bound_the_body_to_two_kibibytes() => (Encoding.UTF8.GetByteCount(_failure.Body) <= 2048).ShouldBeTrue();
    [Fact] void should_not_invent_an_error_type() => _failure.ErrorType.ShouldBeNull();
    [Fact] void should_not_invent_an_error_code() => _failure.ErrorCode.ShouldBeNull();
}
