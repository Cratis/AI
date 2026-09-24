// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.DependencyInjection;
using Microsoft.Extensions.Logging;
namespace Cratis.AI.Providers.OpenAI;

/// <summary>
/// Mints a fresh <see cref="OpenAISubscriptionCredential"/> from the rotating refresh token in the
/// one Direct holds.
/// </summary>
public interface IOpenAISubscriptionTokens
{
    /// <summary>
    /// Exchanges a credential's refresh token for a new credential.
    /// </summary>
    /// <param name="credential">The credential whose refresh token is spent.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The refreshed credential, or <see langword="null"/> when the exchange failed.</returns>
    Task<OpenAISubscriptionCredential?> Refresh(OpenAISubscriptionCredential credential, CancellationToken cancellationToken = default);

    /// <summary>
    /// Begins a device-code sign-in - the headless half of OpenAI's OAuth, where a person authorizes
    /// from any browser rather than one that has to be on the same machine.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>What the person needs to authorize with, or <see langword="null"/> when the request failed.</returns>
    Task<OpenAIDeviceAuthorization?> BeginDeviceSignIn(CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks once whether a device-code sign-in has been authorized yet.
    /// </summary>
    /// <param name="authorization">What <see cref="BeginDeviceSignIn"/> returned.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The credential once authorized; <see langword="null"/> while still pending or on failure.</returns>
    Task<OpenAISubscriptionCredential?> CompleteDeviceSignIn(OpenAIDeviceAuthorization authorization, CancellationToken cancellationToken = default);
}

/// <summary>
/// An in-flight device-code sign-in.
/// </summary>
/// <param name="DeviceAuthId">OpenAI's handle for this sign-in, used when asking whether it has been authorized.</param>
/// <param name="UserCode">The code the person types into the verification page. Not a secret - it is meaningless without someone signing in to their own ChatGPT account.</param>
/// <param name="IntervalSeconds">How often OpenAI is willing to be asked.</param>
public record OpenAIDeviceAuthorization(string DeviceAuthId, string UserCode, int IntervalSeconds);

/// <summary>
/// The default <see cref="IOpenAISubscriptionTokens"/> - OpenAI's own OAuth token endpoint, called
/// with the public client id the Codex CLI and Pi both authenticate ChatGPT plans under. The values
/// are not secrets: they identify the application, and the refresh token is what proves the plan.
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> the exchange is made with.</param>
/// <param name="logger">The logger - a failed exchange is the difference between a stale credential and a working one, so it never fails silently.</param>
[Singleton]
public class OpenAISubscriptionTokens(IHttpClientFactory httpClientFactory, ILogger<OpenAISubscriptionTokens> logger) : IOpenAISubscriptionTokens
{
    /// <summary>
    /// Where a person authorizes a device-code sign-in.
    /// </summary>
    public const string VerificationUrl = "https://auth.openai.com/codex/device";

    /// <summary>
    /// OpenAI's OAuth token endpoint.
    /// </summary>
    const string TokenUrl = "https://auth.openai.com/oauth/token";

    /// <summary>
    /// The public OAuth client id ChatGPT plans are authenticated under for coding agents - the same
    /// one Pi's own <c>openai-codex</c> provider uses, so a credential minted by <c>pi</c> refreshes
    /// here exactly as it would there.
    /// </summary>
    const string ClientId = "app_EMoamEEZ73f0CkXaXp7hrann";

    const string DeviceUserCodeUrl = "https://auth.openai.com/api/accounts/deviceauth/usercode";
    const string DeviceTokenUrl = "https://auth.openai.com/api/accounts/deviceauth/token";
    const string DeviceRedirectUrl = "https://auth.openai.com/deviceauth/callback";

    /// <inheritdoc/>
    public async Task<OpenAISubscriptionCredential?> Refresh(OpenAISubscriptionCredential credential, CancellationToken cancellationToken = default)
    {
        try
        {
            using var httpClient = httpClientFactory.CreateClient();
            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = credential.Refresh,
                ["client_id"] = ClientId
            });

