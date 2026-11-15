// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.Routing;

/// <summary>
/// How the proxy is mounted and what it accepts.
/// </summary>
public class ModelProxyOptions
{
    /// <summary>
    /// Gets or sets where the proxy is mounted, for example <c>/ai</c>. Callers use <c>{PathPrefix}/v1/chat/completions</c> and
    /// <c>{PathPrefix}/v1/messages</c>. Empty mounts it at the root.
    /// </summary>
    public string PathPrefix { get; set; } = "/ai";

    /// <summary>
    /// Gets or sets the largest request body, in bytes, read to find the model. Larger requests are refused.
    /// </summary>
    public long MaxRequestBodyBytes { get; set; } = 64 * 1024 * 1024;

    /// <summary>
    /// Gets or sets how long a backend may stay silent before the proxy gives up on it. Local models can think for a long time
    /// before the first token.
    /// </summary>
    public TimeSpan ActivityTimeout { get; set; } = TimeSpan.FromMinutes(15);

    /// <summary>
    /// Gets the prefix as the routes use it: a leading slash and no trailing one, or empty.
    /// </summary>
    internal string NormalizedPrefix => PathPrefix.Trim().Trim('/') is { Length: > 0 } trimmed ? $"/{trimmed}" : string.Empty;
}
