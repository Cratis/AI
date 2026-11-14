// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.given;

public class a_dispatcher_with_member_access : Specification
{
    protected AIProviderPoolDispatcher _dispatcher;
    protected AIProviderPool _pool;
    protected AIProviderId _restrictedId;
    protected AIProviderId _allowedId;
    protected IAIProviderClient _restrictedClient;
    protected IAIProviderClient _allowedClient;
    protected IReadModels _readModels;
    protected Dictionary<AIProviderId, ConfiguredAIProvider> _snapshot;
    protected WorkInitiation _initiation;
    protected LanguageModels.LanguageModelResult _result;

    void Establish()
    {
        _restrictedId = AIProviderId.New();
        _allowedId = AIProviderId.New();
        _pool = new(AIProviderPoolId.New(), "Pool", [new(_restrictedId), new(_allowedId)]);
        _snapshot = new()
        {
            [_restrictedId] = new(_restrictedId, AIProviderType.Anthropic, "test"),
            [_allowedId] = new(_allowedId, AIProviderType.OpenAI, "test")
        };
        _readModels = Substitute.For<IReadModels>();
        foreach (var provider in _snapshot.Values)
        {
            _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider.Id).Returns(provider);
        }
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_restrictedId).Returns(_snapshot[_restrictedId] with
        {
            HasAllowedTeamMembersSelection = true,
            AllowedTeamMembers = [(TeamMemberId)"alice"]
        });
        _initiation = new();
        _restrictedClient = Substitute.For<IAIProviderClient>();
        _restrictedClient.Type.Returns(AIProviderType.Anthropic);
        _allowedClient = Substitute.For<IAIProviderClient>();
        _allowedClient.Type.Returns(AIProviderType.OpenAI);
        _allowedClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModels.LanguageModelResult.Success("allowed"));
        var burn = Substitute.For<IProviderBurn>();
        burn.TrailingWeek(Arg.Any<CancellationToken>()).Returns(new ProviderBurnOverTrailingWeek(
            new Dictionary<AIProviderId, long> { [_restrictedId] = 0, [_allowedId] = 100 }, new Dictionary<AIProviderId, int>()));
        _dispatcher = new([_restrictedClient, _allowedClient], burn, Substitute.For<IAIProviderQuotaTracker>(), TimeProvider.System, NullLogger<AIProviderPoolDispatcher>.Instance, memberAccess: new ProviderMemberAccess(_readModels, _initiation));
    }

    protected Task<LanguageModels.LanguageModelResult> Dispatch() => _dispatcher.Complete("prompt", _pool.Members, _snapshot, "model", default);
}
