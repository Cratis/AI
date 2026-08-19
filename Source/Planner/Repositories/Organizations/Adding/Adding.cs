// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Organizations.Adding;

/// <summary>
/// Command for adding a GitHub organization whose repositories the Planner should track.
/// </summary>
/// <param name="Name">The name of the organization.</param>
/// <param name="TrackingPolicy">
/// Whether every repository is tracked automatically, or only ones explicitly selected after
/// discovery - defaults to <see cref="OrganizationTrackingPolicy.All"/>, the existing behavior.
/// </param>
[Command]
public record AddOrganization(OrganizationName Name, OrganizationTrackingPolicy TrackingPolicy = OrganizationTrackingPolicy.All)
{
    /// <summary>
    /// Handles the command by opening the organization's stream and appending an <see cref="OrganizationAdded"/> event.
    /// </summary>
    /// <returns>A tuple of the organization identity (event source) and the event.</returns>
    public (OrganizationId, OrganizationAdded) Handle() => (OrganizationId.From(Name), new(Name, TrackingPolicy));
}

/// <summary>
/// Represents the validator for the <see cref="AddOrganization"/> command.
/// </summary>
public class AddOrganizationValidator : CommandValidator<AddOrganization>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddOrganizationValidator"/> class.
    /// </summary>
    public AddOrganizationValidator() => RuleFor(_ => _.Name).NotEmpty().WithMessage("An organization name is required");
}

/// <summary>
/// Event raised when an organization has been added - the starting point for discovering its
/// repositories and subscribing to its webhooks.
/// </summary>
/// <param name="Name">The name of the organization as entered.</param>
/// <param name="TrackingPolicy">Whether every repository is tracked automatically, or only ones explicitly selected.</param>
[EventType]
public record OrganizationAdded(OrganizationName Name, OrganizationTrackingPolicy TrackingPolicy);
