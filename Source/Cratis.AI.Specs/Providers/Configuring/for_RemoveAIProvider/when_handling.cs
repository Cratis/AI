// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Configuring.for_RemoveAIProvider;

public class when_handling : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    (AIProviderId Id, AIModelRemoved Event) _result;

    void Because() => _result = new RemoveAIProvider(_providerId).Handle();

    [Fact] void should_append_on_the_providers_own_stream() => _result.Id.ShouldEqual(_providerId);
    [Fact] void should_produce_the_removed_event() => _result.Event.ShouldNotBeNull();
}
