// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Identity;

/// <summary>
/// Log messages for the Planner's security boundary.
/// </summary>
internal static partial class SecurityLog
{
    [LoggerMessage(LogLevel.Warning, "Planner:Security:AllowUnauthenticatedOperators is on - every caller is treated as a fully privileged operator. This is for a developer machine only; never enable it on a reachable deployment")]
    internal static partial void UnauthenticatedOperatorsAllowed(this ILogger logger);

    [LoggerMessage(LogLevel.Warning, "No Planner:Security:ForwardedUserHeader is configured - no request will ever be recognized as an operator, so steering, log streaming and every protected command are refused. Configure the header the authenticating ingress records the operator's login in")]
    internal static partial void NoForwardedUserHeader(this ILogger logger);

    [LoggerMessage(LogLevel.Warning, "No Planner:GitHubApp:WebhookSecret is configured - every delivery to /webhooks/github is rejected until one is set")]
    internal static partial void NoGitHubWebhookSecret(this ILogger logger);

    [LoggerMessage(LogLevel.Warning, "No Planner:Alerts:WebhookSecret is configured - every delivery to /webhooks/alerts is rejected until one is set")]
    internal static partial void NoAlertWebhookSecret(this ILogger logger);

    [LoggerMessage(LogLevel.Information, "Operator identity is taken from the '{Header}' request header - the ingress must overwrite it on every inbound request")]
    internal static partial void ForwardedUserHeaderConfigured(this ILogger logger, string header);
}
