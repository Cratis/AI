// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.LanguageModels;

/// <summary>
/// Extension methods for registering the Planner's own language model.
/// </summary>
public static class LanguageModelServiceCollectionExtensions
{
    /// <summary>
    /// Adds the <see cref="ILanguageModel"/> the Planner's own reasoning (triage, plan summaries)
    /// uses, configured from the <c>Planner:LanguageModel</c> configuration section.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add to.</param>
    /// <param name="configuration">The configuration to bind the options from.</param>
    /// <returns>The same <see cref="IServiceCollection"/> for chaining.</returns>
    public static IServiceCollection AddLanguageModel(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<LanguageModelOptions>(configuration.GetSection(LanguageModelOptions.SectionName));

        services.AddHttpClient<ILanguageModel, AnthropicLanguageModel>((serviceProvider, client) =>
        {
            var baseUrl = serviceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<LanguageModelOptions>>().Value.ApiBaseUrl;
            client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : $"{baseUrl}/");
        });

        return services;
    }
}
