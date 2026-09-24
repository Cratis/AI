// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.Decisions;
using Cratis.AI.Decisions.DecisionEngine;
using Microsoft.Extensions.DependencyInjection;

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
    /// Registers the decision-making surface - <see cref="IDecisions"/> and the Decision Engine
    /// client - resolving the provider and model through <typeparamref name="TResolver"/>. Optional:
    /// nothing decision-related is registered when this is never called.
    /// </summary>
    /// <typeparam name="TResolver">The <see cref="IDecisionProviderResolver"/> implementation.</typeparam>
    /// <param name="configure">Optional callback for transport and telemetry settings.</param>
    /// <returns>The <see cref="CratisAIBuilder"/> for continuation.</returns>
    /// <remarks>
    /// <para>
    /// The resolver is required rather than defaulted. Which provider serves decisions is a product
    /// setting, and a package that guessed one would be making a configuration decision on behalf of
    /// a host that never asked it to.
    /// </para>
    /// <para>
    /// The resolver and <see cref="IDecisions"/> are registered <b>scoped</b>, not singleton. A
    /// resolver's whole job is to answer "which provider, for this caller" - which in a multi-tenant
    /// host means reading per-tenant configuration. Held on a singleton it would capture whatever
    /// scope first resolved it and answer every tenant with that one's settings, silently and
    /// forever. <see cref="IDecisions"/> follows it rather than becoming a captive dependency.
    /// </para>
    /// </remarks>
    public CratisAIBuilder WithDecisions<TResolver>(Action<DecisionOptions>? configure = null)
        where TResolver : class, IDecisionProviderResolver
    {
        Services.AddScoped<IDecisionProviderResolver, TResolver>();
        Services.AddScoped<IDecisions, Decisions.Decisions>();
        Services.AddSingleton<IDecisionTelemetry, DecisionTelemetry>();
        Services.AddTransient<IDecisionProviderClient, DecisionEngineProviderClient>();

        var options = Services.AddOptions<DecisionOptions>().BindConfiguration(DecisionOptions.SectionName);
        if (configure is not null)
        {
            options.Configure(configure);
        }

        // Named rather than typed: the endpoint is per configured provider, resolved at call time,
        // so there is nothing for a typed client's BaseAddress to be set to at registration.
        Services.AddHttpClient(DecisionEngineProviderClient.HttpClientName);

        return this;
    }
}
