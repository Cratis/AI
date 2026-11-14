// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers;

/// <summary>
/// Where and how an OpenAI-shaped chat-completions request is sent, and who it is sent as.
/// </summary>
/// <param name="HttpClient">The <see cref="HttpClient"/> to send the request with.</param>
/// <param name="RequestUri">The absolute chat-completions endpoint to send the request to.</param>
/// <param name="Model">The model to run the completion on.</param>
/// <param name="ConfigureHeaders">Sets the vendor's own authentication header(s) on the request.</param>
/// <param name="Vendor">The vendor the request is sent to.</param>
/// <param name="ProviderId">The configured provider the request was sent as.</param>
/// <param name="ApiKey">The credential the request is authenticated with - withheld by exact value from any failure diagnostics.</param>
/// <param name="QuotaTracker">Records what the response's rate-limit headers, if any, reported about the provider's remaining quota.</param>
/// <param name="Logger">The logger a failed or empty response is recorded on.</param>
public record ChatCompletionsCall(
    HttpClient HttpClient,
    Uri RequestUri,
    string Model,
    Action<HttpRequestHeaders> ConfigureHeaders,
    AIProviderType Vendor,
    AIProviderId ProviderId,
    AIProviderApiKey ApiKey,
    IAIProviderQuotaTracker QuotaTracker,
    ILogger Logger);
