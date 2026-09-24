// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Usage.Daily;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.given;

public class all_dependencies : Specification
{
    protected const string Purpose = "IssueTriage";

    protected IAIProviderClient _anthropicClient;
    protected IAIProviderClient _openAIClient;
    protected IAgentProviderCompatibility _compatibility;
    protected IReadModels _readModels;
    protected IRecordedAgentSessions _sessions;
    protected List<RecordedAgentSession> _sessionsData;
    protected CapturingLogger _logger;
    protected IProviderConcurrencyGate _providerGate;
    protected IProviderUsageLevels _providerUsageLevels;
    protected IRecentProviderFailures _recentProviderFailures;
    protected ICommandPipeline _commandPipeline;
    protected TimeProvider _timeProvider;
    protected ProviderAwareLanguageModel _model;

    void Establish()
    {
        _sessionsData = [];

        _anthropicClient = Substitute.For<IAIProviderClient>();
        _anthropicClient.Type.Returns(AIProviderType.Anthropic);
        _anthropicClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Success("from-anthropic"));

        _openAIClient = Substitute.For<IAIProviderClient>();
        _openAIClient.Type.Returns(AIProviderType.OpenAI);
        _openAIClient.Complete(Arg.Any<string>(), Arg.Any<ConfiguredAIProvider>(), Arg.Any<ModelName>(), Arg.Any<Effort>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Success("from-openai"));

        _compatibility = Substitute.For<IAgentProviderCompatibility>();
        _compatibility.Supports(Arg.Any<LanguageModelPurpose>(), Arg.Any<AIProviderType>()).Returns(true);
        _readModels = Substitute.For<IReadModels>();

        _sessions = Substitute.For<IRecordedAgentSessions>();
        _sessions.RecordedSince(Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => RecordedSince(callInfo.Arg<DateTimeOffset>()));

        _logger = new();
        _providerGate = new ProviderConcurrencyGate(Options.Create(new AIProviderOptions()));
        _providerUsageLevels = Substitute.For<IProviderUsageLevels>();
        _providerUsageLevels.RefreshMany(Arg.Any<IReadOnlyCollection<AIProviderId>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<AIProviderId, ProviderUsageLevel>());
        _recentProviderFailures = Substitute.For<IRecentProviderFailures>();
        _recentProviderFailures.CountsSince(Arg.Any<TimeSpan>()).Returns(new Dictionary<AIProviderId, int>());
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _timeProvider = TimeProvider.System;
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
            Options.Create(new AIProviderOptions()),
            _logger);
    }

    protected void AgentIs(Agent agent) =>
        _readModels.GetInstanceById<Agent>((EventSourceId)AgentId.For((LanguageModelPurpose)Purpose)).Returns(agent);

    /// <summary>
    /// Registers a configured provider. One that names no catalog of its own is given the one its
    /// vendor publishes - a tier resolves through the provider's published catalog now, so a
    /// provider with neither a mapping nor a catalog can name no model at all (#1187).
    /// </summary>
    /// <param name="id">The provider's identity.</param>
    /// <param name="provider">The provider, or <see langword="null"/> for one that is not configured.</param>
    protected void ProviderIs(AIProviderId id, ConfiguredAIProvider? provider) =>
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(
            provider?.AvailableModels.Any() != false
                ? provider!
                : provider with { AvailableModels = PublishedCatalogs.For(provider.Type) });

    protected void PoolIs(AIProviderPoolId id, AIProviderPool? pool) =>
        _readModels.GetInstanceById<AIProviderPool>((EventSourceId)id).Returns(pool!);

    protected void RecordBurn(AIProviderId provider, long tokens) =>
        _sessionsData.Add(new(
            DateTimeOffset.UtcNow,
            provider,
            null,
            (LanguageModelPurpose)Purpose,
            new ModelName("some-model"),
            tokens,
            0,
            0m,
            0));

    IEnumerable<RecordedAgentSession> RecordedSince(DateTimeOffset since) =>
        [.. _sessionsData.Where(session => session.ProviderId is not null && session.Occurred >= since)];
}

/// <summary>
/// A minimal <see cref="ILogger{TCategoryName}"/> that captures the fully-formatted message of every
/// entry logged through it, for specs to assert against - NSubstitute cannot cleanly mock the generic
/// <see cref="ILogger.Log{TState}"/> method the <c>[LoggerMessage]</c> source generator calls, so a
/// hand-written capture is the reliable seam.
/// </summary>
public class CapturingLogger : ILogger<ProviderAwareLanguageModel>
{
    readonly List<(LogLevel Level, string Message)> _entries = [];

    /// <summary>
    /// Gets the fully-formatted messages logged at <see cref="LogLevel.Warning"/> or above.
    /// </summary>
    public IReadOnlyList<string> WarningsAndAbove =>
        [.. _entries.Where(entry => entry.Level >= LogLevel.Warning).Select(entry => entry.Message)];

    /// <summary>
    /// Gets the fully-formatted messages logged at any level - for the paths that are expected
    /// rather than wrong, and so report themselves below <see cref="LogLevel.Warning"/>.
    /// </summary>
    public IReadOnlyList<string> All => [.. _entries.Select(entry => entry.Message)];

    /// <inheritdoc/>
    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull => null;

    /// <inheritdoc/>
    public bool IsEnabled(LogLevel logLevel) => true;

    /// <inheritdoc/>
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
        _entries.Add((logLevel, formatter(state, exception)));
}