            using var response = await httpClient.PostAsync(TokenUrl, content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.SubscriptionRefreshRejected((int)response.StatusCode);
                return null;
            }

            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            var access = body?["access_token"]?.GetValue<string>();
            var refresh = body?["refresh_token"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(access) || string.IsNullOrWhiteSpace(refresh) || body?["expires_in"] is not { } expiresIn)
            {
                // Every field is required. A response missing the rotated refresh token in particular
                // must not be accepted: storing the old one back would leave a credential that is
                // already retired at the vendor and fails on next use with no sign of why.
                logger.SubscriptionRefreshIncomplete();
                return null;
            }

            var expires = DateTimeOffset.UtcNow.AddSeconds(expiresIn.GetValue<long>()).ToUnixTimeMilliseconds();
            return new(access, refresh, expires, credential.AccountId);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            logger.SubscriptionRefreshFailed(exception);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task<OpenAIDeviceAuthorization?> BeginDeviceSignIn(CancellationToken cancellationToken = default)
    {
        try
        {
            using var httpClient = httpClientFactory.CreateClient();
            using var content = JsonContent(new JsonObject { ["client_id"] = ClientId });
            using var response = await httpClient.PostAsync(DeviceUserCodeUrl, content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.DeviceSignInRequestRejected((int)response.StatusCode);
                return null;
            }

            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            var deviceAuthId = body?["device_auth_id"]?.GetValue<string>();
            var userCode = body?["user_code"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(deviceAuthId) || string.IsNullOrWhiteSpace(userCode))
            {
                logger.DeviceSignInResponseIncomplete();
                return null;
            }

            // OpenAI sends the interval as a number or as a string depending on the endpoint's mood,
            // which is why Pi's own reader accepts both - so this does too rather than failing a
            // sign-in over a type.
            var interval = body?["interval"] is { } value && int.TryParse(value.ToString(), out var parsed) ? parsed : 5;
            return new(deviceAuthId, userCode, Math.Max(1, interval));
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            logger.SubscriptionRefreshFailed(exception);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task<OpenAISubscriptionCredential?> CompleteDeviceSignIn(OpenAIDeviceAuthorization authorization, CancellationToken cancellationToken = default)
    {
        try
        {
            using var httpClient = httpClientFactory.CreateClient();
            using var content = JsonContent(new JsonObject
            {
                ["device_auth_id"] = authorization.DeviceAuthId,
                ["user_code"] = authorization.UserCode
            });

            using var response = await httpClient.PostAsync(DeviceTokenUrl, content, cancellationToken);

            // Not yet authorized. OpenAI says so with a 403 or a 404 rather than an error body, so
            // these are the ordinary "keep waiting" answer and not a failure.
            if (response.StatusCode is System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }

            if (!response.IsSuccessStatusCode)
            {
                logger.DeviceSignInRequestRejected((int)response.StatusCode);
                return null;
            }

            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
            var code = body?["authorization_code"]?.GetValue<string>();
            var verifier = body?["code_verifier"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(verifier))
            {
                logger.DeviceSignInResponseIncomplete();
                return null;
            }

            return await ExchangeAuthorizationCode(code, verifier, cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            logger.SubscriptionRefreshFailed(exception);
            return null;
        }
    }

    static StringContent JsonContent(JsonObject body) => new(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json");

    async Task<OpenAISubscriptionCredential?> ExchangeAuthorizationCode(string code, string verifier, CancellationToken cancellationToken)
    {
        using var httpClient = httpClientFactory.CreateClient();
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = ClientId,
            ["code"] = code,
            ["code_verifier"] = verifier,
            ["redirect_uri"] = DeviceRedirectUrl
        });

        using var response = await httpClient.PostAsync(TokenUrl, content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.SubscriptionRefreshRejected((int)response.StatusCode);
            return null;
        }

        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
        var access = body?["access_token"]?.GetValue<string>();
        var refresh = body?["refresh_token"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(access) || string.IsNullOrWhiteSpace(refresh) || body?["expires_in"] is not { } expiresIn)
        {
            logger.SubscriptionRefreshIncomplete();
            return null;
        }

        var expires = DateTimeOffset.UtcNow.AddSeconds(expiresIn.GetValue<long>()).ToUnixTimeMilliseconds();
        return new(access, refresh, expires, null);
    }
}
