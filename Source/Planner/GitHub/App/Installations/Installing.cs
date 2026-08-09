// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.App.Installations;

/// <summary>
/// Command for recording that the GitHub App has been installed on an account (organization or
/// user) - triggered from the App's setup-URL redirect after a user installs it, and idempotently
/// from the <c>installation</c> webhook event as a robustness net.
/// </summary>
/// <param name="Installation">The identity of the installation.</param>
/// <param name="Account">The login of the account the App was installed on.</param>
[Command]
public record RecordGitHubAppInstallation(InstallationId Installation, OrganizationName Account)
{
    /// <summary>
    /// Handles the command by appending the installation fact - <see cref="Installation"/> resolves
    /// as the event source id, being the command's sole <see cref="EventSourceId{T}"/>-derived property.
    /// </summary>
    /// <returns>The event.</returns>
    public GitHubAppInstalled Handle() => new(Account);
}

/// <summary>
/// Event raised when the GitHub App has been installed on an account.
/// </summary>
/// <param name="Account">The login of the account the App was installed on.</param>
[EventType]
public record GitHubAppInstalled(OrganizationName Account);
