// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.UsageReporting;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.UsageReporting.for_ProviderUsageLevels.given;

public class all_dependencies : Specification
{
    protected IAIUsageReporting _usageReporting;
    protected IReadModels _readModels;
    protected IProviderBurn _providerBurn;
    protected IRecentUsageSnapshots _recentSnapshots;
    protected ICommandPipeline _commandPipeline;
    protected ProviderUsageLevels _levels;

    void Establish()
    {
        _usageReporting = Substitute.For<IAIUsageReporting>();
        _readModels = Substitute.For<IReadModels>();
        _providerBurn = Substitute.For<IProviderBurn>();
        _providerBurn.TrailingWeek(Arg.Any<CancellationToken>())
            .Returns(new ProviderBurnOverTrailingWeek(new Dictionary<AIProviderId, long>(), new Dictionary<AIProviderId, int>()));
        _recentSnapshots = Substitute.For<IRecentUsageSnapshots>();
        _commandPipeline = Substitute.For<ICommandPipeline>();

        _levels = new(
            _usageReporting,
            _readModels,
            _providerBurn,
            _recentSnapshots,
            _commandPipeline,
            Options.Create(new AIProviderOptions()),
            Substitute.For<ILogger<ProviderUsageLevels>>());
    }

    protected void ProviderIs(AIProviderId id, ConfiguredAIProvider? provider) =>
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(provider!);

    protected void RecentBurnIs(AIProviderId id, long tokens) =>
        _providerBurn.TrailingWeek(Arg.Any<CancellationToken>())
            .Returns(new ProviderBurnOverTrailingWeek(new Dictionary<AIProviderId, long> { [id] = tokens }, new Dictionary<AIProviderId, int>()));
}
