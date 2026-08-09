// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub;

/// <summary>
/// Maps GitHub's <c>author_association</c> values to the Planner's <see cref="AuthorAssociation"/>.
/// </summary>
public static class GitHubAuthorAssociations
{
    /// <summary>
    /// Maps a GitHub <c>author_association</c> value.
    /// </summary>
    /// <param name="association">The value as reported by GitHub.</param>
    /// <returns>The matching <see cref="AuthorAssociation"/>.</returns>
    public static AuthorAssociation Map(string? association) => association switch
    {
        "OWNER" => AuthorAssociation.Owner,
        "MEMBER" => AuthorAssociation.Member,
        "COLLABORATOR" => AuthorAssociation.Collaborator,
        "CONTRIBUTOR" => AuthorAssociation.Contributor,
        "NONE" or "FIRST_TIME_CONTRIBUTOR" or "FIRST_TIMER" => AuthorAssociation.External,
        _ => AuthorAssociation.None
    };
}
