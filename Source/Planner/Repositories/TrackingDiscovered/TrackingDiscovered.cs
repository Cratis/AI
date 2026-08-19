// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Repositories.Adding;

namespace Planner.Repositories.TrackingDiscovered;

/// <summary>
/// Command for tracking a subset of the repositories discovery found for a "Selected"-policy
/// organization - the person's pick from <see cref="Organizations.Listing.Organization.DiscoveredRepositories"/>.
/// </summary>
/// <param name="Organization">The organization the repositories belong to.</param>
/// <param name="Names">The names of the repositories to start tracking.</param>
[Command]
public record TrackDiscoveredRepositories(OrganizationName Organization, IEnumerable<RepositoryName> Names)
{
    /// <summary>
    /// Handles the command by opening each selected repository's own stream and appending a
    /// <see cref="RepositoryAdded"/> event - the same fact <see cref="AddRepository"/> produces for
    /// a single repository, fanned out across the selection.
    /// </summary>
    /// <returns>The events, one per selected repository.</returns>
    public IEnumerable<EventForEventSourceId> Handle() =>
        Names.Select(name => new EventForEventSourceId(RepositoryId.From(Organization, name), new RepositoryAdded(Organization, name)));
}

/// <summary>
/// Represents the validator for the <see cref="TrackDiscoveredRepositories"/> command.
/// </summary>
public class TrackDiscoveredRepositoriesValidator : CommandValidator<TrackDiscoveredRepositories>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="TrackDiscoveredRepositoriesValidator"/> class.
    /// </summary>
    public TrackDiscoveredRepositoriesValidator()
    {
        RuleFor(_ => _.Organization).NotEmpty().WithMessage("An organization is required");
        RuleFor(_ => _.Names).NotEmpty().WithMessage("Select at least one repository");
    }
}
