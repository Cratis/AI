// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Capacity;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimitRecorder;

/// <summary>
/// A provider whose vendor said when its window resets is parked until then and not for the longer guess, so a
/// five-hour window rolling over in seven minutes does not leave the provider parked for an hour.
/// </summary>
public class when_recording_with_a_reset_sooner_than_the_cooldown : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly DateTimeOffset _now = new(2026, 10, 19, 17, 53, 0, TimeSpan.Zero);

    ICommandPipeline _commandPipeline;
    ProviderRateLimitRecorder _recorder;

    void Establish()
    {
        var capacities = Substitute.For<IAIProviderCapacities>();
        capacities.For(_provider, Arg.Any<CancellationToken>()).Returns(
            AIProviderCapacityCalculator.Compute(_provider, AIProviderCapacitySource.Subscription, [new(UsageWindowKind.FiveHour, "5-hour", 1d, _now.AddMinutes(7))], null, _now, null, _now, 0.02));
        _commandPipeline = Substitute.For<ICommandPipeline>();
        var time = Substitute.For<TimeProvider>();
        time.GetUtcNow().Returns(_now);
        _recorder = new ProviderRateLimitRecorder(capacities, _commandPipeline, time, Options.Create(new AIProviderOptions()), Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
    }

    async Task Because() => await _recorder.Record(_provider, "Claude Code's model request failed");

    [Fact]
    async Task should_park_the_provider_until_the_window_resets() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordProviderRateLimited>(command =>
            command.Provider == _provider && command.Until == _now.AddMinutes(7)));
}
