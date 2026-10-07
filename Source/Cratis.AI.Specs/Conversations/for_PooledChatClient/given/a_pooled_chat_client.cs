// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.AI.Providers.RateLimiting;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Usage.Daily;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Conversations.for_PooledChatClient.given;

public class a_pooled_chat_client : Specification
{
    protected const string Purpose = "Brainstormer";

    protected IReadModels _readModels;
    protected IProviderChatClientFactory _factory;
    protected IChatClient _anthropicChat;
    protected IChatClient _openAIChat;
    protected ICommandPipeline _commandPipeline;
    protected IRecentProviderFailures _failures;
    protected IAIAgents _agents;
    protected PooledChatClient _client;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _anthropicChat = Substitute.For<IChatClient>();
        _openAIChat = Substitute.For<IChatClient>();

        _factory = Substitute.For<IProviderChatClientFactory>();
        _factory.CanServe(Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>()).Returns(true);
        _factory.Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Type == AIProviderType.Anthropic), Arg.Any<ModelName>()).Returns(_anthropicChat);
        _factory.Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Type == AIProviderType.OpenAI), Arg.Any<ModelName>()).Returns(_openAIChat);

        var compatibility = Substitute.For<IAgentProviderCompatibility>();
        compatibility.Supports(Arg.Any<LanguageModelPurpose>(), Arg.Any<AIProviderType>()).Returns(true);

        var sessions = Substitute.For<IRecordedAgentSessions>();
        sessions.RecordedSince(Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns([]);
        var usageLevels = Substitute.For<IProviderUsageLevels>();
        usageLevels.RefreshMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<AIProviderId, ProviderUsageLevel>());
        var capacities = Substitute.For<IAIProviderCapacities>();
        capacities.ForMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<AIProviderId, AIProviderCapacity>());
        _failures = Substitute.For<IRecentProviderFailures>();
        _failures.CountsSince(Arg.Any<TimeSpan>()).Returns(new Dictionary<AIProviderId, int>());
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _agents = Substitute.For<IAIAgents>();
        var execution = Substitute.For<IAgentExecution>();
        execution.As(Arg.Any<LanguageModelPurpose>(), Arg.Any<IDictionary<string, string>?>()).Returns(Substitute.For<IDisposable>());

        var options = Options.Create(new AIProviderOptions());
        _client = new(
            (LanguageModelPurpose)Purpose,
            _readModels,
            compatibility,
            new ProviderBurn(sessions, TimeProvider.System),
            usageLevels,
            capacities,
            _failures,
            new ProviderConcurrencyGate(options),
            _factory,
            _agents,
            execution,
            _commandPipeline,
            new ProviderRateLimitRecorder(capacities, _commandPipeline, TimeProvider.System, options, Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance),
            TimeProvider.System,
            options,
            Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
    }

    protected void AgentNamesProvider(AIProviderId provider) =>
        _readModels.GetInstanceById<Agent>((EventSourceId)AgentId.For((LanguageModelPurpose)Purpose))
            .Returns(new Agent(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Brainstormer", "Chats.", ModelTier.Balanced, provider, null));

    protected void AgentDrawsFromPool(AIProviderPoolId pool) =>
        _readModels.GetInstanceById<Agent>((EventSourceId)AgentId.For((LanguageModelPurpose)Purpose))
            .Returns(new Agent(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Brainstormer", "Chats.", ModelTier.Balanced, null, pool));

    protected void PoolIs(AIProviderPoolId id, params AIProviderId[] members) =>
        _readModels.GetInstanceById<AIProviderPool>((EventSourceId)id).Returns(new AIProviderPool(id, "Main pool", [.. members.Select(member => new AIProviderPoolMember(member))]));

    protected void ProviderIs(AIProviderId id, AIProviderType type)
    {
        var provider = new ConfiguredAIProvider(id, type, type == AIProviderType.Anthropic ? "sk-ant" : "sk-openai");
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(provider with { AvailableModels = PublishedCatalogs.For(type) });
    }
}
