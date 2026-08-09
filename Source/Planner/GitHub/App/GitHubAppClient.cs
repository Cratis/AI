// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Planner.GitHub.App;

/// <summary>
/// An <see cref="IGitHubAppClient"/> implementation on top of the GitHub REST API.
/// </summary>
/// <param name="httpClient">The <see cref="HttpClient"/> to use - configured with the GitHub API base address at registration.</param>
/// <param name="options">The <see cref="GitHubAppOptions"/> the App authenticates with.</param>
public class GitHubAppClient(HttpClient httpClient, IOptions<GitHubAppOptions> options) : IGitHubAppClient
{
    /// <inheritdoc/>
    public async Task<string> GetInstallationToken(InstallationId installation, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri($"app/installations/{installation.Value}/access_tokens", UriKind.Relative));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", CreateAppToken());
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var payload = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
        return payload?["token"]?.GetValue<string>() ?? string.Empty;
    }

    /// <inheritdoc/>
    public async Task<OrganizationName> GetInstallationAccount(InstallationId installation, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"app/installations/{installation.Value}", UriKind.Relative));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", CreateAppToken());
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var payload = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)) as JsonObject;
        return payload?["account"]?["login"]?.GetValue<string>() ?? OrganizationName.NotSet;
    }

    /// <summary>
    /// Builds and signs the JWT the App itself authenticates with - capped at ten minutes per
    /// GitHub's requirements, backdated by sixty seconds to tolerate clock drift.
    /// </summary>
    /// <returns>The signed JWT.</returns>
    string CreateAppToken()
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(options.Value.PrivateKeyPem);

        var signingCredentials = new SigningCredentials(new RsaSecurityKey(rsa), SecurityAlgorithms.RsaSha256)
        {
            // Microsoft.IdentityModel caches signature providers globally by default, which would
            // retain the RSA instance above after it's disposed on return - the next token signed
            // would then throw ObjectDisposedException. Caching must stay off here.
            CryptoProviderFactory = new CryptoProviderFactory { CacheSignatureProviders = false },
        };

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Value.AppId,
            IssuedAt = DateTime.UtcNow.AddSeconds(-60),
            Expires = DateTime.UtcNow.AddMinutes(10),
            SigningCredentials = signingCredentials,
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
