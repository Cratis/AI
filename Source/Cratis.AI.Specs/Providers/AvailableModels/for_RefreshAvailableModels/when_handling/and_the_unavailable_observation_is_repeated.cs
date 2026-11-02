// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.AvailableModels.for_RefreshAvailableModels.when_handling;

public class and_the_unavailable_observation_is_repeated : Specification
{
    object[] _events;

    async Task Because()
    {
        var providerId = AIProviderId.New();
        var command = new RefreshAvailableModels(providerId);
        var result = AIModelDiscoveryResult.Unavailable("fixture capability limitation");
        var first = (AIProviderModelDiscoveryUnavailable)command.Handle(new(result, null, DateTimeOffset.UtcNow)).Single();
        var provider = new ConfiguredAIProvider(providerId, AIProviderType.Anthropic, "sk-ant-oat01-fixture")
        {
            ModelDiscoveryStatus = AIModelDiscoveryStatus.Unavailable,
            ModelDiscoveryFailure = first.Reason
        };
        var readModels = Substitute.For<IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId).Returns(provider);
        var store = Substitute.For<IEventStore>();
        store.ReadModels.Returns(readModels);
        var available = Substitute.For<IAvailableAIModels>();
        available.Discover(providerId).Returns(result);
        var refresh = await command.Provide(available, store, TimeProvider.System);
        _events = command.Handle(refresh).ToArray();
    }

    [Fact] void should_append_nothing_for_the_same_observation_twice() => _events.ShouldBeEmpty();
}
