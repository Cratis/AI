// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Callback;

/// <summary>
/// Defines the issuing and validation of the bearer token a worker container's callbacks
/// authenticate with.
/// </summary>
public interface IWorkerCallbackTokens
{
    /// <summary>
    /// Issues a new callback token for a unit of work, replacing any token issued for it before.
    /// </summary>
    /// <param name="work">The identity of the work the token authenticates callbacks for.</param>
    /// <returns>The new <see cref="CallbackToken"/>.</returns>
    CallbackToken Issue(WorkId work);

    /// <summary>
    /// Validates a presented token against the one issued for a unit of work, in constant time.
    /// </summary>
    /// <param name="work">The identity of the work the request claims to be reporting on.</param>
    /// <param name="presentedToken">The token presented on the request, when any.</param>
    /// <returns><see langword="true"/> when the token is valid and not expired.</returns>
    bool Validate(WorkId work, string? presentedToken);

    /// <summary>
    /// Revokes the token issued for a unit of work - called once the work reaches a terminal state,
    /// so a finished worker's credential cannot be replayed.
    /// </summary>
    /// <param name="work">The identity of the work whose token to revoke.</param>
    void Revoke(WorkId work);
}
