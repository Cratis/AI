// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;
using Planner.Alerts;
using Planner.GitHub.App;

namespace Planner.Identity;

/// <summary>
/// Reports at startup what the deployment left open, rather than letting it surface as a puzzling
/// rejection on the first webhook delivery or the first operator action.
/// </summary>
/// <remarks>
/// Deliberately warnings and not a startup failure: browsing the Planner with no GitHub App, no alert
/// sender and no proxy in front of it is a supported state - refusing to boot would make the
/// credential-free first run impossible. Every gap it names is one the Planner is failing closed on.
/// </remarks>
/// <param name="securityOptions">The security configuration.</param>
/// <param name="gitHubAppOptions">The GitHub App configuration, carrying its webhook secret.</param>
/// <param name="alertOptions">The alert configuration, carrying its webhook secret.</param>
/// <param name="logger">The logger.</param>
public class SecurityAdvisory(
    IOptions<SecurityOptions> securityOptions,
    IOptions<GitHubAppOptions> gitHubAppOptions,
    IOptions<AlertOptions> alertOptions,
    ILogger<SecurityAdvisory> logger) : IHostedService
{
    /// <inheritdoc/>
    public Task StartAsync(CancellationToken cancellationToken)
    {
        var security = securityOptions.Value;

        if (security.AllowUnauthenticatedOperators)
        {
            logger.UnauthenticatedOperatorsAllowed();
        }
        else if (string.IsNullOrWhiteSpace(security.ForwardedUserHeader))
        {
            logger.NoForwardedUserHeader();
        }

        if (!string.IsNullOrWhiteSpace(security.ForwardedUserHeader))
        {
            logger.ForwardedUserHeaderConfigured(security.ForwardedUserHeader);
        }

        if (string.IsNullOrEmpty(gitHubAppOptions.Value.WebhookSecret))
        {
            logger.NoGitHubWebhookSecret();
        }

        if (string.IsNullOrEmpty(alertOptions.Value.WebhookSecret))
        {
            logger.NoAlertWebhookSecret();
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc/>
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
