// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.AvailableModels.for_AvailableAIModels.given;

public class all_dependencies : Specification
{
    protected IEventStore _eventStore;
    protected IReadModels _readModels;
    protected ICanListAvailableModels _anthropicListing;
    protected AvailableAIModels _availableModels;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _eventStore = Substitute.For<IEventStore>();
        _eventStore.ReadModels.Returns(_readModels);

        _anthropicListing = Substitute.For<ICanListAvailableModels>();
        _anthropicListing.Type.Returns(AIProviderType.Anthropic);
        _anthropicListing.List(Arg.Any<ConfiguredAIProvider>())
            .Returns([new ModelName("claude-sonnet-4-5"), new ModelName("claude-haiku-4-5")]);

        _availableModels = new(
            _eventStore,
            new Cratis.Types.KnownInstancesOf<ICanListAvailableModels>(_anthropicListing),
            Substitute.For<ILogger<AvailableAIModels>>());
    }

    protected void ProviderIs(AIProviderId id, ConfiguredAIProvider? provider) =>
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(provider!);
}
