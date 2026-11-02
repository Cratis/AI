// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_discovering;

public class and_the_alternate_catalog_payload_is_malformed : given.a_subscription_with_an_alternate_catalog_credential
{
    AIModelDiscoveryResult _result;

    void Establish() => _body = "not JSON";
    async Task Because() => _result = await _models.Discover(_providerId);

    [Fact] void should_keep_a_malformed_payload_as_a_failure() => _result.Status.ShouldEqual(AIModelDiscoveryStatus.Failed);
    [Fact] void should_not_count_the_request_as_a_success() => _result.Succeeded.ShouldBeFalse();
}
