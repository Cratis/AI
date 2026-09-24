// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;
namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Log messages for <see cref="AvailableAIModels"/>.
/// </summary>
internal static partial class AvailableAIModelsLog
{
    [LoggerMessage(LogLevel.Warning, "No configured AI provider goes by {ProviderId} - answering with no models")]
    internal static partial void UnknownConfiguredProvider(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "No model listing serves provider type {ProviderType} - answering with no models")]
    internal static partial void NoListingForProviderType(this ILogger logger, AIProviderType providerType);
}
