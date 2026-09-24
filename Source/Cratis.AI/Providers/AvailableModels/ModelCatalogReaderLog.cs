// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;
namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Log messages for <see cref="ModelCatalogReader"/>.
/// </summary>
internal static partial class ModelCatalogReaderLog
{
    [LoggerMessage(LogLevel.Warning, "The model catalog at {Url} answered with {StatusCode} - recorded as a failed discovery, retried on the next catalog pass")]
    internal static partial void CatalogAnsweredWithStatus(this ILogger logger, string url, int statusCode);

    [LoggerMessage(LogLevel.Warning, "Could not read the model catalog at {Url} - recorded as a failed discovery, retried on the next catalog pass")]
    internal static partial void CouldNotReadCatalog(this ILogger logger, Exception exception, string url);
}
