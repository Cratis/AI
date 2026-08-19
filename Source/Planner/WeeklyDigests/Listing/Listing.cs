// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.WeeklyDigests.ExtractingThemes;
using Planner.WeeklyDigests.GeneratingDescription;
using Planner.WeeklyDigests.Publishing;
using Planner.WeeklyDigests.Receiving;

namespace Planner.WeeklyDigests.Listing;

/// <summary>
/// Read model for the weekly digest inbox - every digest a weekly job has posted, what the language
/// model made of it, and whether it has been published.
/// </summary>
/// <param name="Id">The weekly digest identity.</param>
/// <param name="Content">The raw content as delivered.</param>
/// <param name="ReceivedAt">When the digest was received.</param>
/// <param name="Themes">The themes the language model extracted - <see langword="null"/> until analyzed.</param>
/// <param name="Description">The description - the language model's suggestion, or a person's edit of it.</param>
/// <param name="Status">Where the digest stands.</param>
/// <param name="PublishedTo">Where the digest was published - <see langword="null"/> until published.</param>
[ReadModel]
[FromEvent<WeeklyDigestReceived>]
public record WeeklyDigest(
    WeeklyDigestId Id,
    WeeklyDigestContent Content,
    [SetFromContext<WeeklyDigestReceived>(nameof(EventContext.Occurred))]
    DateTimeOffset? ReceivedAt = null,
    [SetFrom<WeeklyDigestThemesExtracted>(nameof(WeeklyDigestThemesExtracted.Themes))]
    IEnumerable<string>? Themes = null,
    [SetFrom<WeeklyDigestDescriptionGenerated>(nameof(WeeklyDigestDescriptionGenerated.Description))]
    [SetFrom<WeeklyDigestDescriptionEdited>(nameof(WeeklyDigestDescriptionEdited.Description))]
    WeeklyDigestDescription? Description = null,
    [SetValue<WeeklyDigestDescriptionGenerated>(WeeklyDigestStatus.Unpublished)]
    [SetValue<WeeklyDigestPublished>(WeeklyDigestStatus.Published)]
    WeeklyDigestStatus Status = WeeklyDigestStatus.Received,
    [SetFrom<WeeklyDigestPublished>(nameof(WeeklyDigestPublished.PublishedTo))]
    IEnumerable<string>? PublishedTo = null)
{
    /// <summary>
    /// Observes every weekly digest.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the weekly digests.</param>
    /// <returns>An observable of all weekly digests.</returns>
    public static ISubject<IEnumerable<WeeklyDigest>> AllWeeklyDigests(IMongoCollection<WeeklyDigest> collection) =>
        collection.Observe();
}
