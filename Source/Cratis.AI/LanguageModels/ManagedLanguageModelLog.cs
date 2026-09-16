// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.LanguageModels;

/// <summary>
/// Log messages for <see cref="ManagedLanguageModel"/>.
/// </summary>
internal static partial class ManagedLanguageModelLog
{
    [LoggerMessage(LogLevel.Warning, "Failed to record language model usage for {Purpose}")]
    internal static partial void FailedToRecordUsage(this ILogger logger, Exception exception, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Warning, "Retrying transient language model failure for {Purpose} (attempt {Attempt}), waiting {Wait}")]
    internal static partial void RetryingTransientFailure(this ILogger logger, LanguageModelPurpose purpose, int attempt, TimeSpan wait);
}