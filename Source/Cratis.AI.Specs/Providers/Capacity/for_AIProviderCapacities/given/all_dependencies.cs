// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacities.given;

public class all_dependencies : Specification
{
    protected static readonly AIProviderId _provider = AIProviderId.New();
    protected static readonly DateTimeOffset _now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);

    protected IReadModels _readModels;
    protected ICanReportAIProviderCapacity _reporter;
    protected IProviderUsageLevels _usageLevels;
    protected AIProviderCapacities _capacities;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _reporter = Substitute.For<ICanReportAIProviderCapacity>();
        _usageLevels = Substitute.For<IProviderUsageLevels>();
        _usageLevels.RefreshMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<AIProviderId, ProviderUsageLevel>());

        var timeProvider = Substitute.For<TimeProvider>();
        timeProvider.GetUtcNow().Returns(_now);
        var options = Options.Create(new AIProviderOptions());
        _capacities = new(
            _readModels,
            new Cratis.Types.KnownInstancesOf<ICanReportAIProviderCapacity>(_reporter),
            new AIProviderCapacityObservations(timeProvider, options),
            _usageLevels,
            timeProvider,
            options,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<AIProviderCapacities>.Instance);
    }

    protected void ProviderIs(ConfiguredAIProvider provider) =>
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider.Id).Returns(provider);

    protected void ConsumedTokensAre(long consumed, AIProviderUsageCapacity ceiling) =>
        _usageLevels.RefreshMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<AIProviderId, ProviderUsageLevel> { [_provider] = new(AIUsageReportAvailability.NoCredentialConfigured, consumed, true, ceiling) });
}
