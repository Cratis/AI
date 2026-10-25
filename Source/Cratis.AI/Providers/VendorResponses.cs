// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Leaves failed responses unbuffered for bounded diagnostic reads, while retaining the normal
/// buffered-success and whole-request timeout behavior of HttpClient.SendAsync.
/// </summary>
internal static class VendorResponses
{
    /// <summary>
    /// Sends a vendor request, buffering only successful responses.
    /// </summary>
    /// <param name="client">The configured HTTP client.</param>
    /// <param name="request">The vendor request.</param>
    /// <param name="cancellationToken">The caller's cancellation token.</param>
    /// <returns>The response, owned by the caller.</returns>
    internal static async Task<HttpResponseMessage> Send(HttpClient client, HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(client.Timeout);
        var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        try
        {
            if (response.IsSuccessStatusCode)
            {
                await response.Content.LoadIntoBufferAsync(client.MaxResponseContentBufferSize).WaitAsync(deadline.Token);
            }

            return response;
        }
        catch
        {
            response.Dispose();
            throw;
        }
    }
}
