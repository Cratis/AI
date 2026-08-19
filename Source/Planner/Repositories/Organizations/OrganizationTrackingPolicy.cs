// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Organizations;

/// <summary>
/// How an organization's repositories are tracked once added.
/// </summary>
public enum OrganizationTrackingPolicy
{
    /// <summary>Every repository the organization has, now and in the future, is tracked automatically.</summary>
    All = 0,

    /// <summary>Only repositories explicitly selected are tracked - a new repository the organization
    /// gets later is not added automatically.</summary>
    Selected = 1,
}
