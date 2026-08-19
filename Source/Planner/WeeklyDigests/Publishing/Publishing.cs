// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Listing = Planner.WeeklyDigests.Listing;

namespace Planner.WeeklyDigests.Publishing;

/// <summary>
/// Command for publishing a weekly digest to whichever outlets are configured.
/// </summary>
/// <param name="WeeklyDigest">The identity of the weekly digest.</param>
[Command]
public record PublishWeeklyDigest(WeeklyDigestId WeeklyDigest)
{
    /// <summary>
    /// Handles the command by posting to the configured outlets. No description to publish, or no
    /// outlet configured, is a validation rejection rather than an exception.
    /// </summary>
    /// <param name="digest">The weekly digest's read model - resolved by the command's event source id.</param>
    /// <param name="publisher">The <see cref="IWeeklyDigestPublisher"/> to publish through.</param>
    /// <returns>The <see cref="WeeklyDigestPublished"/> event, or a validation error.</returns>
    public async Task<Result<WeeklyDigestPublished, ValidationResult>> Handle(Listing.WeeklyDigest? digest, IWeeklyDigestPublisher publisher)
    {
        if (digest is null || digest.Description is null || digest.Description == WeeklyDigestDescription.NotSet)
        {
            return ValidationResult.Error("The weekly digest needs a description before it can be published");
        }

        var publishedTo = await publisher.Publish(digest.Description, digest.Themes ?? []);
        if (publishedTo.Count == 0)
        {
            return ValidationResult.Error("No publish outlet is configured, or every configured outlet refused the post");
        }

        return new WeeklyDigestPublished(publishedTo);
    }
}

/// <summary>
/// Event raised when a weekly digest has been published.
/// </summary>
/// <param name="PublishedTo">The names of the outlets it was published to.</param>
[EventType]
public record WeeklyDigestPublished(IEnumerable<string> PublishedTo);
