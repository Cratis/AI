// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
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
    protected ISecretRevealer _revealer;
    protected ICanReportAIUsage _anthropicReporter;
    protected AIUsageReporting _usageReporting;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _eventStore = Substitute.For<IEventStore>();
        _eventStore.ReadModels.Returns(_readModels);

        _anthropicReporter = Substitute.For<ICanReportAIUsage>();
        _anthropicReporter.Type.Returns(AIProviderType.Anthropic);

        // A plain reveal stub, not a real round-trip cipher - the orchestrator only needs to see
        // that whatever Reveal answers with is what reaches the reporter, not that the value is
        // recoverable end to end (that belongs to whichever ISecretProtector/ISecretRevealer
        // implementation a consuming product supplies).
        _revealer = Substitute.For<ISecretRevealer>();
        _revealer.Reveal(Arg.Any<string>()).Returns(call => "revealed:" + call.Arg<string>());

        _usageReporting = new(
            _eventStore,
            _revealer,
            new KnownInstancesOf<ICanReportAIUsage>(_anthropicReporter),
            Substitute.For<ILogger<AIUsageReporting>>());
    }

    protected void ProviderIs(AIProviderId id, ConfiguredAIProvider? provider) =>
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(provider!);
}
