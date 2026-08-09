// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The association an issue author has with the repository the issue was created in,
/// mirroring GitHub's <c>author_association</c> values.
/// </summary>
public enum AuthorAssociation
{
    /// <summary>The association is not known.</summary>
    None = 0,

    /// <summary>The author owns the repository.</summary>
    Owner = 1,

    /// <summary>The author is a member of the organization owning the repository.</summary>
    Member = 2,

    /// <summary>The author is a collaborator on the repository.</summary>
    Collaborator = 3,

    /// <summary>The author has previously contributed to the repository.</summary>
    Contributor = 4,

    /// <summary>The author has no association with the repository - an external user.</summary>
    External = 5
}
