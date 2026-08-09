// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.App.Installations;

/// <summary>
/// Command for recording that the GitHub App has been uninstalled from an account - triggered from
/// the <c>installation</c> webhook event's <c>deleted</c> action.
/// </summary>
/// <param name="Installation">The identity of the installation that was removed.</param>
[Command]
public record RemoveGitHubAppInstallation(InstallationId Installation)
{
    /// <summary>
    /// Handles the command by appending the removal fact.
    /// </summary>
    /// <returns>The event.</returns>
    public GitHubAppUninstalled Handle() => new();
}

/// <summary>
/// Event raised when the GitHub App has been uninstalled from an account.
/// </summary>
[EventType]
public record GitHubAppUninstalled;
