// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Carries the person who initiated work, independently of the acting agent's identity.
/// Consumers enter a scope only after authenticating and resolving their team member.
/// </summary>
public interface IWorkInitiation
{
    /// <summary>Gets the initiator, or <see cref="WorkInitiator.None"/> when unknown.</summary>
    WorkInitiator Current { get; }

    /// <summary>Enters a scope without allowing established work to switch member.</summary>
    /// <param name="initiator">The authenticated initiator.</param>
    /// <returns>The scope to dispose when the work finishes.</returns>
    IDisposable Begin(WorkInitiator initiator);
}
