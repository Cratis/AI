// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacities.when_asking;

public class and_the_vendor_reports_its_windows : given.all_dependencies
{
    AIProviderCapacity _capacity;

    void Establish()
    {
        ProviderIs(new(_provider, AIProviderType.Anthropic, "sk-ant-oat-token"));
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(true);
        _reporter.Report(Arg.Any<ConfiguredAIProvider>(), Arg.Any<CancellationToken>())
            .Returns(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "Weekly", 0.8, _now.AddDays(2))]));
    }

    async Task Because() => _capacity = await _capacities.For(_provider);

    [Fact] void should_report_a_subscription() => _capacity.Source.ShouldEqual(AIProviderCapacitySource.Subscription);
    [Fact] void should_report_the_headroom_left() => Math.Round(_capacity.Headroom, 6, MidpointRounding.AwayFromZero).ShouldEqual(0.2);
    [Fact] void should_let_work_start() => _capacity.CanStartWork.ShouldBeTrue();
}
