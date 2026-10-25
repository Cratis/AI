// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacities.when_asking;

/// <summary>
/// A Z.AI key that is not on a coding plan, with no ceiling configured, is unmetered as far as
/// anything known says.
/// </summary>
public class and_the_vendor_surface_does_not_apply : given.all_dependencies
{
    AIProviderCapacity _capacity;

    void Establish()
    {
        ProviderIs(new(_provider, AIProviderType.ZAI, "zai-key"));
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(true);
        _reporter.Report(Arg.Any<ConfiguredAIProvider>(), Arg.Any<CancellationToken>())
            .Returns(AIProviderCapacityReport.NotApplicable("The Z.AI key reports no coding plan quota"));
    }

    async Task Because() => _capacity = await _capacities.For(_provider);

    [Fact] void should_report_it_as_unmetered() => _capacity.Source.ShouldEqual(AIProviderCapacitySource.Unmetered);
    [Fact] void should_let_work_start() => _capacity.CanStartWork.ShouldBeTrue();
}
