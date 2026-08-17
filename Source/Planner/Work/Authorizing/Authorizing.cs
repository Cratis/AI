// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Work.Completing;
using Planner.Work.CompletingInvestigation;
using Planner.Work.Failing;
using Planner.Work.Stopping;

namespace Planner.Work.Authorizing;

/// <summary>
/// Event raised when a bearer token has been issued for a unit of work. The token is what tells the
/// Planner that a callback genuinely came from the container it launched, rather than from anyone
/// who guessed a work id - it is issued once, at dispatch, and handed to that container only.
/// </summary>
/// <param name="Token">The token the worker authenticates its callbacks with.</param>
[EventType]
public record WorkTokenIssued(WorkToken Token);

/// <summary>
/// Passive read model exposing the bearer token issued for a unit of work, so a callback can be
/// verified against it. Passive keeps it out of the queryable database - it is resolved by explicit
/// key from the callback boundary only, and is never exposed through a query.
/// </summary>
/// <remarks>
/// The token dies with the work it belongs to: every terminal event removes the read model, so a
/// credential is only ever valid while the container it was handed to is still expected to report.
/// A removed read model resolves to a default instance rather than <see langword="null"/>, which is
/// why <see cref="IWorkTokens"/> treats an absent or empty token as "no valid token" rather than
/// comparing against a sentinel.
/// </remarks>
/// <param name="Id">The work identity.</param>
/// <param name="Token">The token issued for the work.</param>
[ReadModel]
[Passive]
[FromEvent<WorkTokenIssued>]
[RemovedWith<WorkCompleted>]
[RemovedWith<InvestigationCompleted>]
[RemovedWith<WorkFailed>]
[RemovedWith<WorkStopped>]
public record WorkAuthorization(WorkId Id, WorkToken Token);
