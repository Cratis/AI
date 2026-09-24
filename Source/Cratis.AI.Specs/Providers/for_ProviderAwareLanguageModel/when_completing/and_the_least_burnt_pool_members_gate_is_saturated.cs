// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

/// <summary>
/// A pool member's own concurrency gate saturating must not sink the completion or hang the caller -
/// it composes with the pool's existing "skip a dead member" resilience the same way a removed
/// provider or a missing vendor client already does: the pool moves on to its next least-burnt member.
/// </summary>
public class and_the_least_burnt_pool_members_gate_is_saturated : given.all_dependencies
{
    static readonly AIProviderPoolId _pool = AIProviderPoolId.New();
    static readonly AIProviderId _saturated = AIProviderId.New();
    static readonly AIProviderId _fresh = AIProviderId.New();

    IDisposable _heldSlot;
    LanguageModelResult _result;

    async Task Establish()
    {
        // A short wait timeout so the gate gives up quickly instead of making this spec wait out the
        // default 30 seconds - the timeout mechanism itself is proven separately in
        // for_ProviderConcurrencyGate.
        var options = new AIProviderOptions { MaxConcurrency = 1, MaxConcurrencyWaitTimeout = TimeSpan.FromMilliseconds(20) };
        _providerGate = new ProviderConcurrencyGate(Options.Create(options));
        _model = new(
            new Cratis.Types.KnownInstancesOf<IAIProviderClient>(_anthropicClient, _openAIClient),
            _compatibility,
            _readModels,
            new ProviderBurn(_sessions, TimeProvider.System),
            _providerUsageLevels,
            _recentProviderFailures,
            _providerGate,
            new DefaultAgentInvocationModes(),
            _commandPipeline,
            _timeProvider,
            Options.Create(options),
            _logger);

        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Scout", "Classifies issues.", ModelTier.Balanced, null, _pool));

        // Declaration order is the pool's tie-break when burn is equal (see PoolMemberSelector), so
        // the saturated member is picked first, exactly like the least-burnt member normally would be.
        PoolIs(_pool, new(_pool, "Main pool", [new(_saturated), new(_fresh)]));
        ProviderIs(_saturated, new(_saturated, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_fresh, new(_fresh, AIProviderType.OpenAI, "sk-openai-test"));

        // Occupy the least-burnt member's only slot and never release it, so its gate times out and
        // the pool has to move on to its next member.
        _heldSlot = (await _providerGate.TryEnter(_saturated, CancellationToken.None))!;
    }

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_answer_from_the_next_member_instead() => _result.Text.ShouldEqual("from-openai");
    [Fact] void should_stamp_that_member_on_the_result() => _result.ProviderId.ShouldEqual(_fresh);

    [Fact]
    void should_never_touch_the_saturated_member() =>
        _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default);

    void Destroy() => _heldSlot?.Dispose();
}
