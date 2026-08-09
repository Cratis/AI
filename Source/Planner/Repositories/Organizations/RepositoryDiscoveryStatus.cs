// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.Organizations;

/// <summary>
/// How far the Planner got discovering the repositories of an organization on GitHub.
/// </summary>
public enum RepositoryDiscoveryStatus
{
    /// <summary>The organization has been added and its repositories have not been looked up yet.</summary>
    Pending = 0,

    /// <summary>Every repository of the organization was found and added.</summary>
    Discovered = 1,

    /// <summary>The repositories could not be looked up - the reason says why.</summary>
    Failed = 2
}
