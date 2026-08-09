// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using Microsoft.Extensions.Options;
using Planner.GitHub.App;

namespace Planner.GitHub;

/// <summary>
/// Extension methods for registering the GitHub client and the GitHub App it authenticates as.
/// </summary>
public static class GitHubServiceCollectionExtensions
{
    /// <summary>
    /// The name of the unauthenticated <see cref="HttpClient"/> used for the one-off manifest
    /// conversion call during App registration - see <see cref="App.GitHubAppEndpoints"/>.
    /// </summary>
    public const string ManifestHttpClientName = "GitHubAppManifest";

    /// <summary>
    /// Adds the <see cref="IGitHubClient"/> and the GitHub App authentication it relies on,
    /// configured from the <c>Planner:GitHub</c> and <c>Planner:GitHubApp</c> configuration sections.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add to.</param>
    /// <param name="configuration">The configuration to bind the options from.</param>
    /// <returns>The same <see cref="IServiceCollection"/> for chaining.</returns>
    public static IServiceCollection AddGitHub(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<GitHubOptions>(configuration.GetSection(GitHubOptions.SectionName));
        services.Configure<GitHubAppOptions>(configuration.GetSection(GitHubAppOptions.SectionName));

        services.AddHttpClient<IGitHubClient, GitHubClient>((serviceProvider, client) =>
            ConfigureGitHubHttpClient(client, serviceProvider.GetRequiredService<IOptions<GitHubOptions>>().Value.ApiBaseUrl));

        services.AddHttpClient<IGitHubAppClient, GitHubAppClient>((serviceProvider, client) =>
            ConfigureGitHubHttpClient(client, serviceProvider.GetRequiredService<IOptions<GitHubOptions>>().Value.ApiBaseUrl));

        services.AddHttpClient(ManifestHttpClientName, (serviceProvider, client) =>
            ConfigureGitHubHttpClient(client, serviceProvider.GetRequiredService<IOptions<GitHubOptions>>().Value.ApiBaseUrl));

        return services;
    }

    static void ConfigureGitHubHttpClient(HttpClient client, string apiBaseUrl)
    {
        var baseUrl = apiBaseUrl.EndsWith('/') ? apiBaseUrl : $"{apiBaseUrl}/";
        client.BaseAddress = new Uri(baseUrl);
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Cratis-Planner", "1.0"));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
    }
}
