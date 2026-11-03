// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.SettingAllowedMembers;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

public class and_allowed_members_are_selected : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Claude", "sk-ant-key", 4),
        new AIProviderAllowedMembersSet([(TeamMemberId)"alice", (TeamMemberId)"bob"]),
        new AIProviderAllowedMembersSet([(TeamMemberId)"bob"]));

    [Fact] void should_mark_the_selection_as_explicit() => _scenario.Instance.HasAllowedMembersSelection.ShouldBeTrue();
    [Fact] void should_show_the_latest_selection() => _scenario.Instance.AllowedMembers!.ShouldContainOnly((TeamMemberId)"bob");
}
