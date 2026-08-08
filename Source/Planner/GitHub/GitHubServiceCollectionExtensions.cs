// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace Planner.GitHub;

/// <summary>
/// Extension methods for registering the GitHub client.
/// </summary>
public static class GitHubServiceCollectionExtensions
{
    /// <summary>
    /// Adds the <see cref="IGitHubClient"/> configured from the <c>Planner:GitHub</c> configuration section.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add to.</param>
    /// <param name="configuration">The configuration to bind the options from.</param>
    /// <returns>The same <see cref="IServiceCollection"/> for chaining.</returns>
    public static IServiceCollection AddGitHub(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<GitHubOptions>(configuration.GetSection(GitHubOptions.SectionName));
        services.AddHttpClient<IGitHubClient, GitHubClient>((serviceProvider, client) =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<GitHubOptions>>().Value;
            var baseUrl = options.ApiBaseUrl.EndsWith('/') ? options.ApiBaseUrl : $"{options.ApiBaseUrl}/";
            client.BaseAddress = new Uri(baseUrl);
            client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Cratis-Planner", "1.0"));
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
            if (!string.IsNullOrEmpty(options.Token))
            {
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.Token);
            }
        });

        return services;
    }
}
