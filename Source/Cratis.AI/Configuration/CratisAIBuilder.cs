// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
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
    /// Registers the <see cref="ISecretProtector"/> and <see cref="ISecretRevealer"/> the package
    /// protects and reveals provider credentials with. Required - there is no safe default (plan
    /// Section 5.1, risk #10).
    /// </summary>
    /// <typeparam name="TProtector">The implementation type, implementing both interfaces.</typeparam>
    /// <returns>The <see cref="CratisAIBuilder"/> for continuation.</returns>
    public CratisAIBuilder WithSecretProtection<TProtector>()
        where TProtector : class, ISecretProtector, ISecretRevealer
    {
        Services.AddSingleton<TProtector>();
        Services.AddSingleton<ISecretProtector>(_ => _.GetRequiredService<TProtector>());
        Services.AddSingleton<ISecretRevealer>(_ => _.GetRequiredService<TProtector>());
        return this;
    }

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
}
