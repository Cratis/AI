// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Configuration.Seeding;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.Chronicle.ReadModels;
using FluentValidation.Results;

namespace Cratis.AI.Agents.Defining.when_validating_assignments.given;

public class assignment_validators : Specification
{
    protected readonly AIProviderId _providerId = AIProviderId.New();
    protected readonly AIProviderPoolId _poolId = AIProviderPoolId.New();
    protected readonly IReadModels _readModels = Substitute.For<IReadModels>();
    protected readonly IAgentProviderCompatibility _compatibility = Substitute.For<IAgentProviderCompatibility>();
    protected readonly List<ValidationResult> _results = [];

    void Establish() => _compatibility.Supports("IssueTriage", AIProviderType.Anthropic).Returns(true);

    protected void KnownProvider() => _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId)
        .Returns(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, "test-key"));

    protected void KnownPool(IEnumerable<AIProviderPoolMember>? members) => _readModels.GetInstanceById<AIProviderPool>((EventSourceId)_poolId)
        .Returns(new AIProviderPool(_poolId, "Test pool", members));

    protected async Task Validate(AIProviderId? provider = null, AIProviderPoolId? pool = null)
    {
        _results.Add(await new DefineAgentValidator(_readModels, _compatibility).ValidateAsync(
            new DefineAgent("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, provider, pool)));
        _results.Add(await new ConfigureAgentValidator(_readModels, _compatibility).ValidateAsync(
            new ConfigureAgent("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, provider, pool)));
    }

    protected async Task ValidateProvider()
    {
        await Validate(_providerId);
        _results.Add(await new SeedAgentValidator(_readModels, _compatibility).ValidateAsync(
            new SeedAgent("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced, _providerId)));
    }
}
