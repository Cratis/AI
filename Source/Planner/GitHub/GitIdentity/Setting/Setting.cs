// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.GitIdentity.Setting;

/// <summary>
/// Command for setting the git identity worker containers commit as - one setting shared across the
/// whole Planner deployment, injected into every worker as <c>PLANNER_GIT_USER_NAME</c> /
/// <c>PLANNER_GIT_USER_EMAIL</c>.
/// </summary>
/// <param name="Name">The <c>git config user.name</c> to commit as.</param>
/// <param name="Email">The <c>git config user.email</c> to commit as.</param>
[Command]
public record SetGitIdentity(GitUserName Name, GitUserEmail Email) : ICanProvideEventSourceId
{
    /// <summary>
    /// Gets the fixed event source id - there is exactly one git identity per deployment.
    /// </summary>
    /// <returns>The fixed event source id.</returns>
    public EventSourceId GetEventSourceId() => GitIdentityId.Default;

    /// <summary>
    /// Handles the command by appending a <see cref="GitIdentitySet"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public GitIdentitySet Handle() => new(Name, Email);
}

/// <summary>
/// Represents the validator for the <see cref="SetGitIdentity"/> command.
/// </summary>
public class SetGitIdentityValidator : CommandValidator<SetGitIdentity>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SetGitIdentityValidator"/> class.
    /// </summary>
    public SetGitIdentityValidator()
    {
        RuleFor(_ => _.Name).NotEmpty().WithMessage("A git user name is required");
        RuleFor(_ => _.Name)
            .Must(name => name.Contains("(AI)", StringComparison.OrdinalIgnoreCase) || name.EndsWith("[bot]", StringComparison.OrdinalIgnoreCase))
            .When(_ => !string.IsNullOrEmpty(_.Name.Value))
            .WithMessage("The git identity should make clear this is an AI agent, e.g. 'Stagehand (AI)'");
        RuleFor(_ => _.Email).NotEmpty().WithMessage("A git user email is required");
        RuleFor(_ => _.Email)
            .Must(email => email.EndsWith("@users.noreply.github.com", StringComparison.OrdinalIgnoreCase))
            .When(_ => !string.IsNullOrEmpty(_.Email.Value))
            .WithMessage("Use a noreply GitHub email so the identity can never receive mail meant for a person");
    }
}

/// <summary>
/// Event raised when the git identity worker containers commit as has been set.
/// </summary>
/// <param name="Name">The <c>git config user.name</c> to commit as.</param>
/// <param name="Email">The <c>git config user.email</c> to commit as.</param>
[EventType]
public record GitIdentitySet(GitUserName Name, GitUserEmail Email);
