// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.ReadModels;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.given;

public class all_dependencies : Specification
{
    protected IEventStore _eventStore;
    protected IReadModels _readModels;
    protected ICanReportAIUsage _anthropicReporter;
    protected AIUsageReporting _usageReporting;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _eventStore = Substitute.For<IEventStore>();
        _eventStore.ReadModels.Returns(_readModels);

        _anthropicReporter = Substitute.For<ICanReportAIUsage>();
        _anthropicReporter.Type.Returns(AIProviderType.Anthropic);

        _usageReporting = new(
            _eventStore,
            new KnownInstancesOf<ICanReportAIUsage>(_anthropicReporter),
            Substitute.For<ILogger<AIUsageReporting>>());
    }

    protected void ProviderIs(AIProviderId id, ConfiguredAIProvider? provider) =>
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(provider!);
}
