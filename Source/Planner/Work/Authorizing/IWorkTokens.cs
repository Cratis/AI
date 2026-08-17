// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Authorizing;

/// <summary>
/// Defines the issuing and verification of the bearer tokens worker containers authenticate their
/// callbacks with.
/// </summary>
public interface IWorkTokens
{
    /// <summary>
    /// Issues a new token for a unit of work, replacing any token issued for it before.
    /// </summary>
    /// <param name="work">The work to issue a token for.</param>
    /// <returns>The issued <see cref="WorkToken"/>, to hand to the container that runs the work.</returns>
    Task<WorkToken> Issue(WorkId work);

    /// <summary>
    /// Verifies a token presented for a unit of work against the one issued for it.
    /// </summary>
    /// <param name="work">The work the caller claims to be.</param>
    /// <param name="presented">The token the caller presented.</param>
    /// <returns><see langword="true"/> only when a token was issued for the work and the presented one matches it.</returns>
    Task<bool> IsValid(WorkId work, WorkToken presented);
}
