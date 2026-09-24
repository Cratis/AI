// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Copilot;

/// <summary>
/// Runs GitHub's device flow for a Copilot provider.
/// </summary>
public interface ICopilotDeviceTokens
{
    /// <summary>
    /// Begins a device-code sign-in.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>What the person needs to authorize with, or <see langword="null"/> when GitHub would not start one.</returns>
    Task<CopilotDeviceAuthorization?> Begin(CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks once whether a device-code sign-in has been authorized yet.
    /// </summary>
    /// <param name="authorization">What <see cref="Begin"/> returned.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The outcome of that single ask.</returns>
    Task<CopilotDeviceSignInResult> Complete(CopilotDeviceAuthorization authorization, CancellationToken cancellationToken = default);
}

/// <summary>
/// An in-flight device-code sign-in.
/// </summary>
/// <param name="DeviceCode">GitHub's handle for this sign-in. A secret: whoever holds it collects the token when the code is authorized.</param>
/// <param name="UserCode">The code the person types into the verification page. Not a secret - it is worthless without somebody signing in to their own GitHub account.</param>
/// <param name="VerificationUrl">Where to type it.</param>
/// <param name="IntervalSeconds">How often GitHub is willing to be asked.</param>
/// <param name="ExpiresAt">When GitHub stops accepting the code.</param>
public record CopilotDeviceAuthorization(string DeviceCode, string UserCode, string VerificationUrl, int IntervalSeconds, DateTimeOffset ExpiresAt);

/// <summary>
/// What one poll of GitHub's token endpoint established.
/// </summary>
/// <param name="Credential">The credential, once authorized.</param>
/// <param name="Pending">Whether the sign-in is still waiting on the person - the answer that means "ask again".</param>
/// <param name="SlowDown">Whether GitHub asked to be polled less often. Ignoring this earns an outright refusal, so the caller widens its interval.</param>
/// <param name="Failure">Why the sign-in is over, when it is - an empty string while it is not.</param>
public record CopilotDeviceSignInResult(AIProviderApiKey? Credential, bool Pending, bool SlowDown, string Failure)
{
    /// <summary>
    /// The result meaning "nobody has authorized it yet".
    /// </summary>
    public static readonly CopilotDeviceSignInResult StillPending = new(null, true, false, string.Empty);

    /// <summary>
    /// The result meaning "ask less often".
    /// </summary>
    public static readonly CopilotDeviceSignInResult PollingTooFast = new(null, true, true, string.Empty);
}

/// <summary>
/// The default <see cref="ICopilotDeviceTokens"/> - GitHub's own documented device flow
/// (<c>POST /login/device/code</c>, then polling <c>POST /login/oauth/access_token</c> with the
/// <c>device_code</c> grant).
/// <para>
/// The failure cases are separated rather than collapsed because they mean opposite things to
/// whoever is waiting: <c>authorization_pending</c> is the normal state of a sign-in nobody has
/// gotten to yet, <c>slow_down</c> is a correction to this process's own polling, and
/// <c>expired_token</c> / <c>access_denied</c> are the end of the sign-in. Collapsing them to
/// "no credential yet" is what makes a flow that has already been declined sit there looking
/// pending until the code expires.
/// </para>
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> the flow is run with.</param>
/// <param name="options">The configured OAuth app.</param>
/// <param name="logger">The logger.</param>
[Singleton]
public class CopilotDeviceTokens(
    IHttpClientFactory httpClientFactory,
    IOptions<CopilotOptions> options,
    ILogger<CopilotDeviceTokens> logger) : ICopilotDeviceTokens
{
    const string DeviceCodeUrl = "https://github.com/login/device/code";
    const string TokenUrl = "https://github.com/login/oauth/access_token";

    /// <summary>
    /// GitHub's own default when it does not say - documented as five seconds.
    /// </summary>
    const int DefaultIntervalSeconds = 5;

    /// <inheritdoc/>
    public async Task<CopilotDeviceAuthorization?> Begin(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(options.Value.ClientId))
        {
            logger.NoClientIdConfigured();
            return null;
        }

        try
        {
            using var httpClient = CreateClient();
            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = options.Value.ClientId,
                ["scope"] = options.Value.Scope
            });

            using var response = await httpClient.PostAsync(DeviceCodeUrl, content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.DeviceSignInRejected((int)response.StatusCode);
                return null;
            }

            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            var deviceCode = body?["device_code"]?.GetValue<string>();
            var userCode = body?["user_code"]?.GetValue<string>();
            var verificationUrl = body?["verification_uri"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(deviceCode) || string.IsNullOrWhiteSpace(userCode) || string.IsNullOrWhiteSpace(verificationUrl))
            {
                logger.DeviceSignInIncomplete();
                return null;
            }

