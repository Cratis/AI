// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ClientModel;
using System.Net;
using System.Runtime.CompilerServices;
using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.Agents.Skills;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.AI.Providers.RateLimiting;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Usage;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ConfiguredAgent = Cratis.AI.Agents.Listing.Agent;

namespace Cratis.AI.Conversations;

/// <summary>
/// An <see cref="IChatClient"/> that resolves, on every call, which provider serves the agent behind a
/// purpose - exactly as <see cref="ProviderAwareLanguageModel"/> does for a completion. An explicit provider
/// is used directly; a pool dispatches to its least-burnt member and moves on to the next when one fails
/// transiently. Every call is bounded by the provider concurrency gate, a 429 parks the provider through
/// the rate-limit cooldown, and tokens spent are recorded as agent usage.
/// </summary>
/// <remarks>
/// A streaming call can only move to another pool member until its first update has arrived; once the
/// vendor has started answering, a failure is surfaced to the caller rather than replayed on another member.
/// </remarks>
/// <param name="purpose">The purpose - the agent's identity - the client talks as.</param>
/// <param name="readModels">The <see cref="IReadModels"/> the agent, provider and pool are resolved from.</param>
/// <param name="compatibility">Checks that a provider can serve the agent.</param>
/// <param name="providerBurn">The recent burn per provider.</param>
/// <param name="providerUsageLevels">Refreshes every pool member's usage level.</param>
/// <param name="providerCapacities">The headroom each pool member's vendor reports.</param>
/// <param name="recentProviderFailures">The recent-failure memory pool members are ranked by.</param>
/// <param name="providerConcurrencyGate">Bounds concurrent calls to each provider.</param>
/// <param name="chatClientFactory">Builds the vendor client for a chosen provider.</param>
/// <param name="agents">The configured agents, to attribute usage.</param>
/// <param name="agentExecution">Scopes usage recording to the calling agent.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> usage is recorded through.</param>
/// <param name="rateLimitRecorder">Records a provider's rate limit.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> cooldowns are measured against.</param>
/// <param name="providerOptions">The <see cref="AIProviderOptions"/>.</param>
/// <param name="logger">The logger.</param>
/// <param name="explicitRole">The agent to talk as, when the caller owns where the agent is defined - read from the configured agents when <see langword="null"/>.</param>
public sealed class PooledChatClient(
    LanguageModelPurpose purpose,
    IReadModels readModels,
    IAgentProviderCompatibility compatibility,
    IProviderBurn providerBurn,
    IProviderUsageLevels providerUsageLevels,
    IAIProviderCapacities providerCapacities,
    IRecentProviderFailures recentProviderFailures,
    IProviderConcurrencyGate providerConcurrencyGate,
    IProviderChatClientFactory chatClientFactory,
    IAIAgents agents,
    IAgentExecution agentExecution,
    ICommandPipeline commandPipeline,
    ProviderRateLimitRecorder rateLimitRecorder,
    TimeProvider timeProvider,
    IOptions<AIProviderOptions> providerOptions,
    ILogger logger,
    ConfiguredAgent? explicitRole = null) : IChatClient
{
    /// <inheritdoc/>
    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        var (role, candidates) = await Resolve(cancellationToken);
        var prompt = WithSkills(messages, role);

        var dispatch = await Dispatch(
            role,
            candidates,
            async (client, model, ct) => await client.GetResponseAsync(prompt, WithModel(options, model), ct),
            cancellationToken);

        if (dispatch.Outcome != PoolDispatchOutcome.Succeeded)
        {
            throw new AIChatClientUnavailable(purpose, dispatch.Reason);
        }

        var response = dispatch.Value!;
        await RecordUsage(response.ModelId, response.Usage, dispatch.ProviderId);
        return response;
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var (role, candidates) = await Resolve(cancellationToken);
        var prompt = WithSkills(messages, role);

        var dispatch = await Dispatch(
            role,
            candidates,
            async (client, model, ct) => await StartedStream.Open(client.GetStreamingResponseAsync(prompt, WithModel(options, model), ct), ct),
            cancellationToken,
            holdSlot: true);

        if (dispatch.Outcome != PoolDispatchOutcome.Succeeded)
        {
            throw new AIChatClientUnavailable(purpose, dispatch.Reason);
        }

        var stream = dispatch.Value!;
        await using (stream)
        {
            UsageDetails? usage = null;
            string? modelId = null;
            try
            {
                while (stream.Current is { } update)
                {
                    modelId ??= update.ModelId;
                    foreach (var content in update.Contents.OfType<UsageContent>())
                    {
                        usage = content.Details;
                    }

                    yield return update;

                    if (!await stream.MoveNext(cancellationToken))
                    {
                        break;
                    }
                }
            }
            finally
            {
                stream.Slot?.Dispose();
            }

            await RecordUsage(modelId, usage, dispatch.ProviderId);
        }
    }

    /// <inheritdoc/>
    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceKey is null && serviceType.IsInstanceOfType(this) ? this : null;

    /// <inheritdoc/>
    public void Dispose()
    {
    }

    static bool IsTransient(Exception exception) => exception switch
    {
        ClientResultException clientResult => IsTransientStatus(clientResult.Status),
        HttpRequestException http => http.StatusCode is null || IsTransientStatus((int)http.StatusCode),
        TimeoutException => true,
        _ => ProviderRateLimit.IsIndicatedBy(exception.Message)
    };

    static bool IsTransientStatus(int status) => status is 0 or (int)HttpStatusCode.TooManyRequests or >= 500;

    static ChatOptions WithModel(ChatOptions? options, ModelName model)
    {
        var result = options?.Clone() ?? new ChatOptions();
        result.ModelId = model.Value;
        return result;
    }

    static IEnumerable<ChatMessage> WithSkills(IEnumerable<ChatMessage> messages, ConfiguredAgent? role)
    {
        var skills = AgentSkillPrompt.For(role?.Skills);
        return skills.Length == 0 ? messages : [new ChatMessage(ChatRole.System, skills), .. messages];
    }

    async Task<(ConfiguredAgent? Role, IReadOnlyList<AIProviderId> Direct)> Resolve(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var role = explicitRole ?? await ConfiguredAgent.For(readModels, purpose);
        var hasProvider = role?.ProviderId is { } providerId && !providerId.Equals(AIProviderId.NotSet);
        return (role, hasProvider ? [role!.ProviderId!] : []);
    }

    async Task<ChatDispatch<T>> Dispatch<T>(
        ConfiguredAgent? role,
        IReadOnlyList<AIProviderId> direct,
        Func<IChatClient, ModelName, CancellationToken, Task<T>> call,
        CancellationToken cancellationToken,
        bool holdSlot = false)
    {
        var tier = role?.Tier ?? ModelTier.Balanced;
        var hasPool = role?.PoolId is { } poolId && !poolId.Equals(AIProviderPoolId.NotSet);
        var servedBy = AIProviderId.NotSet;
        var reason = $"The {purpose.Value} agent has no AI provider or pool configured. Configure one in Settings under Agents.";

        if (hasPool)
        {
            var pool = await readModels.GetInstanceById<AIProviderPool>((EventSourceId)role!.PoolId!);
            var members = pool?.Members?.ToList();
            if (members is { Count: > 0 })
            {
                var burn = await providerBurn.TrailingWeek(cancellationToken);
                var usageLevels = await providerUsageLevels.RefreshMany([.. members.Select(member => member.ProviderId)], cancellationToken);
                var capacities = await CapacitiesOf(members, cancellationToken);
                var selection = new PoolSelectionData(
                    burn.Tokens,
                    burn.Sessions,
                    recentProviderFailures.CountsSince(providerOptions.Value.RecentFailureWindow),
                    usageLevels.Where(pair => pair.Value.RemainingCapacity is not null).ToDictionary(pair => pair.Key, pair => pair.Value.RemainingCapacity!.Value))
                {
                    HeadroomByProvider = capacities.ToDictionary(pair => pair.Key, pair => pair.Value.Headroom)
                };

                var dispatch = await PoolDispatcher.Dispatch(
                    members,
                    selection,
                    recentProviderFailures,
                    $"No member of pool {role.PoolId} could serve this chat",
                    async (member, ct) => capacities.TryGetValue(member.ProviderId, out var capacity) && !capacity.CanStartWork
                        ? PoolAttempt<(T Value, AIProviderId Provider)>.Skipped($"AI provider {member.ProviderId} has no capacity to start work")
                        : await Attempt(member.ProviderId, tier, call, holdSlot, ct),
                    cancellationToken);

                if (dispatch.Outcome == PoolDispatchOutcome.Succeeded)
                {
                    return new(PoolDispatchOutcome.Succeeded, dispatch.Value.Value, dispatch.Value.Provider, string.Empty);
                }

                reason = dispatch.Reason;
                servedBy = AIProviderId.NotSet;
                if (dispatch.Outcome == PoolDispatchOutcome.Stopped)
                {
                    return new(PoolDispatchOutcome.Stopped, default, servedBy, reason);
                }
            }
        }

        foreach (var providerId in direct)
        {
            var attempt = await Attempt(providerId, tier, call, holdSlot, cancellationToken);
            if (attempt.Outcome == PoolAttemptOutcome.Succeeded)
            {
                return new(PoolDispatchOutcome.Succeeded, attempt.Value.Value, attempt.Value.Provider, string.Empty);
            }

            reason = attempt.Reason;
        }

        return new(PoolDispatchOutcome.Exhausted, default, servedBy, reason);
    }

    async Task<IReadOnlyDictionary<AIProviderId, AIProviderCapacity>> CapacitiesOf(IReadOnlyCollection<AIProviderPoolMember> members, CancellationToken cancellationToken)
    {
        try
        {
            return await providerCapacities.ForMany([.. members.Select(member => member.ProviderId)], cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Not knowing must not block work: without capacities every member is admitted as fully available.
            logger.CouldNotReadChatPoolCapacity(exception, purpose);
            return new Dictionary<AIProviderId, AIProviderCapacity>();
        }
    }

    async Task<PoolAttempt<(T Value, AIProviderId Provider)>> Attempt<T>(
        AIProviderId providerId,
        ModelTier tier,
        Func<IChatClient, ModelName, CancellationToken, Task<T>> call,
        bool holdSlot,
        CancellationToken cancellationToken)
    {
        var provider = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
        if (provider is null)
        {
            logger.ChatProviderNotConfigured(providerId, purpose);
            return PoolAttempt<(T, AIProviderId)>.Skipped($"AI provider {providerId} is not configured");
        }

        if (!compatibility.Supports(purpose, provider.Type))
        {
            logger.ChatProviderDoesNotSatisfyAgent(providerId, provider.Type, purpose);
            return PoolAttempt<(T, AIProviderId)>.Skipped($"AI provider {providerId} cannot serve the {purpose.Value} agent");
        }

        var model = TierModelResolution.Resolve(provider.TierModels, provider.AvailableModels, tier);
        if (model.Equals(ModelName.NotSet) || !chatClientFactory.CanServe(provider, model))
        {
            logger.ChatProviderCannotServe(providerId, provider.Type, purpose);
            return PoolAttempt<(T, AIProviderId)>.Skipped($"AI provider {providerId} has no usable model for the {purpose.Value} agent");
        }

        if (provider.RateLimitedUntil > timeProvider.GetUtcNow())
        {
            logger.ChatProviderRateLimited(providerId, provider.RateLimitedUntil);
            return PoolAttempt<(T, AIProviderId)>.Skipped($"AI provider {providerId} is rate limited");
        }

        var slot = await providerConcurrencyGate.TryEnter(providerId, cancellationToken);
        if (slot is null)
        {
            logger.ChatProviderConcurrencyLimitTimedOut(providerId);
            return PoolAttempt<(T, AIProviderId)>.Skipped($"AI provider {providerId} is saturated");
        }

        var client = await chatClientFactory.Create(provider, model);
        if (client is null)
        {
            slot.Dispose();
            return PoolAttempt<(T, AIProviderId)>.Skipped($"AI provider {providerId} has no conversational client");
        }

        var keepSlot = false;
        try
        {
            var value = await call(client, model, cancellationToken);
            if (value is StartedStream stream)
            {
                // The stream owns the client and the slot from here - released when it ends.
                stream.Own(client, holdSlot ? slot : null);
                keepSlot = holdSlot;
                if (!holdSlot)
                {
                    slot.Dispose();
                }

                client = null;
                slot = null;
            }

            return PoolAttempt<(T, AIProviderId)>.Succeeded((value, providerId));
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            logger.ChatCallFailed(exception, providerId, purpose);
            if (!IsTransient(exception))
            {
                return PoolAttempt<(T, AIProviderId)>.PermanentFailure(default, exception.Message);
            }

            if (ProviderRateLimit.IsIndicatedBy(exception.Message) || exception is ClientResultException { Status: (int)HttpStatusCode.TooManyRequests })
            {
                await rateLimitRecorder.Record(providerId, exception.Message);
            }

            return PoolAttempt<(T, AIProviderId)>.TransientFailure(exception.Message);
        }
        finally
        {
            if (!keepSlot)
            {
                slot?.Dispose();
            }

            client?.Dispose();
        }
    }

    async Task RecordUsage(string? modelId, UsageDetails? usage, AIProviderId providerId)
    {
        if (usage is null)
        {
            return;
        }

        try
        {
            var agent = agents.FindByPurpose(purpose);
            using var scope = agentExecution.As(purpose);
            var command = new RecordAgentSessionUsage(
                AgentSessionId.New(),
                agent?.Id ?? AgentId.NotSet,
                modelId is null ? ModelName.NotSet : new ModelName(modelId),
                purpose,
                providerId,
                InputTokens: usage.InputTokenCount is { } input ? new InputTokens(input) : null,
                OutputTokens: usage.OutputTokenCount is { } output ? new OutputTokens(output) : null,
                CachedTokens: usage.CachedInputTokenCount is { } cached ? new CachedTokens(cached) : null);
            await commandPipeline.ExecuteAndReport(command, logger);
        }
        catch (Exception exception)
        {
            // Losing a usage record is not worth failing the caller's chat over.
            logger.CouldNotRecordChatUsage(exception, purpose);
        }
    }

    sealed record ChatDispatch<T>(PoolDispatchOutcome Outcome, T? Value, AIProviderId ProviderId, string Reason);

    sealed class StartedStream : IAsyncDisposable
    {
        IAsyncEnumerator<ChatResponseUpdate>? _enumerator;
        IChatClient? _client;

        public ChatResponseUpdate? Current { get; private set; }

        public IDisposable? Slot { get; private set; }

        public static async Task<StartedStream> Open(IAsyncEnumerable<ChatResponseUpdate> updates, CancellationToken cancellationToken)
        {
            var stream = new StartedStream { _enumerator = updates.GetAsyncEnumerator(cancellationToken) };
            try
            {
                await stream.MoveNext(cancellationToken);
                return stream;
            }
            catch
            {
                await stream.DisposeAsync();
                throw;
            }
        }

        public void Own(IChatClient client, IDisposable? slot)
        {
            _client = client;
            Slot = slot;
        }

        public async Task<bool> MoveNext(CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (_enumerator is not null && await _enumerator.MoveNextAsync())
            {
                Current = _enumerator.Current;
                return true;
            }

            Current = null;
            return false;
        }

        public async ValueTask DisposeAsync()
        {
            if (_enumerator is not null)
            {
                await _enumerator.DisposeAsync();
                _enumerator = null;
            }

            Slot?.Dispose();
            Slot = null;
            _client?.Dispose();
            _client = null;
        }
    }
}
