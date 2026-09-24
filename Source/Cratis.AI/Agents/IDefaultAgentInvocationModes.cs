// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.DependencyInjection;

namespace Cratis.AI.Agents;

/// <summary>
/// Defines how a purpose is invoked when no configured agent claims it.
/// </summary>
/// <remarks>
/// The invocation mode decides which capabilities a model has to satisfy before it may serve a
/// purpose, so it has to be answerable even for a purpose nobody has configured an agent for -
/// during a first run, or for a purpose an application never configures at all.
/// </remarks>
public interface IDefaultAgentInvocationModes
{
    /// <summary>
    /// Gets the mode a purpose is invoked as when no configured agent claims it.
    /// </summary>
    /// <param name="purpose">The <see cref="LanguageModelPurpose"/> being served.</param>
    /// <returns>The <see cref="AgentInvocationMode"/> to require capabilities against.</returns>
    AgentInvocationMode For(LanguageModelPurpose purpose);
}

/// <summary>
/// Answers from the invocation modes the package's own purposes are defined to run as.
/// </summary>
/// <remarks>
/// <para>
/// Which agents an application ships - their names, their descriptions, their avatars - is the
/// application's own catalog. How a purpose is <em>invoked</em> is not: a purpose that runs in a
/// worker container needs a model that can drive tools, and one that answers a question needs a
/// model that can hold a conversation. That follows from what the purpose is, so the package answers
/// it rather than making every application restate it.
/// </para>
/// <para>
/// An application with purposes of its own registers its own implementation. Anything unlisted is
/// answered as chat, which asks the least of a model - so a purpose nobody has classified is not
/// refused a model it could have served on.
/// </para>
/// </remarks>
[Singleton]
public class DefaultAgentInvocationModes : IDefaultAgentInvocationModes
{
    static readonly HashSet<LanguageModelPurpose> _runAsJobs =
    [
        AgentPurposes.WorkExecution,
        AgentPurposes.ContentAuthoring,
        AgentPurposes.TaskExecution,
        AgentPurposes.BugFixing
    ];

    /// <inheritdoc/>
    public AgentInvocationMode For(LanguageModelPurpose purpose) =>
        _runAsJobs.Contains(purpose) ? AgentInvocationMode.Job : AgentInvocationMode.Chat;
}
