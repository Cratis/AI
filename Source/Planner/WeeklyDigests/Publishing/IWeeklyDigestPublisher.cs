// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests.Publishing;

/// <summary>
/// Defines the publisher that posts a weekly digest to the configured outlets.
/// </summary>
public interface IWeeklyDigestPublisher
{
    /// <summary>
    /// Publishes a weekly digest to every configured outlet.
    /// </summary>
    /// <param name="description">The description to publish.</param>
    /// <param name="themes">The themes to publish alongside it.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The names of the outlets it was successfully published to.</returns>
    Task<IReadOnlyList<string>> Publish(WeeklyDigestDescription description, IEnumerable<string> themes, CancellationToken cancellationToken = default);
}
