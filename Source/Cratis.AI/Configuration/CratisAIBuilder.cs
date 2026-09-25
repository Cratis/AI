// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.Decisions;
using Cratis.AI.Decisions.BuiltIn;
using Cratis.AI.Decisions.Health;
using Cratis.AI.Decisions.Jev;
using Cratis.AI.Decisions.Usage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Cratis.AI.Configuration;

/// <summary>
/// Collects the seams a consumer supplies when adopting <c>Cratis.AI</c>, so the package's registration
/// stays a single fluent call rather than a growing parameter list on <c>AddCratisAI</c> itself.
/// </summary>
/// <param name="services">The <see cref="IServiceCollection"/> being configured.</param>
public class CratisAIBuilder(IServiceCollection services)
{
    /// <summary>
    /// Gets the underlying <see cref="IServiceCollection"/>.
    /// </summary>
    public IServiceCollection Services { get; } = services;

    /// <summary>
    /// Registers the <see cref="IAIAgents"/> lookup the package resolves agent identity and display
    /// names through. Required - <see cref="IAgentExecution"/> cannot attribute anything without it.
    /// </summary>
    /// <typeparam name="TAgents">The implementation type.</typeparam>
    /// <returns>The <see cref="CratisAIBuilder"/> for continuation.</returns>
    public CratisAIBuilder WithAgents<TAgents>()
        where TAgents : class, IAIAgents
    {
        Services.AddSingleton<IAIAgents, TAgents>();
        return this;
    }

    /// <summary>
    /// Registers the <see cref="IAIAlerts"/> the package raises operational signals through. Optional -
    /// defaults to <see cref="NoOpAIAlerts"/> when not called.
    /// </summary>
    /// <typeparam name="TAlerts">The implementation type.</typeparam>
    /// <returns>The <see cref="CratisAIBuilder"/> for continuation.</returns>
    public CratisAIBuilder WithAlerts<TAlerts>()
        where TAlerts : class, IAIAlerts
    {
        Services.AddSingleton<IAIAlerts, TAlerts>();
        return this;
    }

    /// <summary>
    /// Registers the <see cref="IAIUsageAttribution"/> the package resolves what a session's usage is
    /// attributed to through. Optional - defaults to <see cref="NoAttributionAIUsageAttribution"/> when
    /// not called.
    /// </summary>
    /// <typeparam name="TAttribution">The implementation type.</typeparam>
    /// <returns>The <see cref="CratisAIBuilder"/> for continuation.</returns>
    public CratisAIBuilder WithUsageAttribution<TAttribution>()
        where TAttribution : class, IAIUsageAttribution
    {
        Services.AddSingleton<IAIUsageAttribution, TAttribution>();
        return this;
    }

    /// <summary>
    /// Registers the decision-making surface - <see cref="IDecisions"/>, the engine clients, usage
    /// recording and the engine configuration - resolving the engine from what has been configured
    /// through the <c>Configuring</c> commands and falling back to the built-in engine. Optional:
    /// nothing decision-related is registered when this is never called.
    /// </summary>
    /// <param name="configure">Optional callback for transport and telemetry settings.</param>
    /// <returns>The <see cref="CratisAIBuilder"/> for continuation.</returns>
    /// <remarks>
    /// Where the built-in engine lives binds from <see cref="BuiltInDecisionEngineOptions.SectionName"/>
    /// - deployment configuration, not a setting anyone using the host edits.
    /// </remarks>
    public CratisAIBuilder WithDecisions(Action<DecisionOptions>? configure = null) =>
        WithDecisions<ConfiguredDecisionEngineResolver>(configure);

    /// <summary>
    /// Registers the decision-making surface, resolving the engine through
    /// <typeparamref name="TResolver"/> rather than through the package's own configuration.
    /// </summary>
    /// <typeparam name="TResolver">The <see cref="IDecisionEngineResolver"/> implementation.</typeparam>
    /// <param name="configure">Optional callback for transport and telemetry settings.</param>
    /// <returns>The <see cref="CratisAIBuilder"/> for continuation.</returns>
    /// <remarks>
    /// The resolver, <see cref="IDecisions"/> and the health check are registered <b>scoped</b>, not
    /// singleton. A resolver reads per-namespace configuration; held on a singleton it would capture
    /// whatever scope first resolved it and answer every tenant with that one's settings, silently
    /// and forever. Everything that depends on it follows it rather than becoming a captive
    /// dependency.
    /// </remarks>
    public CratisAIBuilder WithDecisions<TResolver>(Action<DecisionOptions>? configure = null)
        where TResolver : class, IDecisionEngineResolver
    {
        Services.AddScoped<IDecisionEngineResolver, TResolver>();
        Services.AddScoped<IDecisions, Decisions.Decisions>();
        Services.AddScoped<IDecisionEngineHealth, DecisionEngineHealth>();
        Services.AddScoped<IDecisionUsageRecorder, DecisionUsageRecorder>();
        Services.TryAddSingleton<DecisionEngineHealthCache>();
        Services.TryAddSingleton(TimeProvider.System);
        Services.AddSingleton<IDecisionTelemetry, DecisionTelemetry>();
        Services.AddTransient<IDecisionEngineClient, BuiltInDecisionEngineClient>();
        Services.AddTransient<IDecisionEngineClient, JevDecisionEngineClient>();

        var options = Services.AddOptions<DecisionOptions>().BindConfiguration(DecisionOptions.SectionName);
        if (configure is not null)
        {
            options.Configure(configure);
        }

        Services.AddOptions<BuiltInDecisionEngineOptions>().BindConfiguration(BuiltInDecisionEngineOptions.SectionName);

        // Named rather than typed: the endpoint is resolved per call from whatever engine is in
        // force, so there is nothing for a typed client's BaseAddress to be set to at registration.
        Services.AddHttpClient(BuiltInDecisionEngineClient.HttpClientName);
        Services.AddHttpClient(JevDecisionEngineClient.HttpClientName);

        return this;
    }
}