            var interval = (int?)body?["interval"]?.GetValue<long>() ?? DefaultIntervalSeconds;
            var expiresIn = (int?)body?["expires_in"]?.GetValue<long>() ?? 900;
            return new(deviceCode, userCode, verificationUrl, Math.Max(interval, 1), DateTimeOffset.UtcNow.AddSeconds(expiresIn));
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.DeviceSignInFailed(exception);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task<CopilotDeviceSignInResult> Complete(CopilotDeviceAuthorization authorization, CancellationToken cancellationToken = default)
    {
        try
        {
            using var httpClient = CreateClient();
            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = options.Value.ClientId,
                ["device_code"] = authorization.DeviceCode,
                ["grant_type"] = "urn:ietf:params:oauth:grant-type:device_code"
            });

            using var response = await httpClient.PostAsync(TokenUrl, content, cancellationToken);

            // GitHub answers the pending and the declined case alike with HTTP 200 and an `error`
            // field, so the status code alone says nothing here - the body is what decides.
            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            if (body?["access_token"]?.GetValue<string>() is { } accessToken && !string.IsNullOrWhiteSpace(accessToken))
            {
                return new(BuildCredential(body, accessToken), false, false, string.Empty);
            }

            return (body?["error"]?.GetValue<string>() ?? string.Empty) switch
            {
                "authorization_pending" => CopilotDeviceSignInResult.StillPending,
                "slow_down" => CopilotDeviceSignInResult.PollingTooFast,
                "expired_token" => new(null, false, false, "The code expired before anyone authorized it. Start another sign-in."),
                "access_denied" => new(null, false, false, "The sign-in was declined on GitHub."),
                "incorrect_client_credentials" or "unauthorized_client" =>
                    new(null, false, false, "GitHub does not recognize the configured OAuth app (Direct:Copilot:ClientId). Check the client id."),
                "device_flow_disabled" =>
                    new(null, false, false, "The configured OAuth app does not have device flow enabled. Enable it in the app's settings on GitHub."),
                var other when !string.IsNullOrWhiteSpace(other) => new(null, false, false, $"GitHub refused the sign-in ({other})."),
                _ => CopilotDeviceSignInResult.StillPending
            };
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            // A network blip mid-poll is not the end of the sign-in - the person is still standing at
            // the verification page, and the next poll a few seconds later usually succeeds.
            logger.DeviceSignInPollFailed(exception);
            return CopilotDeviceSignInResult.StillPending;
        }
    }

    /// <summary>
    /// Stores the token in the shape it will be read back in: a bare token when GitHub issued one
    /// that does not expire (the default for an OAuth app), and an OAuth record when it did issue a
    /// refresh token and an expiry, so nothing downstream has to guess which it got.
    /// </summary>
    /// <param name="body">GitHub's token response.</param>
    /// <param name="accessToken">The access token it carried.</param>
    /// <returns>The credential in the shape it will be stored and read back in.</returns>
    static AIProviderApiKey BuildCredential(JsonObject body, string accessToken)
    {
        var refresh = body["refresh_token"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(refresh) || body["expires_in"] is not { } expiresIn)
        {
            return accessToken;
        }

        var expires = DateTimeOffset.UtcNow.AddSeconds(expiresIn.GetValue<long>()).ToUnixTimeMilliseconds();
        return new JsonObject
        {
            ["type"] = "oauth",
            ["access"] = accessToken,
            ["refresh"] = refresh,
            ["expires"] = expires
        }.ToJsonString();
    }

    HttpClient CreateClient()
    {
        var httpClient = httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(15);

        // Without this GitHub answers the device endpoints as form-encoded text, which parses as
        // nothing here and looks exactly like a malformed response.
        httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return httpClient;
    }
}

/// <summary>
/// Log messages for the device flow - it runs detached, so this is the only trace it leaves.
/// </summary>
internal static partial class CopilotDeviceTokensLog
{
    [LoggerMessage(LogLevel.Warning, "No GitHub OAuth app is configured for Copilot sign-in (Direct:Copilot:ClientId)")]
    internal static partial void NoClientIdConfigured(this ILogger logger);

    [LoggerMessage(LogLevel.Warning, "GitHub would not start a Copilot device sign-in - HTTP {StatusCode}")]
    internal static partial void DeviceSignInRejected(this ILogger logger, int statusCode);

    [LoggerMessage(LogLevel.Warning, "GitHub started a Copilot device sign-in but left out what it takes to complete one")]
    internal static partial void DeviceSignInIncomplete(this ILogger logger);

    [LoggerMessage(LogLevel.Warning, "A Copilot device sign-in could not be started")]
    internal static partial void DeviceSignInFailed(this ILogger logger, Exception exception);

    [LoggerMessage(LogLevel.Debug, "A Copilot device sign-in poll did not reach GitHub - trying again")]
    internal static partial void DeviceSignInPollFailed(this ILogger logger, Exception exception);
}
