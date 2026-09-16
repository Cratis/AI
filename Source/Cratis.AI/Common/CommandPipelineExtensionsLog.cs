// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Common;

/// <summary>
/// Log messages for <see cref="CommandPipelineExtensions"/>.
/// </summary>
internal static partial class CommandPipelineExtensionsLog
{
    [LoggerMessage(LogLevel.Warning, "Command {Command} issued by {Caller} was not successful: {Reason}")]
    internal static partial void CommandNotSuccessful(this ILogger logger, string command, string caller, string reason);
}