// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle;

namespace Cratis.AI.Providers.Resolving.for_ProviderTierResolution.when_resolving_tiers_for;

public class a_missing_provider : Specification
{
    ProviderTierResolution[] _rows;

    async Task Because() => _rows = (await ProviderTierResolution.ResolveTiersFor(AIProviderId.NotSet, Substitute.For<IEventStore>())).ToArray();

    [Fact] void should_return_all_four_tiers() => _rows.Length.ShouldEqual(4);
    [Fact] void should_refuse_every_tier() => _rows.ShouldEachConformTo(row => row.Source == TierModelSource.Unsatisfied);
    [Fact] void should_explain_that_the_provider_is_missing() => _rows.ShouldEachConformTo(row => row.Reason.Contains("could not be found", StringComparison.Ordinal));
}
