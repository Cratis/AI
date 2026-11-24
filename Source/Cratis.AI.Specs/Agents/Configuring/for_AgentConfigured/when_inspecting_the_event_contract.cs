// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reflection;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.Chronicle.Events;

namespace Cratis.AI.Agents.Configuring.for_AgentConfigured;

/// <summary>
/// The legacy event is a stored contract - its identity and shape must not change so old histories keep replaying.
/// </summary>
public class when_inspecting_the_event_contract : Specification
{
    EventTypeAttribute _attribute;
    ParameterInfo[] _parameters;

    void Because()
    {
        _attribute = typeof(AgentConfigured).GetCustomAttribute<EventTypeAttribute>()!;
        _parameters = typeof(AgentConfigured).GetConstructors().Single().GetParameters();
    }

    [Fact] void should_keep_the_default_plain_id_derived_from_the_type_name() => _attribute.Id.Value.ShouldBeEmpty();
    [Fact] void should_keep_the_generation() => _attribute.Generation.Value.ShouldEqual(1u);
    [Fact]
    void should_keep_the_members() => _parameters.Select(_ => (_.Name, _.ParameterType)).ShouldEqual(
    [
        ("Purpose", typeof(LanguageModelPurpose)),
        ("Name", typeof(AgentName)),
        ("Description", typeof(AgentDescription)),
        ("Tier", typeof(ModelTier)),
        ("ProviderId", typeof(AIProviderId)),
        ("PoolId", typeof(AIProviderPoolId)),
        ("Harness", typeof(Harness)),
        ("Effort", typeof(Effort))
    ]);
}
