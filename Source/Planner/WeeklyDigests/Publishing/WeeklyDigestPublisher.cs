// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Planner.WeeklyDigests.Publishing;

/// <summary>
/// The default <see cref="IWeeklyDigestPublisher"/> - posts to whichever outlet webhook URLs are
/// configured, skipping any that are not.
/// </summary>
/// <param name="httpClient">The <see cref="HttpClient"/> outbound posts go through.</param>
/// <param name="options">The weekly digest configuration.</param>
/// <param name="logger">The logger.</param>
public class WeeklyDigestPublisher(HttpClient httpClient, IOptions<WeeklyDigestOptions> options, ILogger<WeeklyDigestPublisher> logger) : IWeeklyDigestPublisher
{
    /// <inheritdoc/>
    public async Task<IReadOnlyList<string>> Publish(WeeklyDigestDescription description, IEnumerable<string> themes, CancellationToken cancellationToken = default)
    {
        var configured = options.Value;
        var published = new List<string>();

        if (!string.IsNullOrWhiteSpace(configured.DiscordWebhookUrl))
        {
            var body = JsonSerializer.Serialize(new { content = description.Value });
            if (await Post(configured.DiscordWebhookUrl, body, "Discord", cancellationToken))
            {
                published.Add("Discord");
            }
        }

        if (!string.IsNullOrWhiteSpace(configured.LinkedInWebhookUrl))
        {
            var body = JsonSerializer.Serialize(new { text = description.Value, themes });
            if (await Post(configured.LinkedInWebhookUrl, body, "LinkedIn", cancellationToken))
            {
                published.Add("LinkedIn");
            }
        }

        return published;
    }

    async Task<bool> Post(string url, string body, string outlet, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.PostAsync(url, new StringContent(body, Encoding.UTF8, "application/json"), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.UnexpectedStatusCode(outlet, (int)response.StatusCode);
                return false;
            }

            return true;
        }
        catch (HttpRequestException exception)
        {
            logger.PublishFailed(exception, outlet);
            return false;
        }
    }
}
