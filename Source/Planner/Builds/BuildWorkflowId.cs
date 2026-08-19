// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Builds;

/// <summary>
/// The identity of a tracked workflow's status - the predictable <c>{org}-{repo}-{workflow}</c> key,
/// so recording a repository's build status again always lands on the same stream.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record BuildWorkflowId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset workflow identity.
    /// </summary>
    public static readonly BuildWorkflowId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="BuildWorkflowId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator BuildWorkflowId(string value) => new(value);

    /// <summary>
    /// Builds the predictable identity for a workflow of a repository.
    /// </summary>
    /// <param name="owner">The organization owning the repository.</param>
    /// <param name="repository">The repository the workflow belongs to.</param>
    /// <param name="workflow">The workflow's name.</param>
    /// <returns>The <see cref="BuildWorkflowId"/>.</returns>
    public static BuildWorkflowId From(OrganizationName owner, RepositoryName repository, WorkflowName workflow) =>
        new($"{Slug(owner.Value)}-{Slug(repository.Value)}-{Slug(workflow.Value)}");

    static string Slug(string value) => value.ToLowerInvariant().Replace(' ', '-');
}
